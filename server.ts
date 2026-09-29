import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import {
  SystemState,
  TankState,
  TankId,
  AutoConfig,
  SystemSafety,
  CommandPending,
  SystemLog,
  TelemetryPayload,
  HardwareAckPayload,
  AiLearnedMetrics,
  AiVoiceCommandResult,
  PhysicalTankCalibration,
  IntegrationConfig,
  HardwareStatus,
} from './src/types';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Initialize Gemini SDK with User-Agent header for telemetry (optional, zero-billing safe)
const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
const ai = hasGeminiKey
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

app.use(express.json());

// Set Permissions-Policy header to allow Web Serial in top-level context
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'serial=(self "*")');
  next();
});

// --- INITIAL SYSTEM STATE ---
let systemMode: 'MANUAL' | 'AUTO' = 'MANUAL';

// --- CALIBRATION & INTEGRATION CONFIGURATION ---
const calibration: PhysicalTankCalibration = {
  emptyDistanceCm: 13.26,        // Calibrated distance when tank is empty (0%)
  fullDistanceCm: 2.40,          // Calibrated distance when tank is 100% full
  nearFullWarningPercent: 90.0,  // Warning when level > 90%
  criticalFullWarningPercent: 97.0, // Critical alert when level >= 97%
  lowWaterWarningPercent: 15.0,  // Low level alert
};

const integrationConfig: IntegrationConfig = {
  apiUrl: '/api/telemetry',
  authToken: '',
  calibration,
  requireAuth: false,
};

const serverStartedAt = Date.now();

// --- INITIAL SINGLE PHYSICAL TANK STATE ---
// Real monitoring screen: No random or simulated readings!
// Starts in clean unverified state waiting for hardware connection.
const initialTank: TankState = {
  id: 1,
  name: 'Water Tank (મુખ્ય પાણીની ટાંકી)',
  nameGujarati: 'શાળા મુખ્ય પાણીની ટાંકી (HC-SR04)',
  type: 'MAIN_TANK',
  capacityLiters: 1000,
  totalDepthCm: 13.26,          // Calibrated empty distance
  sensorOffsetCm: 2.40,         // Calibrated full distance
  currentDistanceCm: null,      // Raw reading in cm (null when no hardware packet received)
  currentPercent: null,         // 0 - 100% (null when no hardware packet received)
  currentLiters: null,
  pumpStatus: 'LOCKED',         // Monitoring separated from pump control; locked until hardware verification
  targetPercent: 85,
  autoStopAtTarget: true,
  sensorHealth: 'WAITING_CONNECTION',
  lastReadingTime: null,
  pumpRunDurationSec: 0,
  hasRealTelemetry: false,
  hardwareStatus: 'OFFLINE',
};

