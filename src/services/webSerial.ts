/**
 * Web Serial API & Bluetooth Service for Arduino Uno Direct USB & HC-05 Bluetooth
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
  targetPercent: number;       // Target setpoint reported by Arduino (20 - 90%)
  operatingMode: 'MANUAL' | 'AUTO'; // Operating mode confirmed by Arduino
  sensorError: string | null;  // Sensor error reported by Arduino or null
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

  // Bluetooth WebSocket Bridge fields (for Android and PC bridge compatibility)
  private bridgeSocket: WebSocket | null = null;
  private bridgeUrl: string = 'ws://localhost:8088';

  constructor() {
    if (typeof window !== 'undefined') {
      const savedUrl = localStorage.getItem('hydrosense_bt_bridge_url');
      if (savedUrl) {
        this.bridgeUrl = savedUrl;
      }

      if ('serial' in navigator) {
        (navigator as any).serial.addEventListener('disconnect', (event: any) => {
          if (this.port && event.port === this.port) {
            const label = this.mode === 'BLUETOOTH' ? 'HC-05 Bluetooth Serial' : 'Arduino Uno USB';
            this.log(`${label} કેબલ/કનેક્શન ડિસ્કનેક્ટ થયું`, 'error');
            this.handleDisconnect('Cable unplugged or disconnected by system');
          }
        });
      }
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && ('serial' in navigator || 'bluetooth' in navigator || 'WebSocket' in window);
  }

  public isWebSerialSupported(): boolean {
    return typeof window !== 'undefined' && 'serial' in navigator;
  }

  public isWebBluetoothSupported(): boolean {
    return typeof window !== 'undefined' && 'bluetooth' in navigator;
  }

  public getBridgeUrl(): string {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hydrosense_bt_bridge_url');
      if (saved) return saved;
    }
    return this.bridgeUrl;
  }

  public saveBridgeUrl(url: string): void {
    this.bridgeUrl = url.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem('hydrosense_bt_bridge_url', this.bridgeUrl);
    }
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
   * Connect via Web Serial API (Direct Arduino Uno USB, 115200 Baud)
   * Preserves USB Serial support for laptops and Android USB-OTG
   */
  public async connectUsb(): Promise<boolean> {
    const isAndroid = isAndroidDevice();
    if (!this.isWebSerialSupported()) {
      const err: SerialErrorDetails = {
        code: 'UNSUPPORTED',
        message: isAndroid
          ? 'આ Android બ્રાઉઝરમાં Web Serial API ઉપલબ્ધ નથી. કૃપા કરીને Android પર Google Chrome વાપરો.'
          : 'Web Serial API આ બ્રાઉઝરમાં ઉપલબ્ધ નથી. કૃપા કરીને Google Chrome, Edge અથવા Opera વાપરો.',
      };
      this.log(err.message, 'error');
      this.notifyStatus('ERROR', err);
      return false;
    }

    if (this.isPermissionsPolicyDisallowed()) {
      const err: SerialErrorDetails = {
        code: 'PERMISSIONS_POLICY_DISALLOWED',
        message: isAndroid
          ? 'આઇફ્રેમ (iframe) સુરક્ષા પ્રતિબંધને લીધે Web Serial બ્લોક છે. Android પર વાપરવા માટે "Open in Direct Tab" દબાવો.'
          : 'આઇફ્રેમ (iframe) સુરક્ષા પ્રતિબંધને લીધે બ્રાઉઝરે Web Serial બ્લોક કર્યું છે. Arduino Uno સાથે કનેક્ટ કરવા માટે એપને નવી અલગ વિન્ડો/ટેબ (Open in Direct Tab) માં ખોલો.',
      };
      this.log(err.message, 'error');
      this.notifyStatus('ERROR', err);
      return false;
    }

    if (this.status === 'CONNECTING' || this.status === 'CONNECTED') {
      return true;
    }

    // Clean previous connections
    this.cleanup();

    this.mode = 'USB';
    const baudRate = 115200;
    this.notifyStatus('CONNECTING', null);
    this.log('Arduino Uno USB (115200 Baud) પોર્ટ સિલેક્ટર ખોલી રહ્યું છે...', 'info');

    try {
      this.port = await (navigator as any).serial.requestPort();
      this.log(`સીરીયલ પોર્ટ ઓપન થઈ રહ્યું છે (Baud Rate: ${baudRate})...`, 'info');
      await this.port.open({ baudRate });

      this.keepReading = true;
      this.notifyStatus('CONNECTED', null);
      this.log('Arduino Uno USB સાથે સફળતાપૂર્વક જોડાઈ ગયું! (115200 Baud)', 'info');

      this.startReadingLoop();
      this.setupHeartbeat();
      return true;
    } catch (err: any) {
      console.warn('WebSerial USB request notice:', err?.message || err);
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
            : 'આઇફ્રેમ (iframe) સુરક્ષા પ્રતિબંધને લીધે બ્રાઉઝરે Web Serial બ્લોક કર્યું છે. નવી અલગ વિન્ડો/ટેબ (Open in Direct Tab) માં ખોલો.',
        };
        this.log(details.message, 'error');
        this.notifyStatus('ERROR', details);
      } else if (err.name === 'NotFoundError') {
        details = {
          code: 'NOT_ALLOWED',
          message: 'કોઈ USB પોર્ટ પસંદ કરવામાં આવ્યો નથી (User cancelled).',
        };
        this.notifyStatus('DISCONNECTED', details);
      } else if (err.name === 'InvalidStateError' || (err.message && err.message.includes('already open'))) {
        details = {
          code: 'BUSY',
          message: 'આ COM પોર્ટ પહેલેથી જ ખુલ્લો છે અથવા અન્ય પ્રોગ્રામ વાપરી રહ્યું છે. કૃપા કરીને Arduino IDE Serial Monitor બંધ કરો.',
        };
        this.log(details.message, 'error');
        this.notifyStatus('ERROR', details);
      } else if (err.name === 'NotAllowedError') {
        details = {
          code: 'NOT_ALLOWED',
          message: 'USB પોર્ટની પરવાનગી નકારવામાં આવી (Permission denied).',
        };
        this.log(details.message, 'error');
        this.notifyStatus('ERROR', details);
      } else {
        details = {
          code: 'PORT_ERROR',
          message: err.message || 'USB સીરીયલ પોર્ટ ઓપન કરવામાં ભૂલ આવી.',
        };
        this.log(`ભૂલ: ${details.message}`, 'error');
        this.notifyStatus('ERROR', details);
      }

      this.cleanup();
      return false;
    }
  }

  /**
   * Connect via Paired HC-05 Bluetooth Virtual COM Port on Laptops (Web Serial at 9600 Baud)
   * When HC-05 is paired in Windows/Mac/Linux settings, it exposes a Virtual COM port.
   * This handler opens that port specifically at 9600 Baud without faking.
   */
  public async connectBluetoothSerial(): Promise<boolean> {
    const isAndroid = isAndroidDevice();
    if (!this.isWebSerialSupported()) {
      const err: SerialErrorDetails = {
        code: 'UNSUPPORTED',
        message: isAndroid
          ? 'આ Android બ્રાઉઝરમાં Web Serial API ઉપલબ્ધ નથી. Android પર Bluetooth Bridge અથવા USB-OTG વાપરો.'
          : 'Web Serial API આ બ્રાઉઝરમાં ઉપલબ્ધ નથી. કૃપા કરીને Google Chrome, Edge અથવા Opera વાપરો.',
      };
      this.log(err.message, 'error');
      this.notifyStatus('ERROR', err);
      return false;
    }

    if (this.isPermissionsPolicyDisallowed()) {
      const err: SerialErrorDetails = {
        code: 'PERMISSIONS_POLICY_DISALLOWED',
        message: 'આઇફ્રેમ (iframe) સુરક્ષા પ્રતિબંધને લીધે Web Serial બ્લોક છે. "Open in Direct Tab" દબાવો.',
      };
      this.log(err.message, 'error');
      this.notifyStatus('ERROR', err);
      return false;
    }

    if (this.status === 'CONNECTING' || this.status === 'CONNECTED') {
      return true;
    }

    // Clean previous connections
    this.cleanup();

    this.mode = 'BLUETOOTH';
    const baudRate = 9600; // HC-05 default SPP baud rate
    this.notifyStatus('CONNECTING', null);
    this.log('HC-05 Paired Bluetooth Virtual COM Port (9600 Baud) પોર્ટ સિલેક્ટર ખોલી રહ્યું છે...', 'info');

    try {
      this.port = await (navigator as any).serial.requestPort();
      this.log(`HC-05 Bluetooth સીરીયલ પોર્ટ ઓપન થઈ રહ્યું છે (Baud Rate: ${baudRate})...`, 'info');
      await this.port.open({ baudRate });

      this.keepReading = true;
      this.notifyStatus('CONNECTED', null);
      this.log('HC-05 Bluetooth Serial (9600 Baud) સાથે સફળ જોડાણ થયું!', 'info');

      this.startReadingLoop();
      this.setupHeartbeat();
      return true;
    } catch (err: any) {
      console.warn('Bluetooth Serial request notice:', err?.message || err);
      let details: SerialErrorDetails;

      if (err.name === 'NotFoundError') {
        details = {
          code: 'NOT_ALLOWED',
          message: 'કોઈ Bluetooth COM પોર્ટ પસંદ કરવામાં આવ્યો નથી (User cancelled).',
        };
        this.notifyStatus('DISCONNECTED', details);
      } else if (err.name === 'InvalidStateError' || (err.message && err.message.includes('already open'))) {
        details = {
          code: 'BUSY',
          message: 'આ Bluetooth COM પોર્ટ પહેલેથી જ ખુલ્લો છે અથવા Serial Bluetooth Terminal / અન્ય પ્રોગ્રામ વાપરી રહ્યું છે.',
        };
        this.log(details.message, 'error');
        this.notifyStatus('ERROR', details);
      } else if (err.name === 'NotAllowedError') {
        details = {
          code: 'NOT_ALLOWED',
          message: 'Bluetooth COM પોર્ટની પરવાનગી નકારવામાં આવી (Permission denied).',
        };
        this.log(details.message, 'error');
        this.notifyStatus('ERROR', details);
      } else {
        details = {
          code: 'PORT_ERROR',
          message: err.message || 'HC-05 Bluetooth COM પોર્ટ ઓપન કરવામાં ભૂલ આવી.',
        };
        this.log(`ભૂલ: ${details.message}`, 'error');
        this.notifyStatus('ERROR', details);
      }

      this.cleanup();
      return false;
    }
  }

  /**
   * Connect via Bluetooth WebSocket Bridge (Practical Solution for Netlify & Android)
   * Connects to a local/remote bridge (e.g. bluetooth_bridge.py at ws://localhost:8088)
   * Does NOT fake connection: only shows CONNECTED when WebSocket is truly open.
   * Does NOT enter an infinite reconnect loop.
   */
  public async connectBluetoothBridge(customUrl?: string): Promise<boolean> {
    const url = customUrl?.trim() || this.getBridgeUrl();
    this.saveBridgeUrl(url);

    // Clean previous connections
    this.cleanup();

    this.mode = 'BLUETOOTH';
    this.notifyStatus('CONNECTING', null);
    this.log(`Bluetooth WebSocket બ્રિજ સાથે જોડાઈ રહ્યું છે (${url})...`, 'info');

    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(url);
        this.bridgeSocket = ws;

        let handled = false;

        // Strict connection timeout of 4 seconds to prevent hanging
        const timeoutTimer = setTimeout(() => {
          if (!handled && ws.readyState !== WebSocket.OPEN) {
            handled = true;
            try { ws.close(); } catch {}
            const details: SerialErrorDetails = {
              code: 'PORT_ERROR',
              message: `Bluetooth બ્રિજ (${url}) કનેક્શન ટાઈમઆઉટ. ખાતરી કરો કે 'python bluetooth_bridge.py' ચાલુ છે.`,
            };
            this.log(details.message, 'error');
            this.notifyStatus('ERROR', details);
            this.cleanup();
            resolve(false);
          }
        }, 4000);

        ws.onopen = () => {
          if (handled) return;
          handled = true;
          clearTimeout(timeoutTimer);
          this.keepReading = true;
          this.notifyStatus('CONNECTED', null);
          this.log(`Bluetooth WebSocket બ્રિજ (${url}) સાથે સફળ જોડાણ થયું!`, 'info');
          this.setupHeartbeat();
          this.sendCommand('STATUS');
          resolve(true);
        };

        ws.onmessage = (event) => {
          const data = event.data;
          if (typeof data === 'string') {
            const lines = data.split(/\r?\n/);
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed) {
                this.handleIncomingLine(trimmed);
              }
            }
          }
        };

        ws.onerror = (_event) => {
          if (handled) return;
          handled = true;
          clearTimeout(timeoutTimer);
          const details: SerialErrorDetails = {
            code: 'PORT_ERROR',
            message: `Bluetooth બ્રિજ સર્વર (${url}) સાથે જોડાણ થઈ શક્યું નહીં. ખાતરી કરો કે 'python bluetooth_bridge.py' ચાલી રહ્યું છે.`,
          };
          this.log(details.message, 'error');
          this.notifyStatus('ERROR', details);
          this.cleanup();
          resolve(false);
        };

        ws.onclose = (event) => {
          if (this.status === 'CONNECTED') {
            const reason = event.reason || `Code ${event.code}`;
            this.log(`Bluetooth બ્રિજ કનેક્શન બંધ થયું (${reason})`, 'error');
            this.handleDisconnect(`Bridge closed: ${reason}`);
          }
        };
      } catch (err: any) {
        const details: SerialErrorDetails = {
          code: 'PORT_ERROR',
          message: `WebSocket બ્રિજ ભૂલ: ${err?.message || 'કનેક્શન નિષ્ફળ'}`,
        };
        this.log(details.message, 'error');
        this.notifyStatus('ERROR', details);
        this.cleanup();
        resolve(false);
      }
    });
  }

  /**
   * Connect via Web Bluetooth API (BLE GATT)
   * Explains honestly that HC-05 is Bluetooth Classic SPP and does not support BLE GATT.
   */
  public async connectBluetoothBle(): Promise<boolean> {
    const isAndroid = isAndroidDevice();
    this.mode = 'BLUETOOTH';

    if (!this.isWebBluetoothSupported()) {
      const err: SerialErrorDetails = {
        code: 'UNSUPPORTED',
        message: isAndroid
          ? 'આ બ્રાઉઝરમાં Web Bluetooth ઉપલબ્ધ નથી. નોંધ: HC-05 Bluetooth Classic (SPP 9600 Baud) વાપરે છે, જે સ્ટાન્ડર્ડ Web Bluetooth માં સપોર્ટેડ નથી. Android પર Bluetooth Bridge અથવા USB-OTG વાપરો.'
          : 'આ બ્રાઉઝરમાં Web Bluetooth ઉપલબ્ધ નથી. નોંધ: HC-05 મોડ્યુલ Bluetooth Classic (SPP 9600 Baud) વાપરે છે. કૃપા કરીને Bluetooth Bridge અથવા લૅપટોપ Bluetooth COM Port વાપરો.',
      };
      this.log(err.message, 'error');
      this.notifyStatus('ERROR', err);
      return false;
    }

    this.notifyStatus('CONNECTING', null);
    this.log('Web Bluetooth ડિવાઇસ સિલેક્ટર ખોલી રહ્યું છે (નોંધ: ફક્ત BLE મોડ્યુલ્સ જ દેખાશે)...', 'info');

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
          // continue
        }
      }

      if (!service) {
        throw new Error('આ ડિવાઇસમાં સુસંગત BLE UART સર્વિસ મળી નથી. HC-05 એ Bluetooth Classic (SPP) મોડ્યુલ છે જે સ્ટાન્ડર્ડ Web Bluetooth GATT ને સપોર્ટ કરતું નથી. કૃપા કરીને Bluetooth Bridge અથવા Bluetooth COM Port વાપરો.');
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

      if (!this.rxCharacteristic && !this.txCharacteristic) {
        throw new Error('Bluetooth UART Characteristics મળ્યા નથી.');
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
      this.notifyStatus('CONNECTED', null);
      this.log(`Bluetooth (${this.bluetoothDevice.name || 'BLE'}) સાથે સફળતાપૂર્વક જોડાઈ ગયું!`, 'info');

      this.setupHeartbeat();
      return true;
    } catch (err: any) {
      console.warn('Web Bluetooth notice:', err);
      let details: SerialErrorDetails;

      if (err.name === 'NotFoundError') {
        details = {
          code: 'UNSUPPORTED',
          message: isAndroid
            ? 'નોંધ: તમારું HC-05 મોડ્યુલ Bluetooth Classic (SPP 9600 Baud) વાપરે છે, જે સ્ટાન્ડર્ડ Web Bluetooth API દ્વારા સપોર્ટેડ નથી (બ્રાઉઝર ફક્ત BLE ને સપોર્ટ કરે છે). કૃપા કરીને Bluetooth Bridge (python bluetooth_bridge.py) અથવા USB-OTG વાપરો.'
            : 'નોંધ: HC-05 મોડ્યુલ Bluetooth Classic (SPP) વાપરે છે, જે સ્ટાન્ડર્ડ Web Bluetooth API માં સપોર્ટેડ નથી. કૃપા કરીને લૅપટોપ Bluetooth COM Port (9600 Baud) અથવા Bluetooth Bridge વાપરો.',
        };
        this.log(details.message, 'error');
        this.notifyStatus('ERROR', details);
      } else {
        details = {
          code: 'PORT_ERROR',
          message: `${err.message || 'Bluetooth જોડાણ થઈ શક્યું નહીં'}. HC-05 Classic SPP માટે Bluetooth Bridge અથવા Bluetooth COM Port વાપરો.`,
        };
        this.log(`Bluetooth ભૂલ: ${details.message}`, 'error');
        this.notifyStatus('ERROR', details);
      }

      this.cleanup();
      return false;
    }
  }

  /**
   * Primary Bluetooth Dispatcher
   * Handles HC-05 connectivity based on method, avoiding false connections and infinite loops.
   */
  public async connectBluetooth(options?: {
    method?: 'serial' | 'bridge' | 'ble';
    bridgeUrl?: string;
  }): Promise<boolean> {
    const isAndroid = isAndroidDevice();

    if (options?.method === 'bridge') {
      return await this.connectBluetoothBridge(options.bridgeUrl);
    }
    if (options?.method === 'serial') {
      return await this.connectBluetoothSerial();
    }
    if (options?.method === 'ble') {
      return await this.connectBluetoothBle();
    }

    // Default intelligent behavior:
    // On laptops / PCs with Web Serial supported, open paired HC-05 Bluetooth COM port at 9600 Baud
    if (!isAndroid && this.isWebSerialSupported()) {
      return await this.connectBluetoothSerial();
    }

    // On Android or where Web Serial Bluetooth COM port is unavailable,
    // connect via Bluetooth WebSocket Bridge
    return await this.connectBluetoothBridge();
  }

  /**
   * General connect dispatcher
   */
  public async connect(mode: SerialConnectionMode = 'USB'): Promise<boolean> {
    if (mode === 'BLUETOOTH') {
      return await this.connectBluetooth();
    }
    return await this.connectUsb();
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
   * Format: LEVEL:45.0,DISTANCE:7.28,PUMP:ON,TARGET:75,MODE:AUTO,ERROR:NONE
   * or: LEVEL:81.8,DISTANCE:4.37,PUMP:OFF,TARGET:75,MODE:MANUAL
   */
  private handleIncomingLine(line: string) {
    this.log(line, 'rx');

    const upper = line.toUpperCase();
    if (upper.includes('LEVEL:') && upper.includes('DISTANCE:')) {
      const parts = line.split(',');
      let level = NaN;
      let distance = NaN;
      let pump: 'ON' | 'OFF' = this.lastTelemetry?.pumpStatus || 'OFF';
      let target = this.lastTelemetry?.targetPercent || 75;
      let mode: 'MANUAL' | 'AUTO' = this.lastTelemetry?.operatingMode || 'MANUAL';
      let sensorError: string | null = null;

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
        } else if (key === 'MODE') {
          mode = cleanVal.toUpperCase() === 'AUTO' ? 'AUTO' : 'MANUAL';
        } else if (key === 'ERROR') {
          sensorError = cleanVal.toUpperCase() === 'NONE' || cleanVal === '' ? null : cleanVal;
        }
      }

      // Enforce strict 20% to 90% target range
      const clampedTarget = isNaN(target) ? 75 : Math.max(20, Math.min(90, target));

      if (!isNaN(level) && !isNaN(distance)) {
        const telemetry: ArduinoTelemetry = {
          levelPercent: Math.max(0, Math.min(100, Math.round(level * 10) / 10)),
          distanceCm: Math.round(distance * 100) / 100,
          pumpStatus: pump,
          targetPercent: clampedTarget,
          operatingMode: mode,
          sensorError,
          lastReceivedAt: Date.now(),
          isStale: false,
          rawLine: line,
        };
        this.notifyTelemetry(telemetry);
      }
    } else if (line.startsWith('ERROR:')) {
      const errMsg = line.slice(6).trim();
      this.log(`Device Error: ${errMsg}`, 'error');
      if (this.lastTelemetry) {
        this.notifyTelemetry({
          ...this.lastTelemetry,
          sensorError: errMsg,
          lastReceivedAt: Date.now(),
          rawLine: line,
        });
      }
    } else if (line.startsWith('ALERT:') || line.startsWith('INFO:')) {
      this.log(`Device Msg: ${line}`, 'info');
    }
  }

  /**
   * Send a command with a newline delimiter
   * Works seamlessly across WebSocket Bridge, Web Serial (USB/COM), and Web Bluetooth BLE
   */
  public async sendCommand(cmd: string): Promise<boolean> {
    const trimmed = cmd.trim();

    // 1. If connected via Bluetooth WebSocket Bridge
    if (this.bridgeSocket && this.bridgeSocket.readyState === WebSocket.OPEN && this.status === 'CONNECTED') {
      try {
        this.bridgeSocket.send(trimmed + '\n');
        this.log(trimmed, 'tx');
        return true;
      } catch (err: any) {
        console.warn('Error sending bridge command:', err);
        this.log(`Bridge કમાન્ડ મોકલવામાં ભૂલ: ${err.message}`, 'error');
        return false;
      }
    }

    // 2. If connected via Web Bluetooth GATT
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

    // 3. If connected via Web Serial
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
   * Set target filling percentage (20% to 90%). Never sends a target above 90%.
   */
  public async setTarget(percent: number): Promise<boolean> {
    const clamped = Math.max(20, Math.min(90, Math.round(percent / 5) * 5));
    return await this.sendCommand(`TARGET:${clamped}`);
  }

  /**
   * Manual Mode: Start filling to target.
   * Sends TARGET:<selected percentage> followed by MODE:MANUAL and START.
   * Arduino starts the pump and stops it automatically at the target.
   */
  public async startFilling(targetPercent: number): Promise<boolean> {
    const clamped = Math.max(20, Math.min(90, Math.round(targetPercent / 5) * 5));
    this.log(`મેન્યુઅલ મોડ શરૂ: TARGET:${clamped} -> MODE:MANUAL -> START`, 'info');
    const targetOk = await this.sendCommand(`TARGET:${clamped}`);
    if (!targetOk) return false;
    await new Promise((resolve) => setTimeout(resolve, 60));
    const modeOk = await this.sendCommand('MODE:MANUAL');
    if (!modeOk) return false;
    await new Promise((resolve) => setTimeout(resolve, 60));
    return await this.sendCommand('START');
  }

  /**
   * Stop pump immediately (STOP command).
   */
  public async stopPump(): Promise<boolean> {
    this.log('મોટર તાત્કાલિક બંધ આદેશ (STOP)...', 'info');
    return await this.sendCommand('STOP');
  }

  /**
   * Automatic Mode: Enable Auto Mode.
   * Sends TARGET:<selected percentage> followed by MODE:AUTO.
   * Arduino automatically fills when water <= 15% and stops at target.
   */
  public async enableAutoMode(targetPercent: number): Promise<boolean> {
    const clamped = Math.max(20, Math.min(90, Math.round(targetPercent / 5) * 5));
    this.log(`ઓટો મોડ સક્રિય: TARGET:${clamped} -> MODE:AUTO`, 'info');
    const targetOk = await this.sendCommand(`TARGET:${clamped}`);
    if (!targetOk) return false;
    await new Promise((resolve) => setTimeout(resolve, 60));
    return await this.sendCommand('MODE:AUTO');
  }

  /**
   * Switch to Manual Mode (MODE:MANUAL).
   */
  public async disableAutoMode(): Promise<boolean> {
    this.log('ઓટો મોડ બંધ: MODE:MANUAL મોકલે છે...', 'info');
    return await this.sendCommand('MODE:MANUAL');
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
   * Disconnect cleanly without loops
   */
  public async disconnect(): Promise<void> {
    const modeLabel = this.mode === 'BLUETOOTH' ? 'HC-05 Bluetooth' : 'Arduino Uno USB';
    this.log(`${modeLabel} ડિસ્કનેક્ટ કરી રહ્યું છે...`, 'info');

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

    // Disconnect WebSocket bridge
    if (this.bridgeSocket) {
      try {
        this.bridgeSocket.onclose = null;
        this.bridgeSocket.onerror = null;
        this.bridgeSocket.close();
      } catch {
        // ignore
      }
      this.bridgeSocket = null;
    }

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

    if (this.bridgeSocket) {
      try {
        this.bridgeSocket.onclose = null;
        this.bridgeSocket.onerror = null;
        this.bridgeSocket.close();
      } catch {
        // ignore
      }
      this.bridgeSocket = null;
    }

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
