// SMS fee-alert dispatcher edge function.
// Scans fee_months for unpaid rows in the current month/year, builds a localized
// BDT message per student, and dispatches via the configured SMS gateway.
// Falls back to "queued" with a logged message if no gateway is configured, so
// the feature is demoable without credentials.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface UnpaidRow {
  student_id: string;
  amount: number;
  month: number;
  year: number;
  full_name: string;
  mobile: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Verify caller is staff.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);
    const { data: prof } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!prof || (prof.role !== "admin" && prof.role !== "teacher")) {
      return json({ error: "Forbidden — staff only" }, 403);
    }

    // Optional body: { month?, year?, classId? } — default current month.
    const body = await req.json().catch(() => ({}));
    const now = new Date();
    const targetYear = Number(body?.year) || now.getFullYear();
    const targetMonth = Number(body?.month) || now.getMonth() + 1;
    const classFilter = body?.classId ?? null;

    // Fetch unpaid fee_months joined to students.
    let query = admin
      .from("fee_months")
      .select(`
        student_id, amount, month, year,
        student:students(full_name, mobile, class_id)
      `)
      .eq("status", "unpaid")
      .eq("year", targetYear);
    if (classFilter) query = query.eq("student.class_id", classFilter);
    const { data: rows, error: qErr } = await query;
    if (qErr) throw qErr;

    const unpaid = (rows ?? []) as unknown as Array<{
      student_id: string;
      amount: number;
      month: number;
      year: number;
      student: { full_name: string; mobile: string; class_id: string } | null;
    }>;
    const filtered = unpaid.filter((r) => r.student != null);

    const gatewayUrl = Deno.env.get("SMS_GATEWAY_URL");
    const gatewayApiKey = Deno.env.get("SMS_GATEWAY_API_KEY");
    const gatewaySender = Deno.env.get("SMS_GATEWAY_SENDER") ?? "SCHOOLHUB";
    const gatewayConfigured = Boolean(gatewayUrl && gatewayApiKey);

    const dispatched: { student_id: string; mobile: string; message: string; status: string }[] = [];
    const monthName = MONTH_NAMES[targetMonth - 1] ?? String(targetMonth);

    for (const row of filtered) {
      const amount = Math.round(Number(row.amount));
      const message = `Dear Parent, the tuition fee for ${row.student!.full_name} for the month of ${monthName} is outstanding. Please clear the balance of ${amount} BDT.`;

      let status: "sent" | "queued" | "failed" = "queued";
      let providerResponse = "";

      if (gatewayConfigured) {
        try {
          const res = await fetch(gatewayUrl!, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${gatewayApiKey}`,
            },
            body: JSON.stringify({
              to: row.student!.mobile,
              message,
              sender: gatewaySender,
            }),
          });
          providerResponse = await res.text();
          status = res.ok ? "sent" : "failed";
        } catch (err) {
          providerResponse = err instanceof Error ? err.message : "network error";
          status = "failed";
        }
      } else {
        // No gateway — log + queue so the UI can still demonstrate the flow.
        console.log(`[sms] (queued, no gateway) → ${row.student!.mobile}: ${message}`);
        providerResponse = "No gateway configured — message queued locally.";
      }

      await admin.from("sms_log").insert({
        student_id: row.student_id,
        mobile: row.student!.mobile,
        message,
        status,
        provider_response: providerResponse,
        triggered_by: user.id,
      });

      dispatched.push({ student_id: row.student_id, mobile: row.student!.mobile, message, status });
    }

    return json({
      ok: true,
      gatewayConfigured,
      targetMonth: monthName,
      targetYear,
      totalUnpaid: filtered.length,
      dispatched: dispatched.length,
      sent: dispatched.filter((d) => d.status === "sent").length,
      queued: dispatched.filter((d) => d.status === "queued").length,
      failed: dispatched.filter((d) => d.status === "failed").length,
      items: dispatched,
    });
  } catch (err) {
    console.error("send-fee-alerts error", err);
    return json({ error: err instanceof Error ? err.message : "Failed to dispatch alerts." }, 500);
  }
});
