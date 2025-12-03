import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { 
  FAB, 
  Searchbar, 
  Text, 
  useTheme, 
  ActivityIndicator,
  Banner,
  Chip
} from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ReminderItem } from '../../components/ReminderItem';
import { Reminder } from '../../types/reminder';
import ReminderRepository from '../../services/repo';
import BackgroundService from '../../services/background';

export default function RemindersListScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams();
  const filterType = params.filter as string | undefined;
  
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filteredReminders, setFilteredReminders] = useState<Reminder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [permissions, setPermissions] = useState({
    backgroundFetch: false,
    location: false,
    notifications: false,
  });
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);

  const repo = ReminderRepository.getInstance();
  const backgroundService = BackgroundService.getInstance();

  useFocusEffect(
    useCallback(() => {
      // Update filter based on current params when screen comes into focus
      if (params.filter) {
        setActiveFilter(params.filter as string);
      } else {
        setActiveFilter(null);
      }
      
      loadReminders();
      checkPermissions();
    }, [params.filter])
  );

  useEffect(() => {
    filterReminders();
  }, [searchQuery, reminders, activeFilter]);

  const loadReminders = async () => {
    try {
      setLoading(true);
      // Ensure database is initialized before attempting to load reminders
      await repo.initialize();
      const allReminders = await repo.getAllReminders();
      setReminders(allReminders);
    } catch (error) {
      console.error('Error loading reminders:', error);
      Alert.alert(
        'Database Error', 
        'Failed to load reminders. The database may not be properly initialized.',
        [
          { text: 'Retry', onPress: loadReminders },
          { text: 'OK' }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const checkPermissions = async () => {
    try {
      const permissionStatus = await backgroundService.checkBackgroundPermissions();
      setPermissions(permissionStatus);
      
      const hasAllPermissions = permissionStatus.backgroundFetch && 
                               permissionStatus.location && 
                               permissionStatus.notifications;
      setShowPermissionBanner(!hasAllPermissions);
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  const requestPermissions = async () => {
    try {
      const permissionStatus = await backgroundService.requestAllPermissions();
      setPermissions(permissionStatus);
      
      const hasAllPermissions = permissionStatus.backgroundFetch && 
                               permissionStatus.location && 
                               permissionStatus.notifications;
      setShowPermissionBanner(!hasAllPermissions);
      
      if (hasAllPermissions) {
        Alert.alert('Success', 'All permissions granted! Your reminders will work properly.');
      } else {
        Alert.alert('Permissions', 'Some permissions were not granted. Reminders may not function properly.');
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'Failed to request permissions');
    }
  };

  const filterReminders = () => {
    let filtered = [...reminders];

    // Apply category filter first
    if (activeFilter === 'today') {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
      
      filtered = filtered.filter(reminder => {
        if (!reminder.enabled) return false;
        if (reminder.rule.time?.start) {
          const startTime = new Date(reminder.rule.time.start);
          return startTime >= startOfDay && startTime <= endOfDay;
        }
        return false;
      });
    } else if (activeFilter === 'geofence') {
      filtered = filtered.filter(reminder => 
        reminder.enabled && reminder.locationTrigger?.enabled
      );
    }

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(reminder =>
        reminder.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reminder.notes?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredReminders(filtered);
  };

  const clearFilter = () => {
    setActiveFilter(null);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReminders();
    setRefreshing(false);
  };

  const handleCreateReminder = () => {
    router.push('/reminders/edit');
  };

  const handleEditReminder = (reminder: Reminder) => {
    router.push({
      pathname: '/reminders/edit',
      params: { 
        id: reminder.id.toString(),
        edit: 'true'
      }
    });
  };

  const handleDeleteReminder = async (id: number) => {
    try {
      await repo.deleteReminder(id);
      await loadReminders();
    } catch (error) {
      console.error('Error deleting reminder:', error);
      Alert.alert('Error', 'Failed to delete reminder');
    }
  };

  const handleToggleReminder = async (id: number, enabled: boolean) => {
    try {
      if (enabled) {
        await repo.enableReminder(id);
      } else {
        await repo.disableReminder(id);
      }
      await loadReminders();
    } catch (error) {
      console.error('Error toggling reminder:', error);
      Alert.alert('Error', 'Failed to update reminder');
    }
  };

  const renderReminder = ({ item }: { item: Reminder }) => (
    <ReminderItem
      reminder={item}
      onEdit={handleEditReminder}
      onDelete={handleDeleteReminder}
      onToggle={handleToggleReminder}
    />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text variant="headlineSmall" style={styles.emptyTitle}>
        No Reminders Yet
      </Text>
      <Text variant="bodyLarge" style={styles.emptyMessage}>
        Create your first smart reminder by tapping the + button below.
      </Text>
    </View>
  );

  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Loading reminders...
        </Text>
      </View>
    );
  }

  return (
  <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      {showPermissionBanner && (
        <Banner
          visible={showPermissionBanner}
          actions={[
            {
              label: 'Grant Permissions',
              onPress: requestPermissions,
            },
            {
              label: 'Dismiss',
              onPress: () => setShowPermissionBanner(false),
            },
          ]}
          icon="alert-circle"
        >
          Some permissions are missing. Grant them for full functionality.
        </Banner>
      )}
      
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search reminders..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
        
        {activeFilter && (
          <View style={styles.filterChipContainer}>
            <Chip 
              icon="filter" 
              onClose={clearFilter}
              style={styles.filterChip}
            >
              {activeFilter === 'today' ? 'Upcoming Today' : 'Active Geofences'}
            </Chip>
          </View>
        )}
      </View>

      <FlatList
        data={filteredReminders}
        renderItem={renderReminder}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[styles.listContainer, { paddingBottom: Math.max(80, insets.bottom + 16) }]}
        ListEmptyComponent={renderEmpty}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        showsVerticalScrollIndicator={false}
      />

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary, bottom: insets.bottom ? insets.bottom + 16 : 80 }]}
        onPress={handleCreateReminder}
      />
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
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchbar: {
    elevation: 2,
  },
  filterChipContainer: {
    marginTop: 8,
  },
  filterChip: {
    alignSelf: 'flex-start',
  },
  listContainer: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyMessage: {
    textAlign: 'center',
    opacity: 0.7,
    maxWidth: 280,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});