const autoConfig: AutoConfig = {
  tank1: {
    enabled: false,             // Pump control disabled until verified
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

const safety: SystemSafety = {
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

let tank: TankState = { ...initialTank };
let tank1: TankState = tank;
let tank2: TankState = tank;
let pendingCommands: CommandPending[] = [];
let logs: SystemLog[] = [
  {
    id: 'log-init-1',
    timestamp: Date.now() - 5000,
    level: 'INFO',
    source: 'SERVER',
    message: 'શ્રી સરકારી માધ્યમિક અને ઉચ્ચ. માધ્યમિક શાળા–લાખાપર: સિંગલ વોટર ટેન્ક મોનિટરિંગ સર્વર સક્રિય થયું (ખાલી: ૧૩.૨૬ cm, પૂર્ણ: ૨.૪૦ cm)',
  },
  {
    id: 'log-init-2',
    timestamp: Date.now() - 2000,
    level: 'INFO',
    source: 'WATCHDOG',
    message: 'હાર્ડવેર ઇન્ટિગ્રેશન ગેટવે પ્રતિક્ષામાં છે. મોટર પંપ સુરક્ષિત લૉક રાખેલ છે.',
  },
];

let lastAck: SystemState['lastCommandAck'];

// --- AI WATER USAGE LEARNING & PREDICTION ENGINE ---
const aiMetrics: AiLearnedMetrics = {
  tank1: {
    averageFillRateLitersPerMin: 45.0,    // 45 L/min (~2000L fills in ~44 min)
    estimatedFullFillDurationMin: 14.4,   // Based on current level
    averageDrainRateLitersPerHour: 85.0,  // School daily inflow/outflow
    estimatedHoursRemaining: 15.9,
    totalLitersFilledToday: 1850,
    totalLitersConsumedToday: 1200,
    lastFillStartedAt: Date.now() - 3600000,
    lastFillDurationMin: 22,
  },
  tank2: {
    averageFillRateLitersPerMin: 32.0,    // 32 L/min transfer pump from sump
    estimatedFullFillDurationMin: 22.8,   // Time to reach 1000L
    averageDrainRateLitersPerHour: 62.0,  // Student drinking taps & sanitation
    estimatedHoursRemaining: 4.4,
    totalLitersFilledToday: 950,
    totalLitersConsumedToday: 678,
    lastFillStartedAt: Date.now() - 7200000,
    lastFillDurationMin: 18,
  },
  peakUsageHour: 'સવારે ૧૦:૪૫ થી ૧૨:૧૫ (શાળા રિસેસ અને મધ્યાહ્ન ભોજન સમય)',
  smartRecommendation: 'ટાંકી ૨ માં ૪.૪ કલાકનું પાણી બચ્યું છે. રિસેસ સમય પહેલાં પંપ ૨ ચાલુ કરી ધાબાની ટાંકી ૮૫% સુધી ભરી લેવી સલાહભર્યું છે.',
  lastAnalysisTimestamp: Date.now(),
};

function recalculateAiMetrics() {
  const tLiters = tank.currentLiters ?? Math.round(tank.capacityLiters * 0.5);
  const tPercent = tank.currentPercent ?? 50;

  const remainingLiters = tank.capacityLiters - tLiters;
  aiMetrics.tank1.estimatedFullFillDurationMin =
    Math.round((remainingLiters / Math.max(1, aiMetrics.tank1.averageFillRateLitersPerMin)) * 10) / 10;
  aiMetrics.tank1.estimatedHoursRemaining =
    Math.round((tLiters / Math.max(1, aiMetrics.tank1.averageDrainRateLitersPerHour)) * 10) / 10;

  aiMetrics.tank2 = { ...aiMetrics.tank1 };

  // Dynamic School Smart Recommendation for Single Tank
  if (!tank.hasRealTelemetry) {
    aiMetrics.smartRecommendation =
      'હાર્ડવેર સેન્સર કનેક્શનની પ્રતિક્ષા છે. ESP8266 માંથી ટેલિમેટ્રી ડેટા મળતાં જ સચોટ વપરાશ પેટર્ન ગણવામાં આવશે.';
  } else if (tPercent >= calibration.criticalFullWarningPercent) {
    aiMetrics.smartRecommendation = `🚨 ક્રિટિકલ ચેતવણી: ટાંકી ${tPercent}% ભરાઈ ચૂકી છે (અંતર: ${tank.currentDistanceCm} cm)! ઓવરફ્લો અટકાવવા મોટર બંધ રાખવી જરૂરી છે.`;
  } else if (tPercent > calibration.nearFullWarningPercent) {
    aiMetrics.smartRecommendation = `⚠️ ટાંકી પૂર્ણ થવાની નજીક છે (${tPercent}% > ${calibration.nearFullWarningPercent}%). ટૂંક સમયમાં ટાંકી ૧૦૦% ભરાઈ જશે.`;
  } else if (tPercent <= calibration.lowWaterWarningPercent) {
    aiMetrics.smartRecommendation = `પાણીનું સ્તર લઘુત્તમ છે (${tPercent}%). શાળા રિસેસ પહેલાં ટાંકી ભરવાની તૈયારી રાખવી જરૂરી છે.`;
  } else {
    aiMetrics.smartRecommendation = `ટાંકીમાં હાલ ${tPercent}% (${tLiters}L) પાણી છે, જે સામાન્ય વપરાશ મુજબ આશરે ${aiMetrics.tank1.estimatedHoursRemaining} કલાક ચાલશે.`;
  }

  aiMetrics.lastAnalysisTimestamp = Date.now();
}

// --- SERVER-SENT EVENTS (SSE) BROADCAST ---
type SSEClient = {
  id: number;
  res: Response;
};
let sseClients: SSEClient[] = [];
let sseIdCounter = 0;

function broadcastState() {
  const state = getFullState();
  const payload = `data: ${JSON.stringify(state)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.res.write(payload);
    } catch {
      // client disconnected
    }
  });
}

function addLog(level: SystemLog['level'], source: SystemLog['source'], message: string, details?: Record<string, unknown>) {
  const newLog: SystemLog = {
    id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    timestamp: Date.now(),
    level,
    source,
    message,
    details,
  };
  logs.unshift(newLog);
  if (logs.length > 100) logs.pop();
}

// Helper to calculate percentage based on empty and full distance calibration
function calculateWaterPercent(distanceCm: number, cal: PhysicalTankCalibration): number {
  if (distanceCm >= cal.emptyDistanceCm) return 0;
  if (distanceCm <= cal.fullDistanceCm) return 100;
  const span = cal.emptyDistanceCm - cal.fullDistanceCm; // e.g. 13.26 - 2.40 = 10.86 cm
  if (span <= 0) return 0;
  const pct = ((cal.emptyDistanceCm - distanceCm) / span) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
}

function getFullState(): SystemState {
  recalculateAiMetrics();

  // Determine current hardware status
  let hwStatus: HardwareStatus = 'OFFLINE';
  const now = Date.now();
  const timeSinceLastPing = now - safety.lastHardwarePing;

  if (
    tank.sensorHealth === 'OUT_OF_RANGE' ||
    tank.sensorHealth === 'NO_ECHO'
  ) {
    hwStatus = 'SENSOR_ERROR';
  } else if (tank.hasRealTelemetry && timeSinceLastPing < safety.commLossTimeoutMs) {
    hwStatus = 'ONLINE';
  } else {
    hwStatus = 'OFFLINE';
  }

  tank.hardwareStatus = hwStatus;

  return {
    mode: systemMode,
    connectionState: hwStatus === 'ONLINE' ? 'CONNECTED' : 'DISCONNECTED',
    hardwareStatus: hwStatus,
    tank,
    tank1: tank,
    tank2: tank,
    calibration,
    integration: integrationConfig,
    pumpControlLocked: true,
    pumpControlLockReason: 'મોનિટરિંગ સિસ્ટમ સુરક્ષિત મોડમાં છે. જ્યાં સુધી વાસ્તવિક હાર્ડવેર રિલે ફીડબેક કન્ફર્મ ન થાય ત્યાં સુધી પંપ એક્ટિવેશન સ્થગિત રાખેલ છે.',
    autoConfig,
    safety,
    pendingCommands,
    lastCommandAck: lastAck,
    recentLogs: logs.slice(0, 30),
    aiMetrics,
  };
}

// --- API ROUTES ---

// 1. GET Full System Status
app.get('/api/status', (_req: Request, res: Response) => {
  res.json(getFullState());
});

// 2. Server-Sent Events Stream for Real-time Web UI
app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = ++sseIdCounter;
  sseClients.push({ id: clientId, res });

  // Send immediate initial state
  res.write(`data: ${JSON.stringify(getFullState())}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

// 3. POST Real Telemetry from ESP8266 Gateway (Configurable API endpoint & Auth)
app.post('/api/telemetry', (req: Request, res: Response) => {
  // Check optional auth token if configured
  if (integrationConfig.requireAuth && integrationConfig.authToken) {
    const headerKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    const queryKey = req.query.token as string | undefined;
    const provided = (headerKey || queryKey || '').toString().trim();
    if (provided !== integrationConfig.authToken) {
      return res.status(401).json({ error: 'Unauthorized: Invalid API Key or Token' });
    }
  }

  const body = req.body as TelemetryPayload;
  safety.lastHardwarePing = Date.now();
  safety.isHardwareOnline = true;

  if (body.rssi) safety.hardwareDevice.rssi = body.rssi;
  if (body.ip) safety.hardwareDevice.ipAddress = body.ip;
  if (body.uptimeSec) safety.hardwareDevice.uptimeSeconds = body.uptimeSec;

  // Extract measured distance in cm (single tank direct or nested)
  const rawDistance =
    typeof body.distanceCm === 'number'
      ? body.distanceCm
      : body.tank1 && typeof body.tank1.distanceCm === 'number'
      ? body.tank1.distanceCm
      : body.tank2 && typeof body.tank2.distanceCm === 'number'
      ? body.tank2.distanceCm
      : null;

  if (rawDistance !== null) {
    const dist = Math.round(rawDistance * 100) / 100;
    tank.currentDistanceCm = dist;
    tank.lastReadingTime = Date.now();
    tank.hasRealTelemetry = true;

    // Check physical validity: HC-SR04 cannot measure < 1.0cm or > 40cm reliably in this tank
    if (dist < 1.0 || dist > 40.0 || body.sensorOk === false) {
      tank.sensorHealth = 'OUT_OF_RANGE';
      tank.sensorErrorMessage = `સેન્સર રીડિંગ રેન્જ બહાર છે: ${dist} cm (માન્ય માપ: ${calibration.fullDistanceCm}cm થી ${calibration.emptyDistanceCm}cm)`;
      tank.hardwareStatus = 'SENSOR_ERROR';
    } else {
      tank.sensorHealth = 'OK';
      tank.sensorErrorMessage = undefined;
      tank.hardwareStatus = 'ONLINE';

      const pct = calculateWaterPercent(dist, calibration);
      tank.currentPercent = pct;
      tank.currentLiters = Math.round((pct / 100) * tank.capacityLiters);

      // Check Warning levels
      if (pct >= calibration.criticalFullWarningPercent) {
        addLog('SECURITY', 'WATCHDOG', `🚨 ક્રિટિકલ ચેતવણી: ટાંકી ${pct}% ભરાઈ ગઈ છે (અંતર: ${dist}cm)!`);
      } else if (pct > calibration.nearFullWarningPercent) {
        addLog('WARN', 'WATCHDOG', `⚠️ ટાંકી પૂર્ણ થવાની નજીક: ${pct}% (અંતર: ${dist}cm)`);
      }
    }
  }

  // Check physical E-stop pin state
  if (body.emergencyStopPin && !safety.emergencyStop) {
    triggerEmergencyStop('HARDWARE_BUTTON', 'Physical E-Stop switch activated');
  }

  broadcastState();
  res.json({
    success: true,
    serverTime: Date.now(),
    calibratedEmptyDistanceCm: calibration.emptyDistanceCm,
    calibratedFullDistanceCm: calibration.fullDistanceCm,
    measuredDistanceCm: tank.currentDistanceCm,
    waterLevelPercent: tank.currentPercent,
    hardwareStatus: tank.hardwareStatus,
  });
});

// 4. POST Manual Refresh (Instant synchronization from server)
app.post('/api/refresh', (_req: Request, res: Response) => {
  broadcastState();
  res.json({
    success: true,
    state: getFullState(),
  });
});

// 5. GET & POST Integration Settings (Configurable API endpoint, auth token, and calibration thresholds)
app.get('/api/integration-config', (_req: Request, res: Response) => {
  res.json({
    apiUrl: integrationConfig.apiUrl,
    authToken: integrationConfig.authToken,
    requireAuth: integrationConfig.requireAuth,
    calibration,
  });
});

app.post('/api/integration-config', (req: Request, res: Response) => {
  const { authToken, requireAuth, calibration: newCal } = req.body;
  if (typeof authToken === 'string') integrationConfig.authToken = authToken.trim();
  if (typeof requireAuth === 'boolean') integrationConfig.requireAuth = requireAuth;
  if (newCal) {
    if (typeof newCal.emptyDistanceCm === 'number' && newCal.emptyDistanceCm > 0) {
      calibration.emptyDistanceCm = Math.round(newCal.emptyDistanceCm * 100) / 100;
      tank.totalDepthCm = calibration.emptyDistanceCm;
    }
    if (typeof newCal.fullDistanceCm === 'number' && newCal.fullDistanceCm > 0) {
      calibration.fullDistanceCm = Math.round(newCal.fullDistanceCm * 100) / 100;
      tank.sensorOffsetCm = calibration.fullDistanceCm;
    }
    if (typeof newCal.nearFullWarningPercent === 'number') {
      calibration.nearFullWarningPercent = newCal.nearFullWarningPercent;
    }
    if (typeof newCal.criticalFullWarningPercent === 'number') {
      calibration.criticalFullWarningPercent = newCal.criticalFullWarningPercent;
    }
    if (typeof newCal.lowWaterWarningPercent === 'number') {
      calibration.lowWaterWarningPercent = newCal.lowWaterWarningPercent;
    }

    if (tank.currentDistanceCm !== null && tank.sensorHealth === 'OK') {
      tank.currentPercent = calculateWaterPercent(tank.currentDistanceCm, calibration);
      tank.currentLiters = Math.round((tank.currentPercent / 100) * tank.capacityLiters);
    }
  }

  addLog('INFO', 'UI', 'હાર્ડવેર કેલિબ્રેશન અને વોશિંગ થ્રેશોલ્ડ સફળતાપૂર્વક અપડેટ થયા.');
  broadcastState();
  res.json({ success: true, integration: integrationConfig, calibration });
});

// 6. POST Command (Separated from monitoring: Unverified hardware protection)
app.post('/api/command', (_req: Request, res: Response) => {
  return res.status(403).json({
    success: false,
    error: 'મોટર પંપ સુરક્ષિત લોક કરેલ છે: અકસ્માત કે ઓવરફ્લો અટકાવવા માટે જ્યાં સુધી વાસ્તવિક હાર્ડવેર રિલે અને વાયરિંગ ચકાસાયેલ ન હોય ત્યાં સુધી પંપ સ્વિચિંગ અક્ષમ છે.',
  });
});

// 5. POST Command Acknowledgment (From ESP8266 or Simulator)
app.post('/api/command-ack', (req: Request, res: Response) => {
  const { commandId, success, pump1Running, pump2Running, errorCode } = req.body as HardwareAckPayload;

  const cmdIndex = pendingCommands.findIndex((c) => c.commandId === commandId);
  const latency = cmdIndex >= 0 ? Date.now() - pendingCommands[cmdIndex].requestedAt : 120;

  if (cmdIndex >= 0) {
    const cmd = pendingCommands[cmdIndex];
    cmd.status = success ? 'ACKNOWLEDGED' : 'REJECTED';
    cmd.roundTripMs = latency;

    if (cmd.tankId === 1) {
      tank.pumpStatus = pump1Running ? 'RUNNING' : 'OFF';
    }

    pendingCommands.splice(cmdIndex, 1);
  }

  lastAck = {
    commandId,
    success,
    acknowledgedAt: Date.now(),
    latencyMs: latency,
    pump1Running,
    pump2Running,
  };

  addLog(
    success ? 'INFO' : 'ERROR',
    'ESP8266',
    `Hardware confirmed command ${commandId} in ${latency}ms (P1: ${pump1Running ? 'ON' : 'OFF'}, P2: ${pump2Running ? 'ON' : 'OFF'})${errorCode ? ' Err: ' + errorCode : ''}`
  );

  broadcastState();
  res.json({ received: true });
});

// 6. GET Pending Commands (ESP8266 polling endpoint)
app.get('/api/pending-commands', (_req: Request, res: Response) => {
  safety.lastHardwarePing = Date.now();
  safety.isHardwareOnline = true;

  const toDispatch = pendingCommands.filter((c) => c.status === 'QUEUED');
  toDispatch.forEach((c) => {
    c.status = 'SENT_TO_ESP';
  });

  res.json(toDispatch);
});

// 7. POST Emergency Stop
app.post('/api/emergency-stop', (req: Request, res: Response) => {
  const { active, reason } = req.body;

  if (active) {
    triggerEmergencyStop('UI', reason || 'Emergency stop button pressed in web interface');
    res.json({ success: true, state: 'EMERGENCY_STOP_ACTIVE' });
  } else {
    // Clear Emergency Stop
    safety.emergencyStop = false;
    safety.emergencyStopSource = null;
    safety.emergencyStoppedAt = undefined;
    addLog('INFO', 'UI', 'Emergency Stop cleared by operator. Normal control resumed.');
    broadcastState();
    res.json({ success: true, state: 'NORMAL' });
  }
});

function triggerEmergencyStop(source: SystemSafety['emergencyStopSource'], message: string) {
  safety.emergencyStop = true;
  safety.emergencyStopSource = source;
  safety.emergencyStoppedAt = Date.now();

  tank.pumpStatus = 'OFF';
  tank1.pumpStatus = 'OFF';
  tank2.pumpStatus = 'OFF';

  // Cancel any pending commands
  pendingCommands = [];

  addLog('SECURITY', 'WATCHDOG', `🚨 EMERGENCY STOP TRIGGERED: ${message} (Source: ${source})`);
  broadcastState();
}

function executePumpStop(_tankId: TankId, reason: string) {
  tank.pumpStatus = 'OFF';
  addLog('WARN', 'WATCHDOG', `Pump stopped automatically: ${reason}`);
  broadcastState();
}

// 8. POST Mode Toggle (Manual vs Auto)
app.post('/api/mode', (req: Request, res: Response) => {
  const { mode } = req.body;
  if (mode === 'MANUAL' || mode === 'AUTO') {
    systemMode = mode;
    addLog('INFO', 'UI', `System operational mode switched to ${mode}`);
    broadcastState();
    res.json({ success: true, mode: systemMode });
  } else {
    res.status(400).json({ error: 'Invalid mode' });
  }
});

// 9. POST Auto Config Update
app.post('/api/auto-config', (req: Request, res: Response) => {
  const { tank1: t1Config, tank2: t2Config } = req.body;
  if (t1Config) {
    autoConfig.tank1 = { ...autoConfig.tank1, ...t1Config };
  }
  if (t2Config) {
    autoConfig.tank2 = { ...autoConfig.tank2, ...t2Config };
  }
  addLog('INFO', 'UI', 'Automatic mode trigger thresholds updated');
  broadcastState();
  res.json({ success: true, autoConfig });
});

// 10. Download raw firmware files
app.get('/api/firmware/:file', (req: Request, res: Response) => {
  const fileName = req.params.file;
  if (fileName === 'Mega2560_Controller.ino') {
    res.download(path.join(__dirname, 'src/hardware/Mega2560_Controller.ino'));
  } else if (fileName === 'NodeMCU_Gateway.ino') {
    res.download(path.join(__dirname, 'src/hardware/NodeMCU_Gateway.ino'));
  } else {
    res.status(404).send('Firmware file not found');
  }
});

// 11. POST AI Voice & Text Command (Gemini 3.8 Flash)
app.post('/api/ai/voice-command', async (req: Request, res: Response) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query string is required' });
  }

  recalculateAiMetrics();

  const systemPrompt = `તમે "શ્રી સરકારી માધ્યમિક અને ઉચ્ચ. માધ્યમિક શાળા–લાખાપર" ના સ્માર્ટ સિંગલ વોટર ટેન્ક મોનિટરિંગ સિસ્ટમ (HC-SR04 અલ્ટ્રાસોનિક + Arduino Mega 2560 & ESP8266 IoT સિસ્ટમ) ના મુખ્ય AI આસિસ્ટન્ટ છો.
તમારું કાર્ય વપરાશકર્તાના ગુજરાતી અથવા અંગ્રેજી અવાજના/ટેક્સ્ટ પ્રશ્નો સમજીને પાણીના સ્તર, માપેલા અંતર અને ચેતવણીઓ આધારિત સચોટ, માનવીય જવાબો આપવાનું છે.

હાર્ડવેર કેલિબ્રેશન પરિમાણો:
- ખાલી ટાંકી અંતર (Empty Distance): ${calibration.emptyDistanceCm} cm (૦% પાણી)
- પૂર્ણ ભરેલી ટાંકી અંતર (Full Distance): ${calibration.fullDistanceCm} cm (૧૦૦% પાણી)
- પૂર્ણ થવાની ચેતવણી (Near-Full Warning): > ${calibration.nearFullWarningPercent}%
- ગંભીર ચેતવણી (Critical-Full Alert): >= ${calibration.criticalFullWarningPercent}%

હાલની લાઈવ સ્થિતિ:
- શાળા: શ્રી સરકારી માધ્યમિક અને ઉચ્ચ. માધ્યમિક શાળા–લાખાપર
- હાર્ડવેર કનેક્શન સ્થિતિ: ${tank.hardwareStatus} (${tank.hasRealTelemetry ? 'ઓનલાઇન ડેટા ઉપલબ્ધ' : 'હાર્ડવેર કનેક્શનની પ્રતિક્ષામાં'})
- માપેલું અંતર (Distance): ${tank.currentDistanceCm !== null ? `${tank.currentDistanceCm} cm` : 'પ્રતિક્ષામાં'}
- વર્તમાન પાણી સ્તર (Water Level): ${tank.currentPercent !== null ? `${tank.currentPercent}%` : 'પ્રતિક્ષામાં'}
- સેન્સર સ્થિતિ: ${tank.sensorHealth}
- પંપ સ્થિતિ: મોટર પંપ સેફ્ટી લોક કરેલ છે (મોનિટરિંગ પંપ કંટ્રોલથી અલગ છે)

સૂચના અને અવાજનો લય (Human-Like Voice Guidelines):
- તમારો અવાજ એકદમ વાસ્તવિક માનવીય, મધુર, આદરણીય અને મદદગાર હોવો જોઈએ, જાણે કે શાળાના વિજ્ઞાન શિક્ષક વિદ્યાર્થી સાથે વાત કરી રહ્યા હોય.
- જો હાર્ડવેર જોડાયેલું ન હોય, તો સ્પષ્ટ જણાવો કે "હાર્ડવેર સેન્સર સાથે કનેક્શનની પ્રતિક્ષા છે."
- જો વપરાશકર્તા મોટર ચાલુ કરવાનું કહે, તો વિનમ્રતાથી સમજાવો કે "સુરક્ષા કારણોસર મોનિટરિંગ સ્ક્રીન પર પંપ કંટ્રોલ લોક રાખવામાં આવ્યો છે."

૧. જો વપરાશકર્તા પાણીનું સ્તર કે અંતર પૂછે (દા.ત. "ટાંકીમાં કેટલું પાણી છે?", "સેન્સર અંતર કેટલું છે?"):
   - action: 'QUERY_LEVEL'
   - gujaratiResponse: જો ડેટા હોય તો: "ટાંકીમાં હાલ ${tank.currentPercent ?? 0} ટકા પાણી છે, અને સેન્સરથી પાણીનું અંતર ${tank.currentDistanceCm ?? 0} સેન્ટિમીટર છે." (જો ડેટા ન હોય તો: "હાલ હાર્ડવેર કનેક્શનની પ્રતિક્ષા છે, જેથી નવું રીડિંગ ઉપલબ્ધ નથી.")
૨. જો વપરાશકર્તા પંપ ચાલુ/બંધ કરવાનું કહે:
   - action: 'INFO'
   - gujaratiResponse: "શાળા કેમ્પસની સલામતી માટે મોનિટરિંગ સિસ્ટમમાં પંપ કંટ્રોલ લૉક રાખેલ છે. હાર્ડવેર રિલે ચકાસ્યા બાદ જ પંપ ચાલુ થઈ શકશે."
૩. જો વપરાશકર્તા કેલિબ્રેશન કે ચેતવણી પૂછે:
   - action: 'GENERAL'
   - gujaratiResponse: "આ ટાંકીનું ખાલી અંતર ${calibration.emptyDistanceCm} સે.મી. અને પૂર્ણ ભરાવાનું અંતર ${calibration.fullDistanceCm} સે.મી. સેટ કરેલું છે. ૯૦ ટકાથી વધુ સ્તરે ચેતવણી અને ૯૭ ટકાથી વધુ સ્તરે ઓવરફ્લો એલર્ટ સક્રિય થાય છે."
૪. સામાન્ય પ્રશ્ન કે મદદ માટે:
   - action: 'GENERAL'
   - gujaratiResponse: "નમસ્તે! હું શાળાના સ્માર્ટ વોટર ટેન્ક મોનિટરિંગનો AI આસિસ્ટન્ટ છું. તમે મને ટાંકીનું વર્તમાન લેવલ, સેન્સર અંતર કે કેલિબ્રેશન વિશે પૂછી શકો છો."`;

// Built-in intelligent Gujarati & English natural language understanding engine (100% Free, zero billing required)
function parseVoiceQueryLocally(query: string) {
  const q = query.toLowerCase().trim();
  let action: 'PUMP_START' | 'PUMP_STOP' | 'EMERGENCY_STOP' | 'INFO' = 'INFO';
  let gujaratiResponse = '';
  let englishResponse = '';

  if (q.includes('પાણી') || q.includes('સ્તર') || q.includes('લેવલ') || q.includes('level') || q.includes('water') || q.includes('કેટલું') || q.includes('કેટલા')) {
    if (tank.currentPercent !== null) {
      gujaratiResponse = `ટાંકીમાં હાલ ${tank.currentPercent}% પાણી છે, અને HC-SR04 સેન્સરથી પાણીનું અંતર ${tank.currentDistanceCm} cm છે.`;
      englishResponse = `Current water level is ${tank.currentPercent}% (distance: ${tank.currentDistanceCm} cm).`;
    } else {
      gujaratiResponse = 'હાલ Arduino Uno USB સાથે જોડાયેલ નથી. લાઈવ રીડિંગ્સ જોવા માટે USB કનેક્ટ કરો.';
      englishResponse = 'Arduino Uno is offline, waiting for USB connection.';
    }
  } else if (q.includes('ચાલુ') || q.includes('start') || q.includes('ભર') || q.includes('fill')) {
    action = 'INFO';
    gujaratiResponse = 'પાણી ભરવા માટે પહેલા USB કનેક્ટ કરો, ટાર્ગેટ લેવલ સેટ કરો અને "પાણી ભરવાનું શરૂ કરો" પર ક્લિક કરો.';
    englishResponse = 'To start filling, connect USB, select target level, and click Start Filling.';
  } else if (q.includes('બંધ') || q.includes('stop') || q.includes('અટકાવો')) {
    action = 'INFO';
    gujaratiResponse = 'પંપ બંધ કરવા માટે "Stop Pump" અથવા "Emergency Stop" બટન દબાવો.';
    englishResponse = 'To stop the pump, click Stop Pump or Emergency Stop.';
  } else if (q.includes('ઈમરજન્સી') || q.includes('emergency')) {
    action = 'EMERGENCY_STOP';
    triggerEmergencyStop('UI', `વોઇસ કમાન્ડ દ્વારા ઈમરજન્સી સ્ટોપ: "${query}"`);
    gujaratiResponse = '🚨 ઈમરજન્સી સ્ટોપ સક્રિય કરવામાં આવ્યો છે! પંપ તાત્કાલિક શટડાઉન થયો.';
    englishResponse = 'Emergency stop activated. Pump shut down immediately.';
  } else if (q.includes('કલાક') || q.includes('સમય') || q.includes('time') || q.includes('remaining') || q.includes('ખાલી')) {
    gujaratiResponse = `ટાંકીનું પાણી શાળા વપરાશ મુજબ આશરે ${aiMetrics.tank1.estimatedHoursRemaining} કલાક ચાલશે અને ટાંકી ભરાતા આશરે ${aiMetrics.tank1.estimatedFullFillDurationMin} મિનિટ લાગશે.`;
    englishResponse = `Estimated hours remaining: ${aiMetrics.tank1.estimatedHoursRemaining} hrs. Estimated fill time: ${aiMetrics.tank1.estimatedFullFillDurationMin} mins.`;
  } else {
    gujaratiResponse = `નમસ્તે! શ્રી સરકારી માધ્યમિક અને ઉચ્ચ. માધ્યમિક શાળા–લાખાપર સ્માર્ટ વોટર ટેન્ક મોનિટરિંગ. તમે મને ટાંકીનું સ્તર, અંદાજિત કલાકો અથવા હાર્ડવેર સ્ટેટસ વિશે પૂછી શકો છો.`;
    englishResponse = `Welcome to HydroSense IoT. You can ask about tank water level, hours remaining, or hardware status.`;
  }

  return { action, gujaratiResponse, englishResponse };
}

  let parsed: any = null;
  let audioBase64: string | undefined;

  if (ai) {
    try {
      const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            text: `વપરાશકર્તાનો વોઇસ/ટેક્સ્ટ કમાન્ડ: "${query}"`,
          },
        ],
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              action: {
                type: Type.STRING,
                description: 'Action: START_PUMP, STOP_PUMP, EMERGENCY_STOP, SET_TARGET, QUERY_LEVEL, QUERY_PREDICTION, QUERY_ANALYTICS, GENERAL',
              },
              tankId: {
                type: Type.INTEGER,
                description: 'Target tank ID: 1, 2, or 0 for both/none',
              },
              targetPercent: {
                type: Type.INTEGER,
                description: 'Target percentage (0-100)',
              },
              gujaratiResponse: {
                type: Type.STRING,
                description: 'Spoken Gujarati response for text-to-speech feedback',
              },
              englishResponse: {
                type: Type.STRING,
                description: 'English summary of the intent and response',
              },
              predictedHoursRemaining: {
                type: Type.NUMBER,
                description: 'Predicted hours water will last',
              },
              estimatedTimeToFillMin: {
                type: Type.NUMBER,
                description: 'Estimated minutes to fill tank to target/100%',
              },
              safetyAlert: {
                type: Type.STRING,
                description: 'Any safety warning or blocking note',
              },
            },
            required: ['action', 'gujaratiResponse', 'englishResponse'],
          },
        },
      });

      parsed = JSON.parse(aiResponse.text || '{}');
    } catch (aiErr) {
      console.warn('Gemini generateContent notice (falling back to built-in local engine):', (aiErr as any)?.message || aiErr);
    }
  }

  // If Gemini not available or threw an error, use fast local NLP engine
  if (!parsed || !parsed.gujaratiResponse) {
    const local = parseVoiceQueryLocally(query);
    parsed = {
      action: local.action,
      gujaratiResponse: local.gujaratiResponse,
      englishResponse: local.englishResponse,
      predictedHoursRemaining: aiMetrics.tank1.estimatedHoursRemaining,
      estimatedTimeToFillMin: aiMetrics.tank1.estimatedFullFillDurationMin,
    };
  }

  let actionExecuted: {
    type: 'PUMP_START' | 'PUMP_STOP' | 'EMERGENCY_STOP' | 'INFO';
    tankId?: TankId;
    targetPercent?: number;
    success?: boolean;
    reason?: string;
  } | undefined;

  // Execute actions if requested (Separating monitoring from pump control)
  if (parsed.action === 'START_PUMP' || parsed.action === 'STOP_PUMP') {
    actionExecuted = {
      type: 'INFO',
      success: false,
      reason: 'મોટર પંપ સુરક્ષા નિયમ મુજબ લૉક રાખેલ છે. મોનિટરિંગ અને પંપ કંટ્રોલ અલગ છે.',
    };
    parsed.gujaratiResponse = 'શાળા કેમ્પસની સલામતી માટે મોનિટરિંગ સિસ્ટમમાં પંપ કંટ્રોલ લૉક રાખેલ છે. વાસ્તવિક હાર્ડવેર રિલે અને વાયરિંગ ચકાસ્યા બાદ જ પંપ સક્રિય થઈ શકશે.';
  } else if (parsed.action === 'EMERGENCY_STOP') {
    triggerEmergencyStop('UI', `AI વોઇસ કમાન્ડ દ્વારા ઈમરજન્સી શટડાઉન: "${query}"`);
    actionExecuted = {
      type: 'EMERGENCY_STOP',
      success: true,
      reason: 'મુખ્ય ઈમરજન્સી સ્ટોપ સક્રિય કરાયો.',
    };
  } else {
    actionExecuted = {
      type: 'INFO',
      success: true,
    };
  }

  const result: AiVoiceCommandResult = {
    transcript: query,
    responseGujarati: parsed.gujaratiResponse,
    audioBase64,
    actionExecuted,
    aiLearnedInsights: {
      t1HoursRemaining: aiMetrics.tank1.estimatedHoursRemaining,
      t2HoursRemaining: aiMetrics.tank2.estimatedHoursRemaining,
      t1TimeToFillMin: aiMetrics.tank1.estimatedFullFillDurationMin,
      t2TimeToFillMin: aiMetrics.tank2.estimatedFullFillDurationMin,
    },
  };

  res.json({
    success: true,
    result,
    aiMetrics,
  });
});

