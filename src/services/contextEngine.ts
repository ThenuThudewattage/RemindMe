import * as Location from 'expo-location';
import ReminderRepository from './repo';
import NotificationService from './notifications';
// BatteryService imported lazily to avoid circular dependency
import { Reminder, BatteryState } from '../types/reminder';

export class ContextEngine {
  private static instance: ContextEngine;
  private repo: ReminderRepository;
  private notificationService: NotificationService;
  private recentlyTriggered: Map<number, number> = new Map(); // reminderId -> timestamp

  private constructor() {
    this.repo = ReminderRepository.getInstance();
    this.notificationService = NotificationService.getInstance();
    
    // Set up location callback to break circular dependency - use dynamic import
    this.setupLocationCallback();
  }

  private async setupLocationCallback(): Promise<void> {
    try {
      const LocationService = (await import('./location')).default;
      const locationService = LocationService.getInstance();
      locationService.setLocationChangeCallback(async (location: Location.LocationObject) => {
        try {
          await this.checkLocationConditions(location);
        } catch (error) {
          console.error('Error in location callback:', error);
        }
      });
    } catch (error) {
      console.error('Error setting up location callback:', error);
    }
  }

  public static getInstance(): ContextEngine {
    if (!ContextEngine.instance) {
      ContextEngine.instance = new ContextEngine();
    }
    return ContextEngine.instance;
  }

  public async checkAllConditions(): Promise<void> {
    try {
      const activeReminders = await this.repo.getActiveReminders();
      console.log(`📋 Found ${activeReminders.length} active reminder(s)`);
      
      if (activeReminders.length === 0) {
        console.log('⚠️ No active reminders to check');
        return;
      }
      
      for (const reminder of activeReminders) {
        console.log(`🔍 Checking: "${reminder.title}" (ID: ${reminder.id})`);
        if (reminder.rule.time) {
          console.log(`  📅 Raw time data from DB:`, JSON.stringify(reminder.rule.time));
        }
        await this.evaluateReminder(reminder);
      }
    } catch (error) {
      // If database is not initialized, just log and continue
      if (error instanceof Error && error.message.includes('Database not initialized')) {
        console.log('All conditions check skipped - database not yet initialized');
        return;
      }
      console.error('❌ Error checking all conditions:', error);
    }
  }

  public async checkLocationConditions(location: Location.LocationObject): Promise<void> {
    try {
      const activeReminders = await this.repo.getActiveReminders();
      const locationReminders = activeReminders.filter(r => r.rule.location);
      
      for (const reminder of locationReminders) {
        await this.evaluateReminderWithLocation(reminder, location);
      }
    } catch (error) {
      // If database is not initialized, just log and continue
      if (error instanceof Error && error.message.includes('Database not initialized')) {
        console.log('Location conditions check skipped - database not yet initialized');
        return;
      }
      console.error('Error checking location conditions:', error);
    }
  }

  public async checkBatteryConditions(batteryState: BatteryState): Promise<void> {
    try {
      const activeReminders = await this.repo.getActiveReminders();
      const batteryReminders = activeReminders.filter(r => r.rule.battery);
      
      for (const reminder of batteryReminders) {
        await this.evaluateReminderWithBattery(reminder, batteryState);
      }
    } catch (error) {
      // If database is not initialized, just log and continue
      if (error instanceof Error && error.message.includes('Database not initialized')) {
        console.log('Battery conditions check skipped - database not yet initialized');
        return;
      }
      console.error('Error checking battery conditions:', error);
    }
  }

  public async checkTimeConditions(): Promise<void> {
    try {
      const activeReminders = await this.repo.getActiveReminders();
      const timeReminders = activeReminders.filter(r => r.rule.time);
      
      for (const reminder of timeReminders) {
        await this.evaluateReminderWithTime(reminder);
      }
    } catch (error) {
      // If database is not initialized, just log and continue
      if (error instanceof Error && error.message.includes('Database not initialized')) {
        console.log('Time conditions check skipped - database not yet initialized');
        return;
      }
      console.error('Error checking time conditions:', error);
    }
  }

