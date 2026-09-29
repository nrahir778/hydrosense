/*
  =============================================================================
  HydroSense Mega 2560 Controller Firmware
  Target: Arduino Mega 2560 R3
  Hardware:
    - Tank 1 HC-SR04 Ultrasonic: Trig = Pin 22, Echo = Pin 23
    - Tank 2 HC-SR04 Ultrasonic: Trig = Pin 24, Echo = Pin 25
    - Pump 1 Relay (Opto-isolated): Pin 26 (Active LOW)
    - Pump 2 Relay (Opto-isolated): Pin 27 (Active LOW)
    - Piezo Warning Buzzer: Pin 28
    - Hardware E-Stop NC Switch: Pin 2 (Interrupt INT4, INPUT_PULLUP)
    - ESP8266 Serial Link: Serial3 (TX3 Pin 14 -> 3.3V Divider -> ESP RX; RX3 Pin 15 <- ESP TX)
  =============================================================================
*/

#include <Arduino.h>

// --- PIN DEFINITIONS ---
const uint8_t TANK1_TRIG_PIN = 22;
const uint8_t TANK1_ECHO_PIN = 23;
const uint8_t TANK2_TRIG_PIN = 24;
const uint8_t TANK2_ECHO_PIN = 25;

const uint8_t RELAY_PUMP1_PIN = 26; // Active LOW: LOW = Relay ON, HIGH = Relay OFF
const uint8_t RELAY_PUMP2_PIN = 27; // Active LOW
const uint8_t BUZZER_PIN      = 28;
const uint8_t ESTOP_PIN       = 2;  // Hardware E-stop switch
const uint8_t STATUS_LED_PIN  = 13;

// --- TANK GEOMETRY (in cm) ---
const float TANK1_TOTAL_DEPTH_CM = 200.0f; // Height of tank
const float TANK1_DEADBAND_CM    = 15.0f;  // Sensor to 100% full waterline
const float TANK2_TOTAL_DEPTH_CM = 180.0f;
const float TANK2_DEADBAND_CM    = 15.0f;

// --- SAFETY LIMITS ---
const float MAX_OVERFLOW_PERCENT = 96.0f; // Hard cutoff threshold
const float MIN_DRY_RUN_PERCENT  = 8.0f;  // Sump low cutoff
const unsigned long COMM_WATCHDOG_TIMEOUT_MS = 6000; // Auto-stop pumps if comm lost

// --- STATE VARIABLES ---
volatile bool g_emergencyStop = false;
bool g_pump1State = false; // true = running, false = off
bool g_pump2State = false;
bool g_buzzerActive = false;

float g_tank1DistanceCm = 0.0f;
float g_tank1Percent = 0.0f;
bool g_tank1SensorOk = false;

float g_tank2DistanceCm = 0.0f;
float g_tank2Percent = 0.0f;
bool g_tank2SensorOk = false;

unsigned long g_lastHeartbeatMs = 0;
unsigned long g_lastTelemetryMs = 0;
unsigned long g_seqNumber = 0;

// Auto-stop targets sent from UI (0 = no target auto-stop)
float g_pump1TargetPercent = 0.0f;
float g_pump2TargetPercent = 0.0f;

// --- INTERRUPT HANDLER ---
void handleEStopInterrupt() {
  // Active low when triggered (NC opens, pulled down or switch opens)
  if (digitalRead(ESTOP_PIN) == LOW) {
    g_emergencyStop = true;
    // Immediate hardware shutoff
    digitalWrite(RELAY_PUMP1_PIN, HIGH);
    digitalWrite(RELAY_PUMP2_PIN, HIGH);
    g_pump1State = false;
    g_pump2State = false;
    digitalWrite(BUZZER_PIN, HIGH);
  }
}

