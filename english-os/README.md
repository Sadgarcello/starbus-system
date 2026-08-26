# Khawaja Club

**Khawaja Club** is the academy app (yellow / white / black) — not a fixed English course. Courses and lessons can change; the **Activity Engine** stays.

```
Teacher creates student
  → creates lesson
    → creates activity (speaking | reading | writing | listening)
    → assigns to student
    → student completes
    → teacher reviews
    → XP / progress updates
```

## Stack

- React + Vite + TypeScript
- Tailwind CSS v4
- Supabase (Auth + Postgres + RLS)
- TanStack Query
- React Router
- React Hook Form + Zod

## Local setup

From the **starbus-system** repo root:

```bash
cd english-os
cp .env.example .env
# fill VITE_SUPABASE_URL (https://….supabase.co) and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## Go-live checklist

1. **Supabase project** dedicated to Khawaja Club (do not mix with other apps).
2. Run **all** SQL migrations in order in the SQL Editor (see below). Include **`0013_mvp_hardening.sql`** — required for security.
3. **Authentication → Providers → Email**
   - Enable sign up
   - For Studio “Create student”: turn **Confirm email OFF** (or students must confirm before the teacher can activate them)
4. Create the **first user** (becomes **active admin** automatically).
5. Optional: **Database → Replication** → enable `profiles` for live Approvals badges.
6. Deploy the frontend (Vercel / Netlify). This repo includes SPA fallbacks:
   - `vercel.json` (Vercel)
   - `public/_redirects` (Netlify)
7. Set production env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`.
8. Configure Web Push (see **Web Push** section below).
9. Smoke test: register → pending → admin approve → student login → attendance → speaking practice → write task.

### Production Auth tips

- Keep **Confirm email** off for classroom MVP, or teach students to confirm before Approvals.
- Never put the **service_role** key in the frontend.
- Rotate anon keys if they were ever committed to a public repo.

## Supabase migrations (run in order)

1. `0001_init.sql`
2. `0002_approval.sql`
3. `0003_attendance_avatars.sql`
4. `0004_member_lock.sql`
5. `0005_hobbies.sql`
6. `0005b_hobby_grants_fix.sql` (if hobbies grants failed earlier)
7. `0006_speaking_sessions.sql`
8. `0006b_speaking_formats_teacher_write.sql` (if teachers could not edit formats)
9. `0007_speaking_votes.sql`
10. `0008_reading_books.sql`
11. `0009_writing_tasks.sql`
12. `0010_reading_progress_attendees.sql`
13. `0011_listening_picks.sql`
14. `0012_social_profiles.sql`
15. **`0013_mvp_hardening.sql`** ← signup hardening, progress freeze, streaks, XP on review
16. **`0014_notifications_push.sql`** ← in-app notifications + Web Push subscriptions + event triggers
17. **`0015_notification_test.sql`** ← admin notification test tools in Settings

## Web Push (lock-screen alerts)

Khawaja Club can notify users **even when the app is closed** (Android PWA; iPhone requires **Add to Home Screen** on iOS 16.4+). Push is sent by a **Vercel API route** (`/api/send-push`) — no Supabase CLI or Edge Function required.

### One-time setup

1. Run migrations **`0014_notifications_push.sql`** and **`0015_notification_test.sql`** in the Supabase SQL Editor.
2. Generate VAPID keys (keep private key secret):
   ```bash
   npx web-push generate-vapid-keys
   ```
3. **Vercel → Project → Settings → Environment Variables** (Production):

   | Name | Value |
   |------|--------|
   | `VITE_VAPID_PUBLIC_KEY` | public key from step 2 |
   | `VAPID_PUBLIC_KEY` | same public key |
   | `VAPID_PRIVATE_KEY` | private key from step 2 |
   | `VAPID_SUBJECT` | `mailto:admin@khawajaclub.test` |
   | `PUSH_DISPATCH_SECRET` | long random string (save for step 4) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → **service_role** (server only) |
   | `VITE_SUPABASE_URL` | already set |

4. **Redeploy** production on Vercel (env vars apply after rebuild).
5. **Supabase SQL Editor** — run `supabase/scripts/setup-push-vercel.sql` (replace `YOUR_PUSH_DISPATCH_SECRET` with the same string from step 3).

Direct notifications only — **not email**. The `mailto:` subject is a Web Push technical ID.

<details>
<summary>Alternative: Supabase Edge Function (optional)</summary>

Deploy `supabase/functions/send-push` and set `functions_base_url` to `https://YOUR_PROJECT_REF.supabase.co/functions/v1` instead of the Vercel `/api` URL.

</details>

### What triggers notifications

| Event | Who gets notified |
|-------|-------------------|
| New student registers | Admins |
| Teacher opens speaking day | Active students |
| New writing task | Active students |
| New reading book | Active students |
| Activity assigned (Studio) | That student |
| Writing submitted | Teachers + admins |
| Assignment submitted | Teachers + admins |
| Listening pick shared | Teachers + admins |

### User steps (phone)

1. Open Khawaja Club in Chrome (Android) or Safari (iPhone).
2. **Add to Home Screen** (required on iPhone for background push).
3. Open the app → tap **Enable notifications** on Profile or Settings → **Allow**.

In-app inbox: header **bell** → `/notifications`.

### Admin: test notifications

After migration **0015**, admins see **Notification testing** in **Settings**. Each test uses the same database + push pipeline as real alerts. Titles are prefixed with **TEST** and the body says *no action needed*.

| Test button | Who receives it |
|-------------|-----------------|
| New join request | Admins |
| Writing / Speaking / Reading / Assignment | Active students |
| Writing / Assignment / Listening submission | Teachers + admins |

**Run all tests** sends every scenario at once (confirm dialog first).

Lock-screen push for tests works automatically once the Vercel + SQL setup above is complete.

## How accounts work

| Path | Result |
|------|--------|
| First signup on empty DB | Active **admin** |
| `/register` | Pending **student** → admin Approves |
| Teacher Studio “Create student” | Pending signup → `teacher_provision_student` activates them |
| Admin Lock | Student sees pending/locked screen until unlocked |

Public signup **cannot** self-approve or become teacher via metadata.

## Scripts

```bash
npm run dev       # local
npm run build     # production
npm run preview   # preview build
npm run typecheck
```

## Architecture

- **Content:** `courses` / `lessons` (swappable)
- **OS core:** `activities` → `assignments` → `submissions` → `reviews`
- Skill modules filter on `activity.type`, plus dedicated speaking / reading / writing / listening tables
- Streak updates from attendance marks; XP updates when a teacher reviews an assignment

## Brand

- Accent yellow `#F5C518`
- Ink black `#111111`
- Paper white / soft off-white
- Logo + favicons in `public/`
