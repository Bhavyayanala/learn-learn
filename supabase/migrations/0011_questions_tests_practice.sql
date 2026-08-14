-- LearnNest — Stage 8: question bank + tests + practice games + XP
--
-- One question bank powers two experiences: a formal teacher-assigned
-- Test (graded, contributes to a record), and a student-initiated
-- Practice session (ungraded, immediate feedback, earns XP). This is the
-- "reusable game engine" from master prompt section 12 — a new game is a
-- new way of presenting questions from this same bank, not a new
-- subsystem. Section 11 also asks to avoid public rankings/pressure, so
-- there is deliberately no leaderboard here, only personal XP.
--
-- SECURITY DESIGN: correct_answer must never be readable by a student,
-- including via a direct REST call that bypasses the app's UI (this is
-- the same class of risk the grade-tampering and payment-forgery bugs in
-- earlier stages came from). RLS is row-level, not column-level, so
-- "give students a SELECT policy on questions" would leak the column
-- regardless of what the app UI chooses to query. Instead: students get
-- NO policy at all on the base `questions` table, and read questions
-- only through a view that excludes correct_answer and hand-replicates
-- the row filter (views run with the owner's privileges by default, so
-- the filter has to be written into the view, not inherited from RLS).

-- ---------------------------------------------------------------------
-- GAMIFICATION FIELDS (kept light — XP + streak, no public leaderboard)
-- ---------------------------------------------------------------------
alter table public.students add column if not exists xp integer not null default 0;
alter table public.students add column if not exists streak_days integer not null default 0;
alter table public.students add column if not exists last_practice_date date;

