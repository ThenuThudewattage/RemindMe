import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ImageBackground, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, Button, IconButton, useTheme, Chip, Avatar, FAB, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BRAND, space } from '../theme';
import NotificationService from '../services/notifications'; // OPTIONAL: only if you want quick test action
import BatteryService from '../services/battery';
import { BatteryState, ReminderEvent, Reminder } from '../types/reminder';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ReminderRepository from '../services/repo';
import { useFocusEffect } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [batteryState, setBatteryState] = useState<BatteryState | null>(null);
  const [upcomingTodayCount, setUpcomingTodayCount] = useState<number>(0);
  const [activeGeofencesCount, setActiveGeofencesCount] = useState<number>(0);
  const [recentEvents, setRecentEvents] = useState<Array<ReminderEvent & { reminderTitle?: string }>>([]);

  // Load dashboard metrics
  const loadMetrics = async () => {
    try {
      const repo = ReminderRepository.getInstance();
      const allReminders = await repo.getAllReminders();
      
      // Count upcoming today (time-based reminders scheduled for today)
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
      
      const todayReminders = allReminders.filter(reminder => {
        if (!reminder.enabled) return false;
        
        if (reminder.rule.time?.start) {
          const startTime = new Date(reminder.rule.time.start);
          return startTime >= startOfDay && startTime <= endOfDay;
        }
        return false;
      });
      
      setUpcomingTodayCount(todayReminders.length);
      
      // Count active geofences (enabled location-based reminders)
      const activeGeofences = allReminders.filter(reminder => 
        reminder.enabled && reminder.locationTrigger?.enabled
      );
      
      setActiveGeofencesCount(activeGeofences.length);

      // Load recent events for history
      const events = await repo.getRecentEvents(3); // Get last 3 events
      
      // Enrich events with reminder titles
      const enrichedEvents = await Promise.all(
        events.map(async (event) => {
          const reminder = await repo.getReminder(event.reminderId);
          return {
            ...event,
            reminderTitle: reminder?.title || 'Unknown Reminder'
          };
        })
      );
      
      setRecentEvents(enrichedEvents);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  // Reload metrics when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadMetrics();
    }, [])
  );

  // Initialize battery service and get current battery state
  useEffect(() => {
    const initializeBattery = async () => {
      try {
        const batteryService = BatteryService.getInstance();
        await batteryService.initialize();
        
        // Get initial battery state
        const currentState = await batteryService.getCurrentBatteryState();
        setBatteryState(currentState);
        
        // Set up battery change callback
        batteryService.setBatteryChangeCallback((newState: BatteryState) => {
          setBatteryState(newState);
        });
        
        // Add a small delay to ensure repository is fully initialized
        setTimeout(async () => {
          try {
            // Start monitoring after repository is ready
            await batteryService.startBatteryMonitoring();
          } catch (error) {
            console.error('Failed to start battery monitoring:', error);
          }
        }, 1000);
      } catch (error) {
        console.error('Failed to initialize battery service:', error);
      }
    };

    initializeBattery();

    // Cleanup on unmount
    return () => {
      const batteryService = BatteryService.getInstance();
      batteryService.removeBatteryChangeCallback();
      batteryService.stopBatteryMonitoring();
    };
  }, []);

  const getBatteryIcon = (): string => {
    if (!batteryState) return 'battery-50';
    
    const level = batteryState.batteryLevel;
    const isCharging = batteryState.batteryState === 'charging';
    
    if (isCharging) {
      if (level >= 90) return 'battery-charging-100';
      if (level >= 70) return 'battery-charging-80';
      if (level >= 50) return 'battery-charging-60';
      if (level >= 30) return 'battery-charging-40';
      if (level >= 10) return 'battery-charging-20';
      return 'battery-charging-outline';
    }
    
    if (level >= 90) return 'battery';
    if (level >= 70) return 'battery-80';
    if (level >= 50) return 'battery-60';
    if (level >= 30) return 'battery-40';
    if (level >= 10) return 'battery-20';
    return 'battery-outline';
  };

  const getBatteryColor = (): string => {
    if (!batteryState) return '#4CAF50';
    
    const level = batteryState.batteryLevel;
    if (level >= 50) return '#4CAF50'; // Green
    if (level >= 20) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const getEventIcon = (type: string): string => {
    switch (type) {
      case 'snoozed': return 'sleep';
      case 'triggered': return 'bell-ring';
      case 'completed': return 'check-circle';
      case 'dismissed': return 'close-circle';
      default: return 'information';
    }
  };

  const getEventText = (event: ReminderEvent & { reminderTitle?: string }): string => {
    const timeAgo = formatDistanceToNow(new Date(event.createdAt), { addSuffix: true });
    
    switch (event.type) {
      case 'snoozed':
        return `Snoozed "${event.reminderTitle}" · ${timeAgo}`;
      case 'triggered':
        return `Triggered "${event.reminderTitle}" · ${timeAgo}`;
      case 'completed':
        return `Completed "${event.reminderTitle}" · ${timeAgo}`;
      case 'dismissed':
        return `Dismissed "${event.reminderTitle}" · ${timeAgo}`;
      default:
        return `"${event.reminderTitle}" · ${timeAgo}`;
    }
  };

  
  const goReminders = () => router.push('/reminders/list');
  const goSettings = () => router.push('/settings');
  const goHistory = () => router.push('/history');

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      {/* HERO — rich purple header with subtle noise/texture (uses a tiny base64 gradient or replace with your asset) */}
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
          <IconButton icon="cog-outline" iconColor="white" onPress={goSettings} />
        </View>

    
      </ImageBackground>

      {/* CONTENT */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(80, insets.bottom + 16) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Actions Card */}
        <Card mode="elevated" style={styles.quickActionsCard}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Text variant="titleMedium" style={styles.cardTitle}>Quick Actions</Text>
              {<IconButton
                icon="plus"
                size={20}
                iconColor={BRAND.purple}
                onPress={goReminders}
              /> }
            </View>
            <View style={styles.grid}>
              <Tile
                color="#7C4DFF" icon="clock-outline" label="Remind me later"
                onPress={() => router.push('/reminders/edit?preset=time')}
              />
              <Tile
                color="#7CB342" icon="map-marker" label="Wake me there"
                onPress={() => router.push('/reminders/edit?preset=location')}
              />
              <Tile
                color="#FFA000" icon="battery" label="Battery"
                onPress={() => router.push('/reminders/edit?preset=battery')}
              />
              <Tile
                color="#1E88E5" icon="checkbox-marked-outline" label="All"
                onPress={() => router.push('/reminders/edit?preset=all')}
              />
            </View>
            
            {/* DEBUG: Temporary Alarm Screen Access
            <Button
              mode="outlined"
              icon="alarm-light"
              onPress={() => router.push({
                pathname: '/alarm',
                params: {
                  reminderId: '999',
                  reminderTitle: 'Test Alarm Screen',
                  triggeredBy: 'manual',
                },
              })}
              style={{ marginTop: 16, borderColor: BRAND.purple }}
              textColor={BRAND.purple}
            >
              🚨 Test Alarm Screen (Debug)
            </Button> */}
          </Card.Content>
        </Card>

      {/* Metric Cards */}
        <View style={styles.metricsRow}>
          <TouchableOpacity 
            onPress={() => router.push('/reminders/list?filter=today')} 
            style={styles.metricTouchable} 
            activeOpacity={0.7}
          >
            <Card mode="elevated" style={styles.metricCard}>
              <Card.Content style={styles.metricContent}>
                <Avatar.Icon size={40} icon="calendar-check" style={styles.metricAvatar} />
                <View style={{ flex: 1 }}>
                  <Text variant="headlineSmall">{upcomingTodayCount}</Text>
                  <Text variant="bodySmall" style={styles.muted}>Upcoming {"\n"}today</Text>
                </View>
              </Card.Content>
            </Card>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push('/reminders/list?filter=geofence')} 
            style={styles.metricTouchable} 
            activeOpacity={0.7}
          >
            <Card mode="elevated" style={styles.metricCard}>
              <Card.Content style={styles.metricContent}>
                <Avatar.Icon size={40} icon="map-marker-radius-outline" style={styles.metricAvatar} />
                <View style={{ flex: 1 }}>
                  <Text variant="headlineSmall">{activeGeofencesCount}</Text>
                  <Text variant="bodySmall" style={styles.muted}>Active geofences</Text>
                </View>
              </Card.Content>
            </Card>
          </TouchableOpacity>
        </View>

        <View style={styles.metricsRow}>
          <Card mode="elevated" style={styles.metricCardWide}>
            <Card.Content style={[styles.metricContent, { gap: 12 }]}>
              <Avatar.Icon 
                size={40} 
                icon={getBatteryIcon()} 
                style={[styles.metricAvatar, { backgroundColor: `${getBatteryColor()}1A` }]} 
              />
              <View style={{ flex: 1 }}>
                <Text variant="titleMedium">
                  Battery {batteryState ? `${batteryState.batteryLevel}%` : 'Loading...'}
                </Text>
                <Text variant="bodySmall" style={styles.muted}>
                  {batteryState ? 
                    `${batteryState.batteryState === 'charging' ? 'Charging' : 
                      batteryState.batteryState === 'full' ? 'Full' : 
                      batteryState.batteryState === 'unplugged' ? 'Unplugged' : 'Unknown'}${
                      batteryState.lowPowerMode ? ' • Low Power Mode' : ''
                    }` : 
                    'Low-battery rules enabled'
                  }
                </Text>
              </View>
              <Button compact onPress={goSettings}>Optimize</Button>
            </Card.Content>
          </Card>
        </View>

        <Card mode="outlined" style={{ marginTop: space(2) }}>
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="titleSmall">History</Text>
              <Button mode="text" compact onPress={goHistory} textColor={BRAND.purple}>
                View All
              </Button>
            </View>
            {recentEvents.length > 0 ? (
              recentEvents.map((event, index) => (
                <Text key={event.id || index} variant="bodySmall" style={styles.muted}>
                  {getEventText(event)}
                </Text>
              ))
            ) : (
              <Text variant="bodySmall" style={styles.muted}>No recent activity</Text>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
      
      {/* Floating Action Button */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: BRAND.purple, bottom: insets.bottom ? insets.bottom + 16 : 80 }]}
        onPress={goReminders}
        color="white"
      />
    </View>
  );
}


