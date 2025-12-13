import * as SQLite from 'expo-sqlite';
import { Reminder, ReminderEvent, CreateReminderInput, UpdateReminderInput } from '../types/reminder';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private static instance: DatabaseService;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public isReady(): boolean {
    return this.isInitialized && this.db !== null;
  }

  public async resetDatabase(): Promise<void> {
    try {
      if (this.db) {
        await this.db.closeAsync();
      }
      
      // Delete the database file
      await SQLite.deleteDatabaseAsync('remindme.db');
      
      // Reset instance state
      this.db = null;
      this.isInitialized = false;
      this.initializationPromise = null;
      
      console.log('Database reset completed');
    } catch (error) {
      console.error('Failed to reset database:', error);
      throw error;
    }
  }

  public async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.isInitialized && this.db) {
      return;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start initialization
    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    try {
      console.log('Starting database initialization...');
      this.db = await SQLite.openDatabaseAsync('remindme.db');
      await this.createTables();
      this.isInitialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      this.isInitialized = false;
      this.db = null;
      this.initializationPromise = null;
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.execAsync(`
      PRAGMA journal_mode = WAL;
      
      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        notes TEXT,
        rule_json TEXT NOT NULL,
        location_trigger_json TEXT,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reminder_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        payload_json TEXT,
        reminder_title TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reminder_id) REFERENCES reminders (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS geofence_status (
        reminder_id TEXT PRIMARY KEY,
        active INTEGER DEFAULT 0,
        last_event TEXT,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_reminders_enabled ON reminders(enabled);
      CREATE INDEX IF NOT EXISTS idx_events_reminder_id ON events(reminder_id);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_geofence_active ON geofence_status(active);
    `);

    // Handle migrations for existing databases
    await this.runMigrations();
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Check if location_trigger_json column exists in reminders table
      const reminderColumns = await this.db.getAllAsync(`PRAGMA table_info(reminders)`);
      const reminderColumnNames = reminderColumns.map((row: any) => row.name);
      
      if (!reminderColumnNames.includes('location_trigger_json')) {
        console.log('Adding location_trigger_json column to reminders table...');
        await this.db.execAsync(`
          ALTER TABLE reminders ADD COLUMN location_trigger_json TEXT;
        `);
        console.log('Migration completed: location_trigger_json column added');
      }

      // Check if alarm_json column exists in reminders table
      if (!reminderColumnNames.includes('alarm_json')) {
        console.log('Adding alarm_json column to reminders table...');
        await this.db.execAsync(`
          ALTER TABLE reminders ADD COLUMN alarm_json TEXT;
        `);
        console.log('Migration completed: alarm_json column added');
      }

      // Check if reminder_title column exists in events table
      const eventColumns = await this.db.getAllAsync(`PRAGMA table_info(events)`);
      const eventColumnNames = eventColumns.map((row: any) => row.name);
      
      if (!eventColumnNames.includes('reminder_title')) {
        console.log('Adding reminder_title column to events table...');
        await this.db.execAsync(`
          ALTER TABLE events ADD COLUMN reminder_title TEXT;
        `);
        console.log('Migration completed: reminder_title column added');
      }

      console.log('Database schema is up to date');
    } catch (error) {
      console.error('Migration failed:', error);
      
      // If migration fails completely, try to recreate the table
      try {
        console.log('Attempting to recreate reminders table with correct schema...');
        await this.recreateRemindersTable();
        console.log('Table recreation completed');
      } catch (recreateError) {
        console.error('Failed to recreate table:', recreateError);
      }
    }
  }

  private async recreateRemindersTable(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Backup existing data
    const existingReminders = await this.db.getAllAsync<{
      id: number;
      title: string;
      notes: string | null;
      rule_json: string;
      enabled: number;
      created_at: string;
      updated_at: string;
    }>(`
      SELECT id, title, notes, rule_json, enabled, created_at, updated_at 
      FROM reminders
    `);

    // Drop and recreate table
    await this.db.execAsync(`
      DROP TABLE IF EXISTS reminders;
      
      CREATE TABLE reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        notes TEXT,
        rule_json TEXT NOT NULL,
        location_trigger_json TEXT,
        alarm_json TEXT,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Restore data without location triggers (they'll be added later)
    for (const reminder of existingReminders) {
      await this.db.runAsync(
        `INSERT INTO reminders (id, title, notes, rule_json, enabled, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          reminder.id,
          reminder.title,
          reminder.notes,
          reminder.rule_json,
          reminder.enabled,
          reminder.created_at,
          reminder.updated_at,
        ]
      );
    }
  }

  public async createReminder(input: CreateReminderInput): Promise<Reminder> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const ruleJson = JSON.stringify(input.rule);
    const locationTriggerJson = input.locationTrigger ? JSON.stringify(input.locationTrigger) : null;
    const alarmJson = input.alarm ? JSON.stringify(input.alarm) : null;
    
    console.log('💾 Saving reminder with alarm settings:', alarmJson);
    
    const result = await this.db.runAsync(
      `INSERT INTO reminders (title, notes, rule_json, location_trigger_json, alarm_json, enabled, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.title, input.notes || null, ruleJson, locationTriggerJson, alarmJson, input.enabled ? 1 : 0, now, now]
    );

    const reminder = await this.getReminderById(result.lastInsertRowId!);
    if (!reminder) throw new Error('Failed to create reminder');
    
    return reminder;
  }

  public async getReminderById(id: number): Promise<Reminder | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getFirstAsync<{
      id: number;
      title: string;
      notes: string | null;
      rule_json: string;
      location_trigger_json: string | null;
      alarm_json: string | null;
      enabled: number;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM reminders WHERE id = ?', [id]);

    if (!result) return null;

    const reminder = {
      id: result.id,
      title: result.title,
      notes: result.notes || undefined,
      rule: JSON.parse(result.rule_json),
      locationTrigger: result.location_trigger_json ? JSON.parse(result.location_trigger_json) : undefined,
      alarm: result.alarm_json ? JSON.parse(result.alarm_json) : undefined,
      enabled: Boolean(result.enabled),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };

    if (reminder.alarm) {
      console.log(`  ⏰ Alarm settings for reminder ${id}:`, JSON.stringify(reminder.alarm));
    } else {
      console.log(`  🔔 No alarm settings for reminder ${id} (regular notification)`);
    }

    return reminder;
  }

  public async getAllReminders(): Promise<Reminder[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync<{
      id: number;
      title: string;
      notes: string | null;
      rule_json: string;
      location_trigger_json: string | null;
      alarm_json: string | null;
      enabled: number;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM reminders ORDER BY created_at DESC');

    return results.map(result => ({
      id: result.id,
      title: result.title,
      notes: result.notes || undefined,
      rule: JSON.parse(result.rule_json),
      locationTrigger: result.location_trigger_json ? JSON.parse(result.location_trigger_json) : undefined,
      alarm: result.alarm_json ? JSON.parse(result.alarm_json) : undefined,
      enabled: Boolean(result.enabled),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }));
  }

  public async getEnabledReminders(): Promise<Reminder[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync<{
      id: number;
      title: string;
      notes: string | null;
      rule_json: string;
      location_trigger_json: string | null;
      alarm_json: string | null;
      enabled: number;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM reminders WHERE enabled = 1 ORDER BY created_at DESC');

    return results.map(result => ({
      id: result.id,
      title: result.title,
      notes: result.notes || undefined,
      rule: JSON.parse(result.rule_json),
      locationTrigger: result.location_trigger_json ? JSON.parse(result.location_trigger_json) : undefined,
      alarm: result.alarm_json ? JSON.parse(result.alarm_json) : undefined,
      enabled: Boolean(result.enabled),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }));
  }

  public async updateReminder(input: UpdateReminderInput): Promise<Reminder> {
    if (!this.db) throw new Error('Database not initialized');

    const existing = await this.getReminderById(input.id);
    if (!existing) throw new Error('Reminder not found');

    const now = new Date().toISOString();
    const ruleJson = input.rule ? JSON.stringify(input.rule) : JSON.stringify(existing.rule);
    const locationTriggerJson = input.locationTrigger !== undefined 
      ? (input.locationTrigger ? JSON.stringify(input.locationTrigger) : null)
      : (existing.locationTrigger ? JSON.stringify(existing.locationTrigger) : null);
    const alarmJson = input.alarm !== undefined
      ? (input.alarm ? JSON.stringify(input.alarm) : null)
      : (existing.alarm ? JSON.stringify(existing.alarm) : null);
    
    console.log('💾 Updating reminder with alarm settings:', alarmJson);
    
    await this.db.runAsync(
      `UPDATE reminders 
       SET title = ?, notes = ?, rule_json = ?, location_trigger_json = ?, alarm_json = ?, enabled = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.title || existing.title,
        input.notes !== undefined ? (input.notes || null) : (existing.notes || null),
        ruleJson,
        locationTriggerJson,
        alarmJson,
        input.enabled !== undefined ? (input.enabled ? 1 : 0) : (existing.enabled ? 1 : 0),
        now,
        input.id
      ]
    );

    const updated = await this.getReminderById(input.id);
    if (!updated) throw new Error('Failed to update reminder');
    
    return updated;
  }

  public async deleteReminder(id: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync('DELETE FROM reminders WHERE id = ?', [id]);
  }

  public async createEvent(reminderId: number, type: ReminderEvent['type'], payload?: any, reminderTitle?: string): Promise<ReminderEvent> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const payloadJson = payload ? JSON.stringify(payload) : null;
    
    const result = await this.db.runAsync(
      `INSERT INTO events (reminder_id, type, payload_json, reminder_title, created_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [reminderId, type, payloadJson, reminderTitle || null, now]
    );

    return {
      id: result.lastInsertRowId!,
      reminderId,
      type,
      payload,
      reminderTitle,
      createdAt: now,
    };
  }

  public async getEventsByReminderId(reminderId: number): Promise<ReminderEvent[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync<{
      id: number;
      reminder_id: number;
      type: string;
      payload_json: string | null;
      reminder_title: string | null;
      created_at: string;
    }>('SELECT * FROM events WHERE reminder_id = ? ORDER BY created_at DESC', [reminderId]);

    return results.map(result => ({
      id: result.id,
      reminderId: result.reminder_id,
      type: result.type as ReminderEvent['type'],
      payload: result.payload_json ? JSON.parse(result.payload_json) : undefined,
      reminderTitle: result.reminder_title || undefined,
      createdAt: result.created_at,
    }));
  }

  public async getRecentEvents(limit: number = 50): Promise<ReminderEvent[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync<{
      id: number;
      reminder_id: number;
      type: string;
      payload_json: string | null;
      reminder_title: string | null;
      created_at: string;
    }>('SELECT * FROM events ORDER BY created_at DESC LIMIT ?', [limit]);

    return results.map(result => ({
      id: result.id,
      reminderId: result.reminder_id,
      type: result.type as ReminderEvent['type'],
      payload: result.payload_json ? JSON.parse(result.payload_json) : undefined,
      reminderTitle: result.reminder_title || undefined,
      createdAt: result.created_at,
    }));
  }

  public async clearOldEvents(daysToKeep: number = 30): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoff = cutoffDate.toISOString();

    await this.db.runAsync('DELETE FROM events WHERE created_at < ?', [cutoff]);
  }

  public async clearAllEvents(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync('DELETE FROM events');
  }

  // Geofence status methods
  public async setGeofenceStatus(reminderId: string, active: boolean, lastEvent?: 'enter' | 'exit'): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = Date.now();
    
    await this.db.runAsync(
      `INSERT OR REPLACE INTO geofence_status (reminder_id, active, last_event, updated_at) 
       VALUES (?, ?, ?, ?)`,
      [reminderId, active ? 1 : 0, lastEvent || null, now]
    );
  }

  public async getGeofenceStatus(reminderId: string): Promise<{ active: boolean; lastEvent?: 'enter' | 'exit'; updatedAt: number } | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getFirstAsync<{
      active: number;
      last_event: string | null;
      updated_at: number;
    }>('SELECT active, last_event, updated_at FROM geofence_status WHERE reminder_id = ?', [reminderId]);

    if (!result) return null;

    return {
      active: Boolean(result.active),
      lastEvent: result.last_event as 'enter' | 'exit' | undefined,
      updatedAt: result.updated_at,
    };
  }

  public async getAllActiveGeofences(): Promise<{ reminderId: string; lastEvent?: 'enter' | 'exit'; updatedAt: number }[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync<{
      reminder_id: string;
      last_event: string | null;
      updated_at: number;
    }>('SELECT reminder_id, last_event, updated_at FROM geofence_status WHERE active = 1');

    return results.map(result => ({
      reminderId: result.reminder_id,
      lastEvent: result.last_event as 'enter' | 'exit' | undefined,
      updatedAt: result.updated_at,
    }));
  }

  public async removeGeofenceStatus(reminderId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync('DELETE FROM geofence_status WHERE reminder_id = ?', [reminderId]);
  }
}

export default DatabaseService;