/*
  =============================================================================
  HydroSense ESP8266 NodeMCU Wi-Fi Gateway Firmware
  Target: NodeMCU v2 / v3 (ESP-12E / ESP8266)
  
  Logic Level & Wiring Warning:
    - ESP8266 runs at 3.3V logic!
    - Arduino Mega TX3 (5V) MUST connect to ESP8266 RX (D7/GPIO13 or RX0) through
      a voltage divider (1kΩ in series + 2kΩ to GND) or a bidirectional level shifter.
    - ESP8266 TX (D8/GPIO15 or TX0) (3.3V) can connect directly to Arduino Mega RX3 (Pin 15).
    - Common Ground (GND) between Mega, ESP8266, and power supply is MANDATORY.
  =============================================================================
*/

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h> // v6.x or v7.x

// --- NETWORK CONFIGURATION ---
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

// Server endpoint (Your AI Studio Cloud Run URL or local IP: http://192.168.1.100:3000)
const char* SERVER_BASE_URL = "http://192.168.1.100:3000";

// --- SERIAL TO MEGA CONFIGURATION ---
// You can use Serial (pins TX/RX) or SoftwareSerial on D7/D8
#define MEGA_SERIAL Serial

const unsigned long TELEMETRY_INTERVAL_MS = 1000;
const unsigned long POLL_COMMAND_INTERVAL_MS = 800;

unsigned long lastTelemetryForward = 0;
unsigned long lastCommandPoll = 0;
unsigned long lastMegaPing = 0;

void setup() {
  MEGA_SERIAL.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH); // Off for NodeMCU

  // Connect to Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_BUILTIN, LOW); // Solid on = connected
  }
}

// Forward raw telemetry line received from Mega to Web Server
void forwardTelemetryToServer(const String& megaLine) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClient client;
  HTTPClient http;
  String url = String(SERVER_BASE_URL) + "/api/telemetry";

  if (http.begin(client, url)) {
    http.addHeader("Content-Type", "application/json");

    // Augment with ESP8266 metadata (RSSI, IP, MAC)
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, megaLine);

    if (!error) {
      doc["deviceId"] = "esp8266-hydrosense-01";
      doc["rssi"] = WiFi.RSSI();
      doc["ip"] = WiFi.localIP().toString();
      doc["mac"] = WiFi.macAddress();

      String payload;
      serializeJson(doc, payload);

      int httpCode = http.POST(payload);
      if (httpCode > 0) {
        // Successful telemetry push
      }
    }
    http.end();
  }
}

// Forward command acknowledgment from Mega back to Server
void forwardAckToServer(const String& ackLine) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClient client;
  HTTPClient http;
  String url = String(SERVER_BASE_URL) + "/api/command-ack";

  if (http.begin(client, url)) {
    http.addHeader("Content-Type", "application/json");
    http.POST(ackLine);
    http.end();
  }
}

// Poll server for any pending user commands
void pollPendingCommands() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClient client;
  HTTPClient http;
  String url = String(SERVER_BASE_URL) + "/api/pending-commands";

  if (http.begin(client, url)) {
    int httpCode = http.GET();
    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      if (payload.length() > 5 && payload != "[]") {
        StaticJsonDocument<512> doc;
        if (!deserializeJson(doc, payload)) {
          // If server returned a command array, dispatch to Mega over Serial
          if (doc.is<JsonArray>()) {
            for (JsonObject cmd : doc.as<JsonArray>()) {
              String cmdJson;
              serializeJson(cmd, cmdJson);
              MEGA_SERIAL.println(cmdJson); // Transmit to Arduino Mega 2560!
            }
          }
        }
      }
    }
    http.end();
  }
}

void loop() {
  unsigned long now = millis();

  // Read lines from Arduino Mega 2560
  while (MEGA_SERIAL.available() > 0) {
    String line = MEGA_SERIAL.readStringUntil('\n');
    line.trim();

    if (line.startsWith("{\"type\":\"TELEM\"")) {
      forwardTelemetryToServer(line);
    } else if (line.startsWith("{\"type\":\"ACK\"")) {
      forwardAckToServer(line);
    }
  }

  // Poll for commands from server
  if (now - lastCommandPoll >= POLL_COMMAND_INTERVAL_MS) {
    lastCommandPoll = now;
    pollPendingCommands();
  }

  // Ping Mega periodically to refresh its hardware watchdog
  if (now - lastMegaPing >= 2000) {
    lastMegaPing = now;
    MEGA_SERIAL.println(F("{\"action\":\"PING\"}"));
  }
}
