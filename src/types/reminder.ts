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

export interface Reminder {
  id: number;
  title: string;
  notes?: string;
  rule: ReminderRule;
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
}

export interface CreateReminderInput {
  title: string;
  notes?: string;
  rule: ReminderRule;
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