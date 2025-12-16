import DatabaseService from './db';
import { Reminder, ReminderEvent, CreateReminderInput, UpdateReminderInput } from '../types/reminder';
import GeofencingService from '../features/geofencing/service';
import NotificationService from './notifications';

class ReminderRepository {
  private dbService: DatabaseService;
  private geofencingService: GeofencingService;
  private static instance: ReminderRepository;

  private constructor() {
    this.dbService = DatabaseService.getInstance();
    this.geofencingService = GeofencingService.getInstance();
  }

  public static getInstance(): ReminderRepository {
    if (!ReminderRepository.instance) {
      ReminderRepository.instance = new ReminderRepository();
    }
    return ReminderRepository.instance;
  }

  public async initialize(): Promise<void> {
    await this.dbService.initialize();
    
    // Double-check that initialization was successful
    if (!this.dbService.isReady()) {
      throw new Error('Database initialization failed - database is not ready');
    }

    // Initialize notification service
    const notificationService = NotificationService.getInstance();
    await notificationService.initialize();
    
    // Initialize alarm service
    const AlarmService = (await import('./alarm')).default;
    const alarmService = AlarmService.getInstance();
    await alarmService.initialize();
    
    // Set up notification action handler to avoid circular dependency
    notificationService.setNotificationActionHandler(async (reminderId: number, action: string, title: string) => {
      switch (action) {
        case 'SNOOZE':
          await this.snoozeReminder(reminderId, 10); // Snooze for 10 minutes
          await notificationService.scheduleSnoozeNotification(reminderId, title);
          console.log(`Reminder ${reminderId} snoozed for 10 minutes`);
          break;
        case 'DONE':
          await this.markReminderCompleted(reminderId);
          console.log(`Reminder ${reminderId} marked as completed`);
          break;
        case 'DISMISS':
          await this.dismissReminder(reminderId);
          console.log(`Reminder ${reminderId} dismissed`);
          break;
        case 'OPEN':
        default:
          console.log('Opening reminder:', reminderId);
          break;
      }
    });

    // Set up alarm trigger handler
    notificationService.setAlarmTriggerHandler(async (reminderId: number) => {
      try {
        const reminder = await this.getReminder(reminderId);
        if (reminder && reminder.alarm?.enabled) {
          await alarmService.triggerAlarm(reminder, 'time');
          console.log(`Alarm triggered for reminder ${reminderId}`);
        }
      } catch (error) {
        console.error('Failed to trigger alarm:', error);
      }
    });

    // Set up alarm action handler
    notificationService.setAlarmActionHandler(async (reminderId: number, action: string, title: string) => {
      switch (action) {
        case 'ALARM_SNOOZE':
          await alarmService.snoozeAlarm(10);
          console.log(`Alarm snoozed for 10 minutes`);
          break;
        case 'ALARM_DISMISS':
          await alarmService.dismissAlarm();
          await this.dismissReminder(reminderId);
          console.log(`Alarm dismissed`);
          break;
        case 'ALARM_OPEN':
        default:
          console.log('Opening alarm screen:', reminderId);
          break;
      }
    });
  }

  public async createReminder(input: CreateReminderInput): Promise<Reminder> {
    try {
      const reminder = await this.dbService.createReminder(input);
      
      // Register geofence if location trigger is enabled
      if (reminder.locationTrigger?.enabled && reminder.enabled) {
        await this.registerGeofence(reminder);
      }
      
      await this.logEvent(reminder.id, 'triggered', { action: 'created' });
      return reminder;
    } catch (error) {
      console.error('Failed to create reminder:', error);
      throw error;
    }
  }

  public async getReminder(id: number): Promise<Reminder | null> {
    try {
      return await this.dbService.getReminderById(id);
    } catch (error) {
      console.error('Failed to get reminder:', error);
      throw error;
    }
  }

  public async getAllReminders(): Promise<Reminder[]> {
    try {
      return await this.dbService.getAllReminders();
    } catch (error) {
      console.error('Failed to get all reminders:', error);
      throw error;
    }
  }

  public async getActiveReminders(): Promise<Reminder[]> {
    try {
      return await this.dbService.getEnabledReminders();
    } catch (error) {
      console.error('Failed to get active reminders:', error);
      throw error;
    }
  }

  public async updateReminder(input: UpdateReminderInput): Promise<Reminder> {
    try {
      // Get the existing reminder to check for geofence changes
      const existingReminder = await this.dbService.getReminderById(input.id);
      const reminder = await this.dbService.updateReminder(input);
      
      // Handle geofence registration/unregistration
      await this.handleGeofenceChanges(existingReminder, reminder);
      
      await this.logEvent(reminder.id, 'triggered', { action: 'updated' });
      return reminder;
    } catch (error) {
      console.error('Failed to update reminder:', error);
      throw error;
    }
  }

