import "dotenv/config";
import mqtt from "mqtt";
import type { TelemetryPayload, ChargeState } from "@wattnow/types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const brokerUrl = process.env.PUBLISHER_BROKER_URL || "mqtt://localhost:1883";
const topic = process.env.PUBLISHER_TOPIC || "solarmary/telemetry";
const intervalMs = Number(process.env.PUBLISHER_INTERVAL_MS || 5000);
const deviceId = process.env.PUBLISHER_DEVICE_ID || "fake-01";

// ---------------------------------------------------------------------------
// State (a tiny simulation so the dashboard has something interesting)
// ---------------------------------------------------------------------------
const CHARGE_STATES: ChargeState[] = ["off", "bulk", "absorption", "float", "storage"];

let soc = 65; // %
let chargeStateIdx = 1; // start in "bulk"
let tickCount = 0;

function jitter(base: number, spread: number): number {
  return Number((base + (Math.random() - 0.5) * spread).toFixed(2));
}

function nextPayload(): TelemetryPayload {
  // Slow random walk on SOC, bounded to [0, 100]
  soc = Math.max(0, Math.min(100, soc + (Math.random() - 0.45) * 1.5));

  // Cycle charge state every ~12 ticks (1 minute at default interval)
  if (tickCount > 0 && tickCount % 12 === 0) {
    chargeStateIdx = (chargeStateIdx + 1) % CHARGE_STATES.length;
  }
  tickCount++;

  return {
    deviceId,
    firmwareVersion: "0.1.0-fake",
    timestamp: Math.floor(Date.now() / 1000),
    soc: Math.round(soc),
    batteryVoltage: jitter(13.2, 0.6),
    loadCurrent: jitter(2.0, 1.5),
    panelVoltage: jitter(18.5, 2.0),
    panelCurrent: jitter(4.5, 1.5),
    chargeState: CHARGE_STATES[chargeStateIdx],
    errorCode: 0,
  };
}

// ---------------------------------------------------------------------------
// Publish loop
// ---------------------------------------------------------------------------
const client = mqtt.connect(brokerUrl);

client.on("connect", () => {
  console.log(`[publisher] Connected to ${brokerUrl}`);
  console.log(`[publisher] Publishing to "${topic}" every ${intervalMs}ms (Ctrl+C to stop)`);

  setInterval(() => {
    const payload = nextPayload();
    client.publish(topic, JSON.stringify(payload), (err) => {
      if (err) {
        console.error("[publisher] Publish error:", err);
      } else {
        console.log(
          `[publisher] sent | soc=${payload.soc}% battery=${payload.batteryVoltage}V state=${payload.chargeState}`
        );
      }
    });
  }, intervalMs);
});

client.on("error", (err) => {
  console.error("[publisher] MQTT error:", err);
  process.exit(1);
});
