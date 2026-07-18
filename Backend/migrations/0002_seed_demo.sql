-- SchoolHub demo seed. Idempotent — safe to re-run.
-- Inserts classes, subjects, exams, a representative student body per class,
-- monthly fee slots for the current year, sample attendance, grades, homework.
-- Auth users (teacher/parent) are created by the bootstrap edge function.

-- ---------- classes ----------
INSERT INTO public.classes (name, slug, position) VALUES
  ('Play', 'play', 0),
  ('Class 1', 'class-1', 1),
  ('Class 2', 'class-2', 2),
  ('Class 3', 'class-3', 3)
ON CONFLICT (slug) DO NOTHING;

-- ---------- subjects (8 per class) ----------
DO $$
DECLARE
  cls RECORD;
  subj text;
  pos int;
BEGIN
  FOR cls IN SELECT id FROM public.classes LOOP
    pos := 0;
    FOREACH subj IN ARRAY ARRAY['Bangla','English','Mathematics','Science','Social Science','Religion & Moral Education','ICT','Arts & Crafts'] LOOP
      INSERT INTO public.subjects (class_id, name, position)
      VALUES (cls.id, subj, pos)
      ON CONFLICT (class_id, name) DO NOTHING;
      pos := pos + 1;
    END LOOP;
  END LOOP;
END $$;

-- ---------- exams (6 per class) ----------
DO $$
DECLARE
  cls RECORD;
  exm RECORD;
  pos int;
  tier_exams text[];
BEGIN
  FOR cls IN SELECT id FROM public.classes LOOP
    tier_exams := ARRAY['Model Test 1','Model Test 2','Model Test 3','1st Term (Half Yearly)','2nd Term','Final Exam (Annual)'];
    pos := 0;
    FOREACH exm IN ARRAY tier_exams LOOP
      DECLARE
        tier text;
      BEGIN
        tier := CASE
          WHEN exm LIKE 'Model Test%' THEN 'model_test'
          WHEN exm LIKE '1st Term%' THEN 'term1'
          WHEN exm LIKE '2nd Term%' THEN 'term2'
          ELSE 'final'
        END;
        INSERT INTO public.exams (class_id, name, tier, position)
        VALUES (cls.id, exm, tier, pos)
        ON CONFLICT (class_id, name) DO NOTHING;
        pos := pos + 1;
      END;
    END LOOP;
  END LOOP;
END $$;

-- ---------- students (12 per class = 48 representative students) ----------
-- Generates student_code like SH-P01 (Play), SH-1101 (Class 1), etc.
DO $$
DECLARE
  cls RECORD;
  prefix text;
  i int;
  code text;
  guardian text;
  mobile text;
  names text[];
BEGIN
  names := ARRAY[
    'Aarav Khan','Aarya Rahman','Abrar Hossain','Adiba Sultana','Arjun Ahmed','Diya Islam',
    'Farhan Chowdhury','Ibrahim Akter','Jannat Tasnim','Kabir Mahmud','Lina Begum','Maya Das',
    'Nabil Haque','Nadia Yusuf','Omar Faruque','Rida Karim','Sara Talukdar','Yusuf Ali',
    'Zara Islam','Rohan Das','Tahsin Khan','Zoya Akter','Inaya Roy','Kabirul Islam'
  ];
  FOR cls IN SELECT id, slug FROM public.classes ORDER BY position LOOP
    prefix := CASE cls.slug
      WHEN 'play' THEN 'P'
      WHEN 'class-1' THEN '1'
      WHEN 'class-2' THEN '2'
      WHEN 'class-3' THEN '3'
    END;
    FOR i IN 1..12 LOOP
      code := 'SH-' || prefix || lpad(i::text, 2, '0');
      guardian := CASE (i % 4)
        WHEN 0 THEN 'Md. ' || split_part(names[((i-1) % array_length(names,1)) + 1], ' ', 2)
        WHEN 1 THEN 'Mrs. ' || split_part(names[((i-1) % array_length(names,1)) + 1], ' ', 2)
        WHEN 2 THEN 'Md. ' || split_part(names[((i+2) % array_length(names,1)) + 1], ' ', 2)
        ELSE 'Mrs. ' || split_part(names[((i+5) % array_length(names,1)) + 1], ' ', 2)
      END;
      mobile := '01' || lpad((100000000 + cls.position * 1000 + i)::text, 9, '0');
      INSERT INTO public.students (
        student_code, class_id, roll_no, full_name, guardian_name, mobile
      ) VALUES (
        code, cls.id, i,
        names[((i - 1) + cls.position * 6) % array_length(names,1) + 1],
        guardian,
        mobile
      )
      ON CONFLICT (student_code) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ---------- fee_months for current year (default 800 BDT/month, unpaid) ----------
