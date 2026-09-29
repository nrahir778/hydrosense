/*
  ========================================================================================
  શ્રી સરકારી માધ્યમિક અને ઉચ્ચ. માધ્યમિક શાળા–લાખાપર
  HydroSense - Smart Single Water Tank Controller Firmware
  Platform: Arduino Uno R3 (Atmega328P)
  Communication: Direct USB Serial (115200 Baud, Newline-delimited)
  Sensor: HC-SR04 Ultrasonic Sensor
  Actuator: 5V Relay Module (Active-LOW, Optocoupled)
  ========================================================================================

  PIN WIRING CONFIGURATION:
  -------------------------
  - HC-SR04 VCC       -> Arduino 5V Rail
  - HC-SR04 GND       -> Arduino GND
  - HC-SR04 TRIG      -> Digital Pin 9
  - HC-SR04 ECHO      -> Digital Pin 10
  - Relay Module IN   -> Digital Pin 7 (Active LOW: LOW = PUMP ON, HIGH = PUMP OFF)
  - Relay Module VCC  -> Arduino 5V
  - Relay Module GND  -> Arduino GND
  - Piezo Buzzer (+)  -> Digital Pin 8 (Optional Alarm)
  - Status LED        -> Digital Pin 13 (Built-in)
  - USB Cable         -> Connects directly to Computer running Chrome/Edge (115200 Baud)

  SAFETY WARNING:
  ---------------
  NEVER power the water pump motor directly from Arduino 5V or USB!
  The pump motor MUST be connected to an independent external power supply (e.g. 12V 2A DC
  or 230V AC mains via certified electrician) through the Relay COM & NO terminals.

  CALIBRATION VALUES:
  -------------------
  - Empty Distance (0% Level)  : 13.26 cm
  - Full Distance (100% Level) : 2.40 cm
  - Near-Full Alert            : > 90.0%
  - Critical Overflow Cutoff   : >= 97.0% (Hard cutoff enforced in microcontroller loop)
*/

// --- PIN DEFINITIONS ---
const int PIN_TRIG   = 9;    // HC-SR04 Ultrasonic Trigger
const int PIN_ECHO   = 10;   // HC-SR04 Ultrasonic Echo
const int PIN_RELAY  = 7;    // Pump Motor Relay (Active LOW)
const int PIN_BUZZER = 8;    // Warning / Alarm Buzzer
const int PIN_LED    = 13;   // Status Heartbeat LED

// --- RELAY LOGIC (Active-LOW) ---
const int RELAY_ON  = LOW;
const int RELAY_OFF = HIGH;

// --- CALIBRATION PARAMETERS ---
const float EMPTY_DISTANCE_CM = 13.26; // 0% water level
const float FULL_DISTANCE_CM  = 2.40;  // 100% water level
const float SPAN_CM           = EMPTY_DISTANCE_CM - FULL_DISTANCE_CM; // 10.86 cm
const float CRITICAL_MAX_PCT  = 97.0;  // Absolute hardware emergency cutoff
const float HYSTERESIS_PCT    = 2.0;   // Prevents rapid relay chattering

// --- SYSTEM STATE VARIABLES ---
int targetPercent = 85;             // User target filling percentage (10 to 100%)
bool pumpRunning = false;           // Current physical pump state
float currentDistanceCm = 0.0;      // Filtered sensor distance
float currentLevelPercent = 0.0;    // Calculated water level 0-100%
bool sensorValid = false;           // Sensor reading sanity flag
unsigned long lastTelemetryTime = 0;
unsigned long lastSensorSampleTime = 0;
String serialInputBuffer = "";

void setup() {
  // CRITICAL SAFETY FIRST: Set relay pin HIGH before pinMode to prevent boot relay glitches
  digitalWrite(PIN_RELAY, RELAY_OFF);
  pinMode(PIN_RELAY, OUTPUT);
  digitalWrite(PIN_RELAY, RELAY_OFF);

  pinMode(PIN_TRIG, OUTPUT);
  digitalWrite(PIN_TRIG, LOW);
  pinMode(PIN_ECHO, INPUT);

  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, LOW);

  // Initialize USB Serial communication at 115200 baud
  Serial.begin(115200);
  serialInputBuffer.reserve(64);

  // Boot beep
  tone(PIN_BUZZER, 2000, 100);
  delay(120);
  tone(PIN_BUZZER, 2500, 150);

  Serial.println(F("INFO:Arduino Uno HydroSense Controller Initialized (115200 Baud)"));
  Serial.println(F("INFO:Pump is OFF by default. Waiting for USB commands..."));
}

