import React, { useEffect, useState, useRef } from 'react';
import { Tabs } from 'expo-router';
import { PaperProvider, ActivityIndicator } from 'react-native-paper';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Platform, AppState } from 'react-native';
import { StatusBar, setStatusBarStyle, setStatusBarBackgroundColor } from 'expo-status-bar';
import DatabaseService from '../services/db';
import { BRAND } from '../theme';
import { ThemeProvider, useAppTheme } from '../contexts/ThemeContext';

function InnerTabs() {
  const { theme, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom ? insets.bottom + 10 : 10,
          paddingTop: 6,
          borderTopColor: theme.colors.outline,
          borderTopWidth: 0.5,
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

      {/* Hide map-picker from tabs - it's a utility screen accessed from other screens */}
      <Tabs.Screen
        name="map-picker"
        options={{
          href: null,
        }}
      />

      {/* Hide alarm screen from tabs - it's a utility screen accessed when an alarm triggers */}
      <Tabs.Screen
        name="alarm"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

function RootTabsContent() {
  const [isDbReady, setIsDbReady] = useState(false);
  const { theme, isDark } = useAppTheme();
  const appState = useRef(AppState.currentState);

  // Function to ensure status bar stays purple
  const ensureStatusBar = () => {
    setStatusBarStyle(isDark ? 'light' : 'light');
    if (Platform.OS === 'android') {
      setStatusBarBackgroundColor(BRAND.purple, false);
    }
  };

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

    // Ensure status bar is set initially
    ensureStatusBar();

    // Listen for app state changes to restore status bar
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground - restore status bar
        console.log('App returned to foreground - restoring status bar');
        ensureStatusBar();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (!isDbReady) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <StatusBar style="light" backgroundColor={BRAND.purple} />
          <View style={{ flex: 1, justifyContent: 'flex-start', alignItems: 'center', backgroundColor: theme.colors.background }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        </PaperProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar style="light" backgroundColor={BRAND.purple} />
        <InnerTabs />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

export default function RootTabsLayout() {
  return (
    <ThemeProvider>
      <RootTabsContent />
    </ThemeProvider>
  );
}