  private async evaluateReminder(reminder: Reminder): Promise<void> {
    try {
      console.log(`  Conditions: Time=${!!reminder.rule.time}, Location=${!!reminder.rule.location}, Battery=${!!reminder.rule.battery}`);
      
      // Get current location if needed
      let currentLocation: Location.LocationObject | null = null;
      if (reminder.rule.location) {
        const LocationService = (await import('./location')).default;
        const locationService = LocationService.getInstance();
        currentLocation = await locationService.getCurrentLocation();
      }

      // Get current battery state if needed
      let currentBatteryState: BatteryState | null = null;
      if (reminder.rule.battery) {
        const BatteryService = (await import('./battery')).default;
        const batteryService = BatteryService.getInstance();
        currentBatteryState = await batteryService.getCurrentBatteryState();
      }

      // Check if all conditions are met
      const conditionsMet = await this.checkAllConditionsMet(
        reminder,
        currentLocation,
        currentBatteryState
      );

      console.log(`  Result: ${conditionsMet ? '✅ WILL TRIGGER' : '❌ Conditions not met'}`);

      if (conditionsMet) {
        await this.triggerReminder(reminder);
      }
    } catch (error) {
      console.error('❌ Error evaluating reminder:', error);
    }
  }

  private async evaluateReminderWithLocation(
    reminder: Reminder,
    location: Location.LocationObject
  ): Promise<void> {
    try {
      // Get current battery state if needed
      let currentBatteryState: BatteryState | null = null;
      if (reminder.rule.battery) {
        const BatteryService = (await import('./battery')).default;
        const batteryService = BatteryService.getInstance();
        currentBatteryState = await batteryService.getCurrentBatteryState();
      }

      const conditionsMet = await this.checkAllConditionsMet(
        reminder,
        location,
        currentBatteryState
      );

      if (conditionsMet) {
        await this.triggerReminder(reminder);
      }
    } catch (error) {
      console.error('Error evaluating reminder with location:', error);
    }
  }

  private async evaluateReminderWithBattery(
    reminder: Reminder,
    batteryState: BatteryState
  ): Promise<void> {
    try {
      // Get current location if needed
      let currentLocation: Location.LocationObject | null = null;
      if (reminder.rule.location) {
        const LocationService = (await import('./location')).default;
        const locationService = LocationService.getInstance();
        currentLocation = await locationService.getCurrentLocation();
      }

      const conditionsMet = await this.checkAllConditionsMet(
        reminder,
        currentLocation,
        batteryState
      );

      if (conditionsMet) {
        await this.triggerReminder(reminder);
      }
    } catch (error) {
      console.error('Error evaluating reminder with battery:', error);
    }
  }

  private async evaluateReminderWithTime(reminder: Reminder): Promise<void> {
    try {
      // Get current location if needed
      let currentLocation: Location.LocationObject | null = null;
      if (reminder.rule.location) {
        const LocationService = (await import('./location')).default;
        const locationService = LocationService.getInstance();
        currentLocation = await locationService.getCurrentLocation();
      }

      // Get current battery state if needed
      let currentBatteryState: BatteryState | null = null;
      if (reminder.rule.battery) {
        const BatteryService = (await import('./battery')).default;
        const batteryService = BatteryService.getInstance();
        currentBatteryState = await batteryService.getCurrentBatteryState();
      }

      const conditionsMet = await this.checkAllConditionsMet(
        reminder,
        currentLocation,
        currentBatteryState
      );

      if (conditionsMet) {
        await this.triggerReminder(reminder);
      }
    } catch (error) {
      console.error('Error evaluating reminder with time:', error);
    }
  }

