export interface PinoutItem {
  pin: string;
  component: string;
  role: string;
  voltage: string;
  notes: string;
}

export const ARDUINO_UNO_PINOUT: PinoutItem[] = [
  { pin: 'USB Type-B', component: 'Host Computer / Chrome Browser', role: 'Web Serial 115200 Baud Communication & 5V Power', voltage: '5V USB', notes: 'Connects directly to PC running Chrome/Edge. Communicates via Web Serial API with newline-delimited protocol.' },
  { pin: 'D9', component: 'HC-SR04 Ultrasonic Trigger', role: 'Sends 10µs ultrasonic pulse', voltage: '5V TTL', notes: 'Connected directly to HC-SR04 TRIG pin.' },
  { pin: 'D10', component: 'HC-SR04 Ultrasonic Echo', role: 'Measures return echo pulse duration', voltage: '5V TTL', notes: 'Pulse width corresponds to distance (duration * 0.0343 / 2 cm).' },
  { pin: 'D7', component: '5V Relay Module IN', role: 'Pump Motor Control Relay (Active-LOW)', voltage: '5V Logic', notes: 'CRITICAL: Active-LOW. LOW = Relay Energized (Pump ON), HIGH = Relay De-energized (Pump OFF). Default OFF.' },
  { pin: 'D8', component: 'Piezo Buzzer (+)', role: 'Acoustic Alarm & Beep Chimes', voltage: '5V', notes: 'Sounds on Target Reached, Sensor Fault, or Emergency Stop.' },
  { pin: 'D13', component: 'Built-in Status LED', role: 'Heartbeat & Filling Indicator', voltage: '5V', notes: 'Flashes fast while pump is filling; solid when idle.' },
  { pin: '5V Rail', component: 'Sensor & Opto VCC', role: 'Powers HC-SR04 and Relay Optocoupler VCC', voltage: '5V DC', notes: 'NEVER power the pump motor from this pin!' },
  { pin: 'GND', component: 'Common Ground', role: 'Reference Ground', voltage: '0V', notes: 'Tied to HC-SR04 GND, Relay GND, and Buzzer (-).' },
];

export const MEGA_PINOUT: PinoutItem[] = [
  { pin: 'D2 (INT4)', component: 'Emergency Stop Switch', role: 'Hardware interrupt (Normally Closed)', voltage: '5V (Internal Pull-Up)', notes: 'Triggers instantaneous hardware shutdown in firmware ISR without waiting for loop cycles' },
  { pin: 'D13', component: 'Heartbeat LED', role: 'Hardware sanity monitor', voltage: '5V', notes: 'Toggles every 1 second to confirm CPU loop execution' },
  { pin: 'D14 (TX3)', component: 'ESP8266 Communication', role: 'Serial3 TX -> Level Shifter -> ESP RX', voltage: '5V -> 3.3V', notes: 'CRITICAL: Must pass through 1kΩ / 2kΩ voltage divider or bidirectional logic converter' },
  { pin: 'D15 (RX3)', component: 'ESP8266 Communication', role: 'Serial3 RX <- ESP TX', voltage: '3.3V -> 5V', notes: 'ESP 3.3V HIGH is safely detected by Mega 5V TTL input (Vih = 3.0V)' },
  { pin: 'D22', component: 'HC-SR04 Tank 1', role: 'Ultrasonic Trigger Pin', voltage: '5V', notes: 'Sends 10µs ultrasonic pulse' },
  { pin: 'D23', component: 'HC-SR04 Tank 1', role: 'Ultrasonic Echo Pin', voltage: '5V', notes: 'High pulse width corresponds to distance (duration * 0.0343 / 2)' },
  { pin: 'D26', component: 'Relay Module IN1', role: 'Pump 1 Motor Relay', voltage: '5V', notes: 'Active LOW: LOW activates motor, HIGH shuts off. Optocoupler isolated' },
  { pin: 'D28', component: 'Piezo Buzzer', role: 'Acoustic Alarm & Warning', voltage: '5V', notes: 'Sounds on overflow, dry run cutoff, sensor disconnect, or E-Stop' },
  { pin: 'GND', component: 'Common Ground', role: 'Reference Ground', voltage: '0V', notes: 'MUST be tied to external ground' },
  { pin: '5V', component: '5V Rail', role: 'Sensor & Opto VCC', voltage: '5V', notes: 'Powered from regulated 5V 2A-3A external power supply' },
];

