-- LearnNest — Stage 5: assignments/homework + doubts
--
-- Completes the three-role picture: students get work to do and a way to
-- ask questions, teachers grade it, parents see the results.

-- ---------------------------------------------------------------------
-- ASSIGNMENTS
-- ---------------------------------------------------------------------
create table if not exists public.assignments (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references public.classes(id) on delete cascade,
  lesson_plan_item_id uuid references public.lesson_plan_items(id) on delete set null,
  title text not null,
  instructions text,
  due_date date,
  max_marks integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assignments_class_idx on public.assignments(class_id);

create table if not exists public.assignment_submissions (
  id uuid primary key default uuid_generate_v4(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  response_text text,
  submitted_at timestamptz not null default now(),
  marks_awarded integer,
  teacher_comment text,
  status text not null default 'submitted'
    check (status in ('submitted', 'graded', 'returned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create index if not exists submissions_assignment_idx
  on public.assignment_submissions(assignment_id);
create index if not exists submissions_student_idx
  on public.assignment_submissions(student_id);

-- ---------------------------------------------------------------------
-- DOUBTS ("Ask Teacher" — master prompt section 20)
-- ---------------------------------------------------------------------
create table if not exists public.doubts (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  question text not null,
  answer text,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'answered')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists doubts_class_idx on public.doubts(class_id, status);

drop trigger if exists set_updated_at on public.assignments;
create trigger set_updated_at before update on public.assignments
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.assignment_submissions;
create trigger set_updated_at before update on public.assignment_submissions
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.doubts;
create trigger set_updated_at before update on public.doubts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- HELPER FUNCTIONS (SECURITY DEFINER — same non-recursive pattern as 0005)
-- ---------------------------------------------------------------------
create or replace function public.is_teacher_of_assignment(p_assignment_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.assignments a
    join public.classes c on c.id = a.class_id
    join public.teachers t on t.id = c.teacher_id
    where a.id = p_assignment_id and t.user_id = auth.uid()
  );
$$;

create or replace function public.is_student_of_assignment(p_assignment_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.assignments a
    join public.class_students cs on cs.class_id = a.class_id
    join public.students s on s.id = cs.student_id
    where a.id = p_assignment_id and s.user_id = auth.uid()
  );
$$;

grant execute on function public.is_teacher_of_assignment(uuid) to authenticated;
grant execute on function public.is_student_of_assignment(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.doubts enable row level security;

-- ASSIGNMENTS: teacher manages; enrolled students and their parents read
create policy "assignments_all_teacher" on public.assignments
  for all using (public.is_teacher_of_class(class_id));

create policy "assignments_select_student" on public.assignments
  for select using (public.is_student_enrolled_in_class(class_id));

create policy "assignments_select_parent" on public.assignments
  for select using (public.is_parent_of_class(class_id));

-- SUBMISSIONS: teacher of the assignment sees/grades all; a student sees
-- and creates only their OWN; a parent reads only their own child's.
create policy "submissions_all_teacher" on public.assignment_submissions
  for all using (public.is_teacher_of_assignment(assignment_id));

create policy "submissions_select_own" on public.assignment_submissions
  for select using (public.is_own_student_row(student_id));

create policy "submissions_insert_own" on public.assignment_submissions
  for insert with check (public.is_own_student_row(student_id));

create policy "submissions_update_own" on public.assignment_submissions
  for update using (public.is_own_student_row(student_id));

create policy "submissions_select_parent" on public.assignment_submissions
  for select using (public.is_parent_of_student(student_id));

-- INTEGRITY: RLS can grant/deny a row but can't restrict which *columns*
-- an update touches. Without this trigger a student could satisfy
-- "submissions_update_own" (intended so they can revise their answer)
-- and set their own marks_awarded. This rejects any change to the
-- grading fields unless the caller is the teacher who owns the
-- assignment.
create or replace function public.guard_submission_grading()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.marks_awarded is distinct from old.marks_awarded)
     or (new.teacher_comment is distinct from old.teacher_comment)
     or (new.status is distinct from old.status)
  then
    if not public.is_teacher_of_assignment(new.assignment_id) then
      raise exception 'Only the teacher can change marks, comments, or status.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_submission_grading on public.assignment_submissions;
create trigger guard_submission_grading
  before update on public.assignment_submissions
  for each row execute function public.guard_submission_grading();

-- DOUBTS: student raises and reads their own; teacher of the class sees
-- and answers all. Parents intentionally do NOT see doubts — a child
-- should be able to ask their teacher a question without it being
-- surfaced to a parent (master prompt section 39, child safety).
create policy "doubts_all_teacher" on public.doubts
  for all using (public.is_teacher_of_class(class_id));

create policy "doubts_select_own" on public.doubts
  for select using (public.is_own_student_row(student_id));

create policy "doubts_insert_own" on public.doubts
  for insert with check (public.is_own_student_row(student_id));

-- A student may edit the wording of their own unanswered question, but
-- must not be able to write the "answer" or flip the status themselves.
create policy "doubts_update_own" on public.doubts
  for update using (public.is_own_student_row(student_id));

create or replace function public.guard_doubt_answering()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.answer is distinct from old.answer)
     or (new.status is distinct from old.status)
     or (new.answered_at is distinct from old.answered_at)
  then
    if not public.is_teacher_of_class(new.class_id) then
      raise exception 'Only the teacher can answer a question.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_doubt_answering on public.doubts;
create trigger guard_doubt_answering
  before update on public.doubts
  for each row execute function public.guard_doubt_answering();
