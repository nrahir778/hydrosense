/**
 * HydroSense Single Physical Tank IoT Management System Types
 */

export type TankId = 1;

export type PumpStatus = 'OFF' | 'RUNNING' | 'PENDING_START' | 'PENDING_STOP' | 'FAULT' | 'LOCKED';

export type SensorHealth = 'OK' | 'OUT_OF_RANGE' | 'NO_ECHO' | 'STUCK_READING' | 'DISCONNECTED' | 'WAITING_CONNECTION';

export type HardwareConnectionState = 'CONNECTED' | 'DISCONNECTED';

export type HardwareStatus = 'CONNECTING' | 'ONLINE' | 'OFFLINE' | 'SENSOR_ERROR';

export interface PhysicalTankCalibration {
  emptyDistanceCm: number;        // Default: 13.26 cm
  fullDistanceCm: number;         // Default: 2.40 cm
  nearFullWarningPercent: number; // Default: 90.0% (> 90%)
  criticalFullWarningPercent: number; // Default: 97.0% (>= 97%)
  lowWaterWarningPercent: number; // Default: 15.0%
}

export interface TankState {
  id: TankId;
  name: string;
  nameGujarati: string;
  type: 'MAIN_TANK';
  capacityLiters: number;
  totalDepthCm: number;        // Physical tank height span: emptyDistanceCm (13.26 cm)
  sensorOffsetCm: number;      // Distance to 100% full: fullDistanceCm (2.40 cm)
  currentDistanceCm: number | null;   // Raw distance reading from HC-SR04 in cm
  currentPercent: number | null;      // Calculated 0 - 100%
  currentLiters: number | null;       // Calculated liters
  pumpStatus: PumpStatus;
  targetPercent: number;       // Target level (20% to 90%)
  operatingMode: 'MANUAL' | 'AUTO'; // Physical Arduino operating mode
  autoStopAtTarget: boolean;
  sensorHealth: SensorHealth;
  sensorError?: string | null;
  sensorErrorMessage?: string;
  lastReadingTime: number | null;
  pumpRunDurationSec: number;
  hasRealTelemetry: boolean;
  hardwareStatus: HardwareStatus;
}

export interface IntegrationConfig {
  apiUrl: string;
  authToken: string;
  calibration: PhysicalTankCalibration;
  requireAuth: boolean;
}

export interface AutoConfigItem {
  enabled: boolean;
  minPercent: number;          // Low-level trigger (e.g. 25%)
  targetPercent: number;       // High-level stop trigger (e.g. 80%)
  dryRunProtection: boolean;   // For Tank 2: ensure Tank 1 has at least 15% before pumping
  maxContinuousRunMinutes: number; // Cutoff after X minutes
  cooldownSeconds: number;     // Prevent rapid on/off relay cycling
}

export interface AutoConfig {
  tank1: AutoConfigItem;
  tank2: AutoConfigItem;
}

export interface SystemSafety {
  emergencyStop: boolean;
  emergencyStopSource: 'UI' | 'HARDWARE_BUTTON' | 'SENSOR_FAULT' | 'OVERFLOW_CUTOFF' | 'COMM_LOSS' | null;
  emergencyStoppedAt?: number;
  maxLevelCutoffPercent: number; // e.g. 96%
  commLossTimeoutMs: number;    // e.g. 5000ms
  hardwareWatchdogSec: number;  // ESP/Mega hardware watchdog
  lastHardwarePing: number;
  isHardwareOnline: boolean;
  firmwareVersion: string;
  hardwareDevice: {
    megaModel: string;
    espChip: string;
    macAddress: string;
    ipAddress: string;
    rssi: number;
    uptimeSeconds: number;
  };
}

export interface CommandPending {
  commandId: string;
  type: 'PUMP_START' | 'PUMP_STOP' | 'EMERGENCY_STOP' | 'CONFIG_UPDATE' | 'BUZZER_MUTE';
  tankId?: TankId;
  targetPercent?: number;
  requestedAt: number;
  timeoutAt: number;
  status: 'QUEUED' | 'SENT_TO_ESP' | 'ACKNOWLEDGED' | 'TIMEOUT' | 'REJECTED';
  roundTripMs?: number;
}