/** small internal tile component to match the mock */
function Tile({ color, icon, label, onPress }: {
  color: string; icon: any; label: string; onPress: () => void;
}) {
  return (
    <Card mode="elevated" style={styles.tileCard} onPress={onPress}>
      <View style={styles.tileInner}>
        <View style={[styles.tileIconWrap, { backgroundColor: `${color}1A` /* 10% tint */ }]}>
          <MaterialCommunityIcons name={icon} size={30} color={color} />
        </View>
        <Text variant="titleMedium" style={styles.tileLabel}>{label}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  heroSubtitle: { color: 'white', opacity: 0.95, marginTop: 6 },
  bold: { fontWeight: '700' },
  heroChips: { flexDirection: 'row', gap: 8, marginTop: 12 },
  heroChip: { backgroundColor: 'rgba(255,255,255,0.18)' },
  heroSearch: { marginTop: 18 },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
  },
  searchOutline: {
    borderColor: 'rgba(255,255,255,0.3)',
    borderWidth: 1,
  },
  searchContent: {
    color: 'white',
  },
  
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 80, // Above tab bar
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  scrollView: { flex: 1 },
  content: { paddingHorizontal: space(2), paddingTop: space(2), paddingBottom: space(3) },

  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  metricTouchable: { flex: 1 },
  metricCard: { backgroundColor: 'white' },
  metricCardWide: { flex: 1, backgroundColor: 'white' },
  metricContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metricAvatar: { backgroundColor: 'rgba(103,80,164,0.12)' },
  muted: { opacity: 0.7 },

  quickRow: { flexDirection: 'row', gap: 12 },
  quickCard: { flex: 1 },
  quickContent: { alignItems: 'center', gap: 8, paddingVertical: 12 },

  // Quick Actions Card
  quickActionsCard: {
    marginBottom: space(2),
    borderRadius: 12,
    backgroundColor: 'white',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space(1),
  },
  cardTitle: {
    fontWeight: '600',
  },

  grid: {
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between',
    gap: 12,
  },
  tileCard: {
    width: '48%',
    borderRadius: 12,
    elevation: 1,
  },
  tileInner: { 
    alignItems: 'center', 
    paddingVertical: 16, 
    gap: 8 
  },
  tileIconWrap: {
    width: 48, 
    height: 48, 
    borderRadius: 12,
    alignItems: 'center', 
    justifyContent: 'center',
    position: 'relative',
  },
  tileLabel: { 
    fontWeight: '500',
    fontSize: 14,
  },
});