// --- HELPER: Read Ultrasonic Distance with 3-sample median filter ---
float measureDistance(uint8_t trigPin, uint8_t echoPin, bool &sensorOk) {
  float samples[3];
  int validSamples = 0;

  for (int i = 0; i < 3; i++) {
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);

    // Timeout: 30ms (~500cm max range)
    unsigned long duration = pulseIn(echoPin, HIGH, 30000UL);
    if (duration > 150 && duration < 26000) { // between ~2.5cm and ~440cm
      samples[validSamples++] = (duration * 0.0343f) / 2.0f;
    }
    delay(10);
  }

  if (validSamples == 0) {
    sensorOk = false;
    return -1.0f;
  }

  // Median selection
  if (validSamples == 1) {
    sensorOk = true;
    return samples[0];
  } else if (validSamples == 2) {
    sensorOk = true;
    return (samples[0] + samples[1]) / 2.0f;
  } else {
    // 3 samples: sort
    if (samples[0] > samples[1]) { float t = samples[0]; samples[0] = samples[1]; samples[1] = t; }
    if (samples[1] > samples[2]) { float t = samples[1]; samples[1] = samples[2]; samples[2] = t; }
    if (samples[0] > samples[1]) { float t = samples[0]; samples[0] = samples[1]; samples[1] = t; }
    sensorOk = true;
    return samples[1];
  }
}

// --- CALCULATE WATER PERCENTAGE ---
float distanceToPercent(float distCm, float totalDepth, float deadband) {
  if (distCm <= deadband) return 100.0f;
  float usableDepth = totalDepth - deadband;
  float waterDepth = totalDepth - distCm;
  if (waterDepth <= 0) return 0.0f;
  float pct = (waterDepth / usableDepth) * 100.0f;
  if (pct > 100.0f) pct = 100.0f;
  if (pct < 0.0f) pct = 0.0f;
  return pct;
}

// --- SAFE RELAY DISPATCH ---
void setPumpRelay(uint8_t pumpId, bool turnOn) {
  if (g_emergencyStop && turnOn) {
    return; // Block turn on during E-stop
  }

  if (pumpId == 1) {
    // Safety check: Overflow
    if (turnOn && g_tank1Percent >= MAX_OVERFLOW_PERCENT) return;
    digitalWrite(RELAY_PUMP1_PIN, turnOn ? LOW : HIGH);
    g_pump1State = turnOn;
  } else if (pumpId == 2) {
    // Safety check: Overflow or Tank 1 empty (dry run for sump-to-roof transfer)
    if (turnOn && g_tank2Percent >= MAX_OVERFLOW_PERCENT) return;
    if (turnOn && g_tank1Percent < MIN_DRY_RUN_PERCENT) return;
    digitalWrite(RELAY_PUMP2_PIN, turnOn ? LOW : HIGH);
    g_pump2State = turnOn;
  }
}

// --- SEND JSON ACKNOWLEDGEMENT TO ESP8266 ---
void sendAck(const char* cmdId, bool success, const char* err = "") {
  Serial3.print(F("{\"type\":\"ACK\",\"cmdId\":\""));
  Serial3.print(cmdId);
  Serial3.print(F("\",\"success\":"));
  Serial3.print(success ? F("true") : F("false"));
  Serial3.print(F(",\"p1\":"));
  Serial3.print(g_pump1State ? F("true") : F("false"));
  Serial3.print(F(",\"p2\":"));
  Serial3.print(g_pump2State ? F("true") : F("false"));
  Serial3.print(F(",\"estop\":"));
  Serial3.print(g_emergencyStop ? F("true") : F("false"));
  if (strlen(err) > 0) {
    Serial3.print(F(",\"err\":\""));
    Serial3.print(err);
    Serial3.print(F("\""));
  }
  Serial3.println(F("}"));
}

