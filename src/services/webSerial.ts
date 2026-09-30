/**
 * Web Serial API Service for Arduino Uno Direct USB Communication
 * HydroSense Smart Water Tank Management System
 */

export type UsbConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
export type SerialConnectionMode = 'USB' | 'BLUETOOTH';

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

export interface ArduinoTelemetry {
  levelPercent: number;        // Actual measured water level (0 - 100%)
  distanceCm: number;          // Actual measured ultrasonic distance in cm
  pumpStatus: 'ON' | 'OFF';    // Physical pump relay state reported by Arduino
  targetPercent: number;       // Target setpoint reported by Arduino
  lastReceivedAt: number;      // Timestamp of last parsed packet
  isStale: boolean;            // True if no packet received within 3500ms
  rawLine: string;             // Raw string received from Arduino Uno / HC-05
}

export interface SerialErrorDetails {
  code: 'UNSUPPORTED' | 'NOT_ALLOWED' | 'BUSY' | 'PORT_ERROR' | 'DISCONNECTED' | 'PERMISSIONS_POLICY_DISALLOWED';
  message: string;
}

type TelemetryListener = (data: ArduinoTelemetry) => void;
type StatusListener = (status: UsbConnectionStatus, error?: SerialErrorDetails | null, mode?: SerialConnectionMode) => void;
type LogListener = (msg: string, type: 'info' | 'rx' | 'tx' | 'error') => void;

class WebSerialService {
  private port: any = null;
  private reader: any = null;
  private keepReading = false;
  private status: UsbConnectionStatus = 'DISCONNECTED';
  private mode: SerialConnectionMode = 'USB';
  private lastTelemetry: ArduinoTelemetry | null = null;
  private telemetryListeners: Set<TelemetryListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private logListeners: Set<LogListener> = new Set();
  private staleCheckInterval: any = null;
  private statusPollInterval: any = null;
  // Web Bluetooth (GATT BLE) fields
  private bluetoothDevice: any = null;
  private rxCharacteristic: any = null;
  private txCharacteristic: any = null;

  constructor() {
    if (typeof window !== 'undefined' && 'serial' in navigator) {
      (navigator as any).serial.addEventListener('disconnect', (event: any) => {
        if (this.port && event.port === this.port) {
          this.log('Arduino Uno USB cable was disconnected', 'error');
          this.handleDisconnect('USB cable unplugged or disconnected by system');
        }
      });
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && ('serial' in navigator || 'bluetooth' in navigator);
  }

  public isWebSerialSupported(): boolean {
    return typeof window !== 'undefined' && 'serial' in navigator;
  }

  public isWebBluetoothSupported(): boolean {
    return typeof window !== 'undefined' && 'bluetooth' in navigator;
  }

  public isPermissionsPolicyDisallowed(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const doc = document as any;
      if (doc.permissionsPolicy && typeof doc.permissionsPolicy.allowsFeature === 'function') {
        if (!doc.permissionsPolicy.allowsFeature('serial')) {
          return true;
        }
      }
      if (doc.featurePolicy && typeof doc.featurePolicy.allowsFeature === 'function') {
        if (!doc.featurePolicy.allowsFeature('serial')) {
          return true;
        }
      }
    } catch {
      // ignore
    }
    return false;
  }

  public isIframe(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }

  public getStatus(): UsbConnectionStatus {
    return this.status;
  }

  public getMode(): SerialConnectionMode {
    return this.mode;
  }

  public getLastTelemetry(): ArduinoTelemetry | null {
    return this.lastTelemetry;
  }

  public onTelemetry(listener: TelemetryListener): () => void {
    this.telemetryListeners.add(listener);
    if (this.lastTelemetry) listener(this.lastTelemetry);
    return () => this.telemetryListeners.delete(listener);
  }

