import { useMemo, useState } from "react";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Loader2,
  NotebookPen,
  TrendingUp,
  User,
  Wallet,
  XCircle,
} from "lucide-react";

import { AppHeader, TabBar } from "@/components/app-shell";
import { Avatar, EmptyState, SectionHeading, StatusPill } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import {
  useClassHomework,
  useClasses,
  useFeeMonths,
  useGradesForStudent,
  useOtherFees,
  useStudentAttendance,
} from "@/lib/queries";
import {
  EXAM_TIERS,
  MONTH_NAMES,
  MONTH_SHORT,
  formatBDT,
  gradeColor,
  gradeFromAverage,
  type GradeRow,
  type SubjectRow,
  type ExamRow,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type ParentTab = "profile" | "attendance" | "grades" | "fees" | "homework";

const ParentHome = ({ tab }: { tab: ParentTab }) => {
  const { child, profile } = useAuth();
  const { data: classes } = useClasses();

  if (!child) {
    return (
      <div className="min-h-screen bg-paper">
        <AppHeader title="Parent Portal" />
        <main className="mx-auto max-w-2xl px-4 py-10">
          <EmptyState
            icon={<User className="h-5 w-5" />}
            title="No child linked yet"
            description="If you just signed in, your child's record may still be syncing. Try signing out and back in."
          />
        </main>
      </div>
    );
  }

  const className = classes?.find((c) => c.id === child.class_id)?.name ?? "—";
  const base = "/parent";

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader
        title={child.full_name}
        subtitle={`${className} · Roll #${child.roll_no}`}
        right={
          <span className="hidden rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground sm:inline">
            {profile?.email}
          </span>
        }
      />
      <TabBar
        items={[
          { to: base, label: "Profile" },
          { to: `${base}/attendance`, label: "Attendance" },
          { to: `${base}/grades`, label: "Grades" },
          { to: `${base}/fees`, label: "Fees" },
          { to: `${base}/homework`, label: "Homework" },
        ]}
      />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {tab === "profile" && <ProfileView child={child} className={className} />}
        {tab === "attendance" && <AttendanceView studentId={child.id} />}
        {tab === "grades" && <GradesView studentId={child.id} />}
        {tab === "fees" && <FeesView studentId={child.id} />}
        {tab === "homework" && <HomeworkView classId={child.class_id} />}
      </main>
    </div>
  );
};

export default ParentHome;

// ---------- Profile ----------
const ProfileView = ({ child, className }: { child: NonNullable<ReturnType<typeof useAuth>["child"]>; className: string }) => {
  return (
    <div className="space-y-5 animate-in-up">
      <Card className="overflow-hidden border-border/60 shadow-card">
        <div className="relative h-24 bg-gradient-to-br from-primary to-[hsl(160_45%_16%)]">
          <div className="absolute inset-0 bg-grid opacity-20" />
        </div>
        <div className="px-5 pb-5">
          <div className="-mt-10 flex items-end gap-4">
            <div className="rounded-full ring-4 ring-card">
              <Avatar name={child?.full_name ?? ""} src={child?.photo_url} size={72} />
            </div>
            <div className="pb-1">
              <h1 className="font-display text-2xl font-semibold">{child?.full_name}</h1>
              <p className="text-sm text-muted-foreground">{className}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <InfoTile label="Student ID" value={child?.student_code ?? "—"} />
            <InfoTile label="Roll No" value={String(child?.roll_no ?? "—")} />
            <InfoTile label="Guardian" value={child?.guardian_name ?? "—"} />
            <InfoTile label="Mobile" value={child?.mobile ?? "—"} />
          </div>
        </div>
      </Card>

      <SectionHeading title="Quick links" subtitle="Jump to attendance, grades, fees or homework." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: <CalendarDays className="h-5 w-5" />, label: "Attendance", to: "/parent/attendance", color: "bg-emerald-500/15 text-emerald-700" },
          { icon: <TrendingUp className="h-5 w-5" />, label: "Grades", to: "/parent/grades", color: "bg-sky-500/15 text-sky-700" },
          { icon: <Wallet className="h-5 w-5" />, label: "Fees", to: "/parent/fees", color: "bg-amber-500/15 text-amber-700" },
          { icon: <NotebookPen className="h-5 w-5" />, label: "Homework", to: "/parent/homework", color: "bg-violet-500/15 text-violet-700" },
        ].map((q) => (
          <a key={q.label} href={q.to}>
            <Card className="flex flex-col items-center gap-2 p-4 text-center transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className={cn("grid h-10 w-10 place-items-center rounded-xl", q.color)}>{q.icon}</div>
              <div className="text-sm font-medium">{q.label}</div>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
};

const InfoTile = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-border/60 bg-card p-3">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="mt-0.5 truncate text-sm font-medium">{value}</div>
  </div>
);

