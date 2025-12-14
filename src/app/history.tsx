import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { Text, Card, IconButton, useTheme, Chip, Avatar, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { space } from '../theme';
import ReminderRepository from '../services/repo';
import { ReminderEvent, Reminder } from '../types/reminder';
import { format } from 'date-fns';
import { useCallback } from 'react';

interface EnrichedEvent extends ReminderEvent {
  reminderTitle: string;
  reminderNotes?: string;
  isDeleted: boolean;
  conditions?: string;
}

export default function HistoryScreen() {
  const theme = useTheme();
  const [events, setEvents] = useState<EnrichedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const formatRuleDescription = (reminder: Reminder): string => {
    const conditions: string[] = [];
    
    if (reminder.rule.time) {
      if (reminder.rule.time.start && reminder.rule.time.end) {
        const start = format(new Date(reminder.rule.time.start), 'MMM d, HH:mm');
        const end = format(new Date(reminder.rule.time.end), 'MMM d, HH:mm');
        conditions.push(`Between ${start} and ${end}`);
      } else if (reminder.rule.time.start) {
        const start = format(new Date(reminder.rule.time.start), 'MMM d, HH:mm');
        conditions.push(`After ${start}`);
      } else if (reminder.rule.time.end) {
        const end = format(new Date(reminder.rule.time.end), 'MMM d, HH:mm');
        conditions.push(`Before ${end}`);
      }
    }
    
    if (reminder.rule.location) {
      conditions.push(`Within ${reminder.rule.location.radius}m of location`);
    }
    
    if (reminder.rule.battery) {
      if (reminder.rule.battery.min !== undefined && reminder.rule.battery.max !== undefined) {
        conditions.push(`Battery ${reminder.rule.battery.min}%-${reminder.rule.battery.max}%`);
      } else if (reminder.rule.battery.min !== undefined) {
        conditions.push(`Battery above ${reminder.rule.battery.min}%`);
      } else if (reminder.rule.battery.max !== undefined) {
        conditions.push(`Battery below ${reminder.rule.battery.max}%`);
      }
    }
    
    return conditions.length > 0 ? conditions.join(' • ') : 'No conditions';
  };

  const loadHistory = async () => {
    try {
      const repo = ReminderRepository.getInstance();
      const recentEvents = await repo.getRecentEvents(50); // Get last 50 events
      
      // Enrich events with reminder details
      const enrichedEvents = await Promise.all(
        recentEvents.map(async (event) => {
          const reminder = await repo.getReminder(event.reminderId);
          const isDeleted = !reminder;
          
          return {
            ...event,
            reminderTitle: event.reminderTitle || reminder?.title || `Reminder #${event.reminderId}`,
            reminderNotes: reminder?.notes,
            isDeleted,
            conditions: reminder ? formatRuleDescription(reminder) : undefined
          };
        })
      );
      
      setEvents(enrichedEvents);
    } catch (error) {
      console.error('Failed to load reminder history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHistory();
    
    // Auto-refresh every 5 seconds to show real-time updates
    const interval = setInterval(() => {
      loadHistory();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to delete all event history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: async () => {
            try {
              const repo = ReminderRepository.getInstance();
              await repo.clearAllHistory();
              setEvents([]);
            } catch (error) {
              console.error('Failed to clear history:', error);
              Alert.alert('Error', 'Failed to clear history. Please try again.');
            }
          }
        },
      ]
    );
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'triggered': return 'bell';
      case 'snoozed': return 'sleep';
      case 'completed': return 'check-circle';
      case 'dismissed': return 'close-circle';
      default: return 'information';
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'triggered': return '#6750A4'; // Rich purple
      case 'snoozed': return '#FF9800'; // Vibrant orange
      case 'completed': return '#4CAF50'; // Green
      case 'dismissed': return '#607D8B'; // Blue-gray
      default: return theme.colors.onSurface;
    }
  };

  const formatEventTime = (timestamp: string) => {
    const eventDate = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - eventDate.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return format(eventDate, 'MMM d, yyyy');
  };

  const getDateHeader = (timestamp: string) => {
    const eventDate = new Date(timestamp);
    const now = new Date();
    const isToday = eventDate.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = eventDate.toDateString() === yesterday.toDateString();

    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    return format(eventDate, 'EEEE, MMM d, yyyy');
  };

  const groupEventsByDate = (events: EnrichedEvent[]) => {
    const groups: { [key: string]: EnrichedEvent[] } = {};
    events.forEach(event => {
      const dateKey = new Date(event.createdAt).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    });
    return groups;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left" 
          iconColor={theme.colors.onBackground}
          onPress={() => router.back()} 
        />
        <Text variant="headlineSmall" style={styles.headerTitle}>History</Text>
        <IconButton 
          icon="delete-outline" 
          iconColor={theme.colors.onBackground}
          onPress={handleClearHistory}
          disabled={events.length === 0}
        />
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text variant="bodyMedium" style={[styles.loadingText, theme.dark && { color: '#B8B8B8' }]}>Loading history...</Text>
          </View>
        ) : events.length > 0 ? (
          Object.entries(groupEventsByDate(events)).map(([dateKey, dateEvents]) => (
            <View key={dateKey} style={styles.dateGroup}>
              <View style={styles.dateHeaderContainer}>
                <View style={styles.dateHeaderLine} />
                <Text variant="labelLarge" style={[styles.dateHeader, theme.dark && { color: '#B8B8B8' }]}>
                  {getDateHeader(dateEvents[0].createdAt)}
                </Text>
                <View style={styles.dateHeaderLine} />
              </View>
              {dateEvents.map((event) => (
                <Card key={event.id} mode="elevated" style={[
                  styles.historyCard,
                  !theme.dark && { backgroundColor: '#FFFFFF' },
                  theme.dark && {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  }
                ]} elevation={2}>
                  <Card.Content style={styles.historyContent}>
                    <View style={[styles.eventIconContainer, { backgroundColor: `${getEventColor(event.type)}15` }]}>
                      <Avatar.Icon 
                        size={48} 
                        icon={getEventIcon(event.type)} 
                        style={[styles.historyAvatar, { backgroundColor: 'transparent' }]}
                        color={getEventColor(event.type)}
                      />
                    </View>
                    <View style={styles.historyDetails}>
                      <View style={styles.titleRow}>
                        <View style={styles.titleContainer}>
                          <Text variant="titleMedium" style={[styles.historyTitle, theme.dark && { color: '#FFFFFF' }]}>
                            {event.reminderTitle}
                          </Text>
                          <View style={styles.badgesRow}>
                            <Chip 
                              mode="flat" 
                              compact 
                              style={[styles.statusChip, { backgroundColor: getEventColor(event.type) }]}
                              textStyle={styles.statusChipText}
                            >
                              {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                            </Chip>
                            {event.isDeleted && (
                              <Chip 
                                mode="flat" 
                                compact 
                                style={styles.deletedChip}
                                textStyle={styles.deletedChipText}
                                icon="delete-outline"
                              >
                                DELETED
                              </Chip>
                            )}
                          </View>
                        </View>
                      </View>
                      {event.reminderNotes && (
                        <View style={styles.notesContainer}>
                          <MaterialCommunityIcons name="note-text-outline" size={14} color={theme.dark ? '#B8B8B8' : '#666'} />
                          <Text variant="bodySmall" style={[styles.notesText, theme.dark && { color: '#B8B8B8' }]} numberOfLines={2}>
                            {event.reminderNotes}
                          </Text>
                        </View>
                      )}
                      {event.conditions && (
                        <View style={styles.conditionsContainer}>
                          <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={14} color={theme.dark ? '#B8B8B8' : '#888'} />
                          <Text variant="bodySmall" style={[styles.conditionsText, theme.dark && { color: '#B8B8B8' }]} numberOfLines={2}>
                            {event.conditions}
                          </Text>
                        </View>
                      )}
                      <View style={styles.timestampRow}>
                        <MaterialCommunityIcons name="clock-outline" size={14} color={theme.dark ? '#999' : '#999'} />
                        <Text variant="bodySmall" style={[styles.timeText, theme.dark && { color: '#999' }]}>
                          {formatEventTime(event.createdAt)}
                        </Text>
                      </View>
                    </View>
                    {!event.isDeleted && (
                      <IconButton
                        icon="chevron-right"
                        size={22}
                        iconColor={theme.colors.primary}
                        style={styles.chevronButton}
                        onPress={() => router.push(`/reminders/detail?id=${event.reminderId}`)}
                      />
                    )}
                  </Card.Content>
                </Card>
              ))}
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons 
              name="history" 
              size={64} 
              color={theme.colors.outline} 
            />
            <Text variant="titleMedium" style={[styles.emptyTitle, { color: theme.colors.outline }]}>
              No History Yet
            </Text>
            <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.outline }]}>
              Reminder events will appear here as you use the app
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(2),
    paddingVertical: space(1.5),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  headerTitle: {
    fontWeight: '700',
    fontSize: 22,
  },
  content: {
    flex: 1,
    paddingTop: space(2),
  },
  dateGroup: {
    marginBottom: space(3),
    paddingHorizontal: space(2),
  },
  dateHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space(2),
    gap: 12,
  },
  dateHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  dateHeader: {
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  historyCard: {
    marginBottom: space(1.5),
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  historyContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  eventIconContainer: {
    borderRadius: 16,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyAvatar: {
    marginTop: 0,
  },
  historyDetails: {
    flex: 1,
    gap: 10,
  },
  titleRow: {
    marginBottom: 4,
  },
  titleContainer: {
    gap: 8,
  },
  historyTitle: {
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 24,
    color: '#1a1a1a',
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusChip: {
    height: 35,
    borderRadius: 14,
  },
  statusChipText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  deletedChip: {
    height: 35,
    backgroundColor: '#d32f2f',
    borderRadius: 13,
    paddingHorizontal: 2,
  },
  deletedChipText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingLeft: 2,
  },
  notesText: {
    flex: 1,
    opacity: 0.8,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 20,
    color: '#555',
  },
  conditionsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingLeft: 2,
  },
  conditionsText: {
    flex: 1,
    opacity: 0.7,
    fontSize: 13,
    lineHeight: 18,
    color: '#666',
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingLeft: 2,
  },
  timeText: {
    opacity: 0.6,
    fontSize: 13,
    fontWeight: '500',
    color: '#888',
  },
  chevronButton: {
    margin: 0,
    marginTop: 4,
  },
  typeChip: {
    height: 28,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space(8),
    paddingHorizontal: space(4),
    gap: 16,
  },
  emptyTitle: {
    fontWeight: '700',
    fontSize: 18,
  },
  emptyText: {
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 20,
    fontSize: 14,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space(8),
    gap: 16,
  },
  loadingText: {
    opacity: 0.7,
    fontSize: 14,
  },
});