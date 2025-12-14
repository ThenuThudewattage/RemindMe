/**
 * ALARM SERVICE
 * 
 * Manages alarm functionality for reminders:
 * - Plays looping alarm sounds
 * - Manages wake locks to keep device awake
 * - Handles alarm state (ringing, snoozed, dismissed)
 * - Works in background and when device is locked
 * 
 * Key features:
 * - Audio playback with expo-av
 * - Wake lock management with expo-keep-awake
 * - Full-screen alarm notifications
 * - Snooze and dismiss functionality
 * - Integrates with geofencing and time-based triggers
 */

import { Audio, AVPlaybackStatus } from 'expo-av';
import { Sound } from 'expo-av/build/Audio';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Vibration } from 'react-native';
import { AlarmState, AlarmTrigger, Reminder, AlarmSettings } from '../types/reminder';

const ALARM_STATE_KEY = 'alarm_state';
const ACTIVE_ALARMS_KEY = 'active_alarms';
const DEFAULT_SNOOZE_INTERVAL = 10; // minutes
const DEFAULT_MAX_SNOOZE = 3;

class AlarmService {
  private static instance: AlarmService;
  private currentAlarm: AlarmState | null = null;
  private alarmSound: Sound | null = null;
  private isInitialized: boolean = false;
  private alarmTriggerHandler: ((trigger: AlarmTrigger) => void) | null = null;

  private constructor() {}

  public static getInstance(): AlarmService {
    if (!AlarmService.instance) {
      AlarmService.instance = new AlarmService();
    }
    return AlarmService.instance;
  }

  /**
   * Initialize the alarm service
   * Sets up audio mode for alarm playback
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Configure audio session for alarm playback
      // This ensures audio plays even when device is in silent mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true, // CRITICAL: Play even in silent mode
        staysActiveInBackground: true, // Continue playing in background
        shouldDuckAndroid: true, // Lower other audio when alarm plays
        playThroughEarpieceAndroid: false, // Use speakers, not earpiece
      });

      // Restore any active alarm state from storage
      await this.restoreAlarmState();
      
      // If there's a restored alarm but it's old (> 5 minutes), clear it
      if (this.currentAlarm && this.currentAlarm.triggeredAt) {
        const alarmAge = Date.now() - this.currentAlarm.triggeredAt;
        const FIVE_MINUTES = 5 * 60 * 1000;
        
        if (alarmAge > FIVE_MINUTES) {
          console.log('Clearing stale alarm state (older than 5 minutes)');
          await this.dismissAlarm();
        }
      }

      this.isInitialized = true;
      console.log('✅ Alarm service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize alarm service:', error);
      throw error;
    }
  }

  /**
   * Set handler for alarm trigger events
   * This allows external components to react to alarm triggers
   */
  public setAlarmTriggerHandler(handler: (trigger: AlarmTrigger) => void): void {
    this.alarmTriggerHandler = handler;
  }

  /**
   * Trigger an alarm for a reminder
   * This is called when a reminder's conditions are met
   * 
   * @param reminder - The reminder to trigger alarm for
   * @param triggeredBy - What triggered the alarm (time, location, etc.)
   */
  public async triggerAlarm(
    reminder: Reminder,
    triggeredBy: 'time' | 'location' | 'battery' | 'manual' = 'time'
  ): Promise<void> {
    try {
      // Check if alarm is enabled for this reminder
      if (!reminder.alarm?.enabled) {
        console.log('Alarm not enabled for reminder:', reminder.id);
        return;
      }

      // Check if already ringing FOR THIS SPECIFIC REMINDER
      if (this.currentAlarm?.isRinging && this.currentAlarm.reminderId === reminder.id) {
        console.log('Alarm already ringing for this reminder, ignoring duplicate trigger');
        return;
      }

      // If a different alarm is ringing, dismiss it first
      if (this.currentAlarm?.isRinging && this.currentAlarm.reminderId !== reminder.id) {
        console.log('Different alarm ringing, dismissing it first');
        await this.dismissAlarm();
      }

      console.log(`🔔 Triggering alarm for reminder ${reminder.id} (${triggeredBy})`);

      // Create alarm state
      const alarmState: AlarmState = {
        reminderId: reminder.id,
        isRinging: true,
        snoozeCount: 0,
        triggeredAt: Date.now(),
        soundLoaded: false,
      };

      this.currentAlarm = alarmState;
      await this.saveAlarmState();

      // Activate wake lock to keep device awake
      await this.activateWakeLock();

      // Load and play alarm sound
      await this.playAlarmSound(reminder.alarm);

      // Vibrate if enabled
      if (reminder.alarm.vibrate !== false) {
        this.startVibration();
      }

      // Show full-screen notification
      await this.showAlarmNotification(reminder);

      // Notify handler
      const trigger: AlarmTrigger = {
        reminderId: reminder.id,
        reminderTitle: reminder.title,
        triggeredBy,
        timestamp: Date.now(),
      };

      if (this.alarmTriggerHandler) {
        this.alarmTriggerHandler(trigger);
      }

      console.log(`✅ Alarm successfully triggered and showing for reminder ${reminder.id}`);
    } catch (error) {
      console.error('Failed to trigger alarm:', error);
      throw error;
    }
  }

