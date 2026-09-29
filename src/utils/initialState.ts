import { SystemState, TankState, PhysicalTankCalibration, IntegrationConfig, AutoConfig, SystemSafety, AiLearnedMetrics } from '../types';

export const DEFAULT_CALIBRATION: PhysicalTankCalibration = {
  emptyDistanceCm: 13.26,        // Calibrated distance when tank is empty (0%)
  fullDistanceCm: 2.40,          // Calibrated distance when tank is 100% full
  nearFullWarningPercent: 90.0,  // Warning when level > 90%
  criticalFullWarningPercent: 97.0, // Critical alert when level >= 97%
  lowWaterWarningPercent: 15.0,  // Warning when level <= 15%
};

export const DEFAULT_INTEGRATION: IntegrationConfig = {
  apiUrl: '/api/telemetry',
  authToken: '',
  calibration: DEFAULT_CALIBRATION,
  requireAuth: false,
};

export const DEFAULT_TANK: TankState = {
  id: 1,
  name: 'Water Tank (મુખ્ય પાણીની ટાંકી)',
  nameGujarati: 'શાળા મુખ્ય પાણીની ટાંકી (HC-SR04)',
  type: 'MAIN_TANK',
  capacityLiters: 1000,
  totalDepthCm: 13.26,
  sensorOffsetCm: 2.40,
  currentDistanceCm: null,      // Clean null state - waiting for physical hardware
  currentPercent: null,         // Clean null state - no fake data
  currentLiters: null,
  pumpStatus: 'LOCKED',         // Monitoring separated from pump control
  targetPercent: 85,
  autoStopAtTarget: true,
  sensorHealth: 'WAITING_CONNECTION',
  lastReadingTime: null,
  pumpRunDurationSec: 0,
  hasRealTelemetry: false,
  hardwareStatus: 'OFFLINE',    // Explicitly OFFLINE until real connection
};

export const DEFAULT_AUTO_CONFIG: AutoConfig = {
  tank1: {
    enabled: false,
    minPercent: 20,
    targetPercent: 85,
    dryRunProtection: true,
    maxContinuousRunMinutes: 20,
    cooldownSeconds: 30,
  },
  tank2: {
    enabled: false,
    minPercent: 20,
    targetPercent: 85,
    dryRunProtection: true,
    maxContinuousRunMinutes: 20,
    cooldownSeconds: 30,
  },
};

export const DEFAULT_SAFETY: SystemSafety = {
  emergencyStop: false,
  emergencyStopSource: null,
  maxLevelCutoffPercent: 97.0,
  commLossTimeoutMs: 5000,
  hardwareWatchdogSec: 6,
  lastHardwarePing: 0,
  isHardwareOnline: false,
  firmwareVersion: 'v3.0.0-single-tank-nodemcu',
  hardwareDevice: {
    megaModel: 'Arduino Mega 2560 R3',
    espChip: 'ESP8266 NodeMCU v3 (Gateway)',
    macAddress: 'DC:4F:22:9A:8C:3B',
    ipAddress: '192.168.1.145',
    rssi: 0,
    uptimeSeconds: 0,
  },
};

export const DEFAULT_AI_METRICS: AiLearnedMetrics = {
  tank1: {
    averageFillRateLitersPerMin: 18.5,
    estimatedFullFillDurationMin: 0,
    averageDrainRateLitersPerHour: 62.0,
    estimatedHoursRemaining: 0,
    totalLitersFilledToday: 0,
    totalLitersConsumedToday: 0,
  },
  tank2: {
    averageFillRateLitersPerMin: 18.5,
    estimatedFullFillDurationMin: 0,
    averageDrainRateLitersPerHour: 62.0,
    estimatedHoursRemaining: 0,
    totalLitersFilledToday: 0,
    totalLitersConsumedToday: 0,
  },
  peakUsageHour: 'સવારે ૧૦:૪૫ થી ૧૨:૧૫ (શાળા રિસેસ સમય)',
  smartRecommendation: 'હાર્ડવેર સેન્સર કનેક્શનની પ્રતિક્ષા છે. ESP8266 માંથી ટેલિમેટ્રી ડેટા મળતાં જ સચોટ વપરાશ પેટર્ન ગણવામાં આવશે.',
  lastAnalysisTimestamp: Date.now(),
};

export function createDefaultSystemState(): SystemState {
  const tank = { ...DEFAULT_TANK };
  return {
    mode: 'MANUAL',
    connectionState: 'DISCONNECTED',
    hardwareStatus: 'OFFLINE',
    tank,
    tank1: tank,
    tank2: tank,
    calibration: { ...DEFAULT_CALIBRATION },
    integration: { ...DEFAULT_INTEGRATION },
    pumpControlLocked: true,
    pumpControlLockReason: 'મોનિટરિંગ સિસ્ટમ સુરક્ષિત મોડમાં છે. વાસ્તવિક હાર્ડવેર રીલે અને સેફ્ટી વાયરિંગ ચકાસાયેલ નથી.',
    autoConfig: { ...DEFAULT_AUTO_CONFIG },
    safety: { ...DEFAULT_SAFETY },
    pendingCommands: [],
    recentLogs: [
      {
        id: 'log-init-default',
        timestamp: Date.now(),
        level: 'INFO',
        source: 'UI',
        message: 'કંટ્રોલર ઑફલાઇન છે. વાસ્તવિક હાર્ડવેર (Arduino/ESP8266) જોડાણની પ્રતિક્ષા છે.',
      },
    ],
    aiMetrics: { ...DEFAULT_AI_METRICS },
  };
}
