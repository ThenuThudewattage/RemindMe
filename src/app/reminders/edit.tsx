import React, { useState, useEffect } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { useTheme, ActivityIndicator, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ReminderForm } from '../../components/ReminderForm';
import { CreateReminderInput, UpdateReminderInput } from '../../types/reminder';
import ReminderRepository from '../../services/repo';

// 👇 add the preset type we expect from dashboard quick actions
type Preset = 'time' | 'location' | 'battery';

export const href = null; // keep this screen OUT of the bottom tabs

export default function EditReminderScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id?: string; edit?: string; preset?: Preset }>();

  const [loading, setLoading] = useState(false);
  const [initialValues, setInitialValues] = useState<UpdateReminderInput | undefined>();
  const [defaultCreateValues, setDefaultCreateValues] = useState<CreateReminderInput | undefined>();
  const [isEditing, setIsEditing] = useState(false);

  const repo = ReminderRepository.getInstance();

  useEffect(() => {
    initializeScreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeScreen = async () => {
    try {
      const reminderId = params.id;
      const editMode = params.edit === 'true';
      const preset = params.preset as Preset | undefined;

      if (reminderId && editMode) {
        // ===== EDIT FLOW =====
        setLoading(true);
        setIsEditing(true);

        const reminder = await repo.getReminder(parseInt(reminderId, 10));
        if (!reminder) {
          Alert.alert('Error', 'Reminder not found');
          router.back();
          return;
        }
        setInitialValues({
          id: reminder.id,
          title: reminder.title,
          notes: reminder.notes,
          rule: reminder.rule,
          enabled: reminder.enabled,
        });
      } else {
        // ===== CREATE FLOW =====
        setIsEditing(false);

        // Optional: seed defaults if a preset is provided from dashboard quick actions
        if (preset) {
          setDefaultCreateValues(buildDefaultsForPreset(preset));
        } else {
          // leave undefined; the form will start empty
          setDefaultCreateValues(undefined);
        }
      }
    } catch (error) {
      console.error('Error loading reminder:', error);
      Alert.alert('Error', 'Failed to load reminder');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  // ---- Helpers ----

  // Create lightweight defaults per preset WITHOUT touching your services schema beyond common fields.
  // Adjust rule shape if your `rule` schema differs (time/location/battery keys, etc.).
  function buildDefaultsForPreset(preset: Preset): CreateReminderInput {
    const now = new Date();
    return {
      title:
        preset === 'time'
          ? 'New time-based reminder'
          : preset === 'location'
          ? 'New location-based reminder'
          : 'New battery-based reminder',
      notes: '',
      enabled: true,
      rule: {
        logic: 'AND', // or whatever your engine expects
        time:
          preset === 'time'
            ? { kind: 'at', at: now.toISOString() } // change to your exact shape
            : null,
        location:
          preset === 'location'
            ? { mode: 'enter', radius: 200, name: '', lat: null, lon: null } // adjust to your schema
            : null,
        battery:
          preset === 'battery'
            ? { comparator: 'below', level: 20, charging: false } // adjust to your schema
            : null,
      } as any,
    };
  }

  // ---- Handlers ----

  const handleSubmit = async (data: CreateReminderInput | UpdateReminderInput) => {
    try {
      if (isEditing && 'id' in data) {
        await repo.updateReminder(data as UpdateReminderInput);
        Alert.alert('Success', 'Reminder updated successfully');
      } else {
        await repo.createReminder(data as CreateReminderInput);
        Alert.alert('Success', 'Reminder created successfully');
      }
      router.back();
    } catch (error) {
      console.error('Error saving reminder:', error);
      Alert.alert('Error', 'Failed to save reminder');
    }
  };

  const handleCancel = () => router.back();

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge" style={{ marginTop: 16, opacity: 0.7 }}>
          Loading reminder...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ReminderForm
        initialValues={initialValues}                // for EDIT
        defaultCreateValues={defaultCreateValues}    // for CREATE with preset
        preset={(params.preset as Preset) || undefined} // allow form to jump to step
        isEditing={isEditing}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
