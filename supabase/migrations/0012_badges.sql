-- LearnNest — Stage 9: achievements/badges (master prompt section 34)
--
-- Deliberately light: milestone badges auto-awarded off data that
-- already exists (streak, XP, homework completion, a perfect test
-- score) rather than a heavy certificate-generation subsystem. No
-- public leaderboard — badges are visible only to the student who
-- earned them (and their parent), per section 11's guidance against
-- competitive pressure.

create table if not exists public.badges (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  title text not null,
  emoji text not null,
  description text not null
);

insert into public.badges (code, title, emoji, description) values
  ('streak_3',    '3-Day Streak',        '🔥', 'Practiced 3 days in a row'),
  ('streak_7',    '7-Day Streak',        '🔥', 'Practiced 7 days in a row'),
  ('xp_50',       'Rising Star',         '⭐', 'Earned 50 XP'),
  ('xp_200',      'XP Champion',         '🏆', 'Earned 200 XP'),
  ('homework_5',  'Homework Hero',       '✏️', 'Submitted 5 pieces of homework'),
  ('perfect_test','Perfect Score',       '💯', 'Scored full marks on a test')
on conflict (code) do nothing;

create table if not exists public.student_badges (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.students(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (student_id, badge_id)
);

alter table public.badges enable row level security;
alter table public.student_badges enable row level security;

-- Badge catalog is public reference data.
create policy "badges_select_all" on public.badges
  for select using (auth.role() = 'authenticated');

create policy "student_badges_select_own" on public.student_badges
  for select using (public.is_own_student_row(student_id));
create policy "student_badges_select_parent" on public.student_badges
  for select using (public.is_parent_of_student(student_id));
create policy "student_badges_select_teacher" on public.student_badges
  for select using (public.is_teacher_of_student(student_id));

-- No INSERT policy for any client role — badges are only ever awarded by
-- the trigger functions below (SECURITY DEFINER, bypass RLS on write).

create or replace function public.award_badge(p_student_id uuid, p_code text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_badge_id uuid;
begin
  select id into v_badge_id from public.badges where code = p_code;
  if v_badge_id is null then
    return;
  end if;
  insert into public.student_badges (student_id, badge_id)
  values (p_student_id, v_badge_id)
  on conflict (student_id, badge_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- TRIGGER: streak / XP milestones, fired whenever students.xp or
-- streak_days changes (i.e. every practice answer).
-- ---------------------------------------------------------------------
create or replace function public.trg_check_practice_badges()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.streak_days >= 3 then perform public.award_badge(new.id, 'streak_3'); end if;
  if new.streak_days >= 7 then perform public.award_badge(new.id, 'streak_7'); end if;
  if new.xp >= 50 then perform public.award_badge(new.id, 'xp_50'); end if;
  if new.xp >= 200 then perform public.award_badge(new.id, 'xp_200'); end if;
  return new;
end;
$$;

drop trigger if exists trg_check_practice_badges on public.students;
create trigger trg_check_practice_badges
  after update of xp, streak_days on public.students
  for each row execute function public.trg_check_practice_badges();

-- ---------------------------------------------------------------------
-- TRIGGER: homework count milestone
-- ---------------------------------------------------------------------
create or replace function public.trg_check_homework_badge()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.assignment_submissions
  where student_id = new.student_id;

  if v_count >= 5 then
    perform public.award_badge(new.student_id, 'homework_5');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_homework_badge on public.assignment_submissions;
create trigger trg_check_homework_badge
  after insert on public.assignment_submissions
  for each row execute function public.trg_check_homework_badge();

-- ---------------------------------------------------------------------
-- TRIGGER: perfect test score
-- ---------------------------------------------------------------------
create or replace function public.trg_check_perfect_test_badge()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_max integer;
begin
  if new.status <> 'submitted' or new.score is null then
    return new;
  end if;

  select coalesce(sum(q.marks), 0) into v_max
  from public.test_questions tq
  join public.questions q on q.id = tq.question_id
  where tq.test_id = new.test_id;

  if v_max > 0 and new.score >= v_max then
    perform public.award_badge(new.student_id, 'perfect_test');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_perfect_test_badge on public.test_attempts;
create trigger trg_check_perfect_test_badge
  after update of status on public.test_attempts
  for each row execute function public.trg_check_perfect_test_badge();
