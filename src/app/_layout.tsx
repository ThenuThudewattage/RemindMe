import React from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
  return (
    <SafeAreaProvider>
      <InnerTabs />
    </SafeAreaProvider>
  );
}
