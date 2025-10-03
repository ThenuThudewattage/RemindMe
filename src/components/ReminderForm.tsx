import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
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
  Divider
} from 'react-native-paper';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import { CreateReminderInput, UpdateReminderInput, ReminderRule } from '../types/reminder';

interface ReminderFormProps {
  initialValues?: UpdateReminderInput;
  defaultCreateValues?: CreateReminderInput;
  preset?: string;
  onSubmit: (data: CreateReminderInput | UpdateReminderInput) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
}

export const ReminderForm: React.FC<ReminderFormProps> = ({
  initialValues,
  defaultCreateValues,
  preset,
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
  
  // Location condition state
  const [hasLocationCondition, setHasLocationCondition] = useState(!!(initialValues?.rule?.location));
  const [locationRadius, setLocationRadius] = useState(initialValues?.rule?.location?.radius || 100);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  
  // Battery condition state
  const [hasBatteryCondition, setHasBatteryCondition] = useState(!!(initialValues?.rule?.battery));
  const [batteryMin, setBatteryMin] = useState(initialValues?.rule?.battery?.min || 20);
  const [batteryMax, setBatteryMax] = useState(initialValues?.rule?.battery?.max || 80);
  const [batteryMode, setBatteryMode] = useState<'range' | 'min' | 'max'>('range');
  
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

    // Handle preset initialization
    if (preset && !initialValues) {
      if (preset === 'time') {
        setHasTimeCondition(true);
        setTitle('Remind me later');
      } else if (preset === 'location') {
        setHasLocationCondition(true);
        setTitle('Wake me there');
      } else if (preset === 'battery') {
        setHasBatteryCondition(true);
        setTitle('Battery reminder');
      } else if (preset === 'all') {
        setTitle('New reminder');
      }
    }
  }, [initialValues, preset]);

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
    if (hasLocationCondition && currentLocation) {
      newRule.location = {
        lat: currentLocation.coords.latitude,
        lon: currentLocation.coords.longitude,
        radius: locationRadius,
      };
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

    // Preset-specific validation
    if (preset === 'location' && !currentLocation) {
      Alert.alert('Validation Error', 'Please set a location for the location-based reminder.');
      return;
    }

    if (preset === 'time' && !hasTimeCondition) {
      Alert.alert('Validation Error', 'Time condition is required for time-based reminders.');
      return;
    }

    if (preset === 'battery' && !hasBatteryCondition) {
      Alert.alert('Validation Error', 'Battery condition is required for battery-based reminders.');
      return;
    }

    // General validation for optional conditions
    if (hasLocationCondition && !currentLocation) {
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

  const shouldShowSection = (section: 'time' | 'location' | 'battery' | 'options'): boolean => {
    if (!preset || preset === 'all') return true;
    if (preset === section) return true;
    if (section === 'options') return true; // Always show options
    return false;
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
      {shouldShowSection('time') && (
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <View style={styles.conditionHeader}>
              <Text variant="titleMedium">Time Condition</Text>
              {preset !== 'time' && (
                <Switch value={hasTimeCondition} onValueChange={setHasTimeCondition} />
              )}
              {preset === 'time' && (
                <Text variant="bodySmall" style={{ color: theme.colors.primary }}>Required</Text>
              )}
            </View>
          
          {hasTimeCondition && (
            <View style={styles.conditionContent}>
              <Text variant="bodyMedium" style={styles.conditionDescription}>
                Reminder will only trigger between these times
              </Text>
              
              <View style={styles.dateContainer}>
                <Text variant="labelMedium">Start Time</Text>
                <Chip onPress={() => {/* TODO: Show date picker */}}>
                  {formatDate(startDate)}
                </Chip>
              </View>
              
              <View style={styles.dateContainer}>
                <Text variant="labelMedium">End Time</Text>
                <Chip onPress={() => {/* TODO: Show date picker */}}>
                  {formatDate(endDate)}
                </Chip>
              </View>
            </View>
          )}
          </Card.Content>
        </Card>
      )}

      {/* Location Condition */}
      {shouldShowSection('location') && (
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <View style={styles.conditionHeader}>
              <Text variant="titleMedium">Location Condition</Text>
              {preset !== 'location' && (
                <Switch value={hasLocationCondition} onValueChange={setHasLocationCondition} />
              )}
              {preset === 'location' && (
                <Text variant="bodySmall" style={{ color: theme.colors.primary }}>Required</Text>
              )}
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
      )}

      {shouldShowSection('battery') && (
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <View style={styles.conditionHeader}>
              <Text variant="titleMedium">Battery Condition</Text>
              {preset !== 'battery' && (
                <Switch value={hasBatteryCondition} onValueChange={setHasBatteryCondition} />
              )}
              {preset === 'battery' && (
                <Text variant="bodySmall" style={{ color: theme.colors.primary }}>Required</Text>
              )}
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
      )}

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
});