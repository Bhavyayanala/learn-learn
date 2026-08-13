-- LearnNest — fix: infinite recursion in RLS policies
--
-- ROOT CAUSE: several tables' RLS policies check access by querying
-- *other* RLS-protected tables (e.g. "classes" checks "class_students"
-- to see if a student is enrolled, while "class_students" checks
-- "classes" to see if you're the teacher). Postgres has to evaluate each
-- table's policies to run that subquery, which requires evaluating the
-- other table's policies, and so on — an unbreakable cycle. Postgres
-- detects this at query time and refuses, which is the
-- "infinite recursion detected in policy for relation ..." error.
--
-- FIX: move every cross-table access check into a SECURITY DEFINER SQL
-- function. Such a function runs with the privileges of its owner
-- (in Supabase, the `postgres` role, which bypasses RLS), so its
-- internal queries never trigger RLS evaluation on the tables it reads.
-- That breaks the cycle while keeping exactly the same access rules.
-- This is the standard, Supabase-documented pattern for this problem.

-- ---------------------------------------------------------------------
-- HELPER FUNCTIONS
-- ---------------------------------------------------------------------
create or replace function public.is_teacher_of_class(p_class_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    join public.teachers t on t.id = c.teacher_id
    where c.id = p_class_id and t.user_id = auth.uid()
  );
$$;

create or replace function public.is_student_enrolled_in_class(p_class_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.class_students cs
    join public.students s on s.id = cs.student_id
    where cs.class_id = p_class_id and s.user_id = auth.uid()
  );
$$;

create or replace function public.is_parent_of_class(p_class_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.class_students cs
    join public.parent_students ps on ps.student_id = cs.student_id
    join public.parents p on p.id = ps.parent_id
    where cs.class_id = p_class_id and p.user_id = auth.uid()
  );
$$;

create or replace function public.is_own_student_row(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.students s
    where s.id = p_student_id and s.user_id = auth.uid()
  );
$$;

create or replace function public.is_teacher_of_student(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.class_students cs
    join public.classes c on c.id = cs.class_id
    join public.teachers t on t.id = c.teacher_id
    where cs.student_id = p_student_id and t.user_id = auth.uid()
  );
$$;

create or replace function public.is_teacher_of_lesson_plan(p_lesson_plan_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.lesson_plans lp
    join public.classes c on c.id = lp.class_id
    join public.teachers t on t.id = c.teacher_id
    where lp.id = p_lesson_plan_id and t.user_id = auth.uid()
  );
$$;

create or replace function public.is_student_of_lesson_plan(p_lesson_plan_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.lesson_plans lp
    join public.class_students cs on cs.class_id = lp.class_id
    join public.students s on s.id = cs.student_id
    where lp.id = p_lesson_plan_id
      and lp.status = 'accepted'
      and s.user_id = auth.uid()
  );
$$;

create or replace function public.is_parent_of_lesson_plan(p_lesson_plan_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.lesson_plans lp
    join public.class_students cs on cs.class_id = lp.class_id
    join public.parent_students ps on ps.student_id = cs.student_id
    join public.parents p on p.id = ps.parent_id
    where lp.id = p_lesson_plan_id
      and lp.status = 'accepted'
      and p.user_id = auth.uid()
  );
$$;

grant execute on function public.is_teacher_of_class(uuid) to authenticated;
grant execute on function public.is_student_enrolled_in_class(uuid) to authenticated;
grant execute on function public.is_parent_of_class(uuid) to authenticated;
grant execute on function public.is_own_student_row(uuid) to authenticated;
grant execute on function public.is_teacher_of_student(uuid) to authenticated;
grant execute on function public.is_teacher_of_lesson_plan(uuid) to authenticated;
grant execute on function public.is_student_of_lesson_plan(uuid) to authenticated;
grant execute on function public.is_parent_of_lesson_plan(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- CLASSES — replace the policy that queried class_students
-- ---------------------------------------------------------------------
drop policy if exists "classes_select_enrolled_student" on public.classes;
create policy "classes_select_enrolled_student" on public.classes
  for select using (public.is_student_enrolled_in_class(id));

-- Pre-existing gap fixed here too: Stage 1 never gave parents a policy
-- on "classes" at all, so a parent could see a class's materials/lesson
-- plan but not the class row itself (its grade/subject/etc).
drop policy if exists "classes_select_parent" on public.classes;
create policy "classes_select_parent" on public.classes
  for select using (public.is_parent_of_class(id));

-- ---------------------------------------------------------------------
-- CLASS_STUDENTS — replace the policies that queried classes / students
-- ---------------------------------------------------------------------
drop policy if exists "class_students_select_teacher" on public.class_students;
create policy "class_students_select_teacher" on public.class_students
  for select using (public.is_teacher_of_class(class_id));

drop policy if exists "class_students_modify_teacher" on public.class_students;
create policy "class_students_modify_teacher" on public.class_students
  for all using (public.is_teacher_of_class(class_id));

drop policy if exists "class_students_select_self" on public.class_students;
create policy "class_students_select_self" on public.class_students
  for select using (public.is_own_student_row(student_id));

-- ---------------------------------------------------------------------
-- STUDENTS — replace the policy that queried class_students + classes
-- ---------------------------------------------------------------------
drop policy if exists "students_select_teacher" on public.students;
create policy "students_select_teacher" on public.students
  for select using (public.is_teacher_of_student(id));

-- (students_select_parent is untouched — it only reaches parent_students
-- and parents, neither of which loops back into this cycle.)

-- ---------------------------------------------------------------------
-- MATERIALS — replace the policies that queried class_students
-- ---------------------------------------------------------------------
drop policy if exists "materials_select_enrolled_student" on public.materials;
create policy "materials_select_enrolled_student" on public.materials
  for select using (public.is_student_enrolled_in_class(class_id));

drop policy if exists "materials_select_parent" on public.materials;
create policy "materials_select_parent" on public.materials
  for select using (public.is_parent_of_class(class_id));

-- ---------------------------------------------------------------------
-- LESSON_PLANS — replace the policies that queried classes / class_students
-- ---------------------------------------------------------------------
drop policy if exists "lesson_plans_all_teacher" on public.lesson_plans;
create policy "lesson_plans_all_teacher" on public.lesson_plans
  for all using (public.is_teacher_of_class(class_id));

drop policy if exists "lesson_plans_select_enrolled_student" on public.lesson_plans;
create policy "lesson_plans_select_enrolled_student" on public.lesson_plans
  for select using (
    status = 'accepted' and public.is_student_enrolled_in_class(class_id)
  );

drop policy if exists "lesson_plans_select_parent" on public.lesson_plans;
create policy "lesson_plans_select_parent" on public.lesson_plans
  for select using (
    status = 'accepted' and public.is_parent_of_class(class_id)
  );

-- ---------------------------------------------------------------------
-- LESSON_PLAN_ITEMS — replace all three policies
-- ---------------------------------------------------------------------
drop policy if exists "lesson_plan_items_all_teacher" on public.lesson_plan_items;
create policy "lesson_plan_items_all_teacher" on public.lesson_plan_items
  for all using (public.is_teacher_of_lesson_plan(lesson_plan_id));

drop policy if exists "lesson_plan_items_select_enrolled_student" on public.lesson_plan_items;
create policy "lesson_plan_items_select_enrolled_student" on public.lesson_plan_items
  for select using (public.is_student_of_lesson_plan(lesson_plan_id));

drop policy if exists "lesson_plan_items_select_parent" on public.lesson_plan_items;
create policy "lesson_plan_items_select_parent" on public.lesson_plan_items
  for select using (public.is_parent_of_lesson_plan(lesson_plan_id));