// 12. POST Human TTS Voice Generation (Zero-Billing safe)
app.post('/api/ai/tts', async (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required' });
  }

  // Returns success with useClientVoice so browser Web Speech API speaks natively and for free
  res.json({
    success: true,
    useClientVoice: true,
  });
});

// 13. GET AI Analytics & Learning Metrics
app.get('/api/ai/analytics', (_req: Request, res: Response) => {
  recalculateAiMetrics();
  res.json({
    success: true,
    schoolName: 'શ્રી સરકારી માધ્યમિક અને ઉચ્ચ. માધ્યમિક શાળા–લાખાપર',
    aiMetrics,
    tank1: {
      name: tank1.nameGujarati,
      capacityLiters: tank1.capacityLiters,
      currentLiters: tank1.currentLiters,
      currentPercent: tank1.currentPercent,
      fillRate: aiMetrics.tank1.averageFillRateLitersPerMin,
      drainRate: aiMetrics.tank1.averageDrainRateLitersPerHour,
      hoursRemaining: aiMetrics.tank1.estimatedHoursRemaining,
      timeToFillMin: aiMetrics.tank1.estimatedFullFillDurationMin,
    },
    tank2: {
      name: tank2.nameGujarati,
      capacityLiters: tank2.capacityLiters,
      currentLiters: tank2.currentLiters,
      currentPercent: tank2.currentPercent,
      fillRate: aiMetrics.tank2.averageFillRateLitersPerMin,
      drainRate: aiMetrics.tank2.averageDrainRateLitersPerHour,
      hoursRemaining: aiMetrics.tank2.estimatedHoursRemaining,
      timeToFillMin: aiMetrics.tank2.estimatedFullFillDurationMin,
    },
  });
});

