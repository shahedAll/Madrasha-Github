import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Loader2, LogIn, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Mode = "teacher" | "parent";

const Login = () => {
  const { signInTeacher, signInParent } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("teacher");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "teacher") {
        await signInTeacher(email.trim(), password);
        toast.success("Welcome back");
        navigate("/app", { replace: true });
      } else {
        await signInParent(studentCode.trim(), mobile.trim());
        toast.success("Logged in");
        navigate("/parent", { replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-paper">
      {/* Atmospheric backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
        <header className="flex flex-col items-center text-center animate-in-up">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-card">
            <GraduationCap className="h-8 w-8" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground">
            SchoolHub
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Primary school management for teachers &amp; parents
          </p>
        </header>

        {/* Mode toggle */}
        <div className="mt-8 grid grid-cols-2 gap-1 rounded-xl bg-secondary/80 p-1 animate-in-up" style={{ animationDelay: "60ms" }}>
          {(["teacher", "parent"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all",
                mode === m
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "teacher" ? <ShieldCheck className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
              {m === "teacher" ? "Teacher / Admin" : "Parent"}
            </button>
          ))}
        </div>

        <form
          onSubmit={submit}
          className="mt-5 space-y-4 rounded-2xl border border-border/60 bg-card/90 p-6 shadow-card animate-in-up backdrop-blur-sm"
          style={{ animationDelay: "120ms" }}
        >
          {mode === "teacher" ? (
            <>
              <Field label="Email">
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                  autoComplete="email"
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Student ID">
                <Input
                  required
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  placeholder="e.g. SH-0001"
                  autoCapitalize="characters"
                />
              </Field>
              <Field label="Registered Mobile Number">
                <Input
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="e.g. 01XXXXXXXXX"
                  inputMode="tel"
                />
              </Field>
              <p className="rounded-lg bg-secondary/70 px-3 py-2 text-xs text-muted-foreground">
                Use the Student ID printed on the fee card &amp; the guardian mobile number on file.
              </p>
            </>
          )}

          <Button type="submit" disabled={busy} className="w-full" size="lg">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground animate-in-fade" style={{ animationDelay: "220ms" }}>
          {mode === "teacher"
            ? "Staff accounts are created by the school administrator."
            : "First-time sign-in securely links your mobile number to your child's record."}
        </p>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
    {children}
  </div>
);

export default Login;
