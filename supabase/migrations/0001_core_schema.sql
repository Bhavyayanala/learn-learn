-- LearnNest — Stage 1 core schema
-- Tables: users, teachers, students, parents, parent_students, classes, subjects
-- Run against your Supabase project with:
--   supabase db push
-- or paste directly into the Supabase SQL Editor.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- USERS (profile row linked 1:1 to auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('teacher', 'student', 'parent', 'admin')),
  full_name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists users_email_idx on public.users(email) where email is not null;
create unique index if not exists users_phone_idx on public.users(phone) where phone is not null;

-- ---------------------------------------------------------------------
-- TEACHERS
-- ---------------------------------------------------------------------
create table if not exists public.teachers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- STUDENTS
-- ---------------------------------------------------------------------
create table if not exists public.students (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  grade text not null,
  date_of_birth date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PARENTS
-- ---------------------------------------------------------------------
create table if not exists public.parents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PARENT <-> STUDENT LINK (many-to-many; a parent may have multiple kids)
-- ---------------------------------------------------------------------
create table if not exists public.parent_students (
  parent_id uuid not null references public.parents(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id)
);

-- ---------------------------------------------------------------------
-- SUBJECTS (global catalog, e.g. Mathematics, Science, English)
-- ---------------------------------------------------------------------
create table if not exists public.subjects (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CLASSES (a tuition group a teacher runs for a grade + subject)
-- ---------------------------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  subject_id uuid not null references public.subjects(id),
  grade text not null,
  classes_per_month integer not null default 12,
  duration_minutes integer not null default 60,
  monthly_fee numeric(10, 2),
  start_date date,
  end_date date,
  days_of_week text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_students (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

-- ---------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.users;
create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.teachers;
create trigger set_updated_at before update on public.teachers
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.students;
create trigger set_updated_at before update on public.students
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.parents;
create trigger set_updated_at before update on public.parents
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.classes;
create trigger set_updated_at before update on public.classes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.parents enable row level security;
alter table public.parent_students enable row level security;
alter table public.subjects enable row level security;
alter table public.classes enable row level security;
alter table public.class_students enable row level security;

-- USERS: a user can read/update only their own profile row
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);
create policy "users_update_own" on public.users
  for update using (auth.uid() = id);
create policy "users_insert_own" on public.users
  for insert with check (auth.uid() = id);

-- TEACHERS: a teacher can read/update only their own row
create policy "teachers_select_own" on public.teachers
  for select using (user_id = auth.uid());
create policy "teachers_update_own" on public.teachers
  for update using (user_id = auth.uid());
create policy "teachers_insert_own" on public.teachers
  for insert with check (user_id = auth.uid());

-- STUDENTS: a student can read their own row; a teacher can read students
-- enrolled in one of their classes; a parent can read their linked children
create policy "students_select_self" on public.students
  for select using (user_id = auth.uid());

create policy "students_select_teacher" on public.students
  for select using (
    exists (
      select 1
      from public.class_students cs
      join public.classes c on c.id = cs.class_id
      join public.teachers t on t.id = c.teacher_id
      where cs.student_id = students.id
        and t.user_id = auth.uid()
    )
  );

create policy "students_select_parent" on public.students
  for select using (
    exists (
      select 1
      from public.parent_students ps
      join public.parents p on p.id = ps.parent_id
      where ps.student_id = students.id
        and p.user_id = auth.uid()
    )
  );

create policy "students_insert_own" on public.students
  for insert with check (user_id = auth.uid());
create policy "students_update_own" on public.students
  for update using (user_id = auth.uid());

-- PARENTS: a parent can read/update only their own row
create policy "parents_select_own" on public.parents
  for select using (user_id = auth.uid());
create policy "parents_update_own" on public.parents
  for update using (user_id = auth.uid());
create policy "parents_insert_own" on public.parents
  for insert with check (user_id = auth.uid());

-- PARENT_STUDENTS: visible to the parent themselves, or the teacher of a
-- class that student is enrolled in
create policy "parent_students_select_parent" on public.parent_students
  for select using (
    exists (
      select 1 from public.parents p
      where p.id = parent_students.parent_id and p.user_id = auth.uid()
    )
  );

-- SUBJECTS: readable by any authenticated user (global catalog)
create policy "subjects_select_all" on public.subjects
  for select using (auth.role() = 'authenticated');

-- CLASSES: teacher sees/manages their own classes; enrolled students and
-- their parents can read the class
create policy "classes_select_teacher" on public.classes
  for select using (
    exists (
      select 1 from public.teachers t
      where t.id = classes.teacher_id and t.user_id = auth.uid()
    )
  );
create policy "classes_modify_teacher" on public.classes
  for all using (
    exists (
      select 1 from public.teachers t
      where t.id = classes.teacher_id and t.user_id = auth.uid()
    )
  );

create policy "classes_select_enrolled_student" on public.classes
  for select using (
    exists (
      select 1
      from public.class_students cs
      join public.students s on s.id = cs.student_id
      where cs.class_id = classes.id and s.user_id = auth.uid()
    )
  );

-- CLASS_STUDENTS: teacher of the class, the student themself, or their parent
create policy "class_students_select_teacher" on public.class_students
  for select using (
    exists (
      select 1
      from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where c.id = class_students.class_id and t.user_id = auth.uid()
    )
  );
create policy "class_students_modify_teacher" on public.class_students
  for all using (
    exists (
      select 1
      from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where c.id = class_students.class_id and t.user_id = auth.uid()
    )
  );
create policy "class_students_select_self" on public.class_students
  for select using (
    exists (
      select 1 from public.students s
      where s.id = class_students.student_id and s.user_id = auth.uid()
    )
  );
