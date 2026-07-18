-- SchoolHub core schema: profiles, classes, students, attendance, grades, fees, homework.
-- Native Supabase Auth model -> RLS uses auth.uid().

-- ---------- profiles ----------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  role text NOT NULL DEFAULT 'parent' CHECK (role IN ('admin','teacher','parent')),
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles read all" ON public.profiles FOR SELECT USING (true);

CREATE POLICY "profiles insert self" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles update self" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- helper: is current user a staff member (admin/teacher)?
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin','teacher')
  );
$$;

-- helper: parent's bound student id
CREATE OR REPLACE FUNCTION public.my_student_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id FROM public.students s WHERE s.parent_user_id = auth.uid() LIMIT 1;
$$;

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- classes ----------
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "classes read all" ON public.classes FOR SELECT USING (true);
CREATE POLICY "classes staff write" ON public.classes
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ---------- students ----------
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_code text NOT NULL UNIQUE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  roll_no int NOT NULL,
  full_name text NOT NULL,
  photo_url text,
  guardian_name text,
  mobile text NOT NULL,
  parent_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_id) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_students_parent ON public.students(parent_user_id);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students staff read" ON public.students
  FOR SELECT USING (public.is_staff());
CREATE POLICY "students parent read own" ON public.students
  FOR SELECT USING (parent_user_id = auth.uid());
CREATE POLICY "students staff write" ON public.students
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ---------- attendance ----------
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_date date NOT NULL,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent')),
  marked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (student_id, class_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance(student_id, class_date);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance staff read" ON public.attendance
  FOR SELECT USING (public.is_staff());
CREATE POLICY "attendance parent read own child" ON public.attendance
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.students s WHERE s.id = attendance.student_id AND s.parent_user_id = auth.uid())
  );
CREATE POLICY "attendance staff write" ON public.attendance
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ---------- subjects (catalog per class) ----------
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  position int NOT NULL DEFAULT 0,
  UNIQUE (class_id, name)
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subjects read all" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "subjects staff write" ON public.subjects
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ---------- exams ----------
CREATE TABLE IF NOT EXISTS public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('model_test','term1','term2','final')),
  position int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (class_id, name)
);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exams read all" ON public.exams FOR SELECT USING (true);
CREATE POLICY "exams staff write" ON public.exams
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ---------- grades ----------
CREATE TABLE IF NOT EXISTS public.grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  obtained numeric(6,2) NOT NULL DEFAULT 0,
  total numeric(6,2) NOT NULL DEFAULT 100,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (student_id, exam_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_grades_student_exam ON public.grades(student_id, exam_id);

ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grades staff read" ON public.grades
  FOR SELECT USING (public.is_staff());
CREATE POLICY "grades parent read own child" ON public.grades
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.students s WHERE s.id = grades.student_id AND s.parent_user_id = auth.uid())
  );
CREATE POLICY "grades staff write" ON public.grades
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ---------- fee_months (Jan-Dec tuition) ----------
CREATE TABLE IF NOT EXISTS public.fee_months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  year int NOT NULL DEFAULT EXTRACT(year FROM now())::int,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid','unpaid')),
  paid_date date,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (student_id, year, month)
);

ALTER TABLE public.fee_months ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fees staff read" ON public.fee_months
  FOR SELECT USING (public.is_staff());
CREATE POLICY "fees parent read own child" ON public.fee_months
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.students s WHERE s.id = fee_months.student_id AND s.parent_user_id = auth.uid())
  );
CREATE POLICY "fees staff write" ON public.fee_months
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ---------- other_fees (exam/session/admission) ----------
CREATE TABLE IF NOT EXISTS public.other_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid','unpaid')),
  paid_date date,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.other_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "other_fees staff read" ON public.other_fees
  FOR SELECT USING (public.is_staff());
CREATE POLICY "other_fees parent read own child" ON public.other_fees
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.students s WHERE s.id = other_fees.student_id AND s.parent_user_id = auth.uid())
  );
CREATE POLICY "other_fees staff write" ON public.other_fees
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ---------- homework ----------
CREATE TABLE IF NOT EXISTS public.homework (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject text NOT NULL,
  task_date date NOT NULL,
  task text NOT NULL,
  image_url text,
  posted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_homework_class_date ON public.homework(class_id, task_date DESC);

ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;

CREATE POLICY "homework staff read" ON public.homework
  FOR SELECT USING (public.is_staff());
CREATE POLICY "homework parent read own child" ON public.homework
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.parent_user_id = auth.uid() AND s.class_id = homework.class_id AND s.archived = false
    )
  );
CREATE POLICY "homework staff write" ON public.homework
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ---------- sms_log (audit trail for fee alerts) ----------
CREATE TABLE IF NOT EXISTS public.sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  mobile text,
  message text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  provider_response text,
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sms_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sms_log staff read" ON public.sms_log
  FOR SELECT USING (public.is_staff());
CREATE POLICY "sms_log staff write" ON public.sms_log
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());
