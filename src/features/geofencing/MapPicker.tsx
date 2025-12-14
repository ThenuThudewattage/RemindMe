import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet, Alert, Dimensions, Keyboard, Platform, StatusBar } from 'react-native';
import { 
  Text, 
  Button,
  TextInput,
  useTheme, 
  SegmentedButtons,
  Card,
  ActivityIndicator,
  Snackbar,
  IconButton,
  Banner
} from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Circle, Region } from 'react-native-maps';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { LocationTrigger } from '../../types/reminder';
import GeofencingService from './service';

// You'll need to add your Google Maps API key here
// Get it from: https://console.cloud.google.com/apis/credentials
const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';

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
  const insets = useSafeAreaInsets();
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

  // Network state
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);

  // Refs
  const mapRef = useRef<MapView>(null);
  const searchRef = useRef<any>(null);

  const geofencingService = GeofencingService.getInstance();

  useEffect(() => {
    initializeLocation();
    
    // Check network connectivity
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
      if (!state.isConnected) {
        setShowOfflineBanner(true);
      }
    });

    // Initial check
    NetInfo.fetch().then(state => {
      setIsConnected(state.isConnected);
      if (!state.isConnected) {
        setShowOfflineBanner(true);
      }
    });

    return () => {
      unsubscribe();
    };
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

  const handlePlaceSelect = (data: any, details: any) => {
    if (details?.geometry?.location) {
      const { lat, lng } = details.geometry.location;
      
      const newCoordinate = {
        latitude: lat,
        longitude: lng,
      };

      const newRegion = {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      setMarkerCoordinate(newCoordinate);
      setRegion(newRegion);
      
      // Animate to the new location
      mapRef.current?.animateToRegion(newRegion, 500);
      
      // Set label from place name
      const placeName = details.name || details.formatted_address || data.description;
      setLabel(placeName);
      
      showSnackbar('Location selected');
      Keyboard.dismiss();
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Map with Search Overlay */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
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

        {/* Google Places Autocomplete Search Overlay */}
        <View style={[styles.searchOverlay, { top: Math.max(insets.top, 16) + 10 }]}>
          <GooglePlacesAutocomplete
            ref={searchRef}
            placeholder="Search for a location..."
            fetchDetails={true}
            onPress={handlePlaceSelect}
            query={{
              key: GOOGLE_MAPS_API_KEY,
              language: 'en',
            }}
            debounce={300}
            minLength={2}
            enablePoweredByContainer={false}
            styles={{
              container: styles.autocompleteContainer,
              textInputContainer: styles.textInputContainer,
              textInput: styles.textInput,
              listView: styles.listView,
              row: styles.row,
              separator: styles.separator,
              description: styles.description,
              loader: styles.loader,
            }}
            textInputProps={{
              placeholderTextColor: theme.colors.onSurfaceDisabled,
              returnKeyType: 'search',
              editable: isConnected !== false,
            }}
            renderLeftButton={() => (
              <View style={styles.searchIconContainer}>
                <IconButton icon="magnify" size={20} />
              </View>
            )}
            renderRightButton={() => (
              searchRef.current?.getAddressText() ? (
                <IconButton 
                  icon="close" 
                  size={20}
                  onPress={() => {
                    searchRef.current?.setAddressText('');
                    searchRef.current?.clear();
                  }}
                />
              ) : null
            )}
          />
          
          {/* Offline Banner in Search Area */}
          {isConnected === false && (
            <View style={styles.offlineSearchBanner}>
              <Text variant="bodySmall" style={styles.offlineText}>
                ⚠️ No internet - Search unavailable. Long-press map to drop pin.
              </Text>
            </View>
          )}
          
          {/* API Key Warning (Dev only) */}
          {GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY' && (
            <View style={styles.apiKeyWarning}>
              <Text variant="bodySmall" style={styles.apiKeyText}>
                ⚠️ Google Maps API Key required. See GOOGLE_MAPS_API_SETUP.md
              </Text>
            </View>
          )}
        </View>

        {/* Current Location Button */}
        <IconButton
          icon="crosshairs-gps"
          mode="contained"
          onPress={getCurrentLocation}
          disabled={locationLoading}
          style={[styles.locationButton, { top: Math.max(insets.top, 16) + 80 }]}
          containerColor={theme.colors.surface}
          iconColor={theme.colors.primary}
          size={24}
        />
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
    </View>
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
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  // Google Places Autocomplete Overlay Styles
  searchOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
    elevation: 5, // Required for Android to show on top of map
  },
  autocompleteContainer: {
    flex: 0,
    width: '100%',
  },
  textInputContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    paddingHorizontal: 8,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    height: 50,
    fontSize: 16,
    backgroundColor: 'transparent',
    flex: 1,
  },
  searchIconContainer: {
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginRight: 4,
  },
  listView: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    maxHeight: 300,
    zIndex: 1001, // Ensure list is above everything
  },
  row: {
    padding: 13,
    height: 60,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  separator: {
    height: 0.5,
    backgroundColor: '#c8c7cc',
  },
  description: {
    fontSize: 14,
  },
  loader: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    height: 20,
  },
  offlineSearchBanner: {
    backgroundColor: '#FFF3CD',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
    elevation: 4,
  },
  offlineText: {
    color: '#856404',
    textAlign: 'center' as const,
  },
  apiKeyWarning: {
    backgroundColor: '#F8D7DA',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
    elevation: 4,
  },
  apiKeyText: {
    color: '#721C24',
    textAlign: 'center' as const,
  },
  locationButton: {
    position: 'absolute' as const,
    right: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 900,
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