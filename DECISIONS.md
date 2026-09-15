# Decision Log — PlanetPulse

This document records the three key design decisions made during the hackathon build, with reasoning grounded in behavioral science, data integrity principles, and standards compliance.

---

## DP1 — The Nudge: Encouragement, Not Shame

**Decision:** When a user exceeds their weekly CO₂ target, the app shows an encouraging, specific, judgment-free AI-generated message. It does NOT block further logging and does NOT use shame-based language.

**Implementation:** The `/api/nudge` endpoint takes the week's actual category breakdown (e.g., "mostly from one long flight: 112.5 kg") and the target-vs-actual gap, and calls an LLM (OpenAI GPT-4o-mini, with Anthropic Claude as fallback) to generate a 1–2 sentence personalized message. Example output: *"You're at 447% of your weekly target this week, mostly from a flight — that's one big trip that skews the numbers. Try offsetting next week with a few extra vegetarian meals and bus trips."* If the LLM is unavailable, a smart category-aware template is shown instead; the dashboard never breaks.

**Reasoning:** Behavioral research consistently shows that shame-based feedback in habit-change apps increases disengagement and app abandonment. A 2016 study by Pila et al. on fitness apps found guilt-inducing feedback correlated with reduced use after failure events. In contrast, specific, actionable, non-judgmental feedback (the "autonomy support" model from Self-Determination Theory) is significantly more likely to produce sustained behavior change. For a climate app, the real goal isn't punishing people for flying — it's helping them make better aggregate choices over time. A user who feels judged stops logging; a user who feels supported keeps going and accumulates the long-term behavior shift that actually matters.

---

## DP2 — Absurd Input: Confirm-to-Proceed, Not Hard Reject

**Decision:** If a user enters a quantity that exceeds a per-type ceiling (car/bus: 2,000 km; flight: 20,000 km; electricity: 10,000 kWh; meals: 20), the app shows an inline warning dialog asking for confirmation ("That's an unusually large entry — are you sure?") rather than silently accepting it or hard-blocking it.

**Implementation:** On form submit, the quantity is checked against `ABSURD_THRESHOLDS`. If exceeded, a modal-style warning renders within the form with "Yes, log it anyway" and "Cancel" buttons. If the user confirms, the entry is inserted normally. The threshold check does not re-run on confirmation.

**Reasoning:** Two bad alternatives exist. **Silent acceptance** would poison every downstream total and chart — a 500,000 km car trip would dwarf all real data and make the weekly chart meaningless. **Hard rejection** would block legitimate edge cases: a 15,000 km flight from Sydney to London is real and measurable, and refusing to log it removes user agency. The confirm-to-proceed pattern is the canonical UX solution for this class of problem (used by banking apps for large transfers, medical apps for unusual dosages, etc.). It preserves data integrity by catching fat-finger errors while respecting that some genuinely unusual entries are accurate. The thresholds are set conservatively enough that normal use never triggers the warning.

---

## DP3 — The Week: ISO Monday–Sunday with Time-Aware Framing

**Decision:** A "week" in PlanetPulse starts on Monday and ends on Sunday (ISO 8601). Mid-week progress is shown with elapsed-time context: "Tue — Day 2 of 7 · 29% of week elapsed" alongside the progress bar, so users can see whether they're pacing ahead or behind, not just a bare total.

**Implementation:** `lib/week.ts` exports `getWeekStart()` (using ISO day-of-week arithmetic), `getWeekRange()`, and `getWeekProgress()` which computes elapsed days and elapsed percentage. The dashboard progress bar displays both the raw CO₂ total and a pace indicator (a faint vertical line at the expected consumption point for this point in the week). If actual % > expected %, the bar turns amber ("Ahead of pace"). A data attribute `data-testid="week-progress-label"` exposes the formatted label for automated testing.

**Reasoning:** A progress bar without time context is only meaningful on Sunday evening. For a user checking in on Tuesday, seeing "60% of target used" is ambiguous: are they doing great (expected for a Tuesday) or terribly (only 29% of the week has elapsed)? The elapsed-time framing converts a static total into a pacing signal, which is the information that's actually actionable. ISO 8601 Monday-start was chosen because it matches how nearly all weekly planning tools (Google Calendar, Apple Calendar, Notion, Jira) default, and because it avoids the Sunday-start convention that splits weekends across two "work weeks," which would make Friday-to-Sunday trip planning misaligned with the user's mental model.
