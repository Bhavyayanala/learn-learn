-- LearnNest — Stage 6: fee cycles + payments
--
-- Master prompt sections 26-29. A fee cycle tracks one month's tuition
-- for one student in one class: how many classes were planned, how many
-- were actually completed, the amount owed, and whether it's been paid.
--
-- The payment gateway itself (Razorpay) needs live credentials, so this
-- ships with a mock adapter (section 28: "If payment credentials are
-- unavailable during development, implement a mock/test payment mode").
-- The schema and verification flow are built to be gateway-agnostic:
-- swapping in real Razorpay means filling in provider_order_id /
-- provider_payment_id / signature verification, not reshaping tables.

create table if not exists public.fee_cycles (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  period_label text not null,              -- e.g. '2026-08'
  classes_planned integer not null,
  classes_completed integer not null default 0,
  amount numeric(10,2) not null,
  status text not null default 'active'
    check (status in ('active', 'due', 'paid', 'waived')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, student_id, period_label)
);

create index if not exists fee_cycles_class_idx on public.fee_cycles(class_id, status);
create index if not exists fee_cycles_student_idx on public.fee_cycles(student_id, status);

create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  fee_cycle_id uuid not null references public.fee_cycles(id) on delete cascade,
  amount numeric(10,2) not null,
  provider text not null default 'mock',   -- 'mock' | 'razorpay' | ...
  provider_order_id text,
  provider_payment_id text,
  status text not null default 'initiated'
    check (status in ('initiated', 'success', 'failed')),
  reference text,                          -- receipt / reference number
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists payments_cycle_idx on public.payments(fee_cycle_id, status);

drop trigger if exists set_updated_at on public.fee_cycles;
create trigger set_updated_at before update on public.fee_cycles
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.payments;
create trigger set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- HELPER FUNCTIONS
-- ---------------------------------------------------------------------
create or replace function public.is_teacher_of_fee_cycle(p_cycle_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.fee_cycles fc
    join public.classes c on c.id = fc.class_id
    join public.teachers t on t.id = c.teacher_id
    where fc.id = p_cycle_id and t.user_id = auth.uid()
  );
$$;

create or replace function public.is_parent_of_fee_cycle(p_cycle_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.fee_cycles fc
    join public.parent_students ps on ps.student_id = fc.student_id
    join public.parents p on p.id = ps.parent_id
    where fc.id = p_cycle_id and p.user_id = auth.uid()
  );
$$;

grant execute on function public.is_teacher_of_fee_cycle(uuid) to authenticated;
grant execute on function public.is_parent_of_fee_cycle(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.fee_cycles enable row level security;
alter table public.payments enable row level security;

-- Teacher manages fee cycles for their own classes.
create policy "fee_cycles_all_teacher" on public.fee_cycles
  for all using (public.is_teacher_of_class(class_id));

-- Parent reads their own child's fee cycles (they need to see what's due).
create policy "fee_cycles_select_parent" on public.fee_cycles
  for select using (public.is_parent_of_student(student_id));

-- Students deliberately have NO policy on fee_cycles or payments —
-- money is between the teacher and the parent, and a child shouldn't be
-- shown what their family owes (master prompt section 39).

create policy "payments_all_teacher" on public.payments
  for all using (public.is_teacher_of_fee_cycle(fee_cycle_id));

create policy "payments_select_parent" on public.payments
  for select using (public.is_parent_of_fee_cycle(fee_cycle_id));

create policy "payments_insert_parent" on public.payments
  for insert with check (public.is_parent_of_fee_cycle(fee_cycle_id));

-- INTEGRITY: a payment must never be able to mark ITSELF successful from
-- the client. Only the server may move a payment to 'success', after
-- verifying it with the provider. Section 28: "Do not claim a payment is
-- successful without server-side verification."
--
-- NOTE ON HOW THIS WORKS: RLS policies are bypassed by the service role,
-- but TRIGGERS are not — they fire for every connection including the
-- service role. So the guard can't simply reject all success writes, or
-- the legitimate server verify route would be blocked too (this was
-- caught in testing: the server-side update silently affected 0 rows).
--
-- Instead the guard checks the connecting Postgres role. Supabase runs
-- client requests as `authenticated` / `anon`, and service-role requests
-- as `service_role`. Only the latter may set success.
--
-- CRITICAL: these two guards are SECURITY INVOKER (the default), NOT
-- SECURITY DEFINER. Inside a SECURITY DEFINER function current_user is
-- rewritten to the function's owner, so a current_user check there
-- silently passes for everyone -- testing caught exactly this: a parent
-- successfully inserted a payment row already marked 'success'. As
-- INVOKER, current_user is the role the request is actually running as
-- ('authenticated' for a client, 'service_role' for the server), which
-- is what we need to distinguish. session_user is NOT usable here
-- either: PostgREST connects as `authenticator` and then SET ROLEs, so
-- session_user is identical for client and server requests.
create or replace function public.guard_payment_verification()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if new.status = 'success' and (old.status is distinct from 'success') then
    if current_user not in ('service_role', 'postgres', 'supabase_admin') then
      raise exception 'Payment success must be set by server-side verification.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_payment_verification on public.payments;
create trigger guard_payment_verification
  before update on public.payments
  for each row execute function public.guard_payment_verification();

-- Same guard on insert: a client can create an 'initiated' payment but
-- never one that is already 'success'.
create or replace function public.guard_payment_insert()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if new.status = 'success'
     and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'A payment cannot be created already marked successful.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_payment_insert on public.payments;
create trigger guard_payment_insert
  before insert on public.payments
  for each row execute function public.guard_payment_insert();