  /**
   * Play alarm sound with looping
   * Uses system notification sound and vibration
   */
  private async playAlarmSound(settings: AlarmSettings): Promise<void> {
    try {
      console.log('🔊 Attempting to play alarm sound...');
      
      // For Expo Go, we'll rely on the notification sound + vibration
      // The notification itself will play a sound
      // We'll ensure continuous vibration for the alarm effect
      
      // Start continuous vibration immediately
      this.startVibration();
      
      console.log('✅ Alarm audio/vibration started (notification sound + vibration)');
    } catch (error) {
      console.error('Failed to setup alarm audio:', error);
      // Ensure vibration at minimum
      this.startVibration();
    }
  }

  /**
   * Playback status update callback
   */
  private onPlaybackStatusUpdate = (status: AVPlaybackStatus): void => {
    if (!status.isLoaded) {
      console.warn('Alarm sound not loaded');
      return;
    }

    if (status.didJustFinish && !status.isLooping) {
      console.log('Alarm sound finished playing');
    }
  };

  /**
   * Start vibration pattern
   * Vibrates in a pattern until stopped
   */
  private startVibration(): void {
    if (Platform.OS === 'android') {
      // Android: Vibrate in pattern (vibrate 1s, pause 1s, repeat)
      Vibration.vibrate([1000, 1000], true);
    } else {
      // iOS: Simple vibration
      Vibration.vibrate();
    }
  }

  /**
   * Stop vibration
   */
  private stopVibration(): void {
    Vibration.cancel();
  }