  public onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status, null, this.mode);
    return () => this.statusListeners.delete(listener);
  }

  public onLog(listener: LogListener): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  private notifyStatus(status: UsbConnectionStatus, err?: SerialErrorDetails | null) {
    this.status = status;
    this.statusListeners.forEach((fn) => fn(status, err, this.mode));
  }

  private notifyTelemetry(data: ArduinoTelemetry) {
    this.lastTelemetry = data;
    this.telemetryListeners.forEach((fn) => fn(data));
  }

  private log(msg: string, type: 'info' | 'rx' | 'tx' | 'error' = 'info') {
    this.logListeners.forEach((fn) => fn(msg, type));
  }

  /**
   * Request serial port and open with specified mode:
   * - USB: 115200 baud (Direct Arduino Uno USB, works on Desktop & Android USB-OTG)
   * - BLUETOOTH: 9600 baud (HC-05 Windows Virtual COM port or Android Bluetooth RFCOMM / BLE)
   * MUST be invoked directly from a user gesture (e.g. button click)
   */
  public async connect(mode: SerialConnectionMode = 'USB'): Promise<boolean> {
    const isAndroid = isAndroidDevice();
    const hasSerial = this.isWebSerialSupported();
    const hasBluetooth = this.isWebBluetoothSupported();

    if (!hasSerial && !hasBluetooth) {
      const err: SerialErrorDetails = {
        code: 'UNSUPPORTED',
        message: isAndroid
          ? 'આ એન્ડ્રોઇડ બ્રાઉઝરમાં Web Serial અથવા Web Bluetooth ઉપલબ્ધ નથી. કૃપા કરીને Android પર Google Chrome વાપરો.'
          : 'Web Serial API આ બ્રાઉઝરમાં ઉપલબ્ધ નથી. કૃપા કરીને Google Chrome, Edge અથવા Opera વાપરો.',
      };
      this.log(err.message, 'error');
      this.notifyStatus('ERROR', err);
      return false;
    }

    // Check if Permissions Policy disallows Web Serial (common inside iframes without allow="serial")
    if (this.isPermissionsPolicyDisallowed()) {
      const err: SerialErrorDetails = {
        code: 'PERMISSIONS_POLICY_DISALLOWED',
        message: isAndroid
          ? 'આઇફ્રેમ (iframe) સુરક્ષા પ્રતિબંધને લીધે સીરીયલ બ્લોક છે. Android પર HC-05 કનેક્ટ કરવા માટે એપને નવી ટેબ ("Open in Direct Tab") માં ખોલો.'
          : 'આઇફ્રેમ (iframe) સુરક્ષા પ્રતિબંધને લીધે બ્રાઉઝરે Web Serial બ્લોક કર્યું છે. Arduino / HC-05 સાથે કનેક્ટ કરવા માટે એપને નવી અલગ વિન્ડો/ટેબ (Open in New Tab) માં ખોલો.',
      };
      this.log(err.message, 'error');
      this.notifyStatus('ERROR', err);
      return false;
    }

    if (this.status === 'CONNECTING' || this.status === 'CONNECTED') {
      return true;
    }

    this.mode = mode;
    const baudRate = mode === 'BLUETOOTH' ? 9600 : 115200;
    const modeLabel = mode === 'BLUETOOTH'
      ? isAndroid ? 'HC-05 Android Bluetooth (9600 Baud)' : 'HC-05 Bluetooth (9600 Baud)'
      : 'Arduino Uno USB (115200 Baud)';

    // If Bluetooth is requested and Web Serial is not available on this device, but Web Bluetooth is:
    if (mode === 'BLUETOOTH' && !hasSerial && hasBluetooth) {
      return await this.connectWebBluetooth();
    }

    this.notifyStatus('CONNECTING', null);
    this.log(`${modeLabel} પોર્ટ સિલેક્ટર ખોલી રહ્યું છે...`, 'info');

    try {
      // 1. Request port from user
      if (mode === 'BLUETOOTH') {
        try {
          // On Android Chrome & Desktop, passing allowedBluetoothServiceClassIds allows selecting HC-05 SPP
          this.port = await (navigator as any).serial.requestPort({
            allowedBluetoothServiceClassIds: [
              0x1101, // Standard Serial Port Profile (SPP) alias
              '00001101-0000-1000-8000-00805f9b34fb', // Standard 128-bit SPP UUID
              'serial_port',
            ],
          });
        } catch (optionsErr: any) {
          // Fallback if browser doesn't accept allowedBluetoothServiceClassIds
          if (optionsErr && (optionsErr.name === 'TypeError' || (optionsErr.message && optionsErr.message.includes('allowedBluetoothServiceClassIds')))) {
            this.port = await (navigator as any).serial.requestPort();
          } else {
            throw optionsErr;
          }
        }
      } else {
        this.port = await (navigator as any).serial.requestPort();
      }

      // 2. Open port at appropriate baud rate
      this.log(`સીરીયલ પોર્ટ ઓપન થઈ રહ્યું છે (Baud Rate: ${baudRate})...`, 'info');
      await this.port.open({ baudRate });

      this.keepReading = true;
      this.notifyStatus('CONNECTED', null);
      this.log(`${modeLabel} સાથે સફળતાપૂર્વક જોડાઈ ગયું!`, 'info');

      // 3. Start reader loop
      this.startReadingLoop();

      // 4. Setup heartbeat & poll intervals
      this.setupHeartbeat();

      return true;
    } catch (err: any) {
      console.warn('WebSerial request notice:', err?.message || err);
      let details: SerialErrorDetails;

      const isPolicyDisallowed =
        err.name === 'SecurityError' ||
        (err.message && err.message.toLowerCase().includes('permissions policy')) ||
        (err.message && err.message.toLowerCase().includes('disallowed'));

      if (isPolicyDisallowed) {
        details = {
          code: 'PERMISSIONS_POLICY_DISALLOWED',
          message: isAndroid
            ? 'આઇફ્રેમ (iframe) સુરક્ષા પ્રતિબંધને લીધે બ્લોક છે. Android પર વાપરવા માટે "Open in Direct Tab" દબાવો.'
            : 'આઇફ્રેમ (iframe) સુરક્ષા પ્રતિબંધને લીધે બ્રાઉઝરે Web Serial બ્લોક કર્યું છે. Arduino / HC-05 સાથે કનેક્ટ કરવા માટે એપને નવી અલગ વિન્ડો/ટેબ (Open in New Tab) માં ખોલો.',
        };
        this.log(details.message, 'error');
        this.notifyStatus('ERROR', details);
      } else if (err.name === 'NotFoundError') {
        details = {
          code: 'NOT_ALLOWED',
          message: mode === 'BLUETOOTH' && isAndroid
            ? 'કોઈ HC-05 ડિવાઇસ પસંદ કર્યું નથી. ખાતરી કરો કે ફોનમાં Android Settings -> Bluetooth માં જઈને HC-05 પેર કર્યું છે (PIN: 1234 અથવા 0000).'
            : 'કોઈ પોર્ટ પસંદ કરવામાં આવ્યો નથી (User cancelled).',
        };
        this.notifyStatus('DISCONNECTED', details);
      } else if (err.name === 'InvalidStateError' || (err.message && err.message.includes('already open'))) {
        details = {
          code: 'BUSY',
          message: 'આ COM પોર્ટ પહેલેથી જ ખુલ્લો છે અથવા અન્ય પ્રોગ્રામ વાપરી રહ્યું છે. કૃપા કરીને Arduino IDE Serial Monitor કે અન્ય સોફ્ટવેર બંધ કરો.',
        };
        this.log(details.message, 'error');
        this.notifyStatus('ERROR', details);
      } else if (err.name === 'NotAllowedError') {
        details = {
          code: 'NOT_ALLOWED',
          message: 'Serial પોર્ટની પરવાનગી નકારવામાં આવી (Permission denied).',
        };
        this.log(details.message, 'error');
        this.notifyStatus('ERROR', details);
      } else {
        // If mode is Bluetooth and Web Serial failed on Android, attempt Web Bluetooth fallback
        if (mode === 'BLUETOOTH' && hasBluetooth) {
          this.log('Web Serial અનિશ્ચિત, Web Bluetooth દ્વારા પ્રયાસ કરી રહ્યું છે...', 'info');
          return await this.connectWebBluetooth();
        }
        details = {
          code: 'PORT_ERROR',
          message: err.message || 'સીરીયલ પોર્ટ ઓપન કરવામાં ભૂલ આવી.',
        };
        this.log(`ભૂલ: ${details.message}`, 'error');
        this.notifyStatus('ERROR', details);
      }

      this.cleanup();
      return false;
    }
  }

  /**
   * Connect via Web Bluetooth (BLE GATT) fallback for Android or BLE modules
   */
  public async connectWebBluetooth(): Promise<boolean> {
    const isAndroid = isAndroidDevice();
    this.notifyStatus('CONNECTING', null);
    this.log('Web Bluetooth દ્વારા HC-05 / BLE ડિવાઇસ સ્કેન કરી રહ્યું છે...', 'info');

    try {
      const UART_SERVICES = [
        '0000ffe0-0000-1000-8000-00805f9b34fb', // Standard HM-10 / HC-08 / BLE Serial
        '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART
        '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent UART
      ];

      this.bluetoothDevice = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: UART_SERVICES,
      });

      this.bluetoothDevice.addEventListener('gattserverdisconnected', () => {
        this.log('Bluetooth ડિવાઇસ ડિસ્કનેક્ટ થયું', 'error');
        this.handleDisconnect('Bluetooth device disconnected');
      });

      this.log(`GATT સર્વર સાથે જોડાઈ રહ્યું છે (${this.bluetoothDevice.name || 'Bluetooth'})...`, 'info');
      const server = await this.bluetoothDevice.gatt.connect();

      let service: any = null;
      for (const uuid of UART_SERVICES) {
        try {
          service = await server.getPrimaryService(uuid);
          if (service) break;
        } catch {
          // continue checking other service UUIDs
        }
      }

      if (!service) {
        throw new Error('સુસંગત Serial/UART સર્વિસ મળી નથી.');
      }

      const characteristics = await service.getCharacteristics();
      for (const char of characteristics) {
        if (char.properties.notify || char.properties.indicate) {
          this.rxCharacteristic = char;
        }
        if (char.properties.write || char.properties.writeWithoutResponse) {
          this.txCharacteristic = char;
        }
      }

      if (this.rxCharacteristic) {
        await this.rxCharacteristic.startNotifications();
        const decoder = new TextDecoder();
        let bleBuffer = '';
        this.rxCharacteristic.addEventListener('characteristicvaluechanged', (event: any) => {
          const value = event.target.value;
          const textChunk = decoder.decode(value);
          bleBuffer += textChunk;
          let newlineIndex: number;
          while ((newlineIndex = bleBuffer.indexOf('\n')) >= 0) {
            const rawLine = bleBuffer.slice(0, newlineIndex).replace(/[\r\n]/g, '').trim();
            bleBuffer = bleBuffer.slice(newlineIndex + 1);
            if (rawLine.length > 0) {
              this.handleIncomingLine(rawLine);
            }
          }
        });
      }

      this.keepReading = true;
      this.mode = 'BLUETOOTH';
      this.notifyStatus('CONNECTED', null);
      this.log(`Bluetooth (${this.bluetoothDevice.name || 'HC-05'}) સાથે સફળતાપૂર્વક જોડાઈ ગયું!`, 'info');

      this.setupHeartbeat();
      return true;
    } catch (err: any) {
      console.warn('Web Bluetooth notice:', err);
      let details: SerialErrorDetails;
      if (err.name === 'NotFoundError') {
        details = {
          code: 'NOT_ALLOWED',
          message: isAndroid
            ? 'કોઈ Bluetooth ડિવાઇસ પસંદ કર્યું નથી. ખાતરી કરો કે ફોનમાં Bluetooth ચાલુ છે અને HC-05 પેર કરેલું છે (PIN: 1234/0000).'
            : 'કોઈ Bluetooth ડિવાઇસ પસંદ કર્યું નથી.',
        };
        this.notifyStatus('DISCONNECTED', details);
      } else {
        details = {
          code: 'PORT_ERROR',
          message: err.message || 'Bluetooth કનેક્શનમાં ભૂલ આવી.',
        };
        this.log(`Bluetooth ભૂલ: ${details.message}`, 'error');
        this.notifyStatus('ERROR', details);
      }
      this.cleanup();
      return false;
    }
  }

  /**
   * Setup periodic heartbeat & stale telemetry detector
   */
  private setupHeartbeat() {
    clearInterval(this.staleCheckInterval);
    clearInterval(this.statusPollInterval);

    setTimeout(() => {
      if (this.status === 'CONNECTED') {
        this.sendCommand('STATUS');
      }
    }, 1500);

    this.statusPollInterval = setInterval(() => {
      if (this.status === 'CONNECTED') {
        if (!this.lastTelemetry || Date.now() - this.lastTelemetry.lastReceivedAt > 2000) {
          this.sendCommand('STATUS');
        }
      }
    }, 2000);

    this.staleCheckInterval = setInterval(() => {
      if (this.lastTelemetry && this.status === 'CONNECTED') {
        const isStale = Date.now() - this.lastTelemetry.lastReceivedAt > 3500;
        if (isStale !== this.lastTelemetry.isStale) {
          this.lastTelemetry = { ...this.lastTelemetry, isStale };
          this.notifyTelemetry(this.lastTelemetry);
          if (isStale) {
            this.log(`ચેતવણી: ${this.mode === 'BLUETOOTH' ? 'HC-05' : 'Arduino'} માંથી છેલ્લી 3.5 સેકન્ડથી કોઈ ડેટા મળ્યો નથી (Stale data)`, 'error');
          }
        }
      }
    }, 1000);
  }

  /**
   * Background chunk reader & line buffer parser
   */
  private async startReadingLoop() {
    const decoder = new TextDecoder();
    let lineBuffer = '';

    while (this.port && this.port.readable && this.keepReading) {
      try {
        this.reader = this.port.readable.getReader();
        while (this.keepReading) {
          const { value, done } = await this.reader.read();
          if (done) {
            break;
          }
          if (value) {
            const textChunk = decoder.decode(value, { stream: true });
            lineBuffer += textChunk;

            // Split on newlines (\n or \r\n)
            let newlineIndex: number;
            while ((newlineIndex = lineBuffer.indexOf('\n')) >= 0) {
              const rawLine = lineBuffer.slice(0, newlineIndex).replace(/[\r\n]/g, '').trim();
              lineBuffer = lineBuffer.slice(newlineIndex + 1);
              if (rawLine.length > 0) {
                this.handleIncomingLine(rawLine);
              }
            }
          }
        }
      } catch (err: any) {
        if (this.keepReading) {
          console.warn('Serial read error:', err);
          this.log(`Serial read error: ${err.message}`, 'error');
        }
      } finally {
        if (this.reader) {
          try {
            this.reader.releaseLock();
          } catch {
            // ignore
          }
          this.reader = null;
        }
      }
    }
  }

  /**
   * Parse protocol lines from Arduino Uno or HC-05 Bluetooth:
   * Format: DISTANCE:4.37,LEVEL:81.8%
   * or: LEVEL:45,DISTANCE:7.28,PUMP:ON,TARGET:50
   */
  private handleIncomingLine(line: string) {
    this.log(line, 'rx');

    const upper = line.toUpperCase();
    // Check for standard telemetry line
    if (upper.includes('LEVEL:') && upper.includes('DISTANCE:')) {
      const parts = line.split(',');
      let level = NaN;
      let distance = NaN;
      let pump: 'ON' | 'OFF' = this.lastTelemetry?.pumpStatus || 'OFF';
      let target = this.lastTelemetry?.targetPercent || 85;

      for (const part of parts) {
        const colonIdx = part.indexOf(':');
        if (colonIdx === -1) continue;
        const key = part.slice(0, colonIdx).trim().toUpperCase();
        const rawVal = part.slice(colonIdx + 1).trim();
        const cleanVal = rawVal.replace(/%/g, '').trim();

        if (key === 'LEVEL') {
          level = parseFloat(cleanVal);
        } else if (key === 'DISTANCE') {
          distance = parseFloat(cleanVal);
        } else if (key === 'PUMP') {
          pump = cleanVal.toUpperCase() === 'ON' ? 'ON' : 'OFF';
        } else if (key === 'TARGET') {
          target = parseInt(cleanVal, 10);
        }
      }

      if (!isNaN(level) && !isNaN(distance)) {
        const telemetry: ArduinoTelemetry = {
          levelPercent: Math.max(0, Math.min(100, Math.round(level * 10) / 10)),
          distanceCm: Math.round(distance * 100) / 100,
          pumpStatus: pump,
          targetPercent: isNaN(target) ? 85 : Math.max(10, Math.min(100, target)),
          lastReceivedAt: Date.now(),
          isStale: false,
          rawLine: line,
        };
        this.notifyTelemetry(telemetry);
      }
    } else if (line.startsWith('ALERT:') || line.startsWith('ERROR:') || line.startsWith('INFO:')) {
      // Diagnostic messages from Arduino Uno / HC-05
      this.log(`Device Msg: ${line}`, 'info');
    }
  }

  /**
   * Send a command with a newline delimiter
   */
  public async sendCommand(cmd: string): Promise<boolean> {
    const trimmed = cmd.trim();

    // 1. If connected via Web Bluetooth GATT
    if (this.txCharacteristic && this.status === 'CONNECTED') {
      try {
        const encoder = new TextEncoder();
        await this.txCharacteristic.writeValue(encoder.encode(trimmed + '\n'));
        this.log(trimmed, 'tx');
        return true;
      } catch (err: any) {
        console.warn('Error sending BLE command:', err);
        this.log(`Bluetooth કમાન્ડ લખવામાં ભૂલ: ${err.message}`, 'error');
        return false;
      }
    }

    // 2. If connected via Web Serial
    if (!this.port || !this.port.writable || this.status !== 'CONNECTED') {
      this.log(`કમાન્ડ મોકલી શકાયો નહીં (જોડાયેલ નથી): ${trimmed}`, 'error');
      return false;
    }

    try {
      const encoder = new TextEncoder();
      const writer = this.port.writable.getWriter();
      const formatted = trimmed + '\n';
      await writer.write(encoder.encode(formatted));
      writer.releaseLock();
      this.log(trimmed, 'tx');
      return true;
    } catch (err: any) {
      console.warn('Error sending serial command:', err);
      this.log(`કમાન્ડ લખવામાં ભૂલ: ${err.message}`, 'error');
      return false;
    }
  }

  /**
   * Set target filling percentage (e.g. TARGET:50)
   */
  public async setTarget(percent: number): Promise<boolean> {
    const clamped = Math.max(10, Math.min(100, Math.round(percent / 5) * 5));
    return await this.sendCommand(`TARGET:${clamped}`);
  }

  /**
   * Start automatic filling (sends TARGET then START)
   */
  public async startFilling(targetPercent: number): Promise<boolean> {
    const clamped = Math.max(10, Math.min(100, Math.round(targetPercent / 5) * 5));
    this.log(`પાણી ભરવાનો આદેશ: ટાર્ગેટ=${clamped}%, START મોકલે છે...`, 'info');
    const targetOk = await this.sendCommand(`TARGET:${clamped}`);
    if (!targetOk) return false;
    // Small gap between commands to ensure Arduino input buffer parses separately
    await new Promise((resolve) => setTimeout(resolve, 60));
    return await this.sendCommand('START');
  }

  /**
   * Stop pump immediately
   */
  public async stopPump(): Promise<boolean> {
    this.log('મોટર સ્ટોપ આદેશ (STOP)...', 'info');
    return await this.sendCommand('STOP');
  }

  /**
   * Emergency Stop
   */
  public async emergencyStop(): Promise<boolean> {
    this.log('ઈમરજન્સી સ્ટોપ આદેશ (STOP x 2)...', 'error');
    await this.sendCommand('STOP');
    await new Promise((resolve) => setTimeout(resolve, 50));
    return await this.sendCommand('STOP');
  }

  /**
   * Request live status
   */
  public async requestStatus(): Promise<boolean> {
    return await this.sendCommand('STATUS');
  }

  /**
   * Disconnect cleanly
   */
  public async disconnect(): Promise<void> {
    const modeLabel = this.mode === 'BLUETOOTH' ? 'HC-05 Bluetooth' : 'Arduino Uno USB';
    this.log(`${modeLabel} ડિસ્કનેક્ટ કરી રહ્યું છે...`, 'info');
    // If pump was running, send stop first
    if (this.lastTelemetry && this.lastTelemetry.pumpStatus === 'ON') {
      try {
        await this.sendCommand('STOP');
      } catch {
        // ignore
      }
    }
    await this.handleDisconnect('User disconnected');
  }

  private async handleDisconnect(reason: string) {
    this.keepReading = false;
    clearInterval(this.staleCheckInterval);
    clearInterval(this.statusPollInterval);

    // Disconnect BLE GATT
    if (this.bluetoothDevice && this.bluetoothDevice.gatt && this.bluetoothDevice.gatt.connected) {
      try {
        this.bluetoothDevice.gatt.disconnect();
      } catch {
        // ignore
      }
    }
    this.bluetoothDevice = null;
    this.rxCharacteristic = null;
    this.txCharacteristic = null;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // ignore
      }
      try {
        this.reader.releaseLock();
      } catch {
        // ignore
      }
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch {
        // ignore
      }
      this.port = null;
    }

    const modeLabel = this.mode === 'BLUETOOTH' ? 'HC-05 Bluetooth' : 'Arduino Uno USB';
    this.notifyStatus('DISCONNECTED', {
      code: 'DISCONNECTED',
      message: reason,
    });
    this.log(`${modeLabel} ડિસ્કનેક્ટ થયું (${reason}).`, 'info');
  }

  private cleanup() {
    this.keepReading = false;
    clearInterval(this.staleCheckInterval);
    clearInterval(this.statusPollInterval);
    this.port = null;
    this.reader = null;
    if (this.bluetoothDevice && this.bluetoothDevice.gatt && this.bluetoothDevice.gatt.connected) {
      try {
        this.bluetoothDevice.gatt.disconnect();
      } catch {
        // ignore
      }
    }
    this.bluetoothDevice = null;
    this.rxCharacteristic = null;
    this.txCharacteristic = null;
  }
}

export const webSerial = new WebSerialService();