void loop() {
  unsigned long now = millis();

  // 1. Process incoming commands from Web Serial
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialInputBuffer.length() > 0) {
        parseCommand(serialInputBuffer);
        serialInputBuffer = "";
      }
    } else {
      if (serialInputBuffer.length() < 60) {
        serialInputBuffer += c;
      }
    }
  }

  // 2. Read ultrasonic sensor every 150ms with multi-sample median filter
  if (now - lastSensorSampleTime >= 150) {
    lastSensorSampleTime = now;
    readUltrasonicSensor();
  }

  // 3. Autonomous Firmware Safety and Target Cutoff enforcement
  // Microcontroller independently enforces safety even if USB is unplugged or web app freezes!
  enforceAutocutoffAndSafety();

  // 4. Send formatted telemetry output every 1000ms
  if (now - lastTelemetryTime >= 1000) {
    lastTelemetryTime = now;
    sendTelemetry();

    // Heartbeat LED indicator
    if (pumpRunning) {
      digitalWrite(PIN_LED, !digitalRead(PIN_LED)); // Flash fast while filling
    } else {
      digitalWrite(PIN_LED, HIGH);
    }
  }
}

// ---------------------------------------------------------------------------------------
// HC-SR04 Distance Measurement & Median Filter
// ---------------------------------------------------------------------------------------
void readUltrasonicSensor() {
  // Clear trigger
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);

  // 10 microsecond pulse
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  // Measure echo pulse duration (timeout 25ms = ~4 meters)
  unsigned long duration = pulseIn(PIN_ECHO, HIGH, 25000UL);

  if (duration == 0) {
    // Sensor timeout / no echo
    sensorValid = false;
    return;
  }

  // Calculate distance in centimeters (speed of sound = 343 m/s = 0.0343 cm/us)
  float rawDist = (duration * 0.0343) / 2.0;

  // HC-SR04 physical reliability check
  if (rawDist < 1.0 || rawDist > 35.0) {
    sensorValid = false;
    return;
  }

  sensorValid = true;

  // Exponential moving average filter for smooth reading (alpha = 0.35)
  if (currentDistanceCm <= 0.1) {
    currentDistanceCm = rawDist;
  } else {
    currentDistanceCm = (currentDistanceCm * 0.65) + (rawDist * 0.35);
  }

  // Calculate percentage based on calibrated 13.26cm (empty) and 2.40cm (full)
  if (SPAN_CM > 0.0) {
    float pct = ((EMPTY_DISTANCE_CM - currentDistanceCm) / SPAN_CM) * 100.0;
    if (pct < 0.0) pct = 0.0;
    if (pct > 100.0) pct = 100.0;
    currentLevelPercent = pct;
  }
}

// ---------------------------------------------------------------------------------------
// Autonomous Microcontroller Safety & Cutoff
// ---------------------------------------------------------------------------------------
void enforceAutocutoffAndSafety() {
  if (!pumpRunning) return;

  // Safety Rule A: Sensor failure while pump is running -> Immediate Stop
  if (!sensorValid) {
    stopPump("SENSOR_FAULT");
    beepAlarm(3);
    Serial.println(F("ALERT:Pump stopped due to ultrasonic sensor fault/timeout"));
    return;
  }

  // Safety Rule B: Critical Overflow Cutoff (>= 97% or distance < 2.30 cm) -> Immediate Stop
  if (currentLevelPercent >= CRITICAL_MAX_PCT || currentDistanceCm <= (FULL_DISTANCE_CM - 0.10)) {
    stopPump("CRITICAL_OVERFLOW");
    beepAlarm(5);
    Serial.println(F("ALERT:CRITICAL OVERFLOW CUTOFF ACTIVATED! Tank >= 97%"));
    return;
  }

  // Safety Rule C: Target Reached Cutoff
  // Automatically stops when level reaches the user-selected target
  if (currentLevelPercent >= (float)targetPercent) {
    stopPump("TARGET_REACHED");
    // Pleasant completion chime
    tone(PIN_BUZZER, 1800, 100);
    delay(120);
    tone(PIN_BUZZER, 2400, 200);
    Serial.print(F("INFO:Target reached ("));
    Serial.print(currentLevelPercent, 1);
    Serial.print(F("% >= "));
    Serial.print(targetPercent);
    Serial.println(F("%). Pump shut off automatically."));
  }
}

