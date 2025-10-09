import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import MapPicker from '../features/geofencing/MapPicker';
import { LocationTrigger } from '../types/reminder';
import { locationSelectionService } from '../services/locationSelection';

export default function MapPickerScreen() {
  const params = useLocalSearchParams();
  
  // Check if this is for editing an existing reminder or creating a new one
  const isEditing = params.isEditing === 'true';
  // Get the preset context (location-only vs all-in-one form)
  const preset = params.preset as string | undefined;
  
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
    
    if (isEditing) {
      // If editing, go back to the edit form (preserves the original form type)
      if (router.canGoBack()) {
        router.back();
      }
    } else {
      // If creating new reminder, navigate based on preset
      if (preset === 'location') {
        // For "Wake Me There" - stay in location-only form
        router.push('/reminders/edit?preset=location');
      } else {
        // For "All in One" or other forms - go to full form
        router.push('/reminders/edit');
      }
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