-- ---------------------------------------------------------------------
-- QUESTION BANK
-- ---------------------------------------------------------------------
create table if not exists public.questions (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references public.classes(id) on delete cascade,
  question_type text not null
    check (question_type in ('mcq', 'true_false', 'fill_blank', 'numerical')),
  question_text text not null,
  options jsonb,                 -- e.g. ["12", "14", "16", "18"] for mcq
  correct_answer text not null,  -- NEVER exposed to students, see design note above
  marks integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists questions_class_idx on public.questions(class_id);

alter table public.questions enable row level security;

-- Teacher only. Deliberately no student/parent policy exists on this
-- table at all — see design note above.
create policy "questions_all_teacher" on public.questions
  for all using (public.is_teacher_of_class(class_id));

-- Student-safe view: same rows, minus correct_answer, with the access
-- check written explicitly into the view body.
create or replace view public.questions_for_students as
select q.id, q.class_id, q.question_type, q.question_text, q.options, q.marks, q.created_at
from public.questions q
where public.is_student_enrolled_in_class(q.class_id)
   or public.is_teacher_of_class(q.class_id);

grant select on public.questions_for_students to authenticated;

-- ---------------------------------------------------------------------
-- TESTS
-- ---------------------------------------------------------------------
create table if not exists public.tests (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null,
  time_limit_minutes integer,
  created_at timestamptz not null default now()
);

create table if not exists public.test_questions (
  test_id uuid not null references public.tests(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  sequence_order integer not null default 1,
  primary key (test_id, question_id)
);

alter table public.tests enable row level security;
alter table public.test_questions enable row level security;

create policy "tests_all_teacher" on public.tests
  for all using (public.is_teacher_of_class(class_id));
create policy "tests_select_student" on public.tests
  for select using (public.is_student_enrolled_in_class(class_id));
create policy "tests_select_parent" on public.tests
  for select using (public.is_parent_of_class(class_id));

create policy "test_questions_all_teacher" on public.test_questions
  for all using (
    exists (select 1 from public.tests t where t.id = test_questions.test_id
            and public.is_teacher_of_class(t.class_id))
  );

-- Student-safe view combining test_questions + the answer-free question
-- view, so the client never has to (and never could) touch the base
-- questions table directly to take a test.
create or replace view public.test_questions_for_students as
select tq.test_id, tq.sequence_order, q.id as question_id, q.question_type,
       q.question_text, q.options, q.marks
from public.test_questions tq
join public.questions_for_students q on q.id = tq.question_id;

grant select on public.test_questions_for_students to authenticated;

-- ---------------------------------------------------------------------
-- TEST ATTEMPTS
-- ---------------------------------------------------------------------
create table if not exists public.test_attempts (
  id uuid primary key default uuid_generate_v4(),
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted')),
  score integer,
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);

create table if not exists public.test_attempt_answers (
  id uuid primary key default uuid_generate_v4(),
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  student_answer text,
  is_correct boolean,
  marks_awarded integer,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

alter table public.test_attempts enable row level security;
alter table public.test_attempt_answers enable row level security;

create or replace function public.is_own_attempt(p_attempt_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.test_attempts ta
    join public.students s on s.id = ta.student_id
    where ta.id = p_attempt_id and s.user_id = auth.uid()
  );
$$;

create or replace function public.is_teacher_of_test(p_test_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.tests t
    join public.classes c on c.id = t.class_id
    join public.teachers tc on tc.id = c.teacher_id
    where t.id = p_test_id and tc.user_id = auth.uid()
  );
$$;

grant execute on function public.is_own_attempt(uuid) to authenticated;
grant execute on function public.is_teacher_of_test(uuid) to authenticated;

create policy "attempts_select_own" on public.test_attempts
  for select using (public.is_own_student_row(student_id));
create policy "attempts_insert_own" on public.test_attempts
  for insert with check (public.is_own_student_row(student_id));
create policy "attempts_select_teacher" on public.test_attempts
  for select using (public.is_teacher_of_test(test_id));
create policy "attempts_select_parent" on public.test_attempts
  for select using (public.is_parent_of_student(student_id));

-- A student inserts their own answers as they go, but the grading
-- columns must stay untouched by them — enforced below by a trigger,
-- same pattern as the assignment-grading guard in Stage 5.
create policy "attempt_answers_insert_own" on public.test_attempt_answers
  for insert with check (public.is_own_attempt(attempt_id));
create policy "attempt_answers_select_own" on public.test_attempt_answers
  for select using (public.is_own_attempt(attempt_id));
create policy "attempt_answers_select_teacher" on public.test_attempt_answers
  for select using (
    exists (
      select 1 from public.test_attempts ta
      where ta.id = test_attempt_answers.attempt_id
        and public.is_teacher_of_test(ta.test_id)
    )
  );

create or replace function public.guard_attempt_answer_insert()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if (new.is_correct is not null or new.marks_awarded is not null)
     and current_user not in ('service_role', 'postgres', 'supabase_admin')
  then
    raise exception 'Grading fields can only be set by the server-side grader.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_attempt_answer_insert on public.test_attempt_answers;
create trigger guard_attempt_answer_insert
  before insert on public.test_attempt_answers
  for each row execute function public.guard_attempt_answer_insert();

-- ---------------------------------------------------------------------
-- SHARED ANSWER-MATCHING LOGIC (used by both grading paths below)
-- ---------------------------------------------------------------------
create or replace function public.answers_match(p_question_id uuid, p_given text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_type text;
  v_correct text;
  v_given_num numeric;
  v_correct_num numeric;
begin
  select question_type, correct_answer into v_type, v_correct
  from public.questions where id = p_question_id;

  if v_type is null then
    return false;
  end if;

  if v_type = 'numerical' then
    begin
      v_given_num := p_given::numeric;
      v_correct_num := v_correct::numeric;
      return v_given_num = v_correct_num;
    exception when others then
      return false;
    end;
  end if;

  return lower(trim(coalesce(p_given, ''))) = lower(trim(v_correct));
end;
$$;

-- ---------------------------------------------------------------------
-- GRADE A TEST ATTEMPT (server-controlled — the only way scores are set)
-- ---------------------------------------------------------------------
create or replace function public.submit_test_attempt(p_attempt_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_status text;
  v_owns boolean;
  v_total integer := 0;
  r record;
begin
  select status into v_status from public.test_attempts where id = p_attempt_id;
  if v_status is null then
    raise exception 'Attempt not found.';
  end if;

  select public.is_own_attempt(p_attempt_id) into v_owns;
  if not v_owns then
    raise exception 'Not your attempt.';
  end if;

  if v_status <> 'in_progress' then
    raise exception 'This attempt was already submitted.';
  end if;

  for r in
    select taa.id, taa.question_id, taa.student_answer, q.marks
    from public.test_attempt_answers taa
    join public.questions q on q.id = taa.question_id
    where taa.attempt_id = p_attempt_id
  loop
    if public.answers_match(r.question_id, r.student_answer) then
      update public.test_attempt_answers
        set is_correct = true, marks_awarded = r.marks
        where id = r.id;
      v_total := v_total + r.marks;
    else
      update public.test_attempt_answers
        set is_correct = false, marks_awarded = 0
        where id = r.id;
    end if;
  end loop;

  update public.test_attempts
    set status = 'submitted', submitted_at = now(), score = v_total
    where id = p_attempt_id;

  return v_total;
end;
$$;

grant execute on function public.submit_test_attempt(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- PRACTICE MODE ("games"): immediate per-question feedback + XP.
-- Lower stakes than a Test, so this DOES return the correct answer in
-- its response, for learning purposes — a deliberate difference from
-- the formal Test path above, which never reveals it.
-- ---------------------------------------------------------------------
create or replace function public.practice_check_answer(p_question_id uuid, p_given text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_student_id uuid;
  v_correct boolean;
  v_correct_answer text;
  v_marks integer;
  v_xp_earned integer := 0;
  v_class_id uuid;
begin
  select id into v_student_id from public.students where user_id = auth.uid();
  if v_student_id is null then
    raise exception 'Only a student account can practice.';
  end if;

  select class_id, correct_answer, marks into v_class_id, v_correct_answer, v_marks
  from public.questions where id = p_question_id;

  if v_class_id is null then
    raise exception 'Question not found.';
  end if;

  if not public.is_student_enrolled_in_class(v_class_id) then
    raise exception 'You are not enrolled in this class.';
  end if;

  v_correct := public.answers_match(p_question_id, p_given);

  if v_correct then
    v_xp_earned := v_marks * 2;
    update public.students
      set xp = xp + v_xp_earned,
          streak_days = case
            when last_practice_date = current_date - 1 then streak_days + 1
            when last_practice_date = current_date then streak_days
            else 1
          end,
          last_practice_date = current_date
      where id = v_student_id;
  end if;

  return jsonb_build_object(
    'correct', v_correct,
    'correct_answer', v_correct_answer,
    'xp_earned', v_xp_earned
  );
end;
$$;

grant execute on function public.practice_check_answer(uuid, text) to authenticated;
