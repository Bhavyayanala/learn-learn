# LearnNest — Stage 16: UI/UX Polish Pass 3 (Tabs + Test UI)

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
  api/classes/[id]/enroll/  enroll a student by email
  api/classes/[id]/sessions/  create a session + seed its attendance roster
  api/parent/link-child/  link a parent to a child by student email
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
  StudentEnrollment.tsx   enroll/remove students on a class
  AttendanceTaker.tsx     per-session attendance marking
  AssignmentManager.tsx   teacher: create assignments, grade submissions
  DoubtsPanel.tsx         teacher: view and answer student questions
  StudentHomework.tsx     student: view/submit homework, see grades
  AskTeacher.tsx          student: raise a question
  LinkChild.tsx           parent: link a child by email
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

## What's included in Stage 4

- **Student enrollment** — teacher enrolls students into a class by the
  email they signed up with, and can remove them. Until now `class_students`
  existed but nothing could populate it, which blocked attendance,
  per-student progress, and the parent dashboard
- **Attendance** — `class_sessions` records an actual class that happened;
  `attendance` hangs off a session (not off a plan day) so a rescheduled or
  repeated day still gets a clean record. Teacher picks a date, the roster
  seeds everyone as present, and they toggle present/late/absent/excused
- **Real teacher dashboard** — replaces the placeholder shell with live
  aggregates: class count, total students, a "needs your attention" panel
  (pending schedule proposals, un-accepted draft plans), and a per-class
  syllabus progress bar

### Privacy note on attendance

A student can see only their **own** attendance row, never a classmate's;
a parent sees only their own child's. This is enforced by RLS at the
database level, not just hidden in the UI, and is verified by the test
matrix described below (master prompt sections 39 and 60).

### Design note: why enrollment uses the admin client

A teacher has no RLS visibility into a student who isn't already enrolled
with them — deliberately, so teachers can't browse the full user table.
That means looking a student up by email needs the service-role client.
The enroll route therefore verifies class ownership through normal RLS
*first*, and only then uses the admin client for the single email lookup,
returning nothing beyond whether it matched. Verified: under normal RLS a
teacher's `select * from users` returns exactly one row (their own).

## What's included in Stage 5

All three roles are now real, end-to-end.

- **Student dashboard** — kid-friendly per master prompt section 9: large
  buttons, emoji, minimal text. Shows today's mission (next incomplete
  topic), homework count, study materials, and an "Ask Your Teacher" box
- **Assignments / homework** (section 18) — teacher creates assignments
  with instructions, due date, and max marks; students submit a written
  response; teacher grades with marks and a comment; the grade flows back
  to the student's dashboard and the parent's
- **Doubts / Ask Teacher** (section 20) — student raises a question,
  teacher answers it from the class page, student sees the reply
- **Parent–child linking + parent dashboard** (sections 23–24) — a parent
  links a child by the email the child signed up with, then sees per-child
  attendance, homework completion, and average score

### Security: column-level integrity guards

RLS can grant or deny access to a *row*, but it cannot restrict which
*columns* an UPDATE touches. Testing caught a real vulnerability from
this: a student could satisfy the "update your own submission" policy
(there so they can revise their answer) and change their own
`marks_awarded` — verified by successfully raising a grade from 8 to 10.

The fix is a pair of `BEFORE UPDATE` trigger guards that reject changes to
the grading fields (`marks_awarded`, `teacher_comment`, `status`) and the
answer fields (`answer`, `status`, `answered_at`) unless the caller is the
owning teacher. Re-verified after the fix: the tampering attempt now
raises an exception, while legitimate actions still work — a student can
still revise their answer text, and a teacher can still grade and answer.

### Privacy boundaries (verified, not just intended)

- A student sees only their **own** homework submission, never a
  classmate's
- A student sees only their **own** questions
- A parent sees only their **own** child's submissions and grades
- A parent **cannot** see their child's questions to the teacher — a
  child should be able to ask for help without it being surfaced to a
  parent (master prompt section 39)
- A second teacher sees zero assignments, submissions, or doubts

## What's included in Stage 6

