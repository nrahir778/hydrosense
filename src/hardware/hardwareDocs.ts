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
   When the browser prompt appears, select your Arduino Uno (or USB-SERIAL CH340 / FTDI) and click 'Connect' (9600 Baud Default, selectable up to 115200 Baud).

5. Automatic Telemetry & Control:
   The web app will communicate at 9600 Baud (matching Serial.begin(9600)), automatically receiving live sensor readings ("DISTANCE:4.37,LEVEL:81.8%") and sending target fill commands.

6. If running in an embedded preview / Iframe:
   Browser security restricts Web Serial inside iframes (Permissions Policy). Click 'Open in Direct Tab' (નવી ટેબમાં ખોલો) to open the app standalone, where Web Serial port selection is fully enabled.
`;

export const ANDROID_HC05_CONNECTION_GUIDE = `
📱 Android પર સુસંગત કનેક્શન અને HC-05 Bluetooth SPP માર્ગદર્શિકા:

૧. HC-05 Bluetooth Classic (SPP 9600 Baud) અને બ્રાઉઝર મર્યાદા:
   - HC-05 મોડ્યુલ Bluetooth Classic (SPP - Serial Port Profile) વાપરે છે.
   - Serial Bluetooth Terminal જેવી નેટિવ Android એપ ઓપરેટિંગ સિસ્ટમના નેટિવ RFCOMM સોકેટનો ઉપયોગ કરતી હોવાથી કનેક્ટેડ રહે છે.
   - જ્યારે વેબ બ્રાઉઝર્સનું Web Bluetooth API ફક્ત BLE (Bluetooth Low Energy GATT) ને સપોર્ટ કરે છે અને સુરક્ષા નિયમ મુજબ Classic RFCOMM ને બ્લોક કરે છે.

૨. વ્યવહારુ ઉકેલ ૧: Bluetooth WebSocket Bridge (વાયરલેસ):
   - પ્રોજેક્ટમાં સામેલ 'python bluetooth_bridge.py' સ્ક્રિપ્ટ ચલાવો.
   - તે HC-05 સાથે 9600 Baud SPP પર જોડાય છે અને ws://localhost:8088 પર લોકલ WebSocket સર્વર બનાવે છે.
   - નેટલિફાય વેબ એપ સીધી આ બ્રિજ સાથે કનેક્ટ થઈને વાયરલેસ લાઈવ ડેટા અને કંટ્રોલ મેળવે છે.

૩. વ્યવહારુ ઉકેલ ૨: લેપટોપ પર Paired Bluetooth COM Port (9600 Baud):
   - Windows/Mac/Linux માં HC-05 પેર કરો (PIN: 1234).
   - "Connect Paired Bluetooth COM (9600 Baud)" દબાવી COM પોર્ટ સિલેક્ટ કરો.

૪. વ્યવહારુ ઉકેલ ૩: Android પર USB-OTG (સૌથી વિશ્વસનીય):
   - Type-C to USB-A OTG એડેપ્ટર વડે Arduino Uno ની USB કેબલ સીધી Android ફોનમાં લગાવો.
   - Android Google Chrome માં "Connect USB" દબાવો (9600 Baud Default, selectable 115200).
`;

export const BLUETOOTH_CONNECTION_GUIDE = `
1. HC-05 Bluetooth Classic (SPP 9600 Baud) Architecture:
   - HC-05 implements the Bluetooth Classic Serial Port Profile (SPP / RFCOMM) running at 9600 baud.
   - Web Bluetooth API in browsers strictly supports BLE GATT and cannot directly open RFCOMM sockets.
   - Android native apps like 'Serial Bluetooth Terminal' work because they use native OS Java RFCOMM sockets.

2. Practical Web Solutions (Without Faking Connection):
   - Method A: Bluetooth WebSocket Bridge ('python bluetooth_bridge.py'):
     Runs locally on laptop or Android Termux, bridges HC-05 RFCOMM to ws://localhost:8088.
   - Method B: Laptop Paired Bluetooth Virtual COM Port (9600 Baud):
     Pair HC-05 in Windows/Mac/Linux OS Bluetooth settings, open the COM port at 9600 Baud via Web Serial.
   - Method C: USB-OTG Direct Cable (9600 Baud Default / 115200 Baud):
     Direct physical USB link via Web Serial in Chrome on laptops and Android OTG.

3. HC-05 Wiring with Arduino Uno:
   - HC-05 VCC -> Arduino 5V
   - HC-05 GND -> Arduino GND
   - HC-05 TXD -> Arduino Pin 0 (RX) [or SoftwareSerial RX]
   - HC-05 RXD -> Arduino Pin 1 (TX) via voltage divider (1kΩ/2kΩ resistors to convert 5V to 3.3V)
   - Baud Rate: 9600 Baud (Standard HC-05 default)

4. Calibration & Autonomous Safety:
   - Empty Tank Distance (0%): 13.26 cm
   - Full Tank Distance (100%): 2.40 cm
   - Critical Overflow Cutoff: >= 97.0%
   - Autonomous cutoff enforced directly on Arduino Uno loop.
`;
