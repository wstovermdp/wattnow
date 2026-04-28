# WattNow

Distributed Energy Resource Management (DERM) portfolio project.

An ESP32 monitors a solar charge controller, publishes telemetry over MQTT to HiveMQ, which is bridged to a Supabase Postgres database and displayed in a React dashboard.

## Architecture

```
ESP32  ──MQTT──▸  HiveMQ  ──▸  Bridge (Railway)  ──▸  Supabase Postgres
                                                            │
                                                     React Dashboard (Vercel)
```

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
- **PlatformIO** (for firmware)
- A **HiveMQ Cloud** cluster
- A **Supabase** project with a `telemetry` table

### Install dependencies

```bash
npm install          # installs all workspaces
```

### Firmware

Copy the example config and fill in your secrets:

```bash
cp firmware/src/example.config.h firmware/src/config.h
```

Build and upload with PlatformIO.

### Bridge

```bash
cp bridge/.env.example bridge/.env
# fill in MQTT + Supabase credentials
npm run dev:bridge
```

### Web

```bash
cp web/.env.example web/.env.local
# fill in Supabase public credentials
npm run dev:web
```

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

- **v1** — Read-only monitoring dashboard
- **v2** — Bidirectional: send commands back to the charge controller