  public async deleteReminder(id: number): Promise<void> {
    try {
      // Unregister geofence before deleting
      await this.unregisterGeofence(id.toString());
      
      // Cancel scheduled notifications
      await this.cancelScheduledNotification(id);
      
      // Clear cooldown from context engine
      const ContextEngine = (await import('./contextEngine')).ContextEngine;
      const contextEngine = ContextEngine.getInstance();
      contextEngine.clearCooldown(id);
      
      await this.logEvent(id, 'dismissed', { action: 'deleted' });
      await this.dbService.deleteReminder(id);
      
      console.log(`🗑️ Reminder ${id} deleted and cooldown cleared`);
    } catch (error) {
      console.error('Failed to delete reminder:', error);
      throw error;
    }
  }

  public async enableReminder(id: number): Promise<Reminder> {
    try {
      const reminder = await this.dbService.updateReminder({ id, enabled: true });
      
      // Register geofence if location trigger is enabled
      if (reminder.locationTrigger?.enabled) {
        await this.registerGeofence(reminder);
      }
      
      await this.logEvent(id, 'triggered', { action: 'enabled' });
      return reminder;
    } catch (error) {
      console.error('Failed to enable reminder:', error);
      throw error;
    }
  }

  public async disableReminder(id: number): Promise<Reminder> {
    try {
      const reminder = await this.dbService.updateReminder({ id, enabled: false });
      
      // Unregister geofence
      await this.unregisterGeofence(id.toString());
      
      await this.logEvent(id, 'dismissed', { action: 'disabled' });
      return reminder;
    } catch (error) {
      console.error('Failed to disable reminder:', error);
      throw error;
    }
  }

  public async logEvent(reminderId: number, type: ReminderEvent['type'], payload?: any): Promise<ReminderEvent> {
    try {
      // Fetch the reminder to get its title
      const reminder = await this.getReminder(reminderId);
      const reminderTitle = reminder?.title;
      
      return await this.dbService.createEvent(reminderId, type, payload, reminderTitle);
    } catch (error) {
      console.error('Failed to log event:', error);
      throw error;
    }
  }

  public async getReminderEvents(reminderId: number): Promise<ReminderEvent[]> {
    try {
      return await this.dbService.getEventsByReminderId(reminderId);
    } catch (error) {
      console.error('Failed to get reminder events:', error);
      throw error;
    }
  }

  public async getRecentEvents(limit?: number): Promise<ReminderEvent[]> {
    try {
      return await this.dbService.getRecentEvents(limit);
    } catch (error) {
      console.error('Failed to get recent events:', error);
      throw error;
    }
  }

  public async markReminderCompleted(id: number): Promise<void> {
    try {
      await this.logEvent(id, 'completed');
      // Optionally disable the reminder if it's not repeating
      const reminder = await this.getReminder(id);
      if (reminder && (!reminder.rule.options?.repeat || reminder.rule.options?.repeat === 'none')) {
        await this.disableReminder(id);
      }
    } catch (error) {
      console.error('Failed to mark reminder as completed:', error);
      throw error;
    }
  }

  public async snoozeReminder(id: number, snoozeMinutes: number = 10): Promise<void> {
    try {
      await this.logEvent(id, 'snoozed', { 
        snoozedUntil: new Date(Date.now() + snoozeMinutes * 60 * 1000).toISOString(),
        snoozeMinutes 
      });
    } catch (error) {
      console.error('Failed to snooze reminder:', error);
      throw error;
    }
  }

  public async dismissReminder(id: number): Promise<void> {
    try {
      await this.logEvent(id, 'dismissed');
      // Disable the reminder so it doesn't trigger again
      await this.disableReminder(id);
      
      // Clear cooldown from context engine
      const ContextEngine = (await import('./contextEngine')).ContextEngine;
      const contextEngine = ContextEngine.getInstance();
      contextEngine.clearCooldown(id);
      
      console.log(`✅ Reminder ${id} dismissed and disabled`);
    } catch (error) {
      console.error('Failed to dismiss reminder:', error);
      throw error;
    }
  }

  public async cleanupOldEvents(daysToKeep: number = 30): Promise<void> {
    try {
      await this.dbService.clearOldEvents(daysToKeep);
    } catch (error) {
      console.error('Failed to cleanup old events:', error);
      throw error;
    }
  }

  public async clearAllHistory(): Promise<void> {
    try {
      await this.dbService.clearAllEvents();
    } catch (error) {
      console.error('Failed to clear all history:', error);
      throw error;
    }
  }

  public async searchReminders(query: string): Promise<Reminder[]> {
    try {
      const allReminders = await this.getAllReminders();
      const searchTerm = query.toLowerCase();
      
      return allReminders.filter(reminder => 
        reminder.title.toLowerCase().includes(searchTerm) ||
        reminder.notes?.toLowerCase().includes(searchTerm)
      );
    } catch (error) {
      console.error('Failed to search reminders:', error);
      throw error;
    }
  }

