import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-shell";
import { EmptyState, SectionHeading, StatusPill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useClasses } from "@/lib/queries";
import { MONTH_NAMES, formatBDT, type SmsLogRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const functionsBase = (import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.EXPO_PUBLIC_SUPABASE_URL) + "/functions/v1";

const AlertsPage = () => {
  const qc = useQueryClient();
  const { data: classes } = useClasses();
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year] = useState<number>(new Date().getFullYear());
  const [classId, setClassId] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    totalUnpaid: number;
    sent: number;
    queued: number;
    failed: number;
    gatewayConfigured: boolean;
  } | null>(null);

  const { data: log, isLoading } = useQuery({
    queryKey: ["sms-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_log")
        .select("*, student:students(full_name)")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as (SmsLogRow & { student: { full_name: string } | null })[];
    },
  });

  const dispatch = async () => {
    setBusy(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`${functionsBase}/send-fee-alerts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ month, year, classId: classId === "all" ? null : classId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Dispatch failed");
      setResult({
        totalUnpaid: body.totalUnpaid,
        sent: body.sent,
        queued: body.queued,
        failed: body.failed,
        gatewayConfigured: body.gatewayConfigured,
      });
      toast.success(body.gatewayConfigured
        ? `Dispatched ${body.sent} SMS alerts`
        : `Queued ${body.queued} alerts (no gateway configured)`);
      qc.invalidateQueries({ queryKey: ["sms-log"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dispatch failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader title="Fee Alerts" subtitle="Automated SMS reminders" />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        <SectionHeading
          title="Send Due Fee Alerts"
          subtitle="Scans unpaid tuition for the selected month and texts guardians."
        />

        <Card className="border-border/60 p-5 shadow-card animate-in-up">
          {!result?.gatewayConfigured && (
            <div className="mb-4 rounded-lg border border-accent/30 bg-accent/8 px-4 py-3 text-sm text-accent-foreground">
              <strong className="font-medium">Demo mode:</strong> No SMS gateway is configured yet. Alerts will be
              queued and logged here. Add <code className="rounded bg-secondary px-1">SMS_GATEWAY_URL</code>,{" "}
              <code className="rounded bg-secondary px-1">SMS_GATEWAY_API_KEY</code>, and{" "}
              <code className="rounded bg-secondary px-1">SMS_GATEWAY_SENDER</code> secrets to go live.
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Month</span>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {MONTH_NAMES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Class</span>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All classes</option>
                {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={dispatch} disabled={busy} size="lg">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Dispatch alerts
            </Button>
          </div>

          {result && (
            <div className="mt-4 grid grid-cols-3 gap-3 animate-in-up">
              <ResultStat icon={<Clock className="h-4 w-4" />} label="Unpaid" value={result.totalUnpaid} tone="muted" />
              <ResultStat icon={<CheckCircle2 className="h-4 w-4" />} label="Sent" value={result.sent} tone="success" />
              <ResultStat icon={<XCircle className="h-4 w-4" />} label="Failed" value={result.failed} tone="destructive" />
            </div>
          )}
        </Card>

        <section className="animate-in-up" style={{ animationDelay: "60ms" }}>
          <h2 className="mb-3 font-display text-lg font-semibold">Recent activity</h2>
          {isLoading ? (
            <div className="grid place-items-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (log?.length ?? 0) === 0 ? (
            <EmptyState icon={<Bell className="h-5 w-5" />} title="No alerts sent yet" description="Dispatch alerts above to see the audit trail here." />
          ) : (
            <div className="space-y-2">
              {log?.map((l) => (
                <Card key={l.id} className="border-border/60 p-3.5 shadow-soft">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                      l.status === "sent" ? "bg-success/15 text-success"
                        : l.status === "queued" ? "bg-accent/15 text-accent"
                        : "bg-destructive/15 text-destructive"
                    )}>
                      {l.status === "sent" ? <CheckCircle2 className="h-4 w-4" /> : l.status === "queued" ? <Clock className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{l.student?.full_name ?? "Unknown"}</span>
                        <StatusPill status={l.status === "sent" ? "paid" : "unpaid"} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{l.mobile}</p>
                      <p className="mt-1 text-sm text-foreground">{l.message}</p>
                      {l.created_at && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {new Date(l.created_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

const ResultStat = ({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "success" | "destructive" | "muted" }) => (
  <div className={cn(
    "rounded-xl border px-3 py-2.5",
    tone === "success" ? "border-success/30 bg-success/5"
      : tone === "destructive" ? "border-destructive/30 bg-destructive/5"
      : "border-border/60 bg-card"
  )}>
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
    <div className={cn(
      "mt-0.5 font-display text-2xl font-semibold",
      tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-foreground"
    )}>{value}</div>
  </div>
);

export default AlertsPage;
