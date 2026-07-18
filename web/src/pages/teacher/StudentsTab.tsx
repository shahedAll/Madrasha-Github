import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarDays,
  Check,
  CheckCheck,
  Loader2,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, EmptyState, StatusPill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useAttendanceForDate, useStudents } from "@/lib/queries";
import type { AttendanceRow, StudentRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const todayIso = () => format(new Date(), "yyyy-MM-dd");

const StudentsTab = ({ classId }: { classId: string }) => {
  const [date, setDate] = useState<string>(todayIso());
  const [search, setSearch] = useState("");
  const { data: students, isLoading } = useStudents(classId);
  const { data: attendance } = useAttendanceForDate(classId, date);
  const qc = useQueryClient();

  const attendanceMap = useMemo(() => {
    const m = new Map<string, AttendanceRow>();
    for (const a of attendance ?? []) m.set(a.student_id, a);
    return m;
  }, [attendance]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students ?? [];
    return (students ?? []).filter(
      (s) => s.full_name.toLowerCase().includes(q) || s.student_code.toLowerCase().includes(q)
    );
  }, [students, search]);

  const saveMutation = useMutation({
    mutationFn: async ({ student, status }: { student: StudentRow; status: "present" | "absent" }) => {
      const existing = attendanceMap.get(student.id);
      if (existing) {
        const { error } = await supabase
          .from("attendance")
          .update({ status, marked_by: (await supabase.auth.getUser()).data.user?.id ?? null })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("attendance").insert({
          student_id: student.id,
          class_date: date,
          status,
          marked_by: u.user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", classId, date] });
    },
    onError: (e) => toast.error(e.message),
  });

  const markAll = async (status: "present" | "absent") => {
    const { data: u } = await supabase.auth.getUser();
    const rows = (students ?? []).map((s) => ({
      student_id: s.id,
      class_date: date,
      status,
      marked_by: u.user?.id ?? null,
    }));
    // Remove existing for this date/class, then bulk insert.
    const { error: delErr } = await supabase
      .from("attendance")
      .delete()
      .in("student_id", (students ?? []).map((s) => s.id))
      .eq("class_date", date);
    if (delErr) { toast.error(delErr.message); return; }
    const { error } = await supabase.from("attendance").insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked all ${status}`);
    qc.invalidateQueries({ queryKey: ["attendance", classId, date] });
  };

  const presentCount = useMemo(
    () => (students ?? []).filter((s) => (attendanceMap.get(s.id)?.status ?? "present") === "present").length,
    [students, attendanceMap]
  );

  return (
    <div className="space-y-5">
      {/* Attendance header card */}
      <Card className="border-border/60 p-4 shadow-soft sm:p-5 animate-in-up">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarDays className="h-4 w-4" /> Daily Attendance
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Input
                type="date"
                value={date}
                max={todayIso()}
                onChange={(e) => setDate(e.target.value)}
                className="w-auto"
              />
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-3 py-1 text-success">
                  <Check className="h-3.5 w-3.5" /> {presentCount} present
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/12 px-3 py-1 text-destructive">
                  <X className="h-3.5 w-3.5" /> {(students?.length ?? 0) - presentCount} absent
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => markAll("present")}>
              <CheckCheck className="h-4 w-4" /> Mark all present
            </Button>
            <Button variant="outline" size="sm" onClick={() => markAll("absent")}>
              Mark all absent
            </Button>
            <AddStudentDialog classId={classId} />
          </div>
        </div>
      </Card>

      {/* Search + list */}
      <div className="relative animate-in-up" style={{ animationDelay: "60ms" }}>
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or student ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-5 w-5" />}
          title="No students yet"
          description="Add students to this class to start tracking attendance and grades."
        />
      ) : (
        <div className="grid gap-3 animate-in-up" style={{ animationDelay: "120ms" }}>
          {filtered.map((s) => {
            const att = attendanceMap.get(s.id);
            const status = att?.status ?? "present";
            const busy = saveMutation.isPending && saveMutation.variables?.student.id === s.id;
            return (
              <Card key={s.id} className="flex items-center gap-3 border-border/60 p-3 shadow-soft sm:p-4">
                <Avatar name={s.full_name} src={s.photo_url} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    Roll #{s.roll_no} · {s.student_code} · {s.guardian_name ?? "—"}
                  </div>
                </div>
                <StatusPill status={status} />
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => saveMutation.mutate({ student: s, status: "present" })}
                    disabled={busy}
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-lg border transition-all",
                      status === "present"
                        ? "border-success bg-success text-success-foreground shadow-soft"
                        : "border-border bg-card text-muted-foreground hover:border-success/50 hover:text-success"
                    )}
                    title="Present"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => saveMutation.mutate({ student: s, status: "absent" })}
                    disabled={busy}
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-lg border transition-all",
                      status === "absent"
                        ? "border-destructive bg-destructive text-destructive-foreground shadow-soft"
                        : "border-border bg-card text-muted-foreground hover:border-destructive/50 hover:text-destructive"
                    )}
                    title="Absent"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AddStudentDialog = ({ classId }: { classId: string }) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [roll, setRoll] = useState("");
  const [code, setCode] = useState("");
  const [mobile, setMobile] = useState("");
  const [guardian, setGuardian] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || !code.trim() || !mobile.trim()) {
      toast.error("Name, Student ID and mobile are required");
      return;
    }
    setSaving(true);
    const rollNo = parseInt(roll, 10) || 0;
    const { error } = await supabase.from("students").insert({
      class_id: classId,
      full_name: name.trim(),
      student_code: code.trim().toUpperCase(),
      roll_no: rollNo,
      mobile: mobile.trim(),
      guardian_name: guardian.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Student added");
    setOpen(false);
    setName(""); setRoll(""); setCode(""); setMobile(""); setGuardian("");
    qc.invalidateQueries({ queryKey: ["students", classId] });
    qc.invalidateQueries({ queryKey: ["class-counts"] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><UserPlus className="h-4 w-4" /> Add student</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add new student</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Full name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Student's full name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Student ID</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SH-0001" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Roll no</Label>
              <Input type="number" value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="1" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Guardian mobile</Label>
              <Input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Guardian name</Label>
              <Input value={guardian} onChange={(e) => setGuardian(e.target.value)} placeholder="Optional" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save student
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StudentsTab;
