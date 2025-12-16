import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import LocationService from './location';
import BatteryService from './battery';
import { ContextEngine } from './contextEngine';
import NotificationService from './notifications';
import ReminderRepository from './repo';

const BACKGROUND_FETCH_TASK = 'background-fetch-task';

class BackgroundService {
  private static instance: BackgroundService;
  private isRegistered: boolean = false;

  private constructor() {}

  public static getInstance(): BackgroundService {
    if (!BackgroundService.instance) {
      BackgroundService.instance = new BackgroundService();
    }
    return BackgroundService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      // Note: expo-background-fetch is deprecated in favor of expo-task-manager
      // This warning is expected and the app will continue to work normally
      await this.defineBackgroundTasks();
      await this.registerBackgroundFetch();
      
      // Initialize geofencing
      await this.initializeGeofencing();
      console.log('Background service: Geofencing initialized');

    } catch (error) {
      console.warn('Background service initialization failed (this is expected in Expo Go):', error);
      // Don't throw error - this is expected in development
    }
  }

  private async defineBackgroundTasks(): Promise<void> {
    TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
      try {
        console.log('Background fetch task: Starting condition check');
        const batteryService = BatteryService.getInstance();
        await batteryService.getCurrentBatteryState();
        
        const contextEngine = ContextEngine.getInstance();
        await contextEngine.checkAllConditions();
        console.log('Background fetch task: Completed successfully');
        
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (error) {
        console.error('Background fetch task error:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
  }

  private async registerBackgroundFetch(): Promise<void> {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      
      if (status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
          status === BackgroundFetch.BackgroundFetchStatus.Denied) {
        console.warn('Background fetch is restricted or denied');
        return;
      }

      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 60, // 60 seconds (1 minute)
        stopOnTerminate: false, // Continue after app is terminated
        startOnBoot: true, // Start when device boots
      });

      this.isRegistered = true;
      console.log('Background fetch: Registered successfully with 60s interval');

    } catch (error) {
      console.error('Error registering background fetch:', error);
    }
  }

  public async unregisterBackgroundFetch(): Promise<void> {
    try {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
      this.isRegistered = false;

    } catch (error) {
      console.error('Error unregistering background fetch:', error);
    }
  }

  public async getBackgroundFetchStatus(): Promise<BackgroundFetch.BackgroundFetchStatus> {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      return status ?? BackgroundFetch.BackgroundFetchStatus.Denied;
    } catch (error) {
      console.error('Error getting background fetch status:', error);
      return BackgroundFetch.BackgroundFetchStatus.Denied;
    }
  }

  public isBackgroundFetchRegistered(): boolean {
    return this.isRegistered;
  }

  public async startLocationTracking(): Promise<void> {
    try {
      const locationService = LocationService.getInstance();
      await locationService.startGeofencing([]);

    } catch (error) {
      console.error('Error starting background location tracking:', error);
    }
  }

  public async stopLocationTracking(): Promise<void> {
    try {
      const locationService = LocationService.getInstance();
      await locationService.stopGeofencing();

    } catch (error) {
      console.error('Error stopping background location tracking:', error);
    }
  }

  public async startBatteryMonitoring(): Promise<void> {
    try {
      const batteryService = BatteryService.getInstance();
      await batteryService.startBatteryMonitoring();

    } catch (error) {
      console.error('Error starting background battery monitoring:', error);
    }
  }

  public async stopBatteryMonitoring(): Promise<void> {
    try {
      const batteryService = BatteryService.getInstance();
      await batteryService.stopBatteryMonitoring();

    } catch (error) {
      console.error('Error stopping background battery monitoring:', error);
    }
  }

  public async startAllBackgroundTasks(): Promise<void> {
    try {
      await this.startLocationTracking();
      await this.startBatteryMonitoring();

    } catch (error) {
      console.error('Error starting background tasks:', error);
    }
  }

  public async stopAllBackgroundTasks(): Promise<void> {
    try {
      await this.stopLocationTracking();
      await this.stopBatteryMonitoring();
      await this.unregisterBackgroundFetch();

    } catch (error) {
      console.error('Error stopping background tasks:', error);
    }
  }

  public async checkBackgroundPermissions(): Promise<{
    backgroundFetch: boolean;
    location: boolean;
    notifications: boolean;
  }> {
    try {
      const backgroundFetchStatus = await this.getBackgroundFetchStatus();
      
      const locationService = LocationService.getInstance();
      const locationPermissions = await locationService.checkPermissions();
      
      // Get notification service instance
      const notificationService = NotificationService.getInstance();
      const notificationPermissions = await notificationService.checkPermissions();

      return {
        backgroundFetch: backgroundFetchStatus === BackgroundFetch.BackgroundFetchStatus.Available,
        location: locationPermissions.granted,
        notifications: notificationPermissions.granted,
      };
    } catch (error) {
      console.error('Error checking background permissions:', error);
      return {
        backgroundFetch: false,
        location: false,
        notifications: false,
      };
    }
  }

  public async requestAllPermissions(): Promise<{
    backgroundFetch: boolean;
    location: boolean;
    notifications: boolean;
  }> {
    try {
      // Request location permissions
      const locationService = LocationService.getInstance();
      const locationPermissions = await locationService.requestPermissions();
      
      // Request notification permissions
      const notificationService = NotificationService.getInstance();
      const notificationPermissions = await notificationService.requestPermissions();

      // Background fetch doesn't need explicit permission request
      const backgroundFetchStatus = await this.getBackgroundFetchStatus();

      return {
        backgroundFetch: backgroundFetchStatus === BackgroundFetch.BackgroundFetchStatus.Available,
        location: locationPermissions.granted,
        notifications: notificationPermissions.granted,
      };
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return {
        backgroundFetch: false,
        location: false,
        notifications: false,
      };
    }
  }

  private async initializeGeofencing(): Promise<void> {
    try {
      const reminderRepo = ReminderRepository.getInstance();
      await reminderRepo.restoreGeofences();

    } catch (error) {
      console.warn('Failed to initialize geofencing:', error);
      // Don't throw - app should continue working without geofencing
    }
  }
}

export default BackgroundService;