# WattNow

Distributed Energy Resource Management (DERM) portfolio project.

An ESP32 monitors a solar charge controller, publishes telemetry over MQTT to HiveMQ, which is bridged to a Supabase Postgres database and displayed in a React dashboard.

## Architecture

```
ESP32  ──MQTT──▸  HiveMQ  ──▸  Bridge (Railway)  ──▸  Supabase Postgres
                                                            │
                                              ┌─────────────┴──────────────┐
                                         Realtime sub              Historical query
                                       (new rows pushed)        (SELECT last N rows)
                                              └─────────────┬──────────────┘
                                                     React Dashboard (Vercel)
```

### Design decisions

**Why Supabase for realtime?** An alternative is the bridge fanning out directly to frontend clients via SSE. That approach is lower latency but makes the bridge a stateful service — Railway restarts drop all connections, and horizontal scaling requires a Redis pub/sub backplane. Supabase Realtime offloads that infrastructure and maps cleanly onto the individual-consumer model via Row Level Security.

**Target scale model:** Individual consumers monitoring their own device (think Victron VRM, Tesla app), not a single operator watching thousands of devices. RLS enforces per-user data isolation at the database layer.

## Monorepo Structure

```
wattnow/
  firmware/   ESP32 PlatformIO project (Arduino / C++)
  bridge/     Node.js service — MQTT subscriber → Supabase ingestion
  web/        Next.js dashboard — reads from Supabase
  types/      Shared TypeScript types for telemetry schema
```

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **Mosquitto** — local MQTT broker (`brew install mosquitto`)
- **PlatformIO** — for firmware
- A **HiveMQ Cloud** cluster (production)
- A **Supabase** project with the `telemetry` table created (see schema below)

### Install dependencies

```bash
npm install          # installs all workspaces
```

### Local MQTT broker (Mosquitto)

Mosquitto 2.x requires an explicit listener. Add to `/opt/homebrew/etc/mosquitto/mosquitto.conf` (Apple Silicon) or `/usr/local/etc/mosquitto/mosquitto.conf` (Intel):

```
listener 1883
allow_anonymous true
```

Then start it:

```bash
brew services start mosquitto
```

### Bridge

```bash
cp bridge/.env.example bridge/.env
# fill in your Supabase URL and service-role key
# leave MQTT_USERNAME and MQTT_PASSWORD empty for local Mosquitto
npm run dev:bridge
```

### Fake publisher (local testing)

In a second terminal, send simulated telemetry to the local broker:

```bash
npm run dev:publisher
```

The bridge will pick up each message and insert a row into the `telemetry` table.

### Web

```bash
cp web/.env.example web/.env.local
# NEXT_PUBLIC_SUPABASE_URL  → your Supabase project URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY → publishable (anon) key, safe for the browser
npm run dev:web
```

### Firmware

Copy the example config and fill in your secrets:

```bash
cp firmware/src/example.config.h firmware/src/config.h
```

Build and upload with PlatformIO.

## Supabase Schema

```sql
CREATE TABLE telemetry (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id     TEXT NOT NULL,
  firmware_version TEXT,
  timestamp     TIMESTAMPTZ,
  soc           SMALLINT,
  battery_voltage REAL,
  load_current  REAL,
  panel_voltage REAL,
  panel_current REAL,
  charge_state  TEXT,
  error_code    SMALLINT DEFAULT 0,
  received_at   TIMESTAMPTZ DEFAULT now()
);
```

## Roadmap

- **v1a** — Realtime monitor: live tiles updating as telemetry arrives (Supabase Realtime)
- **v1b** — Historical: time-series chart of past readings
- **v2** — Bidirectional: send commands back to the charge controller
- **v3** — ESP32 provisioner: captive-portal WiFi provisioning (device hosts a soft AP, user submits credentials via browser)
