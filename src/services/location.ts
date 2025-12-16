import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { LocationPermissionStatus, GeofenceRegion } from '../types/reminder';

const LOCATION_TASK_NAME = 'location-background-task';
const GEOFENCE_TASK_NAME = 'geofence-task';

class LocationService {
  private static instance: LocationService;
  private currentLocation: Location.LocationObject | null = null;
  private watchingLocation: boolean = false;
  private locationSubscription: Location.LocationSubscription | null = null;
  private onLocationChangeCallback: ((location: Location.LocationObject) => void) | null = null;

  private constructor() {}

  public static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  public async requestPermissions(): Promise<LocationPermissionStatus> {
    try {
      // Request foreground permissions first
      const foregroundPermission = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundPermission.status !== 'granted') {
        return {
          granted: false,
          canAskAgain: foregroundPermission.canAskAgain,
          status: foregroundPermission.status,
        };
      }

      // Request background permissions for geofencing
      const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
      
      return {
        granted: backgroundPermission.status === 'granted',
        canAskAgain: backgroundPermission.canAskAgain,
        status: backgroundPermission.status,
      };
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return {
        granted: false,
        canAskAgain: false,
        status: 'error',
      };
    }
  }

  public async checkPermissions(): Promise<LocationPermissionStatus> {
    try {
      const foregroundPermission = await Location.getForegroundPermissionsAsync();
      const backgroundPermission = await Location.getBackgroundPermissionsAsync();
      
      return {
        granted: foregroundPermission.granted && backgroundPermission.granted,
        canAskAgain: foregroundPermission.canAskAgain || backgroundPermission.canAskAgain,
        status: backgroundPermission.granted ? 'granted' : backgroundPermission.status,
      };
    } catch (error) {
      console.error('Error checking location permissions:', error);
      return {
        granted: false,
        canAskAgain: false,
        status: 'error',
      };
    }
  }

  public async getCurrentLocation(): Promise<Location.LocationObject | null> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.warn('Location permission not granted');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
      });

      this.currentLocation = location;
      return location;
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  public async startLocationTracking(): Promise<void> {
    try {
      const permissions = await this.checkPermissions();
      if (!permissions.granted) {
        throw new Error('Location permissions not granted');
      }

      if (this.watchingLocation) {

        return;
      }

      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000, // Update every 10 seconds
          distanceInterval: 50, // Update every 50 meters
        },
        (location) => {
          this.currentLocation = location;
          if (this.onLocationChangeCallback) {
            this.onLocationChangeCallback(location);
          }
        }
      );

      this.watchingLocation = true;

    } catch (error) {
      console.error('Error starting location tracking:', error);
      throw error;
    }
  }

  public async stopLocationTracking(): Promise<void> {
    try {
      if (this.locationSubscription) {
        this.locationSubscription.remove();
        this.locationSubscription = null;
      }
      this.watchingLocation = false;

    } catch (error) {
      console.error('Error stopping location tracking:', error);
    }
  }

  public setLocationChangeCallback(callback: (location: Location.LocationObject) => void): void {
    this.onLocationChangeCallback = callback;
  }

  public removeLocationChangeCallback(): void {
    this.onLocationChangeCallback = null;
  }

  public async startGeofencing(regions: GeofenceRegion[]): Promise<void> {
    try {
      const permissions = await this.checkPermissions();
      if (!permissions.granted) {
        throw new Error('Background location permissions not granted');
      }

      // Define the geofencing task
      this.defineGeofenceTask();

      // Start location updates in background
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30000, // Check every 30 seconds
        distanceInterval: 50, // Check every 50 meters
        deferredUpdatesInterval: 60000, // Defer updates for 1 minute
        foregroundService: {
          notificationTitle: 'RemindMe+ is tracking your location',
          notificationBody: 'This helps deliver location-based reminders',
        },
      });


    } catch (error) {
      console.error('Error starting geofencing:', error);
      throw error;
    }
  }

  public async stopGeofencing(): Promise<void> {
    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);

    } catch (error) {
      console.error('Error stopping geofencing:', error);
    }
  }

  private defineGeofenceTask(): void {
    TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
      if (error) {
        console.error('Location task error:', error);
        return;
      }

      if (data) {
        const { locations } = data as any;
        if (locations && locations.length > 0) {
          const location = locations[0];

          
          // Trigger context engine to check conditions
          await this.handleLocationUpdate(location);
        }
      }
    });
  }

  private async handleLocationUpdate(location: Location.LocationObject): Promise<void> {
    try {
      // Use callback if available to avoid circular dependency
      if (this.onLocationChangeCallback) {
        this.onLocationChangeCallback(location);
      }
    } catch (error) {
      console.error('Error handling location update:', error);
    }
  }

  public calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
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

  public isWithinRadius(
    currentLat: number,
    currentLon: number,
    targetLat: number,
    targetLon: number,
    radiusMeters: number
  ): boolean {
    const distance = this.calculateDistance(currentLat, currentLon, targetLat, targetLon);
    return distance <= radiusMeters;
  }

  public async geocodeAddress(address: string): Promise<Location.LocationGeocodedLocation[]> {
    try {
      const locations = await Location.geocodeAsync(address);
      return locations;
    } catch (error) {
      console.error('Error geocoding address:', error);
      return [];
    }
  }

  public async reverseGeocode(latitude: number, longitude: number): Promise<Location.LocationGeocodedAddress[]> {
    try {
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      return addresses;
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return [];
    }
  }

  public getLastKnownLocation(): Location.LocationObject | null {
    return this.currentLocation;
  }

  public isLocationTrackingActive(): boolean {
    return this.watchingLocation;
  }
}

export default LocationService;