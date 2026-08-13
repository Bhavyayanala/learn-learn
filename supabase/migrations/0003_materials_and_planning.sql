-- LearnNest — Stage 2: material upload + automatic lesson planning
-- Adds: topics (syllabus catalog), materials (uploaded files),
--       lesson_plans + lesson_plan_items (the generated day-by-day plan)

-- ---------------------------------------------------------------------
-- TOPICS — a per-subject, per-grade syllabus catalog the planner draws from.
-- Seeded separately in 0004_seed_topics.sql
-- ---------------------------------------------------------------------
create table if not exists public.topics (
  id uuid primary key default uuid_generate_v4(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  grade text not null,
  sequence_order integer not null,
  name text not null,
  learning_objective text not null,
  is_foundational boolean not null default false,
  suggested_activities text,
  created_at timestamptz not null default now()
);

create index if not exists topics_subject_grade_idx
  on public.topics(subject_id, grade, sequence_order);

-- ---------------------------------------------------------------------
-- MATERIALS — files a teacher uploads for a class (stored in Supabase
-- Storage bucket "materials"; this table tracks the metadata).
-- ---------------------------------------------------------------------
create table if not exists public.materials (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  file_type text,
  file_size_bytes integer,
  created_at timestamptz not null default now()
);

create index if not exists materials_class_idx on public.materials(class_id);

-- ---------------------------------------------------------------------
-- LESSON_PLANS — one proposed/accepted plan per class.
-- ---------------------------------------------------------------------
create table if not exists public.lesson_plans (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references public.classes(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'accepted')),
  generated_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lesson_plans_one_active_per_class
  on public.lesson_plans(class_id)
  where status in ('draft', 'accepted');

-- ---------------------------------------------------------------------
-- LESSON_PLAN_ITEMS — the day-by-day rows of a plan.
-- ---------------------------------------------------------------------
create table if not exists public.lesson_plan_items (
  id uuid primary key default uuid_generate_v4(),
  lesson_plan_id uuid not null references public.lesson_plans(id) on delete cascade,
  day_number integer not null,
  scheduled_date date,
  topic_id uuid references public.topics(id),
  custom_title text,
  learning_objective text,
  suggested_activities text,
  estimated_minutes integer not null default 60,
  is_revision boolean not null default false,
  is_assessment boolean not null default false,
  completion_status text not null default 'not_started'
    check (completion_status in ('not_started', 'in_progress', 'completed')),
  completion_percentage integer not null default 0
    check (completion_percentage between 0 and 100),
  teacher_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_plan_id, day_number)
);

create index if not exists lesson_plan_items_plan_idx
  on public.lesson_plan_items(lesson_plan_id, day_number);

drop trigger if exists set_updated_at on public.lesson_plans;
create trigger set_updated_at before update on public.lesson_plans
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.lesson_plan_items;
create trigger set_updated_at before update on public.lesson_plan_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.topics enable row level security;
alter table public.materials enable row level security;
alter table public.lesson_plans enable row level security;
alter table public.lesson_plan_items enable row level security;

-- TOPICS: global read-only catalog, readable by any authenticated user
create policy "topics_select_all" on public.topics
  for select using (auth.role() = 'authenticated');

-- MATERIALS: teacher who owns the class manages it; enrolled students/
-- their parents can read (view/download) materials for their class
create policy "materials_all_teacher" on public.materials
  for all using (
    exists (
      select 1 from public.teachers t
      where t.id = materials.teacher_id and t.user_id = auth.uid()
    )
  );

create policy "materials_select_enrolled_student" on public.materials
  for select using (
    exists (
      select 1
      from public.class_students cs
      join public.students s on s.id = cs.student_id
      where cs.class_id = materials.class_id and s.user_id = auth.uid()
    )
  );

create policy "materials_select_parent" on public.materials
  for select using (
    exists (
      select 1
      from public.class_students cs
      join public.parent_students ps on ps.student_id = cs.student_id
      join public.parents p on p.id = ps.parent_id
      where cs.class_id = materials.class_id and p.user_id = auth.uid()
    )
  );

-- LESSON_PLANS: teacher of the class manages it; enrolled students/parents
-- may read only once it's accepted (drafts stay teacher-only)
create policy "lesson_plans_all_teacher" on public.lesson_plans
  for all using (
    exists (
      select 1
      from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where c.id = lesson_plans.class_id and t.user_id = auth.uid()
    )
  );

create policy "lesson_plans_select_enrolled_student" on public.lesson_plans
  for select using (
    status = 'accepted'
    and exists (
      select 1
      from public.class_students cs
      join public.students s on s.id = cs.student_id
      where cs.class_id = lesson_plans.class_id and s.user_id = auth.uid()
    )
  );

create policy "lesson_plans_select_parent" on public.lesson_plans
  for select using (
    status = 'accepted'
    and exists (
      select 1
      from public.class_students cs
      join public.parent_students ps on ps.student_id = cs.student_id
      join public.parents p on p.id = ps.parent_id
      where cs.class_id = lesson_plans.class_id and p.user_id = auth.uid()
    )
  );

-- LESSON_PLAN_ITEMS: inherits access via its parent lesson_plan
create policy "lesson_plan_items_all_teacher" on public.lesson_plan_items
  for all using (
    exists (
      select 1
      from public.lesson_plans lp
      join public.classes c on c.id = lp.class_id
      join public.teachers t on t.id = c.teacher_id
      where lp.id = lesson_plan_items.lesson_plan_id and t.user_id = auth.uid()
    )
  );

create policy "lesson_plan_items_select_enrolled_student" on public.lesson_plan_items
  for select using (
    exists (
      select 1
      from public.lesson_plans lp
      join public.class_students cs on cs.class_id = lp.class_id
      join public.students s on s.id = cs.student_id
      where lp.id = lesson_plan_items.lesson_plan_id
        and lp.status = 'accepted'
        and s.user_id = auth.uid()
    )
  );

create policy "lesson_plan_items_select_parent" on public.lesson_plan_items
  for select using (
    exists (
      select 1
      from public.lesson_plans lp
      join public.class_students cs on cs.class_id = lp.class_id
      join public.parent_students ps on ps.student_id = cs.student_id
      join public.parents p on p.id = ps.parent_id
      where lp.id = lesson_plan_items.lesson_plan_id
        and lp.status = 'accepted'
        and p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- STORAGE — bucket for uploaded teaching materials
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('materials', 'materials', false)
on conflict (id) do nothing;

-- Path convention: materials/{class_id}/{filename}
-- Teacher can read/write files under a class they own.
create policy "materials_storage_teacher_all"
  on storage.objects for all
  using (
    bucket_id = 'materials'
    and exists (
      select 1
      from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where t.user_id = auth.uid()
        and (storage.foldername(name))[1] = c.id::text
    )
  );

-- Enrolled students / their parents can read (not write) files for their class.
create policy "materials_storage_student_read"
  on storage.objects for select
  using (
    bucket_id = 'materials'
    and exists (
      select 1
      from public.class_students cs
      join public.students s on s.id = cs.student_id
      where s.user_id = auth.uid()
        and (storage.foldername(name))[1] = cs.class_id::text
    )
  );

create policy "materials_storage_parent_read"
  on storage.objects for select
  using (
    bucket_id = 'materials'
    and exists (
      select 1
      from public.class_students cs
      join public.parent_students ps on ps.student_id = cs.student_id
      join public.parents p on p.id = ps.parent_id
      where p.user_id = auth.uid()
        and (storage.foldername(name))[1] = cs.class_id::text
    )
  );
