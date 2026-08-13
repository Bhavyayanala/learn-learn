# LearnNest — Stage 1: Foundation (Auth + Core Schema)

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

**Not yet built** (later stages): lesson planning engine, material upload,
live classroom, whiteboard, games, assignments, tests, fee/payment
management, notifications. See the project's master prompt for the full
roadmap and build order.

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
SQL Editor, and paste the contents of `supabase/migrations/0001_core_schema.sql`
then `supabase/migrations/0002_handle_new_user.sql`, in that order.

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
lib/supabase/
  client.ts               browser Supabase client
  server.ts               server + admin Supabase clients
middleware.ts             session refresh + role-based route protection
supabase/migrations/      SQL migrations (run in numeric order)
```

## Stage 2 (next)

- Teacher: create a tuition class (grade, subject, classes/month, duration, fee)
- Material upload (PDF/PPT/images) to Supabase Storage
- Automatic lesson plan generation from uploaded syllabus
- Teacher review/edit UI for the generated plan
