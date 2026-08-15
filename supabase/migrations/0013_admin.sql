-- LearnNest — Stage 10: admin panel (master prompt section 35)
--
-- SCOPE: this is a read-only oversight dashboard — every teacher,
-- student, parent, class, and the platform's payment totals, visible
-- only to role='admin'. Full CRUD (edit/delete any user's data,
-- platform settings) is a materially bigger surface — it means an admin
-- policy on every write path in the app, each one a place a mistake
-- could leak or corrupt data, which isn't something to rush. Read access
-- is enough for the actual job admin oversight is for at this stage:
-- seeing what's happening across the platform.
--
-- There is deliberately no signup path to become an admin — matching
-- section 35's "do not expose admin functionality to teachers/students/
-- parents." An admin account is created by hand:
--   update public.users set role = 'admin' where email = '...';
-- (See README for the exact one-time step.)

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- Admin gets a read-only SELECT policy alongside the existing policies
-- on the tables an oversight dashboard actually needs. Nothing here
-- grants admin any INSERT/UPDATE/DELETE — intentionally, per the scope
-- note above.
create policy "users_select_admin" on public.users
  for select using (public.is_admin());

create policy "teachers_select_admin" on public.teachers
  for select using (public.is_admin());

create policy "students_select_admin" on public.students
  for select using (public.is_admin());

create policy "parents_select_admin" on public.parents
  for select using (public.is_admin());

create policy "classes_select_admin" on public.classes
  for select using (public.is_admin());

create policy "fee_cycles_select_admin" on public.fee_cycles
  for select using (public.is_admin());

create policy "payments_select_admin" on public.payments
  for select using (public.is_admin());
