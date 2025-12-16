import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { GeofenceEvent, LocationTrigger, Reminder } from '../../types/reminder';
import DatabaseService from '../../services/db';
import NotificationService from '../../services/notifications';
import { router } from 'expo-router';

const GEOFENCE_TASK_NAME = 'geofence-background-task';

export interface GeofenceRegisterOptions {
  latitude: number;
  longitude: number;
  radius: number;
  mode: 'enter' | 'exit' | 'both';
}

class GeofencingService {
  private static instance: GeofencingService;
  private isInitialized: boolean = false;
  private registeredGeofences: Map<string, GeofenceRegisterOptions> = new Map();
  private pendingInitialSync: Set<string> = new Set();
  private db: DatabaseService;
  private notificationService: NotificationService;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.notificationService = NotificationService.getInstance();
  }

  public static getInstance(): GeofencingService {
    if (!GeofencingService.instance) {
      GeofencingService.instance = new GeofencingService();
    }
    return GeofencingService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Define the geofence background task
      this.defineGeofenceTask();
      
      // Initialize database
      await this.db.initialize();
      
      this.isInitialized = true;
      console.log('GeofencingService initialized');
    } catch (error) {
      console.error('Failed to initialize GeofencingService:', error);
      throw error;
    }
  }

  public async registerGeofence(reminderId: string, options: GeofenceRegisterOptions): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Check location permissions
      const permissions = await this.checkLocationPermissions();
      if (!permissions.background) {
        throw new Error('Background location permission not granted');
      }

      // Get current location to establish initial state
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const distance = this.calculateDistance(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        options.latitude,
        options.longitude
      );

      const isCurrentlyInside = distance <= options.radius;
      
      // Initialize the geofence status with current state
      // This prevents immediate triggering - we only trigger on STATE CHANGE
      const initialEvent = isCurrentlyInside ? 'enter' : 'exit';
      await this.db.setGeofenceStatus(reminderId, true, initialEvent);

      console.log(
        `Geofence registered for reminder ${reminderId}: ` +
        `Current distance: ${Math.round(distance)}m, ` +
        `Inside radius: ${isCurrentlyInside}, ` +
        `Initial state: ${initialEvent}`
      );

      // Store geofence configuration
      this.registeredGeofences.set(reminderId, options);
      this.pendingInitialSync.add(reminderId);

      // Start location updates if not already running
      await this.startLocationUpdates();
    } catch (error) {
      console.error(`Failed to register geofence for reminder ${reminderId}:`, error);
      throw error;
    }
  }

  public async unregisterGeofence(reminderId: string): Promise<void> {
    try {
      // Remove from registered geofences
      this.registeredGeofences.delete(reminderId);
      this.pendingInitialSync.delete(reminderId);

      // Update database status
      await this.db.setGeofenceStatus(reminderId, false);

      console.log(`Geofence unregistered for reminder ${reminderId}`);

      // Stop location updates if no active geofences
      if (this.registeredGeofences.size === 0) {
        await this.stopLocationUpdates();
      }
    } catch (error) {
      console.error(`Failed to unregister geofence for reminder ${reminderId}:`, error);
      // Don't throw - unregister should be idempotent
    }
  }

  public async restoreAllGeofencesOnLaunch(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Get all enabled reminders with location triggers
      const reminders = await this.db.getEnabledReminders();
      const locationReminders = reminders.filter(r => r.locationTrigger?.enabled);

      let restoredCount = 0;
      for (const reminder of locationReminders) {
        if (reminder.locationTrigger) {
          const options: GeofenceRegisterOptions = {
            latitude: reminder.locationTrigger.latitude,
            longitude: reminder.locationTrigger.longitude,
            radius: reminder.locationTrigger.radius,
            mode: reminder.locationTrigger.mode,
          };

          this.registeredGeofences.set(reminder.id.toString(), options);
          await this.db.setGeofenceStatus(reminder.id.toString(), true);
          restoredCount++;
        }
      }

      if (restoredCount > 0) {
        await this.startLocationUpdates();
        console.log(`Restored ${restoredCount} geofences on launch`);
      }
    } catch (error) {
      console.error('Failed to restore geofences on launch:', error);
    }
  }

  public async isGeofenceActive(reminderId: string): Promise<boolean> {
    try {
      const status = await this.db.getGeofenceStatus(reminderId);
      return status?.active || false;
    } catch (error) {
      console.error(`Failed to check geofence status for reminder ${reminderId}:`, error);
      return false;
    }
  }

  public async onGeofenceEvent(event: GeofenceEvent): Promise<void> {
    try {
      const { reminderId, type, timestamp } = event;

      // Update geofence status in database
      await this.db.setGeofenceStatus(reminderId, true, type);

      // Get the reminder details
      const reminder = await this.db.getReminderById(parseInt(reminderId));
      if (!reminder || !reminder.enabled) {
        console.log(`Geofence event ignored - reminder ${reminderId} not found or disabled`);
        return;
      }

      // Check if the trigger mode matches the event
      const locationTrigger = reminder.locationTrigger;
      if (!locationTrigger || !locationTrigger.enabled) {
        console.log(`Geofence event ignored - location trigger not enabled for reminder ${reminderId}`);
        return;
      }

      const shouldTrigger = 
        locationTrigger.mode === 'both' ||
        (locationTrigger.mode === 'enter' && type === 'enter') ||
        (locationTrigger.mode === 'exit' && type === 'exit');

      if (!shouldTrigger) {
        console.log(`Geofence event ignored - mode mismatch for reminder ${reminderId}`);
        return;
      }

      // Fire notification
      await this.fireLocationNotification(reminder, type, locationTrigger);

      // Log event
      await this.db.createEvent(parseInt(reminderId), 'triggered', {
        source: 'geofence',
        eventType: type,
        timestamp,
      });

      console.log(`Geofence event processed for reminder ${reminderId}: ${type}`);
    } catch (error) {
      console.error('Failed to process geofence event:', error);
    }
  }

  private async fireLocationNotification(
    reminder: Reminder, 
    eventType: 'enter' | 'exit', 
    locationTrigger: LocationTrigger
  ): Promise<void> {
    try {
      const locationLabel = locationTrigger.label || 'your zone';
      const action = eventType === 'enter' ? 'entered' : 'exited';
      
      // Check if alarm is enabled for this reminder
      if (reminder.alarm?.enabled) {
        // Trigger alarm for location-based reminder
        const AlarmService = (await import('../../services/alarm')).default;
        const alarmService = AlarmService.getInstance();
        await alarmService.triggerAlarm(reminder, 'location');
        console.log(`Location-based alarm triggered for reminder ${reminder.id}`);
      } else {
        // Show regular notification
        await this.notificationService.showReminderNotification(
          reminder.id,
          reminder.title,
          `You ${action} ${locationLabel} (±${locationTrigger.radius}m)`
        );
      }
    } catch (error) {
      console.error('Failed to fire location notification:', error);
    }
  }

  private async checkLocationPermissions(): Promise<{ foreground: boolean; background: boolean }> {
    try {
      const foregroundStatus = await Location.getForegroundPermissionsAsync();
      const backgroundStatus = await Location.getBackgroundPermissionsAsync();

      return {
        foreground: foregroundStatus.granted,
        background: backgroundStatus.granted,
      };
    } catch (error) {
      console.error('Failed to check location permissions:', error);
      return { foreground: false, background: false };
    }
  }

  private async startLocationUpdates(): Promise<void> {
    try {
      const permissions = await this.checkLocationPermissions();
      if (!permissions.background) {
        throw new Error('Background location permission required');
      }

      // Check if already running
      const isTaskDefined = TaskManager.isTaskDefined(GEOFENCE_TASK_NAME);
      if (isTaskDefined) {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
        if (isRegistered) {
          console.log('Location updates already running');
          return;
        }
      }

      await Location.startLocationUpdatesAsync(GEOFENCE_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30000, // Check every 30 seconds
        distanceInterval: 25, // Check every 25 meters
        deferredUpdatesInterval: 60000, // Defer updates for battery
        foregroundService: {
          notificationTitle: 'RemindMe+ Location Monitoring',
          notificationBody: 'Monitoring location for reminders',
          notificationColor: '#6750A4',
        },
      });

      console.log('Location updates started for geofencing');
    } catch (error) {
      console.error('Failed to start location updates:', error);
      throw error;
    }
  }

  private async stopLocationUpdates(): Promise<void> {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(GEOFENCE_TASK_NAME);
        console.log('Location updates stopped');
      }
    } catch (error) {
      console.error('Failed to stop location updates:', error);
    }
  }

  private defineGeofenceTask(): void {
    if (TaskManager.isTaskDefined(GEOFENCE_TASK_NAME)) {
      return; // Task already defined
    }

    TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
      if (error) {
        console.error('Geofence task error:', error);
        return;
      }

      if (data) {
        const { locations } = data as { locations: Location.LocationObject[] };
        if (locations && locations.length > 0) {
          const currentLocation = locations[0];
          await this.handleLocationUpdate(currentLocation);
        }
      }
    });
  }

  private async handleLocationUpdate(location: Location.LocationObject): Promise<void> {
    try {
      const { latitude, longitude } = location.coords;

      // Check all registered geofences
      for (const [reminderId, geofence] of this.registeredGeofences.entries()) {
        const distance = this.calculateDistance(
          latitude,
          longitude,
          geofence.latitude,
          geofence.longitude
        );

        const isInside = distance <= geofence.radius;
        const status = await this.db.getGeofenceStatus(reminderId);
        const wasInside = status?.lastEvent === 'enter';

        if (this.pendingInitialSync.has(reminderId)) {
          const baselineEvent: 'enter' | 'exit' = isInside ? 'enter' : 'exit';
          await this.db.setGeofenceStatus(reminderId, true, baselineEvent);
          this.pendingInitialSync.delete(reminderId);
          console.log(
            `Reminder ${reminderId}: initial sync baseline recorded as ${baselineEvent} (distance: ${Math.round(distance)}m)`
          );
          continue;
        }

        // Determine if we should fire an event based on state transition
        // - ENTER event: User moves from outside -> inside the radius
        // - EXIT event: User moves from inside -> outside the radius
        // This ensures we only trigger once per crossing, not continuously while inside/outside
        let eventType: 'enter' | 'exit' | null = null;

        if (isInside && !wasInside) {
          // User just entered the geofence radius
          eventType = 'enter';
          console.log(`Reminder ${reminderId}: ENTER detected (distance: ${Math.round(distance)}m)`);
        } else if (!isInside && wasInside) {
          // User just exited the geofence radius  
          eventType = 'exit';
          console.log(`Reminder ${reminderId}: EXIT detected (distance: ${Math.round(distance)}m)`);
        }

        if (eventType) {
          await this.onGeofenceEvent({
            reminderId,
            type: eventType,
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      console.error('Error handling location update in geofencing:', error);
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  // Testing/debugging methods
  public async simulateGeofenceEvent(reminderId: string, eventType: 'enter' | 'exit'): Promise<void> {
    console.log(`Simulating geofence ${eventType} event for reminder ${reminderId}`);
    await this.onGeofenceEvent({
      reminderId,
      type: eventType,
      timestamp: Date.now(),
    });
  }

  public getRegisteredGeofences(): Map<string, GeofenceRegisterOptions> {
    return new Map(this.registeredGeofences);
  }

  public async requestLocationPermissions(): Promise<{ foreground: boolean; background: boolean }> {
    try {
      // Request foreground permission first
      const foregroundResult = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundResult.status !== 'granted') {
        return { foreground: false, background: false };
      }

      // Request background permission
      const backgroundResult = await Location.requestBackgroundPermissionsAsync();
      
      return {
        foreground: foregroundResult.granted,
        background: backgroundResult.granted,
      };
    } catch (error) {
      console.error('Failed to request location permissions:', error);
      return { foreground: false, background: false };
    }
  }
}

export default GeofencingService;