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
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reminder_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        payload_json TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reminder_id) REFERENCES reminders (id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_reminders_enabled ON reminders(enabled);
      CREATE INDEX IF NOT EXISTS idx_events_reminder_id ON events(reminder_id);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    `);
  }

  public async createReminder(input: CreateReminderInput): Promise<Reminder> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const ruleJson = JSON.stringify(input.rule);
    
    const result = await this.db.runAsync(
      `INSERT INTO reminders (title, notes, rule_json, enabled, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.title, input.notes || null, ruleJson, input.enabled ? 1 : 0, now, now]
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
      enabled: number;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM reminders WHERE id = ?', [id]);

    if (!result) return null;

    return {
      id: result.id,
      title: result.title,
      notes: result.notes || undefined,
      rule: JSON.parse(result.rule_json),
      enabled: Boolean(result.enabled),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  public async getAllReminders(): Promise<Reminder[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync<{
      id: number;
      title: string;
      notes: string | null;
      rule_json: string;
      enabled: number;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM reminders ORDER BY created_at DESC');

    return results.map(result => ({
      id: result.id,
      title: result.title,
      notes: result.notes || undefined,
      rule: JSON.parse(result.rule_json),
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
      enabled: number;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM reminders WHERE enabled = 1 ORDER BY created_at DESC');

    return results.map(result => ({
      id: result.id,
      title: result.title,
      notes: result.notes || undefined,
      rule: JSON.parse(result.rule_json),
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
    
    await this.db.runAsync(
      `UPDATE reminders 
       SET title = ?, notes = ?, rule_json = ?, enabled = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.title || existing.title,
        input.notes !== undefined ? (input.notes || null) : (existing.notes || null),
        ruleJson,
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

  public async createEvent(reminderId: number, type: ReminderEvent['type'], payload?: any): Promise<ReminderEvent> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const payloadJson = payload ? JSON.stringify(payload) : null;
    
    const result = await this.db.runAsync(
      `INSERT INTO events (reminder_id, type, payload_json, created_at) 
       VALUES (?, ?, ?, ?)`,
      [reminderId, type, payloadJson, now]
    );

    return {
      id: result.lastInsertRowId!,
      reminderId,
      type,
      payload,
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
      created_at: string;
    }>('SELECT * FROM events WHERE reminder_id = ? ORDER BY created_at DESC', [reminderId]);

    return results.map(result => ({
      id: result.id,
      reminderId: result.reminder_id,
      type: result.type as ReminderEvent['type'],
      payload: result.payload_json ? JSON.parse(result.payload_json) : undefined,
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
      created_at: string;
    }>('SELECT * FROM events ORDER BY created_at DESC LIMIT ?', [limit]);

    return results.map(result => ({
      id: result.id,
      reminderId: result.reminder_id,
      type: result.type as ReminderEvent['type'],
      payload: result.payload_json ? JSON.parse(result.payload_json) : undefined,
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
}

export default DatabaseService;