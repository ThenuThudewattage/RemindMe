import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { useTheme, ActivityIndicator } from 'react-native-paper';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View } from 'react-native';
import DatabaseService from '../services/db';

function InnerTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        // Respect device safe area so the tab bar doesn't overlap system UI
        tabBarStyle: {
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom ? insets.bottom + 10 : 10,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      {/* Dashboard -> /index */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) =>
            <MaterialCommunityIcons name="home-variant-outline" size={size} color={color} />,
        }}
      />

      {/* Reminders folder - only the list screen will show in tabs */}
      <Tabs.Screen
        name="reminders"
        options={{
          title: 'Reminders',
          tabBarIcon: ({ color, size }) =>
            <MaterialCommunityIcons name="bell-outline" size={size} color={color} />,
        }}
      />

      {/* (Optional) History -> /history */}
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) =>
            <MaterialCommunityIcons name="history" size={size} color={color} />,
        }}
      />

      {/* Settings -> /settings */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) =>
            <MaterialCommunityIcons name="cog-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

export default function RootTabsLayout() {
  const [isDbReady, setIsDbReady] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Starting database initialization...');
        const dbService = DatabaseService.getInstance();
        await dbService.initialize();
        console.log('Database initialized successfully');
        setIsDbReady(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
        // Still allow the app to continue
        setIsDbReady(true);
      }
    };

    initializeApp();
  }, []);

  if (!isDbReady) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <InnerTabs />
    </SafeAreaProvider>
  );
}
