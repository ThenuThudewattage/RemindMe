import React from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function RootTabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarStyle: { height: 60, paddingBottom: 10, paddingTop: 6 },
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