// ---------- Attendance ----------
const AttendanceView = ({ studentId }: { studentId: string }) => {
  const [monthOffset, setMonthOffset] = useState(0);
  const refDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);
  const monthIso = format(refDate, "yyyy-MM");
  const { data: records, isLoading } = useStudentAttendance(studentId, monthIso);

  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(refDate), end: endOfMonth(refDate) }), [refDate]);
  const statusMap = useMemo(() => {
    const m = new Map<string, "present" | "absent">();
    for (const r of records ?? []) m.set(r.class_date, r.status);
    return m;
  }, [records]);

  const present = [...statusMap.values()].filter((s) => s === "present").length;
  const absent = [...statusMap.values()].filter((s) => s === "absent").length;

  return (
    <div className="space-y-5 animate-in-up">
      <SectionHeading
        title="Attendance"
        subtitle="Green = present, red = absent. Days without a marker had no school."
        action={
          <div className="flex gap-1">
            <button onClick={() => setMonthOffset((o) => o - 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card hover:bg-secondary">‹</button>
            <button onClick={() => setMonthOffset((o) => o + 1)} disabled={monthOffset >= 0} className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card hover:bg-secondary disabled:opacity-40">›</button>
          </div>
        }
      />

      <Card className="border-border/60 p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">{format(refDate, "MMMM yyyy")}</h3>
          <div className="flex gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 text-success"><CheckCircle2 className="h-4 w-4" /> {present}</span>
            <span className="inline-flex items-center gap-1.5 text-destructive"><XCircle className="h-4 w-4" /> {absent}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="pb-1 text-center text-[11px] font-medium text-muted-foreground">{d}</div>
            ))}
            {days.map((day) => {
              const iso = format(day, "yyyy-MM-dd");
              const status = statusMap.get(iso);
              const isFuture = day > new Date();
              return (
                <div
                  key={iso}
                  className={cn(
                    "grid aspect-square place-items-center rounded-lg text-xs font-medium",
                    isFuture && "opacity-30",
                    status === "present" && "bg-success text-success-foreground",
                    status === "absent" && "bg-destructive text-destructive-foreground",
                    !status && !isFuture && "bg-secondary text-muted-foreground",
                    !status && isFuture && "bg-secondary/40",
                    isToday(day) && "ring-2 ring-accent ring-offset-1 ring-offset-card"
                  )}
                  title={status ? `${iso} — ${status}` : iso}
                >
                  {format(day, "d")}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

// ---------- Grades ----------
const GradesView = ({ studentId }: { studentId: string }) => {
  const { data: grades, isLoading } = useGradesForStudent(studentId);

  const byTier = useMemo(() => {
    const map = new Map<string, { exam: ExamRow; rows: (GradeRow & { subject: SubjectRow })[] }>();
    for (const g of grades ?? []) {
      const key = g.exam.tier + "|" + g.exam.id;
      const entry = map.get(key) ?? { exam: g.exam, rows: [] };
      entry.rows.push(g);
      map.set(key, entry);
    }
    return [...map.values()];
  }, [grades]);

  return (
    <div className="space-y-5 animate-in-up">
      <SectionHeading title="Academic Grades" subtitle="All exams across the year, with auto-calculated totals and grade." />

      {isLoading ? (
        <div className="grid place-items-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : byTier.length === 0 ? (
        <EmptyState icon={<TrendingUp className="h-5 w-5" />} title="No grades published" description="Your child's marks will appear here once teachers enter them." />
      ) : (
        EXAM_TIERS.map((tier) => {
          const tierEntries = byTier.filter((e) => e.exam.tier === tier.tier);
          if (tierEntries.length === 0) return null;
          return (
            <section key={tier.tier} className="space-y-2">
              <h3 className="font-display text-base font-semibold">{tier.label}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tierEntries.map((entry) => {
                  const totalObt = entry.rows.reduce((a, b) => a + Number(b.obtained), 0);
                  const totalMax = entry.rows.reduce((a, b) => a + Number(b.total), 0);
                  const avg = totalMax > 0 ? (totalObt / totalMax) * 100 : 0;
                  return (
                    <Card key={entry.exam.id} className="border-border/60 p-4 shadow-soft">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{entry.exam.name}</div>
                        <span className={cn("font-display text-lg font-semibold", gradeColor(avg))}>
                          {gradeFromAverage(avg)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Total {totalObt.toFixed(0)} / {totalMax.toFixed(0)} · Avg {avg.toFixed(1)}%
                      </div>
                      <div className="mt-3 space-y-1">
                        {entry.rows
                          .slice()
                          .sort((a, b) => a.subject.position - b.subject.position)
                          .map((g) => (
                            <div key={g.id} className="flex items-center justify-between rounded-md bg-secondary/50 px-2.5 py-1.5 text-sm">
                              <span className="truncate">{g.subject.name}</span>
                              <span className="font-medium">{Number(g.obtained)}<span className="text-muted-foreground">/{Number(g.total)}</span></span>
                            </div>
                          ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
};

// ---------- Fees ----------
const FeesView = ({ studentId }: { studentId: string }) => {
  const year = new Date().getFullYear();
  const { data: months } = useFeeMonths(studentId, year);
  const { data: otherFees } = useOtherFees(studentId);

  const paid = (months ?? []).filter((m) => m.status === "paid").reduce((a, b) => a + Number(b.amount), 0);
  const due = (months ?? []).filter((m) => m.status === "unpaid").reduce((a, b) => a + Number(b.amount), 0);
  const otherDue = (otherFees ?? []).filter((f) => f.status === "unpaid").reduce((a, b) => a + Number(b.amount), 0);

  return (
    <div className="space-y-5 animate-in-up">
      <SectionHeading title="Fees" subtitle={`${year} tuition and one-time charges.`} />

      <div className="grid grid-cols-3 gap-3">
        <SummaryTile label="Paid" value={formatBDT(paid)} tone="success" />
        <SummaryTile label="Tuition due" value={formatBDT(due)} tone="destructive" />
        <SummaryTile label="Other due" value={formatBDT(otherDue)} tone="warning" />
      </div>

      <div>
        <h3 className="mb-2 font-display text-base font-semibold">Monthly tuition</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {MONTH_NAMES.map((_, i) => {
            const row = (months ?? []).find((m) => m.month === i + 1);
            return (
              <div key={i} className={cn(
                "flex items-center justify-between rounded-xl border p-3",
                row?.status === "paid" ? "border-success/30 bg-success/5" : "border-border/60 bg-card"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "grid h-9 w-9 place-items-center rounded-lg text-xs font-semibold",
                    row?.status === "paid" ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
                  )}>{MONTH_SHORT[i]}</div>
                  <div>
                    <div className="text-sm font-medium">{MONTH_NAMES[i]}</div>
                    <div className="text-xs text-muted-foreground">{row ? formatBDT(Number(row.amount)) : "—"}</div>
                  </div>
                </div>
                {row && <StatusPill status={row.status} />}
              </div>
            );
          })}
        </div>
      </div>

      {(otherFees?.length ?? 0) > 0 && (
        <div>
          <h3 className="mb-2 font-display text-base font-semibold">Other fees</h3>
          <div className="space-y-2">
            {otherFees?.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3">
                <div>
                  <div className="text-sm font-medium">{f.label}</div>
                  <div className="text-xs text-muted-foreground">{formatBDT(Number(f.amount))}</div>
                </div>
                <StatusPill status={f.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryTile = ({ label, value, tone }: { label: string; value: string; tone: "success" | "destructive" | "warning" }) => (
  <Card className={cn(
    "border p-4 shadow-soft",
    tone === "success" ? "border-success/30 bg-success/5"
      : tone === "destructive" ? "border-destructive/30 bg-destructive/5"
      : "border-accent/30 bg-accent/5"
  )}>
    <div className={cn(
      "font-display text-xl font-semibold",
      tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-accent"
    )}>{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </Card>
);

// ---------- Homework ----------
const HomeworkView = ({ classId }: { classId: string }) => {
  const { data: homework, isLoading } = useClassHomework(classId);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof homework>();
    for (const h of homework ?? []) {
      const arr = map.get(h.task_date) ?? [];
      arr.push(h);
      map.set(h.task_date, arr);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [homework]);

  return (
    <div className="space-y-5 animate-in-up">
      <SectionHeading title="Daily Homework" subtitle="Assignments for your child's class, newest first." />
      {isLoading ? (
        <div className="grid place-items-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : grouped.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-5 w-5" />} title="No homework posted" description="New assignments will appear here as teachers post them." />
      ) : (
        <div className="space-y-6">
          {grouped.map(([dateStr, items]) => (
            <section key={dateStr}>
              <div className="mb-2 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-display text-base font-semibold">{format(parseISO(dateStr), "EEEE, dd MMM yyyy")}</h3>
              </div>
              <div className="space-y-2.5">
                {items!.map((h) => (
                  <Card key={h.id} className="border-border/60 p-4 shadow-soft">
                    <div className="mb-1.5 inline-block rounded-lg bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary">
                      {h.subject}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{h.task}</p>
                    {h.image_url && (
                      <a href={h.image_url} target="_blank" rel="noreferrer" className="mt-2 inline-block">
                        <img src={h.image_url} alt="attachment" className="max-h-48 rounded-lg border border-border object-cover" />
                      </a>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
