# LearnNest — Stage 3: Delete Class + Adaptive Rescheduling + Progress Tracking

A kid-friendly tuition platform for teachers, students (Class 3–4), and
parents. This is **Stage 1 of a multi-stage build** — it delivers a real,
working scaffold with authentication and a real database, not a mockup.

## What's included in Stage 1

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Supabase Auth: email/password for teachers & students, phone OTP for parents
- Core Postgres schema: `users`, `teachers`, `students`, `parents`,
  `parent_students`, `subjects`, `classes`, `class_students`
- Row Level Security on every table (teachers see only their data, parents
  see only their linked children, students see only their own records)
- Three role-based dashboard shells: `/teacher/dashboard`,
  `/student/dashboard`, `/parent/dashboard`
- Middleware that redirects unauthenticated or wrong-role users to `/login`

## What's included in Stage 2

- **Class creation** — teacher picks subject, grade, classes/month,
  duration, fee, start date, days of week
- **Material upload** — PDFs/notes/worksheets go to a private Supabase
  Storage bucket (`materials`), scoped per class via storage RLS policies
- **Syllabus catalog** (`topics` table) — seeded with a real Grade 3/4
  topic progression for Mathematics, Science, and English, matching the
  master prompt's section 3 example
- **Automatic lesson planner** (`lib/lessonPlanner.ts`) — a deterministic,
  rule-based engine (no AI call, no cost) that turns
  `(subject, grade, classes/month, duration)` into a proposed day-by-day
  plan: foundational topics first, revision + assessment days
  auto-reserved near the end, extra "practice" days generated if a grade
  has fewer topics than available class slots
- **Plan review UI** — teacher sees every proposed day, can inline-edit
  the title/objective/activities/duration of any day, and explicitly
  **accepts** the plan before it's considered active (nothing is silently
  applied — see master prompt section 49, "teacher always has final
  control")

**Not yet built** (later stages): completion tracking after each class,
the adaptive rescheduling engine, live classroom, whiteboard, games,
assignments, tests, fee/payment management, notifications. See the
project's master prompt for the full roadmap and build order.

### Design note: why the planner is rule-based, not AI-generated

Section 58/59 of the master prompt calls for a modular, optional AI layer
and deterministic logic wherever it's sufficient. This stage ships the
deterministic version — it's free to run, fully explainable, and doesn't
need any API key configured. A future stage can add an AI material-analysis
step that reads uploaded PDFs and proposes *additions* to the `topics`
table; the planner itself won't need to change since it already just reads
from that table.

## Local setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://ffgrgckgnjxrjbftqoyg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase dashboard → Settings → API>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard → Settings → API>
```

⚠️ Never commit `.env.local` or paste the service role key anywhere public
— it bypasses Row Level Security entirely.

## Run the database migrations

Using the Supabase CLI (recommended):

```bash
npx supabase login
npx supabase link --project-ref ffgrgckgnjxrjbftqoyg
npx supabase db push
```

Or, if you don't want to install the CLI: open the Supabase dashboard →
SQL Editor, and paste the contents of each file in `supabase/migrations/`
**in numeric order** — `0001`, `0002`, `0003`, `0004`.

### Enable phone auth (for parent OTP login)

In the Supabase dashboard: **Authentication → Providers → Phone** → enable
it and configure an SMS provider (Twilio, MessageBird, or Vonage). Without
this, parent signup/login will fail at the "Send OTP" step until it's
configured.

## Run the app

```bash
npm run dev
```

Visit `http://localhost:3000`. Try signing up as each of the three roles
to confirm the auth + RLS setup is working end to end.

## Project structure

```
app/
  page.tsx                landing page
  login/page.tsx          role-aware login (password + OTP)
  signup/page.tsx         role picker + signup
  auth/callback/route.ts  email confirmation / magic link handler
  teacher/dashboard/      teacher shell
  student/dashboard/      student shell
  parent/dashboard/       parent shell
  teacher/classes/         class list, create-class form
  teacher/classes/[id]/    class detail: materials + plan generation
  teacher/classes/[id]/plan/  plan review/edit/accept + completion check-in
  api/classes/[id]/generate-plan/  route handler that runs the planner
  api/lesson-plan-items/[id]/complete/  completion check-in + reschedule trigger
  api/schedule-proposals/[id]/resolve/  accept/reject a reschedule proposal
lib/supabase/
  client.ts               browser Supabase client
  server.ts               server + admin Supabase clients
lib/lessonPlanner.ts       deterministic lesson-plan generation engine
lib/reschedulePlanner.ts   adaptive rescheduling engine
components/
  MaterialUploader.tsx    file upload to Supabase Storage
  GeneratePlanButton.tsx  triggers the planner via the API route
  LessonPlanReview.tsx    inline-edit, accept, completion check-in, reschedule UI
  DeleteClassButton.tsx   confirm-then-delete a class
middleware.ts             session refresh + role-based route protection
supabase/migrations/      SQL migrations (run in numeric order)
```

