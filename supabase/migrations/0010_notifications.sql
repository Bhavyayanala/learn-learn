-- LearnNest — Stage 7: in-app notifications (master prompt section 30)
--
-- Notifications are created automatically by database triggers on the
-- events that already happen in the app (grading, answering, fee cycles,
-- payments, enrollment) — no route needs to remember to "also notify
-- someone." Email/SMS/WhatsApp channels are a natural extension of this
-- same table (add a `channel`/`sent_at` pair later) but aren't wired up
-- here since they need real provider credentials, same reasoning as the
-- payment adapter in 0009.

create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications(user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

-- A user may only toggle is_read on their own notifications — nothing
-- else about a notification should be client-editable.
create policy "notifications_update_own_read_state" on public.notifications
  for update using (user_id = auth.uid());

create or replace function public.guard_notification_update()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.type is distinct from old.type
     or new.link is distinct from old.link
     or new.user_id is distinct from old.user_id
  then
    if current_user not in ('service_role', 'postgres', 'supabase_admin') then
      raise exception 'Only is_read can be changed by the recipient.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_notification_update on public.notifications;
create trigger guard_notification_update
  before update on public.notifications
  for each row execute function public.guard_notification_update();

-- ---------------------------------------------------------------------
-- Helper: create a notification, bypassing RLS (system-generated, not a
-- user action — SECURITY DEFINER is correct here, unlike the payment
-- guards, because this never needs to distinguish caller identity).
-- ---------------------------------------------------------------------
create or replace function public.notify(
  p_user_id uuid, p_type text, p_title text, p_body text, p_link text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, link)
  values (p_user_id, p_type, p_title, p_body, p_link);
end;
$$;

-- ---------------------------------------------------------------------
-- TRIGGER: assignment graded -> notify the student
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_graded()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_title text;
begin
  if new.marks_awarded is not distinct from old.marks_awarded then
    return new;
  end if;
  select s.user_id into v_user_id from public.students s where s.id = new.student_id;
  select a.title into v_title from public.assignments a where a.id = new.assignment_id;
  perform public.notify(
    v_user_id, 'assignment_graded',
    'Your homework was graded',
    coalesce(v_title, 'An assignment') || ' — ' || coalesce(new.marks_awarded::text, '') || ' marks',
    '/student/dashboard'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_graded on public.assignment_submissions;
create trigger trg_notify_graded
  after update on public.assignment_submissions
  for each row execute function public.trg_notify_graded();

-- ---------------------------------------------------------------------
-- TRIGGER: new submission -> notify the teacher
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_submission()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_teacher_user_id uuid;
  v_student_name text;
  v_title text;
begin
  select t.user_id into v_teacher_user_id
  from public.assignments a
  join public.classes c on c.id = a.class_id
  join public.teachers t on t.id = c.teacher_id
  where a.id = new.assignment_id;

  select u.full_name into v_student_name
  from public.students s join public.users u on u.id = s.user_id
  where s.id = new.student_id;

  select a.title into v_title from public.assignments a where a.id = new.assignment_id;

  perform public.notify(
    v_teacher_user_id, 'submission_received',
    'New homework submitted',
    coalesce(v_student_name, 'A student') || ' submitted ' || coalesce(v_title, 'an assignment'),
    '/teacher/classes'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_submission on public.assignment_submissions;
create trigger trg_notify_submission
  after insert on public.assignment_submissions
  for each row execute function public.trg_notify_submission();

-- ---------------------------------------------------------------------
-- TRIGGER: doubt answered -> notify the student
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_doubt_answered()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if new.status is not distinct from old.status or new.status != 'answered' then
    return new;
  end if;
  select s.user_id into v_user_id from public.students s where s.id = new.student_id;
  perform public.notify(
    v_user_id, 'doubt_answered',
    'Your teacher answered your question',
    left(new.question, 80),
    '/student/dashboard'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_doubt_answered on public.doubts;
create trigger trg_notify_doubt_answered
  after update on public.doubts
  for each row execute function public.trg_notify_doubt_answered();

-- ---------------------------------------------------------------------
-- TRIGGER: new doubt -> notify the teacher
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_new_doubt()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_teacher_user_id uuid;
  v_student_name text;
begin
  select t.user_id into v_teacher_user_id
  from public.classes c join public.teachers t on t.id = c.teacher_id
  where c.id = new.class_id;

  select u.full_name into v_student_name
  from public.students s join public.users u on u.id = s.user_id
  where s.id = new.student_id;

  perform public.notify(
    v_teacher_user_id, 'new_doubt',
    'New question from a student',
    coalesce(v_student_name, 'A student') || ' asked: ' || left(new.question, 60),
    '/teacher/classes'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_new_doubt on public.doubts;
create trigger trg_notify_new_doubt
  after insert on public.doubts
  for each row execute function public.trg_notify_new_doubt();

-- ---------------------------------------------------------------------
-- TRIGGER: fee cycle becomes due -> notify the parent(s)
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_fee_due()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  r record;
begin
  if new.status is not distinct from 'due' and (old is null or old.status is distinct from 'due') then
    for r in
      select p.user_id
      from public.parent_students ps
      join public.parents p on p.id = ps.parent_id
      where ps.student_id = new.student_id
    loop
      perform public.notify(
        r.user_id, 'fee_due',
        'Tuition fee due',
        '₹' || new.amount || ' for ' || new.period_label,
        '/parent/dashboard'
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_fee_due on public.fee_cycles;
create trigger trg_notify_fee_due
  after insert or update on public.fee_cycles
  for each row execute function public.trg_notify_fee_due();

-- ---------------------------------------------------------------------
-- TRIGGER: payment succeeds -> notify parent AND teacher
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_payment_success()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_teacher_user_id uuid;
begin
  if new.status is distinct from 'success' or old.status is not distinct from 'success' then
    return new;
  end if;

  for r in
    select p.user_id
    from public.fee_cycles fc
    join public.parent_students ps on ps.student_id = fc.student_id
    join public.parents p on p.id = ps.parent_id
    where fc.id = new.fee_cycle_id
  loop
    perform public.notify(
      r.user_id, 'payment_success',
      'Payment received',
      '₹' || new.amount || ' · ' || coalesce(new.reference, ''),
      '/parent/dashboard'
    );
  end loop;

  select t.user_id into v_teacher_user_id
  from public.fee_cycles fc
  join public.classes c on c.id = fc.class_id
  join public.teachers t on t.id = c.teacher_id
  where fc.id = new.fee_cycle_id;

  perform public.notify(
    v_teacher_user_id, 'payment_success',
    'A parent paid their tuition fee',
    '₹' || new.amount || ' · ' || coalesce(new.reference, ''),
    '/teacher/dashboard'
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_payment_success on public.payments;
create trigger trg_notify_payment_success
  after update on public.payments
  for each row execute function public.trg_notify_payment_success();

-- ---------------------------------------------------------------------
-- TRIGGER: enrolled in a class -> notify the student
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_enrolled()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_subject text;
begin
  select s.user_id into v_user_id from public.students s where s.id = new.student_id;
  select sub.name into v_subject
  from public.classes c join public.subjects sub on sub.id = c.subject_id
  where c.id = new.class_id;

  perform public.notify(
    v_user_id, 'enrolled',
    'You were added to a class',
    coalesce(v_subject, 'A class') || ' is now on your dashboard',
    '/student/dashboard'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_enrolled on public.class_students;
create trigger trg_notify_enrolled
  after insert on public.class_students
  for each row execute function public.trg_notify_enrolled();
