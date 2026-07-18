import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  AttendanceRow,
  ClassRow,
  ExamRow,
  FeeMonthRow,
  GradeRow,
  HomeworkRow,
  OtherFeeRow,
  StudentRow,
  SubjectRow,
} from "@/lib/types";

// --- Classes ---
export const useClasses = () =>
  useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*").order("position");
      if (error) throw error;
      return data as ClassRow[];
    },
    staleTime: 1000 * 60 * 5,
  });

export const useClass = (slug: string) =>
  useQuery({
    queryKey: ["class", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data as ClassRow | null;
    },
    enabled: !!slug,
  });

// --- Students ---
export const useStudents = (classId: string | undefined) =>
  useQuery({
    queryKey: ["students", classId],
    queryFn: async () => {
      if (!classId) return [];
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("class_id", classId)
        .eq("archived", false)
        .order("roll_no");
      if (error) throw error;
      return data as StudentRow[];
    },
    enabled: !!classId,
  });

// --- Subjects ---
export const useSubjects = (classId: string | undefined) =>
  useQuery({
    queryKey: ["subjects", classId],
    queryFn: async () => {
      if (!classId) return [];
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .eq("class_id", classId)
        .order("position");
      if (error) throw error;
      return data as SubjectRow[];
    },
    enabled: !!classId,
  });

// --- Exams ---
export const useExams = (classId: string | undefined) =>
  useQuery({
    queryKey: ["exams", classId],
    queryFn: async () => {
      if (!classId) return [];
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .eq("class_id", classId)
        .order("tier", { ascending: true })
        .order("position", { ascending: true });
      if (error) throw error;
      return data as ExamRow[];
    },
    enabled: !!classId,
  });

// --- Attendance ---
export const useAttendanceForDate = (classId: string | undefined, date: string) =>
  useQuery({
    queryKey: ["attendance", classId, date],
    queryFn: async () => {
      if (!classId) return [];
      const { data: students } = await supabase
        .from("students")
        .select("id")
        .eq("class_id", classId)
        .eq("archived", false);
      if (!students) return [];
      const ids = students.map((s) => s.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .in("student_id", ids)
        .eq("class_date", date);
      if (error) throw error;
      return data as AttendanceRow[];
    },
    enabled: !!classId,
  });

export const useStudentAttendance = (studentId: string | undefined, monthIso: string) => {
  // monthIso = YYYY-MM
  const [year, month] = monthIso.split("-").map(Number);
  return useQuery({
    queryKey: ["attendance-student", studentId, monthIso],
    queryFn: async () => {
      if (!studentId) return [];
      const start = `${monthIso}-01`;
      const end = new Date(year, month, 1).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_id", studentId)
        .gte("class_date", start)
        .lt("class_date", end)
        .order("class_date");
      if (error) throw error;
      return data as AttendanceRow[];
    },
    enabled: !!studentId,
  });
};

// --- Grades ---
export const useGradesForExam = (examId: string | undefined) =>
  useQuery({
    queryKey: ["grades", examId],
    queryFn: async () => {
      if (!examId) return [];
      const { data, error } = await supabase
        .from("grades")
        .select("*")
        .eq("exam_id", examId)
        .order("subject_id");
      if (error) throw error;
      return data as GradeRow[];
    },
    enabled: !!examId,
  });

export const useGradesForStudent = (studentId: string | undefined) =>
  useQuery({
    queryKey: ["grades-student", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("grades")
        .select("*, subject:subjects(*), exam:exams(*)")
        .eq("student_id", studentId);
      if (error) throw error;
      return data as (GradeRow & { subject: SubjectRow; exam: ExamRow })[];
    },
    enabled: !!studentId,
  });

// --- Fees ---
export const useFeeMonths = (studentId: string | undefined, year: number) =>
  useQuery({
    queryKey: ["fees-months", studentId, year],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("fee_months")
        .select("*")
        .eq("student_id", studentId)
        .eq("year", year)
        .order("month");
      if (error) throw error;
      return data as FeeMonthRow[];
    },
    enabled: !!studentId,
  });

export const useOtherFees = (studentId: string | undefined) =>
  useQuery({
    queryKey: ["other-fees", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("other_fees")
        .select("*")
        .eq("student_id", studentId)
        .order("label");
      if (error) throw error;
      return data as OtherFeeRow[];
    },
    enabled: !!studentId,
  });

// --- Homework ---
export const useClassHomework = (classId: string | undefined) =>
  useQuery({
    queryKey: ["homework", classId],
    queryFn: async () => {
      if (!classId) return [];
      const { data, error } = await supabase
        .from("homework")
        .select("*")
        .eq("class_id", classId)
        .order("task_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data as HomeworkRow[];
    },
    enabled: !!classId,
  });

// --- Dashboard counts ---
export const useClassCounts = () =>
  useQuery({
    queryKey: ["class-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("class_id")
        .eq("archived", false);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) counts[row.class_id] = (counts[row.class_id] ?? 0) + 1;
      return counts;
    },
    staleTime: 1000 * 60,
  });
