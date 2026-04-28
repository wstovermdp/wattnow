import { supabase } from "@/lib/supabase";
import type { TelemetryRow } from "@wattnow/types";

export const revalidate = 60; // ISR: refresh every 60s

async function getLatestTelemetry(): Promise<TelemetryRow | null> {
  const { data } = await supabase
    .from("telemetry")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(1)
    .single();

  return data as TelemetryRow | null;
}

export default async function Dashboard() {
  const latest = await getLatestTelemetry();

  if (!latest) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400">No telemetry data yet.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">WattNow</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="State of Charge" value={`${latest.soc}%`} />
        <Card label="Battery" value={`${latest.batteryVoltage}V`} />
        <Card label="Panel" value={`${latest.panelVoltage}V / ${latest.panelCurrent}A`} />
        <Card label="Charge State" value={latest.chargeState} />
        <Card label="Load Current" value={`${latest.loadCurrent}A`} />
        <Card label="Error Code" value={String(latest.errorCode)} />
        <Card label="Device" value={latest.deviceId} />
        <Card label="Firmware" value={latest.firmwareVersion} />
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
