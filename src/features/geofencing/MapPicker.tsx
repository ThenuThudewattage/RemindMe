import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet, Alert, Dimensions, Keyboard, Platform, StatusBar, FlatList, TouchableOpacity, KeyboardAvoidingView } from 'react-native';
import { 
  Text, 
  Button,
  TextInput as PaperTextInput,
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
import Constants from 'expo-constants';
import { LocationTrigger } from '../../types/reminder';
import GeofencingService from './service';
import PlacesBackendService from '../../services/placesBackend';

// Initialize backend service
const placesBackend = PlacesBackendService.getInstance();

// Determine if we should use backend proxy or direct API
const USE_BACKEND_PROXY = placesBackend.isConfigured();

// Fallback to direct API key if Firebase is not configured
const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 
                            process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 
                            'YOUR_GOOGLE_MAPS_API_KEY';

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
  
  // Backend search state
  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Session token for Google Places API billing optimization
  const [sessionToken] = useState(() => {
    // Generate a unique session token (simple UUID v4)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  });

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

  const handleBackendSearchChange = (text: string) => {
    setSearchQuery(text);
    if (text.length < 2) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
    searchTimeout.current = setTimeout(async () => {
      try {
        const response = await placesBackend.searchPlaces(text, sessionToken);
        if (response.predictions) {
          setPredictions(response.predictions);
          setShowPredictions(true);
        }
      } catch (error) {
        console.error('Search error:', error);
      }
    }, 500);
  };

  const handleBackendPlaceSelect = async (placeId: string, description: string) => {
    setSearchQuery(description);
    setShowPredictions(false);
    Keyboard.dismiss();
    
    try {
      showSnackbar('Loading place details...');
      const details = await placesBackend.getPlaceDetails(placeId, sessionToken);
      if (details.result?.geometry?.location) {
        const { lat, lng } = details.result.geometry.location;
        const newRegion = {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setRegion(newRegion);
        setMarkerCoordinate({ latitude: lat, longitude: lng });
        setLabel(details.result.name || description);
        mapRef.current?.animateToRegion(newRegion, 500);
        showSnackbar('Location selected');
      }
    } catch (error) {
      console.error('Place details error:', error);
      showSnackbar('Failed to load place details');
    }
  };

  const handlePlaceSelect = async (data: any, details: any) => {
    try {
      // If using backend proxy and details not provided, fetch them
      if (USE_BACKEND_PROXY && !details?.geometry?.location && data.place_id) {
        showSnackbar('Loading place details...');
        const placeDetails = await placesBackend.getPlaceDetails(data.place_id, sessionToken);
        
        if (placeDetails.status === 'OK' && placeDetails.result?.geometry?.location) {
          const { lat, lng } = placeDetails.result.geometry.location;
          
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
          const placeName = placeDetails.result.name || placeDetails.result.formatted_address || data.description;
          setLabel(placeName);
          
          showSnackbar('Location selected');
          Keyboard.dismiss();
        } else {
          showSnackbar('Failed to get place details');
        }
      } else if (details?.geometry?.location) {
        // Direct API response with details
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
    } catch (error) {
      console.error('Error selecting place:', error);
      showSnackbar('Failed to select location. Please try again.');
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
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={false} // Disable KeyboardAvoidingView - we want keyboard to overlay content
    >
      {/* Full-screen Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
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

      {/* Search Overlay - fixed at top */}
      <View style={[styles.searchOverlay, { 
        top: Math.max(insets.top, 16) + 10,
      }]}>
        {USE_BACKEND_PROXY ? (
          <View style={styles.autocompleteContainer}>
              <View style={styles.textInputContainer}>
                <View style={styles.searchIconContainer}>
                  <IconButton icon="magnify" size={20} />
                </View>
                <PaperTextInput
                  value={searchQuery}
                  onChangeText={handleBackendSearchChange}
                  placeholder="Search for a location..."
                  placeholderTextColor={theme.colors.onSurfaceDisabled}
                  style={styles.textInput}
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  dense
                />
                {searchQuery.length > 0 && (
                  <IconButton 
                    icon="close" 
                    size={20} 
                    onPress={() => {
                      setSearchQuery('');
                      setPredictions([]);
                      setShowPredictions(false);
                    }}
                  />
                )}
              </View>
              {showPredictions && predictions.length > 0 && (
                <View style={styles.listView}>
                  <FlatList
                    data={predictions}
                    keyExtractor={(item) => item.place_id}
                    renderItem={({ item }) => (
                      <TouchableOpacity 
                        style={styles.row}
                        onPress={() => handleBackendPlaceSelect(item.place_id, item.description)}
                      >
                        <Text numberOfLines={1} style={styles.description}>{item.description}</Text>
                      </TouchableOpacity>
                    )}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                    keyboardShouldPersistTaps="always"
                  />
                </View>
              )}
            </View>
          ) : (
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
          )}
          
          {/* Offline Banner in Search Area */}
          {isConnected === false && (
            <View style={styles.offlineSearchBanner}>
              <Text variant="bodySmall" style={styles.offlineText}>
                ⚠️ No internet - Search unavailable. Long-press map to drop pin.
              </Text>
            </View>
          )}
          
          {/* Configuration Warning */}
          {!USE_BACKEND_PROXY && GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY' && (
            <View style={styles.apiKeyWarning}>
              <Text variant="bodySmall" style={styles.apiKeyText}>
                ⚠️ Configure Firebase backend or add Google Maps API Key
              </Text>
              <Text variant="bodySmall" style={styles.apiKeyText}>
                See FIREBASE_BACKEND_SETUP.md or QUICKSTART_LOCATION_SEARCH.md
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

      {/* Settings Card - positioned at bottom, will be covered by keyboard */}
      <Card 
        style={[
          styles.settingsCard,
          { bottom: insets.bottom },
          theme.dark && {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
          }
        ]} 
        mode="outlined"
      >
        <Card.Content>
          <View style={styles.settingRow}>
            <Text variant="labelMedium" style={theme.dark && { color: '#FFFFFF' }}>Location Label</Text>
            <PaperTextInput
              value={label}
              onChangeText={setLabel}
              placeholder="Enter a name for this location"
              placeholderTextColor={theme.dark ? '#B8B8B8' : undefined}
              style={[
                styles.labelInput,
                theme.dark && { 
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#FFFFFF'
                }
              ]}
              dense
            />
          </View>

          <View style={styles.settingRow}>
            <Text variant="labelMedium" style={theme.dark && { color: '#FFFFFF' }}>Radius: {radius}m</Text>
            <Slider
              style={styles.slider}
              minimumValue={50}
              maximumValue={1000}
              value={radius}
              onValueChange={setRadius}
              step={10}
            />
            <Text variant="bodySmall" style={[styles.radiusHint, theme.dark && { color: '#B8B8B8' }]}>
              50m - 1000m
            </Text>
          </View>

          <View style={styles.settingRow}>
            <Text variant="labelMedium" style={theme.dark && { color: '#FFFFFF' }}>Trigger Mode</Text>
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
        <Card.Content>
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
        </Card.Content>
      </Card>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </KeyboardAvoidingView>
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
    maxHeight: 400, // Allow more space - can overlay settings at bottom
    zIndex: 1001, // Ensure list is above everything including settings card
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
  backendInfoBanner: {
    backgroundColor: '#D4EDDA',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
    elevation: 4,
  },
  backendInfoText: {
    color: '#155724',
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
    position: 'absolute' as const,
    left: 16,
    right: 16,
    bottom: 0,
    zIndex: 500, // Lower than search overlay so predictions can cover it
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
    gap: 12,
  },
  button: {
    flex: 1,
  },
});

export default MapPicker;