## Migration 0005: RLS recursion fix

If you ran migrations 0001–0004 before this fix landed, you'll hit
`infinite recursion detected in policy for relation "classes"` the first
time the app actually queries the `classes` table (e.g. creating a class).
Run `supabase/migrations/0005_fix_rls_recursion.sql` to fix it — it's
safe to run on top of an existing database, and doesn't touch any data.

**Root cause:** `classes`' policy checked `class_students` to verify
student enrollment, while `class_students`' policy checked back into
`classes` to verify teacher ownership — an unbreakable cycle once Postgres
tries to evaluate either one. The fix moves every cross-table access check
into a `SECURITY DEFINER` SQL function, which bypasses RLS internally and
breaks the cycle while preserving identical access rules. This was
verified against a real local Postgres instance running the actual
migration files, with an 18-case test matrix covering every role
(teacher/student/parent, including a second teacher to confirm isolation)
against every affected table, plus the real INSERT flows the app performs
(creating a class, generating a plan) — not just policy syntax review.

## What's included in Stage 3

- **Delete a class** — teacher can permanently remove a class from its
  detail page, with an explicit confirm step. Cleans up uploaded files in
  Storage first, then deletes the class row (database rows for
  enrollment, materials, lesson plan, and plan items all cascade
  automatically via existing foreign keys)
- **Post-class completion check-in** (master prompt section 6) — once a
  plan is accepted, each day gets a "Mark Complete" control: teacher picks
  0/25/50/75/100% and an optional note
- **Adaptive rescheduling engine** (`lib/reschedulePlanner.ts`) — if a day
  finishes below 80% complete, the system proposes inserting a
  continuation day for the same topic and shifting the rest of the
  schedule forward by one. This is a proposal only — nothing is ever
  applied automatically. The teacher sees a "Recommended Schedule
  Adjustment" panel with the reason, can edit the proposed continuation
  day's title inline, and must explicitly **Accept Changes** or
  **Keep Original**
- **Progress tracking** — an overall completion bar plus a per-day
  color-coded strip (green ≥80%, amber ≥40%, orange >0%, grey untouched)
  on the plan review page

**Not yet built** (later stages): live classroom, whiteboard, games,
assignments, tests, fee/payment management, notifications, and true
per-student progress differentiation (see limitations below).

## Known limitations (Stage 3)

- Rescheduling only handles the single-day-ran-over case (insert one
  continuation day, shift the rest). Section 47's fuller prioritization
  logic (prerequisites, exam-relevance, per-student performance) needs
  actual assessment data to be meaningful — natural to build once
  tests/assignments exist.
- When a schedule shifts, the affected days' calendar dates are cleared
  rather than guessed at, since safely recomputing them requires
  reapplying the days-of-week pattern — the teacher sets new dates
  manually via the date field now available in each day's Edit view.
- Progress tracking is currently **class-level** (per lesson-plan-item
  completion), not differentiated per student — true per-student progress
  needs quiz/assignment data that doesn't exist until a later stage (see
  master prompt sections 7–8).
- If the incomplete day is the *last* day in the plan, no reschedule is
  proposed (there's nothing after it to shift) — a real product would
  roll the remainder into next month's plan.

## Known limitations (Stage 2)

- If a grade/subject combination has more syllabus topics than the
  teacher's `classes_per_month`, the extra topics are simply not scheduled
  this month rather than being carried forward — a real "next month
  rollover" would need a stage of its own.
- Regenerating a plan **replaces** the existing draft/accepted plan
  entirely (including any manual edits) — there's no diff/merge yet.
- No file preview/analysis of uploaded materials yet — they're stored and
  downloadable, but the planner doesn't read their contents (see the
  design note above on the AI layer).

## Stage 4 (next)

- Attendance tracking on class join
- Live classroom (video, screen share, chat)
- Interactive whiteboard
- Assignments and tests, which will make true per-student progress
  tracking meaningful
