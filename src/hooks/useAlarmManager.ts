import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import AlarmService from '../services/alarm';
import { AlarmState, AlarmTrigger, Reminder } from '../types/reminder';

export interface UseAlarmManagerReturn {
  // Current alarm state
  currentAlarm: AlarmState | null;
  isRinging: boolean;
  
  // Alarm actions
  triggerAlarm: (reminder: Reminder, triggeredBy?: 'time' | 'location' | 'battery' | 'manual') => Promise<void>;
  snoozeAlarm: (customInterval?: number) => Promise<void>;
  dismissAlarm: () => Promise<void>;
  
  // Scheduling
  scheduleAlarm: (reminderId: number, triggerDate: Date, reminder: Reminder) => Promise<string>;
  cancelAlarm: (notificationId: string) => Promise<void>;
  
  // Utility
  refreshAlarmState: () => void;
}

export const useAlarmManager = (): UseAlarmManagerReturn => {
  const [currentAlarm, setCurrentAlarm] = useState<AlarmState | null>(null);
  const [isRinging, setIsRinging] = useState(false);
  const alarmService = useRef(AlarmService.getInstance());
  const appState = useRef(AppState.currentState);

  /**
   * Initialize alarm service and set up listeners
   */
  useEffect(() => {
    initializeAlarmService();
    setupAlarmTriggerHandler();
    const subscription = setupAppStateListener();

    return () => {
      // Cleanup on unmount
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  /**
   * Initialize alarm service
   */
  const initializeAlarmService = async () => {
    try {
      await alarmService.current.initialize();
      refreshAlarmState();
    } catch (error) {
      console.error('Failed to initialize alarm service:', error);
    }
  };

  /**
   * Set up alarm trigger handler
   * This navigates to the alarm screen when an alarm triggers
   */
  const setupAlarmTriggerHandler = () => {
    alarmService.current.setAlarmTriggerHandler((trigger: AlarmTrigger) => {

      
      // Navigate to alarm screen
      router.push({
        pathname: '/alarm',
        params: {
          reminderId: trigger.reminderId,
          reminderTitle: trigger.reminderTitle,
          triggeredBy: trigger.triggeredBy,
        },
      });
    });
  };

  /**
   * Set up app state listener
   * Refreshes alarm state when app comes to foreground
   */
  const setupAppStateListener = () => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return subscription;
  };

  /**
   * Handle app state changes
   */
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      // App has come to foreground, refresh alarm state
      refreshAlarmState();
    }
    appState.current = nextAppState;
  };

  /**
   * Refresh alarm state from service
   */
  const refreshAlarmState = useCallback(() => {
    const alarm = alarmService.current.getCurrentAlarm();
    const ringing = alarmService.current.isAlarmRinging();
    
    setCurrentAlarm(alarm);
    setIsRinging(ringing);
  }, []);

  /**
   * Trigger an alarm for a reminder
   */
  const triggerAlarm = useCallback(
    async (
      reminder: Reminder,
      triggeredBy: 'time' | 'location' | 'battery' | 'manual' = 'time'
    ) => {
      try {
        await alarmService.current.triggerAlarm(reminder, triggeredBy);
        refreshAlarmState();
      } catch (error) {
        console.error('Failed to trigger alarm:', error);
        throw error;
      }
    },
    [refreshAlarmState]
  );

  /**
   * Snooze the current alarm
   */
  const snoozeAlarm = useCallback(
    async (customInterval?: number) => {
      try {
        await alarmService.current.snoozeAlarm(customInterval);
        refreshAlarmState();
      } catch (error) {
        console.error('Failed to snooze alarm:', error);
        throw error;
      }
    },
    [refreshAlarmState]
  );

  /**
   * Dismiss the current alarm
   */
  const dismissAlarm = useCallback(async () => {
    try {
      await alarmService.current.dismissAlarm();
      refreshAlarmState();
    } catch (error) {
      console.error('Failed to dismiss alarm:', error);
      throw error;
    }
  }, [refreshAlarmState]);

  /**
   * Schedule an alarm for a specific time
   */
  const scheduleAlarm = useCallback(
    async (
      reminderId: number,
      triggerDate: Date,
      reminder: Reminder
    ): Promise<string> => {
      try {
        if (!reminder.alarm) {
          throw new Error('Reminder does not have alarm settings');
        }
        
        const notificationId = await alarmService.current.scheduleAlarm(
          reminderId,
          triggerDate,
          reminder.alarm
        );
        return notificationId;
      } catch (error) {
        console.error('Failed to schedule alarm:', error);
        throw error;
      }
    },
    []
  );

  /**
   * Cancel a scheduled alarm
   */
  const cancelAlarm = useCallback(async (notificationId: string) => {
    try {
      await alarmService.current.cancelAlarm(notificationId);
    } catch (error) {
      console.error('Failed to cancel alarm:', error);
      throw error;
    }
  }, []);

  return {
    currentAlarm,
    isRinging,
    triggerAlarm,
    snoozeAlarm,
    dismissAlarm,
    scheduleAlarm,
    cancelAlarm,
    refreshAlarmState,
  };
};

export default useAlarmManager;
