import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Bell, BookOpen, CheckSquare, GraduationCap, Loader2, NotebookPen, Users } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useClassCounts, useClasses } from "@/lib/queries";
import { cn } from "@/lib/utils";

const CLASS_VISUALS: Record<string, { gradient: string; ring: string; emoji: string }> = {
  play: { gradient: "from-amber-400/30 to-amber-200/10", ring: "ring-amber-400/30", emoji: "🧸" },
  "class-1": { gradient: "from-emerald-500/30 to-emerald-200/10", ring: "ring-emerald-500/30", emoji: "🌱" },
  "class-2": { gradient: "from-sky-500/30 to-sky-200/10", ring: "ring-sky-500/30", emoji: "📘" },
  "class-3": { gradient: "from-violet-500/30 to-violet-200/10", ring: "ring-violet-500/30", emoji: "🚀" },
};

const visualFor = (slug: string) => CLASS_VISUALS[slug] ?? CLASS_VISUALS["class-1"];

const TeacherDashboard = () => {
  const { data: classes, isLoading } = useClasses();
  const { data: counts } = useClassCounts();

  const totalStudents = useMemo(() => Object.values(counts ?? {}).reduce((a, b) => a + b, 0), [counts]);

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader title="Dashboard" subtitle={`${totalStudents} students enrolled`} />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Greeting strip */}
        <section className="mb-7 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary to-[hsl(160_45%_16%)] p-6 text-primary-foreground shadow-card animate-in-up sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-primary-foreground/70">Today</p>
              <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
                Welcome back 👋
              </h1>
              <p className="mt-1 text-sm text-primary-foreground/80">
                Pick a class to take attendance, record grades, or post homework.
              </p>
            </div>
            <div className="grid h-20 w-20 place-items-center rounded-2xl bg-white/10 text-4xl backdrop-blur-sm">
              <GraduationCap className="h-10 w-10" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Classes", value: classes?.length ?? "—" },
              { label: "Students", value: totalStudents },
              { label: "Active today", value: "—" },
              { label: "Dues pending", value: "—" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="font-display text-2xl font-semibold">{s.value}</div>
                <div className="text-xs text-primary-foreground/70">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Classes */}
        <section className="animate-in-up" style={{ animationDelay: "60ms" }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Classes</h2>
            <span className="text-xs text-muted-foreground">Tap to open class hub</span>
          </div>

          {isLoading ? (
            <div className="grid place-items-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {classes?.map((c, idx) => {
                const v = visualFor(c.slug);
                return (
                  <Link
                    key={c.id}
                    to={`/app/class/${c.slug}`}
                    className="group animate-in-up"
                    style={{ animationDelay: `${80 + idx * 60}ms` }}
                  >
                    <Card
                      className={cn(
                        "relative overflow-hidden border-border/60 bg-card p-5 shadow-card ring-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
                        v.ring
                      )}
                    >
                      <div className={cn("absolute inset-0 -z-10 bg-gradient-to-br", v.gradient)} />
                      <div className="absolute -right-3 -top-3 text-6xl opacity-30 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">
                        {v.emoji}
                      </div>
                      <div className="relative">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {counts?.[c.id] ?? 0} students
                        </div>
                        <div className="mt-1 font-display text-2xl font-semibold text-foreground">
                          {c.name}
                        </div>
                        <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors group-hover:text-accent">
                          Open hub
                          <span className="transition-transform group-hover:translate-x-1">→</span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Quick actions */}
        <section className="mt-8 animate-in-up" style={{ animationDelay: "180ms" }}>
          <h2 className="mb-3 font-display text-xl font-semibold">Quick actions</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <QuickActionCard
              icon={<NotebookPen className="h-5 w-5" />}
              title="Post Homework"
              description="Compose a new assignment for any class."
              onClick={() => toast("Pick a class to post homework for.")}
            />
            <QuickActionCard
              icon={<Bell className="h-5 w-5" />}
              title="Send Due Fee Alerts"
              description="Trigger SMS reminders to guardians with unpaid fees."
              accent
              to="/app/alerts"
            />
          </div>
        </section>

        {/* Shortcut tiles */}
        <section className="mt-8 grid gap-4 sm:grid-cols-3 animate-in-up" style={{ animationDelay: "240ms" }}>
          <ShortcutTile icon={<Users className="h-5 w-5" />} label="Students" hint="Directory & attendance" to="/app" />
          <ShortcutTile icon={<CheckSquare className="h-5 w-5" />} label="Grades" hint="Exam & subject marks" to="/app" />
          <ShortcutTile icon={<BookOpen className="h-5 w-5" />} label="Homework" hint="Daily assignments" to="/app" />
        </section>
      </main>
    </div>
  );
};

const QuickActionCard = ({
  icon,
  title,
  description,
  onClick,
  to,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
  to?: string;
  accent?: boolean;
}) => {
  const inner = (
    <Card className={cn("flex items-center gap-4 border-border/60 p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lg", accent && "ring-1 ring-accent/30")}>
      <div className={cn("grid h-12 w-12 place-items-center rounded-xl", accent ? "bg-accent/15 text-accent" : "bg-primary/15 text-primary")}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-display text-base font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <span className="text-muted-foreground transition-transform group-hover:translate-x-1">→</span>
    </Card>
  );

  return to ? (
    <Link to={to} className="group">{inner}</Link>
  ) : (
    <button onClick={onClick} className="group w-full text-left">{inner}</button>
  );
};

const ShortcutTile = ({ icon, label, hint, to }: { icon: React.ReactNode; label: string; hint: string; to: string }) => (
  <Link to={to}>
    <Card className="flex items-center gap-3 border-border/60 p-4 shadow-soft transition-all hover:bg-secondary/40">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-foreground">{icon}</div>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
    </Card>
  </Link>
);

export default TeacherDashboard;
