-- LearnNest — Stage 4: student enrollment + attendance
--
-- class_sessions: a record of an actual class that happened, tied to the
-- lesson plan day it covered. Attendance hangs off a session, not off a
-- plan item directly, so a rescheduled/repeated day still gets its own
-- clean attendance record.

create table if not exists public.class_sessions (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references public.classes(id) on delete cascade,
  lesson_plan_item_id uuid references public.lesson_plan_items(id) on delete set null,
  session_date date not null default current_date,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists class_sessions_class_idx
  on public.class_sessions(class_id, session_date);

create table if not exists public.attendance (
  id uuid primary key default uuid_generate_v4(),
  class_session_id uuid not null references public.class_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'present'
    check (status in ('present', 'absent', 'late', 'excused')),
  join_time timestamptz,
  leave_time timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_session_id, student_id)
);

create index if not exists attendance_session_idx
  on public.attendance(class_session_id);
create index if not exists attendance_student_idx
  on public.attendance(student_id);

drop trigger if exists set_updated_at on public.class_sessions;
create trigger set_updated_at before update on public.class_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.attendance;
create trigger set_updated_at before update on public.attendance
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- HELPER FUNCTIONS (SECURITY DEFINER, same pattern as 0005 — these
-- deliberately avoid cross-table RLS recursion)
-- ---------------------------------------------------------------------
create or replace function public.is_teacher_of_session(p_session_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.class_sessions cs
    join public.classes c on c.id = cs.class_id
    join public.teachers t on t.id = c.teacher_id
    where cs.id = p_session_id and t.user_id = auth.uid()
  );
$$;

create or replace function public.is_own_attendance_session(p_session_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.class_sessions cs
    join public.class_students csx on csx.class_id = cs.class_id
    join public.students s on s.id = csx.student_id
    where cs.id = p_session_id and s.user_id = auth.uid()
  );
$$;

create or replace function public.is_parent_of_session(p_session_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.class_sessions cs
    join public.class_students csx on csx.class_id = cs.class_id
    join public.parent_students ps on ps.student_id = csx.student_id
    join public.parents p on p.id = ps.parent_id
    where cs.id = p_session_id and p.user_id = auth.uid()
  );
$$;

create or replace function public.is_parent_of_student(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.parent_students ps
    join public.parents p on p.id = ps.parent_id
    where ps.student_id = p_student_id and p.user_id = auth.uid()
  );
$$;

grant execute on function public.is_teacher_of_session(uuid) to authenticated;
grant execute on function public.is_own_attendance_session(uuid) to authenticated;
grant execute on function public.is_parent_of_session(uuid) to authenticated;
grant execute on function public.is_parent_of_student(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.class_sessions enable row level security;
alter table public.attendance enable row level security;

create policy "class_sessions_all_teacher" on public.class_sessions
  for all using (public.is_teacher_of_class(class_id));

create policy "class_sessions_select_student" on public.class_sessions
  for select using (public.is_student_enrolled_in_class(class_id));

create policy "class_sessions_select_parent" on public.class_sessions
  for select using (public.is_parent_of_class(class_id));

create policy "attendance_all_teacher" on public.attendance
  for all using (public.is_teacher_of_session(class_session_id));

-- A student sees only their OWN attendance row, not classmates'.
create policy "attendance_select_own" on public.attendance
  for select using (public.is_own_student_row(student_id));

-- A parent sees only their own child's attendance.
create policy "attendance_select_parent" on public.attendance
  for select using (public.is_parent_of_student(student_id));
