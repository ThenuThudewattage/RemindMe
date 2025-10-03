import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { NotificationPermissionStatus, NotificationAction, NotificationCategory } from '../types/reminder';
import ReminderRepository from './repo';

// Configure notification behavior
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
  private expoPushToken: string | null = null;
  private notificationListener: any = null;
  private responseListener: any = null;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      await this.setupNotificationCategories();
      await this.setupNotificationListeners();
      console.log('Notification service initialized');
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
    }
  }

  public async requestPermissions(): Promise<NotificationPermissionStatus> {
    try {
      if (!Device.isDevice) {
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
      // Define notification actions using Expo's API
      const actions = [
        {
          identifier: 'SNOOZE',
          buttonTitle: 'Snooze 10m',
          textInput: undefined,
        },
        {
          identifier: 'DONE', 
          buttonTitle: 'Mark Done',
          textInput: undefined,
        },
        {
          identifier: 'OPEN',
          buttonTitle: 'Open',
          textInput: undefined,
        },
      ];

      // Set the category (platform-specific implementation)
      if (Platform.OS === 'ios') {
        await Notifications.setNotificationCategoryAsync(
          'REMINDER',
          actions
        );
      }

      console.log('Notification categories set up');
    } catch (error) {
      console.error('Error setting up notification categories:', error);
    }
  }

  private async setupNotificationListeners(): Promise<void> {
    try {
      // Listen for notifications received while app is running
      this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification received:', notification);
      });

      // Listen for user interactions with notifications
      this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Notification response:', response);
        this.handleNotificationResponse(response);
      });

      console.log('Notification listeners set up');
    } catch (error) {
      console.error('Error setting up notification listeners:', error);
    }
  }

  private async handleNotificationResponse(response: Notifications.NotificationResponse): Promise<void> {
    try {
      const { notification, actionIdentifier } = response;
      const reminderId = notification.request.content.data?.reminderId as number;

      if (!reminderId) {
        console.warn('No reminder ID in notification data');
        return;
      }

      // Get repository instance
      const repo = ReminderRepository.getInstance();

      switch (actionIdentifier) {
        case 'SNOOZE':
          await repo.snoozeReminder(reminderId, 10); // Snooze for 10 minutes
          await this.scheduleSnoozeNotification(reminderId, notification.request.content.title || 'Reminder');
          break;

        case 'DONE':
          await repo.markReminderCompleted(reminderId);
          break;

        case 'OPEN':
        default:
          // Navigate to reminder detail - this would be handled by the app's navigation
          console.log('Opening reminder:', reminderId);
          break;
      }
    } catch (error) {
      console.error('Error handling notification response:', error);
    }
  }

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

      console.log('Notification scheduled:', notificationId);
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
      
      console.log('Time-based notification scheduled for:', scheduledTime);
      return notificationId;
    } catch (error) {
      console.error('Error scheduling time-based notification:', error);
      throw error;
    }
  }

  private async scheduleSnoozeNotification(reminderId: number, title: string): Promise<void> {
    try {
      const snoozeTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      await this.showReminderNotification(
        reminderId,
        `Snoozed: ${title}`,
        'Your reminder is ready again',
        snoozeTime
      );
    } catch (error) {
      console.error('Error scheduling snooze notification:', error);
    }
  }

  public async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('Notification cancelled:', notificationId);
    } catch (error) {
      console.error('Error cancelling notification:', error);
    }
  }

  public async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('All notifications cancelled');
    } catch (error) {
      console.error('Error cancelling all notifications:', error);
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