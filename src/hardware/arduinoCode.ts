export const ARDUINO_UNO_FIRMWARE_CODE = `#include <SoftwareSerial.h>

// HC-05: TX -> D2, RX <- D3 through voltage divider
SoftwareSerial BT(2, 3);

// Pin configuration
const byte TRIG_PIN   = 9;
const byte ECHO_PIN   = 10;
const byte MOTOR_PIN  = 7;
const byte BUZZER_PIN = 8;

// Calibrated sensor distances
const float EMPTY_DISTANCE_CM = 11.32;
const float FULL_DISTANCE_CM  = 2.37;

// Pump settings
const int MIN_TARGET_PERCENT = 20;
const int MAX_TARGET_PERCENT = 90;
const int AUTO_START_PERCENT = 15;
const int STOP_MARGIN_PERCENT = 2;

// Buzzer thresholds
const float SLOW_BEEP_LEVEL = 90.0;
const float FAST_BEEP_LEVEL = 97.0;
const float CONTINUOUS_BEEP_LEVEL = 99.9;

// Timing
const unsigned long SENSOR_INTERVAL = 500;
const unsigned long STATUS_INTERVAL = 1000;
const unsigned long TARGET_BEEP_DURATION = 1000;
const unsigned long SLOW_BEEP_INTERVAL = 600;
const unsigned long FAST_BEEP_INTERVAL = 150;

// Water level
int targetLevel = 80;
int waterLevel = 0;
float distanceCM = 0.0;
float waterPercent = 0.0;

// System state
bool pumpOn = false;
bool autoMode = false;
bool autoEnabled = false;
bool manualRequest = false;
bool sensorFault = true;

// Buzzer state
bool buzzerState = false;
bool targetBeepPending = false;
bool targetBeepActive = false;
bool targetBeepDone = false;

unsigned long lastSensorRead = 0;
unsigned long lastStatusSend = 0;
unsigned long buzzerTimer = 0;
unsigned long targetBeepStart = 0;

// Serial input buffers
String usbBuffer = "";
String btBuffer = "";

// --------------------------------------------------
// SEND TO USB SERIAL AND BLUETOOTH
// --------------------------------------------------
void sendLine(String message) {
  Serial.println(message);
  BT.println(message);
}

// --------------------------------------------------
// PUMP CONTROL
// D7 HIGH = PUMP ON
// D7 LOW  = PUMP OFF
// --------------------------------------------------
void setPump(bool on) {
  pumpOn = on;
  digitalWrite(MOTOR_PIN, on ? HIGH : LOW);
}

void stopPumpSafely() {
  setPump(false);
  manualRequest = false;
}

// --------------------------------------------------
// ULTRASONIC SENSOR
// --------------------------------------------------
void readSensor() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  unsigned long duration =
      pulseIn(ECHO_PIN, HIGH, 30000UL);

  if (duration == 0) {
    sensorFault = true;
    waterLevel = 0;
    waterPercent = 0;

    stopPumpSafely();
    autoEnabled = false;
    return;
  }

  float measured = duration * 0.0343 / 2.0;

  if (measured < 1.0 || measured > 400.0) {
    sensorFault = true;
    stopPumpSafely();
    autoEnabled = false;
    return;
  }

  distanceCM = measured;
  sensorFault = false;

  waterPercent =
      (EMPTY_DISTANCE_CM - distanceCM) /
      (EMPTY_DISTANCE_CM - FULL_DISTANCE_CM) * 100.0;

  waterPercent = constrain(waterPercent, 0.0, 100.0);

  waterLevel = (int)(waterPercent + 0.5);
}

// --------------------------------------------------
// PUMP CONTROL AND TARGET DETECTION
// --------------------------------------------------
void updatePumpControl() {
  if (sensorFault) {
    stopPumpSafely();
    return;
  }

  float cutoff = targetLevel - STOP_MARGIN_PERCENT;

  if (cutoff < 0) {
    cutoff = 0;
  }

  // Rearm the target beep after the level falls
  // sufficiently below the cutoff.
  if (waterPercent < cutoff - 1.0) {
    targetBeepDone = false;
  }

  if (autoMode && autoEnabled) {

    // Start automatic filling at 15% or below
    if (!pumpOn && waterPercent <= AUTO_START_PERCENT) {
      setPump(true);
    }

    // Stop when the target cutoff is reached
    if (pumpOn && waterPercent >= cutoff) {
      setPump(false);

      if (!targetBeepDone) {
        targetBeepPending = true;
        targetBeepDone = true;
      }
    }

  } else if (!autoMode && manualRequest) {

    if (waterPercent >= cutoff) {
      setPump(false);
      manualRequest = false;

      if (!targetBeepDone) {
        targetBeepPending = true;
        targetBeepDone = true;
      }
    } else {
      setPump(true);
    }

  } else {
    setPump(false);
  }
}

// --------------------------------------------------
// BUZZER
// 90% to below 97% = slow beeps
// 97% to below 99.9% = fast beeps
// 99.9% and above = continuous beep
// Target reached = one long beep
// --------------------------------------------------
void updateBuzzer() {
  unsigned long now = millis();

  if (sensorFault) {
    digitalWrite(BUZZER_PIN, LOW);
    buzzerState = false;
    targetBeepActive = false;
    targetBeepPending = false;
    return;
  }

  // Start one long beep when pump stops at target
  if (targetBeepPending && !targetBeepActive) {
    targetBeepPending = false;
    targetBeepActive = true;
    targetBeepStart = now;

    digitalWrite(BUZZER_PIN, HIGH);
    buzzerState = true;
    return;
  }

  // Non-blocking long beep: 1 second
  if (targetBeepActive) {
    if (now - targetBeepStart >= TARGET_BEEP_DURATION) {
      targetBeepActive = false;
      digitalWrite(BUZZER_PIN, LOW);
      buzzerState = false;
      buzzerTimer = now;
    } else {
      digitalWrite(BUZZER_PIN, HIGH);
    }
    return;
  }

  // Continuous beep at 99.9% or above
  if (waterPercent >= CONTINUOUS_BEEP_LEVEL) {
    digitalWrite(BUZZER_PIN, HIGH);
    buzzerState = true;
    return;
  }

  unsigned long interval;

  // Fast beeps at 97% to below 99.9%
  if (waterPercent >= FAST_BEEP_LEVEL) {
    interval = FAST_BEEP_INTERVAL;
  }

  // Slow beeps at 90% to below 97%
  else if (waterPercent >= SLOW_BEEP_LEVEL) {
    interval = SLOW_BEEP_INTERVAL;
  }

  // Buzzer OFF below 90%
  else {
    digitalWrite(BUZZER_PIN, LOW);
    buzzerState = false;
    return;
  }

  if (now - buzzerTimer >= interval) {
    buzzerTimer = now;
    buzzerState = !buzzerState;

    digitalWrite(
      BUZZER_PIN,
      buzzerState ? HIGH : LOW
    );
  }
}

// --------------------------------------------------
// SEND LIVE STATUS TO APP
// --------------------------------------------------
void sendStatus() {
  int cutoff = targetLevel - STOP_MARGIN_PERCENT;

  if (cutoff < 0) {
    cutoff = 0;
  }

  String message = "STATUS,water=";
  message += String(waterPercent, 1);

  message += ",distance=";
  message += String(distanceCM, 2);

  message += ",target=";
  message += String(targetLevel);

  message += ",cutoff=";
  message += String(cutoff);

  message += ",pump=";
  message += pumpOn ? "ON" : "OFF";

  message += ",mode=";
  message += autoMode ? "AUTO" : "MANUAL";

  message += ",error=";
  message += sensorFault ? "SENSOR" : "NONE";

  sendLine(message);
}

// --------------------------------------------------
// PROCESS APP COMMANDS
// Commands must end with newline
// --------------------------------------------------
void processCommand(String command) {
  command.trim();
  command.toUpperCase();

  if (command.startsWith("TARGET:")) {
    int value = command.substring(7).toInt();

    if (value >= MIN_TARGET_PERCENT &&
        value <= MAX_TARGET_PERCENT) {

      targetLevel = value;

      sendLine("OK,TARGET=" + String(targetLevel));
    } else {
      sendLine("ERROR,TARGET_RANGE=20-90");
    }
  }

  else if (command == "MODE:MANUAL") {
    autoMode = false;
    autoEnabled = false;
    stopPumpSafely();

    sendLine("OK,MODE=MANUAL");
  }

  else if (command == "MODE:AUTO") {
    autoMode = true;
    autoEnabled = true;
    manualRequest = false;
    setPump(false);

    sendLine("OK,MODE=AUTO");
  }

  else if (command == "START") {
    if (sensorFault) {
      sendLine("ERROR,SENSOR");
    }

    else if (autoMode) {
      sendLine("ERROR,SELECT_MANUAL");
    }

    else if (waterPercent >=
             targetLevel - STOP_MARGIN_PERCENT) {
      stopPumpSafely();
      sendLine("INFO,TARGET_ALREADY_REACHED");
    }

    else {
      manualRequest = true;
      setPump(true);

      sendLine("OK,PUMP=ON");
    }
  }

  else if (command == "STOP") {
    autoEnabled = false;
    stopPumpSafely();

    sendLine("OK,PUMP=OFF");
  }

  else if (command == "STATUS") {
    sendStatus();
  }

  else {
    sendLine("ERROR,UNKNOWN_COMMAND");
  }
}

// --------------------------------------------------
// READ USB OR BLUETOOTH COMMANDS
// --------------------------------------------------
void readCommandsFrom(Stream &port, String &buffer) {
  while (port.available()) {
    char c = port.read();

    if (c == '\\n' || c == '\\r') {
      if (buffer.length() > 0) {
        processCommand(buffer);
        buffer = "";
      }
    }

    else if (buffer.length() < 80) {
      buffer += c;
    }

    else {
      buffer = "";
    }
  }
}

// --------------------------------------------------
// SETUP
// --------------------------------------------------
void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(TRIG_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  setPump(false);

  // USB Serial baud rate
  Serial.begin(9600);

  // HC-05 Bluetooth baud rate
  BT.begin(9600);

  delay(500);

  sendLine("WATER_TANK_READY");
  sendLine("CALIBRATION,EMPTY=11.32,FULL=2.37");
}

// --------------------------------------------------
// MAIN LOOP
// --------------------------------------------------
void loop() {
  readCommandsFrom(Serial, usbBuffer);
  readCommandsFrom(BT, btBuffer);

  unsigned long now = millis();

  if (now - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = now;

    readSensor();
    updatePumpControl();
  }

  updateBuzzer();

  if (now - lastStatusSend >= STATUS_INTERVAL) {
    lastStatusSend = now;
    sendStatus();
  }
}
`;
