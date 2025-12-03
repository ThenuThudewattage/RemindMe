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
      case 'triggered': return theme.colors.primary;
      case 'snoozed': return '#FFA000';
      case 'completed': return '#4CAF50';
      case 'dismissed': return '#9E9E9E';
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
            <ActivityIndicator size="large" />
            <Text variant="bodyMedium" style={styles.loadingText}>Loading history...</Text>
          </View>
        ) : events.length > 0 ? (
          Object.entries(groupEventsByDate(events)).map(([dateKey, dateEvents]) => (
            <View key={dateKey} style={styles.dateGroup}>
              <View style={styles.dateHeaderContainer}>
                <View style={styles.dateHeaderLine} />
                <Text variant="labelLarge" style={styles.dateHeader}>
                  {getDateHeader(dateEvents[0].createdAt)}
                </Text>
                <View style={styles.dateHeaderLine} />
              </View>
              {dateEvents.map((event) => (
                <Card key={event.id} mode="elevated" style={styles.historyCard} elevation={1}>
                  <Card.Content style={styles.historyContent}>
                    <Avatar.Icon 
                      size={44} 
                      icon={getEventIcon(event.type)} 
                      style={[styles.historyAvatar, { backgroundColor: `${getEventColor(event.type)}20` }]}
                      color={getEventColor(event.type)}
                    />
                    <View style={styles.historyDetails}>
                      <View style={styles.titleRow}>
                        <Text variant="titleMedium" style={styles.historyTitle}>
                          {event.reminderTitle}
                        </Text>
                        {event.isDeleted && (
                          <Chip 
                            mode="flat" 
                            compact 
                            style={styles.deletedChip}
                            textStyle={styles.deletedChipText}
                            icon="delete"
                          >
                            DELETED
                          </Chip>
                        )}
                      </View>
                      {event.reminderNotes && (
                        <Text variant="bodySmall" style={styles.notesText}>
                          {event.reminderNotes}
                        </Text>
                      )}
                      {event.conditions && (
                        <Text variant="bodySmall" style={styles.conditionsText}>
                          {event.conditions}
                        </Text>
                      )}
                      <View style={styles.historyMeta}>
                        <Chip 
                          mode="outlined" 
                          compact 
                          style={[styles.actionChip, { borderColor: getEventColor(event.type) }]}
                          textStyle={{ color: getEventColor(event.type), fontSize: 12, fontWeight: '600' }}
                        >
                          {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                        </Chip>
                        <Text variant="bodySmall" style={styles.timeText}>
                          {formatEventTime(event.createdAt)}
                        </Text>
                      </View>
                    </View>
                    {!event.isDeleted && (
                      <IconButton
                        icon="chevron-right"
                        size={20}
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
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  historyContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 6,
  },
  historyAvatar: {
    marginTop: 2,
  },
  historyDetails: {
    flex: 1,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  historyTitle: {
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 22,
    flex: 1,
  },
  deletedChip: {
    height: 22,
    backgroundColor: '#ff5252',
  },
  deletedChipText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  notesText: {
    opacity: 0.75,
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  conditionsText: {
    opacity: 0.65,
    fontSize: 12,
    lineHeight: 16,
    color: '#555',
    marginBottom: 6,
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  actionChip: {
    height: 26,
    borderRadius: 13,
  },
  timeText: {
    opacity: 0.6,
    fontSize: 12,
    fontWeight: '500',
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