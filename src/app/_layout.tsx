import React, { useEffect, useState, useRef } from 'react';
import { Tabs } from 'expo-router';
import { PaperProvider, ActivityIndicator } from 'react-native-paper';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Platform, AppState } from 'react-native';
import { StatusBar, setStatusBarStyle, setStatusBarBackgroundColor } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { app } from '../config/firebase';
import DatabaseService from '../services/db';
import BackgroundService from '../services/background';
import { BRAND } from '../theme';
import { ThemeProvider, useAppTheme } from '../contexts/ThemeContext';
import ContextEngine from '../services/contextEngine';

function InnerTabs() {
  const { theme, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarStyle: {
          backgroundColor: isDark ? '#0A0A0A' : theme.colors.surface,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom ? insets.bottom + 10 : 10,
          paddingTop: 6,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
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

  // Function to ensure status bar and navigation bar stay themed
  const ensureStatusBar = async () => {
    setStatusBarStyle('light');
    if (Platform.OS === 'android') {
      setStatusBarBackgroundColor(isDark ? '#4a3969' : BRAND.purple, false);
      
      // Set navigation bar color
      try {
        const navColor = isDark ? '#0A0A0A' : '#FFFFFF';
        console.log('Setting navigation bar to:', navColor, 'isDark:', isDark);
        await NavigationBar.setVisibilityAsync('visible');
        await NavigationBar.setBackgroundColorAsync(navColor);
        await NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
      } catch (error) {
        console.log('Navigation bar styling error:', error);
      }
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Starting database initialization...');
        const dbService = DatabaseService.getInstance();
        await dbService.initialize();
        console.log('Database initialized successfully');
        
        // Initialize Firebase Authentication
        console.log('Initializing Firebase Authentication...');
        const auth = getAuth(app);
        
        // Sign in anonymously for Firebase Cloud Functions
        onAuthStateChanged(auth, (user) => {
          if (user) {
            console.log('User authenticated:', user.uid);
          } else {
            console.log('Signing in anonymously...');
            signInAnonymously(auth)
              .then(() => {
                console.log('Anonymous sign-in successful');
              })
              .catch((error) => {
                console.error('Anonymous sign-in error:', error);
              });
          }
        });
        // Initialize background service after database is ready
        console.log('Starting background service initialization...');
        const backgroundService = BackgroundService.getInstance();
        await backgroundService.initialize();
        console.log('✅ Background service initialized successfully');
        
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

  // Update navigation bar when theme changes
  useEffect(() => {
    ensureStatusBar();
  }, [isDark]);

  // Foreground condition checker - checks reminders every 30 seconds
  useEffect(() => {
    if (!isDbReady) return;

    console.log('🔄 Starting foreground condition checker');
    const contextEngine = ContextEngine.getInstance();
    
    // Check immediately
    contextEngine.checkAllConditions().catch(err => {
      console.error('❌ Error in initial condition check:', err);
    });

    // Check every 30 seconds
    const intervalId = setInterval(async () => {
      console.log('⏰ Foreground check: Evaluating reminders...');
      try {
        await contextEngine.checkAllConditions();
      } catch (error) {
        console.error('❌ Error in foreground check:', error);
      }
    }, 30000);

    return () => {
      console.log('🛑 Stopping foreground condition checker');
      clearInterval(intervalId);
    };
  }, [isDbReady]);

  // Handle notification responses (when user taps notification)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      // If it's an alarm notification, navigate to alarm screen
      if (data.type === 'alarm' && data.reminderId) {
        console.log('🔔 Alarm notification tapped, opening alarm screen');
        router.push({
          pathname: '/alarm',
          params: {
            reminderId: String(data.reminderId),
            reminderTitle: String(data.reminderTitle || 'Alarm'),
            triggeredBy: String(data.triggeredBy || 'time'),
          },
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (!isDbReady) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <StatusBar style="light" backgroundColor={isDark ? '#4a3969' : BRAND.purple} />
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
        <StatusBar style="light" backgroundColor={isDark ? '#4a3969' : BRAND.purple} />
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
