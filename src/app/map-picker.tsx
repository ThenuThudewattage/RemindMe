import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import MapPicker from '../features/geofencing/MapPicker';
import { LocationTrigger } from '../types/reminder';
import { locationSelectionService } from '../services/locationSelection';

export default function MapPickerScreen() {
  const params = useLocalSearchParams();
  
  // Parse initial location if provided
  let initialLocation: {
    latitude: number;
    longitude: number;
    radius: number;
    mode: 'enter' | 'exit' | 'both';
    label?: string;
  } | undefined;

  if (params.latitude && params.longitude) {
    initialLocation = {
      latitude: parseFloat(params.latitude as string),
      longitude: parseFloat(params.longitude as string),
      radius: params.radius ? parseInt(params.radius as string) : 100,
      mode: (params.mode as 'enter' | 'exit' | 'both') || 'enter',
      label: params.label as string | undefined,
    };
  }

  const handleSave = (locationTrigger: Omit<LocationTrigger, 'id' | 'enabled'>) => {
    // Emit the location selection to subscribers
    locationSelectionService.selectLocation(locationTrigger);
    
    // Navigate back to the form
    if (router.canGoBack()) {
      router.back();
    }
  };

  const handleCancel = () => {
    if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <MapPicker
      initialLocation={initialLocation}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  );
}