export const ESP8266_PINOUT: PinoutItem[] = [
  { pin: '3V3', component: '3.3V Power Rail', role: 'Module VCC', voltage: '3.3V', notes: 'From NodeMCU on-board AMS1117 regulator or external 3.3V' },
  { pin: 'GND', component: 'Common Ground', role: 'Reference Ground', voltage: '0V', notes: 'Must be common with Arduino GND' },
  { pin: 'RX (GPIO3)', component: 'UART RX', role: 'Receives from Mega TX3 via Voltage Divider', voltage: '3.3V Max!', notes: 'WARNING: 5V directly on this pin will damage ESP8266!' },
  { pin: 'TX (GPIO1)', component: 'UART TX', role: 'Transmits to Mega RX3', voltage: '3.3V', notes: 'Connects directly to Mega Pin 15 (RX3)' },
  { pin: 'D4 (GPIO2)', component: 'Built-in Wi-Fi LED', role: 'Status Indicator', voltage: '3.3V', notes: 'Blinks during Wi-Fi pairing, solid when connected' },
  { pin: 'VIN', component: 'External 5V In', role: 'Regulator Input', voltage: '5V', notes: 'Can be powered from the regulated 5V external rail' },
];

export const VOLTAGE_DIVIDER_SCHEMATIC = `
        Arduino Mega Pin 14 (TX3, 5V)
                     │
                    [R1: 1kΩ Resistor]
                     │
                     ├──────────────> ESP8266 RX Pin (GPIO3, 3.33V Safe Logic)
                     │
                    [R2: 2kΩ Resistor]
                     │
                    GND (Common Ground)

Formula: Vout = Vin * (R2 / (R1 + R2)) = 5V * (2000 / 3000) = 3.33V DC
`;

export const RELAY_SAFETY_NOTES = `
1. Opto-Isolation & Flyback Diodes:
   Always use optocoupler-isolated relay boards. Remove the JD-VCC jumper to power the relay coils
   from an independent 5V power supply separate from Arduino 5V logic to prevent inductive motor kickback.

2. Fail-Safe Active-LOW Logic:
   In setup(), immediately initialize Pin 7 to HIGH before setting pinMode to OUTPUT.
   This guarantees that relays remain DE-ENERGIZED upon microcontroller reboot or brownout.

3. External Pump Supply Warning:
   NEVER power the pump motor from Arduino GPIO or USB 5V! The motor MUST be powered from an independent
   12V DC power adapter (or certified mains connection) routed through the Relay COM and NO terminals.

4. Autonomous Target Cutoff:
   The Arduino Uno firmware enforces the target level cutoff directly inside the loop:
   if (currentLevelPercent >= targetPercent) stopPump();
   Even if the web browser freezes or USB is unplugged, the microcontroller independently cuts off the motor.
`;

export const USB_CONNECTION_GUIDE = `
1. Connect Arduino Uno to your Computer:
   Plug your Arduino Uno R3 into a USB port on your computer using a standard USB A-to-B cable.

2. Browser Support:
   Use Google Chrome, Microsoft Edge, or Opera (Desktop). Web Serial is supported natively.

3. Close Arduino IDE Serial Monitor:
   Make sure the Serial Monitor in Arduino IDE is CLOSED before connecting in this web app.
   A COM port cannot be opened by two programs simultaneously.

4. Click 'Connect USB' in the Web App:
   When the browser prompt appears, select your Arduino Uno (or USB-SERIAL CH340 / FTDI) and click 'Connect' (115200 Baud).

5. Automatic Telemetry & Control:
   The web app will communicate at 115200 Baud, automatically receiving live sensor readings ("DISTANCE:4.37,LEVEL:81.8%") and sending target fill commands.

6. If running in an embedded preview / Iframe:
   Browser security restricts Web Serial inside iframes (Permissions Policy). Click 'Open in Direct Tab' (નવી ટેબમાં ખોલો) to open the app standalone, where Web Serial port selection is fully enabled.
`;

