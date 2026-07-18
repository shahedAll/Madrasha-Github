// One-time bootstrap: creates a demo teacher auth account and marks its profile
// as a teacher, so the user can immediately sign in and explore the staff UI.
// Safe to call repeatedly — it updates the existing user if found.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const email = "teacher@schoolhub.demo";
    const password = "schoolhub2026";

    // Try to find an existing user with this email first.
    const { data: list, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) throw listErr;
    const existing = (list.users ?? []).find((u) => u.email === email);

    let userId: string;
    if (existing) {
      // Update password + confirm email.
      const { error: upErr } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      });
      if (upErr) throw upErr;
      userId = existing.id;
    } else {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: "teacher", full_name: "Ms. Nusrat Jahan" },
      });
      if (cErr) throw cErr;
      userId = created.user.id;
    }

    // Ensure profile role is teacher.
    const { error: pErr } = await admin
      .from("profiles")
      .upsert({ id: userId, email, role: "teacher", full_name: "Ms. Nusrat Jahan" }, { onConflict: "id" });
    if (pErr) throw pErr;

    return json({
      ok: true,
      email,
      password,
      message: "Demo teacher account ready. You can now sign in on the login screen.",
    });
  } catch (err) {
    console.error("bootstrap-teacher error", err);
    return json({ error: err instanceof Error ? err.message : "Bootstrap failed." }, 500);
  }
});