  private async checkAllConditionsMet(
    reminder: Reminder,
    location: Location.LocationObject | null,
    batteryState: BatteryState | null
  ): Promise<boolean> {
    try {
      console.log(`  📋 Checking all conditions for: "${reminder.title}"`);
      
      // Check if reminder is in cooldown
      if (await this.isInCooldown(reminder)) {
        console.log(`    ❌ In cooldown period`);
        return false;
      }

      // Check if it's quiet hours
      if (this.isQuietHours(reminder)) {
        console.log(`    ❌ Quiet hours active`);
        return false;
      }

      // Check if reminder has expired
      if (this.isExpired(reminder)) {
        console.log(`    ❌ Reminder expired`);
        return false;
      }

      // Check time condition
      if (reminder.rule.time) {
        console.log(`    ⏰ Checking time condition...`);
        if (!this.checkTimeCondition(reminder.rule.time)) {
          return false;
        }
      } else {
        console.log(`    ⏰ No time condition`);
      }

      // Check location condition
      if (reminder.rule.location) {
        console.log(`    📍 Checking location condition...`);
        if (!this.checkLocationCondition(reminder.rule.location, location)) {
          console.log(`    ❌ Location condition not met`);
          return false;
        }
        console.log(`    ✅ Location condition met`);
      } else {
        console.log(`    📍 No location condition`);
      }

      // Check battery condition
      if (reminder.rule.battery) {
        console.log(`    🔋 Checking battery condition...`);
        if (!this.checkBatteryCondition(reminder.rule.battery, batteryState)) {
          console.log(`    ❌ Battery condition not met`);
          return false;
        }
        console.log(`    ✅ Battery condition met`);
      } else {
        console.log(`    🔋 No battery condition`);
      }

      console.log(`  ✅ ALL CONDITIONS MET!`);
      return true;
    } catch (error) {
      console.error('Error checking conditions:', error);
      return false;
    }
  }

  private async isInCooldown(reminder: Reminder): Promise<boolean> {
    try {
      const cooldownMins = reminder.rule.options?.cooldownMins;
      if (!cooldownMins) return false;

      const events = await this.repo.getReminderEvents(reminder.id);
      const lastTriggered = events.find(e => e.type === 'triggered');
      
      if (!lastTriggered) return false;

      const cooldownUntil = new Date(lastTriggered.createdAt);
      cooldownUntil.setMinutes(cooldownUntil.getMinutes() + cooldownMins);
      
      return new Date() < cooldownUntil;
    } catch (error) {
      console.error('Error checking cooldown:', error);
      return false;
    }
  }

  private isQuietHours(reminder: Reminder): boolean {
    try {
      const quietHours = reminder.rule.options?.quietHours;
      if (!quietHours) return false;

      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      
      const [startHour, startMin] = quietHours.start.split(':').map(Number);
      const [endHour, endMin] = quietHours.end.split(':').map(Number);
      
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;

      if (startTime < endTime) {
        // Same day quiet hours (e.g., 22:00 - 06:00 next day)
        return currentTime >= startTime && currentTime <= endTime;
      } else {
        // Cross-midnight quiet hours (e.g., 22:00 - 06:00 next day)
        return currentTime >= startTime || currentTime <= endTime;
      }
    } catch (error) {
      console.error('Error checking quiet hours:', error);
      return false;
    }
  }

  private isExpired(reminder: Reminder): boolean {
    try {
      const expiry = reminder.rule.options?.expiry;
      if (!expiry) return false;

      return new Date() > new Date(expiry);
    } catch (error) {
      console.error('Error checking expiry:', error);
      return false;
    }
  }

  private checkTimeCondition(timeRule: NonNullable<Reminder['rule']['time']>): boolean {
    try {
      const now = new Date();
      console.log(`    ⏰ Time Check Details:`);
      console.log(`       Current time: ${now.toLocaleString()} (${now.getTime()})`);
      
      if (timeRule.start) {
        const startTime = new Date(timeRule.start);
        console.log(`       Start time raw: "${timeRule.start}"`);
        console.log(`       Start time parsed: ${startTime.toLocaleString()} (${startTime.getTime()})`);
        console.log(`       Difference: ${(now.getTime() - startTime.getTime()) / 1000} seconds`);
        
        if (now < startTime) {
          console.log(`    ❌ Too early (current ${now.getTime()} < start ${startTime.getTime()})`);
          return false;
        } else {
          console.log(`    ✅ After start time`);
        }
      }
      
      if (timeRule.end) {
        const endTime = new Date(timeRule.end);
        const startTime = timeRule.start ? new Date(timeRule.start) : endTime;
        
        console.log(`       End time raw: "${timeRule.end}"`);
        console.log(`       End time parsed: ${endTime.toLocaleString()} (${endTime.getTime()})`);
        
        // If start and end are the same (single-time reminder), add 5 minute buffer
        if (startTime.getTime() === endTime.getTime()) {
          endTime.setMinutes(endTime.getMinutes() + 5);
          console.log(`       End time (with 5min buffer): ${endTime.toLocaleString()} (${endTime.getTime()})`);
          console.log(`       Buffer difference: ${(endTime.getTime() - now.getTime()) / 1000} seconds`);
        }
        
        if (now > endTime) {
          console.log(`    ❌ Too late (current ${now.getTime()} > end ${endTime.getTime()})`);
          return false;
        } else {
          console.log(`    ✅ Before end time`);
        }
      }
      
      console.log(`    ✅ Time condition MET!`);
      return true;
    } catch (error) {
      console.error('❌ Error checking time condition:', error);
      return false;
    }
  }

