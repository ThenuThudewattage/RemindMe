import DatabaseService from './db';
import { Reminder, ReminderEvent, CreateReminderInput, UpdateReminderInput } from '../types/reminder';

class ReminderRepository {
  private dbService: DatabaseService;
  private static instance: ReminderRepository;

  private constructor() {
    this.dbService = DatabaseService.getInstance();
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
  }

  public async createReminder(input: CreateReminderInput): Promise<Reminder> {
    try {
      const reminder = await this.dbService.createReminder(input);
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
      const reminder = await this.dbService.updateReminder(input);
      await this.logEvent(reminder.id, 'triggered', { action: 'updated' });
      return reminder;
    } catch (error) {
      console.error('Failed to update reminder:', error);
      throw error;
    }
  }

  public async deleteReminder(id: number): Promise<void> {
    try {
      await this.logEvent(id, 'dismissed', { action: 'deleted' });
      await this.dbService.deleteReminder(id);
    } catch (error) {
      console.error('Failed to delete reminder:', error);
      throw error;
    }
  }

  public async enableReminder(id: number): Promise<Reminder> {
    try {
      const reminder = await this.dbService.updateReminder({ id, enabled: true });
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
      await this.logEvent(id, 'dismissed', { action: 'disabled' });
      return reminder;
    } catch (error) {
      console.error('Failed to disable reminder:', error);
      throw error;
    }
  }

  public async logEvent(reminderId: number, type: ReminderEvent['type'], payload?: any): Promise<ReminderEvent> {
    try {
      return await this.dbService.createEvent(reminderId, type, payload);
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
}

export default ReminderRepository;