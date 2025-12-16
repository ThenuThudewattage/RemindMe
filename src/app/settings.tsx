import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Linking, ImageBackground } from 'react-native';
import { 
  Text, 
  Card, 
  List, 
  Switch, 
  Button, 
  useTheme,
  ActivityIndicator,
  Chip,
  Divider,
  DataTable,
  IconButton,
  RadioButton
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import BackgroundService from '../services/background';
import ReminderRepository from '../services/repo';
import DatabaseService from '../services/db';
import { Reminder, ReminderEvent } from '../types/reminder';
import { BRAND, space } from '../theme';
import { useAppTheme } from '../contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';

export default function SettingsScreen() {
  const theme = useTheme();
  const { themeMode, setThemeMode, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState({
    backgroundFetch: false,
    location: false,
    notifications: false,
  });
  const [backgroundTasksActive, setBackgroundTasksActive] = useState(false);
  const [stats, setStats] = useState({
    totalReminders: 0,
    activeReminders: 0,
    totalEvents: 0,
  });
  const [showDatabase, setShowDatabase] = useState(false);
  const [dbReminders, setDbReminders] = useState<Reminder[]>([]);
  const [dbEvents, setDbEvents] = useState<ReminderEvent[]>([]);

  const backgroundService = BackgroundService.getInstance();
  const repo = ReminderRepository.getInstance();

  const goReminders = () => router.push('/reminders/list');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Initialize database first
      await repo.initialize();
      
      // Add a small delay to ensure initialization is complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Load permissions
      const permissionStatus = await backgroundService.checkBackgroundPermissions();
      setPermissions(permissionStatus);
      
      // Check if background tasks are active
      const isActive = backgroundService.isBackgroundFetchRegistered();
      setBackgroundTasksActive(isActive);
      
      // Load statistics
      const [allReminders, activeReminders, recentEvents] = await Promise.all([
        repo.getAllReminders(),
        repo.getActiveReminders(),
        repo.getRecentEvents(100),
      ]);
      
      setStats({
        totalReminders: allReminders.length,
        activeReminders: activeReminders.length,
        totalEvents: recentEvents.length,
      });
      
      // Store data for database viewer
      setDbReminders(allReminders);
      setDbEvents(recentEvents);
    } catch (error) {
      console.error('Error loading settings:', error);
      
      // Set empty data on error to prevent crashes
      setStats({
        totalReminders: 0,
        activeReminders: 0,
        totalEvents: 0,
      });
      setDbReminders([]);
      setDbEvents([]);
      
      // Show user-friendly error if it's a database issue
      if (error instanceof Error && error.message.includes('Database not initialized')) {
        Alert.alert(
          'Loading Error',
          'Database is still initializing. Please wait a moment and try again.',
          [
            { text: 'Cancel' },
            { text: 'Retry', onPress: () => setTimeout(loadSettings, 1000) }
          ]
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPermissions = async () => {
    try {
      const result = await backgroundService.requestAllPermissions();
      setPermissions(result);
      
      if (result.backgroundFetch && result.location && result.notifications) {
        Alert.alert('Success', 'All permissions granted successfully!');
      } else {
        Alert.alert(
          'Partial Success',
          'Some permissions were not granted. The app may not work as expected. Please check your device settings.'
        );
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'Failed to request permissions');
    }
  };

  const handleToggleBackgroundTasks = async (enabled: boolean) => {
    try {
      if (enabled) {
        await backgroundService.startAllBackgroundTasks();
        Alert.alert('Success', 'Background tasks started successfully');
      } else {
        await backgroundService.stopAllBackgroundTasks();
        Alert.alert('Success', 'Background tasks stopped');
      }
      setBackgroundTasksActive(enabled);
    } catch (error) {
      console.error('Error toggling background tasks:', error);
      Alert.alert('Error', 'Failed to toggle background tasks');
    }
  };

  const handleCleanupOldEvents = async () => {
    Alert.alert(
      'Clean Up Events',
      'This will remove events older than 30 days. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cleanup',
          style: 'destructive',
          onPress: async () => {
            try {
              await repo.cleanupOldEvents(30);
              await loadSettings(); // Refresh stats
              Alert.alert('Success', 'Old events cleaned up successfully');
            } catch (error) {
              console.error('Error cleaning up events:', error);
              Alert.alert('Error', 'Failed to cleanup old events');
            }
          },
        },
      ]
    );
  };

  const handleOpenAppSettings = () => {
    Linking.openSettings();
  };

  const resetDatabase = async () => {
    Alert.alert(
      'Reset Database',
      'This will delete all reminders and start fresh. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const dbService = DatabaseService.getInstance();
              await dbService.resetDatabase();
              await dbService.initialize();
              await loadSettings(); // Refresh data
              Alert.alert('Success', 'Database has been reset successfully.');
            } catch (error) {
              console.error('Failed to reset database:', error);
              Alert.alert('Error', 'Failed to reset database. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const getPermissionStatus = (granted: boolean) => (
    <Chip 
      selected={granted}
      style={[styles.statusChip, { backgroundColor: granted ? theme.colors.primaryContainer : theme.colors.errorContainer }]}
    >
      {granted ? 'Granted' : 'Denied'}
    </Chip>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Loading settings...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      {/* HERO SECTION */}
      <ImageBackground
        source={{
          uri:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAADICAYAAADpAq3lAAAACXBIWXMAAAsSAAALEgHS3X78AAAAG0lEQVQ4y2NgYGBg+P//PwMDA0YwGJgYwJgBAA9bB3S6qf4yAAAAAElFTkSuQmCC',
        }}
        resizeMode="cover"
        style={[styles.hero, { backgroundColor: BRAND.purple }]}
        imageStyle={{ opacity: 0.15 }}
      >
        <View style={styles.heroTopRow}>
          <Text variant="headlineLarge" style={styles.brandTitle}>RemindMe+</Text>
          <IconButton icon="bell-outline" iconColor="white" size={24} onPress={goReminders} />
        </View>
      </ImageBackground>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Permissions Card */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Permissions
            </Text>
            
            <List.Item
              title="Location"
              description="Required for location-based reminders"
              right={() => getPermissionStatus(permissions.location)}
              left={(props) => <List.Icon {...props} icon="map-marker" />}
              style={styles.listItem}
            />
            
            <List.Item
              title="Notifications"
              description="Required to show reminder alerts"
              right={() => getPermissionStatus(permissions.notifications)}
              left={(props) => <List.Icon {...props} icon="bell" />}
              style={styles.listItem}
            />
            
            <List.Item
              title="Background App Refresh"
              description="Required for background processing"
              right={() => getPermissionStatus(permissions.backgroundFetch)}
              left={(props) => <List.Icon {...props} icon="refresh" />}
              style={styles.listItem}
            />
            
            <View style={styles.permissionActions}>
              <Button
                mode="contained"
                onPress={handleRequestPermissions}
                style={styles.permissionButton}
              >
                Request Permissions
              </Button>
              <Button
                mode="outlined"
                onPress={handleOpenAppSettings}
                style={styles.permissionButton}
              >
                Open Settings
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Appearance Card */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Appearance
            </Text>
            
            <RadioButton.Group onValueChange={value => setThemeMode(value as any)} value={themeMode}>
              <List.Item
                title="Light Mode"
                description="Always use light theme"
                left={(props) => <List.Icon {...props} icon="white-balance-sunny" />}
                right={() => <RadioButton value="light" />}
                onPress={() => setThemeMode('light')}
              />
              
              <List.Item
                title="Dark Mode"
                description="Always use dark theme"
                left={(props) => <List.Icon {...props} icon="moon-waning-crescent" />}
                right={() => <RadioButton value="dark" />}
                onPress={() => setThemeMode('dark')}
              />
              
              <List.Item
                title="Auto (System)"
                description="Follow system theme settings"
                left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
                right={() => <RadioButton value="auto" />}
                onPress={() => setThemeMode('auto')}
              />
            </RadioButton.Group>
            
            <View style={styles.themePreview}>
              <Chip icon="check-circle" style={{ backgroundColor: theme.colors.primaryContainer }}>
                Current: {isDark ? 'Dark' : 'Light'} Theme
              </Chip>
            </View>
          </Card.Content>
        </Card>

        {/* Background Tasks Card */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Background Processing
            </Text>
            
            <List.Item
              title="Background Tasks"
              description={backgroundTasksActive ? 
                "Background monitoring is active" : 
                "Background monitoring is inactive"
              }
              right={() => (
                <Switch
                  value={backgroundTasksActive}
                  onValueChange={handleToggleBackgroundTasks}
                />
              )}
              left={(props) => <List.Icon {...props} icon="cog" />}
            />
            
            <Text variant="bodySmall" style={styles.backgroundNote}>
              Background tasks monitor location, battery, and time conditions even when the app is closed.
            </Text>
          </Card.Content>
        </Card>

        {/* Statistics Card */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Statistics
            </Text>
            
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statNumber}>
                  {stats.totalReminders}
                </Text>
                <Text variant="bodyMedium" style={styles.statLabel}>
                  Total Reminders
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statNumber}>
                  {stats.activeReminders}
                </Text>
                <Text variant="bodyMedium" style={styles.statLabel}>
                  Active Reminders
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statNumber}>
                  {stats.totalEvents}
                </Text>
                <Text variant="bodyMedium" style={styles.statLabel}>
                  Recent Events
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Maintenance Card */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Maintenance
            </Text>
            
            <List.Item
              title="Clean Up Old Events"
              description="Remove events older than 30 days"
              onPress={handleCleanupOldEvents}
              left={(props) => <List.Icon {...props} icon="delete-sweep" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
            />
          </Card.Content>
        </Card>

        {/* Database Viewer Card */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Database Viewer
            </Text>
            
            <List.Item
              title="View Database Tables"
              description="Show reminders and events data"
              onPress={() => setShowDatabase(!showDatabase)}
              left={(props) => <List.Icon {...props} icon="database" />}
              right={(props) => <List.Icon {...props} icon={showDatabase ? "chevron-up" : "chevron-down"} />}
            />
            
            {showDatabase && (
              <View style={{ marginTop: 16 }}>
                <Text variant="titleSmall" style={{ marginBottom: 8 }}>Reminders Table</Text>
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title>ID</DataTable.Title>
                    <DataTable.Title>Title</DataTable.Title>
                    <DataTable.Title>Enabled</DataTable.Title>
                    <DataTable.Title>Created</DataTable.Title>
                  </DataTable.Header>
                  {dbReminders.map((reminder) => (
                    <DataTable.Row key={reminder.id}>
                      <DataTable.Cell>{reminder.id}</DataTable.Cell>
                      <DataTable.Cell>{reminder.title}</DataTable.Cell>
                      <DataTable.Cell>{reminder.enabled ? 'Yes' : 'No'}</DataTable.Cell>
                      <DataTable.Cell>{new Date(reminder.createdAt).toLocaleDateString()}</DataTable.Cell>
                    </DataTable.Row>
                  ))}
                  {dbReminders.length === 0 && (
                    <DataTable.Row>
                      <DataTable.Cell>No reminders found</DataTable.Cell>
                    </DataTable.Row>
                  )}
                </DataTable>
                
                <Text variant="titleSmall" style={{ marginTop: 16, marginBottom: 8 }}>Events Table</Text>
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title>ID</DataTable.Title>
                    <DataTable.Title>Reminder ID</DataTable.Title>
                    <DataTable.Title>Type</DataTable.Title>
                    <DataTable.Title>Created</DataTable.Title>
                  </DataTable.Header>
                  {dbEvents.map((event) => (
                    <DataTable.Row key={event.id}>
                      <DataTable.Cell>{event.id}</DataTable.Cell>
                      <DataTable.Cell>{event.reminderId}</DataTable.Cell>
                      <DataTable.Cell>{event.type}</DataTable.Cell>
                      <DataTable.Cell>{new Date(event.createdAt).toLocaleDateString()}</DataTable.Cell>
                    </DataTable.Row>
                  ))}
                  {dbEvents.length === 0 && (
                    <DataTable.Row>
                      <DataTable.Cell>No events found</DataTable.Cell>
                    </DataTable.Row>
                  )}
                </DataTable>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Debug Actions Card */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Debug Actions
            </Text>
            
            <Text variant="bodyMedium" style={styles.aboutText}>
              Use these actions for debugging database issues.
            </Text>
            
            <Button
              mode="contained-tonal"
              onPress={resetDatabase}
              style={{ marginTop: 12 }}
              icon="database-refresh"
            >
              Reset Database
            </Button>
          </Card.Content>
        </Card>

        {/* About Card */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              About RemindMe+
            </Text>
            
            <Text variant="bodyMedium" style={styles.aboutText}>
              RemindMe+ is a smart reminder app that uses location, time, and battery conditions 
              to deliver contextually relevant notifications. All data is stored locally on your device.
            </Text>
            
            <Text variant="labelSmall" style={styles.versionText}>
              Version 1.0.0
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: space(2),
    paddingTop: space(2),
    paddingBottom: space(2),
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandTitle: {
    color: 'white',
    fontWeight: '800',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    opacity: 0.7,
  },
  content: {
    flex: 1,
  },
  card: {
    margin: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: '600',
  },
  listItem: {
    paddingHorizontal: 0,
  },
  statusChip: {
    alignSelf: 'center',
  },
  permissionActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  permissionButton: {
    flex: 1,
  },
  backgroundNote: {
    marginTop: 8,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  themePreview: {
    marginTop: 16,
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontWeight: 'bold',
  },
  statLabel: {
    marginTop: 4,
    opacity: 0.7,
    textAlign: 'center',
  },
  aboutText: {
    lineHeight: 22,
    marginBottom: 16,
  },
  versionText: {
    opacity: 0.5,
    textAlign: 'center',
  },
  sliderContainer: {
    marginVertical: 8,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderHints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  },
});