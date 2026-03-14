# Carelum – Complete Testing Guide

Use this single guide to test the entire Carelum platform: environment, database, auth, profiles, sessions, LIVE monitoring, emergency, child assistant, payments (4.5), interviews (4.6), and admin.

---

## 1. Environment & Setup

### 1.1 Frontend env (`.env` at project root)

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_URL` (e.g. `http://localhost:8000` or your backend URL)
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (Stripe publishable key for payment sheet)

Example:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.5:8000
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

### 1.2 Backend env (`backend/.env`)

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_JWT_SECRET`
- `STRIPE_SECRET_KEY` – Stripe secret API key
- `STRIPE_WEBHOOK_SECRET` – Stripe webhook signing secret
- `DAILY_API_KEY` – Daily.co REST API key (for interview video rooms)
- `SUPABASE_SERVICE_ROLE_KEY` (optional but recommended for payments/payouts)
- `EMERGENCY_PHONE_NUMBER` (optional; default 911)

Example:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
DAILY_API_KEY=your_daily_api_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 1.3 Database schema

- In Supabase Dashboard → **SQL Editor**, run **`scripts/create-supabase-schema.sql`** once.
- This file is the single source of truth; it includes sessions (with `payment_status`, `estimated_amount`, and all statuses), `payment_methods`, `payments`, `sitter_accounts`, `payouts`, `interviews`, and RLS. No separate migration script is needed.

### 1.4 Verify database & backend

**Optional – verify tables:**

```bash
./scripts/verify-database-sync.sh
# Or:
cd backend && source venv/bin/activate && python3 ../scripts/test-database-crud.py
```

**Start backend:**

```bash
cd backend
source venv/bin/activate  # or: venv\Scripts\activate on Windows
uvicorn app.main:app --reload --port 8000
```

Expect: `✅ Supabase client initialized` and `Uvicorn running on http://127.0.0.1:8000`.

**Health check:**

```bash
curl http://localhost:8000/health
```

Expect: `{"status":"healthy","service":"carelum-api"}`.

**Start app:**

```bash
npm start
```

Open on device/emulator.

---

## 2. Auth & Roles

### 2.1 Register as parent

1. Open app → **Register**.
2. Sign up with email, password, display name; choose role **Parent**.
3. **Expect:** Account created, land on parent home with name visible; user in Supabase `users` table.

### 2.2 Register as sitter

1. Log out (or use another device).
2. Register with a different email and role **Babysitter / Sitter**.
3. **Expect:** Profile stored as sitter; display name and role correct.

### 2.3 Login

1. Log in as parent → parent home (e.g. Book Sitter).
2. Log out; log in as sitter → sitter home (e.g. session requests).
3. **Expect:** Correct home and menu per role.

### 2.4 Admin

1. Create admin (e.g. set `role = 'admin'` in Supabase `users` for a test user).
2. Log in as admin.
3. **Expect:** Admin dashboard (Users, Sessions, Verifications, etc.).

---

## 3. Profile & Children

### 3.1 Parent profile

1. As **parent**, open **Profile**.
2. **Expect:** Display name, email, role; editable and syncing to Supabase.

### 3.2 Add a child (parent)

1. As parent, go to **Profile** (or Children / Add child).
2. Add child: name, date of birth; **emergency fields**: emergency contact name/phone, doctor name/phone, allergies, notes.
3. Save.
4. **Expect:** Child in list and in Supabase `children` table.

### 3.3 Child instructions (parent)

1. Open child → **Instructions** (or Edit instructions).
2. Fill Feeding, Sleep/nap, Medication, Allergies, Emergency contacts.
3. Save.
4. **Expect:** Instructions saved; visible when editing.

### 3.4 Sitter profile & verification

1. As **sitter**, open **Profile** (or Profile setup).
2. Complete profile (bio, hourly rate, city, etc.); submit for verification if applicable.
3. **Expect:** Profile saves; verification status shown (e.g. Pending / Under review).

---

## 4. Sessions – Request & Accept

### 4.1 Parent: Create session request

1. As **parent**, go to **Search** (or Book Sitter).
2. Choose scope (Invite / Nearby / City / Nationwide). If Invite, select a sitter.
3. Select child, date/time, location, rate, etc.; submit.
4. **Expect:** “Session requested”; session in Activities/Upcoming; row in Supabase `sessions` with `status = 'requested'`.

### 4.2 Sitter: See and accept request

1. As **sitter**, open **Notifications** or **Session requests** (or Home).
2. **Expect:** Only verified sitters see requests (or per your app rule).
3. Open a **requested** session and **Accept**.
4. **Expect:** With payment flow: status becomes `payment_pending`, `estimated_amount` set; parent notified. Without payment flow: status “accepted” / upcoming.

