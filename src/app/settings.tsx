import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
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
  DataTable
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackgroundService from '../services/background';
import ReminderRepository from '../services/repo';
import { Reminder, ReminderEvent } from '../types/reminder';

export default function SettingsScreen() {
  const theme = useTheme();
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
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Loading settings...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
});