import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import LocationService from './location';
import BatteryService from './battery';

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
      await this.defineBackgroundTasks();
      await this.registerBackgroundFetch();
      console.log('Background service initialized');
    } catch (error) {
      console.error('Failed to initialize background service:', error);
    }
  }

  private async defineBackgroundTasks(): Promise<void> {
    // Define the background fetch task
    TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
      try {
        console.log('Background fetch task executed');
        
        // Check battery conditions
        const batteryService = BatteryService.getInstance();
        await batteryService.getCurrentBatteryState();
        
        // Import context engine dynamically to avoid circular dependencies
        const { ContextEngine } = await import('./contextEngine');
        const contextEngine = ContextEngine.getInstance();
        await contextEngine.checkAllConditions();
        
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
        minimumInterval: 60 * 1000, // 1 minute (minimum on iOS is 15 seconds)
        stopOnTerminate: false, // Continue after app is terminated
        startOnBoot: true, // Start when device boots
      });

      this.isRegistered = true;
      console.log('Background fetch registered');
    } catch (error) {
      console.error('Error registering background fetch:', error);
    }
  }

  public async unregisterBackgroundFetch(): Promise<void> {
    try {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
      this.isRegistered = false;
      console.log('Background fetch unregistered');
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
      console.log('Background location tracking started');
    } catch (error) {
      console.error('Error starting background location tracking:', error);
    }
  }

  public async stopLocationTracking(): Promise<void> {
    try {
      const locationService = LocationService.getInstance();
      await locationService.stopGeofencing();
      console.log('Background location tracking stopped');
    } catch (error) {
      console.error('Error stopping background location tracking:', error);
    }
  }

  public async startBatteryMonitoring(): Promise<void> {
    try {
      const batteryService = BatteryService.getInstance();
      await batteryService.startBatteryMonitoring();
      console.log('Background battery monitoring started');
    } catch (error) {
      console.error('Error starting background battery monitoring:', error);
    }
  }

  public async stopBatteryMonitoring(): Promise<void> {
    try {
      const batteryService = BatteryService.getInstance();
      await batteryService.stopBatteryMonitoring();
      console.log('Background battery monitoring stopped');
    } catch (error) {
      console.error('Error stopping background battery monitoring:', error);
    }
  }

  public async startAllBackgroundTasks(): Promise<void> {
    try {
      await this.startLocationTracking();
      await this.startBatteryMonitoring();
      console.log('All background tasks started');
    } catch (error) {
      console.error('Error starting background tasks:', error);
    }
  }

  public async stopAllBackgroundTasks(): Promise<void> {
    try {
      await this.stopLocationTracking();
      await this.stopBatteryMonitoring();
      await this.unregisterBackgroundFetch();
      console.log('All background tasks stopped');
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
      
      // Import notification service dynamically
      const NotificationService = (await import('./notifications')).default;
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
      const NotificationService = (await import('./notifications')).default;
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
}

export default BackgroundService;