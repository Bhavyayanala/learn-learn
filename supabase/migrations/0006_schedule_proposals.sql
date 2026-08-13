-- LearnNest — Stage 3: post-class completion check-in + adaptive
-- rescheduling engine + progress tracking
--
-- lesson_plan_items already has completion_status / completion_percentage
-- / teacher_notes columns (added in 0003) — Stage 3 is what actually uses
-- them: the teacher checks in after each class, and if a topic wasn't
-- finished, the system proposes a schedule adjustment for the teacher to
-- explicitly accept, edit, or reject (master prompt section 6 — "The
-- system should NOT silently modify the teacher's schedule").

create table if not exists public.schedule_proposals (
  id uuid primary key default uuid_generate_v4(),
  lesson_plan_id uuid not null references public.lesson_plans(id) on delete cascade,
  triggered_by_item_id uuid references public.lesson_plan_items(id) on delete set null,
  reason text not null,
  proposed_items jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists schedule_proposals_plan_idx
  on public.schedule_proposals(lesson_plan_id, status);

alter table public.schedule_proposals enable row level security;

-- Teacher-only: proposals are a working tool for the teacher's own
-- review, not something students/parents need visibility into.
create policy "schedule_proposals_all_teacher" on public.schedule_proposals
  for all using (public.is_teacher_of_lesson_plan(lesson_plan_id));
