import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState, SectionHeading } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useExams, useGradesForExam, useStudents, useSubjects } from "@/lib/queries";
import {
  DEFAULT_SUBJECTS,
  EXAM_TIERS,
  gradeColor,
  gradeFromAverage,
  type ExamRow,
  type ExamTier,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const GradesTab = ({ classId }: { classId: string }) => {
  const { data: exams } = useExams(classId);
  const { data: students } = useStudents(classId);
  const { data: subjects } = useSubjects(classId);

  const groupedByTier = useMemo(() => {
    const map = new Map<ExamTier, ExamRow[]>();
    for (const t of EXAM_TIERS) map.set(t.tier, []);
    for (const e of exams ?? []) map.get(e.tier)?.push(e);
    return map;
  }, [exams]);

  const [openExam, setOpenExam] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Academic Grades"
        subtitle="Model Tests nest 3 sub-exams; terms & finals are flat."
        action={<ManageExamsDialog classId={classId} />}
      />

      {subjects && subjects.length === 0 && (
        <Card className="border-accent/30 bg-accent/8 p-4 text-sm text-accent-foreground">
          No subjects defined for this class yet. Add subjects via “Manage exams” to start entering marks.
        </Card>
      )}

      {(students?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No students to grade"
          description="Add students in the Students tab first."
        />
      ) : (
        <div className="space-y-6">
          {EXAM_TIERS.map((tier) => {
            const tierExams = groupedByTier.get(tier.tier) ?? [];
            if (tierExams.length === 0) return null;
            return (
              <section key={tier.tier} className="animate-in-up">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="font-display text-lg font-semibold">{tier.label}</h3>
                  <span className="text-xs text-muted-foreground">{tierExams.length} exam{tierExams.length > 1 ? "s" : ""}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tierExams.map((exam) => (
                    <ExamCard
                      key={exam.id}
                      exam={exam}
                      classId={classId}
                      open={openExam === exam.id}
                      onToggle={() => setOpenExam(openExam === exam.id ? null : exam.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ExamCard = ({ exam, classId, open, onToggle }: { exam: ExamRow; classId: string; open: boolean; onToggle: () => void }) => {
  return (
    <Card className="overflow-hidden border-border/60 shadow-soft animate-in-scale">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/40"
      >
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/12 text-primary">
          {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{exam.name}</div>
          <div className="text-xs text-muted-foreground">Tap to enter marks</div>
        </div>
      </button>
      {open && <MarksEditor examId={exam.id} classId={classId} />}
    </Card>
  );
};

const MarksEditor = ({ examId, classId }: { examId: string; classId: string }) => {
  const { data: subjects } = useSubjects(classId);
  const { data: students } = useStudents(classId);
  const { data: grades } = useGradesForExam(examId);
  return (
    <MarksEditorInner
      examId={examId}
      subjects={subjects ?? []}
      students={students ?? []}
      grades={grades ?? []}
    />
  );
};

const MarksEditorInner = ({
  examId,
  subjects,
  students,
  grades,
}: {
  examId: string;
  subjects: { id: string; name: string }[];
  students: { id: string; full_name: string; roll_no: number; student_code: string }[];
  grades: { id: string; student_id: string; subject_id: string; obtained: number; total: number }[];
}) => {
  const qc = useQueryClient();
  const gradeMap = useMemo(() => {
    const m = new Map<string, { id: string; obtained: number; total: number }>();
    for (const g of grades) m.set(`${g.student_id}|${g.subject_id}`, g);
    return m;
  }, [grades]);

  // Local edits: keyed `${studentId}|${subjectId}` -> { obtained, total }
  const [edits, setEdits] = useState<Record<string, { obtained: string; total: string }>>({});
  const [activeStudent, setActiveStudent] = useState<string | null>(students[0]?.id ?? null);

  const getEdit = (sid: string, subId: string) => {
    const key = `${sid}|${subId}`;
    if (edits[key]) return edits[key];
    const g = gradeMap.get(key);
    return { obtained: g ? String(g.obtained) : "", total: g ? String(g.total) : "100" };
  };

  const setEdit = (sid: string, subId: string, field: "obtained" | "total", value: string) => {
    setEdits((prev) => ({ ...prev, [`${sid}|${subId}`]: { ...getEdit(sid, subId), [field]: value } }));
  };

  const saveMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const { data: u } = await supabase.auth.getUser();
      const rows: { student_id: string; exam_id: string; subject_id: string; obtained: number; total: number; updated_by: string | null }[] = [];
      for (const sub of subjects) {
        const e = getEdit(studentId, sub.id);
        if (e.obtained === "" && e.total === "") continue;
        const obtained = parseFloat(e.obtained) || 0;
        const total = parseFloat(e.total) || 100;
        rows.push({ student_id: studentId, exam_id: examId, subject_id: sub.id, obtained, total, updated_by: u.user?.id ?? null });
      }
      if (rows.length === 0) return;
      const { error } = await supabase
        .from("grades")
        .upsert(rows, { onConflict: "student_id,exam_id,subject_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marks saved");
      qc.invalidateQueries({ queryKey: ["grades", examId] });
      setEdits({});
    },
    onError: (e) => toast.error(e.message),
  });

  const totalsForStudent = (studentId: string) => {
    let totalObtained = 0;
    let totalMax = 0;
    for (const sub of subjects) {
      const e = getEdit(studentId, sub.id);
      const g = gradeMap.get(`${studentId}|${sub.id}`);
      const obtained = e.obtained !== "" ? parseFloat(e.obtained) || 0 : g?.obtained ?? 0;
      const total = e.total !== "" ? parseFloat(e.total) || 100 : g?.total ?? 100;
      if (obtained > 0 || e.obtained !== "" || g) {
        totalObtained += obtained;
        totalMax += total;
      }
    }
    const avg = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
    return { totalObtained, totalMax, avg };
  };

  if (subjects.length === 0) {
    return (
      <div className="border-t border-border/60 p-4 text-sm text-muted-foreground">
        No subjects yet. Use “Manage exams” to add subjects for this class.
      </div>
    );
  }

  return (
    <div className="border-t border-border/60 p-3 sm:p-4">
      {/* Student selector */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {students.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveStudent(s.id)}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
              activeStudent === s.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            #{s.roll_no} {s.full_name.split(" ")[0]}
          </button>
        ))}
      </div>

      {activeStudent && (
        <div className="space-y-2">
          {/* Header row */}
          <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <div>Subject</div>
            <div>Obtained</div>
            <div>Total</div>
          </div>
          {subjects.map((sub) => {
            const e = getEdit(activeStudent, sub.id);
            return (
              <div key={sub.id} className="grid grid-cols-[1.4fr_1fr_1fr] items-center gap-2 rounded-lg bg-card px-2 py-1.5">
                <div className="truncate text-sm">{sub.name}</div>
                <Input
                  type="number"
                  value={e.obtained}
                  onChange={(ev) => setEdit(activeStudent, sub.id, "obtained", ev.target.value)}
                  placeholder="0"
                  className="h-8"
                />
                <Input
                  type="number"
                  value={e.total}
                  onChange={(ev) => setEdit(activeStudent, sub.id, "total", ev.target.value)}
                  placeholder="100"
                  className="h-8"
                />
              </div>
            );
          })}

          {/* Totals */}
          {(() => {
            const t = totalsForStudent(activeStudent);
            return (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/70 px-3 py-2.5">
                <div className="text-sm">
                  <span className="text-muted-foreground">Total: </span>
                  <span className="font-medium">{t.totalObtained.toFixed(0)} / {t.totalMax.toFixed(0)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Average: </span>
                  <span className={cn("font-medium", gradeColor(t.avg))}>{t.avg.toFixed(1)}%</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Grade: </span>
                  <span className={cn("font-display font-semibold", gradeColor(t.avg))}>{gradeFromAverage(t.avg)}</span>
                </div>
                <Button size="sm" onClick={() => saveMutation.mutate(activeStudent)} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save marks
                </Button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

const ManageExamsDialog = ({ classId }: { classId: string }) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"subjects" | "exams">("subjects");
  const { data: subjects } = useSubjects(classId);
  const { data: exams } = useExams(classId);

  const [subjectName, setSubjectName] = useState("");
  const [examName, setExamName] = useState("");
  const [examTier, setExamTier] = useState<ExamTier>("model_test");
  const [busy, setBusy] = useState(false);

  const addSubject = async () => {
    if (!subjectName.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("subjects").insert({
      class_id: classId,
      name: subjectName.trim(),
      position: (subjects?.length ?? 0),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Subject added");
    setSubjectName("");
    qc.invalidateQueries({ queryKey: ["subjects", classId] });
  };

  const removeSubject = async (id: string) => {
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["subjects", classId] });
  };

  const addExam = async () => {
    if (!examName.trim()) return;
    setBusy(true);
    const tierExams = (exams ?? []).filter((e) => e.tier === examTier);
    const { error } = await supabase.from("exams").insert({
      class_id: classId,
      name: examName.trim(),
      tier: examTier,
      position: tierExams.length,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Exam added");
    setExamName("");
    qc.invalidateQueries({ queryKey: ["exams", classId] });
  };

  const removeExam = async (id: string) => {
    const { error } = await supabase.from("exams").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["exams", classId] });
    qc.invalidateQueries({ queryKey: ["grades"] });
  };

  const seedDefaultSubjects = async () => {
    setBusy(true);
    const rows = DEFAULT_SUBJECTS.map((name, i) => ({ class_id: classId, name, position: i }));
    const { error } = await supabase.from("subjects").upsert(rows, { onConflict: "class_id,name" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Default subjects added");
    qc.invalidateQueries({ queryKey: ["subjects", classId] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="h-4 w-4" /> Manage</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage subjects &amp; exams</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-secondary/80 p-1">
          {(["subjects", "exams"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn("rounded-md py-2 text-sm font-medium capitalize transition-all", tab === t ? "bg-card shadow-soft" : "text-muted-foreground")}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "subjects" ? (
          <div className="space-y-3 py-2">
            <div className="flex gap-2">
              <Input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="New subject name" onKeyDown={(e) => e.key === "Enter" && addSubject()} />
              <Button onClick={addSubject} disabled={busy}><Plus className="h-4 w-4" /></Button>
            </div>
            {(subjects?.length ?? 0) === 0 && (
              <Button variant="outline" size="sm" onClick={seedDefaultSubjects} disabled={busy}>
                Add 8 default subjects
              </Button>
            )}
            <div className="space-y-1.5">
              {subjects?.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                  <span>{s.name}</span>
                  <button onClick={() => removeSubject(s.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="grid gap-2">
              <Label className="text-xs">Exam name</Label>
              <Input value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="e.g. Model Test 1" />
              <Label className="text-xs">Tier</Label>
              <select
                value={examTier}
                onChange={(e) => setExamTier(e.target.value as ExamTier)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {EXAM_TIERS.map((t) => <option key={t.tier} value={t.tier}>{t.label}</option>)}
              </select>
              <Button onClick={addExam} disabled={busy} size="sm" className="mt-1">Add exam</Button>
            </div>
            <div className="space-y-1.5">
              {EXAM_TIERS.map((tier) => {
                const list = (exams ?? []).filter((e) => e.tier === tier.tier);
                if (list.length === 0) return null;
                return (
                  <div key={tier.tier} className="rounded-lg bg-secondary/40 p-2">
                    <div className="px-1 text-xs font-medium text-muted-foreground">{tier.label}</div>
                    {list.map((e) => (
                      <div key={e.id} className="flex items-center justify-between px-1 py-1.5 text-sm">
                        <span>{e.name}</span>
                        <button onClick={() => removeExam(e.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Close</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GradesTab;