  private checkLocationCondition(
    locationRule: NonNullable<Reminder['rule']['location']>,
    location: Location.LocationObject | null
  ): boolean {
    try {
      if (!location) return false;

      const LocationService = require('./location').default;
      const locationService = LocationService.getInstance();
      
      return locationService.isWithinRadius(
        location.coords.latitude,
        location.coords.longitude,
        locationRule.lat,
        locationRule.lon,
        locationRule.radius
      );
    } catch (error) {
      console.error('Error checking location condition:', error);
      return false;
    }
  }

  private checkBatteryCondition(
    batteryRule: NonNullable<Reminder['rule']['battery']>,
    batteryState: BatteryState | null
  ): boolean {
    try {
      if (!batteryState) return false;

      const level = batteryState.batteryLevel;
      
      if (batteryRule.min !== undefined && level < batteryRule.min) {
        return false;
      }
      
      if (batteryRule.max !== undefined && level > batteryRule.max) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking battery condition:', error);
      return false;
    }
  }

  private async triggerReminder(reminder: Reminder): Promise<void> {
    try {
      console.log('🔔 Triggering reminder:', reminder.title);
      
      // Check if this is an alarm reminder
      if (reminder.alarm?.enabled) {
        // Only apply cooldown to alarms if configured
        const cooldownMins = reminder.alarm.cooldownMins;
        
        if (cooldownMins !== undefined && cooldownMins > 0) {
          const cooldownMs = cooldownMins * 60 * 1000;
          const lastTriggered = this.recentlyTriggered.get(reminder.id);
          const now = Date.now();
          
          if (lastTriggered && (now - lastTriggered) < cooldownMs) {
            const remaining = Math.ceil((cooldownMs - (now - lastTriggered)) / 1000);
            console.log(`⏸️ Alarm ${reminder.id} in cooldown (${remaining}s remaining, cooldown: ${cooldownMins}m)`);
            return;
          }
          
          // Mark as triggered
          this.recentlyTriggered.set(reminder.id, now);
        }
        
        const cooldownMsg = cooldownMins ? ` (cooldown: ${cooldownMins}m)` : ' (no cooldown)';
        console.log(`⏰ Alarm enabled - triggering full alarm notification${cooldownMsg}`);
        // Use AlarmService for alarm reminders
        const AlarmService = (await import('./alarm')).default;
        const alarmService = AlarmService.getInstance();
        await alarmService.initialize();
        await alarmService.triggerAlarm(reminder, 'time');
      } else {
        console.log('🔔 Regular notification - showing banner (no cooldown)');
        // Use NotificationService for regular reminders - no cooldown
        await this.notificationService.showImmediateNotification(
          reminder.id,
          reminder.title,
          reminder.notes
        );
      }

      // Log the trigger event
      await this.repo.logEvent(reminder.id, 'triggered', {
        timestamp: new Date().toISOString(),
        conditions: reminder.rule,
        isAlarm: reminder.alarm?.enabled || false,
      });

      console.log('✅ Reminder triggered successfully:', reminder.id);
    } catch (error) {
      console.error('❌ Error triggering reminder:', error);
    }
  }

  /**
   * Clear cooldown for a specific reminder
   * Should be called when a reminder is dismissed or deleted
   */
  public clearCooldown(reminderId: number): void {
    if (this.recentlyTriggered.has(reminderId)) {
      this.recentlyTriggered.delete(reminderId);
      console.log(`🗑️ Cleared cooldown for reminder ${reminderId}`);
    }
  }
}

export default ContextEngine;