// --- SEND TELEMETRY PACKET ---
void sendTelemetry() {
  g_seqNumber++;
  Serial3.print(F("{\"type\":\"TELEM\",\"seq\":"));
  Serial3.print(g_seqNumber);
  Serial3.print(F(",\"t1\":{\"dist\":"));
  Serial3.print(g_tank1DistanceCm, 1);
  Serial3.print(F(",\"pct\":"));
  Serial3.print(g_tank1Percent, 1);
  Serial3.print(F(",\"ok\":"));
  Serial3.print(g_tank1SensorOk ? F("true") : F("false"));
  Serial3.print(F("},\"t2\":{\"dist\":"));
  Serial3.print(g_tank2DistanceCm, 1);
  Serial3.print(F(",\"pct\":"));
  Serial3.print(g_tank2Percent, 1);
  Serial3.print(F(",\"ok\":"));
  Serial3.print(g_tank2SensorOk ? F("true") : F("false"));
  Serial3.print(F("},\"p1\":"));
  Serial3.print(g_pump1State ? F("true") : F("false"));
  Serial3.print(F(",\"p2\":"));
  Serial3.print(g_pump2State ? F("true") : F("false"));
  Serial3.print(F(",\"estop\":"));
  Serial3.print(g_emergencyStop ? F("true") : F("false"));
  Serial3.print(F(",\"buzzer\":"));
  Serial3.print(g_buzzerActive ? F("true") : F("false"));
  Serial3.print(F(",\"uptime\":"));
  Serial3.print(millis() / 1000UL);
  Serial3.println(F("}"));
}

// --- PARSE INCOMING COMMAND FROM ESP8266 ---
void processIncomingCommand(const String& line) {
  // Sample command: {"action":"SET_PUMP","tankId":1,"state":true,"target":80,"cmdId":"CMD-101"}
  // Sample E-Stop:  {"action":"ESTOP","cmdId":"CMD-102"}
  // Sample Ping:    {"action":"PING"}
  g_lastHeartbeatMs = millis();

  if (line.indexOf(F("\"PING\"")) >= 0) {
    Serial3.println(F("{\"type\":\"PONG\"}"));
    return;
  }

  // Extract cmdId
  char cmdId[32] = "";
  int idIdx = line.indexOf(F("\"cmdId\":\""));
  if (idIdx >= 0) {
    int idEnd = line.indexOf('\"', idIdx + 9);
    if (idEnd > idIdx) {
      String idStr = line.substring(idIdx + 9, idEnd);
      idStr.toCharArray(cmdId, sizeof(cmdId));
    }
  }

  if (line.indexOf(F("\"action\":\"ESTOP\"")) >= 0) {
    g_emergencyStop = true;
    setPumpRelay(1, false);
    setPumpRelay(2, false);
    digitalWrite(BUZZER_PIN, HIGH);
    g_buzzerActive = true;
    sendAck(cmdId, true);
    return;
  }

  if (line.indexOf(F("\"action\":\"CLEAR_ESTOP\"")) >= 0) {
    g_emergencyStop = false;
    digitalWrite(BUZZER_PIN, LOW);
    g_buzzerActive = false;
    sendAck(cmdId, true);
    return;
  }

  if (line.indexOf(F("\"action\":\"SET_PUMP\"")) >= 0) {
    if (g_emergencyStop) {
      sendAck(cmdId, false, "EMERGENCY_STOP_ENGAGED");
      return;
    }

    int tankId = (line.indexOf(F("\"tankId\":2")) >= 0) ? 2 : 1;
    bool state = (line.indexOf(F("\"state\":true")) >= 0);

    // Parse target level if present
    int targetIdx = line.indexOf(F("\"target\":"));
    float target = 0.0f;
    if (targetIdx >= 0) {
      target = line.substring(targetIdx + 9).toFloat();
    }

    if (tankId == 1) {
      g_pump1TargetPercent = (state && target > 0) ? target : 0.0f;
      setPumpRelay(1, state);
      sendAck(cmdId, true);
    } else {
      g_pump2TargetPercent = (state && target > 0) ? target : 0.0f;
      setPumpRelay(2, state);
      sendAck(cmdId, true);
    }
    return;
  }
}

