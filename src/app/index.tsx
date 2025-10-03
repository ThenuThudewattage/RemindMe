import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text, Card, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function HomeScreen() {
  const theme = useTheme();

  const navigateToReminders = () => {
    router.push('/reminders/list');
  };

  const navigateToSettings = () => {
    router.push('/settings');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text variant="displaySmall" style={[styles.title, { color: theme.colors.primary }]}>
            RemindMe+
          </Text>
        </View>

        <View style={styles.cards}>
          <Card style={styles.card} mode="elevated" onPress={navigateToReminders}>
            <Card.Content style={styles.cardContent}>
              <Text variant="headlineSmall" style={styles.cardTitle}>
                My Reminders
              </Text>
              <Text variant="bodyMedium" style={styles.cardDescription}>
                View, create, and manage your smart reminders
              </Text>
            </Card.Content>
          </Card>

          <Card style={styles.card} mode="elevated" onPress={navigateToSettings}>
            <Card.Content style={styles.cardContent}>
              <Text variant="headlineSmall" style={styles.cardTitle}>
                Settings
              </Text>
              <Text variant="bodyMedium" style={styles.cardDescription}>
                Configure permissions and app preferences
              </Text>
            </Card.Content>
          </Card>
        </View>

        <View style={styles.quickActions}>
          <Button
            mode="contained"
            onPress={navigateToReminders}
            style={styles.primaryButton}
            contentStyle={styles.buttonContent}
          >
            Get Started
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    maxWidth: 280,
  },
  cards: {
    marginBottom: 30,
  },
  card: {
    marginBottom: 16,
  },
  cardContent: {
    paddingVertical: 20,
  },
  cardTitle: {
    marginBottom: 8,
    fontWeight: '600',
  },
  cardDescription: {
    opacity: 0.7,
  },
  quickActions: {
    marginBottom: 40,
  },
  primaryButton: {
    marginBottom: 12,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  features: {
    flex: 1,
  },
  featuresTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  featureList: {
    gap: 12,
  },
  feature: {
    lineHeight: 22,
  },
});