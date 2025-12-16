import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { NotificationPermissionStatus, NotificationAction, NotificationCategory, Reminder } from '../types/reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class NotificationService {
  private static instance: NotificationService;
  private notificationListener: any = null;
  private responseListener: any = null;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public setNotificationActionHandler(handler: (reminderId: number, action: string, title: string) => Promise<void>): void {
    this.onNotificationAction = handler;
  }

  public setAlarmTriggerHandler(handler: (reminderId: number) => Promise<void>): void {
    this.onAlarmTrigger = handler;
  }

  public setAlarmActionHandler(handler: (reminderId: number, action: string, title: string) => Promise<void>): void {
    this.onAlarmAction = handler;
  }

  public async initialize(): Promise<void> {
    try {
      // Check if we're in Expo Go
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo) {

      }
      
      // Request permissions for local notifications only
      await this.requestPermissions();
      await this.setupNotificationCategories();
      await this.setupNotificationListeners();

    } catch (error) {
      console.error('Failed to initialize notification service:', error);
      // Don't throw - allow app to continue without notifications
    }
  }



  public async requestPermissions(): Promise<NotificationPermissionStatus> {
    try {
      if (!Device.isDevice) {
        console.warn('Local notifications require a physical device');
        return {
          granted: false,
          canAskAgain: false,
          status: 'denied - not a physical device',
        };
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return {
          granted: false,
          canAskAgain: finalStatus !== 'denied',
          status: finalStatus,
        };
      }

      // For Android, also request battery optimization exemption
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('reminders', {
          name: 'Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
          enableLights: true,
          enableVibrate: true,
        });
      }

      console.log('Notification permissions granted successfully');
      return {
        granted: true,
        canAskAgain: false,
        status: finalStatus,
      };
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return {
        granted: false,
        canAskAgain: false,
        status: 'error',
      };
    }
  }

  public async checkPermissions(): Promise<NotificationPermissionStatus> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return {
        granted: status === 'granted',
        canAskAgain: status !== 'denied',
        status,
      };
    } catch (error) {
      console.error('Error checking notification permissions:', error);
      return {
        granted: false,
        canAskAgain: false,
        status: 'error',
      };
    }
  }

  private async setupNotificationCategories(): Promise<void> {
    try {
      // Define notification actions for regular reminders
      const reminderActions = [
        {
          identifier: 'SNOOZE',
          buttonTitle: 'Snooze 10m',
          options: {
            isDestructive: false,
            isAuthenticationRequired: false,
          },
        },
        {
          identifier: 'DONE', 
          buttonTitle: 'Mark Done',
          options: {
            isDestructive: false,
            isAuthenticationRequired: false,
          },
        },
        {
          identifier: 'DISMISS',
          buttonTitle: 'Dismiss',
          options: {
            isDestructive: true,
            isAuthenticationRequired: false,
          },
        },
      ];

      // Set the category for regular reminders
      await Notifications.setNotificationCategoryAsync(
        'REMINDER',
        reminderActions,
        {
          // iOS specific options
          ...(Platform.OS === 'ios' && {
            previewPlaceholder: 'Reminder',
            intentIdentifiers: [],
            categorySummaryFormat: '%u reminder(s)',
          }),
        }
      );

      // Define alarm actions (for full-screen alarm notifications)
      const alarmActions = [
        {
          identifier: 'ALARM_SNOOZE',
          buttonTitle: 'Snooze',
          options: {
            isDestructive: false,
            isAuthenticationRequired: false,
          },
        },
        {
          identifier: 'ALARM_DISMISS',
          buttonTitle: 'Dismiss',
          options: {
            isDestructive: false,
            isAuthenticationRequired: false,
          },
        },
        {
          identifier: 'ALARM_OPEN',
          buttonTitle: 'Open',
          options: {
            isDestructive: false,
            isAuthenticationRequired: false,
          },
        },
      ];

      // Set the alarm category with high priority
      await Notifications.setNotificationCategoryAsync(
        'ALARM',
        alarmActions,
        {
          ...(Platform.OS === 'ios' && {
            previewPlaceholder: 'Alarm',
            intentIdentifiers: [],
            categorySummaryFormat: 'Alarm',
          }),
        }
      );


    } catch (error) {
      console.error('Error setting up notification categories:', error);
    }
  }

  private async setupNotificationListeners(): Promise<void> {
    try {
      // Remove existing listeners to prevent duplicates
      if (this.notificationListener) {
        this.notificationListener.remove();
        this.notificationListener = null;
      }
      if (this.responseListener) {
        this.responseListener.remove();
        this.responseListener = null;
      }

      // Listen for notifications received while app is running
      this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
        const reminderId = notification.request.content.data?.reminderId;
        console.log(`Notification received: reminderId=${reminderId}, title="${notification.request.content.title}"`);
      });

      // Listen for user interactions with notifications
      this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        const reminderId = response.notification.request.content.data?.reminderId;
        console.log(`Notification response: reminderId=${reminderId}, action="${response.actionIdentifier}"`);
        this.handleNotificationResponse(response);
      });


    } catch (error) {
      console.error('Error setting up notification listeners:', error);
    }
  }

  private async handleNotificationResponse(response: Notifications.NotificationResponse): Promise<void> {
    try {
      const { actionIdentifier, notification } = response;
      const reminderId = Number(notification.request.content.data?.reminderId);
      const notificationType = notification.request.content.data?.type;
      const shouldTriggerAlarm = notification.request.content.data?.triggerAlarm;

      if (!reminderId) {
        console.error('No reminder ID found in notification data');
        return;
      }

      console.log(`Handling notification action: reminderId=${reminderId}, action="${actionIdentifier}", type=${notificationType}`);
      // Check if this notification should trigger an alarm
      if (shouldTriggerAlarm && notificationType === 'alarm') {
        // Import alarm service dynamically to avoid circular dependency
        const AlarmService = (await import('./alarm')).default;
        const alarmService = AlarmService.getInstance();
        
        // Load reminder and trigger alarm
        // Note: We need to get the reminder from the repository
        if (this.onAlarmTrigger) {
          await this.onAlarmTrigger(reminderId);
        }
      }

      // Handle alarm-specific actions
      if (actionIdentifier.startsWith('ALARM_')) {
        if (this.onAlarmAction) {
          await this.onAlarmAction(reminderId, actionIdentifier, notification.request.content.title || 'Alarm');
        }
        return;
      }

      // Handle regular notification actions
      if (this.onNotificationAction) {
        await this.onNotificationAction(reminderId, actionIdentifier, notification.request.content.title || 'Reminder');
      }
    } catch (error) {
      console.error('Error handling notification response:', error);
    }
  }

  private onNotificationAction?: (reminderId: number, action: string, title: string) => Promise<void>;
  private onAlarmTrigger?: (reminderId: number) => Promise<void>;
  private onAlarmAction?: (reminderId: number, action: string, title: string) => Promise<void>;

  /**
   * Schedule a LOCAL notification (works in Expo Go)
   * This method only uses local device notifications, no remote push required
   */
  public async showReminderNotification(
    reminderId: number,
    title: string,
    body?: string,
    scheduledTime?: Date
  ): Promise<string> {
    try {
      const permissions = await this.checkPermissions();
      if (!permissions.granted) {
        throw new Error('Notification permissions not granted');
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: body || '',
          data: { reminderId },
          categoryIdentifier: 'REMINDER',
          sound: 'default',
        },
        // Show immediately for now - can be enhanced later with proper scheduling
        trigger: null,
      });


      return notificationId;
    } catch (error) {
      console.error('Error showing reminder notification:', error);
      throw error;
    }
  }

  public async scheduleTimeBasedNotification(
    reminderId: number,
    title: string,
    body: string,
    scheduledTime: Date
  ): Promise<string> {
    try {
      const notificationId = await this.showReminderNotification(
        reminderId,
        title,
        body,
        scheduledTime
      );
      

      return notificationId;
    } catch (error) {
      console.error('Error scheduling time-based notification:', error);
      throw error;
    }
  }

  public async scheduleSnoozeNotification(reminderId: number, title: string, snoozeMinutes: number = 10): Promise<string> {
    try {
      const permissions = await this.checkPermissions();
      if (!permissions.granted) {
        throw new Error('Notification permissions not granted');
      }

      const snoozeSeconds = snoozeMinutes * 60;
      
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: title,
          body: `Snoozed for ${snoozeMinutes} minutes`,
          data: { reminderId },
          categoryIdentifier: 'REMINDER',
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: snoozeSeconds,
          repeats: false,
        },
      });


      return notificationId;
    } catch (error) {
      console.error('Error scheduling snooze notification:', error);
      throw error;
    }
  }

  public async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);

    } catch (error) {
      console.error('Error cancelling notification:', error);
    }
  }

  public async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();

    } catch (error) {
      console.error('Error cancelling all notifications:', error);
    }
  }

  public async dismissPresentedNotifications(reminderId?: number): Promise<void> {
    try {
      const presented = await Notifications.getPresentedNotificationsAsync();
      
      if (reminderId !== undefined) {
        // Dismiss only notifications for this specific reminder
        const toDismiss = presented
          .filter(n => n.request.content.data?.reminderId === reminderId)
          .map(n => n.request.identifier);
        
        if (toDismiss.length > 0) {
          await Notifications.dismissNotificationAsync(toDismiss[0]);

        }
      } else {
        // Dismiss all presented notifications
        await Notifications.dismissAllNotificationsAsync();

      }
    } catch (error) {
      console.error('Error dismissing presented notifications:', error);
    }
  }

  public async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error getting scheduled notifications:', error);
      return [];
    }
  }

  public async showImmediateNotification(
    reminderId: number,
    title: string,
    body?: string
  ): Promise<void> {
    try {
      await this.showReminderNotification(reminderId, title, body);
    } catch (error) {
      console.error('Error showing immediate notification:', error);
    }
  }

  public async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }

  public async getBadgeCount(): Promise<number> {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('Error getting badge count:', error);
      return 0;
    }
  }

  // === SPECIFIC LOCAL NOTIFICATION METHODS FOR REMINDME+ ===
  
  /**
   * Show location-based reminder (when entering/exiting geofence)
   * This is a LOCAL notification triggered by device location changes
   */
  public async showLocationBasedNotification(
    reminderId: number, 
    title: string, 
    locationName: string
  ): Promise<string> {
    return this.showReminderNotification(
      reminderId,
      title,
      `You've reached: ${locationName}`
    );
  }

  /**
   * Show battery-based reminder (when battery level changes)
   * This is a LOCAL notification triggered by device battery state
   */
  public async showBatteryBasedNotification(
    reminderId: number,
    title: string,
    batteryLevel: number,
    isCharging: boolean
  ): Promise<string> {
    const batteryEmoji = isCharging ? '⚡' : batteryLevel < 20 ? '!' : '✓';
    return this.showReminderNotification(
      reminderId,
      `${batteryEmoji} ${title}`,
      `Battery: ${batteryLevel}% ${isCharging ? '(Charging)' : ''}`
    );
  }

  /**
   * Show time-based reminder (scheduled for specific time)
   * This is a LOCAL notification scheduled for a future time
   */
  public async showTimeBasedNotification(
    reminderId: number,
    title: string,
    scheduledTime: Date
  ): Promise<string> {
    return this.showReminderNotification(
      reminderId,
      title,
      `Scheduled reminder`,
      scheduledTime
    );
  }

  public cleanup(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }

    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
  }
}

export default NotificationService;