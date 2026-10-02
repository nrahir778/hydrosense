import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SystemState, TankId, AiVoiceCommandResult, TankState } from '../types';
import { createDefaultSystemState } from '../utils/initialState';
import {
  webSerial,
  isAndroidDevice,
  ArduinoTelemetry,
  UsbConnectionStatus,
  SerialConnectionMode,
  SerialErrorDetails,
} from '../services/webSerial';

export function useHydroSense() {
  // Initialize immediately with authentic default offline state so the app renders on frame 1
  const [state, setState] = useState<SystemState>(createDefaultSystemState);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [lastAiResult, setLastAiResult] = useState<AiVoiceCommandResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Web Serial State (USB & HC-05 Bluetooth Virtual COM)
  const [usbStatus, setUsbStatus] = useState<UsbConnectionStatus>(() => webSerial.getStatus());
  const [serialMode, setSerialMode] = useState<SerialConnectionMode>(() => webSerial.getMode());
  const [usbBaudRate, setUsbBaudRateState] = useState<number>(() => webSerial.getUsbBaudRate());
  const [usbError, setUsbError] = useState<string | null>(null);
  const [usbTelemetry, setUsbTelemetry] = useState<ArduinoTelemetry | null>(() => webSerial.getLastTelemetry());
  const isUsbSupported = webSerial.isSupported();
  const isIframeEmbedded = webSerial.isIframe();
  const isAndroid = useMemo(() => isAndroidDevice(), []);
  const [isPermissionsDisallowed, setIsPermissionsDisallowed] = useState<boolean>(() => webSerial.isPermissionsPolicyDisallowed());

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Set user-selected USB baud rate (9600 default, 115200, etc.)
  const setUsbBaudRate = useCallback((rate: number) => {
    webSerial.setUsbBaudRate(rate);
    setUsbBaudRateState(rate);
  }, []);

  // Controller is ONLY considered connected when real hardware telemetry is online via USB
  const isControllerConnected =
    usbStatus === 'CONNECTED' &&
    Boolean(usbTelemetry && !usbTelemetry.isStale && state.tank?.hasRealTelemetry);

  // Connect Web Serial via USB with selected baud rate (Default 9600)
  const connectUsb = useCallback(async (customBaudRate?: number): Promise<boolean> => {
    setIsSubmitting(true);
    setActionError(null);
    setUsbError(null);
    try {
      const rate = customBaudRate || usbBaudRate || 9600;
      setUsbBaudRateState(rate);
      const ok = await webSerial.connectUsb(rate);
      return ok;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'USB પોર્ટ સાથે જોડાણમાં ભૂલ આવી';
      setUsbError(msg);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [usbBaudRate]);

  // Connect via Bluetooth (Intelligent Handler supporting Paired COM & Bridge)
  const connectBluetooth = useCallback(
    async (options?: { method?: 'serial' | 'bridge' | 'ble'; bridgeUrl?: string } | unknown): Promise<boolean> => {
      setIsSubmitting(true);
      setActionError(null);
      setUsbError(null);
      try {
        const cleanOpts =
          options && typeof options === 'object' && 'method' in options
            ? (options as { method?: 'serial' | 'bridge' | 'ble'; bridgeUrl?: string })
            : undefined;
        const ok = await webSerial.connectBluetooth(cleanOpts);
        return ok;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'HC-05 Bluetooth સાથે જોડાણમાં ભૂલ આવી';
        setUsbError(msg);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  // Connect via Paired HC-05 Bluetooth Virtual COM Port (9600 Baud) on Laptops
  const connectBluetoothSerial = useCallback(async (): Promise<boolean> => {
    setIsSubmitting(true);
    setActionError(null);
    setUsbError(null);
    try {
      const ok = await webSerial.connectBluetoothSerial();
      return ok;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'HC-05 Bluetooth COM પોર્ટ સાથે જોડાણમાં ભૂલ આવી';
      setUsbError(msg);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  // Connect via Bluetooth WebSocket Bridge (ws://localhost:8088)
  const connectBluetoothBridge = useCallback(async (customUrl?: string): Promise<boolean> => {
    setIsSubmitting(true);
    setActionError(null);
    setUsbError(null);
    try {
      const ok = await webSerial.connectBluetoothBridge(customUrl);
      return ok;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bluetooth WebSocket બ્રિજ સાથે જોડાણમાં ભૂલ આવી';
      setUsbError(msg);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  // Disconnect Web Serial
  const disconnectUsb = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await webSerial.disconnect();
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  // Start Filling via USB/Bluetooth (TARGET:xx then START)
  const startUsbFilling = useCallback(async (targetPercent: number): Promise<boolean> => {
    setActionError(null);
    if (webSerial.getStatus() !== 'CONNECTED') {
      const err = 'કંટ્રોલર (USB/Bluetooth) જોડાયેલ નથી. કૃપા કરીને પહેલા કનેક્ટ કરો.';
      setActionError(err);
      return false;
    }
    if (!state.tank.hasRealTelemetry || state.tank.currentPercent === null) {
      const err = 'વાસ્તવિક સેન્સર રીડિંગ મળ્યું નથી. સલામતી નિયમ મુજબ સેન્સર ફીડબેક વગર પંપ શરૂ કરી શકાતો નથી.';
      setActionError(err);
      return false;
    }
    if (state.tank.currentPercent >= targetPercent) {
      const err = `પાણીનું સ્તર (${state.tank.currentPercent}%) પહેલેથી જ પસંદ કરેલા લક્ષ્યાંક (${targetPercent}%) પર અથવા તેનાથી ઉપર છે.`;
      setActionError(err);
      return false;
    }
    if (state.tank.currentPercent >= 97) {
      const err = 'ટાંકી ૯૭% કે તેથી વધુ ભરાયેલી છે (ક્રિટિકલ ઓવરફ્લો સેફ્ટી). પંપ શરૂ થઈ શકશે નહીં.';
      setActionError(err);
      return false;
    }

    setIsSubmitting(true);
    try {
      const ok = await webSerial.startFilling(targetPercent);
      if (!ok) {
        setActionError('કમાન્ડ મોકલવામાં નિષ્ફળતા. USB કનેક્શન તપાસો.');
      }
      return ok;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'કમાન્ડ ભૂલ';
      setActionError(msg);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [state.tank.hasRealTelemetry, state.tank.currentPercent]);

  // Stop Pump via USB (STOP)
  const stopUsbPump = useCallback(async (): Promise<boolean> => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const ok = await webSerial.stopPump();
      return ok;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'કમાન્ડ ભૂલ';
      setActionError(msg);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  // Emergency Stop via USB (STOP x 2)
  const emergencyStopUsb = useCallback(async (): Promise<boolean> => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const ok = await webSerial.emergencyStop();
      return ok;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ઈમરજન્સી સ્ટોપ ભૂલ';
      setActionError(msg);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  // Set Target Level via USB (TARGET:xx, 20% to 90%)
  const setUsbTarget = useCallback(async (pct: number): Promise<boolean> => {
    if (webSerial.getStatus() !== 'CONNECTED') return false;
    return await webSerial.setTarget(pct);
  }, []);

  // Enable Auto Mode via USB/Bluetooth (TARGET:xx then MODE:AUTO)
  const enableUsbAutoMode = useCallback(async (targetPercent: number): Promise<boolean> => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const ok = await webSerial.enableAutoMode(targetPercent);
      if (!ok) {
        setActionError('ઓટો મોડ કમાન્ડ મોકલવામાં નિષ્ફળતા. કનેક્શન તપાસો.');
      }
      return ok;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ઓટો મોડ સક્રિય કરવામાં ભૂલ';
      setActionError(msg);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  // Disable Auto Mode via USB/Bluetooth (MODE:MANUAL)
  const disableUsbAutoMode = useCallback(async (): Promise<boolean> => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const ok = await webSerial.disableAutoMode();
      return ok;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ઓટો મોડ બંધ કરવામાં ભૂલ';
      setActionError(msg);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  // WebSerial Subscriptions
  useEffect(() => {
    const unsubStatus = webSerial.onStatus((status, err, mode, baud) => {
      setUsbStatus(status);
      if (mode) {
        setSerialMode(mode);
      }
      if (baud) {
        setUsbBaudRateState(baud);
      }
      if (err) {
        setUsbError(err.message);
        if (err.code === 'PERMISSIONS_POLICY_DISALLOWED') {
          setIsPermissionsDisallowed(true);
        }
      } else if (status === 'CONNECTED') {
        setUsbError(null);
      }

      if (status === 'DISCONNECTED' || status === 'ERROR') {
        setUsbTelemetry(null);
        setState((prev) => {
          const offlineTank: TankState = {
            ...prev.tank,
            currentPercent: null,
            currentDistanceCm: null,
            currentLiters: null,
            pumpStatus: 'OFF',
            hasRealTelemetry: false,
            hardwareStatus: 'OFFLINE',
          };
          return {
            ...prev,
            hardwareStatus: 'OFFLINE',
            connectionState: 'DISCONNECTED',
            tank: offlineTank,
            tank1: offlineTank,
            safety: {
              ...prev.safety,
              isHardwareOnline: false,
            },
          };
        });
      }
    });

    const unsubTelemetry = webSerial.onTelemetry((telemetry) => {
      setUsbTelemetry(telemetry);
      setState((prev) => {
        const isStale = telemetry.isStale;
        const hasValidLevel = !isStale && telemetry.levelPercent !== null && !isNaN(telemetry.levelPercent) && telemetry.levelPercent >= 0 && telemetry.levelPercent <= 100;
        const hasValidDistance = !isStale && telemetry.distanceCm !== null && !isNaN(telemetry.distanceCm) && telemetry.distanceCm > 0;
        const validSensor = !isStale && (hasValidLevel || hasValidDistance) && !telemetry.sensorError;
        const hwStatus = isStale
          ? 'OFFLINE'
          : telemetry.sensorError
          ? 'SENSOR_ERROR'
          : validSensor
          ? 'ONLINE'
          : 'SENSOR_ERROR';
        const sensorHealth = telemetry.sensorError ? 'OUT_OF_RANGE' : validSensor ? 'OK' : 'OUT_OF_RANGE';
        const currentLiters = hasValidLevel
          ? Math.round((telemetry.levelPercent / 100) * prev.tank.capacityLiters)
          : null;

        const updatedTank: TankState = {
          ...prev.tank,
          currentPercent: hasValidLevel ? telemetry.levelPercent : null,
          currentDistanceCm: hasValidDistance ? telemetry.distanceCm : null,
          currentLiters,
          pumpStatus: telemetry.pumpStatus === 'ON' ? 'RUNNING' : 'OFF',
          targetPercent: telemetry.targetPercent,
          operatingMode: telemetry.operatingMode,
          sensorHealth,
          sensorError: telemetry.sensorError,
          hasRealTelemetry: validSensor,
          lastReadingTime: telemetry.lastReceivedAt,
          hardwareStatus: hwStatus,
        };

        return {
          ...prev,
          mode: telemetry.operatingMode,
          hardwareStatus: hwStatus,
          connectionState: isStale ? 'DISCONNECTED' : 'CONNECTED',
          tank: updatedTank,
          tank1: updatedTank,
          safety: {
            ...prev.safety,
            isHardwareOnline: !isStale,
            lastHardwarePing: telemetry.lastReceivedAt,
          },
        };
      });
    });

    const unsubLog = webSerial.onLog((msg, type) => {
      setState((prev) => ({
        ...prev,
        recentLogs: [
          {
            id: `usb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: Date.now(),
            level: type === 'error' ? 'ERROR' : type === 'tx' || type === 'rx' ? 'INFO' : 'INFO',
            source: 'MEGA',
            message: `[USB ${type.toUpperCase()}] ${msg}`,
          },
          ...prev.recentLogs.slice(0, 49),
        ],
      }));
    });

    return () => {
      unsubStatus();
      unsubTelemetry();
      unsubLog();
    };
  }, []);

  // Fetch status directly via HTTP GET with a strict 4-second timeout
  const fetchStatus = useCallback(async (isManualRetry = false): Promise<SystemState | null> => {
    if (isManualRetry) {
      setIsCheckingConnection(true);
      setConnectionError(null);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch('/api/status', {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`સર્વર પ્રતિસાદ મળ્યો નહીં (HTTP ${res.status})`);
      }

      const data = (await res.json()) as SystemState;
      // If USB is actively connected, keep USB real telemetry
      setState((prev) => {
        if (webSerial.getStatus() === 'CONNECTED' && webSerial.getLastTelemetry()) {
          return {
            ...data,
            tank: prev.tank,
            tank1: prev.tank1,
            hardwareStatus: prev.hardwareStatus,
            connectionState: prev.connectionState,
          };
        }
        return data;
      });
      setIsBackendConnected(true);
      setConnectionError(null);
      return data;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      setIsBackendConnected(false);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const errMsg = isAbort
        ? 'કંટ્રોલર કનેક્શન ટાઈમઆઉટ: ૪ સેકન્ડમાં પ્રતિસાદ મળ્યો નહીં.'
        : 'કંટ્રોલર અને સર્વર સાથે જોડાણ થઈ શક્યું નથી.';
      setConnectionError(errMsg);
      return null;
    } finally {
      if (isManualRetry) {
        setIsCheckingConnection(false);
      }
    }
  }, []);

  // Manual Retry connection function
  const retryConnection = useCallback(async () => {
    if (webSerial.getStatus() === 'CONNECTED') {
      await webSerial.requestStatus();
    } else {
      await connectUsb();
    }
    await fetchStatus(true);
  }, [connectUsb, fetchStatus]);

  // Setup SSE stream with fallback polling
  const initEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
      } catch {
        // ignore
      }
    }

    try {
      const es = new EventSource('/api/events');
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsBackendConnected(true);
        setConnectionError(null);
      };

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as SystemState;
          setState((prev) => {
            if (webSerial.getStatus() === 'CONNECTED' && webSerial.getLastTelemetry()) {
              return {
                ...parsed,
                tank: prev.tank,
                tank1: prev.tank1,
                hardwareStatus: prev.hardwareStatus,
                connectionState: prev.connectionState,
              };
            }
            return parsed;
          });
          setIsBackendConnected(true);
          setConnectionError(null);
        } catch (err) {
          console.error('Failed to parse SSE payload:', err);
        }
      };

      es.onerror = () => {
        setIsBackendConnected(false);
        try {
          es.close();
        } catch {
          // ignore
        }
      };
    } catch (err) {
      console.warn('EventSource initialization warning:', err);
    }
  }, []);

  // Lifecycle on mount: Immediate fetch + SSE + fallback poll
  useEffect(() => {
    fetchStatus(false);
    initEventSource();

    pollTimerRef.current = setInterval(() => {
      if (!eventSourceRef.current || eventSourceRef.current.readyState !== EventSource.OPEN) {
        fetchStatus(false);
      }
    }, 4000);

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [fetchStatus, initEventSource]);

  // Send pump control command (Protected)
  const controlPump = useCallback(
    async (tankId: TankId, action: 'START' | 'STOP', targetPercent?: number, autoStopAtTarget = true) => {
      if (webSerial.getStatus() === 'CONNECTED') {
        if (action === 'START') {
          return await startUsbFilling(targetPercent ?? 85);
        } else {
          return await stopUsbPump();
        }
      }

      setIsSubmitting(true);
      setActionError(null);
      try {
        const res = await fetch('/api/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'PUMP_CONTROL',
            tankId,
            action,
            targetPercent,
            autoStopAtTarget,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'મોટર કમાન્ડ મોકલવામાં નિષ્ફળતા');
        }
        return data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'અજ્ઞાત ભૂલ આવી છે';
        setActionError(msg);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [startUsbFilling, stopUsbPump]
  );

  // Trigger or clear emergency stop
  const setEmergencyStop = useCallback(async (active: boolean, reason?: string) => {
    if (webSerial.getStatus() === 'CONNECTED' && active) {
      await emergencyStopUsb();
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch('/api/emergency-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ઈમરજન્સી સ્ટોપ સ્થિતિ બદલવામાં નિષ્ફળતા');
      }
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'અજ્ઞાત ભૂલ આવી છે';
      setActionError(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [emergencyStopUsb]);

  // Switch between Manual and Auto modes
  const setMode = useCallback(async (mode: 'MANUAL' | 'AUTO') => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch('/api/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'સિસ્ટમ મોડ બદલવામાં નિષ્ફળતા');
      }
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'અજ્ઞાત ભૂલ આવી છે';
      setActionError(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  // Update auto thresholds
  const updateAutoConfig = useCallback(async (config: Partial<SystemState['autoConfig']>) => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch('/api/auto-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ઓટોમેશન સેટિંગ્સ અપડેટ કરવામાં નિષ્ફળતા');
      }
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'અજ્ઞાત ભૂલ આવી છે';
      setActionError(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  // Execute AI Voice & Text Command
  const executeAiVoiceCommand = useCallback(async (query: string): Promise<AiVoiceCommandResult> => {
    setIsAiThinking(true);
    setActionError(null);
    try {
      const res = await fetch('/api/ai/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI કમાન્ડ પ્રોસેસ કરવામાં નિષ્ફળતા');
      }
      setLastAiResult(data.result);
      return data.result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI સેવા ઉપલબ્ધ નથી';
      setActionError(msg);
      throw err;
    } finally {
      setIsAiThinking(false);
    }
  }, []);

  // Manual refresh status
  const refreshStatus = useCallback(async () => {
    if (webSerial.getStatus() === 'CONNECTED') {
      await webSerial.requestStatus();
    }
    return await fetchStatus(true);
  }, [fetchStatus]);

  // Update integration and calibration settings
  const updateIntegrationConfig = useCallback(
    async (payload: {
      authToken?: string;
      requireAuth?: boolean;
      calibration?: Partial<SystemState['calibration']>;
    }) => {
      setIsSubmitting(true);
      setActionError(null);
      try {
        const res = await fetch('/api/integration-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'સેટિંગ્સ અપડેટ કરવામાં નિષ્ફળતા');
        }
        await refreshStatus();
        return data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'સેટિંગ્સ સેવ નિષ્ફળ';
        setActionError(msg);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [refreshStatus]
  );

  return {
    state,
    isConnected: isBackendConnected,
    isControllerConnected,
    isCheckingConnection,
    connectionError,
    retryConnection,
    isSubmitting,
    isAiThinking,
    lastAiResult,
    actionError,
    clearActionError: () => setActionError(null),
    controlPump,
    setEmergencyStop,
    setMode,
    updateAutoConfig,
    executeAiVoiceCommand,
    refreshStatus,
    updateIntegrationConfig,
    // Web Serial USB & Bluetooth Additions
    usbStatus,
    serialMode,
    usbBaudRate,
    setUsbBaudRate,
    usbError,
    usbTelemetry,
    isUsbSupported,
    isIframeEmbedded,
    isPermissionsDisallowed,
    isAndroid,
    connectUsb,
    connectBluetooth,
    connectBluetoothSerial,
    connectBluetoothBridge,
    getBridgeUrl: () => webSerial.getBridgeUrl(),
    setBridgeUrl: (url: string) => webSerial.saveBridgeUrl(url),
    disconnectUsb,
    startUsbFilling,
    stopUsbPump,
    emergencyStopUsb,
    setUsbTarget,
    enableUsbAutoMode,
    disableUsbAutoMode,
  };
}
