import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Card, Text, Button, IconButton, Chip, useTheme } from 'react-native-paper';
import { Reminder } from '../types/reminder';
import { format } from 'date-fns';

interface ReminderItemProps {
  reminder: Reminder;
  onEdit: (reminder: Reminder) => void;
  onDelete: (id: number) => void;
  onToggle: (id: number, enabled: boolean) => void;
}

export const ReminderItem: React.FC<ReminderItemProps> = ({
  reminder,
  onEdit,
  onDelete,
  onToggle,
}) => {
  const theme = useTheme();

  const handleDelete = () => {
    Alert.alert(
      'Delete Reminder',
      `Are you sure you want to delete "${reminder.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => onDelete(reminder.id)
        },
      ]
    );
  };

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
    
    return conditions.length > 0 ? conditions.join(' • ') : 'No conditions set';
  };

  return (
    <Card style={[
      styles.card,
      !reminder.enabled && styles.disabledCard,
      !theme.dark && { backgroundColor: '#FFFFFF' },
      theme.dark && {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
    ]} mode="elevated">
      <Card.Content>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text variant="titleMedium" style={[
              styles.title,
              !reminder.enabled && styles.disabledText,
              theme.dark && { color: '#FFFFFF' }
            ]}>
              {reminder.title}
            </Text>
            <View style={styles.statusContainer}>
              <Chip 
                selected={reminder.enabled}
                onPress={() => onToggle(reminder.id, !reminder.enabled)}
                style={styles.statusChip}
                textStyle={styles.chipText}
              >
                {reminder.enabled ? 'Active' : 'Disabled'}
              </Chip>
            </View>
          </View>
          <View style={styles.actions}>
            <IconButton
              icon="pencil"
              size={20}
              onPress={() => onEdit(reminder)}
            />
            <IconButton
              icon="delete"
              size={20}
              iconColor={theme.colors.error}
              onPress={handleDelete}
            />
          </View>
        </View>
        
        {reminder.notes && (
          <Text 
            variant="bodyMedium" 
            style={[
              styles.notes,
              !reminder.enabled && styles.disabledText,
              theme.dark && { color: '#B8B8B8' }
            ]}
          >
            {reminder.notes}
          </Text>
        )}
        
        <Text 
          variant="bodySmall" 
          style={[
            styles.conditions,
            !reminder.enabled && styles.disabledText,
            theme.dark && { color: '#B8B8B8' }
          ]}
        >
          {formatRuleDescription(reminder)}
        </Text>
        
        <View style={styles.footer}>
          <Text variant="labelSmall" style={[styles.timestamp, theme.dark && { color: '#B8B8B8' }]}>
            Created {format(new Date(reminder.createdAt), 'MMM d, yyyy')}
          </Text>
          {reminder.rule.options?.repeat && reminder.rule.options.repeat !== 'none' && (
            <Chip compact style={styles.repeatChip}>
              {reminder.rule.options.repeat}
            </Chip>
          )}
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginVertical: 4,
    marginHorizontal: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  disabledCard: {
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontWeight: '600',
    marginBottom: 4,
  },
  disabledText: {
    opacity: 0.6,
  },
  statusContainer: {
    marginBottom: 4,
  },
  statusChip: {
    alignSelf: 'flex-start',
  },
  chipText: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
  },
  notes: {
    marginBottom: 8,
    fontStyle: 'italic',
  },
  conditions: {
    marginBottom: 8,
    color: '#666',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  timestamp: {
    color: '#999',
  },
  repeatChip: {
    height: 24,
  },
});