-- Automatically creates a row in public.users whenever someone signs up
-- through Supabase Auth. Expects role/full_name to be passed in
-- auth signUp() options.data — see app/signup/page.tsx.

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, role, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'role', 'student'),
    coalesce(new.raw_user_meta_data ->> 'full_name', 'Unnamed'),
    new.email,
    new.phone
  )
  on conflict (id) do nothing;

  -- Also create the role-specific row so foreign keys resolve immediately.
  if coalesce(new.raw_user_meta_data ->> 'role', 'student') = 'teacher' then
    insert into public.teachers (user_id) values (new.id) on conflict do nothing;
  elsif coalesce(new.raw_user_meta_data ->> 'role', 'student') = 'student' then
    insert into public.students (user_id, grade)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'grade', 'Unassigned'))
    on conflict do nothing;
  elsif coalesce(new.raw_user_meta_data ->> 'role', 'student') = 'parent' then
    insert into public.parents (user_id) values (new.id) on conflict do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
