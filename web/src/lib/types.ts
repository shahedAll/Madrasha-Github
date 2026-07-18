// Centralized domain types for SchoolHub.
// These mirror the generated Supabase types but carry stable string unions
// and add derived shape used by the UI.

export type Role = "admin" | "teacher" | "parent";

export type AttendanceStatus = "present" | "absent";
export type FeeStatus = "paid" | "unpaid";
export type ExamTier = "model_test" | "term1" | "term2" | "final";
export type SmsStatus = "queued" | "sent" | "failed";

export interface ClassRow {
  id: string;
  name: string;
  slug: string;
  position: number;
}

export interface StudentRow {
  id: string;
  student_code: string;
  class_id: string;
  roll_no: number;
  full_name: string;
  photo_url: string | null;
  guardian_name: string | null;
  mobile: string;
  parent_user_id: string | null;
  archived: boolean;
}

export interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  avatar_url: string | null;
}

export interface AttendanceRow {
  id: string;
  student_id: string;
  class_date: string;
  status: AttendanceStatus;
  marked_by: string | null;
}

export interface SubjectRow {
  id: string;
  class_id: string;
  name: string;
  position: number;
}

export interface ExamRow {
  id: string;
  class_id: string;
  name: string;
  tier: ExamTier;
  position: number;
}

export interface GradeRow {
  id: string;
  student_id: string;
  exam_id: string;
  subject_id: string;
  obtained: number;
  total: number;
  updated_at: string | null;
}

export interface FeeMonthRow {
  id: string;
  student_id: string;
  year: number;
  month: number;
  amount: number;
  status: FeeStatus;
  paid_date: string | null;
}

export interface OtherFeeRow {
  id: string;
  student_id: string;
  label: string;
  amount: number;
  status: FeeStatus;
  paid_date: string | null;
}

export interface HomeworkRow {
  id: string;
  class_id: string;
  subject: string;
  task_date: string;
  task: string;
  image_url: string | null;
  posted_by: string | null;
  created_at: string | null;
}

export interface SmsLogRow {
  id: string;
  student_id: string | null;
  mobile: string | null;
  message: string | null;
  status: SmsStatus;
  provider_response: string | null;
  created_at: string | null;
}

// -- Exam tier display config --
export const EXAM_TIERS: { tier: ExamTier; label: string; nested: boolean }[] = [
  { tier: "model_test", label: "Model Test", nested: true },
  { tier: "term1", label: "1st Term (Half Yearly)", nested: false },
  { tier: "term2", label: "2nd Term", nested: false },
  { tier: "final", label: "Final Exam (Annual)", nested: false },
];

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const DEFAULT_SUBJECTS = [
  "Bangla", "English", "Mathematics", "Science", "Social Science",
  "Religion & Moral Education", "ICT", "Arts & Crafts",
];

export const DEFAULT_EXAMS: { name: string; tier: ExamTier }[] = [
  { name: "Model Test 1", tier: "model_test" },
  { name: "Model Test 2", tier: "model_test" },
  { name: "Model Test 3", tier: "model_test" },
  { name: "1st Term (Half Yearly)", tier: "term1" },
  { name: "2nd Term", tier: "term2" },
  { name: "Final Exam (Annual)", tier: "final" },
];

// -- Grade helpers --
export const gradeFromAverage = (average: number): string => {
  if (average >= 90) return "A+";
  if (average >= 80) return "A";
  if (average >= 70) return "B";
  if (average >= 60) return "C";
  if (average >= 50) return "D";
  if (average > 0) return "F";
  return "—";
};

export const gradeColor = (average: number): string => {
  if (average >= 80) return "text-success";
  if (average >= 60) return "text-accent";
  if (average >= 50) return "text-warning";
  if (average > 0) return "text-destructive";
  return "text-muted-foreground";
};

// -- Currency (BDT) --
export const formatBDT = (amount: number): string => {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount) + " BDT";
};
