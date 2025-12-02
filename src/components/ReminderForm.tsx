import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
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
import { CreateReminderInput, UpdateReminderInput, ReminderRule, LocationTrigger } from '../types/reminder';
import { locationSelectionService } from '../services/locationSelection';

// Simple UUID generator for React Native
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

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
  const insets = useSafeAreaInsets();
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
  
  // Time editing state
  const [editingStartTime, setEditingStartTime] = useState(false);
  const [editingEndTime, setEditingEndTime] = useState(false);
  const [tempStartHour, setTempStartHour] = useState(startDate.getHours());
  const [tempStartMinute, setTempStartMinute] = useState(startDate.getMinutes());
  const [tempEndHour, setTempEndHour] = useState(endDate.getHours());
  const [tempEndMinute, setTempEndMinute] = useState(endDate.getMinutes());
  
  // Date editing state
  const [editingStartDate, setEditingStartDate] = useState(false);
  const [editingEndDate, setEditingEndDate] = useState(false);
  const [tempStartDay, setTempStartDay] = useState(startDate.getDate());
  const [tempStartMonth, setTempStartMonth] = useState(startDate.getMonth());
  const [tempStartYear, setTempStartYear] = useState(startDate.getFullYear());
  const [tempEndDay, setTempEndDay] = useState(endDate.getDate());
  const [tempEndMonth, setTempEndMonth] = useState(endDate.getMonth());
  const [tempEndYear, setTempEndYear] = useState(endDate.getFullYear());
  
  // Location condition state - REMOVED (replaced by location trigger/geofencing)
  
  // Location trigger state (geofencing)
  const [hasLocationTrigger, setHasLocationTrigger] = useState(!!(initialValues?.locationTrigger?.enabled));
  const [locationTrigger, setLocationTrigger] = useState<Omit<LocationTrigger, 'id' | 'enabled'> | null>(
    initialValues?.locationTrigger ? {
      latitude: initialValues.locationTrigger.latitude,
      longitude: initialValues.locationTrigger.longitude,
      radius: initialValues.locationTrigger.radius,
      mode: initialValues.locationTrigger.mode,
      label: initialValues.locationTrigger.label,
    } : null
  );
  
  // Battery condition state
  const [hasBatteryCondition, setHasBatteryCondition] = useState(!!(initialValues?.rule?.battery));
  const [batteryMin, setBatteryMin] = useState(initialValues?.rule?.battery?.min || 20);
  const [batteryMax, setBatteryMax] = useState(initialValues?.rule?.battery?.max || 80);
  const [batteryMode, setBatteryMode] = useState<'range' | 'min' | 'max'>('range');
  
  // Options state
  const [repeat, setRepeat] = useState(initialValues?.rule?.options?.repeat || 'none');
  const [cooldownMins, setCooldownMins] = useState(initialValues?.rule?.options?.cooldownMins || 10);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    // Sync temp time values with actual dates
    setTempStartHour(startDate.getHours());
    setTempStartMinute(startDate.getMinutes());
    setTempEndHour(endDate.getHours());
    setTempEndMinute(endDate.getMinutes());
    
    // Sync temp date values with actual dates
    setTempStartDay(startDate.getDate());
    setTempStartMonth(startDate.getMonth());
    setTempStartYear(startDate.getFullYear());
    setTempEndDay(endDate.getDate());
    setTempEndMonth(endDate.getMonth());
    setTempEndYear(endDate.getFullYear());

    // Handle preset initialization
    if (preset && !initialValues) {
      if (preset === 'time') {
        setHasTimeCondition(true);
        setTitle('Remind me later');
      } else if (preset === 'location') {
        setHasLocationTrigger(true);
        setTitle('Wake me there');
      } else if (preset === 'battery') {
        setHasBatteryCondition(true);
        setTitle('Battery reminder');
      } else if (preset === 'all') {
        setTitle('New reminder');
      }
    }
  }, [initialValues, preset, startDate, endDate]);

  // Subscribe to location selections from MapPicker
  useEffect(() => {
    const unsubscribe = locationSelectionService.subscribe((location) => {
      setLocationTrigger(location);
      setHasLocationTrigger(true);
    });

    return unsubscribe;
  }, []);

  // getCurrentLocation function removed - replaced by MapPicker component

  const openMapPicker = () => {
    const params: any = {
      isEditing: isEditing ? 'true' : 'false',
      preset: preset || undefined, // Pass the preset context
    };
    
    if (locationTrigger) {
      params.latitude = locationTrigger.latitude.toString();
      params.longitude = locationTrigger.longitude.toString();
      params.radius = locationTrigger.radius.toString();
      params.mode = locationTrigger.mode;
      params.label = locationTrigger.label || '';
    }
    
    router.push({ pathname: '/map-picker', params });
  };

  const removeLocationTrigger = () => {
    setLocationTrigger(null);
    Alert.alert('Location Removed', 'Location trigger has been removed from this reminder.');
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

    // Location condition - REMOVED (replaced by location trigger/geofencing)

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
    if (preset === 'location' && !locationTrigger) {
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

    if (hasLocationTrigger && !locationTrigger) {
      Alert.alert('Validation Error', 'Please set a location for the geofencing trigger.');
      return;
    }

    // Validate date order for time conditions
    if (hasTimeCondition && !validateDateOrder(startDate, endDate)) {
      Alert.alert(
        'Invalid Date Range', 
        'Start date and time must be earlier than end date and time. Please adjust your time condition.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const reminderLocationTrigger = hasLocationTrigger && locationTrigger ? {
        id: generateUUID(), // Generate unique ID for the trigger
        ...locationTrigger,
        enabled: true,
      } : undefined;

      const reminderData = {
        ...(isEditing && initialValues?.id ? { id: initialValues.id } : {}),
        title: title.trim(),
        notes: notes.trim() || undefined,
        rule: buildRule(),
        locationTrigger: reminderLocationTrigger,
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

  const getMonthName = (monthIndex: number): string => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return months[monthIndex];
  };

  const getDaysInMonth = (month: number, year: number): number => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getCurrentYear = (): number => {
    return new Date().getFullYear();
  };

  const validateDateOrder = (startDateTime: Date, endDateTime: Date): boolean => {
    return startDateTime < endDateTime;
  };

  const showDateOrderError = () => {
    Alert.alert(
      'Invalid Date Range', 
      'Start date and time must be earlier than end date and time.',
      [{ text: 'OK' }]
    );
  };

  const updateStartTime = (hour: number, minute: number) => {
    const newDate = new Date(startDate);
    newDate.setHours(hour, minute);
    setStartDate(newDate);
  };

  const updateEndTime = (hour: number, minute: number) => {
    const newDate = new Date(endDate);
    newDate.setHours(hour, minute);
    setEndDate(newDate);
  };

  const updateStartDate = (day: number, month: number, year: number) => {
    const newDate = new Date(startDate);
    newDate.setFullYear(year, month, day);
    setStartDate(newDate);
  };

  const updateEndDate = (day: number, month: number, year: number) => {
    const newDate = new Date(endDate);
    newDate.setFullYear(year, month, day);
    setEndDate(newDate);
  };

  const saveStartTime = () => {
    const newStartDate = new Date(startDate);
    newStartDate.setHours(tempStartHour, tempStartMinute);
    
    if (!validateDateOrder(newStartDate, endDate)) {
      showDateOrderError();
      return;
    }
    
    updateStartTime(tempStartHour, tempStartMinute);
    setEditingStartTime(false);
  };

  const saveEndTime = () => {
    const newEndDate = new Date(endDate);
    newEndDate.setHours(tempEndHour, tempEndMinute);
    
    if (!validateDateOrder(startDate, newEndDate)) {
      showDateOrderError();
      return;
    }
    
    updateEndTime(tempEndHour, tempEndMinute);
    setEditingEndTime(false);
  };

  const saveStartDate = () => {
    const newStartDate = new Date(startDate);
    newStartDate.setFullYear(tempStartYear, tempStartMonth, tempStartDay);
    
    if (!validateDateOrder(newStartDate, endDate)) {
      showDateOrderError();
      return;
    }
    
    updateStartDate(tempStartDay, tempStartMonth, tempStartYear);
    setEditingStartDate(false);
  };

  const saveEndDate = () => {
    const newEndDate = new Date(endDate);
    newEndDate.setFullYear(tempEndYear, tempEndMonth, tempEndDay);
    
    if (!validateDateOrder(startDate, newEndDate)) {
      showDateOrderError();
      return;
    }
    
    updateEndDate(tempEndDay, tempEndMonth, tempEndYear);
    setEditingEndDate(false);
  };

  const cancelStartTimeEdit = () => {
    setTempStartHour(startDate.getHours());
    setTempStartMinute(startDate.getMinutes());
    setEditingStartTime(false);
  };

  const cancelEndTimeEdit = () => {
    setTempEndHour(endDate.getHours());
    setTempEndMinute(endDate.getMinutes());
    setEditingEndTime(false);
  };

  const cancelStartDateEdit = () => {
    setTempStartDay(startDate.getDate());
    setTempStartMonth(startDate.getMonth());
    setTempStartYear(startDate.getFullYear());
    setEditingStartDate(false);
  };

  const cancelEndDateEdit = () => {
    setTempEndDay(endDate.getDate());
    setTempEndMonth(endDate.getMonth());
    setTempEndYear(endDate.getFullYear());
    setEditingEndDate(false);
  };

  const shouldShowSection = (section: 'time' | 'location' | 'battery' | 'options'): boolean => {
    if (!preset || preset === 'all') return true;
    if (preset === section) return true;
    if (section === 'options') return true; // Always show options
    return false;
  };

  return (
    <View style={styles.container}>
      {/* Purple Top Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <IconButton 
          icon="arrow-left" 
          iconColor="#a644f0ff"
          onPress={onCancel}
        />
        <Text variant="titleLarge" style={styles.topBarTitle}>
          {isEditing ? 'Edit Reminder' : 'Create Reminder'}
        </Text>
        <View style={styles.topBarSpacer} />
      </View>
      
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card style={styles.card} mode="outlined">
          <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Basic Information</Text>
          
          <TextInput
            label="Title *"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
            mode="outlined"
            contentStyle={styles.inputContent}
            outlineStyle={styles.inputOutline}
            activeOutlineColor="#6B46C1"
          />
          
          <TextInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            style={styles.input}
            mode="outlined"
            multiline
            numberOfLines={3}
            contentStyle={styles.inputContent}
            outlineStyle={styles.inputOutline}
            activeOutlineColor="#6B46C1"
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
              
    
              
              {/* Start Date & Time */}
              <View style={styles.timeEditContainer}>
                <View style={styles.timeHeader}>
                  <Text variant="labelMedium">Start Date & Time</Text>
                  <View style={styles.editButtonsContainer}>
                    <IconButton 
                      icon={editingStartDate ? "close" : "calendar"} 
                      size={16}
                      onPress={() => {
                        if (editingStartDate) {
                          cancelStartDateEdit();
                        } else {
                          setEditingStartDate(true);
                        }
                      }}
                    />
                    <IconButton 
                      icon={editingStartTime ? "close" : "clock"} 
                      size={16}
                      onPress={() => {
                        if (editingStartTime) {
                          cancelStartTimeEdit();
                        } else {
                          setEditingStartTime(true);
                        }
                      }}
                    />
                  </View>
                </View>
                
                {!editingStartDate && !editingStartTime ? (
                  <Chip onPress={() => setEditingStartTime(true)}>
                    {formatDate(startDate)}
                  </Chip>
                ) : null}
                
                {/* Date Picker */}
                {editingStartDate && (
                  <View style={styles.datePickerSection}>
                    <Text variant="bodySmall" style={styles.pickerSectionLabel}>Edit Date</Text>
                    <View style={styles.datePickerContainer}>
                      <View style={styles.datePicker}>
                        <Text variant="bodySmall" style={styles.timePickerLabel}>Month</Text>
                        <ScrollView 
                          style={styles.dateScrollView}
                          showsVerticalScrollIndicator={false}
                          snapToInterval={40}
                          decelerationRate="fast"
                        >
                          {Array.from({ length: 12 }, (_, i) => (
                            <TouchableOpacity key={i} style={styles.timeItem} onPress={() => setTempStartMonth(i)}>
                              <Text 
                                variant="titleMedium" 
                                style={[
                                  styles.timeText,
                                  tempStartMonth === i && styles.selectedTimeText
                                ]}
                              >
                                {getMonthName(i)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                      
                      <View style={styles.datePicker}>
                        <Text variant="bodySmall" style={styles.timePickerLabel}>Day</Text>
                        <ScrollView 
                          style={styles.dateScrollView}
                          showsVerticalScrollIndicator={false}
                          snapToInterval={40}
                          decelerationRate="fast"
                        >
                          {Array.from({ length: getDaysInMonth(tempStartMonth, tempStartYear) }, (_, i) => (
                            <TouchableOpacity key={i + 1} style={styles.timeItem} onPress={() => setTempStartDay(i + 1)}>
                              <Text 
                                variant="titleMedium" 
                                style={[
                                  styles.timeText,
                                  tempStartDay === (i + 1) && styles.selectedTimeText
                                ]}
                              >
                                {(i + 1).toString().padStart(2, '0')}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                      
                      <View style={styles.datePicker}>
                        <Text variant="bodySmall" style={styles.timePickerLabel}>Year</Text>
                        <ScrollView 
                          style={styles.dateScrollView}
                          showsVerticalScrollIndicator={false}
                          snapToInterval={40}
                          decelerationRate="fast"
                        >
                          {Array.from({ length: 10 }, (_, i) => {
                            const year = getCurrentYear() + i;
                            return (
                              <TouchableOpacity key={year} style={styles.timeItem} onPress={() => setTempStartYear(year)}>
                                <Text 
                                  variant="titleMedium" 
                                  style={[
                                    styles.timeText,
                                    tempStartYear === year && styles.selectedTimeText
                                  ]}
                                >
                                  {year}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    </View>
                    
                    <View style={styles.timeActions}>
                      <Button 
                        mode="outlined" 
                        compact 
                        onPress={cancelStartDateEdit}
                        style={styles.timeActionButton}
                      >
                        Cancel
                      </Button>
                      <Button 
                        mode="contained" 
                        compact 
                        onPress={saveStartDate}
                        style={styles.timeActionButton}
                      >
                        Save
                      </Button>
                    </View>
                  </View>
                )}
                
                {/* Time Picker */}
                {editingStartTime && (
                  <View style={styles.timePickerSection}>
                    <Text variant="bodySmall" style={styles.pickerSectionLabel}>Edit Time</Text>
                    <View style={styles.timePickerContainer}>
                      <View style={styles.timePicker}>
                        <Text variant="bodySmall" style={styles.timePickerLabel}>Hour</Text>
                        <ScrollView 
                          style={styles.timeScrollView}
                          showsVerticalScrollIndicator={false}
                          snapToInterval={40}
                          decelerationRate="fast"
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <TouchableOpacity key={i} style={styles.timeItem} onPress={() => setTempStartHour(i)}>
                              <Text 
                                variant="titleMedium" 
                                style={[
                                  styles.timeText,
                                  tempStartHour === i && styles.selectedTimeText
                                ]}
                              >
                                {i.toString().padStart(2, '0')}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                      
                      <Text variant="titleLarge" style={styles.timeSeparator}>:</Text>
                      
                      <View style={styles.timePicker}>
                        <Text variant="bodySmall" style={styles.timePickerLabel}>Minute</Text>
                        <ScrollView 
                          style={styles.timeScrollView}
                          showsVerticalScrollIndicator={false}
                          snapToInterval={40}
                          decelerationRate="fast"
                        >
                          {Array.from({ length: 60 }, (_, i) => (
                            <TouchableOpacity key={i} style={styles.timeItem} onPress={() => setTempStartMinute(i)}>
                              <Text 
                                variant="titleMedium" 
                                style={[
                                  styles.timeText,
                                  tempStartMinute === i && styles.selectedTimeText
                                ]}
                              >
                                {i.toString().padStart(2, '0')}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                    
                    <View style={styles.timeActions}>
                      <Button 
                        mode="outlined" 
                        compact 
                        onPress={cancelStartTimeEdit}
                        style={styles.timeActionButton}
                      >
                        Cancel
                      </Button>
                      <Button 
                        mode="contained" 
                        compact 
                        onPress={saveStartTime}
                        style={styles.timeActionButton}
                      >
                        Save
                      </Button>
                    </View>
                  </View>
                )}
              </View>
              
              {/* End Date & Time */}
              <View style={styles.timeEditContainer}>
                <View style={styles.timeHeader}>
                  <Text variant="labelMedium">End Date & Time</Text>
                  <View style={styles.editButtonsContainer}>
                    <IconButton 
                      icon={editingEndDate ? "close" : "calendar"} 
                      size={16}
                      onPress={() => {
                        if (editingEndDate) {
                          cancelEndDateEdit();
                        } else {
                          setEditingEndDate(true);
                        }
                      }}
                    />
                    <IconButton 
                      icon={editingEndTime ? "close" : "clock"} 
                      size={16}
                      onPress={() => {
                        if (editingEndTime) {
                          cancelEndTimeEdit();
                        } else {
                          setEditingEndTime(true);
                        }
                      }}
                    />
                  </View>
                </View>
                
                {!editingEndDate && !editingEndTime ? (
                  <Chip onPress={() => setEditingEndTime(true)}>
                    {formatDate(endDate)}
                  </Chip>
                ) : null}
                
                {/* Date Picker */}
                {editingEndDate && (
                  <View style={styles.datePickerSection}>
                    <Text variant="bodySmall" style={styles.pickerSectionLabel}>Edit Date</Text>
                    <View style={styles.datePickerContainer}>
                      <View style={styles.datePicker}>
                        <Text variant="bodySmall" style={styles.timePickerLabel}>Month</Text>
                        <ScrollView 
                          style={styles.dateScrollView}
                          showsVerticalScrollIndicator={false}
                          snapToInterval={40}
                          decelerationRate="fast"
                        >
                          {Array.from({ length: 12 }, (_, i) => (
                            <TouchableOpacity key={i} style={styles.timeItem} onPress={() => setTempEndMonth(i)}>
                              <Text 
                                variant="titleMedium" 
                                style={[
                                  styles.timeText,
                                  tempEndMonth === i && styles.selectedTimeText
                                ]}
                              >
                                {getMonthName(i)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                      
                      <View style={styles.datePicker}>
                        <Text variant="bodySmall" style={styles.timePickerLabel}>Day</Text>
                        <ScrollView 
                          style={styles.dateScrollView}
                          showsVerticalScrollIndicator={false}
                          snapToInterval={40}
                          decelerationRate="fast"
                        >
                          {Array.from({ length: getDaysInMonth(tempEndMonth, tempEndYear) }, (_, i) => (
                            <TouchableOpacity key={i + 1} style={styles.timeItem} onPress={() => setTempEndDay(i + 1)}>
                              <Text 
                                variant="titleMedium" 
                                style={[
                                  styles.timeText,
                                  tempEndDay === (i + 1) && styles.selectedTimeText
                                ]}
                              >
                                {(i + 1).toString().padStart(2, '0')}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                      
                      <View style={styles.datePicker}>
                        <Text variant="bodySmall" style={styles.timePickerLabel}>Year</Text>
                        <ScrollView 
                          style={styles.dateScrollView}
                          showsVerticalScrollIndicator={false}
                          snapToInterval={40}
                          decelerationRate="fast"
                        >
                          {Array.from({ length: 10 }, (_, i) => {
                            const year = getCurrentYear() + i;
                            return (
                              <TouchableOpacity key={year} style={styles.timeItem} onPress={() => setTempEndYear(year)}>
                                <Text 
                                  variant="titleMedium" 
                                  style={[
                                    styles.timeText,
                                    tempEndYear === year && styles.selectedTimeText
                                  ]}
                                >
                                  {year}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    </View>
                    
                    <View style={styles.timeActions}>
                      <Button 
                        mode="outlined" 
                        compact 
                        onPress={cancelEndDateEdit}
                        style={styles.timeActionButton}
                      >
                        Cancel
                      </Button>
                      <Button 
                        mode="contained" 
                        compact 
                        onPress={saveEndDate}
                        style={styles.timeActionButton}
                      >
                        Save
                      </Button>
                    </View>
                  </View>
                )}
                
                {/* Time Picker */}
                {editingEndTime && (
                  <View style={styles.timePickerSection}>
                    <Text variant="bodySmall" style={styles.pickerSectionLabel}>Edit Time</Text>
                    <View style={styles.timePickerContainer}>
                      <View style={styles.timePicker}>
                        <Text variant="bodySmall" style={styles.timePickerLabel}>Hour</Text>
                        <ScrollView 
                          style={styles.timeScrollView}
                          showsVerticalScrollIndicator={false}
                          snapToInterval={40}
                          decelerationRate="fast"
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <TouchableOpacity key={i} style={styles.timeItem} onPress={() => setTempEndHour(i)}>
                              <Text 
                                variant="titleMedium" 
                                style={[
                                  styles.timeText,
                                  tempEndHour === i && styles.selectedTimeText
                                ]}
                              >
                                {i.toString().padStart(2, '0')}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                      
                      <Text variant="titleLarge" style={styles.timeSeparator}>:</Text>
                      
                      <View style={styles.timePicker}>
                        <Text variant="bodySmall" style={styles.timePickerLabel}>Minute</Text>
                        <ScrollView 
                          style={styles.timeScrollView}
                          showsVerticalScrollIndicator={false}
                          snapToInterval={40}
                          decelerationRate="fast"
                        >
                          {Array.from({ length: 60 }, (_, i) => (
                            <TouchableOpacity key={i} style={styles.timeItem} onPress={() => setTempEndMinute(i)}>
                              <Text 
                                variant="titleMedium" 
                                style={[
                                  styles.timeText,
                                  tempEndMinute === i && styles.selectedTimeText
                                ]}
                              >
                                {i.toString().padStart(2, '0')}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                    
                    <View style={styles.timeActions}>
                      <Button 
                        mode="outlined" 
                        compact 
                        onPress={cancelEndTimeEdit}
                        style={styles.timeActionButton}
                      >
                        Cancel
                      </Button>
                      <Button 
                        mode="contained" 
                        compact 
                        onPress={saveEndTime}
                        style={styles.timeActionButton}
                      >
                        Save
                      </Button>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}
          </Card.Content>
        </Card>
      )}

      {/* Old Location Condition section removed - replaced by Geofencing Trigger below */}

      {/* Geofencing Trigger */}
      {shouldShowSection('location') && (
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <View style={styles.conditionHeader}>
              <Text variant="titleMedium">Location Trigger (Geofencing)</Text>
              {preset !== 'location' && (
                <Switch value={hasLocationTrigger} onValueChange={setHasLocationTrigger} />
              )}
              {preset === 'location' && (
                <Text variant="bodySmall" style={{ color: theme.colors.primary }}>Required</Text>
              )}
            </View>
          
          {hasLocationTrigger && (
            <View style={styles.conditionContent}>
              <Text variant="bodyMedium" style={styles.conditionDescription}>
                Get notified when entering or leaving a specific location
              </Text>
              
              {locationTrigger ? (
                <View style={styles.locationTriggerInfo}>
                  <Card mode="contained" style={styles.locationCard}>
                    <Card.Content style={styles.locationCardContent}>
                      <Text variant="titleSmall" numberOfLines={1}>
                        {locationTrigger.label || 'Selected Location'}
                      </Text>
                      <Text variant="bodySmall" style={styles.locationDetails}>
                        {locationTrigger.latitude.toFixed(4)}, {locationTrigger.longitude.toFixed(4)}
                      </Text>
                      <Text variant="bodySmall" style={styles.locationDetails}>
                        Radius: {locationTrigger.radius}m • Mode: {locationTrigger.mode}
                      </Text>
                    </Card.Content>
                  </Card>
                  
                  <View style={styles.locationActions}>
                    <Button
                      mode="outlined"
                      onPress={openMapPicker}
                      style={styles.locationActionButton}
                      icon="map-marker-outline"
                    >
                      Edit Location
                    </Button>
                    <Button
                      mode="text"
                      onPress={removeLocationTrigger}
                      style={styles.locationActionButton}
                      textColor={theme.colors.error}
                    >
                      Remove
                    </Button>
                  </View>
                </View>
              ) : (
                <Button
                  mode="contained"
                  onPress={openMapPicker}
                  style={styles.locationButton}
                  icon="map-marker-plus"
                >
                  Choose Location on Map
                </Button>
              )}
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
          mode="contained"
          onPress={handleSubmit}
          loading={isSubmitting}
          style={[styles.button, styles.primaryButton]}
          contentStyle={styles.primaryButtonContent}
          labelStyle={styles.primaryButtonLabel}
        >
          {isEditing ? 'Update' : 'Create'} Reminder
        </Button>
      </View>
    </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B46C1', // Purple color
    paddingHorizontal: 8,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginRight: 48, // Compensate for left icon
  },
  topBarSpacer: {
    width: 48,
  },
  scrollContent: {
    flex: 1,
  },
  card: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 16, // More rounded
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: '600',
    color: '#6B46C1',
  },
  input: {
    marginBottom: 16,
    borderRadius: 12, // Rounded inputs
  },
  inputContent: {
    borderRadius: 12,
  },
  inputOutline: {
    borderRadius: 12,
    borderWidth: 2,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    backgroundColor: '#F8F9FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  conditionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    backgroundColor: '#F8F9FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: -16,
  },
  conditionContent: {
    marginTop: 16,
    backgroundColor: '#FAFBFF',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: -16,
  },
  conditionDescription: {
    marginBottom: 16,
    color: '#666',
  },
  warningContainer: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    color: '#856404',
    fontWeight: '500',
    textAlign: 'center',
  },
  dateContainer: {
    marginBottom: 12,
  },
  timeEditContainer: {
    marginBottom: 20,
  },
  timeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  editButtonsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  datePickerSection: {
    marginBottom: 16,
  },
  pickerSectionLabel: {
    marginBottom: 12,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  datePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  datePicker: {
    alignItems: 'center',
    flex: 1,
  },
  dateScrollView: {
    height: 120,
    width: 70,
  },
  timePickerSection: {
    marginBottom: 16,
  },
  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  timePicker: {
    alignItems: 'center',
    flex: 1,
  },
  timePickerLabel: {
    marginBottom: 8,
    opacity: 0.7,
  },
  timeScrollView: {
    height: 120,
    width: 60,
  },
  timeItem: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  timeText: {
    color: '#666',
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 50,
  },
  selectedTimeText: {
    color: '#6750a4',
    backgroundColor: '#e8def8',
    fontWeight: '600',
  },
  timeSeparator: {
    marginHorizontal: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  timeActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  timeActionButton: {
    flex: 1,
    borderRadius: 20,
  },
  locationButton: {
    marginBottom: 12,
    borderRadius: 20,
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
    padding: 20,
    paddingBottom: 30,
    backgroundColor: '#FFFFFF',
  },
  button: {
    borderRadius: 24, // Very rounded buttons
    paddingVertical: 4,
  },
  cancelButton: {
    marginRight: 8,
    borderRadius: 24,
  },
  submitButton: {
    marginLeft: 8,
    borderRadius: 24,
    backgroundColor: '#6B46C1',
  },
  primaryButton: {
    borderRadius: 24,
    backgroundColor: '#6B46C1',
    shadowColor: '#6B46C1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonContent: {
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  primaryButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  locationTriggerInfo: {
    marginTop: 8,
  },
  locationCard: {
    marginBottom: 12,
  },
  locationCardContent: {
    paddingVertical: 12,
  },
  locationDetails: {
    marginTop: 4,
    opacity: 0.7,
  },
  locationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  locationActionButton: {
    flex: 1,
    borderRadius: 20,
  },
});