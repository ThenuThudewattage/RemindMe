import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { 
  TextInput, 
  Button, 
  Switch, 
  Text, 
  Card, 
  Chip,
  useTheme,
  SegmentedButtons,
  IconButton,
  Divider,
  Menu
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import { CreateReminderInput, UpdateReminderInput, ReminderRule } from '../types/reminder';
import BatteryService from '../services/battery';

interface ReminderFormProps {
  initialValues?: UpdateReminderInput;
  onSubmit: (data: CreateReminderInput | UpdateReminderInput) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
}

export const ReminderForm: React.FC<ReminderFormProps> = ({
  initialValues,
  onSubmit,
  onCancel,
  isEditing = false,
}) => {
  const theme = useTheme();
  const [title, setTitle] = useState(initialValues?.title || '');
  const [notes, setNotes] = useState(initialValues?.notes || '');
  const [enabled, setEnabled] = useState(initialValues?.enabled ?? true);
  
  // Rule state
  const [rule, setRule] = useState<ReminderRule>(initialValues?.rule || {});
  
  // Time condition state
  const [hasTimeCondition, setHasTimeCondition] = useState(!!(initialValues?.rule?.time));
  const [startDate, setStartDate] = useState(
    initialValues?.rule?.time?.start ? new Date(initialValues.rule.time.start) : new Date()
  );
  const [endDate, setEndDate] = useState(
    initialValues?.rule?.time?.end ? new Date(initialValues.rule.time.end) : new Date()
  );
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState<'date' | 'time'>('time');
  
  // Location condition state
  const [hasLocationCondition, setHasLocationCondition] = useState(!!(initialValues?.rule?.location));
  const [locationRadius, setLocationRadius] = useState(initialValues?.rule?.location?.radius || 100);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  
  // Battery condition state
  const [hasBatteryCondition, setHasBatteryCondition] = useState(!!(initialValues?.rule?.battery));
  const [batteryMin, setBatteryMin] = useState(initialValues?.rule?.battery?.min || 20);
  const [batteryMax, setBatteryMax] = useState(initialValues?.rule?.battery?.max || 80);
  const [batteryMode, setBatteryMode] = useState<'range' | 'min' | 'max'>('range');
  
  // Current battery level state
  const [currentBatteryLevel, setCurrentBatteryLevel] = useState<string>('Loading...');
  const [batteryStatus, setBatteryStatus] = useState<string>('Getting battery info...');
  
  // Options state
  const [repeat, setRepeat] = useState(initialValues?.rule?.options?.repeat || 'none');
  const [cooldownMins, setCooldownMins] = useState(initialValues?.rule?.options?.cooldownMins || 10);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    // Initialize battery mode based on existing values
    if (initialValues?.rule?.battery) {
      const { min, max } = initialValues.rule.battery;
      if (min !== undefined && max !== undefined) {
        setBatteryMode('range');
      } else if (min !== undefined) {
        setBatteryMode('min');
      } else if (max !== undefined) {
        setBatteryMode('max');
      }
    }
  }, [initialValues]);

  useEffect(() => {
    // Initialize location from existing reminder data when editing
    if (initialValues?.rule?.location && isEditing) {
      // Create a mock location object from the stored coordinates
      const mockLocation: Location.LocationObject = {
        coords: {
          latitude: initialValues.rule.location.lat,
          longitude: initialValues.rule.location.lon,
          altitude: null,
          accuracy: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      };
      setCurrentLocation(mockLocation);
    }
  }, [initialValues, isEditing]);

  useEffect(() => {
    // Get current battery level when component mounts
    const getBatteryLevel = async () => {
      try {
        const batteryService = BatteryService.getInstance();
        await batteryService.initialize();
        
        const batteryState = await batteryService.getCurrentBatteryState();
        const formatted = batteryService.getBatteryLevelFormatted();
        const status = batteryService.getBatteryStatusDescription();
        
        setCurrentBatteryLevel(formatted);
        setBatteryStatus(status);
        
        // Set up battery monitoring for real-time updates
        batteryService.setBatteryChangeCallback((newBatteryState) => {
          const newFormatted = batteryService.getBatteryLevelFormatted();
          const newStatus = batteryService.getBatteryStatusDescription();
          setCurrentBatteryLevel(newFormatted);
          setBatteryStatus(newStatus);
        });
        
      } catch (error) {
        console.error('Error getting battery level:', error);
        setCurrentBatteryLevel('Unknown');
        setBatteryStatus('Unable to get battery info');
      }
    };
    
    getBatteryLevel();
    
    // Cleanup on unmount
    return () => {
      const batteryService = BatteryService.getInstance();
      batteryService.removeBatteryChangeCallback();
    };
  }, []);

  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to set location-based reminders.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      setCurrentLocation(location);
      Alert.alert('Location Set', 'Current location has been set for this reminder.');
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location. Please try again.');
      console.error('Error getting location:', error);
    } finally {
      setLocationLoading(false);
    }
  };

  const buildRule = (): ReminderRule => {
    const newRule: ReminderRule = {};

    // Time condition
    if (hasTimeCondition) {
      newRule.time = {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      };
    }

    // Location condition
    if (hasLocationCondition) {
      if (currentLocation) {
        newRule.location = {
          lat: currentLocation.coords.latitude,
          lon: currentLocation.coords.longitude,
          radius: locationRadius,
        };
      } else if (isEditing && initialValues?.rule?.location) {
        // Keep existing location data when editing
        newRule.location = {
          lat: initialValues.rule.location.lat,
          lon: initialValues.rule.location.lon,
          radius: locationRadius,
        };
      }
    }

    // Battery condition
    if (hasBatteryCondition) {
      newRule.battery = {};
      if (batteryMode === 'range') {
        newRule.battery.min = batteryMin;
        newRule.battery.max = batteryMax;
      } else if (batteryMode === 'min') {
        newRule.battery.min = batteryMin;
      } else if (batteryMode === 'max') {
        newRule.battery.max = batteryMax;
      }
    }

    // Options
    if (repeat !== 'none' || cooldownMins > 0) {
      newRule.options = {};
      if (repeat !== 'none') {
        newRule.options.repeat = repeat as any;
      }
      if (cooldownMins > 0) {
        newRule.options.cooldownMins = cooldownMins;
      }
    }

    return newRule;
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter a title for the reminder.');
      return;
    }

    if (hasLocationCondition && !currentLocation && !isEditing) {
      Alert.alert('Validation Error', 'Please set a location for the location-based reminder.');
      return;
    }

    try {
      setIsSubmitting(true);
      const reminderData = {
        ...(isEditing && initialValues?.id ? { id: initialValues.id } : {}),
        title: title.trim(),
        notes: notes.trim() || undefined,
        rule: buildRule(),
        enabled,
      };

      await onSubmit(reminderData);
    } catch (error) {
      Alert.alert('Error', 'Failed to save reminder. Please try again.');
      console.error('Error saving reminder:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDateOnly = (date: Date): string => {
    return date.toLocaleDateString();
  };

  const showDateTimePicker = (isStart: boolean, mode: 'date' | 'time') => {
    setTimePickerMode(mode);
    if (isStart) {
      setShowEndTimePicker(false); // Close end time picker if open
      setShowStartTimePicker(true);
    } else {
      setShowStartTimePicker(false); // Close start time picker if open
      setShowEndTimePicker(true);
    }
  };

  const onStartTimeChange = (event: any, selectedDate?: Date) => {
    // On Android, event.type === 'dismissed' means user cancelled
    // On Android, event.type === 'set' means user confirmed
    // On iOS, we get continuous updates while scrolling
    
    if (Platform.OS === 'android') {
      setShowStartTimePicker(false);
    }
    
    if (selectedDate) {
      setStartDate(selectedDate);
      
      // Validate: Start time must be before end time
      if (selectedDate >= endDate) {
        // If start time is not before end time, automatically adjust end time
        const newEndTime = new Date(selectedDate.getTime() + 60 * 60 * 1000); // Add 1 hour
        setEndDate(newEndTime);
        
        // Show feedback to user
        Alert.alert(
          'Time Adjusted', 
          'End time has been automatically set to 1 hour after start time to maintain a valid time range.',
          [{ text: 'OK' }]
        );
      }
    }
    
    // Hide picker if user cancelled or confirmed on Android
    if (Platform.OS === 'android' && event.type === 'dismissed') {
      return; // Don't update the date if cancelled
    }
  };

  const onEndTimeChange = (event: any, selectedDate?: Date) => {
    // On Android, event.type === 'dismissed' means user cancelled
    // On Android, event.type === 'set' means user confirmed
    // On iOS, we get continuous updates while scrolling
    
    if (Platform.OS === 'android') {
      setShowEndTimePicker(false);
    }
    
    if (selectedDate) {
      // Validate: End time must be after start time
      if (selectedDate <= startDate) {
        // Show error and don't update if end time is not after start time
        Alert.alert(
          'Invalid Time Range', 
          'End time must be later than start time. Please select a time after ' + startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          [{ text: 'OK' }]
        );
        return;
      }
      
      setEndDate(selectedDate);
    }
    
    // Hide picker if user cancelled or confirmed on Android
    if (Platform.OS === 'android' && event && event.type === 'dismissed') {
      return; // Don't update the date if cancelled
    }
  };

  const getBatteryColorBasedOnLevel = (): string => {
    // Extract numeric value from currentBatteryLevel (e.g., "75%" -> 75)
    const levelStr = currentBatteryLevel.replace('%', '');
    const level = parseInt(levelStr, 10);
    
    if (isNaN(level)) return theme.colors.primary;
    
    if (level <= 10) return '#ff4444'; // Red for very low
    if (level <= 20) return '#ff8800'; // Orange for low
    if (level <= 50) return '#ffcc00'; // Yellow for medium
    if (level <= 80) return '#44aa44'; // Green for good
    return '#00aa44'; // Dark green for high
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Card style={styles.card} mode="outlined">
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Basic Information</Text>
          
          <TextInput
            label="Title *"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
            mode="outlined"
          />
          
          <TextInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            style={styles.input}
            mode="outlined"
            multiline
            numberOfLines={3}
          />
          
          <View style={styles.switchContainer}>
            <Text variant="bodyLarge">Enabled</Text>
            <Switch value={enabled} onValueChange={setEnabled} />
          </View>
        </Card.Content>
      </Card>

      {/* Time Condition */}
      <Card style={styles.card} mode="outlined">
        <Card.Content>
          <View style={styles.conditionHeader}>
            <Text variant="titleMedium">Time Condition</Text>
            <Switch value={hasTimeCondition} onValueChange={setHasTimeCondition} />
          </View>
          
          {hasTimeCondition && (
            <View style={styles.conditionContent}>
              <Text variant="bodyMedium" style={styles.conditionDescription}>
                Reminder will only trigger between these times
              </Text>
              
              <View style={styles.timePickerContainer}>
                <Text variant="labelLarge" style={styles.timeLabel}>Start Time</Text>
                <View style={styles.timePickerRow}>
                  <Chip 
                    icon="calendar" 
                    style={styles.timeChip}
                    onPress={() => showDateTimePicker(true, 'date')}
                  >
                    {formatDateOnly(startDate)}
                  </Chip>
                  <Chip 
                    icon="clock-outline" 
                    style={styles.timeChip}
                    onPress={() => showDateTimePicker(true, 'time')}
                  >
                    {formatTime(startDate)}
                  </Chip>
                </View>
              </View>
              
              {/* Start Time Picker - positioned right after start time display */}
              {showStartTimePicker && (
                <View style={styles.dateTimePickerContainer}>
                  {Platform.OS === 'ios' && (
                    <View style={styles.pickerHeader}>
                      <Text variant="titleSmall" style={styles.pickerTitle}>
                        Select {timePickerMode === 'date' ? 'Date' : 'Time'}
                      </Text>
                      <Button 
                        mode="text" 
                        onPress={() => setShowStartTimePicker(false)}
                        style={styles.doneButton}
                      >
                        Done
                      </Button>
                    </View>
                  )}
                  <DateTimePicker
                    value={startDate}
                    mode={timePickerMode}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onStartTimeChange}
                    is24Hour={true}
                  />
                </View>
              )}
              
              <View style={styles.timePickerContainer}>
                <Text variant="labelLarge" style={styles.timeLabel}>End Time</Text>
                <View style={styles.timePickerRow}>
                  <Chip 
                    icon="calendar" 
                    style={styles.timeChip}
                    onPress={() => showDateTimePicker(false, 'date')}
                  >
                    {formatDateOnly(endDate)}
                  </Chip>
                  <Chip 
                    icon="clock-outline" 
                    style={styles.timeChip}
                    onPress={() => showDateTimePicker(false, 'time')}
                  >
                    {formatTime(endDate)}
                  </Chip>
                </View>
              </View>
              
              {/* End Time Picker - positioned right after end time display */}
              {showEndTimePicker && (
                <View style={styles.dateTimePickerContainer}>
                  {Platform.OS === 'ios' && (
                    <View style={styles.pickerHeader}>
                      <Text variant="titleSmall" style={styles.pickerTitle}>
                        Select {timePickerMode === 'date' ? 'Date' : 'Time'}
                      </Text>
                      <Button 
                        mode="text" 
                        onPress={() => setShowEndTimePicker(false)}
                        style={styles.doneButton}
                      >
                        Done
                      </Button>
                    </View>
                  )}
                  <DateTimePicker
                    value={endDate}
                    mode={timePickerMode}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onEndTimeChange}
                    is24Hour={true}
                  />
                </View>
              )}
              
              <View style={styles.quickTimeOptions}>
                <Text variant="labelMedium" style={styles.quickTimeLabel}>Quick Options:</Text>
                <View style={styles.quickTimeButtons}>
                  <Chip 
                    mode="outlined" 
                    style={styles.quickTimeChip}
                    onPress={() => {
                      const now = new Date();
                      const morning = new Date(now);
                      morning.setHours(9, 0, 0, 0);
                      const evening = new Date(now);
                      evening.setHours(17, 0, 0, 0);
                      setStartDate(morning);
                      setEndDate(evening);
                    }}
                  >
                    Work Hours (9-5)
                  </Chip>
                  <Chip 
                    mode="outlined" 
                    style={styles.quickTimeChip}
                    onPress={() => {
                      const now = new Date();
                      const evening = new Date(now);
                      evening.setHours(18, 0, 0, 0);
                      const night = new Date(now);
                      night.setHours(22, 0, 0, 0);
                      setStartDate(evening);
                      setEndDate(night);
                    }}
                  >
                    Evening (6-10pm)
                  </Chip>
                  <Chip 
                    mode="outlined" 
                    style={styles.quickTimeChip}
                    onPress={() => {
                      const now = new Date();
                      const morning = new Date(now);
                      morning.setHours(8, 0, 0, 0);
                      const noon = new Date(now);
                      noon.setHours(12, 0, 0, 0);
                      setStartDate(morning);
                      setEndDate(noon);
                    }}
                  >
                    Morning (8-12pm)
                  </Chip>
                </View>
              </View>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Location Condition */}
      <Card style={styles.card} mode="outlined">
        <Card.Content>
          <View style={styles.conditionHeader}>
            <Text variant="titleMedium">Location Condition</Text>
            <Switch value={hasLocationCondition} onValueChange={setHasLocationCondition} />
          </View>
          
          {hasLocationCondition && (
            <View style={styles.conditionContent}>
              <Text variant="bodyMedium" style={styles.conditionDescription}>
                Reminder will trigger when you're within the specified radius of a location
              </Text>
              
              <Button
                mode="contained"
                onPress={getCurrentLocation}
                loading={locationLoading}
                style={styles.locationButton}
                icon="crosshairs-gps"
              >
                {currentLocation ? 'Update Location' : 'Set Current Location'}
              </Button>
              
              {currentLocation && (
                <Text variant="bodySmall" style={styles.locationInfo}>
                  Location: {currentLocation.coords.latitude.toFixed(6)}, {currentLocation.coords.longitude.toFixed(6)}
                </Text>
              )}
              
              <View style={styles.sliderContainer}>
                <Text variant="labelMedium">Radius: {locationRadius}m</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={10}
                  maximumValue={1000}
                  value={locationRadius}
                  onValueChange={setLocationRadius}
                  step={10}
                />
              </View>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Battery Condition */}
      <Card style={styles.card} mode="outlined">
        <Card.Content>
          <View style={styles.conditionHeader}>
            <Text variant="titleMedium">Battery Condition</Text>
            <Switch value={hasBatteryCondition} onValueChange={setHasBatteryCondition} />
          </View>
          
          {/* Current Battery Level Display */}
          <View style={styles.currentBatteryContainer}>
            <View style={styles.batteryInfoRow}>
              <Text variant="bodyMedium" style={styles.batteryLabel}>
                Current Battery:
              </Text>
              <Chip 
                icon="battery" 
                style={[
                  styles.batteryChip,
                  { backgroundColor: getBatteryColorBasedOnLevel() }
                ]}
                textStyle={{ color: '#fff', fontWeight: 'bold' }}
              >
                {currentBatteryLevel}
              </Chip>
            </View>
            <Text variant="bodySmall" style={styles.batteryStatusText}>
              {batteryStatus}
            </Text>
          </View>
          
          {hasBatteryCondition && (
            <View style={styles.conditionContent}>
              <Text variant="bodyMedium" style={styles.conditionDescription}>
                Reminder will trigger based on battery level
              </Text>
              
              <SegmentedButtons
                value={batteryMode}
                onValueChange={(value) => setBatteryMode(value as any)}
                buttons={[
                  { value: 'min', label: 'Above' },
                  { value: 'max', label: 'Below' },
                  { value: 'range', label: 'Range' },
                ]}
                style={styles.segmentedButtons}
              />
              
              {(batteryMode === 'min' || batteryMode === 'range') && (
                <View style={styles.sliderContainer}>
                  <Text variant="labelMedium">
                    Minimum Battery: {batteryMin}%
                  </Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={100}
                    value={batteryMin}
                    onValueChange={setBatteryMin}
                    step={5}
                  />
                </View>
              )}
              
              {(batteryMode === 'max' || batteryMode === 'range') && (
                <View style={styles.sliderContainer}>
                  <Text variant="labelMedium">
                    Maximum Battery: {batteryMax}%
                  </Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={100}
                    value={batteryMax}
                    onValueChange={setBatteryMax}
                    step={5}
                  />
                </View>
              )}
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Options */}
      <Card style={styles.card} mode="outlined">
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Options</Text>
          
          <View style={styles.optionContainer}>
            <Text variant="labelMedium">Repeat</Text>
            <SegmentedButtons
              value={repeat}
              onValueChange={setRepeat}
              buttons={[
                { value: 'none', label: 'None' },
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
              ]}
              style={styles.segmentedButtons}
            />
          </View>
          
          <View style={styles.sliderContainer}>
            <Text variant="labelMedium">
              Cooldown: {cooldownMins} minutes
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={60}
              value={cooldownMins}
              onValueChange={setCooldownMins}
              step={5}
            />
          </View>
        </Card.Content>
      </Card>

      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={onCancel}
          style={[styles.button, styles.cancelButton]}
        >
          Cancel
        </Button>
        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={isSubmitting}
          style={[styles.button, styles.submitButton]}
        >
          {isEditing ? 'Update' : 'Create'} Reminder
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  input: {
    marginBottom: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  conditionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  conditionContent: {
    marginTop: 16,
  },
  conditionDescription: {
    marginBottom: 16,
    color: '#666',
  },
  dateContainer: {
    marginBottom: 12,
  },
  locationButton: {
    marginBottom: 12,
  },
  locationInfo: {
    color: '#666',
    marginBottom: 16,
  },
  sliderContainer: {
    marginBottom: 16,
  },
  slider: {
    marginTop: 8,
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  optionContainer: {
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  button: {
    flex: 1,
  },
  cancelButton: {
    marginRight: 8,
  },
  submitButton: {
    marginLeft: 8,
  },
  currentBatteryContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  batteryInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  batteryLabel: {
    fontWeight: '500',
    color: '#495057',
  },
  batteryChip: {
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  batteryStatusText: {
    color: '#6c757d',
    fontSize: 12,
    marginTop: 4,
  },
  timePickerContainer: {
    marginBottom: 20,
  },
  timeLabel: {
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  timePickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timeChip: {
    flex: 1,
    justifyContent: 'center',
  },
  quickTimeOptions: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  quickTimeLabel: {
    fontWeight: '500',
    marginBottom: 8,
    color: '#495057',
  },
  quickTimeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickTimeChip: {
    marginRight: 4,
    marginBottom: 4,
  },
  dateTimePickerContainer: {
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 8,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 8,
  },
  pickerTitle: {
    fontWeight: '600',
    color: '#333',
  },
  doneButton: {
    minWidth: 60,
  },
});