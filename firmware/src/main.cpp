#include <Arduino.h>
#include <Adafruit_NeoPixel.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"

#if DEBUG_SERIAL
  #define LOG(x) Serial.println(x)
  #define LOGF(fmt, ...) Serial.printf(fmt, ##__VA_ARGS__)
#else
  #define LOG(x)
  #define LOGF(fmt, ...)
#endif

#define RGB_PIN 38
#define NUM_PIXELS 1
#define MQTT_TOPIC "solarmary/telemetry"

// Fake charge states for testing
const char* CHARGE_STATES[] = {"off", "bulk", "absorption", "float", "storage"};
const int NUM_CHARGE_STATES = 5;

Adafruit_NeoPixel pixel(NUM_PIXELS, RGB_PIN, NEO_GRB + NEO_KHZ800);
WiFiClientSecure wifiClient;
PubSubClient mqtt(wifiClient);

String ipAddress = "";
unsigned long lastPublish = 0;
unsigned long lastPublishSuccess = 0;

void setColor(uint8_t r, uint8_t g, uint8_t b) {
  pixel.setPixelColor(0, pixel.Color(r, g, b));
  pixel.show();
}

void connectMQTT() {
  while (!mqtt.connected()) {
    LOG("Connecting to HiveMQ...");
    if (mqtt.connect("solarmary-01", MQTT_USER, MQTT_PASSWORD)) {
      LOG("connected!");
      setColor(0, 255, 0);
    } else {
      LOGF("failed, rc=%d. Retrying in 5s\n", mqtt.state());
      setColor(255, 165, 0);
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(921600);
  pixel.begin();
  pixel.setBrightness(50);
  randomSeed(analogRead(1));

  setColor(0, 0, 255);
  LOGF("Connecting to WiFi: %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    attempts++;
    LOG(".");
  }

  if (WiFi.status() != WL_CONNECTED) {
    setColor(255, 0, 0);
    LOG("\nWiFi failed.");
    return;
  }

  ipAddress = WiFi.localIP().toString();
  LOGF("\nWiFi connected! IP: %s\n", ipAddress.c_str());

  wifiClient.setCACert(HIVEMQ_ROOT_CA);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  lastPublish = millis() - 60000;
  connectMQTT();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    setColor(255, 0, 0);
    return;
  }

  if (!mqtt.connected()) {
    setColor(255, 165, 0);
    connectMQTT();
  }
  mqtt.loop();

  unsigned long now = millis();

  if (now - lastPublishSuccess < 500) {
    setColor(0, 0, 255);
  } else if (!mqtt.connected()) {
    setColor(255, 165, 0);
  } else {
    setColor(0, 255, 0);
  }

  if (now - lastPublish >= 60000) {
    lastPublish = now;

    JsonDocument doc;
    doc["deviceId"]        = DEVICE_ID;
    doc["firmwareVersion"] = FIRMWARE_VERSION;
    doc["timestamp"]       = now / 1000;
    doc["soc"]             = random(0, 101);
    doc["batteryVoltage"]  = random(120, 146) / 10.0;
    doc["loadCurrent"]     = random(0, 50) / 10.0;
    doc["panelVoltage"]    = random(0, 220) / 10.0;
    doc["panelCurrent"]    = random(0, 100) / 10.0;
    doc["chargeState"]     = CHARGE_STATES[random(0, NUM_CHARGE_STATES)];
    doc["errorCode"]       = 0;

    char payload[512]; //buffer size should be enough for our JSON document
    serializeJson(doc, payload);

    if (mqtt.publish(MQTT_TOPIC, payload)) {
      lastPublishSuccess = now;
      LOGF("✓ Published | FW: %s | SOC: %d%% | Battery: %.1fV | Charge state: %s\n",
        FIRMWARE_VERSION,
        (int)doc["soc"],
        (float)doc["batteryVoltage"],
        (const char*)doc["chargeState"]);
    } else {
      LOG("✗ Publish failed.");
    }
  }
}