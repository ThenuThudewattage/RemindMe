import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useTheme, ActivityIndicator, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ReminderForm } from '../../components/ReminderForm';
import { CreateReminderInput, UpdateReminderInput, Reminder } from '../../types/reminder';
import ReminderRepository from '../../services/repo';

export default function EditReminderScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [initialValues, setInitialValues] = useState<UpdateReminderInput | undefined>();
  const [isEditing, setIsEditing] = useState(false);

  const repo = ReminderRepository.getInstance();

  useEffect(() => {
    initializeScreen();
  }, []);

  const initializeScreen = async () => {
    try {
      const reminderId = params.id as string;
      const editMode = params.edit as string;
      
      if (reminderId && editMode === 'true') {
        setLoading(true);
        setIsEditing(true);
        
        const reminder = await repo.getReminder(parseInt(reminderId));
        if (reminder) {
          setInitialValues({
            id: reminder.id,
            title: reminder.title,
            notes: reminder.notes,
            rule: reminder.rule,
            enabled: reminder.enabled,
          });
        } else {
          Alert.alert('Error', 'Reminder not found');
          router.back();
        }
      } else {
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error loading reminder:', error);
      Alert.alert('Error', 'Failed to load reminder');
      router.back();
    } finally {
      setLoading(false);
    }
  };

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

  const handleCancel = () => {
    router.back();
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Loading reminder...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ReminderForm
        initialValues={initialValues}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isEditing={isEditing}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    opacity: 0.7,
  },
});