DO $$
DECLARE
  yr int := EXTRACT(year FROM now())::int;
  s RECORD;
  m int;
BEGIN
  FOR s IN SELECT id FROM public.students WHERE archived = false LOOP
    FOR m IN 1..12 LOOP
      INSERT INTO public.fee_months (student_id, year, month, amount, status)
      VALUES (s.id, yr, m, 800, 'unpaid')
      ON CONFLICT (student_id, year, month) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ---------- sample other fees (exam fee, session fee) ----------
DO $$
DECLARE
  s RECORD;
BEGIN
  FOR s IN SELECT id, class_id FROM public.students WHERE archived = false LOOP
    INSERT INTO public.other_fees (student_id, label, amount, status)
    VALUES (s.id, 'Exam Fee', 300, 'unpaid')
    ON CONFLICT DO NOTHING;
    INSERT INTO public.other_fees (student_id, label, amount, status)
    VALUES (s.id, 'Session Fee', 500, 'unpaid')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ---------- sample attendance for the last 20 school days ----------
-- Marks each student present except a ~5% random absent rate.
DO $$
DECLARE
  s RECORD;
  d date;
  d_offset int;
  status text;
BEGIN
  d_offset := 0;
  WHILE d_offset < 30 LOOP
    d := (now()::date) - d_offset;
    -- Skip weekends (Sunday=0, Saturday=6)
    IF EXTRACT(dow FROM d) IN (0, 6) THEN
      d_offset := d_offset + 1;
      CONTINUE;
    END IF;
    FOR s IN SELECT id FROM public.students WHERE archived = false LOOP
      status := CASE WHEN (mod(abs((d::text || s.id::text)::bigint), 23) = 0) THEN 'absent' ELSE 'present' END;
      INSERT INTO public.attendance (student_id, class_date, status)
      VALUES (s.id, d, status)
      ON CONFLICT (student_id, class_date) DO NOTHING;
    END LOOP;
    d_offset := d_offset + 1;
    -- Stop after 20 school days inserted.
    EXIT WHEN d_offset >= 28;
  END LOOP;
END $$;

-- ---------- sample homework (today + a few prior days) ----------
DO $$
DECLARE
  cls RECORD;
  d date;
  i int;
BEGIN
  FOR cls IN SELECT id FROM public.classes LOOP
    -- Today
    d := now()::date;
    INSERT INTO public.homework (class_id, subject, task_date, task)
    VALUES (cls.id, 'Mathematics', d, 'Complete page 24, problems 1–5. Show all working in your copy.')
    ON CONFLICT DO NOTHING;
    INSERT INTO public.homework (class_id, subject, task_date, task)
    VALUES (cls.id, 'English', d, 'Write 5 sentences about your favourite animal. Underline the nouns.')
    ON CONFLICT DO NOTHING;
    -- Yesterday (skip weekends)
    d := (now()::date) - 1;
    IF EXTRACT(dow FROM d) NOT IN (0,6) THEN
      INSERT INTO public.homework (class_id, subject, task_date, task)
      VALUES (cls.id, 'Bangla', d, 'পাঠ ৫ পড়ো এবং নতুন শব্দগুলো খাতায় লেখো।')
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ---------- sample grades for Model Test 1 (first subject set) ----------
-- Random-ish marks between 55 and 95 per subject.
DO $$
DECLARE
  s RECORD;
  exm RECORD;
  subj RECORD;
  obtained numeric;
BEGIN
  FOR s IN SELECT id, class_id FROM public.students WHERE archived = false LIMIT 24 LOOP
    exm := (
      SELECT e.id FROM public.exams e
      WHERE e.class_id = s.class_id AND e.name = 'Model Test 1'
      LIMIT 1
    );
    FOR subj IN SELECT id FROM public.subjects WHERE class_id = s.class_id ORDER BY position LOOP
      obtained := 55 + mod(abs((s.id::text || subj.id::text)::bigint), 41);
      INSERT INTO public.grades (student_id, exam_id, subject_id, obtained, total)
      VALUES (s.id, exm.id, subj.id, obtained, 100)
      ON CONFLICT (student_id, exam_id, subject_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
