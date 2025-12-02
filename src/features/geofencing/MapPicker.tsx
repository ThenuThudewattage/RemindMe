import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, Alert, Dimensions } from 'react-native';
import { 
  Text, 
  Button, 
  TextInput, 
  useTheme, 
  Switch, 
  SegmentedButtons,
  Card,
  ActivityIndicator,
  Snackbar
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Circle, Region } from 'react-native-maps';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import { LocationTrigger } from '../../types/reminder';
import GeofencingService from './service';

const { width: screenWidth } = Dimensions.get('window');

interface MapPickerProps {
  initialLocation?: {
    latitude: number;
    longitude: number;
    radius: number;
    mode: 'enter' | 'exit' | 'both';
    label?: string;
  };
  onSave: (locationTrigger: Omit<LocationTrigger, 'id' | 'enabled'>) => void;
  onCancel: () => void;
}

export const MapPicker: React.FC<MapPickerProps> = ({
  initialLocation,
  onSave,
  onCancel,
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Map state - initialize with current location when available
  const getInitialCoordinates = () => {
    if (initialLocation) {
      return { latitude: initialLocation.latitude, longitude: initialLocation.longitude };
    }
    // Start with San Francisco, will be updated once current location is obtained
    return { latitude: 37.78825, longitude: -122.4324 };
  };

  const defaultCoords = getInitialCoordinates();
  const [region, setRegion] = useState<Region>({
    latitude: defaultCoords.latitude,
    longitude: defaultCoords.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [markerCoordinate, setMarkerCoordinate] = useState(defaultCoords);

  // Location trigger settings
  const [radius, setRadius] = useState(initialLocation?.radius || 100);
  const [mode, setMode] = useState<'enter' | 'exit' | 'both'>(initialLocation?.mode || 'enter');
  const [label, setLabel] = useState(initialLocation?.label || '');





  const geofencingService = GeofencingService.getInstance();

  useEffect(() => {
    initializeLocation();
  }, []);

  const initializeLocation = async () => {
    // If we have initial location, set loading to false immediately
    if (initialLocation) {
      setLoading(false);
      return;
    }

    try {
      // Get current location in background, don't block UI
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showSnackbar('Location permission denied. Using default location.');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // Use balanced instead of high for faster response
      });

      // Batch state updates to prevent flickering
      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      const newMarker = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      // Update both region and marker at once
      setRegion(newRegion);
      setMarkerCoordinate(newMarker);

      // Get address in background - don't await to prevent UI blocking
      updateLocationLabel(location.coords.latitude, location.coords.longitude);
    } catch (error) {
      console.error('Failed to get current location:', error);
      showSnackbar('Failed to get current location');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to get your current location.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      setRegion(newRegion);
      setMarkerCoordinate({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      await updateLocationLabel(location.coords.latitude, location.coords.longitude);
      showSnackbar('Location updated to current position');
    } catch (error) {
      console.error('Failed to get current location:', error);
      Alert.alert('Error', 'Failed to get current location. Please try again.');
    } finally {
      setLocationLoading(false);
    }
  };

  const updateLocationLabel = async (latitude: number, longitude: number) => {
    try {
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addresses.length > 0) {
        const address = addresses[0];
        const parts = [];
        if (address.name) parts.push(address.name);
        if (address.street) parts.push(address.street);
        if (address.city) parts.push(address.city);
        
        const addressLabel = parts.join(', ') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        setLabel(addressLabel);
      }
    } catch (error) {
      console.warn('Failed to reverse geocode location:', error);
      setLabel(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
    }
  };

  const onMapPress = (event: any) => {
    const coordinate = event.nativeEvent.coordinate;
    setMarkerCoordinate(coordinate);
    updateLocationLabel(coordinate.latitude, coordinate.longitude);
  };

  const onMarkerDragEnd = (event: any) => {
    const coordinate = event.nativeEvent.coordinate;
    setMarkerCoordinate(coordinate);
    // Update address with a slight delay to avoid rapid API calls
    setTimeout(() => {
      updateLocationLabel(coordinate.latitude, coordinate.longitude);
    }, 300);
  };

  const handleSave = async () => {
    try {
      setSavingLocation(true);

      // Check permissions
      const permissions = await geofencingService.requestLocationPermissions();
      
      if (!permissions.foreground) {
        Alert.alert(
          'Location Permission Required',
          'Foreground location permission is required to save location-based reminders.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (!permissions.background) {
        Alert.alert(
          'Background Location Recommended',
          'Background location permission is required for reminders to work when the app is closed. You can enable this later in Settings.',
          [
            { text: 'Continue Anyway', style: 'default', onPress: proceedWithSave },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        return;
      }

      await proceedWithSave();
    } catch (error) {
      console.error('Failed to save location:', error);
      Alert.alert('Error', 'Failed to save location. Please try again.');
    } finally {
      setSavingLocation(false);
    }
  };

  const proceedWithSave = async () => {
    const locationTrigger: Omit<LocationTrigger, 'id' | 'enabled'> = {
      latitude: markerCoordinate.latitude,
      longitude: markerCoordinate.longitude,
      radius,
      mode,
      label: label.trim() || undefined,
    };

    onSave(locationTrigger);
  };

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Loading map...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineSmall">Choose Location</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Long press to drop a pin, then drag to adjust
        </Text>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          region={region}
          onPress={onMapPress}
          showsUserLocation
          showsMyLocationButton={false}
        >
          <Marker
            coordinate={markerCoordinate}
            draggable
            onDragEnd={onMarkerDragEnd}
            title="Reminder Location"
            description={label}
          />
          <Circle
            center={markerCoordinate}
            radius={radius}
            strokeColor={`${theme.colors.primary}60`}
            fillColor={`${theme.colors.primary}10`}
            strokeWidth={1.5}
          />
        </MapView>

        <Button
          mode="contained"
          onPress={getCurrentLocation}
          loading={locationLoading}
          style={styles.locationButton}
          icon="crosshairs-gps"
          compact
        >
          Current Location
        </Button>
      </View>

      <Card style={styles.settingsCard} mode="outlined">
        <Card.Content>
          <View style={styles.settingRow}>
            <Text variant="labelMedium">Location Label</Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="Enter a name for this location"
              style={styles.labelInput}
              dense
            />
          </View>

          <View style={styles.settingRow}>
            <Text variant="labelMedium">Radius: {radius}m</Text>
            <Slider
              style={styles.slider}
              minimumValue={50}
              maximumValue={1000}
              value={radius}
              onValueChange={setRadius}
              step={10}
            />
            <Text variant="bodySmall" style={styles.radiusHint}>
              50m - 1000m
            </Text>
          </View>

          <View style={styles.settingRow}>
            <Text variant="labelMedium">Trigger Mode</Text>
            <SegmentedButtons
              value={mode}
              onValueChange={(value) => setMode(value as any)}
              buttons={[
                { value: 'enter', label: 'Enter' },
                { value: 'exit', label: 'Exit' },
                { value: 'both', label: 'Both' },
              ]}
              style={styles.segmentedButtons}
            />
          </View>
        </Card.Content>
      </Card>

      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={onCancel}
          style={styles.button}
        >
          Cancel
        </Button>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={savingLocation}
          style={styles.button}
        >
          Save Location
        </Button>
      </View>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    opacity: 0.7,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  subtitle: {
    marginTop: 4,
    opacity: 0.7,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  locationButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  settingsCard: {
    margin: 16,
    marginBottom: 8,
  },
  settingRow: {
    marginBottom: 16,
  },
  labelInput: {
    marginTop: 8,
    backgroundColor: 'transparent',
  },
  slider: {
    marginTop: 8,
    marginBottom: 4,
  },
  radiusHint: {
    opacity: 0.6,
    textAlign: 'center',
  },
  segmentedButtons: {
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  button: {
    flex: 1,
  },
});

export default MapPicker;