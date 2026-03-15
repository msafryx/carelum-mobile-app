# Session ending: parent vs sitter

How ending a live session works for parents and sitters.

## Who can end the session


| Role       | Can end session? | How                                                                                        |
| ---------- | ---------------- | ------------------------------------------------------------------------------------------ |
| **Parent** | Yes              | Taps "End Session" → confirm → backend charges for time used → session set to `completed`. |
| **Sitter** | No               | Taps "Request to end session" → parent is notified; **parent** must end from their app.    |
| **Admin**  | Yes              | Can force-end from admin sessions (no payment step).                                       |


## Parent flow

1. On **Session Details**, when status is `active`, parent sees **"End Session"** (Session Controls at bottom).
2. Helper text: *"When you end the session, you'll be charged only for the time used (prorated)."*
3. On tap → confirmation: *"You will be charged for the time used (or full amount). Payment must succeed before the session ends. Continue?"*
4. On confirm → `completeSession(sessionId)` is called → backend:
  - Computes time used (from `started_at` to now), prorated amount (min 0.25 hr, min charge 0.50).
  - Charges parent (Stripe); if payment fails, session is **not** ended and user sees "Payment required" / add payment method.
  - On success: sets `status: completed`, `completed_at`, `ended_at`, creates `session_completed` event and alert.
5. Parent sees success message with amount charged (e.g. "You were charged Rs. X for the time used") and is taken back.

**API:** `POST /api/sessions/{id}/end` (parent or admin only).

### Demo mode (no real payment)

To test ending a session without Stripe or a saved card, set in backend `.env`:

```bash
DEMO_SKIP_PAYMENT_ON_END=1
```

Restart the backend. When the parent taps **End Session**, the backend will skip the real charge and complete the session (a demo payment row is stored with status `captured`). **Do not use in production.**

## Sitter flow

1. On **Active Session**, sitter sees **"Request to end session"** (not "End Session").
2. Subtext: *"Parent will be notified and will end the session from their app."*
3. On tap → confirmation: *"The parent will be notified. Only the parent can actually end the session and complete payment. Continue?"* → "Send request".
4. On confirm → `requestSessionEnd(sessionId)` is called → backend:
  - Creates timeline event `sitter_requested_end`.
  - Sends alert to **parent**: "Sitter requested to end session" / "Your sitter has requested to end the session. Please review and decide whether to extend or finish."
  - Session **stays** `active`; no payment, no status change.
5. Sitter sees: *"The parent has been notified. They will end the session from their app when ready."*

**API:** `POST /api/sessions/{id}/request-end` (sitter only, assigned to that session).

**Backend:** The parent alert is created with the Supabase **service role** client so RLS does not block it. Set `SUPABASE_SERVICE_ROLE_KEY` in the backend `.env`; otherwise the parent will not receive the "Sitter requested to end session" notification.

## Summary

- **Only the parent** (or admin) can actually end the session and trigger payment.
- **Sitter** can only ask to end; the parent receives an alert and ends from Session Details when ready.
- Backend enforces: sitters get 403 if they call `POST /end`; parents are charged before session is marked completed.

## Frontend

- **Parent:** `app/(parent)/session/[id].tsx` → `handleEndSession` → `completeSession(id)` (from `session.service.ts`).
- **Sitter:** `app/(sitter)/session/[id].tsx` → `handleEndSession` → `requestSessionEnd(id)`; button label "Request to end session" and hint text so it’s clear the parent must end.

