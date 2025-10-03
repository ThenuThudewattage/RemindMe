import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, IconButton, useTheme, Chip, Avatar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { space } from '../theme';

export default function HistoryScreen() {
  const theme = useTheme();

  const historyItems = [
    {
      id: 1,
      title: 'Pick up groceries',
      action: 'Snoozed',
      time: '12m ago',
      icon: 'snooze',
      color: '#FFA000',
      type: 'location'
    },
    {
      id: 2,
      title: 'Team meeting',
      action: 'Fired',
      time: '9:00 AM',
      icon: 'check-circle',
      color: '#4CAF50',
      type: 'time'
    },
    {
      id: 3,
      title: 'Charge phone',
      action: 'Completed',
      time: '2h ago',
      icon: 'battery',
      color: '#2196F3',
      type: 'battery'
    },
    {
      id: 4,
      title: 'Call mom',
      action: 'Dismissed',
      time: 'Yesterday',
      icon: 'close-circle',
      color: '#9E9E9E',
      type: 'time'
    }
  ];

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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {historyItems.map((item) => (
          <Card key={item.id} mode="outlined" style={styles.historyCard}>
            <Card.Content style={styles.historyContent}>
              <Avatar.Icon 
                size={40} 
                icon={item.icon} 
                style={[styles.historyAvatar, { backgroundColor: `${item.color}20` }]}
                color={item.color}
              />
              <View style={styles.historyDetails}>
                <Text variant="titleMedium" style={styles.historyTitle}>
                  {item.title}
                </Text>
                <View style={styles.historyMeta}>
                  <Chip 
                    mode="outlined" 
                    compact 
                    style={[styles.actionChip, { borderColor: item.color }]}
                    textStyle={{ color: item.color, fontSize: 12 }}
                  >
                    {item.action}
                  </Chip>
                  <Text variant="bodySmall" style={styles.timeText}>
                    {item.time}
                  </Text>
                </View>
              </View>
              <Chip 
                mode="outlined" 
                compact 
                icon={item.type === 'location' ? 'map-marker' : item.type === 'battery' ? 'battery' : 'clock'}
                style={styles.typeChip}
              >
                {item.type}
              </Chip>
            </Card.Content>
          </Card>
        ))}

        {historyItems.length === 0 && (
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
              Reminder actions will appear here
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
  historyTitle: {
    fontWeight: '500',
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
});