### 4.3 Session timeline

1. As **parent**, open the session → **Session timeline**.
2. **Expect:** Events like “Session requested”, “Session accepted” with times.
3. As **sitter**, open same session; **Expect:** Same timeline (no admin-only events).

### 4.4 Cancel session (parent or sitter)

1. As parent or sitter, open a requested/accepted (non-completed) session.
2. Cancel (with reason if required).
3. **Expect:** Status → cancelled; “Session cancelled” in timeline; `cancelled_at`, `cancelled_by`, `cancellation_reason` in DB.

---

## 5. LIVE Session – Start & Monitoring

### 5.1 Sitter: Start session

1. As **sitter**, open the **accepted** (or **booked**, after payment) session.
2. Tap **Start Session**.
3. **Expect:** Status → **active (LIVE)**; “Session started” in timeline; parent notified.

### 5.2 Sitter: Enable monitoring

1. On **LIVE** session as sitter, turn **Monitoring** ON.
2. **Expect:** “Monitoring enabled” in timeline; parent sees monitoring status (e.g. ACTIVE, map if implemented).

### 5.3 Parent: See LIVE session

1. As **parent**, open the same session.
2. **Expect:** Status “LIVE”; timeline shows “Session started” and “Monitoring enabled”; map/cry indicator if implemented.

### 5.4 Emergency button (LIVE only)

1. As **parent**, on **LIVE** session, tap **red Emergency** button → bottom sheet.
2. **Expect:** Options: Call Sitter, Call Emergency, Call Child Emergency Contact; tap logs event and opens dialer (or “Number not available”).
3. As **sitter**, tap Emergency → **Expect:** Call Parent, Call Child Emergency Contact, Call Doctor, Call Emergency Services; same behavior.
4. **Safety:** Set session to completed or open non-active session → **Expect:** Emergency button hidden.

### 5.5 Child Assistant (during session)

1. As **parent** or **sitter**, on **LIVE** (or accepted) session, open **Child Assistant** (chat bubble or “Ask about child”).
2. Use quick prompts: Allergies, Feeding, Sleep, Medicine, Emergency contacts.
3. **Expect:** Answers from child profile/instructions.
4. Type a custom question.
5. **Expect:** Rule-based answer; no server error.

---

## 6. Home Screen Bubbles

### 6.1 Parent home

- **Right bubble (chat):** Child Assistant. No active/upcoming session → alert. With active/upcoming → opens Child Assistant for that session.
- **Left bubble (phone):** Emergency. No active session → alert. With active session → emergency bottom sheet.

### 6.2 Sitter home

- Same: right = Child Assistant; left = Emergency; same rules.

---

## 7. End Session & Reviews

### 7.1 Sitter: Request end (optional)

1. On **LIVE** session as sitter, use **Request Session End** (if available).
2. **Expect:** “Sitter requested end” in timeline; parent notified.

### 7.2 Parent: End session

1. As **parent**, open **LIVE** session → **End Session**.
2. **Expect:** Status → completed; “Session completed” in timeline; “Rate sitter” on completed card.

### 7.3 Parent: Rate sitter (review)

1. On completed session, tap **Rate sitter**; choose rating (e.g. 1–5).
2. **Expect:** Success; review in `reviews` table.

### 7.4 Sitter: View completed session

1. As **sitter**, open **completed** session.
2. **Expect:** Duration, “Session completed by parent”; no End Session button; earnings summary if shown.

---

## 8. Session Report

### 8.1 Parent: View / download report

1. As **parent**, open **completed** session → **Download report** or “View report”.
2. **Expect:** Summary (session id, start/end, monitoring duration, cry alerts, GPS points); no server error.

### 8.2 Sitter: View report

1. As **sitter**, open same completed session → “View report” if available.
2. **Expect:** Same report data (read-only).

---

## 9. Admin

### 9.1 Sessions dashboard

1. Log in as **admin** → **Sessions** (or Admin → Sessions).
2. **Expect:** List of sessions; status, monitoring on/off, last location/audio; **Disable monitoring**, **Force end** for active; **View session report** for any.

### 9.2 Force end & disable monitoring

1. Pick **active** session → **Disable monitoring** → confirm.
2. **Expect:** Monitoring off; timeline may show “Monitoring disabled”.
3. **Force end session** → confirm.
4. **Expect:** Session completed; timeline shows completion.

### 9.3 Session timeline (including emergency)

1. As admin, open session where emergency was used.
2. Open **Session timeline**.
3. **Expect:** “Emergency contact called” with time; full timeline including admin actions.