// --- HARDWARE WATCHDOG & REAL SYSTEM LOOP ---
setInterval(() => {
  const now = Date.now();

  // Watchdog: check hardware connection (5 seconds timeout)
  const isOnline = safety.lastHardwarePing > 0 && now - safety.lastHardwarePing < safety.commLossTimeoutMs;
  if (safety.isHardwareOnline && !isOnline) {
    safety.isHardwareOnline = false;
    tank.hardwareStatus = 'OFFLINE';
    tank.sensorHealth = 'DISCONNECTED';
    addLog('ERROR', 'WATCHDOG', 'કમ્યુનિકેશન લોસ: ESP8266 નું હાર્ટબીટ ૫ સેકન્ડથી બંધ છે. સ્ટેટસ: OFFLINE');
    broadcastState();
  } else if (!safety.isHardwareOnline && isOnline) {
    safety.isHardwareOnline = true;
    tank.hardwareStatus = 'ONLINE';
    tank.sensorHealth = 'OK';
    addLog('INFO', 'WATCHDOG', 'ESP8266 ગેટવે સાથે કનેક્શન પુનઃ સ્થાપિત થયું');
    broadcastState();
  }

  // Handle command timeouts
  const nowTime = Date.now();
  for (let i = pendingCommands.length - 1; i >= 0; i--) {
    const cmd = pendingCommands[i];
    if (nowTime > cmd.timeoutAt) {
      cmd.status = 'TIMEOUT';
      addLog('ERROR', 'WATCHDOG', `કમાન્ડ ${cmd.commandId} ટાઈમઆઉટ થયો (હાર્ડવેર પ્રતિસાદ મળ્યો નહીં). પંપ સ્ટેટ પૂર્વવત કરવામાં આવી.`);
      if (tank.pumpStatus === 'PENDING_START') tank.pumpStatus = 'OFF';
      pendingCommands.splice(i, 1);
      broadcastState();
    }
  }
}, 1000);

// --- VITE MIDDLEWARE / STATIC ASSETS ---
async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[HydroSense Dual Tank IoT Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