// ---------------------------------------------------------------------------------------
// Command Parser
// ---------------------------------------------------------------------------------------
void parseCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();

  if (cmd.startsWith("TARGET:")) {
    // Example: TARGET:50
    int colonIdx = cmd.indexOf(':');
    if (colonIdx > 0) {
      int newTarget = cmd.substring(colonIdx + 1).toInt();
      if (newTarget >= 10 && newTarget <= 100) {
        targetPercent = newTarget;
        Serial.print(F("INFO:Target level updated to "));
        Serial.print(targetPercent);
        Serial.println(F("%"));
      } else {
        Serial.println(F("ERROR:Target out of range (10-100)"));
      }
    }
  } else if (cmd == "START") {
    // Start Filling
    if (!sensorValid) {
      Serial.println(F("ERROR:Cannot start pump - valid sensor data not received"));
      beepAlarm(1);
      return;
    }

    if (currentLevelPercent >= (float)targetPercent) {
      Serial.print(F("ERROR:Water level already at or above target ("));
      Serial.print(currentLevelPercent, 1);
      Serial.print(F("% >= "));
      Serial.print(targetPercent);
      Serial.println(F("%)"));
      beepAlarm(1);
      return;
    }

    if (currentLevelPercent >= CRITICAL_MAX_PCT) {
      Serial.println(F("ERROR:Tank is critically full (>= 97%)! Start blocked."));
      beepAlarm(2);
      return;
    }

    startPump();
  } else if (cmd == "STOP") {
    // Stop Pump / Emergency Stop
    stopPump("USER_COMMAND");
  } else if (cmd == "STATUS") {
    // Emit immediate status line
    sendTelemetry();
  } else {
    Serial.print(F("ERROR:Unknown command: "));
    Serial.println(cmd);
  }
}

// ---------------------------------------------------------------------------------------
// Pump Control Actions
// ---------------------------------------------------------------------------------------
void startPump() {
  digitalWrite(PIN_RELAY, RELAY_ON);
  pumpRunning = true;
  tone(PIN_BUZZER, 2200, 150);
  Serial.print(F("INFO:Pump STARTED. Filling to target: "));
  Serial.print(targetPercent);
  Serial.println(F("%"));
  sendTelemetry();
}

void stopPump(const char* reason) {
  digitalWrite(PIN_RELAY, RELAY_OFF);
  pumpRunning = false;
  tone(PIN_BUZZER, 1200, 100);
  Serial.print(F("INFO:Pump STOPPED. Reason: "));
  Serial.println(reason);
  sendTelemetry();
}

// ---------------------------------------------------------------------------------------
// Formatted Telemetry Line Output
// Protocol: LEVEL:<val>,DISTANCE:<val>,PUMP:<ON|OFF>,TARGET:<val>
// ---------------------------------------------------------------------------------------
void sendTelemetry() {
  Serial.print(F("LEVEL:"));
  if (sensorValid) {
    Serial.print(currentLevelPercent, 1);
  } else {
    Serial.print(F("0.0"));
  }

  Serial.print(F(",DISTANCE:"));
  if (sensorValid) {
    Serial.print(currentDistanceCm, 2);
  } else {
    Serial.print(F("0.00"));
  }

  Serial.print(F(",PUMP:"));
  Serial.print(pumpRunning ? F("ON") : F("OFF"));

  Serial.print(F(",TARGET:"));
  Serial.println(targetPercent);
}

void beepAlarm(int count) {
  for (int i = 0; i < count; i++) {
    tone(PIN_BUZZER, 1000, 80);
    delay(100);
  }
}