// --- SETUP ---
void setup() {
  // Ultrasonic Pins
  pinMode(TANK1_TRIG_PIN, OUTPUT);
  pinMode(TANK1_ECHO_PIN, INPUT);
  pinMode(TANK2_TRIG_PIN, OUTPUT);
  pinMode(TANK2_ECHO_PIN, INPUT);

  // Relay Pins - Initial state HIGH (Relay OFF)
  pinMode(RELAY_PUMP1_PIN, OUTPUT);
  digitalWrite(RELAY_PUMP1_PIN, HIGH);
  pinMode(RELAY_PUMP2_PIN, OUTPUT);
  digitalWrite(RELAY_PUMP2_PIN, HIGH);

  // Buzzer & LED
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  pinMode(STATUS_LED_PIN, OUTPUT);

  // E-Stop hardware button
  pinMode(ESTOP_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(ESTOP_PIN), handleEStopInterrupt, FALLING);

  // Serial Monitor for debug & Serial3 for ESP8266
  Serial.begin(115200);
  Serial3.begin(115200);

  Serial.println(F("[Mega 2560] HydroSense Dual Tank Controller Initialized"));
  g_lastHeartbeatMs = millis();
}

// --- MAIN LOOP ---
void loop() {
  unsigned long now = millis();

  // Read incoming Serial3 stream from ESP8266
  while (Serial3.available() > 0) {
    String line = Serial3.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      processIncomingCommand(line);
    }
  }

  // Ultrasonic distance measurement (every 600ms)
  static unsigned long lastSensorRead = 0;
  if (now - lastSensorRead >= 600) {
    lastSensorRead = now;

    // Tank 1
    g_tank1DistanceCm = measureDistance(TANK1_TRIG_PIN, TANK1_ECHO_PIN, g_tank1SensorOk);
    if (g_tank1SensorOk) {
      g_tank1Percent = distanceToPercent(g_tank1DistanceCm, TANK1_TOTAL_DEPTH_CM, TANK1_DEADBAND_CM);
    }

    // Tank 2
    g_tank2DistanceCm = measureDistance(TANK2_TRIG_PIN, TANK2_ECHO_PIN, g_tank2SensorOk);
    if (g_tank2SensorOk) {
      g_tank2Percent = distanceToPercent(g_tank2DistanceCm, TANK2_TOTAL_DEPTH_CM, TANK2_DEADBAND_CM);
    }

    // Automatic Target Stops in Manual Mode
    if (g_pump1State && g_pump1TargetPercent > 0 && g_tank1Percent >= g_pump1TargetPercent) {
      setPumpRelay(1, false);
      g_pump1TargetPercent = 0.0f;
    }
    if (g_pump2State && g_pump2TargetPercent > 0 && g_tank2Percent >= g_pump2TargetPercent) {
      setPumpRelay(2, false);
      g_pump2TargetPercent = 0.0f;
    }

    // Safety Cutoff: High overflow cutoff
    if (g_pump1State && g_tank1Percent >= MAX_OVERFLOW_PERCENT) {
      setPumpRelay(1, false);
      digitalWrite(BUZZER_PIN, HIGH);
      g_buzzerActive = true;
    }
    if (g_pump2State && g_tank2Percent >= MAX_OVERFLOW_PERCENT) {
      setPumpRelay(2, false);
      digitalWrite(BUZZER_PIN, HIGH);
      g_buzzerActive = true;
    }
  }

  // Communication Watchdog: Shut down pumps if ESP8266 stops pinging
  if ((now - g_lastHeartbeatMs > COMM_WATCHDOG_TIMEOUT_MS) && (g_pump1State || g_pump2State)) {
    setPumpRelay(1, false);
    setPumpRelay(2, false);
    digitalWrite(BUZZER_PIN, HIGH);
    g_buzzerActive = true;
  }

  // Broadcast Telemetry every 1000ms
  if (now - g_lastTelemetryMs >= 1000) {
    g_lastTelemetryMs = now;
    sendTelemetry();
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN)); // Blink heartbeat
  }
}
