import "dotenv/config";
import mqtt from "mqtt";
import { createClient } from "@supabase/supabase-js";
import type { TelemetryPayload } from "@wattnow/types";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
const {
  MQTT_HOST,
  MQTT_PORT = "8883",
  MQTT_USER,
  MQTT_PASSWORD,
  MQTT_TOPIC = "solarmary/telemetry",
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
} = process.env;

if (!MQTT_HOST || !MQTT_USER || !MQTT_PASSWORD) {
  throw new Error("Missing MQTT environment variables");
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const mqttClient = mqtt.connect(`mqtts://${MQTT_HOST}:${MQTT_PORT}`, {
  username: MQTT_USER,
  password: MQTT_PASSWORD,
  protocol: "mqtts",
});

// ---------------------------------------------------------------------------
// MQTT → Supabase
// ---------------------------------------------------------------------------
mqttClient.on("connect", () => {
  console.log(`[bridge] Connected to MQTT broker at ${MQTT_HOST}`);
  mqttClient.subscribe(MQTT_TOPIC, (err) => {
    if (err) {
      console.error(`[bridge] Subscribe error:`, err);
    } else {
      console.log(`[bridge] Subscribed to ${MQTT_TOPIC}`);
    }
  });
});

mqttClient.on("message", async (_topic, message) => {
  try {
    const payload: TelemetryPayload = JSON.parse(message.toString());
    console.log(
      `[bridge] Received | device=${payload.deviceId} soc=${payload.soc}% battery=${payload.batteryVoltage}V`
    );

    const { error } = await supabase.from("telemetry").insert({
      device_id: payload.deviceId,
      firmware_version: payload.firmwareVersion,
      timestamp: new Date(payload.timestamp * 1000).toISOString(),
      soc: payload.soc,
      battery_voltage: payload.batteryVoltage,
      load_current: payload.loadCurrent,
      panel_voltage: payload.panelVoltage,
      panel_current: payload.panelCurrent,
      charge_state: payload.chargeState,
      error_code: payload.errorCode,
      received_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[bridge] Supabase insert error:", error.message);
    }
  } catch (err) {
    console.error("[bridge] Failed to process message:", err);
  }
});

mqttClient.on("error", (err) => {
  console.error("[bridge] MQTT error:", err);
});

mqttClient.on("offline", () => {
  console.warn("[bridge] MQTT client offline, will reconnect...");
});

console.log("[bridge] Starting WattNow MQTT → Supabase bridge...");
