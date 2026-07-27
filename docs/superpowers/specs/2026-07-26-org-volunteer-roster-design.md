# Org-side Volunteer Roster — Design

## Purpose

Give an org logged into the R-Commons org view a way to browse and filter the
volunteers relevant to them: people who've already signed up for one of the
org's shifts, plus people who've opted into platform-wide discovery. Clicking
a volunteer opens a read-only profile so the org can decide who to reach out
to.

This is a **demo-data build**, following the same phased pattern already used
throughout R-Commons (profile, hours, opportunities): the UI, data shapes, and
interactions are built out fully against static in-memory arrays now; wiring
to a real `volunteer` table/API is separate, later work (see "Out of scope").

## Where it lives

New nav item **"Volunteers"** in the existing org-side sidebar section
(`#nav-view-org`, dashboard.html:119-137), alongside "Shifts & signups" and
"Calendar." New page container `page-org-volunteers`, registered in the
`PAGES` array in nav.js:7 (and `MOB_MORE_PAGES` if the org view has a mobile
equivalent — check current mobile nav behavior for org view before assuming).

## Data model (demo)

New `DEMO_VOLUNTEERS` array in data.js. Each entry:

```js
{
  id:            'vol-1',
  name:          'Maria Gonzalez',
  initials:      'MG',
  phone:         '8285551234',
  skills:        ['Cooking / Food prep', 'Driving / Transport'],
  classes:       ['Sustainer'],
  availability:  { /* same shape as the profile page's avail-grid state */ },
  discoverable:  false,
  hoursTotal:    42
}
```

`DEMO_SIGNUPS` (org.js) currently identifies a volunteer by a free-text
`volunteerName` string. This design threads a `volunteerId` through each
signup entry instead, joining to `DEMO_VOLUNTEERS.id`. This is a small change
to existing demo data, made now because it mirrors the foreign-key
relationship the real schema will eventually have — name-string matching is
fragile (breaks on duplicate names) and would just be thrown away later
anyway.

~8-10 demo volunteers, with a mix of:
- some who have signup history against the existing `DEMO_SHIFTS` (so they
  appear "affiliated" via real derived data, not a hardcoded flag)
- some with no history but `discoverable: true`
- varied skills and availability so the filters have something to do

## Roster membership

A volunteer appears in an org's roster if **either**:
1. They have ≥1 signup (any status) against a shift belonging to one of this
   org's events, **or**
2. Their profile has `discoverable: true`.

This is an explicit union, not a single flag — it's the mechanism that keeps
the roster from showing every platform volunteer to every org by default.
Discoverability is meant to be set during onboarding (existing onboarding.html
flow) as a later addition; for this build the demo data just seeds the field
directly.

## Metric: no "affiliated" badge

Earlier framing called this an "Affiliated / Discoverable" badge; that's a
misnomer for what's actually useful here. Instead, each row shows a derived
metric: **hours at this org / total hours** (e.g. "12 hrs here · 42 hrs
total"). Hours-at-org is computed by summing shift durations
(`DEMO_SHIFTS.startTime`/`endTime`) for this volunteer's confirmed signups
against this org's shifts. Total hours is the stored `hoursTotal` field. A
volunteer with 0 hrs here but `discoverable: true` still shows up — the metric
communicates relevance without gating visibility a second time.

## Page layout

- `page-header`: title "Volunteers", sub "People who've helped or want to
  help with your org"
- `filter-row` (reuse existing `.filter-row`/`.filter-select` CSS):
  - skill filter — multi-select using the existing skill-chip toggle pattern
    from onboarding.html, adapted for filtering. **OR-match**: a volunteer
    matches if they have *any* selected skill (typical "find someone who can
    do X or Y" search behavior, not "must have all of X and Y")
  - availability-day filter — single-select day, matches volunteers with that
    day marked open in their availability grid
  - filter-count (existing pattern, e.g. "6 volunteers")
- list (reuse `.opp-list` / `.opp-item` CSS) — one row per volunteer:
  - avatar + name
  - skill chips (first few, "+N more" if truncated)
  - hrs-here / hrs-total metric
  - phone number
  - availability summary (e.g. "Available Sat, Sun")

## Volunteer profile panel

Row click opens the existing centered-overlay modal pattern
(`.commit-panel`/`.commit-modal`, components.css:238-246 — the same mechanism
`openShift`/`openRSVP`/`openLogHours` already use), titled "Volunteer
profile." Content, read-only:

- avatar, name, character class chips, skill chips, bio — same fields as the
  self-service "My profile" page (dashboard.html:410-438), rendered read-only
- availability grid (reuse the existing avail-grid rendering, non-interactive)
- phone
- hrs-here / hrs-total metric
- list of this org's shifts the volunteer has signed up for, with status
  (CONFIRMED/PENDING/CANCELED)

`openVolunteerProfile(id)` / `closeVolunteerProfile()` go in modals.js next to
the other panel open/close functions, matching existing convention.

## File organization

org.js is already 874 lines and scoped to event/task/shift/signup management.
Rather than growing it further, roster data/render/filter logic goes in a new
`js/roster.js`, loaded after `org.js` in dashboard.html's script list. Panel
open/close stays in modals.js per existing convention. No new CSS files —
everything reuses existing classes (`skill-chip`, `filter-select`, `opp-item`,
`avail-grid`, `commit-panel`/`commit-modal`, `tag-*`).

## Out of scope (this build)

- Real `volunteer` DB table, auth, and API — profile/roster data stays in
  `DEMO_VOLUNTEERS`, matching the phased pattern already used for
  profile/hours/opportunities elsewhere in R-Commons.
- Reconciling the old Airtable `Drivers` and `Volunteer Applications` tables
  into a unified `volunteer` schema — noted as a known future migration, not
  part of this page.
- Reconciling the old Airtable skills taxonomy (`Supplies Distribution`,
  `Data Entry`, etc.) with the current onboarding skill-chip taxonomy — the
  demo data and filters use the existing onboarding taxonomy only.
- Onboarding-flow UI for the `discoverable` opt-in toggle — demo data seeds
  the field directly; wiring an actual toggle into onboarding.html is
  separate follow-up work.
- Mobile-specific layout for the roster (will follow whatever pattern the
  existing org-shifts page uses, if any — needs a quick check at
  implementation time rather than a design decision here).