### 9.4 Reviews moderation

1. In admin, open **Reviews** (or equivalent).
2. **Expect:** Can **delete** inappropriate reviews (admin delete policy on `reviews`).

### 9.5 Child Assistant (admin)

1. As **admin**, call child-assistant API (e.g. from admin tool).
2. **Expect:** **403** or “Admins cannot use the child assistant”.

---

## 10. Notifications & Alerts

### 10.1 Parent notifications

1. As **parent**, open **Notifications**.
2. **Expect:** Alerts (session accepted, started, completed, sitter requested end, etc.); badge/count if implemented; tap marks as read.

### 10.2 Sitter notifications

1. As **sitter**, open **Notifications**.
2. **Expect:** Session requests, reminders; same read/badge behavior.

### 10.3 Cry detection & GPS (if implemented)

- **Cry:** During LIVE session with monitoring, trigger cry → “Cry detected” in timeline; parent sees alert; `last_audio_signal_at` updated.
- **GPS:** Sitter sends location during LIVE → parent/admin see last location; `last_location_at` updated.

---

## 11. Payments – 4.5

### 11.1 Parent payment setup

1. As **parent**, **Profile → Payment Methods** → **Add Card / Setup payment**.
2. **Expect:** Backend creates Stripe customer (`payment_methods.stripe_customer_id`); UI confirms setup.

### 11.2 Sitter payout setup (Stripe Connect)

1. As **sitter**, **Profile → Payout Account** → **Connect Bank Account**.
2. **Expect:** Backend creates Stripe Connect Express account; browser opens Stripe onboarding; after completion, `sitter_accounts.onboarding_status` can become `completed`.

### 11.3 Prepaid booking: accept → payment_pending

1. Parent creates session request (Invite, that sitter).
2. As **sitter**, **Accept** (must have completed payout onboarding).
3. **Expect:** `sessions.status = 'payment_pending'`, `payment_status = 'payment_pending'`, `estimated_amount` set.
4. As **parent**, open session detail: **Expect** “Session cost”, estimated price, **Confirm and Pay** button.

### 11.4 Confirm and Pay (PaymentIntent)

1. Parent taps **Confirm and Pay**.
2. **Expect:** Frontend calls `POST /api/payments/create-intent`; backend creates PaymentIntent (manual capture), returns `clientSecret`; with Stripe Payment Sheet integrated, parent completes payment in app.
3. In Stripe Dashboard: PaymentIntent created. In Supabase: `payments` row with `session_id`, `amount_estimated`, `stripe_payment_intent_id`.

### 11.5 Webhook: session paid & booked

1. Configure Stripe webhook: URL `https://<backend>/api/payments/webhook`, event `payment_intent.succeeded`; set `STRIPE_WEBHOOK_SECRET` in backend `.env`.
2. After successful payment (e.g. via Payment Sheet): **Expect** `payments.payment_status = 'authorized'`; `sessions.status = 'booked'`, `sessions.payment_status = 'paid'`.

### 11.6 Start session only when paid

1. As **sitter**, try **Start Session** when `payment_pending` → **Expect:** “Parent must pay before the session can start”.
2. After webhook (booked/paid), tap **Start Session** again → **Expect:** Status → active (LIVE).

### 11.7 How payment works (prorated, safe)

- **Before session:** Parent authorizes the **estimated** amount (Confirm and Pay). Funds are held (not captured).
- **When session ends:** Parent (or admin) ends the session. Backend computes **prorated** amount = hourly rate × time actually used (from `started_at` to end), with a minimum of 15 minutes. That amount is **captured** automatically; the sitter is paid (minus platform fee). If the parent ends early, they pay only for time used.
- **Capture:** Triggered automatically when the session is ended. Optional: `POST /api/payments/capture` can still be called manually (e.g. by admin) for a completed session.

### 11.8 Capture & payout after completion

1. Parent **End Session** → session status → completed; backend sets `total_amount` (prorated) and **auto-captures** the payment.
2. **Expect:** PaymentIntent captured for `total_amount`; `payments.payment_status = 'captured'`, `amount_final` set; Stripe Transfer to sitter Connect account; `payouts` row with `payout_status = 'processing'` (platform fee applied, e.g. 15%). Parent sees success: "You were charged Rs. X.XX for the time used."

---

## 12. Interviews & Video Calls – 4.6

### 12.1 Schedule interview (parent)

1. As **parent**, create session request (Invite, with sitter); while status is **requested**, open session detail.
2. Tap **Schedule Interview**.
3. **Expect:** Backend creates Daily.co room (if `DAILY_API_KEY` set), inserts `interviews` row, sets `sessions.status = 'interview_scheduled'`, notifies sitter; parent sees **Upcoming Interview** with date/time and **Join Video Call**.

