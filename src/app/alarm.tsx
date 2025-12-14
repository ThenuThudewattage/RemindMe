/**
 * ALARM SCREEN
 * 
 * Full-screen alarm interface shown when an alarm triggers
 * Features modern purple gradient with shake-to-snooze
 * 
 * Features:
 * - Full-screen purple gradient theme
 * - Shake device to snooze
 * - Large dismiss and snooze buttons
 * - Shows reminder title and notes
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Text,
  Button,
  useTheme,
  Portal,
  Dialog,
} from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAlarmManager } from '../hooks/useAlarmManager';
import ReminderRepository from '../services/repo';
import { Reminder } from '../types/reminder';
import { Accelerometer } from 'expo-sensors';

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

  // Animation values
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const reminderId = parseInt(params.reminderId as string);
  const reminderTitle = params.reminderTitle as string;
  const triggeredBy = params.triggeredBy as string;

  // Shake detection
  const [subscription, setSubscription] = useState<any>(null);
  const lastShake = useRef(0);
  const SHAKE_THRESHOLD = 2.5;
  const SHAKE_COOLDOWN = 2000;

  useEffect(() => {
    loadReminder();
  }, [reminderId]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    _subscribe();
    return () => _unsubscribe();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        console.log('Back button pressed - alarm must be dismissed or snoozed');
        return true;
      });

      return () => backHandler.remove();
    }
  }, []);

  const _subscribe = () => {
    Accelerometer.setUpdateInterval(100);
    const sub = Accelerometer.addListener(accelerometerData => {
      const { x, y, z } = accelerometerData;
      const acceleration = Math.sqrt(x * x + y * y + z * z);
      
      if (acceleration > SHAKE_THRESHOLD) {
        const now = Date.now();
        if (now - lastShake.current > SHAKE_COOLDOWN) {
          lastShake.current = now;
          _onShake();
        }
      }
    });
    setSubscription(sub);
  };

  const _unsubscribe = () => {
    subscription && subscription.remove();
    setSubscription(null);
  };

  const _onShake = () => {
    console.log('Shake detected!');
    Vibration.vibrate([0, 100, 100, 100]);
    shakeAnimation();
    handleSnooze();
  };

  const loadReminder = async () => {
    try {
      if (reminderId === 999 || isNaN(reminderId)) {
        setReminder(null);
        setLoading(false);
        return;
      }
      
      const repo = ReminderRepository.getInstance();
      const reminderData = await repo.getReminder(reminderId);
      setReminder(reminderData);
    } catch (error) {
      console.error('Failed to load reminder:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleSnooze = async (interval?: number) => {
    try {
      Vibration.vibrate(100);
      await snoozeAlarm(interval || 10);
      router.back();
    } catch (error) {
      console.error('Failed to snooze alarm:', error);
    }
  };

  const handleDismiss = async () => {
    try {
      Vibration.vibrate(100);
      await dismissAlarm();
      router.back();
    } catch (error) {
      console.error('Failed to dismiss alarm:', error);
    }
  };

  const handleShowSnoozeOptions = () => {
    shakeAnimation();
    setShowSnoozeOptions(true);
  };

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
      <View style={styles.container}>
        <LinearGradient
          colors={['#6750A4', '#4a3969', '#1b093bff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { 
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          opacity: fadeAnim,
        }
      ]}
    >
      <LinearGradient
        colors={['#6750A4', '#4a3969', '#1a1a1a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <Animated.View
        style={[
          styles.contentContainer,
          {
            transform: [{ translateX: shakeAnim }],
          },
        ]}
      >
        <Text style={styles.title}>{reminderTitle}</Text>

        {reminder?.notes && (
          <Text style={styles.reminderNotes}>{reminder.notes}</Text>
        )}

        {currentAlarm && currentAlarm.snoozeCount > 0 && (
          <Text style={styles.snoozeCount}>
            Snoozed {currentAlarm.snoozeCount} time(s)
          </Text>
        )}

        <View style={{ flex: 1 }} />
        
        <View style={styles.shakeInstructionContainer}>
          <MaterialCommunityIcons name="vibrate" size={20} color="#FFFFFF" />
          <Text style={styles.shakeInstructionText}>Shake device to snooze</Text>
        </View>

        <View style={styles.actionContainer}>
          <Button
            mode="contained"
            onPress={handleShowSnoozeOptions}
            style={[styles.button, styles.snoozeButton]}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            icon="alarm-snooze"
            buttonColor="rgba(255, 255, 255, 0.2)"
          >
            Snooze
          </Button>

          <Button
            mode="contained"
            onPress={handleDismiss}
            style={[styles.button, styles.dismissButton]}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            icon="check-circle-outline"
            buttonColor="rgba(255, 255, 255, 0.4)"
          >
            Dismiss
          </Button>
        </View>
      </Animated.View>

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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '400',
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 20,
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 10,
    paddingHorizontal: 20,
    marginTop: 40,
  },
  reminderNotes: {
    fontSize: 19,
    marginBottom: 20,
    color: '#FFFFFF',
    opacity: 0.95,
    lineHeight: 28,
    textAlign: 'center',
    paddingHorizontal: 25,
    fontWeight: '500',
  },
  snoozeCount: {
    fontSize: 15,
    marginBottom: 35,
    fontStyle: 'italic',
    color: '#FFFFFF',
    opacity: 0.85,
    textAlign: 'center',
    fontWeight: '500',
  },
  shakeInstructionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 8,
  },
  shakeInstructionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.9,
    letterSpacing: 0.3,
  },
  actionContainer: {
    width: '100%',
    maxWidth: 400,
    gap: 18,
  },
  button: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    overflow: 'hidden',
  },
  buttonContent: {
    height: 68,
  },
  buttonLabel: {
    fontSize: 21,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  snoozeButton: {},
  dismissButton: {},
  snoozeOptionsContainer: {
    marginTop: 16,
    gap: 12,
  },
  snoozeOptionButton: {
    width: '100%',
  },
});