- **Email/password login for parents** — phone OTP is still there and
  still preferred, but it needs an SMS provider (and in India, DLT sender
  registration, which costs money and takes days). Parents can now choose
  either method at signup. This unblocks development and is a reasonable
  product choice regardless: a parent without a usable phone can still
  see their child's progress.
- **Fee cycles** (sections 26-27) — one cycle per student per class per
  month, tracking classes planned vs completed and the amount owed. A
  cycle flips from `active` to `due` once the planned number of classes
  has actually been completed.
- **Payments with a mock gateway** (section 28) — teacher generates the
  month's fees; parent pays from their dashboard and gets a receipt
  reference. Razorpay isn't wired up (no credentials), so this runs
  through a development adapter.

### Payment architecture

`lib/payments/adapter.ts` defines a gateway-agnostic interface with
`createOrder` and `verifyPayment`. Only the mock adapter is implemented;
adding Razorpay means implementing the same interface and recomputing the
HMAC signature in `verifyPayment` — no route or UI changes. The mock
deliberately is not a rubber stamp: it checks that the payment id matches
the order id it issued, so the verification code path exercised in
development is structurally the same one a real gateway drives.

### Security: server-side payment verification

Section 28 requires that a payment is never reported successful without
server-side verification. Enforcement is at the database level, not just
in application code: trigger guards reject any attempt to create or
update a payment to `success` unless the request is running as
`service_role`. So even a fully compromised browser cannot mark a fee
cycle paid — it must go through `/api/payments/[id]/verify`, which only
sets success after the adapter confirms the payment.

Two real bugs were found and fixed while testing this:

1. The first version of the guard blocked *everyone*, including the
   legitimate server route — RLS is bypassed by the service role but
   triggers are not, so the verify route would have silently failed in
   production (the update affected 0 rows).
2. The second version used `current_user` inside a `SECURITY DEFINER`
   function, where `current_user` is rewritten to the function's owner —
   so the check silently passed for everyone, and a parent successfully
   inserted a payment row already marked `success`. The guards are now
   `SECURITY INVOKER`, where `current_user` is the role the request
   actually runs as. (`session_user` is not usable here either: PostgREST
   connects as `authenticator` and then `SET ROLE`s, so it's identical
   for client and server requests.)

Both are the kind of bug that looks correct on reading and only surfaces
when executed against a real database.

### Privacy

Students have **no** access to fee or payment data at all — money is
between the teacher and the parent, and a child shouldn't be shown what
their family owes (section 39). Verified: a student's query on
`fee_cycles` returns zero rows.

## What's included in Stage 7

- **In-app notifications** (section 30) — a `notifications` table with
  database triggers that fire automatically off events already happening
  in the app: enrolled in a class, new/answered doubt, new/graded
  submission, fee due, payment received. No route had to be modified to
  "remember" to notify someone; the trigger lives with the data change.
- **Notification bell** on all three dashboards — unread count, dropdown
  list, click-through to the relevant page, mark-as-read.
- **Real landing page** (section 56) — hero, "how it works," feature
  grid, and a call to action, replacing the placeholder stub.

### Design note: why triggers, not application code

Putting notification creation in triggers rather than in each API route
means it's structurally impossible to grade a submission, answer a
doubt, or mark a fee due *without* the notification firing — there's no
route to forget to update. The tradeoff is that the logic lives in SQL
rather than TypeScript; each trigger is short and commented with which
event it's for.

### Integrity guard

Same class of protection as the payment guards in Stage 6: a user can
toggle `is_read` on their own notification, but a trigger rejects any
attempt to change the title, body, or recipient — verified by attempting
to rewrite a "fee due" notification's content, which was rejected, while
the legitimate `is_read` toggle succeeded.

## What's included in Stage 8

- **Shared question bank** — one set of questions per class powers both
  formal tests and student practice/games.
- **Formal tests** (section 19) — teacher builds a test from the bank;
  student takes it once; auto-graded server-side; teacher sees an
  average, parent sees their child's score.
- **Practice / games** (section 12) — student picks up random questions
  across their enrolled classes, gets immediate right/wrong feedback plus
  the correct answer (deliberately different from formal tests, which
  never reveal it), and earns lightweight XP + a daily streak. No public
  leaderboard, per section 11's guidance against competitive pressure.

