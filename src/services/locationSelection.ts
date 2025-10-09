import { LocationTrigger } from '../types/reminder';

// Simple event system for passing location data between screens
class LocationSelectionService {
  private callbacks: Set<(location: Omit<LocationTrigger, 'id' | 'enabled'>) => void> = new Set();

  // Register a callback to receive location updates
  subscribe(callback: (location: Omit<LocationTrigger, 'id' | 'enabled'>) => void) {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  // Emit location selection to all subscribers
  selectLocation(location: Omit<LocationTrigger, 'id' | 'enabled'>) {
    this.callbacks.forEach(callback => callback(location));
  }
}

export const locationSelectionService = new LocationSelectionService();