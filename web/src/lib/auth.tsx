import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { ProfileRow, Role, StudentRow } from "@/lib/types";

interface AuthState {
  session: Session | null;
  profile: ProfileRow | null;
  child: StudentRow | null;
  loading: boolean;
  error: string | null;
}

const [AuthProvider, useAuth] = createContextHook(() => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [child, setChild] = useState<StudentRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfileAndChild = useCallback(async (uid: string) => {
    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, avatar_url")
      .eq("id", uid)
      .maybeSingle();
    if (pErr) throw pErr;
    setProfile(prof as ProfileRow | null);

    if (prof?.role === "parent") {
      const { data: st, error: sErr } = await supabase
        .from("students")
        .select("*")
        .eq("parent_user_id", uid)
        .limit(1)
        .maybeSingle();
      if (sErr) throw sErr;
      setChild(st as StudentRow | null);
    } else {
      setChild(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        try {
          await loadProfileAndChild(data.session.user.id);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to load profile");
        }
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, next) => {
      setSession(next);
      if (next?.user) {
        setLoading(true);
        try {
          await loadProfileAndChild(next.user.id);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to load profile");
        }
        setLoading(false);
      } else {
        setProfile(null);
        setChild(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfileAndChild]);

  const signInTeacher = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: e } = await supabase.auth.signInWithPassword({ email, password });
    if (e) {
      setError(e.message);
      throw e;
    }
  }, []);

  const signInParent = useCallback(async (studentCode: string, mobile: string) => {
    setError(null);
    const url = `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL ?? import.meta.env.EXPO_PUBLIC_RORK_FUNCTIONS_URL}/parent-login`;
    // Fallback to standard supabase functions URL pattern if env not set.
    const functionsBase = (import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.EXPO_PUBLIC_SUPABASE_URL) + "/functions/v1";
    const endpoint = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL ? url : `${functionsBase}/parent-login`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_code: studentCode, mobile }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Login failed");
      throw new Error(body.error ?? "Login failed");
    }
    // Persist the returned session.
    if (body.session?.access_token) {
      const { error: setErr } = await supabase.auth.setSession({
        access_token: body.session.access_token,
        refresh_token: body.session.refresh_token,
      });
      if (setErr) {
        setError(setErr.message);
        throw setErr;
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setChild(null);
  }, []);

  const isStaff = useMemo(() => profile?.role === "admin" || profile?.role === "teacher", [profile]);

  return {
    session,
    profile,
    child,
    loading,
    error,
    isStaff,
    role: (profile?.role ?? null) as Role | null,
    signInTeacher,
    signInParent,
    signOut,
    setError,
  } satisfies AuthState & {
    isStaff: boolean;
    role: Role | null;
    signInTeacher: (email: string, password: string) => Promise<void>;
    signInParent: (studentCode: string, mobile: string) => Promise<void>;
    signOut: () => Promise<void>;
    setError: (e: string | null) => void;
  };
});

export { AuthProvider, useAuth };