### Scoping decision: one engine, not nineteen games

Your spec lists ~19 named games (Math Race, Number Ninja, Plant Doctor,
etc.). Building each as a bespoke mechanic would be weeks of work and,
more importantly, mostly reproduce the same skeleton — question,
answer, feedback, score — with different chrome. What's built instead is
the shared engine section 12 actually asks for ("a reusable game engine
so new games can be added later"): `practice_check_answer` + the question
bank. A new "game" going forward is a new presentation layer (a timer, a
different visual theme, a matching-pairs UI) over this same backend, not
a new subsystem. Named, subject-themed games with distinct visuals are
future work.

### Security: the correct answer never reaches the client

This is the highest-stakes data-exposure surface built so far — unlike a
grade or a payment, a leaked answer key is silently exploitable and
nobody would ever notice. RLS is row-level, not column-level, so merely
"trusting the app UI to not query correct_answer" would leave it
reachable by anyone calling the Supabase REST API directly. Instead,
students have **no RLS policy at all** on the base `questions` table —
verified: a direct `select * from questions` returns zero rows for a
student, and explicitly `select correct_answer` returns zero rows too.
They read questions only through `questions_for_students`, a view whose
column list structurally does not include `correct_answer` — confirmed
by inspecting `information_schema.columns` for the view.

Grading itself happens inside `SECURITY DEFINER` functions
(`submit_test_attempt`, `practice_check_answer`) that read the real
answer server-side and never return it (formal tests) or return it only
after the student has already answered (practice, for learning value).
A trigger guard blocks a student from inserting a test answer with
`is_correct`/`marks_awarded` already set — the same pattern as the
grade-tampering fix in Stage 5.

Verified against real Postgres, 12 cases: the column-exposure checks
above; practice mode awards XP only for a genuinely correct answer and
only within a class the student is enrolled in (tested with a real
question id from a class they're not in, not just a blocked lookup);
auto-grading scored a real two-question attempt correctly (2/2 marks +
0/3 marks) without the student ever touching the answer key; a student
cannot pre-set their own grade or resubmit a graded attempt; a
classmate's attempt is invisible; parent and teacher see the score
through their own separate, correctly-scoped policies.

## What's included in Stage 9

- **Badges** (section 34, kept light) — 6 milestone badges auto-awarded
  by database triggers off data that already exists: practice streak (3/7
  days), XP totals (50/200), homework count (5 submissions), and a
  perfect test score. Visible only to the student who earned it and
  their parent/teacher — no leaderboard, per section 11.
- **Teacher calendar/agenda** (section 46) — upcoming scheduled lesson
  days and assignment due dates across all the teacher's classes, in one
  chronological list.
- **Teacher search** (section 45) — one search box across students,
  materials, assignments, tests, and doubts, all scoped by the same RLS
  policies as everywhere else in the app (fetch-then-filter client-side,
  which is safe and fast at tuition scale since RLS already limits each
  fetch to the teacher's own data).

### Security

Badges can only be written by the trigger functions (`SECURITY DEFINER`,
bypass RLS on write) — no client role has an INSERT policy on
`student_badges` at all. Verified: a student's direct attempt to insert
a badge for themselves is rejected by RLS, and the badge count is
unaffected.

Verified against real Postgres: crossing the XP threshold mid-practice-
session correctly auto-awards the badge in the same transaction, a
student sees only their own badges, and the forgery attempt above is
blocked.

## What's included in Stage 10

- **Admin panel** (section 35) — a read-only oversight dashboard: total
  teachers/students/parents/classes and payments collected, plus a
  recent-classes list. Deliberately read-only: full CRUD across every
  user's data is a materially bigger and higher-risk surface than an
  oversight view, and per section 35 admin functionality must stay fully
  separate from teacher/student/parent access anyway, so this is a
  contained addition rather than something to rush. There's no signup
  path to become an admin (see below for the one-time promotion step).
- **Downloadable certificates** (section 34) — each earned badge gets a
  "Download" link that generates a real PDF client-side with `jspdf`,
  styled as a certificate with the student's name, the badge, and the
  date. No server round-trip.
- **CI/CD** (section 64) — a GitHub Actions workflow that runs `npm ci`
  and `npm run build` (which includes Next.js's own type-checking and
  linting) on every push and PR to `main`.

### Becoming an admin

There's intentionally no UI for this. After migration 0013, run once in
Supabase SQL Editor:

```sql
update public.users set role = 'admin' where email = 'your-email@example.com';
```

Then log in normally (through the existing teacher/student login form —
an admin account still needs a real `auth.users` row, so sign up first
as any role, then run the update above) and visit `/admin/dashboard`
directly. One subtlety: the login middleware reads your role from the
session's JWT metadata, which was set at signup and won't say 'admin'
after this manual promotion — that's fine, `/admin` routes only check
that you're logged in via the JWT, then verify the real role with a live
database read on the admin page itself, which reflects the change
immediately.

### Security

`is_admin()` appears **only** in SELECT policies — nowhere does it grant
INSERT/UPDATE/DELETE. Verified against real Postgres: an admin's attempt
to UPDATE a class or DELETE a student both silently affect zero rows
(RLS filters them out before the write can happen), while SELECT
correctly returns every row across every teacher. Also verified: a
regular teacher's own view of `users` still returns exactly one row
(themselves) — the new admin policy doesn't leak visibility to anyone
who isn't actually role='admin'.

## What's included in Stage 11

- **Live classroom** (section 14) — real video/audio using LiveKit,
  via the `VideoConference` prefab (camera, mic, screen share, chat, grid
  layout all included). One persistent room per class, not per session.
- **Collaborative whiteboard** (section 13) — draw, erase, change pen
  color/size, clear — synced in real time over LiveKit's existing data
  channel rather than a separate service. Every stroke segment
  broadcasts immediately; there's no central canvas state to reconcile.
- Both are gated by `/api/classes/[classId]/live/token`, which reuses
  the exact same RLS-backed authorization pattern as the rest of this
  app: a successful `SELECT` against `classes` proves teacher ownership,
  a successful `SELECT` against `class_students` proves enrollment.
  There's no separate, hand-written permission check that could drift
  out of sync with everything else already tested in this repo.

### What was actually verified, and what wasn't

This sandbox has no network path to `livekit.cloud` and no second
browser to test a real multi-peer call — the honest limitation flagged
back when this stage was first discussed. What genuinely was tested:
a real JWT was signed with your actual LiveKit API key/secret via
`AccessToken`, then independently re-verified with `TokenVerifier` using
the same credentials — confirming the key/secret are valid and the room
name, identity, and grant claims (including the teacher's `roomAdmin`)
come out correct. `npm run build` compiles the whole app, including the
`/classroom/[classId]` route, cleanly. What's *not* verified is the live
connection itself — that WebRTC actually negotiates, that two real
browsers actually see each other's video, that the whiteboard sync is
smooth in practice. That needs to be tried from your end.

### Environment variables

Add to `.env.local` (already present as commented placeholders in
`.env.example` — this stage just fills them in):

```
LIVEKIT_API_KEY=your-key
LIVEKIT_API_SECRET=your-secret
LIVEKIT_URL=wss://your-project.livekit.cloud
```

Restart `npm run dev` after adding these — Next.js only reads
`.env.local` at server start.

## What's included in Stage 12

- **WhatsApp fee reminders** (section 29) — `lib/notifications/whatsapp.ts`
  is a gateway-agnostic adapter over Meta's WhatsApp Cloud API, same
  design as `lib/payments/adapter.ts`. When a teacher generates fee
  cycles and one becomes genuinely `due`, the app looks up the linked
  parent's phone number and sends a WhatsApp template message —
  best-effort: an unconfigured or failed send never blocks fee cycle
  creation itself, it's just reported back as `skipped`.

### You must get a template approved in Meta before this can send anything

WhatsApp Business requires every message outside a live 24-hour
customer-service conversation to use a pre-approved **template** — you
cannot send free-form text. In your Meta Business dashboard, under your
WhatsApp Business Account → Message Templates, create a template named
exactly `fee_reminder` (or set `WHATSAPP_FEE_TEMPLATE_NAME` to whatever
you name it) with this body text, in this category (**Utility**, not
Marketing — utility templates are far cheaper and don't need marketing
opt-in):

```
Hi! This is a reminder that {{1}}'s tuition fee of {{2}} for {{3}} is
now due. Please log in to LearnNest to complete the payment. Thank you!
```

The three placeholders arrive in this order: `{{1}}` student name,
`{{2}}` amount (e.g. `₹1500`), `{{3}}` the billing period (e.g.
`2026-08`). Submit it for approval — usually minutes to a day. Sending
will fail with a clear error in the teacher's fee panel if the template
name doesn't match an approved template, or if it isn't approved yet.

### Environment variables

```
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_ACCESS_TOKEN=your-system-user-access-token
WHATSAPP_FEE_TEMPLATE_NAME=fee_reminder
```

Without these set, the adapter safely no-ops (verified: returns
`{ sent: false, reason: "WhatsApp is not configured..." }` without
attempting a network call or throwing) — the rest of fee-cycle
generation is entirely unaffected.

### Privacy note

Phone number lookup uses the admin (service-role) client, not the
teacher's own session — a teacher has no RLS visibility into the
`parents` table for privacy reasons, same as the enroll-by-email lookup
in Stage 4. This is read-only contact info used only to send a
system-triggered reminder, never exposed back to the teacher.

## What's included in Stage 13

- **Email fee reminders** via Resend — `lib/notifications/email.ts`,
  same gateway-agnostic shape as the payment and WhatsApp adapters.
  Added as a second reminder channel because WhatsApp's Cloud API
  requires a billing method attached to the Meta Business Account before
  it will send anything at all, even within the free allowance — a real
  barrier not worth pushing through right now. Resend needs only an API
  key: no business verification, 3,000 free emails/month.
- The fee-cycle route now sends on **whichever channel each parent
  actually has** — email if they signed up via email, WhatsApp (once
  configured) if they signed up via phone/OTP, both if somehow both
  exist. This isn't a preference toggle; it reflects a real, structural
  gap worth understanding:

  **Phone-OTP parent signup never asks for an email. Email-signup parent
  signup never asks for a phone number.** So today, every parent can
  only ever receive reminders through the one channel that matches
  however they originally signed up. The real fix is adding an optional
  second contact field to the parent profile regardless of signup
  method — flagged as a follow-up, not fixed in this stage.

### Environment variables

```
RESEND_API_KEY=your-api-key
EMAIL_FROM_ADDRESS=LearnNest <onboarding@resend.dev>
```

Get a free API key at resend.com — no domain verification needed to
start (their `onboarding@resend.dev` sender works immediately for
testing); verify your own domain later so mail shows LearnNest as the
sender and lands reliably instead of in spam.

Without `RESEND_API_KEY` set, the adapter safely no-ops — verified:
returns `{ sent: false, reason: "Email is not configured..." }` with no
network call and no throw, so fee cycle creation is unaffected either
way, same as the WhatsApp adapter's unconfigured behavior.

## What's included in Stage 14

A real voice-controlled UI for students, not a chatbot — "say it, the
website understands it, the website does it." Architecture matches the
spec's own suggested shape:

```
lib/voice/
  types.ts            intent/state types
  speechRecognition.ts browser SpeechRecognition wrapper (single-shot,
                        NOT continuous — mic activates once per tap)
  speechSynthesis.ts   short spoken confirmations only
  intentParser.ts      lightweight keyword/regex NLU, no LLM
  commandRouter.ts     pure entity-resolution logic (which class/test
                        matches what was said)
components/
  VoiceControl.tsx     the mic button + state machine + orchestration
  ScrollToHash.tsx      tiny helper so voice-navigating to a dashboard
                        section scrolls there even from another page
```

**Intents wired up:** go home, go back, help, logout (with spoken
confirmation), open practice, open tests/homework/materials/progress
(scrolls to that dashboard section), join a class by subject, start a
test by subject — including the multi-match clarification flow ("I
found Mathematics and Science — which one?") when more than one
matches, exactly as demonstrated in the spec.

**Why keyword/regex, not an LLM:** no LLM is currently wired into this
app (`ANTHROPIC_API_KEY` is an unset placeholder in `.env.example`), and
the spec explicitly calls for "a lightweight intent/keyword system
first, structured so an LLM can be added later" in that situation.
`parseCommand()` is the only function that would need replacing — it
returns the same `{ intent, entities }` shape either way, so nothing
else in the pipeline (recognition, routing, UI) would need to change.

**Reuses existing actions, doesn't duplicate them:** LOGOUT calls the
exact same `performSignOut()` function now shared with the nav bar's
sign-out button (extracted to `lib/auth/signOut.ts` specifically for
this); JOIN_CLASS/START_TEST navigate to the same routes the Join/Start
links already point to; class and test candidates are fetched through
the same RLS-protected Supabase queries as everywhere else in the app —
a student's voice commands are bound by the identical row-level security
as their clicks, there's no separate, less-restricted path.

### What was verified, and what wasn't

The intent parser and entity-resolution logic are pure functions with no
browser dependency, so they were actually run — not just built — against
15 real command variants (including all four natural-language phrasings
of "join my maths class" from the spec's own section 2) plus the
disambiguation and clarification-answer-matching logic, and every result
was correct.

What can't be verified here: actual microphone input and real speech
recognition accuracy — this sandbox has no audio hardware, the same
limitation as LiveKit video earlier. `SpeechRecognition`/
`SpeechSynthesis` are standard, stable browser APIs (Web Speech API);
the code is written against their documented, well-established shape,
with `isVoiceSupported()` feature-detecting so the mic button simply
doesn't render on browsers without support (Firefox, notably) rather
than showing something broken.

## What's included in Stage 15

A second, more thorough design pass focused on the pages the UI spec
calls out as highest priority: the student dashboard hierarchy, a real
progress page, and reusable component primitives.

- **`components/ui/`** — StatCard, EmptyState, ProgressBar, StatusPill.
  Genuinely reused rather than one-off: StatCard now backs both the
  teacher dashboard's stat row and the new student progress page;
  EmptyState replaces four separate ad-hoc "nothing here" messages;
  StatusPill replaces inline pill markup that was duplicated per page.
- **Student dashboard restructured** into the requested hierarchy: top
  (greeting + XP/streak), main (a single prominent "Continue Learning"
  card, then class/practice quick actions, then test/homework counts at
  a glance), bottom (subjects, achievements with a link to full
  progress). Study materials are now resource cards with a file-type
  icon (🎥 video, 🔊 audio, 📕 PDF, 📊 spreadsheet) instead of a plain
  file-name list. Real empty states everywhere something could be empty
  (no tests, no homework, no materials, no classes).
- **New `/student/progress` page** — didn't exist before. Subject-wise
  progress bars computed from real `lesson_plan_items` completion data,
  plus totals (lessons/tests/homework completed, XP, current streak) —
  all from data that already existed, just not surfaced anywhere as a
  dedicated view.
- **Teacher dashboard**: stat row now uses StatCard, added a "To grade"
  count (ungraded submissions across all classes) that wasn't shown
  before, and a proper empty state for a brand-new teacher with zero
  classes instead of a blank section.

### What this pass did NOT attempt, and why

The source UI spec's section 11 asks for an "interactive lesson page"
with embedded visual examples (a pizza cut into fraction slices, inline
multiple-choice practice within the lesson itself). That assumes a
**lesson content viewer** — a page that renders authored teaching
content with embedded interactions — which doesn't exist in this app's
data model. Lesson plan items are structured metadata (topic, objective,
day, completion %), not authored content with embeddable visuals.
Building that would mean designing a new content-authoring system
(where does the pizza SVG come from? who authors the inline practice
questions and how do they attach to a specific lesson?), not a UI polish
pass over existing data. Flagged honestly rather than building a
disconnected mock.

Also not attempted in this pass: full page-by-page treatment of the
class page tabs, a teacher-side "recent activity" feed, and onboarding
flow — all real, buildable items, just not done in this round given the
size of the full spec (37 sections). Happy to continue with any of
these specifically.

### Verification

`npm run build` — clean, including the new `/student/progress` route.
No business logic, database schema, authentication, API contracts, or
RLS policies were touched — this pass is presentation-layer only, per
the spec's own explicit instruction not to change working functionality.
The one new query (teacher's "to grade" count) is a plain read against
data and RLS policies already tested in earlier stages.

## Known limitations (Stage 14)

- **In-test voice control isn't built yet** — reading a question aloud,
  saying "option C," "next question," or "submit test" by voice (spec
  section 14, the fullest part of the demo scenario) needs deeper
  integration into `TakeTest.tsx` itself, not just navigation. Deferred
  as a clearly separate next step rather than half-building it into this
  pass.
- Voice control is student-only for now — the spec is scoped to the
  student experience throughout, so teacher/parent voice control wasn't
  built.
- No true continuous "voice mode" (spec section 21 mentions this as
  optional/opt-in) — every command is a single tap-and-speak.
- Browser support is real but partial: Chrome/Edge work, Safari is
  patchy, Firefox doesn't support the Web Speech API at all — the mic
  button hides itself gracefully there rather than erroring.
- Recognition language is fixed to `en-IN` (Indian English) rather than
  configurable per student.

## Known limitations (Stage 13)

- See the structural signup-collects-only-one-contact-method gap
  described above — this is the main limitation worth fixing next.
- No delivery/open tracking — Resend supports webhooks for this, not
  wired up.
- Plain HTML template, not a branded design system email.

## Known limitations (Stage 12)

- Only the fee-due reminder is wired up. Section 30's other WhatsApp use
  cases (class reminders, doubt-answered notifications) would follow the
  identical `sendWhatsAppTemplate` pattern with a different template.
- No delivery-status tracking (sent/delivered/read webhooks) — Meta
  sends these as webhook callbacks, which would need a new API route to
  receive them.
- A parent must have a phone number on file. A parent who signed up via
  email/password (the Stage 6 option added specifically because Twilio's
  SMS OTP required expensive DLT registration in India) has no phone
  number recorded, so they're silently skipped rather than reminded —
  worth adding an optional phone field to the parent profile as a
  follow-up so email-signup parents can still opt into WhatsApp
  reminders.

## Known limitations (Stage 11)

- **No writing-permission flow** — section 13 asks for a request/allow/
  deny flow before a student can draw. Everyone in the room can draw on
  the whiteboard right now; the moderation flow is a reasonable next
  addition, and the teacher's `roomAdmin` grant is already in place to
  support it.
- **No board persistence** — a late joiner doesn't see strokes drawn
  before they connected, and nothing is saved when the class ends
  (sections 13's "save board state," "download as PDF/image" aren't
  built). The current design intentionally has no central canvas state
  to keep sync simple; persistence would mean periodically snapshotting
  the canvas to Storage.
- **No automatic attendance from joining** — the live room isn't tied to
  a `class_sessions` row, so attendance stays the existing manual flow.
  Wiring "joined the LiveKit room" to auto-create an attendance record is
  a contained follow-up.
- **No recording** (part of section 14) — would need LiveKit's egress
  API, not yet integrated.
- **One room per class, not per scheduled session** — simpler for this
  stage; means the room is always "open" rather than tied to a specific
  day's lesson plan item.

## Known limitations (Stage 10)

- Admin is read-only. Editing/deleting any user's data, managing
  subjects globally, or platform settings aren't built — see the scope
  note above.
- No dedicated admin login flow or UI to promote other admins; it's a
  single manual SQL statement per new admin.
- The certificate PDF is intentionally simple (text + a border) rather
  than a designed template with a logo/signature graphic.

## Known limitations (Stage 9)

- No certificate *files* — section 34 also asks for a downloadable
  certificate; what's built is the badge record, not a generated
  PDF/image. Certificate generation is a reasonable follow-up using the
  same student_badges data.
- The agenda is teacher-only; a student/parent version would reuse the
  same `Agenda` component against their own scoped queries.
- Search is client-side substring matching after an RLS-scoped fetch,
  fine at tuition scale (dozens of students/items) but wouldn't scale to
  a school-sized deployment without moving to server-side full-text
  search.

## Known limitations (Stage 8)

- Only 4 question types (MCQ, true/false, fill-in-blank, numerical) —
  all auto-gradable by exact/numeric match. No image-based or
  open-ended questions, which would need manual teacher grading.
- No badges/achievements beyond XP + streak — section 34's certificates
  and named achievements aren't built.
- A test can be attempted only once; no multi-attempt or review-after
  mode.
- Practice mode pulls from all the student's enrolled classes at once
  rather than letting them pick a subject first.

## Known limitations (Stage 7)

- In-app only. Email/SMS/WhatsApp channels need real provider credentials
  — the `notifications` table is structured so a `channel` + `sent_at`
  pair could be added without reshaping anything, same pattern as the
  payment adapter.
- No push notifications (would need a service worker + browser
  permission flow).
- The bell polls once on page load, not real-time — a live update would
  need Supabase Realtime subscriptions.

## Known limitations (Stage 6)

- Payments run through the mock adapter. Real card/UPI needs Razorpay
  credentials in `.env.local` and a Razorpay adapter implementing the
  existing interface.
- Fee cycles are generated on demand by the teacher, not automatically at
  month end — section 29's automatic reminder needs a scheduled job.
- No notifications yet: a parent isn't told a fee is due, they have to
  open the dashboard.
- Parent phone OTP still requires a configured SMS provider; email is the
  practical default until that's set up.

## Known limitations (Stage 5)

- Assignments are free-text response only. Section 18's MCQ, fill-in-blank,
  numerical, and file-upload types aren't built, so nothing is
  auto-graded yet.
- Doubts are text only — no photo upload, drawing, or voice reply.
- The student dashboard shows the next incomplete topic across all their
  classes rather than resolving "today's" class against the calendar.
- The parent dashboard's homework total counts all assignments visible to
  that parent rather than scoping per-child-per-class, which is only
  correct while a child is in a single class.
- No notifications yet (section 30) — a parent won't be told when a grade
  lands; they have to open the dashboard.

## Known limitations (Stage 4)

- Enrollment requires the student to have signed up already; there is no
  invite-by-email flow that provisions an account.
- A parent account is created at signup but nothing yet links a parent to
  a child — `parent_students` has no UI, so the parent dashboard can't be
  built until that exists.
- Attendance is recorded manually. Master prompt section 25 wants it
  captured automatically when a student joins a live class, which depends
  on the classroom stage.
- The dashboard queries per class in a loop, which is fine at tuition
  scale (a handful of classes) but would want a single aggregate query if
  a teacher ever ran dozens.

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

## What's left

Voice-controlled navigation (Stage 14) is built and its core logic
verified with real command tests. In-test voice control (reading
questions aloud, answering by voice, voice-submit) is the natural next
piece if you want the fullest version of the spec's demo scenario.

Beyond that, same status as before:

- **Real payments** — mock adapter fully wired and tested; a Razorpay
  adapter is a contained follow-up whenever you want it (deprioritized
  by your own call, not blocked).
- **WhatsApp / email fee reminders** — both built and ready; WhatsApp
  needs a Meta billing method attached before it'll send anything, email
  via Resend is live and working.

Everything else from the original master prompt that's buildable
without a third-party account has been built: full auth for all three
roles, class creation, automatic lesson planning with adaptive
rescheduling, materials, attendance, assignments, doubts, fee cycles,
mock payments, in-app + WhatsApp + email notifications, a shared
question bank powering tests and practice/games, XP, badges with
downloadable certificates, a read-only admin panel, calendar, search,
CI/CD, live video + a collaborative whiteboard, a real design system
with working sign-out, and voice-controlled navigation. Every migration
was executed against a real running Postgres database as part of
building it, and every piece of pure logic (RLS policies, payment
guards, the voice intent parser) was actually run against real test
cases rather than only read for correctness — that discipline caught
and fixed several real bugs along the way that all looked completely
correct on inspection and only surfaced once actually tested.
