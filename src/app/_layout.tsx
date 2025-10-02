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

      // Initialize notification service
      const notificationService = NotificationService.getInstance();
      await notificationService.initialize();

      // Initialize background service
      const backgroundService = BackgroundService.getInstance();
      await backgroundService.initialize();

      console.log('App initialized successfully');
    } catch (error) {
      console.error('Failed to initialize app:', error);
    }
  };

  return (
    <PaperProvider theme={theme}>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen 
          name="list" 
          options={{ 
            title: 'Reminders',
            headerStyle: { backgroundColor: theme.colors.primary },
            headerTintColor: '#ffffff',
          }} 
        />
        <Stack.Screen 
          name="edit" 
          options={{ 
            title: 'Edit Reminder',
            headerStyle: { backgroundColor: theme.colors.primary },
            headerTintColor: '#ffffff',
          }} 
        />
        <Stack.Screen 
          name="detail" 
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