export interface SystemLog {
  id: string;
  timestamp: number;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';
  source: 'MEGA' | 'ESP8266' | 'SERVER' | 'UI' | 'WATCHDOG';
  message: string;
  details?: Record<string, unknown>;
}

export interface AiTankLearning {
  averageFillRateLitersPerMin: number;    // લિટર / મિનિટ (ભરાવાની સરેરાશ ઝડપ)
  estimatedFullFillDurationMin: number;   // પૂરી ભરાતા લાગતો અંદાજિત સમય (મિનિટ)
  averageDrainRateLitersPerHour: number;  // લિટર / કલાક (શાળામાં પાણીનો વપરાશ દર)
  estimatedHoursRemaining: number;        // હાલના વપરાશ દર મુજબ પાણી કેટલા કલાક ચાલશે
  totalLitersFilledToday: number;         // આજે ભરાયેલું કુલ પાણી (લિટર)
  totalLitersConsumedToday: number;       // આજે વપરાયેલું કુલ પાણી (લિટર)
  lastFillStartedAt?: number;
  lastFillDurationMin?: number;
}

export interface AiLearnedMetrics {
  tank1: AiTankLearning;
  tank2: AiTankLearning;
  peakUsageHour: string;                  // શાળામાં સૌથી વધુ વપરાશનો સમય (દા.ત. રિસેસ)
  smartRecommendation: string;            // AI સ્માર્ટ સલાહ
  lastAnalysisTimestamp: number;
}

export interface AiVoiceCommandResult {
  transcript: string;
  responseGujarati: string;
  audioBase64?: string;
  actionExecuted?: {
    type: 'PUMP_START' | 'PUMP_STOP' | 'EMERGENCY_STOP' | 'INFO';
    tankId?: TankId;
    targetPercent?: number;
    success?: boolean;
    reason?: string;
  };
  aiLearnedInsights?: {
    t1HoursRemaining: number;
    t2HoursRemaining: number;
    t1TimeToFillMin: number;
    t2TimeToFillMin: number;
  };
}

export interface SystemState {
  mode: 'MANUAL' | 'AUTO';
  connectionState: HardwareConnectionState;
  hardwareStatus: HardwareStatus;
  tank: TankState;               // The single physical tank
  tank1: TankState;              // Backward compatibility alias to single tank
  tank2?: TankState;             // Optional for backwards compatibility
  calibration: PhysicalTankCalibration;
  integration: IntegrationConfig;
  pumpControlLocked: boolean;
  pumpControlLockReason: string;
  autoConfig: AutoConfig;
  safety: SystemSafety;
  pendingCommands: CommandPending[];
  lastCommandAck?: {
    commandId: string;
    success: boolean;
    acknowledgedAt: number;
    latencyMs: number;
    pump1Running: boolean;
    pump2Running: boolean;
  };
  recentLogs: SystemLog[];
  aiMetrics: AiLearnedMetrics;
}

export interface TelemetryPayload {
  deviceId?: string;
  timestamp?: number;
  seq?: number;
  // Single physical tank direct reading (preferred)
  distanceCm?: number;
  sensorOk?: boolean;
  // Legacy / dual tank reading fallback
  tank1?: {
    distanceCm: number;
    waterPercent?: number;
    sensorOk?: boolean;
  };
  tank2?: {
    distanceCm: number;
    waterPercent?: number;
    sensorOk?: boolean;
  };
  pump1Running?: boolean;
  pump2Running?: boolean;
  emergencyStopPin?: boolean;
  buzzerActive?: boolean;
  rssi?: number;
  uptimeSec?: number;
  ip?: string;
}

export interface HardwareCommandPayload {
  commandId: string;
  action: 'SET_PUMP' | 'EMERGENCY_STOP' | 'CLEAR_ESTOP' | 'BUZZER_TEST' | 'SYNC_CONFIG';
  tankId?: TankId;
  state?: boolean;
  autoStopTarget?: number;
  timestamp: number;
}

export interface HardwareAckPayload {
  commandId: string;
  success: boolean;
  pump1Running: boolean;
  pump2Running: boolean;
  emergencyStop: boolean;
  errorCode?: string;
  timestamp: number;
}