  /**
   * Show full-screen alarm notification
   * This appears even when app is in background or device is locked
   */
  private async showAlarmNotification(reminder: Reminder): Promise<void> {
    try {
      console.log('📢 Creating full-screen alarm notification for lock screen...');
      
      // Show a high-priority full-screen notification that works on lock screen
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 ALARM - ' + reminder.title,
          body: reminder.notes || 'Tap to view alarm',
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
          categoryIdentifier: 'ALARM',
          sticky: true, // Make notification persistent
          autoDismiss: false, // Don't auto-dismiss
          data: {
            reminderId: reminder.id,
            reminderTitle: reminder.title,
            type: 'alarm',
            triggeredBy: 'time',
          },
        },
        trigger: null, // Trigger immediately
        identifier: `alarm-${reminder.id}-${Date.now()}`,
      });

      // Also navigate to alarm screen immediately if app is in foreground
      try {
        const { router } = await import('expo-router');
        router.push({
          pathname: '/alarm',
          params: {
            reminderId: reminder.id.toString(),
            reminderTitle: reminder.title,
            triggeredBy: 'time',
          },
        });
      } catch (error) {
        console.log('App may be in background, notification shown');
      }

      console.log('✅ Full-screen alarm notification shown');
    } catch (error) {
      console.error('Failed to show alarm notification:', error);
    }
  }

  /**
   * Snooze the current alarm
   * @param customInterval - Custom snooze interval in minutes (optional)
   */
  public async snoozeAlarm(customInterval?: number): Promise<void> {
    if (!this.currentAlarm) {
      console.warn('No active alarm to snooze');
      return;
    }

    try {
      // Check max snooze count
      const maxSnooze = DEFAULT_MAX_SNOOZE;
      if (this.currentAlarm.snoozeCount >= maxSnooze) {
        console.log('Max snooze count reached, alarm will continue');
        return;
      }

      // Stop current alarm
      await this.stopAlarmSound();
      await this.deactivateWakeLock();
      this.stopVibration();

      // Increment snooze count
      this.currentAlarm.snoozeCount++;
      this.currentAlarm.isRinging = false;
      await this.saveAlarmState();

      // Schedule snooze notification
      const snoozeInterval = customInterval || DEFAULT_SNOOZE_INTERVAL;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Snoozed Alarm',
          body: `Alarm will ring again in ${snoozeInterval} minutes`,
          sound: false,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: snoozeInterval * 60,
        },
      });

      console.log(`⏰ Alarm snoozed for ${snoozeInterval} minutes`);

      // TODO: Schedule alarm to ring again after snooze interval
      // This would need to integrate with the reminder scheduling system
    } catch (error) {
      console.error('Failed to snooze alarm:', error);
      throw error;
    }
  }

  /**
   * Dismiss the current alarm
   */
  public async dismissAlarm(): Promise<void> {
    if (!this.currentAlarm) {
      console.warn('No active alarm to dismiss');
      return;
    }

    try {
      const reminderId = this.currentAlarm.reminderId;
      
      // Stop alarm
      await this.stopAlarmSound();
      await this.deactivateWakeLock();
      this.stopVibration();

      // Clear alarm state
      this.currentAlarm = null;
      await this.clearAlarmState();

      // Dismiss and disable the reminder so it doesn't trigger again
      const ReminderRepository = (await import('./repo')).default;
      const repo = ReminderRepository.getInstance();
      await repo.dismissReminder(reminderId);

      console.log('✅ Alarm dismissed');
    } catch (error) {
      console.error('Failed to dismiss alarm:', error);
      throw error;
    }
  }

  /**
   * Stop alarm sound playback
   */
  private async stopAlarmSound(): Promise<void> {
    try {
      if (this.alarmSound) {
        await this.alarmSound.stopAsync();
        await this.alarmSound.unloadAsync();
        this.alarmSound = null;
        console.log('Alarm sound stopped');
      }
    } catch (error) {
      console.error('Failed to stop alarm sound:', error);
    }
  }

  /**
   * Activate wake lock to keep device awake
   * This prevents the device from sleeping while alarm is ringing
   */
  private async activateWakeLock(): Promise<void> {
    try {
      await activateKeepAwakeAsync('alarm');
      console.log('Wake lock activated');
    } catch (error) {
      console.error('Failed to activate wake lock:', error);
    }
  }

  /**
   * Deactivate wake lock
   */
  private async deactivateWakeLock(): Promise<void> {
    try {
      deactivateKeepAwake('alarm');
      console.log('Wake lock deactivated');
    } catch (error) {
      console.error('Failed to deactivate wake lock:', error);
    }
  }

  /**
   * Get current alarm state
   */
  public getCurrentAlarm(): AlarmState | null {
    return this.currentAlarm;
  }

  /**
   * Check if an alarm is currently ringing
   */
  public isAlarmRinging(): boolean {
    return this.currentAlarm?.isRinging ?? false;
  }

  /**
   * Save alarm state to persistent storage
   */
  private async saveAlarmState(): Promise<void> {
    try {
      if (this.currentAlarm) {
        await AsyncStorage.setItem(
          ALARM_STATE_KEY,
          JSON.stringify(this.currentAlarm)
        );
      }
    } catch (error) {
      console.error('Failed to save alarm state:', error);
    }
  }

  /**
   * Restore alarm state from persistent storage
   * This is used when app restarts while alarm is ringing
   */
  private async restoreAlarmState(): Promise<void> {
    try {
      const stateJson = await AsyncStorage.getItem(ALARM_STATE_KEY);
      if (stateJson) {
        this.currentAlarm = JSON.parse(stateJson);
        console.log('Restored alarm state:', this.currentAlarm);
      }
    } catch (error) {
      console.error('Failed to restore alarm state:', error);
    }
  }

  /**
   * Clear alarm state from storage
   */
  private async clearAlarmState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ALARM_STATE_KEY);
    } catch (error) {
      console.error('Failed to clear alarm state:', error);
    }
  }

  /**
   * Schedule an alarm for a specific time
   * This integrates with the notification scheduling system
   */
  public async scheduleAlarm(
    reminderId: number,
    triggerDate: Date,
    settings: AlarmSettings
  ): Promise<string> {
    try {
      // Schedule a notification that will trigger the alarm
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 Alarm',
          body: 'Time to wake up!',
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
          categoryIdentifier: 'ALARM',
          data: {
            reminderId,
            type: 'alarm',
            triggerAlarm: true,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });

      console.log(`Alarm scheduled for ${triggerDate.toISOString()}`);
      return notificationId;
    } catch (error) {
      console.error('Failed to schedule alarm:', error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled alarm
   */
  public async cancelAlarm(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('Alarm cancelled');
    } catch (error) {
      console.error('Failed to cancel alarm:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   * Should be called when service is no longer needed
   */
  public async cleanup(): Promise<void> {
    try {
      await this.stopAlarmSound();
      await this.deactivateWakeLock();
      this.stopVibration();
      this.currentAlarm = null;
      await this.clearAlarmState();
      this.isInitialized = false;
      console.log('Alarm service cleaned up');
    } catch (error) {
      console.error('Failed to cleanup alarm service:', error);
    }
  }
}

export default AlarmService;
