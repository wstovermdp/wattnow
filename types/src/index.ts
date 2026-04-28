export type ChargeState = "off" | "bulk" | "absorption" | "float" | "storage";

export interface TelemetryPayload {
  deviceId: string;
  firmwareVersion: string;
  timestamp: number;
  soc: number;
  batteryVoltage: number;
  loadCurrent: number;
  panelVoltage: number;
  panelCurrent: number;
  chargeState: ChargeState;
  errorCode: number;
}

export interface TelemetryRow extends TelemetryPayload {
  id: string;
  receivedAt: string; // ISO timestamp from bridge insertion
}
