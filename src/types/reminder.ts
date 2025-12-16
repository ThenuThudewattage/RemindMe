export interface ReminderRule {
  time?: {
    start?: string; // ISO string format
    end?: string;   // ISO string format
  };
  location?: {
    lat: number;
    lon: number;
    radius: number; // meters
  };
  battery?: {
    min?: number; // percentage 0-100
    max?: number; // percentage 0-100
  };
  options?: {
    repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
    quietHours?: {
      start: string; // HH:MM format
      end: string;   // HH:MM format
    };
    expiry?: string; // ISO string format
    cooldownMins?: number;
  };
}

export interface LocationTrigger {
  id: string;
  mode: 'enter' | 'exit' | 'both';
  latitude: number;
  longitude: number;
  radius: number;
  label?: string;
  enabled: boolean;
}

export interface AlarmSettings {
  enabled: boolean; // Whether alarm is enabled for this reminder
  soundUri?: string; // Custom alarm sound URI (optional, uses default if not set)
  volume?: number; // Alarm volume (0-1, default 1.0)
  vibrate?: boolean; // Whether to vibrate (default true)
  snoozeInterval?: number; // Snooze duration in minutes (default 10)
  maxSnoozeCount?: number; // Maximum number of snoozes allowed (default 3)
  cooldownMins?: number; // Cooldown period in minutes to prevent rapid re-triggering (optional, no default)
  wakeScreen?: boolean; // Wake screen when alarm fires (default true)
}

export interface Reminder {
  id: number;
  title: string;
  notes?: string;
  rule: ReminderRule;
  locationTrigger?: LocationTrigger;
  alarm?: AlarmSettings; // Alarm configuration
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderEvent {
  id: number;
  reminderId: number;
  type: 'triggered' | 'snoozed' | 'completed' | 'dismissed';
  payload?: any;
  createdAt: string;
  reminderTitle?: string; // Store the title so it persists even after deletion
}

export interface CreateReminderInput {
  title: string;
  notes?: string;
  rule: ReminderRule;
  locationTrigger?: LocationTrigger;
  alarm?: AlarmSettings; // Alarm configuration
  enabled?: boolean;
}

export interface UpdateReminderInput extends Partial<CreateReminderInput> {
  id: number;
}

export interface LocationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
}

export interface NotificationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
}

export interface BatteryState {
  batteryLevel: number;
  batteryState: 'unknown' | 'unplugged' | 'charging' | 'full';
  lowPowerMode: boolean;
}

export interface GeofenceRegion {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
  notifyOnEntry: boolean;
  notifyOnExit: boolean;
}

export interface NotificationAction {
  identifier: string;
  title: string;
  options?: {
    isDestructive?: boolean;
    isAuthenticationRequired?: boolean;
  };
}

export interface NotificationCategory {
  identifier: string;
  actions: NotificationAction[];
  options?: {
    hiddenPreviewsBodyPlaceholder?: string;
    customDismissAction?: boolean;
    allowInCarPlay?: boolean;
    showInNotificationCenter?: boolean;
    showOnLockScreen?: boolean;
    playSound?: boolean;
  };
}

export interface GeofenceStatus {
  reminderId: string;
  active: boolean;
  lastEvent?: 'enter' | 'exit';
  updatedAt: number;
}

export interface GeofenceEvent {
  reminderId: string;
  type: 'enter' | 'exit';
  timestamp: number;
}

export interface AlarmState {
  reminderId: number;
  isRinging: boolean;
  snoozeCount: number;
  triggeredAt: number;
  soundLoaded: boolean;
}

export interface AlarmTrigger {
  reminderId: number;
  reminderTitle: string;
  triggeredBy: 'time' | 'location' | 'battery' | 'manual';
  timestamp: number;
}