### 12.2 Sitter: Upcoming interview

1. As **sitter**, open same session (interview_scheduled).
2. **Expect:** **Upcoming Interview** card, date/time, **Join Video Call** (opens `meeting_link`).

### 12.3 Join video call

1. Parent and sitter tap **Join Video Call** at scheduled time; link opens (browser or in-app).
2. Validate room creation and link; full in-app video optional.

### 12.4 Mark interview completed

1. Call `POST /api/interviews/{interview_id}/complete` (from app or tool).
2. **Expect:** `interviews.status = 'completed'`; `sessions.status = 'interview_completed'`.

### 12.5 Sitter accepts after interview

1. As **sitter**, open session with `interview_completed`; **Expect** Accept/Decline with message that interview is done.
2. Tap **Accept** (onboarding must be completed).
3. **Expect:** `sessions.status = 'payment_pending'`, `estimated_amount` set; flow continues with **Payments** (section 11): parent Confirm and Pay → webhook → booked → sitter Start Session → capture & payout.

---

## 13. API Quick Tests (optional)

```bash
# Health
curl http://localhost:8000/health

# List sessions (need TOKEN from login)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/sessions

# List children
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/children

# Get session by ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/sessions/<session-id>
```

---

## 14. Complete Feature Checklist

- [ ] **Setup:** Env vars, run `create-supabase-schema.sql`, backend + app running.
- [ ] **Auth:** Register parent, register sitter, login, role correct; admin if used.
- [ ] **Profile:** Parent profile; add child with emergency fields; child instructions; sitter profile & verification.
- [ ] **Session:** Parent creates request → sitter accepts → timeline shows requested + accepted (or payment_pending with payment flow).
- [ ] **LIVE:** Sitter starts session → monitoring on → timeline; parent sees LIVE and monitoring.
- [ ] **Emergency:** Red button only when LIVE; parent/sitter options; log + dial.
- [ ] **Child Assistant:** Quick prompts + custom question; answers from child/instructions.
- [ ] **Home bubbles:** Parent & sitter: chat = Child Assistant, phone = Emergency; correct behavior when no session.
- [ ] **End session:** Parent ends → completed; sitter sees completed, no end button; parent can rate sitter.
- [ ] **Report:** Parent/sitter can view session report for completed session.
- [ ] **Admin:** Sessions list, force end, disable monitoring, view report, timeline with emergency, review delete, child assistant 403.
- [ ] **Payment (4.5):** Parent Payment Methods → Add Card; sitter Payout Account → Connect Bank. Sitter accepts → payment_pending; parent Confirm and Pay → webhook → booked; sitter starts only when paid; on completion → capture + sitter payout.
- [ ] **Interview (4.6):** Parent schedules interview on requested session → both see Upcoming Interview + Join; after call mark complete → interview_completed; sitter accepts → payment_pending → parent pays → booked.

---

## 15. Troubleshooting

| Issue | What to check |
|-------|----------------|
| Tables missing / CRUD fails | Run `scripts/create-supabase-schema.sql` in Supabase SQL Editor. |
| Permission denied (RLS) | Policies are in the same schema file; ensure RLS is enabled and policies exist. |
| API 500 / connection refused | Backend running; `backend/.env` has correct Supabase (and Stripe/Daily if used) keys. |
| Frontend empty / loading forever | Console errors; `EXPO_PUBLIC_API_URL` correct; backend reachable; clear cache. |
| Payment 503 / “Stripe not configured” | Set `STRIPE_SECRET_KEY` in `backend/.env`. |
| Webhook not updating session | `STRIPE_WEBHOOK_SECRET` set; endpoint URL correct; event `payment_intent.succeeded` selected. |
| Interview link placeholder | Set `DAILY_API_KEY` in `backend/.env` for real Daily.co rooms. |

---

## 16. Summary

After following this guide you will have verified:

- Database schema (single file: `create-supabase-schema.sql`), env, and services.
- Auth, profiles, children, and instructions.
- Full session lifecycle: request → accept (or interview → accept) → payment (if enabled) → booked → start → LIVE → monitoring, emergency, child assistant → end → review & report.
- Admin: sessions, force end, disable monitoring, reports, timeline, reviews.
- Payments: customer & payout setup, PaymentIntent, webhook, capture, payout.
- Interviews: schedule, join link, complete, accept → payment flow.

If a step fails, note role, screen, error message, and backend status code (4xx/5xx) to fix the app or schema.
