import React from 'react';
import { View, StyleSheet, ImageBackground } from 'react-native';
import { Text, Card, Button, IconButton, useTheme, Chip, Avatar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BRAND, space } from '../theme';
import NotificationService from '../services/notifications'; // OPTIONAL: only if you want quick test action

export default function HomeScreen() {
  const theme = useTheme();

  const goReminders = () => router.push('/reminders/list');
  const goSettings = () => router.push('/settings');
  const goHistory = () => router.push('/history');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
          <IconButton icon="bell-outline" iconColor="white" onPress={goReminders} />
        </View>

        <View style={styles.heroButtons}>
          <Button
            mode="contained"
            onPress={goReminders}
            buttonColor="white"
            textColor={BRAND.purple}
            style={{ borderRadius: 14 }}
          >
            Create Reminder
          </Button>
          <Button mode="text" textColor="white" onPress={goSettings}>
            Settings
          </Button>
        </View>
      </ImageBackground>

      {/* CONTENT */}
      <View style={styles.content}>
        {/* Metric Cards */}
        <View style={styles.metricsRow}>
          <Card mode="elevated" style={styles.metricCard}>
            <Card.Content style={styles.metricContent}>
              <Avatar.Icon size={40} icon="calendar-check" style={styles.metricAvatar} />
              <View style={{ flex: 1 }}>
                <Text variant="headlineSmall">4</Text>
                <Text variant="bodySmall" style={styles.muted}>Upcoming today</Text>
              </View>
            </Card.Content>
          </Card>

          <Card mode="elevated" style={styles.metricCard}>
            <Card.Content style={styles.metricContent}>
              <Avatar.Icon size={40} icon="map-marker-radius-outline" style={styles.metricAvatar} />
              <View style={{ flex: 1 }}>
                <Text variant="headlineSmall">3</Text>
                <Text variant="bodySmall" style={styles.muted}>Active geofences</Text>
              </View>
            </Card.Content>
          </Card>
        </View>

        <View style={styles.metricsRow}>
          <Card mode="elevated" style={styles.metricCardWide}>
            <Card.Content style={[styles.metricContent, { gap: 12 }]}>
              <Avatar.Icon size={40} icon="battery-50" style={styles.metricAvatar} />
              <View style={{ flex: 1 }}>
                <Text variant="titleMedium">Battery 52%</Text>
                <Text variant="bodySmall" style={styles.muted}>Low-battery rules enabled</Text>
              </View>
              <Button compact onPress={goSettings}>Optimize</Button>
            </Card.Content>
          </Card>
        </View>

        {/* Quick Actions */}
        <Text variant="titleMedium" style={{ marginBottom: space(1) }}>Quick actions</Text>
        <View style={styles.quickRow}>
          <Card onPress={goReminders} mode="elevated" style={styles.quickCard}>
            <Card.Content style={styles.quickContent}>
              <Avatar.Icon size={32} icon="clock-plus-outline" />
              <Text variant="labelLarge">Time-based</Text>
            </Card.Content>
          </Card>

          <Card onPress={goReminders} mode="elevated" style={styles.quickCard}>
            <Card.Content style={styles.quickContent}>
              <Avatar.Icon size={32} icon="map-marker-plus-outline" />
              <Text variant="labelLarge">Location-based</Text>
            </Card.Content>
          </Card>

          <Card onPress={goReminders} mode="elevated" style={styles.quickCard}>
            <Card.Content style={styles.quickContent}>
              <Avatar.Icon size={32} icon="battery-plus-outline" />
              <Text variant="labelLarge">Battery-based</Text>
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
            <Text variant="bodySmall" style={styles.muted}>Snoozed “Pick up groceries” · 12m ago</Text>
            <Text variant="bodySmall" style={styles.muted}>Fired “Team meeting” · 9:00 AM</Text>
          </Card.Content>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    paddingHorizontal: space(2),
    paddingTop: space(2),
    paddingBottom: space(3),
    // borderBottomLeftRadius: 24,
    // borderBottomRightRadius: 24,
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
  heroButtons: { flexDirection: 'row', gap: 12, marginTop: 18, alignItems: 'center' },

  content: { flex: 1, paddingHorizontal: space(2), paddingTop: space(2) },

  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  metricCard: { flex: 1 },
  metricCardWide: { flex: 1 },
  metricContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metricAvatar: { backgroundColor: 'rgba(103,80,164,0.12)' },
  muted: { opacity: 0.7 },

  quickRow: { flexDirection: 'row', gap: 12 },
  quickCard: { flex: 1 },
  quickContent: { alignItems: 'center', gap: 8, paddingVertical: 12 },
});