export const ANDROID_HC05_CONNECTION_GUIDE = `
📱 Android પર HC-05 Bluetooth કનેક્શન માર્ગદર્શિકા:

૧. Android માં HC-05 ને પેર (Pair) કરો:
   - HC-05 મોડ્યુલને Arduino સાથે જોડો (VCC 5V, GND GND, LED ઝડપથી બ્લિંક થશે).
   - તમારા Android ફોનમાં: સેટિંગ્સ (Settings) -> કનેક્ટેડ ડિવાઇસિસ (Bluetooth) -> "Pair new device" પર જાઓ.
   - લિસ્ટમાં "HC-05" દેખાશે, તેના પર ટેપ કરો.
   - પેરિંગ PIN પૂછે ત્યારે "1234" અથવા "0000" દાખલ કરો. HC-05 સફળતાપૂર્વક પેર થઈ જશે!

૨. Google Chrome બ્રાઉઝરમાં એપ ખોલો:
   - Android ફોનમાં Google Chrome બ્રાઉઝર વાપરો (Chrome 138+ માં Web Serial Bluetooth RFCOMM સપોર્ટ છે).
   - જો આ એપ આઇફ્રેમ (Iframe) માં ખૂલેલી હોય, તો "Open in Direct Tab" (નવી ટેબમાં ખોલો) બટન પર ટેપ કરો જેથી બ્રાઉઝર પરવાનગી આપી શકે.

૩. 'Connect Bluetooth' પર ટેપ કરો:
   - એપ્લિકેશનના હેડર અથવા ડેશબોર્ડમાં "Connect Bluetooth" બટન પર ટેપ કરો.
   - Chrome તમારા પેર થયેલા Bluetooth Serial ડિવાઇસીસનું પોપઅપ બતાવશે.
   - તેમાં "HC-05" પસંદ કરો અને "Connect" દબાવો.

૪. લાઈવ રીડિંગ્સ અને કંટ્રોલ:
   - એપ આપમેળે 9600 Baud પર HC-05 સાથે કનેક્ટ થશે.
   - સેન્સર રીડિંગ "DISTANCE:4.37,LEVEL:81.8%" મળતા જ ટાંકીનું લાઈવ લેવલ, અંતર અને એનિમેશન દેખાશે.

૫. વિકલ્પ: USB-OTG દ્વારા Arduino Uno જોડાણ:
   - જો તમારી પાસે USB-OTG એડેપ્ટર હોય, તો તમે સીધું Arduino Uno કેબલ એન્ડ્રોઇડ ફોનમાં ભરાવીને "Connect USB" પણ કરી શકો છો!
`;

export const BLUETOOTH_CONNECTION_GUIDE = `
1. Pair HC-05 with Windows PC:
   - Power up HC-05 (VCC to 5V, GND to GND, LED blinks rapidly).
   - Go to Windows Settings -> Bluetooth & devices -> Add device -> Bluetooth.
   - Select 'HC-05' and enter pairing PIN (usually 1234 or 0000).
   - Once paired, Windows creates outgoing Virtual COM Ports (e.g., COM4, COM5).

2. HC-05 Wiring with Arduino:
   - HC-05 VCC -> Arduino 5V
   - HC-05 GND -> Arduino GND
   - HC-05 TXD -> Arduino Pin 0 (RX) [or SoftwareSerial RX]
   - HC-05 RXD -> Arduino Pin 1 (TX) via voltage divider (1k/2k resistors since HC-05 RX is 3.3V logic)

3. Default Baud Rate:
   - HC-05 standard SPP communication is 9600 Baud.
   - The web app automatically configures 9600 Baud when you click 'Connect Bluetooth'.

4. Click 'Connect Bluetooth' in Web App:
   - Click 'Connect Bluetooth' in the top header or dashboard.
   - When the browser serial picker appears, select the outgoing Bluetooth COM Port and click 'Connect'.
   - The app will start receiving live data ("DISTANCE:4.37,LEVEL:81.8%") and display real-time tank animation!
`;