  public async getRemindersByLocation(lat: number, lon: number, radiusKm: number = 1): Promise<Reminder[]> {
    try {
      const activeReminders = await this.getActiveReminders();
      
      return activeReminders.filter(reminder => {
        if (!reminder.rule.location) return false;
        
        const distance = this.calculateDistance(
          lat, lon,
          reminder.rule.location.lat, reminder.rule.location.lon
        );
        
        return distance <= radiusKm * 1000; // Convert km to meters
      });
    } catch (error) {
      console.error('Failed to get reminders by location:', error);
      throw error;
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // Geofencing helper methods
  private async registerGeofence(reminder: Reminder): Promise<void> {
    if (!reminder.locationTrigger?.enabled || !reminder.enabled) {
      return;
    }

    try {
      await this.geofencingService.registerGeofence(reminder.id.toString(), {
        latitude: reminder.locationTrigger.latitude,
        longitude: reminder.locationTrigger.longitude,
        radius: reminder.locationTrigger.radius,
        mode: reminder.locationTrigger.mode,
      });
      
      console.log(`Geofence registered for reminder ${reminder.id}`);
    } catch (error) {
      console.error(`Failed to register geofence for reminder ${reminder.id}:`, error);
      // Don't throw - allow reminder creation/update to succeed even if geofencing fails
    }
  }

  private async unregisterGeofence(reminderId: string): Promise<void> {
    try {
      await this.geofencingService.unregisterGeofence(reminderId);
      console.log(`Geofence unregistered for reminder ${reminderId}`);
    } catch (error) {
      console.error(`Failed to unregister geofence for reminder ${reminderId}:`, error);
      // Don't throw - allow reminder deletion/update to succeed even if geofencing fails
    }
  }

  private async handleGeofenceChanges(existingReminder: Reminder | null, updatedReminder: Reminder): Promise<void> {
    if (!existingReminder) return;

    const reminderId = updatedReminder.id.toString();
    
    // Check if geofence should be removed
    const shouldRemoveGeofence = 
      !updatedReminder.enabled ||
      !updatedReminder.locationTrigger?.enabled ||
      !updatedReminder.locationTrigger;
    
    // Check if geofence should be added/updated
    const shouldAddGeofence = 
      updatedReminder.enabled && 
      updatedReminder.locationTrigger?.enabled;
    
    // Check if location changed
    const locationChanged = 
      existingReminder.locationTrigger?.latitude !== updatedReminder.locationTrigger?.latitude ||
      existingReminder.locationTrigger?.longitude !== updatedReminder.locationTrigger?.longitude ||
      existingReminder.locationTrigger?.radius !== updatedReminder.locationTrigger?.radius ||
      existingReminder.locationTrigger?.mode !== updatedReminder.locationTrigger?.mode;

    if (shouldRemoveGeofence) {
      await this.unregisterGeofence(reminderId);
    } else if (shouldAddGeofence && (locationChanged || !existingReminder.locationTrigger?.enabled)) {
      // Unregister old geofence first if it exists
      if (existingReminder.locationTrigger?.enabled) {
        await this.unregisterGeofence(reminderId);
      }
      // Register new geofence
      await this.registerGeofence(updatedReminder);
    }
  }

  /**
   * Schedule a notification for time-based reminders
   * This allows notifications to work even when app is closed
   */
  private async scheduleTimeBasedNotification(reminder: Reminder): Promise<void> {
    try {
      if (!reminder.rule?.time?.start) return;
      
      const notificationService = NotificationService.getInstance();
      const scheduledTime = new Date(reminder.rule.time.start);
      const now = new Date();
      
      // Only schedule if the time is in the future
      if (scheduledTime > now) {
        await notificationService.showReminderNotification(
          reminder.id,
          reminder.title,
          reminder.notes || 'Reminder triggered',
          scheduledTime
        );
        console.log(`📅 Scheduled notification for reminder ${reminder.id} at ${scheduledTime.toLocaleString()}`);
      }
    } catch (error) {
      console.error('Failed to schedule notification:', error);
    }
  }

  /**
   * Cancel scheduled notification for a reminder
   */
  private async cancelScheduledNotification(reminderId: number): Promise<void> {
    try {
      const notificationService = NotificationService.getInstance();
      // Cancel all notifications for this reminder
      const scheduled = await notificationService.getScheduledNotifications();
      for (const notification of scheduled) {
        if (notification.content.data?.reminderId === reminderId) {
          await notificationService.cancelNotification(notification.identifier);
          console.log(`🗑️ Cancelled scheduled notification: ${notification.identifier}`);
        }
      }
    } catch (error) {
      console.error('Failed to cancel scheduled notification:', error);
    }
  }

  public async restoreGeofences(): Promise<void> {
    try {
      await this.geofencingService.restoreAllGeofencesOnLaunch();
      console.log('Geofences restored on app launch');
    } catch (error) {
      console.error('Failed to restore geofences:', error);
    }
  }
}

export default ReminderRepository;