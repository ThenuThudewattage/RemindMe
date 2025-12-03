import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
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
          onPress={() => {/* TODO: Clear history */}} 
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
          events.map((event) => (
            <Card key={event.id} mode="outlined" style={styles.historyCard}>
              <Card.Content style={styles.historyContent}>
                <Avatar.Icon 
                  size={40} 
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
                      textStyle={{ color: getEventColor(event.type), fontSize: 12 }}
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
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(1),
    paddingVertical: space(1),
  },
  headerTitle: {
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: space(2),
  },
  historyCard: {
    marginBottom: space(1),
    borderRadius: 12,
  },
  historyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  historyAvatar: {
    backgroundColor: 'rgba(103,80,164,0.12)',
  },
  historyDetails: {
    flex: 1,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  historyTitle: {
    fontWeight: '500',
  },
  deletedChip: {
    height: 24,
    backgroundColor: '#f44336',
  },
  deletedChipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  notesText: {
    opacity: 0.7,
    fontStyle: 'italic',
  },
  conditionsText: {
    opacity: 0.6,
    fontSize: 12,
    color: '#666',
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionChip: {
    height: 24,
  },
  timeText: {
    opacity: 0.7,
  },
  typeChip: {
    height: 28,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space(4),
    gap: 12,
  },
  emptyTitle: {
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    maxWidth: 200,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space(4),
    gap: 12,
  },
  loadingText: {
    opacity: 0.7,
  },
});