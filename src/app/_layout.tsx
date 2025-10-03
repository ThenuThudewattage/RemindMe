import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import ReminderRepository from '../services/repo';
import NotificationService from '../services/notifications';
import BackgroundService from '../services/background';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#6366f1',
    primaryContainer: '#e0e7ff',
    secondary: '#10b981',
    secondaryContainer: '#d1fae5',
    error: '#ef4444',
    errorContainer: '#fee2e2',
    background: '#ffffff',
    surface: '#f8fafc',
    surfaceVariant: '#f1f5f9',
  },
};

export default function RootLayout() {
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize repository (database)
      const repo = ReminderRepository.getInstance();
      await repo.initialize();
      console.log('Repository initialized successfully');

      // Initialize notification service
      try {
        const notificationService = NotificationService.getInstance();
        await notificationService.initialize();
        console.log('Notification service initialized successfully');
      } catch (notificationError) {
        console.warn('Notification service failed to initialize (this may be expected in Expo Go):', notificationError);
      }

      // Initialize background service
      try {
        const backgroundService = BackgroundService.getInstance();
        await backgroundService.initialize();
        console.log('Background service initialized successfully');
      } catch (backgroundError) {
        console.warn('Background service failed to initialize (this is expected in Expo Go):', backgroundError);
      }

      console.log('App initialized successfully');
    } catch (error) {
      console.error('Critical app initialization error:', error);
    }
  };

  return (
    <PaperProvider theme={theme}>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen 
          name="reminders/list" 
          options={{ 
            title: 'Reminders',
            headerStyle: { backgroundColor: theme.colors.primary },
            headerTintColor: '#ffffff',
          }} 
        />
        <Stack.Screen 
          name="reminders/edit" 
          options={{ 
            title: 'Edit Reminder',
            headerStyle: { backgroundColor: theme.colors.primary },
            headerTintColor: '#ffffff',
          }} 
        />
        <Stack.Screen 
          name="reminders/detail" 
          options={{ 
            title: 'Reminder Details',
            headerStyle: { backgroundColor: theme.colors.primary },
            headerTintColor: '#ffffff',
          }} 
        />
        <Stack.Screen 
          name="settings" 
          options={{ 
            title: 'Settings',
            headerStyle: { backgroundColor: theme.colors.primary },
            headerTintColor: '#ffffff',
          }} 
        />
      </Stack>
    </PaperProvider>
  );
}