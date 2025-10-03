import React, { useState } from 'react';
import { View, StyleSheet, ImageBackground, ScrollView } from 'react-native';
import { Text, Card, Button, IconButton, useTheme, Chip, Avatar, FAB, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BRAND, space } from '../theme';
import NotificationService from '../services/notifications'; // OPTIONAL: only if you want quick test action
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function HomeScreen() {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

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

    
      </ImageBackground>

      {/* CONTENT */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
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
              {<IconButton
                icon="plus"
                size={20}
                iconColor={BRAND.purple}
                onPress={goReminders}
              /> }
              /> }
            </View>
            <View style={styles.grid}>
              <Tile
                color="#7C4DFF" icon="clock-outline" label="Time"
                onPress={() => router.push('/reminders/edit?preset=time')}
              />
              <Tile
                color="#7CB342" icon="map-marker" label="Location"
                onPress={() => router.push('/reminders/edit?preset=location')}
              />
              <Tile
                color="#FFA000" icon="battery" label="Battery"
                onPress={() => router.push('/reminders/edit?preset=battery')}
              />
              <Tile
                color="#1E88E5" icon="checkbox-marked-outline" label="All"
                onPress={goReminders}
              />
            </View>
          </Card.Content>
        </Card>

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
      </ScrollView>
      
      {/* Floating Action Button */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: BRAND.purple }]}
        onPress={goReminders}
        color="white"
      />
    </SafeAreaView>
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
    paddingTop: space(3),
    paddingBottom: space(3),
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
  metricCard: { flex: 1, backgroundColor: 'white' },
  metricCardWide: { flex: 1, backgroundColor: 'white' },
  metricCard: { flex: 1, backgroundColor: 'white' },
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
  },
  tileLabel: { 
    fontWeight: '500',
    fontSize: 14,
  },
});
