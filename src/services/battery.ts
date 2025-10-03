import * as Battery from 'expo-battery';
import { BatteryState } from '../types/reminder';
import { ContextEngine } from './contextEngine';

class BatteryService {
  private static instance: BatteryService;
  private currentBatteryState: BatteryState | null = null;
  private batterySubscription: Battery.Subscription | null = null;
  private onBatteryChangeCallback: ((batteryState: BatteryState) => void) | null = null;

  private constructor() {}

  public static getInstance(): BatteryService {
    if (!BatteryService.instance) {
      BatteryService.instance = new BatteryService();
    }
    return BatteryService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      await this.updateBatteryState();
      console.log('Battery service initialized');
    } catch (error) {
      console.error('Failed to initialize battery service:', error);
    }
  }

  public async getCurrentBatteryState(): Promise<BatteryState> {
    try {
      const batteryLevel = await Battery.getBatteryLevelAsync();
      const batteryState = await Battery.getBatteryStateAsync();
      const lowPowerMode = await Battery.isLowPowerModeEnabledAsync();

      const state: BatteryState = {
        batteryLevel: Math.round(batteryLevel * 100), // Convert to percentage
        batteryState: this.mapBatteryState(batteryState),
        lowPowerMode,
      };

      this.currentBatteryState = state;
      return state;
    } catch (error) {
      console.error('Error getting battery state:', error);
      // Return a default state if we can't get the actual state
      const defaultState: BatteryState = {
        batteryLevel: 50,
        batteryState: 'unknown',
        lowPowerMode: false,
      };
      this.currentBatteryState = defaultState;
      return defaultState;
    }
  }

  private mapBatteryState(state: Battery.BatteryState): BatteryState['batteryState'] {
    switch (state) {
      case Battery.BatteryState.CHARGING:
        return 'charging';
      case Battery.BatteryState.FULL:
        return 'full';
      case Battery.BatteryState.UNPLUGGED:
        return 'unplugged';
      case Battery.BatteryState.UNKNOWN:
      default:
        return 'unknown';
    }
  }

  public async startBatteryMonitoring(): Promise<void> {
    try {
      if (this.batterySubscription) {
        console.log('Battery monitoring already started');
        return;
      }

      // Update initial state
      await this.updateBatteryState();

      // Subscribe to battery level changes
      this.batterySubscription = Battery.addBatteryLevelListener(async ({ batteryLevel }) => {
        await this.handleBatteryChange();
      });

      // Also subscribe to battery state changes
      Battery.addBatteryStateListener(async ({ batteryState }) => {
        await this.handleBatteryChange();
      });

      // Subscribe to low power mode changes
      Battery.addLowPowerModeListener(async ({ lowPowerMode }) => {
        await this.handleBatteryChange();
      });

      console.log('Battery monitoring started');
    } catch (error) {
      console.error('Error starting battery monitoring:', error);
    }
  }

  public async stopBatteryMonitoring(): Promise<void> {
    try {
      if (this.batterySubscription) {
        this.batterySubscription.remove();
        this.batterySubscription = null;
      }
      console.log('Battery monitoring stopped');
    } catch (error) {
      console.error('Error stopping battery monitoring:', error);
    }
  }

  private async handleBatteryChange(): Promise<void> {
    try {
      const newBatteryState = await this.getCurrentBatteryState();
      
      if (this.onBatteryChangeCallback) {
        this.onBatteryChangeCallback(newBatteryState);
      }

      // Trigger context engine to check conditions
      await this.checkBatteryConditions(newBatteryState);
    } catch (error) {
      console.error('Error handling battery change:', error);
    }
  }

  private async updateBatteryState(): Promise<void> {
    await this.getCurrentBatteryState();
  }

  private async checkBatteryConditions(batteryState: BatteryState): Promise<void> {
    try {
      // Use the context engine to check battery conditions
      const contextEngine = ContextEngine.getInstance();
      await contextEngine.checkBatteryConditions(batteryState);
    } catch (error) {
      console.error('Error checking battery conditions:', error);
    }
  }

  public setBatteryChangeCallback(callback: (batteryState: BatteryState) => void): void {
    this.onBatteryChangeCallback = callback;
  }

  public removeBatteryChangeCallback(): void {
    this.onBatteryChangeCallback = null;
  }

  public getLastKnownBatteryState(): BatteryState | null {
    return this.currentBatteryState;
  }

  public isBatteryLow(threshold: number = 20): boolean {
    if (!this.currentBatteryState) return false;
    return this.currentBatteryState.batteryLevel <= threshold;
  }

  public isBatteryHigh(threshold: number = 80): boolean {
    if (!this.currentBatteryState) return false;
    return this.currentBatteryState.batteryLevel >= threshold;
  }

  public isBatteryCharging(): boolean {
    if (!this.currentBatteryState) return false;
    return this.currentBatteryState.batteryState === 'charging';
  }

  public isBatteryFull(): boolean {
    if (!this.currentBatteryState) return false;
    return this.currentBatteryState.batteryState === 'full';
  }

  public isLowPowerModeEnabled(): boolean {
    if (!this.currentBatteryState) return false;
    return this.currentBatteryState.lowPowerMode;
  }

  public checkBatteryLevelInRange(min?: number, max?: number): boolean {
    if (!this.currentBatteryState) return false;
    
    const level = this.currentBatteryState.batteryLevel;
    
    if (min !== undefined && level < min) return false;
    if (max !== undefined && level > max) return false;
    
    return true;
  }

  public async getBatteryInfo(): Promise<{
    level: number;
    state: string;
    lowPowerMode: boolean;
    isCharging: boolean;
    estimatedTimeRemaining?: number;
  }> {
    const batteryState = await this.getCurrentBatteryState();
    
    return {
      level: batteryState.batteryLevel,
      state: batteryState.batteryState,
      lowPowerMode: batteryState.lowPowerMode,
      isCharging: batteryState.batteryState === 'charging',
    };
  }
}

export default BatteryService;