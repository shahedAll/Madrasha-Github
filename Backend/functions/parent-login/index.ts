// Parent authentication: Student Code + Mobile → Supabase session.
// Verifies a student exists with the given code+mobile, then either signs in
// the already-linked parent account or creates a new auth user and links it
// to the student. Returns a session the web client can persist.
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
    const { student_code, mobile } = await req.json();
    if (!student_code || !mobile) {
      return json({ error: "Student ID and mobile number are required." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const code = String(student_code).trim().toUpperCase();
    const phone = String(mobile).replace(/[^0-9+]/g, "");

    const { data: student, error: sErr } = await admin
      .from("students")
      .select("id, parent_user_id, full_name, mobile, class_id")
      .eq("student_code", code)
      .maybeSingle();

    if (sErr) throw sErr;
    if (!student) return json({ error: "No student found with that ID." }, 404);
    // Compare digits only to tolerate formatting differences.
    const studentPhoneDigits = String(student.mobile).replace(/[^0-9]/g, "");
    const normalizedInput = phone.replace(/[^0-9]/g, "");
    if (studentPhoneDigits !== normalizedInput) {
      return json({ error: "Mobile number does not match our records." }, 401);
    }

    // Case 1: parent account already linked → issue a magic link / passwordless sign-in.
    if (student.parent_user_id) {
      const { data: existing, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: `parent+${student.parent_user_id}@schoolhub.local`,
      });
      if (linkErr) throw linkErr;
      // We can't directly return a session via generateLink; instead create a
      // password-bearing identity the first time. Simpler: issue an access token
      // using admin.generateLink with `type: "recovery"` then exchange. To keep
      // this flow self-contained and session-returning, we use the service-role
      // admin to mint a session is not supported. So we instead set a deterministic
      // password on the parent account and sign in with it.
      const pwd = `Sch#${student.parent_user_id.replace(/-/g, "")}!`;
      const { data: sign, error: signErr } = await admin.auth.signInWithPassword({
        email: `parent+${student.parent_user_id}@schoolhub.local`,
        password: pwd,
      });
      if (signErr) {
        // password may not be set yet (legacy) → reset it
        const { error: upErr } = await admin.auth.admin.updateUserById(student.parent_user_id, {
          password: pwd,
        });
        if (upErr) throw upErr;
        const { data: sign2, error: sign2Err } = await admin.auth.signInWithPassword({
          email: `parent+${student.parent_user_id}@schoolhub.local`,
          password: pwd,
        });
        if (sign2Err) throw sign2Err;
        return json({ session: sign2.session, student: { id: student.id, name: student.full_name } });
      }
      return json({ session: sign.session, student: { id: student.id, name: student.full_name } });
    }

    // Case 2: no linked parent → create a new auth user with a deterministic email+password.
    const email = `parent+${code}@schoolhub.local`;
    const pwd = `Sch#${code}!`;
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password: pwd,
      email_confirm: true,
      user_metadata: { role: "parent", student_code: code },
    });
    if (cErr) throw cErr;

    // Set the parent profile role explicitly.
    await admin.from("profiles").update({ role: "parent" }).eq("id", created.user.id);

    // Link the student to this new parent user.
    const { error: linkErr2 } = await admin
      .from("students")
      .update({ parent_user_id: created.user.id })
      .eq("id", student.id);
    if (linkErr2) throw linkErr2;

    const { data: sign, error: signErr2 } = await admin.auth.signInWithPassword({ email, password: pwd });
    if (signErr2) throw signErr2;

    return json({ session: sign.session, student: { id: student.id, name: student.full_name } });
  } catch (err) {
    console.error("parent-login error", err);
    return json({ error: err instanceof Error ? err.message : "Login failed." }, 500);
  }
});
