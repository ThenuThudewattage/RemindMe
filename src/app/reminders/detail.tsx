import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { 
  Text, 
  Card, 
  Chip, 
  Button, 
  useTheme,
  ActivityIndicator,
  Divider,
  List
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import { Reminder, ReminderEvent } from '../../types/reminder';
import ReminderRepository from '../../services/repo';
import GeofencingService from '../../features/geofencing/service';

export default function ReminderDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [events, setEvents] = useState<ReminderEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const repo = ReminderRepository.getInstance();

  useEffect(() => {
    loadReminderDetails();
  }, []);

  const loadReminderDetails = async () => {
    try {
      const reminderId = parseInt(params.id as string);
      
      const [reminderData, eventsData] = await Promise.all([
        repo.getReminder(reminderId),
        repo.getReminderEvents(reminderId)
      ]);

      if (reminderData) {
        setReminder(reminderData);
        setEvents(eventsData);
      } else {
        router.back();
      }
    } catch (error) {
      console.error('Error loading reminder details:', error);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    if (reminder) {
      router.push({
        pathname: '/reminders/edit',
        params: { 
          id: reminder.id.toString(),
          edit: 'true'
        }
      });
    }
  };

  const handleSimulateEnter = async () => {
    if (!reminder?.locationTrigger) return;
    
    try {
      const geofencingService = GeofencingService.getInstance();
      await geofencingService.simulateGeofenceEvent(reminder.id.toString(), 'enter');
      
      // Reload events to show the new event
      setTimeout(() => loadReminderDetails(), 1000);
    } catch (error) {
      console.error('Failed to simulate geofence enter event:', error);
    }
  };

  const handleSimulateExit = async () => {
    if (!reminder?.locationTrigger) return;
    
    try {
      const geofencingService = GeofencingService.getInstance();
      await geofencingService.simulateGeofenceEvent(reminder.id.toString(), 'exit');
      
      // Reload events to show the new event
      setTimeout(() => loadReminderDetails(), 1000);
    } catch (error) {
      console.error('Failed to simulate geofence exit event:', error);
    }
  };

  const formatRuleDetails = (reminder: Reminder) => {
    const details: string[] = [];
    
    if (reminder.rule.time) {
      if (reminder.rule.time.start && reminder.rule.time.end) {
        const start = format(new Date(reminder.rule.time.start), 'MMM d, yyyy HH:mm');
        const end = format(new Date(reminder.rule.time.end), 'MMM d, yyyy HH:mm');
        details.push(`Time: ${start} to ${end}`);
      } else if (reminder.rule.time.start) {
        const start = format(new Date(reminder.rule.time.start), 'MMM d, yyyy HH:mm');
        details.push(`Time: After ${start}`);
      } else if (reminder.rule.time.end) {
        const end = format(new Date(reminder.rule.time.end), 'MMM d, yyyy HH:mm');
        details.push(`Time: Before ${end}`);
      }
    }
    
    if (reminder.rule.location) {
      details.push(`Location: ${reminder.rule.location.lat.toFixed(6)}, ${reminder.rule.location.lon.toFixed(6)}`);
      details.push(`Radius: ${reminder.rule.location.radius}m`);
    }
    
    if (reminder.rule.battery) {
      if (reminder.rule.battery.min !== undefined && reminder.rule.battery.max !== undefined) {
        details.push(`Battery: ${reminder.rule.battery.min}% - ${reminder.rule.battery.max}%`);
      } else if (reminder.rule.battery.min !== undefined) {
        details.push(`Battery: Above ${reminder.rule.battery.min}%`);
      } else if (reminder.rule.battery.max !== undefined) {
        details.push(`Battery: Below ${reminder.rule.battery.max}%`);
      }
    }
    
    if (reminder.rule.options?.repeat && reminder.rule.options.repeat !== 'none') {
      details.push(`Repeat: ${reminder.rule.options.repeat}`);
    }
    
    if (reminder.rule.options?.cooldownMins) {
      details.push(`Cooldown: ${reminder.rule.options.cooldownMins} minutes`);
    }
    
    return details;
  };

  const getEventIcon = (type: ReminderEvent['type']) => {
    switch (type) {
      case 'triggered':
        return 'bell';
      case 'snoozed':
        return 'sleep';
      case 'completed':
        return 'check';
      case 'dismissed':
        return 'close';
      default:
        return 'information';
    }
  };

  const getEventColor = (type: ReminderEvent['type']) => {
    switch (type) {
      case 'triggered':
        return theme.colors.primary;
      case 'snoozed':
        return theme.colors.secondary;
      case 'completed':
        return '#10b981';
      case 'dismissed':
        return theme.colors.error;
      default:
        return theme.colors.onSurface;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Loading reminder details...
        </Text>
      </View>
    );
  }

  if (!reminder) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <Text variant="headlineSmall">Reminder not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header Card */}
        <Card style={[
          styles.card,
          !theme.dark && { backgroundColor: '#FFFFFF' },
          theme.dark && {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
          },
        ]} mode="elevated">
          <Card.Content>
            <View style={styles.header}>
              <Text variant="headlineSmall" style={[styles.title, theme.dark && { color: '#FFFFFF' }]}>
                {reminder.title}
              </Text>
              <Chip 
                selected={reminder.enabled}
                style={styles.statusChip}
              >
                {reminder.enabled ? 'Active' : 'Disabled'}
              </Chip>
            </View>
            
            {reminder.notes && (
              <Text variant="bodyMedium" style={[styles.notes, theme.dark && { color: '#B8B8B8' }]}>
                {reminder.notes}
              </Text>
            )}
            
            <View style={styles.metadata}>
              <Text variant="labelSmall" style={[styles.metadataText, theme.dark && { color: '#B8B8B8' }]}>
                Created: {format(new Date(reminder.createdAt), 'MMM d, yyyy HH:mm')}
              </Text>
              <Text variant="labelSmall" style={[styles.metadataText, theme.dark && { color: '#B8B8B8' }]}>
                Updated: {format(new Date(reminder.updatedAt), 'MMM d, yyyy HH:mm')}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Conditions Card */}
        <Card style={[
          styles.card,
          !theme.dark && { backgroundColor: '#FFFFFF' },
          theme.dark && {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
          },
        ]} mode="elevated">
          <Card.Content>
            <Text variant="titleMedium" style={[styles.sectionTitle, theme.dark && { color: '#FFFFFF' }]}>
              Conditions
            </Text>
            
            {formatRuleDetails(reminder).length > 0 ? (
              formatRuleDetails(reminder).map((detail, index) => (
                <Text key={index} variant="bodyMedium" style={[styles.detailText, theme.dark && { color: '#B8B8B8' }]}>
                  • {detail}
                </Text>
              ))
            ) : (
              <Text variant="bodyMedium" style={[styles.noConditions, theme.dark && { color: '#B8B8B8' }]}>
                No conditions set
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* History Card */}
        <Card style={[
          styles.card,
          !theme.dark && { backgroundColor: '#FFFFFF' },
          theme.dark && {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
          },
        ]} mode="elevated">
          <Card.Content>
            <Text variant="titleMedium" style={[styles.sectionTitle, theme.dark && { color: '#FFFFFF' }]}>
              History ({events.length} events)
            </Text>
            
            {events.length > 0 ? (
              events.map((event, index) => (
                <View key={event.id}>
                  <List.Item
                    title={event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                    description={format(new Date(event.createdAt), 'MMM d, yyyy HH:mm:ss')}
                    left={(props) => (
                      <List.Icon 
                        {...props} 
                        icon={getEventIcon(event.type)}
                        color={getEventColor(event.type)}
                      />
                    )}
                    style={styles.eventItem}
                  />
                  {index < events.length - 1 && <Divider />}
                </View>
              ))
            ) : (
              <Text variant="bodyMedium" style={[styles.noEvents, theme.dark && { color: '#B8B8B8' }]}>
                No events recorded yet
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Development Testing Section */}
        {reminder.locationTrigger?.enabled && __DEV__ && (
          <Card style={[
            styles.card,
            !theme.dark && { backgroundColor: '#FFFFFF' },
            theme.dark && {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.1)',
            },
          ]} mode="elevated">
            <Card.Content>
              <Text variant="titleMedium" style={[styles.sectionTitle, theme.dark && { color: '#FFFFFF' }]}>
                Testing (Development Only)
              </Text>
              
              <Text variant="bodySmall" style={[styles.testingNote, theme.dark && { color: '#B8B8B8' }]}>
                Simulate geofence events to test notifications
              </Text>
              
              <View style={styles.testingActions}>
                <Button
                  mode="elevated"
                  onPress={handleSimulateEnter}
                  style={styles.testButton}
                  icon="location-enter"
                >
                  Simulate Enter
                </Button>
                <Button
                  mode="elevated"
                  onPress={handleSimulateExit}
                  style={styles.testButton}
                  icon="location-exit"
                >
                  Simulate Exit
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={handleEdit}
            style={styles.editButton}
            contentStyle={styles.buttonContent}
          >
            Edit Reminder
          </Button>
        </View>
      </ScrollView>
    </View>
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
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    flex: 1,
    marginRight: 16,
    fontWeight: '600',
  },
  statusChip: {
    alignSelf: 'flex-start',
  },
  notes: {
    marginBottom: 16,
    fontStyle: 'italic',
  },
  metadata: {
    gap: 4,
  },
  metadataText: {
    opacity: 0.7,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: '600',
  },
  conditionItem: {
    marginBottom: 4,
    lineHeight: 20,
  },
  detailText: {
    marginBottom: 8,
  },
  noConditions: {
    opacity: 0.7,
    fontStyle: 'italic',
  },
  eventItem: {
    paddingHorizontal: 0,
  },
  noEvents: {
    opacity: 0.7,
    fontStyle: 'italic',
  },
  actions: {
    padding: 16,
    paddingTop: 8,
  },
  editButton: {
    marginBottom: 16,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  testingNote: {
    marginBottom: 16,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  testingActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  testButton: {
    flex: 1,
  },
});