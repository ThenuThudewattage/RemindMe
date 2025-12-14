/**
 * ALARM SCREEN
 * 
 * Full-screen alarm interface shown when an alarm triggers
 * Provides snooze and dismiss actions
 * Prevents accidental dismissal with swipe gestures
 * 
 * Features:
 * - Full-screen takeover with high contrast
 * - Large dismiss and snooze buttons
 * - Shows reminder title and trigger reason
 * - Shake-to-snooze gesture support
 * - Prevents back navigation during alarm
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Vibration,
  BackHandler,
  StatusBar,
} from 'react-native';
import {
  Text,
  Button,
  IconButton,
  useTheme,
  Surface,
  Portal,
  Dialog,
} from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useAlarmManager } from '../hooks/useAlarmManager';
import ReminderRepository from '../services/repo';
import { Reminder } from '../types/reminder';

const { width, height } = Dimensions.get('window');

// Hide this screen from the bottom tabs
export const href = null;

export default function AlarmScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { snoozeAlarm, dismissAlarm, currentAlarm } = useAlarmManager();

  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
  const [snoozeInterval, setSnoozeInterval] = useState(10);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const reminderId = parseInt(params.reminderId as string);
  const reminderTitle = params.reminderTitle as string;
  const triggeredBy = params.triggeredBy as string;

  /**
   * Load reminder details
   */
  useEffect(() => {
    loadReminder();
  }, [reminderId]);

  /**
   * Start pulsing animation
   */
  useEffect(() => {
    startPulseAnimation();
    
    // Activate keep awake to wake screen and prevent sleep on lock screen
    activateKeepAwakeAsync('alarm-screen').catch(err => {
      console.error('Failed to activate keep awake:', err);
    });
    
    // Start continuous vibration pattern
    const vibrationPattern = [0, 1000, 1000]; // Vibrate for 1s, pause 1s, repeat
    Vibration.vibrate(vibrationPattern, true); // true = repeat
    
    // Set status bar to light content for better visibility
    if (Platform.OS === 'android') {
      StatusBar.setBarStyle('light-content');
      StatusBar.setBackgroundColor('#C92A2A');
    }
    
    return () => {
      // Cleanup: deactivate keep awake and stop vibration
      deactivateKeepAwake('alarm-screen').catch(err => {
        console.error('Failed to deactivate keep awake:', err);
      });
      Vibration.cancel();
    };
  }, []);

  /**
   * Prevent back navigation while alarm is ringing
   */
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        // Prevent back button from dismissing alarm
        // User must explicitly snooze or dismiss
        console.log('Back button pressed - alarm must be dismissed or snoozed');
        return true; // Return true to prevent default back behavior
      });

      return () => backHandler.remove();
    }
  }, []);

  const loadReminder = async () => {
    try {
      const repo = ReminderRepository.getInstance();
      const reminderData = await repo.getReminder(reminderId);
      setReminder(reminderData);
    } catch (error) {
      console.error('Failed to load reminder:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Start pulsing animation for alarm bell
   */
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  /**
   * Shake animation for feedback
   */
  const shakeAnimation = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  /**
   * Handle snooze button press
   */
  const handleSnooze = async (interval?: number) => {
    try {
      Vibration.cancel(); // Stop alarm vibration
      Vibration.vibrate(100); // Quick haptic feedback
      await snoozeAlarm(interval || snoozeInterval);
      router.back();
    } catch (error) {
      console.error('Failed to snooze alarm:', error);
    }
  };

  /**
   * Handle dismiss button press
   */
  const handleDismiss = async () => {
    try {
      Vibration.cancel(); // Stop alarm vibration
      Vibration.vibrate(100); // Quick haptic feedback
      await dismissAlarm();
      router.back();
    } catch (error) {
      console.error('Failed to dismiss alarm:', error);
    }
  };

  /**
   * Handle snooze options
   */
  const handleShowSnoozeOptions = () => {
    shakeAnimation();
    setShowSnoozeOptions(true);
  };

  /**
   * Get trigger icon based on trigger type
   */
  const getTriggerIcon = () => {
    switch (triggeredBy) {
      case 'location':
        return 'map-marker';
      case 'time':
        return 'clock-outline';
      case 'battery':
        return 'battery';
      default:
        return 'bell';
    }
  };

  /**
   * Get trigger description
   */
  const getTriggerDescription = () => {
    switch (triggeredBy) {
      case 'location':
        return 'You arrived at the location';
      case 'time':
        return 'Scheduled time reached';
      case 'battery':
        return 'Battery condition met';
      default:
        return 'Reminder triggered';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.error }]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { 
          backgroundColor: theme.colors.error,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }
      ]}
    >
      {/* Alarm Icon */}
      <Animated.View
        style={[
          styles.iconContainer,
          {
            transform: [
              { scale: pulseAnim },
              { translateX: shakeAnim },
            ],
          },
        ]}
      >
        <MaterialCommunityIcons
          name="alarm-light"
          size={120}
          color="#FFFFFF"
        />
      </Animated.View>

      {/* Alarm Title */}
      <Text style={styles.title}>ALARM</Text>

      {/* Reminder Info */}
      <Surface style={styles.reminderCard}>
        <View style={styles.reminderHeader}>
          <MaterialCommunityIcons
            name={getTriggerIcon()}
            size={24}
            color={theme.colors.primary}
          />
          <Text style={styles.triggerText}>{getTriggerDescription()}</Text>
        </View>
        
        <Text style={styles.reminderTitle}>{reminderTitle}</Text>
        
        {reminder?.notes && (
          <Text style={styles.reminderNotes}>{reminder.notes}</Text>
        )}

        {currentAlarm && currentAlarm.snoozeCount > 0 && (
          <Text style={styles.snoozeCount}>
            Snoozed {currentAlarm.snoozeCount} time(s)
          </Text>
        )}
      </Surface>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        {/* Snooze Button */}
        <Button
          mode="contained"
          onPress={handleShowSnoozeOptions}
          style={[styles.button, styles.snoozeButton]}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          icon="alarm-snooze"
        >
          Snooze
        </Button>

        {/* Dismiss Button */}
        <Button
          mode="contained"
          onPress={handleDismiss}
          style={[styles.button, styles.dismissButton]}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          icon="alarm-off"
        >
          Dismiss
        </Button>
      </View>

      {/* Quick snooze options */}
      <View style={styles.quickSnoozeContainer}>
        <Text style={styles.quickSnoozeLabel}>Quick Snooze:</Text>
        <View style={styles.quickSnoozeButtons}>
          {[5, 10, 15, 30].map((minutes) => (
            <Button
              key={minutes}
              mode="outlined"
              onPress={() => handleSnooze(minutes)}
              style={styles.quickSnoozeButton}
              textColor="#FFFFFF"
            >
              {minutes}m
            </Button>
          ))}
        </View>
      </View>

      {/* Snooze Options Dialog */}
      <Portal>
        <Dialog
          visible={showSnoozeOptions}
          onDismiss={() => setShowSnoozeOptions(false)}
        >
          <Dialog.Title>Snooze Options</Dialog.Title>
          <Dialog.Content>
            <Text>Choose snooze duration:</Text>
            <View style={styles.snoozeOptionsContainer}>
              {[5, 10, 15, 30, 60].map((minutes) => (
                <Button
                  key={minutes}
                  mode="outlined"
                  onPress={() => {
                    setShowSnoozeOptions(false);
                    handleSnooze(minutes);
                  }}
                  style={styles.snoozeOptionButton}
                >
                  {minutes} minutes
                </Button>
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowSnoozeOptions(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  iconContainer: {
    marginBottom: 30,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 30,
    letterSpacing: 4,
  },
  reminderCard: {
    padding: 20,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    marginBottom: 40,
    elevation: 8,
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  triggerText: {
    fontSize: 14,
    marginLeft: 8,
    opacity: 0.7,
  },
  reminderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  reminderNotes: {
    fontSize: 16,
    opacity: 0.7,
    marginTop: 8,
  },
  snoozeCount: {
    fontSize: 12,
    marginTop: 12,
    fontStyle: 'italic',
    opacity: 0.6,
  },
  actionContainer: {
    width: '100%',
    maxWidth: 400,
    gap: 16,
  },
  button: {
    width: '100%',
    borderRadius: 12,
  },
  buttonContent: {
    height: 64,
  },
  buttonLabel: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  snoozeButton: {
    backgroundColor: '#FF9800',
  },
  dismissButton: {
    backgroundColor: '#4CAF50',
  },
  quickSnoozeContainer: {
    marginTop: 30,
    width: '100%',
    maxWidth: 400,
  },
  quickSnoozeLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  quickSnoozeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickSnoozeButton: {
    flex: 1,
    borderColor: '#FFFFFF',
  },
  snoozeOptionsContainer: {
    marginTop: 16,
    gap: 12,
  },
  snoozeOptionButton: {
    width: '100%',
  },
});
