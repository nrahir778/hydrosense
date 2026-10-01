/*
  ========================================================================================
  શ્રી સરકારી માધ્યમિક અને ઉચ્ચ. માધ્યમિક શાળા–લાખાપર
  HydroSense - Smart Single Water Tank Controller Firmware
  Platform: Arduino Uno R3 (Atmega328P)
  Communication: Direct USB Serial & HC-05 Bluetooth (9600 Baud Default / 115200 Baud Compatible)
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
  - Piezo Buzzer (+)  -> Digital Pin 8 (Acoustic Alarm & Chimes)
  - Status LED        -> Digital Pin 13 (Built-in)
  - HC-05 TX          -> Arduino RX (Pin 0) [Use 1k/2k voltage divider on Arduino TX -> HC-05 RX]
  - HC-05 RX          -> Arduino TX (Pin 1 via voltage divider)

  CALIBRATION VALUES:
  -------------------
  - Empty Distance (0% Level)  : 13.26 cm
  - Full Distance (100% Level) : 2.40 cm
  - Span                       : 10.86 cm
  - Auto-Start Threshold       : <= 15.0%
  - Target Fill Range          : 20% to 90% (Strict 90% Maximum Permitted Limit)
  - Critical Overflow Cutoff   : >= 97.0%

  PROTOCOL & COMMANDS (Newline-terminated \n):
  ---------------------------------------------
  - TARGET:<val>   : Sets fill target (Clamped strictly between 20% and 90%)
  - MODE:MANUAL    : Sets operating mode to MANUAL
  - MODE:AUTO      : Sets operating mode to AUTO (Auto-fills at <= 15%, stops at target)
  - START          : Starts the pump (in Manual mode or forced fill)
  - STOP           : Immediately stops the pump & resets operating mode to MANUAL
  - STATUS         : Immediately emits telemetry packet

  TELEMETRY OUTPUT FORMAT:
  ------------------------
  LEVEL:<0-100>,DISTANCE:<cm>,PUMP:<ON|OFF>,TARGET:<20-90>,MODE:<MANUAL|AUTO>,ERROR:<NONE|msg>
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
const float EMPTY_DISTANCE_CM       = 13.26; // 0% water level
const float FULL_DISTANCE_CM        = 2.40;  // 100% water level
const float SPAN_CM                 = EMPTY_DISTANCE_CM - FULL_DISTANCE_CM; // 10.86 cm
const float AUTO_START_THRESH_PCT   = 15.0;  // Automatic Mode start threshold (<= 15%)
const int   MIN_PERMITTED_TARGET    = 20;    // Minimum permitted target (20%)
const int   MAX_PERMITTED_TARGET    = 90;    // Maximum permitted target (90% hard limit)
const float CRITICAL_OVERFLOW_PCT   = 97.0;  // Absolute hardware emergency cutoff (>= 97%)

// --- OPERATING MODES ---
enum OperatingMode {
  MODE_MANUAL,
  MODE_AUTO
};

// --- SYSTEM STATE VARIABLES ---
int targetPercent = 75;                     // User target filling percentage (20 to 90%)
OperatingMode currentMode = MODE_MANUAL;    // Default: MANUAL mode
bool pumpRunning = false;                   // Current physical pump relay state
float currentDistanceCm = 0.0;              // Filtered ultrasonic sensor distance in cm
float currentLevelPercent = 0.0;            // Calculated water level 0.0% to 100.0%
bool sensorValid = false;                   // Ultrasonic reading sanity flag
String lastError = "NONE";                  // Reported error string (NONE, SENSOR_FAULT, etc.)

unsigned long lastTelemetryTime = 0;
unsigned long lastSensorSampleTime = 0;
String serialInputBuffer = "";

// Forward declarations
void readUltrasonicSensor();
void enforceAutocutoffAndSafety();
void parseCommand(String cmd);
void startPump();
void stopPump(const char* reason);
void sendTelemetry();
void beepAlarm(int count);

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

  // Initialize Serial communication (9600 Baud default for USB and HC-05 Bluetooth)
  Serial.begin(9600);
  serialInputBuffer.reserve(64);

  // Boot chime
  tone(PIN_BUZZER, 2000, 100);
  delay(120);
  tone(PIN_BUZZER, 2500, 150);

  Serial.println(F("INFO:Arduino Uno HydroSense Controller Initialized (9600 Baud)"));
  Serial.println(F("INFO:Pump is OFF by default. Mode is MANUAL. Target is 75%."));
}

void loop() {
  unsigned long now = millis();

  // 1. Process incoming commands from Web Serial / Bluetooth
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

  // 2. Read ultrasonic sensor every 150ms with exponential smoothing
  if (now - lastSensorSampleTime >= 150) {
    lastSensorSampleTime = now;
    readUltrasonicSensor();
  }

  // 3. Autonomous Firmware Safety and Auto Mode enforcement
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
// HC-SR04 Distance Measurement & Median Smoothing
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
    // Sensor timeout / no echo received
    sensorValid = false;
    lastError = "SENSOR_FAULT";
    return;
  }

  // Calculate distance in centimeters (speed of sound = 343 m/s = 0.0343 cm/us)
  float rawDist = (duration * 0.0343) / 2.0;

  // Physical sanity check for tank dimensions
  if (rawDist < 1.0 || rawDist > 35.0) {
    sensorValid = false;
    lastError = "OUT_OF_RANGE";
    return;
  }

  sensorValid = true;
  if (lastError == "SENSOR_FAULT" || lastError == "OUT_OF_RANGE") {
    lastError = "NONE";
  }

  // Exponential moving average filter for stable reading (alpha = 0.35)
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
// Autonomous Microcontroller Safety, Cutoff & Auto Mode Logic
// ---------------------------------------------------------------------------------------
void enforceAutocutoffAndSafety() {
  // Safety Rule 1: Sensor failure while pump is running -> Immediate Stop
  if (!sensorValid) {
    if (pumpRunning) {
      stopPump("SENSOR_FAULT");
      beepAlarm(3);
      Serial.println(F("ALERT:Pump stopped due to ultrasonic sensor fault/timeout"));
    }
    // Sensor fault disables Auto Mode until user explicitly re-enables it
    if (currentMode == MODE_AUTO) {
      currentMode = MODE_MANUAL;
      Serial.println(F("ALERT:Auto Mode disabled due to sensor fault"));
    }
    return;
  }

  // Safety Rule 2: Critical Overflow Cutoff (>= 97% or distance < 2.30 cm) -> Immediate Stop
  if (currentLevelPercent >= CRITICAL_OVERFLOW_PCT || currentDistanceCm <= (FULL_DISTANCE_CM - 0.10)) {
    if (pumpRunning) {
      stopPump("CRITICAL_OVERFLOW");
      beepAlarm(5);
      Serial.println(F("ALERT:CRITICAL OVERFLOW CUTOFF ACTIVATED! Tank >= 97%"));
    }
    lastError = "CRITICAL_OVERFLOW";
    currentMode = MODE_MANUAL;
    return;
  }

  // Safety Rule 3: 90% Hard Maximum Cap
  // Never fill above 90% under any circumstance
  if (currentLevelPercent >= (float)MAX_PERMITTED_TARGET) {
    if (pumpRunning) {
      stopPump("MAX_90_REACHED");
      tone(PIN_BUZZER, 1800, 100);
      delay(120);
      tone(PIN_BUZZER, 2400, 200);
      Serial.println(F("INFO:Maximum 90% limit reached. Pump shut off."));
    }
  }

  // Safety Rule 4: Selected Target Reached Cutoff (Manual or Auto Mode)
  if (pumpRunning && currentLevelPercent >= (float)targetPercent) {
    stopPump("TARGET_REACHED");
    tone(PIN_BUZZER, 1800, 100);
    delay(120);
    tone(PIN_BUZZER, 2400, 200);
    Serial.print(F("INFO:Target reached ("));
    Serial.print(currentLevelPercent, 1);
    Serial.print(F("% >= "));
    Serial.print(targetPercent);
    Serial.println(F("%). Pump shut off automatically."));
  }

  // Safety Rule 5: Automatic Mode Cycle Trigger
  // In Auto Mode: if water is at or below 15%, start filling automatically to target
  if (currentMode == MODE_AUTO && !pumpRunning && sensorValid) {
    if (currentLevelPercent <= AUTO_START_THRESH_PCT && currentLevelPercent < (float)targetPercent) {
      Serial.println(F("INFO:Auto Mode triggered: Water <= 15%. Starting pump to target..."));
      startPump();
    }
  }
}

// ---------------------------------------------------------------------------------------
// Command Parser
// ---------------------------------------------------------------------------------------
void parseCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();

  if (cmd.startsWith("TARGET:")) {
    // Example: TARGET:75 (Strictly 20% to 90%)
    int colonIdx = cmd.indexOf(':');
    if (colonIdx > 0) {
      int newTarget = cmd.substring(colonIdx + 1).toInt();
      if (newTarget < MIN_PERMITTED_TARGET) newTarget = MIN_PERMITTED_TARGET;
      if (newTarget > MAX_PERMITTED_TARGET) newTarget = MAX_PERMITTED_TARGET;
      targetPercent = newTarget;
      Serial.print(F("INFO:Target set to "));
      Serial.print(targetPercent);
      Serial.println(F("% (Maximum allowed: 90%)"));
    }
  } else if (cmd == "MODE:MANUAL") {
    currentMode = MODE_MANUAL;
    Serial.println(F("INFO:Operating mode set to MANUAL"));
  } else if (cmd == "MODE:AUTO") {
    currentMode = MODE_AUTO;
    lastError = "NONE";
    Serial.print(F("INFO:Operating mode set to AUTO. Target: "));
    Serial.print(targetPercent);
    Serial.println(F("%, Auto-start threshold: <= 15%"));
    // Immediately check if level is <= 15% to initiate filling
    if (sensorValid && currentLevelPercent <= AUTO_START_THRESH_PCT && currentLevelPercent < (float)targetPercent) {
      startPump();
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

    if (currentLevelPercent >= (float)MAX_PERMITTED_TARGET) {
      Serial.println(F("ERROR:Tank is at maximum permitted fill level (>= 90%)! Start blocked."));
      beepAlarm(2);
      return;
    }

    startPump();
  } else if (cmd == "STOP") {
    // Immediate Pump Stop & Auto Mode reset
    stopPump("USER_COMMAND");
    // Explicit rule: Do not automatically restart after a manual STOP until user re-enables Auto Mode
    if (currentMode == MODE_AUTO) {
      currentMode = MODE_MANUAL;
      Serial.println(F("INFO:Auto Mode paused due to manual STOP. Re-enable Auto Mode to resume."));
    }
  } else if (cmd == "STATUS") {
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
  Serial.print(F("INFO:Pump STARTED. Mode: "));
  Serial.print(currentMode == MODE_AUTO ? F("AUTO") : F("MANUAL"));
  Serial.print(F(", Target: "));
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
// Protocol: LEVEL:<val>,DISTANCE:<val>,PUMP:<ON|OFF>,TARGET:<val>,MODE:<MANUAL|AUTO>,ERROR:<msg>
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
  Serial.print(targetPercent);

  Serial.print(F(",MODE:"));
  Serial.print(currentMode == MODE_AUTO ? F("AUTO") : F("MANUAL"));

  Serial.print(F(",ERROR:"));
  Serial.println(lastError);
}

void beepAlarm(int count) {
  for (int i = 0; i < count; i++) {
    tone(PIN_BUZZER, 1000, 80);
    delay(100);
  }
}
