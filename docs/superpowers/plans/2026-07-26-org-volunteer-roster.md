# Org-side Volunteer Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the R-Commons org view a "Volunteers" page listing volunteers relevant to the org (signup history or opted into discovery), filterable by skill and availability day, with a read-only profile panel on click.

**Architecture:** Plain-JS, no-build-step static frontend (matches the rest of `webapp/src/main/resources/public/rcommons/`). All data is client-side demo arrays (`DEMO_VOLUNTEERS`, extending the existing `DEMO_SIGNUPS`/`DEMO_SHIFTS` from org.js) — no backend changes. New render/filter logic lives in a new `js/roster.js`; the profile panel reuses the existing centered-overlay modal system (`.commit-panel`/`.commit-modal`) and its open/close functions go in `modals.js` beside the other panels.

**Tech Stack:** Vanilla JS (ES5-style `var`/`function`, no modules, no build step), served as static resources by Spring Boot from `classpath:/public/`. No JS test framework exists in this codebase (`webapp/src/test/` is Java-only) — verification throughout this plan is manual, in a real browser, against the running app. This matches how every other rcommons feature (profile, hours, opportunities, org shifts) was built and verified.

## Global Constraints

- No new CSS files — reuse existing classes from `components.css`/`base.css` (`card`, `filter-row`, `filter-select`, `opp-list`/`opp-item`, `skill-chip`, `role-chip`, `hours-list`/`hours-item`, `avail-grid`, `commit-panel`/`commit-modal`, `tag`/`tag-*`). Only one small new CSS rule is added (Task 4), scoped to the roster's skill-filter chips.
- No new files beyond `js/roster.js`. All other work modifies existing files.
- Demo data only — no calls to `/rcommons/api/*` or `/volunteer/*` from this feature. No new Java code.
- Skill strings used anywhere in demo data or filters must exactly match the taxonomy already defined in `onboarding.html:136-164` (26 strings, listed in Task 4) — do not invent new skill names.
- Character-class strings used in demo data must exactly match keys in the `hoverContent` object in `data.js` (16 strings) — not the mismatched `['Caregiver', 'Builder']` shorthand used in profile.js's fallback demo profile, which is a pre-existing inconsistency out of scope here.
- Run the app with the `run` skill (or `./mvnw spring-boot:run` from `webapp/`, default `server.port=8080`) and verify in a real browser at each checkpoint — do not skip verification steps or mark them done without actually loading the page.

---

### Task 1: Fix `switchView()` crash on entering org view

**Files:**
- Modify: `webapp/src/main/resources/public/rcommons/js/org.js:98-115`

**Interfaces:**
- Produces: `switchView(view)` — unchanged signature, now resilient to missing DOM nodes. Later tasks (and the existing org-shifts/org-calendar pages) depend on this actually completing without throwing.

**Context:** `switchView('org')` (called by the "Org" tab, dashboard.html:31/50) currently sets `.style.display` on `#mob-nav-volunteer`, `#mob-nav-org`, `#mob-more-volunteer`, `#mob-more-org` — none of which exist anywhere in `dashboard.html`. `document.getElementById(...).style` on a missing element throws `TypeError: Cannot set properties of null`, which happens *before* the trailing `navTo(...)` call, so clicking "Org" never actually navigates anywhere. This blocks manually testing the roster page (and the existing org-shifts/org-calendar pages) at all, so it's fixed first.

- [ ] **Step 1: Read the current function to confirm line numbers before editing**

Run: `grep -n "function switchView" -A 18 "webapp/src/main/resources/public/rcommons/js/org.js"`
Expected output starts with `98:function switchView(view) {` and ends with the closing `}` around line 115.

- [ ] **Step 2: Replace the function body with a guarded version**

Replace the full `switchView` function (org.js:98-115) with:

```js
function switchView(view) {
  document.querySelectorAll('.view-switcher-group .tab').forEach(function(t) {
    t.classList.toggle('active', t.dataset.viewBtn === view);
  });

  var isOrg = view === 'org';
  setDisplayIfPresent('nav-view-volunteer', isOrg ? 'none' : '');
  setDisplayIfPresent('nav-view-org',       isOrg ? '' : 'none');

  // Mobile bottom nav + "More" sheet swap the same way the sidebar does —
  // guarded because these ids don't exist yet (no mobile org nav built).
  setDisplayIfPresent('mob-nav-volunteer',  isOrg ? 'none' : 'contents');
  setDisplayIfPresent('mob-nav-org',        isOrg ? 'contents' : 'none');
  setDisplayIfPresent('mob-more-volunteer', isOrg ? 'none' : 'contents');
  setDisplayIfPresent('mob-more-org',       isOrg ? 'contents' : 'none');

  navTo(isOrg ? 'org-shifts' : 'dashboard');
}

function setDisplayIfPresent(id, value) {
  var el = document.getElementById(id);
  if (el) el.style.display = value;
}
```

- [ ] **Step 3: Verify in browser**

Start the app (`run` skill, or `./mvnw spring-boot:run` from `webapp/`), open `http://localhost:8080/rcommons/dashboard.html`, open the browser devtools console, and click the "Org" tab (top of sidebar).

Expected: the page navigates to "Shifts & signups" (the org-shifts page), the sidebar swaps to the org-side nav ("Shift management" section), and there are no errors in the console.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/main/resources/public/rcommons/js/org.js
git commit -m "fix: guard switchView() against missing mobile nav elements

switchView('org') threw before reaching navTo(), so the Org tab never
actually navigated. Blocks org-shifts, org-calendar, and the new
volunteer roster equally."
```

---

### Task 2: Roster page scaffold — nav item, empty page, empty roster.js

**Files:**
- Modify: `webapp/src/main/resources/public/rcommons/dashboard.html`
- Modify: `webapp/src/main/resources/public/rcommons/js/nav.js:7`
- Create: `webapp/src/main/resources/public/rcommons/js/roster.js`

**Interfaces:**
- Produces: page container `#page-org-volunteers`, nav button `#nav-org-volunteers` calling `navTo('org-volunteers')`, `js/roster.js` loaded after `org.js`. Task 4 fills in the render logic against the DOM ids created here (`#volunteer-roster-count`, `#volunteer-skill-filters`, `#volunteer-avail-filter`, `#volunteer-roster-list`).
- Consumes: nothing new — `navTo`/`PAGES` from `nav.js` (existing).

- [ ] **Step 1: Register the new page in `PAGES`**

In `webapp/src/main/resources/public/rcommons/js/nav.js:7`, change:

```js
var PAGES = ['dashboard','opportunities','needs','hours','map','messages','orgs','profile','background','org-shifts','org-create','calendar','org-calendar'];
```

to:

```js
var PAGES = ['dashboard','opportunities','needs','hours','map','messages','orgs','profile','background','org-shifts','org-create','calendar','org-calendar','org-volunteers'];
```

- [ ] **Step 2: Add the nav button**

In `webapp/src/main/resources/public/rcommons/dashboard.html`, in the org sidebar section (around line 126-129), after the existing "Calendar" button and before the closing `</div>` of `.sidebar-section`, insert:

```html
      <button class="nav-item" onclick="navTo('org-volunteers')" id="nav-org-volunteers">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Volunteers
      </button>
```

So the block (dashboard.html:119-130) reads:

```html
  <div id="nav-view-org" style="display:none;">
    <div class="sidebar-section">
      <div class="sidebar-label">Shift management</div>
      <button class="nav-item active" onclick="navTo('org-shifts')" id="nav-org-shifts">
        <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Shifts &amp; signups
      </button>
      <button class="nav-item" onclick="navTo('org-calendar')" id="nav-org-calendar">
        <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="7" y1="14" x2="7" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="17" y1="14" x2="17" y2="14"/></svg>
        Calendar
      </button>
      <button class="nav-item" onclick="navTo('org-volunteers')" id="nav-org-volunteers">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Volunteers
      </button>
    </div>
```

- [ ] **Step 3: Add the page container**

In `webapp/src/main/resources/public/rcommons/dashboard.html`, after the `page-org-calendar` div closes (line 666, right before `</main>` at line 668), insert:

```html
  <div class="page" id="page-org-volunteers">
    <div class="page-header">
      <div><div class="page-title">Volunteers</div><div class="page-sub">People who've helped or want to help with your org</div></div>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">Filter by skill</div>
        <div class="filter-count" id="volunteer-roster-count">Loading…</div>
      </div>
      <div id="volunteer-skill-filters" style="padding:12px 18px;border-bottom:1px solid var(--border);display:flex;flex-wrap:wrap;gap:6px;"></div>
      <div class="filter-row">
        <select class="filter-select" id="volunteer-avail-filter" onchange="renderVolunteerRoster()">
          <option value="">All availability</option>
          <option value="sun">Available Sunday</option>
          <option value="mon">Available Monday</option>
          <option value="tue">Available Tuesday</option>
          <option value="wed">Available Wednesday</option>
          <option value="thu">Available Thursday</option>
          <option value="fri">Available Friday</option>
          <option value="sat">Available Saturday</option>
        </select>
        <button class="btn btn-secondary btn-sm" onclick="clearVolunteerFilters()">Clear filters</button>
      </div>
      <div class="opp-list" id="volunteer-roster-list"></div>
    </div>
  </div>
```

- [ ] **Step 4: Create the empty `roster.js` file**

Create `webapp/src/main/resources/public/rcommons/js/roster.js`:

```js
/**
 * roster.js — Org-side volunteer roster: demo-data-derived list, skill +
 * availability-day filtering, and the row → profile-panel handoff.
 *
 * Roster membership: a volunteer appears for this org if they have any
 * signup (any status) against one of DEMO_SHIFTS, OR their profile has
 * discoverable:true. See DEMO_VOLUNTEERS in data.js.
 */

var activeSkillFilters = [];

function renderVolunteerRoster() {
  var list = document.getElementById('volunteer-roster-list');
  if (!list) return;
  list.innerHTML = '<div class="empty-state">No volunteers match these filters.</div>';
}

function clearVolunteerFilters() {
  activeSkillFilters = [];
  renderVolunteerRoster();
}

renderVolunteerRoster();
```

- [ ] **Step 5: Load the script**

In `webapp/src/main/resources/public/rcommons/dashboard.html`, in the script block (currently lines 864-872), add `roster.js` after `org.js`:

```html
<script src="js/data.js"></script>
<script src="js/api.js"></script>
<script src="js/availability.js"></script>
<script src="js/profile.js"></script>
<script src="js/render.js"></script>
<script src="js/modals.js"></script>
<script src="js/nav.js"></script>
<script src="js/org.js"></script>
<script src="js/roster.js"></script>
<script src="js/calendar.js"></script>
```

- [ ] **Step 6: Verify in browser**

Reload `http://localhost:8080/rcommons/dashboard.html`, click "Org" (top tab), then click "Volunteers" in the sidebar.

Expected: the page switches to "Volunteers" with the page title/sub visible, an empty skill-filter row, the availability dropdown, and the list area showing "No volunteers match these filters." No console errors.

- [ ] **Step 7: Commit**

```bash
git add webapp/src/main/resources/public/rcommons/dashboard.html webapp/src/main/resources/public/rcommons/js/nav.js webapp/src/main/resources/public/rcommons/js/roster.js
git commit -m "feat: scaffold org-side volunteer roster page

Empty page + nav wiring only — renderVolunteerRoster() is a stub until
demo data and filter logic land in the next tasks."
```

---

### Task 3: Demo data — `DEMO_VOLUNTEERS` + `volunteerId` on `DEMO_SIGNUPS`

**Files:**
- Modify: `webapp/src/main/resources/public/rcommons/js/data.js`
- Modify: `webapp/src/main/resources/public/rcommons/js/org.js:37-41`

**Interfaces:**
- Produces: global `DEMO_VOLUNTEERS` array, each entry shaped `{ id, name, initials, phone, skills[], classes[], availability{}, discoverable, hoursTotal }`. `DEMO_SIGNUPS` entries gain `volunteerId` (joins to `DEMO_VOLUNTEERS.id`) alongside the existing `volunteerName` (left in place — `org.js`'s `renderOrgSignups()` at org.js:291 still reads it directly).
- Consumes: nothing new.

**Context:** 9 volunteers total. `vol-1`/`vol-2` are confirmed on `shift-1` (9am–1pm, 4 hrs), `vol-3` is canceled on `shift-2` (so contributes 0 confirmed hours but still counts as roster history). `vol-4`–`vol-8` are pure discovery opt-ins with no signup history. `vol-9` (Chris Bowden) is neither — a negative control that must never appear in the roster regardless of filters, used to verify the membership gate in Task 6.

- [ ] **Step 1: Add `DEMO_VOLUNTEERS` to `data.js`**

In `webapp/src/main/resources/public/rcommons/js/data.js`, after the `DEMO_SIGNUPS` line (currently line 71, `var DEMO_SIGNUPS = [];`), insert:

```js
// ─── VOLUNTEERS (org-side roster) ──────────────────────────────────────────
// Roster membership for a given org = has a DEMO_SIGNUPS entry against one
// of DEMO_SHIFTS, OR discoverable:true. vol-9 has neither, on purpose — a
// negative control proving volunteers without history or opt-in never show.

var DEMO_VOLUNTEERS = [
  {
    id: 'vol-1', name: 'Maria Gonzalez', initials: 'MG', phone: '828-555-0101',
    skills: ['Cooking / Food prep', 'Driving / Transport'],
    classes: ['Sustainer'], hoursTotal: 42, discoverable: false,
    availability: { sat_08: true, sat_09: true, sat_10: true, sat_11: true, sun_08: true, sun_09: true, sun_10: true, sun_11: true }
  },
  {
    id: 'vol-2', name: 'Devon Price', initials: 'DP', phone: '828-555-0102',
    skills: ['Warehouse / Logistics', 'Heavy lifting'],
    classes: ['Implementer'], hoursTotal: 18, discoverable: false,
    availability: { mon_17: true, mon_18: true, mon_19: true, wed_17: true, wed_18: true, wed_19: true, fri_17: true, fri_18: true, fri_19: true }
  },
  {
    id: 'vol-3', name: 'Aaliyah Ferris', initials: 'AF', phone: '828-555-0103',
    skills: ['EMT / Medical', 'First aid / CPR'],
    classes: ['Guardian / Steward / Protector'], hoursTotal: 6, discoverable: false,
    availability: { tue_09: true, tue_10: true, tue_11: true, tue_12: true, thu_09: true, thu_10: true, thu_11: true, thu_12: true }
  },
  {
    id: 'vol-4', name: 'Sam Okafor', initials: 'SO', phone: '828-555-0104',
    skills: ['Electrical', 'Construction / Carpentry', 'Forklift / Heavy equipment'],
    classes: ['Implementer'], hoursTotal: 65, discoverable: true,
    availability: { sat_09: true, sat_10: true, sat_11: true, sat_12: true, sat_13: true, sat_14: true, sat_15: true, sat_16: true }
  },
  {
    id: 'vol-5', name: 'Priya Natarajan', initials: 'PN', phone: '828-555-0105',
    skills: ['Grant writing', 'Fundraising', 'Event coordination'],
    classes: ['Resource Mobilizer'], hoursTotal: 12, discoverable: true,
    availability: { mon_08: true, tue_08: true, wed_08: true, thu_08: true, fri_08: true }
  },
  {
    id: 'vol-6', name: 'Jamal Whitfield', initials: 'JW', phone: '828-555-0106',
    skills: ['Counseling / Mental health', 'Teaching / Tutoring', 'Spanish'],
    classes: ['Sensemaker / Educator'], hoursTotal: 30, discoverable: true,
    availability: { sun_10: true, sun_11: true, sun_12: true, wed_18: true }
  },
  {
    id: 'vol-7', name: 'Ellen Marsh', initials: 'EM', phone: '828-555-0107',
    skills: ['Elder care', 'Childcare', 'Cooking / Food prep'],
    classes: ['Caregiver / Nourisher'], hoursTotal: 55, discoverable: true,
    availability: { mon_06: true, mon_07: true, tue_06: true, tue_07: true, wed_06: true, wed_07: true, thu_06: true, thu_07: true, fri_06: true, fri_07: true }
  },
  {
    id: 'vol-8', name: 'Ricky Tran', initials: 'RT', phone: '828-555-0108',
    skills: ['Tech / Web development', 'Photography / Video', 'Social media'],
    classes: ['Edgewalker'], hoursTotal: 8, discoverable: true,
    availability: { sat_12: true, sat_13: true, sat_14: true, sat_15: true, sat_16: true, sun_12: true, sun_13: true, sun_14: true, sun_15: true, sun_16: true }
  },
  {
    id: 'vol-9', name: 'Chris Bowden', initials: 'CB', phone: '828-555-0109',
    skills: ['Translation / Interpreter', 'Legal'],
    classes: ['Strategic Challenger'], hoursTotal: 0, discoverable: false,
    availability: {}
  }
];
```

- [ ] **Step 2: Thread `volunteerId` through the existing org.js signups**

In `webapp/src/main/resources/public/rcommons/js/org.js:37-41`, replace:

```js
var DEMO_SIGNUPS = [
  { id: 1, shiftId: 'shift-1', volunteerName: 'Maria Gonzalez', notes: 'Bringing my own gloves', status: 'CONFIRMED' },
  { id: 2, shiftId: 'shift-1', volunteerName: 'Devon Price',    notes: '',                        status: 'CONFIRMED' },
  { id: 3, shiftId: 'shift-2', volunteerName: 'Aaliyah Ferris', notes: 'Can only stay until noon', status: 'CANCELED' }
];
```

with:

```js
var DEMO_SIGNUPS = [
  { id: 1, shiftId: 'shift-1', volunteerId: 'vol-1', volunteerName: 'Maria Gonzalez', notes: 'Bringing my own gloves', status: 'CONFIRMED' },
  { id: 2, shiftId: 'shift-1', volunteerId: 'vol-2', volunteerName: 'Devon Price',    notes: '',                        status: 'CONFIRMED' },
  { id: 3, shiftId: 'shift-2', volunteerId: 'vol-3', volunteerName: 'Aaliyah Ferris', notes: 'Can only stay until noon', status: 'CANCELED' }
];
```

- [ ] **Step 3: Verify existing org-shifts signups view still works**

Reload `http://localhost:8080/rcommons/dashboard.html`, go to Org → "Shifts & signups", click the first shift ("Meal prep & distribution shift").

Expected: the signups panel still shows "Maria Gonzalez" and "Devon Price" with their notes/status exactly as before — the added `volunteerId` field doesn't affect `renderOrgSignups()`, which reads `volunteerName` directly. No console errors.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/main/resources/public/rcommons/js/data.js webapp/src/main/resources/public/rcommons/js/org.js
git commit -m "feat: add DEMO_VOLUNTEERS and thread volunteerId through DEMO_SIGNUPS

9 demo volunteers: 2 confirmed + 1 canceled against existing shifts, 5
pure discoverable opt-ins, 1 negative control (no history, not
discoverable) for verifying the roster's membership gate."
```

---

### Task 4: Roster derived data, rendering, and filtering

**Files:**
- Modify: `webapp/src/main/resources/public/rcommons/js/roster.js`
- Modify: `webapp/src/main/resources/public/rcommons/css/components.css:171-175`

**Interfaces:**
- Consumes: `DEMO_VOLUNTEERS`, `DEMO_SIGNUPS`, `DEMO_SHIFTS` (data.js/org.js), `parseLocalDT(v)` → `{y,mo,da,h,mi}` and `shiftTitle(shift)` → string (org.js), `AVAIL_DAYS` → `['sun','mon','tue','wed','thu','fri','sat']` and `availableHoursForDay(availability, dayKey)` → `number[]` (availability.js).
- Produces: `hoursAtOrgForVolunteer(volunteerId)` → number, `rosterVolunteers()` → `DEMO_VOLUNTEERS[]` (membership-filtered), `renderVolunteerRoster()` (rewritten, replaces the Task 2 stub), `openVolunteerProfile(id)` calls into this via `hoursAtOrgForVolunteer` (Task 5 depends on this function existing).

- [ ] **Step 1: Replace `roster.js` with the full implementation**

Replace the entire contents of `webapp/src/main/resources/public/rcommons/js/roster.js` with:

```js
/**
 * roster.js — Org-side volunteer roster: demo-data-derived list, skill +
 * availability-day filtering, and the row → profile-panel handoff.
 *
 * Roster membership: a volunteer appears for this org if they have any
 * signup (any status) against one of DEMO_SHIFTS, OR their profile has
 * discoverable:true. See DEMO_VOLUNTEERS in data.js.
 */

var ROSTER_SKILL_OPTIONS = [
  'Driving / Transport', 'Heavy lifting', 'Construction / Carpentry', 'Cooking / Food prep',
  'First aid / CPR', 'EMT / Medical', 'Childcare', 'Elder care', 'Animal care',
  'Farming / Agriculture', 'Electrical', 'Plumbing', 'Forklift / Heavy equipment', 'Warehouse / Logistics',
  'Grant writing', 'Fundraising', 'Social media', 'Photography / Video', 'Translation / Interpreter',
  'Teaching / Tutoring', 'Counseling / Mental health', 'Legal', 'Tech / Web development',
  'Event coordination', 'Spanish', 'Other language'
];

var ROSTER_DAY_LABELS = { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' };

var activeSkillFilters = [];

// ─── DERIVED DATA ───────────────────────────────────────────────────────

/** Minutes-based duration, assumes same-day start/end like all current
 * DEMO_SHIFTS entries. */
function shiftDurationHours(shift) {
  var s = parseLocalDT(shift.startTime);
  var e = parseLocalDT(shift.endTime);
  return ((e.h * 60 + e.mi) - (s.h * 60 + s.mi)) / 60;
}

/** Sums confirmed-signup shift durations for one volunteer. Canceled/pending
 * signups don't count — matches how shiftFillInfo() in org.js only counts
 * CONFIRMED toward capacity. */
function hoursAtOrgForVolunteer(volunteerId) {
  return DEMO_SIGNUPS
    .filter(function(s) { return s.volunteerId === volunteerId && s.status === 'CONFIRMED'; })
    .reduce(function(total, s) {
      var shift = DEMO_SHIFTS.find(function(sh) { return sh.id === s.shiftId; });
      return total + (shift ? shiftDurationHours(shift) : 0);
    }, 0);
}

function volunteerAvailableDaysSummary(v) {
  return AVAIL_DAYS
    .filter(function(day) { return availableHoursForDay(v.availability, day).length > 0; })
    .map(function(day) { return ROSTER_DAY_LABELS[day]; })
    .join(', ');
}

/** The membership gate: has org history (any signup, any status) OR opted
 * into discovery. Without this, every platform volunteer would show up for
 * every org. */
function rosterVolunteers() {
  return DEMO_VOLUNTEERS.filter(function(v) {
    var hasSignup = DEMO_SIGNUPS.some(function(s) { return s.volunteerId === v.id; });
    return hasSignup || v.discoverable;
  });
}

function volunteerMatchesFilters(v) {
  if (activeSkillFilters.length > 0) {
    var hasSkill = activeSkillFilters.some(function(skill) { return v.skills.indexOf(skill) !== -1; });
    if (!hasSkill) return false;
  }
  var dayFilter = document.getElementById('volunteer-avail-filter').value;
  if (dayFilter && availableHoursForDay(v.availability, dayFilter).length === 0) return false;
  return true;
}

// ─── RENDER ─────────────────────────────────────────────────────────────

function renderVolunteerSkillFilters() {
  var container = document.getElementById('volunteer-skill-filters');
  if (!container) return;
  container.innerHTML = ROSTER_SKILL_OPTIONS.map(function(skill) {
    var active = activeSkillFilters.indexOf(skill) !== -1 ? ' filter-active' : '';
    return '<span class="skill-chip roster-filter-chip' + active + '" onclick="toggleSkillFilter(\'' + skill + '\')">' + skill + '</span>';
  }).join('');
}

function toggleSkillFilter(skill) {
  var idx = activeSkillFilters.indexOf(skill);
  if (idx === -1) activeSkillFilters.push(skill); else activeSkillFilters.splice(idx, 1);
  renderVolunteerSkillFilters();
  renderVolunteerRoster();
}

function clearVolunteerFilters() {
  activeSkillFilters = [];
  var dayFilter = document.getElementById('volunteer-avail-filter');
  if (dayFilter) dayFilter.value = '';
  renderVolunteerSkillFilters();
  renderVolunteerRoster();
}

function renderVolunteerRoster() {
  var list = document.getElementById('volunteer-roster-list');
  var count = document.getElementById('volunteer-roster-count');
  if (!list) return;

  var volunteers = rosterVolunteers().filter(volunteerMatchesFilters);

  if (count) count.textContent = volunteers.length + ' volunteer' + (volunteers.length === 1 ? '' : 's');

  if (volunteers.length === 0) {
    list.innerHTML = '<div class="empty-state">No volunteers match these filters.</div>';
    return;
  }

  list.innerHTML = volunteers.map(function(v) {
    var hrsHere = hoursAtOrgForVolunteer(v.id);
    var days = volunteerAvailableDaysSummary(v);
    var shown = v.skills.slice(0, 3);
    var extra = v.skills.length - shown.length;
    var skillChips = shown.map(function(s) { return '<span class="skill-chip">' + s + '</span>'; }).join('') +
      (extra > 0 ? '<span class="skill-chip">+' + extra + ' more</span>' : '');
    return '<div class="opp-item" onclick="openVolunteerProfile(\'' + v.id + '\')">' +
      '<div class="opp-org-mark mark-blue" style="font-size:12px;font-weight:700;">' + v.initials + '</div>' +
      '<div class="opp-info">' +
        '<div class="opp-title">' + v.name + '</div>' +
        '<div class="opp-org">' + v.phone + (days ? ' · Available ' + days : '') + '</div>' +
        '<div class="opp-meta">' + skillChips + '</div>' +
      '</div>' +
      '<div class="opp-actions" style="flex-direction:column;align-items:flex-end;gap:2px;">' +
        '<div class="hours-val">' + hrsHere + ' hrs here</div>' +
        '<div style="font-size:11px;color:var(--text-3);">' + v.hoursTotal + ' hrs total</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

renderVolunteerSkillFilters();
renderVolunteerRoster();
```

- [ ] **Step 2: Add the filter-chip active-state CSS**

In `webapp/src/main/resources/public/rcommons/css/components.css`, after the existing `.skill-chip` rule (lines 171-175), add:

```css
/* Roster skill-filter chips are the only skill-chip usage that's
   interactive — everywhere else (profile page, volunteer profile panel)
   skill-chip is read-only display, so the pointer cursor and active state
   are scoped to this class rather than added to .skill-chip itself. */
.roster-filter-chip { cursor: pointer; }
.roster-filter-chip.filter-active { border-color: var(--accent); background: var(--accent-lt); color: var(--accent); font-weight: 600; }
```

- [ ] **Step 3: Verify in browser — baseline roster**

Reload `http://localhost:8080/rcommons/dashboard.html`, go to Org → "Volunteers" (may need to click "Org" tab first if not already there).

Expected: filter-count reads "8 volunteers" (vol-1 through vol-8 — vol-9 Chris Bowden is excluded by the membership gate). Maria Gonzalez's row shows "4 hrs here" and "42 hrs total". Devon Price's row also shows "4 hrs here". Aaliyah Ferris's row shows "0 hrs here" (her only signup is CANCELED) and "6 hrs total". Chris Bowden does not appear anywhere in the list.

- [ ] **Step 4: Verify in browser — skill filter**

Click the "Cooking / Food prep" skill chip.

Expected: the chip highlights (accent border/background), the list narrows to 2 volunteers (Maria Gonzalez, Ellen Marsh), filter-count reads "2 volunteers". Click it again to deselect — list returns to 8.

- [ ] **Step 5: Verify in browser — availability filter**

With no skill filters active, select "Available Saturday" from the dropdown.

Expected: list narrows to 3 volunteers (Maria Gonzalez, Sam Okafor, Ricky Tran), filter-count reads "3 volunteers".

- [ ] **Step 6: Verify in browser — combined filters + clear**

With "Available Saturday" still selected, click the "Electrical" skill chip.

Expected: list narrows to exactly 1 volunteer (Sam Okafor). Click "Clear filters".

Expected: skill chip deselects, dropdown resets to "All availability", list returns to 8 volunteers.

- [ ] **Step 7: Commit**

```bash
git add webapp/src/main/resources/public/rcommons/js/roster.js webapp/src/main/resources/public/rcommons/css/components.css
git commit -m "feat: implement volunteer roster rendering and filtering

OR-match skill filter, availability-day filter, hrs-here/hrs-total
metric derived from confirmed DEMO_SIGNUPS durations. Membership gate
(signup history OR discoverable:true) verified against vol-9's
negative-control case."
```

---

### Task 5: Volunteer profile panel

**Files:**
- Modify: `webapp/src/main/resources/public/rcommons/dashboard.html`
- Modify: `webapp/src/main/resources/public/rcommons/js/modals.js`

**Interfaces:**
- Consumes: `hoursAtOrgForVolunteer(volunteerId)` (roster.js, Task 4), `renderAvailGrid(containerEl, availability, onToggle)` (availability.js), `shiftTitle(shift)` / `formatShiftTime(shift)` (org.js), `DEMO_VOLUNTEERS` / `DEMO_SIGNUPS` / `DEMO_SHIFTS`.
- Produces: `openVolunteerProfile(id)`, `closeVolunteerProfile()` — called from the `onclick` on each roster row built in Task 4 (`openVolunteerProfile('vol-1')` etc.).

- [ ] **Step 1: Add the modal HTML**

In `webapp/src/main/resources/public/rcommons/dashboard.html`, after the "Make a commitment" modal closes (currently ends at line 791, right before the `<!-- ── MOBILE BOTTOM NAV ── -->` comment at line 793), insert:

```html
<!-- ── VOLUNTEER PROFILE PANEL (org view) ── -->
<div class="commit-panel" id="volunteer-profile-panel" onclick="if(event.target===this)closeVolunteerProfile()">
  <div class="commit-modal">
    <div class="modal-header">
      <div class="modal-title">Volunteer profile</div>
      <button class="modal-close" onclick="closeVolunteerProfile()"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="modal-body">
      <div class="profile-section">
        <div class="profile-header">
          <div class="profile-avatar" id="vp-avatar">?</div>
          <div><div class="profile-name" id="vp-name">Loading…</div><div class="profile-role" id="vp-role"></div></div>
        </div>
        <div>
          <div class="form-label" style="margin-bottom:6px;">Character class</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;" id="vp-classes"></div>
        </div>
        <div>
          <div class="form-label" style="margin-bottom:6px;">Skills</div>
          <div class="skills-wrap" id="vp-skills"></div>
        </div>
        <div>
          <div class="form-label" style="margin-bottom:4px;">Availability</div>
          <div class="avail-grid" id="vp-avail-grid">
            <div class="avail-head"></div><div class="avail-head">Sun</div><div class="avail-head">Mon</div><div class="avail-head">Tue</div><div class="avail-head">Wed</div><div class="avail-head">Thu</div><div class="avail-head">Fri</div><div class="avail-head">Sat</div>
          </div>
        </div>
        <div>
          <div class="form-label" style="margin-bottom:4px;">Shifts with your org</div>
          <div class="hours-list" id="vp-shifts-list"></div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeVolunteerProfile()">Close</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add the open/close functions**

In `webapp/src/main/resources/public/rcommons/js/modals.js`, at the end of the file, add:

```js
// ─── VOLUNTEER PROFILE PANEL (org view) ────────────────────────────────────

function openVolunteerProfile(id) {
  var v = DEMO_VOLUNTEERS.find(function(x) { return x.id === id; });
  if (!v) return;

  var hrsHere = hoursAtOrgForVolunteer(v.id);
  document.getElementById('vp-avatar').textContent = v.initials;
  document.getElementById('vp-name').textContent   = v.name;
  document.getElementById('vp-role').textContent   = v.phone + ' · ' + hrsHere + ' hrs here · ' + v.hoursTotal + ' hrs total';

  var classesEl = document.getElementById('vp-classes');
  classesEl.innerHTML = v.classes.length
    ? v.classes.map(function(c) {
        return '<span class="role-chip"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="5" cy="5" r="4"/><path d="M5 1v8M1 5h8"/></svg>' + c + '</span>';
      }).join('')
    : '<span class="role-chip" style="opacity:0.5;">None listed</span>';

  var skillsEl = document.getElementById('vp-skills');
  skillsEl.innerHTML = v.skills.length
    ? v.skills.map(function(s) { return '<span class="skill-chip">' + s + '</span>'; }).join('')
    : '<span class="skill-chip" style="opacity:0.5;">No skills listed</span>';

  var gridEl = document.getElementById('vp-avail-grid');
  renderAvailGrid(gridEl, v.availability, null);
  gridEl.style.pointerEvents = 'none'; // read-only — orgs can't edit a volunteer's own availability

  var signups = DEMO_SIGNUPS.filter(function(s) { return s.volunteerId === v.id; });
  var shiftsEl = document.getElementById('vp-shifts-list');
  shiftsEl.innerHTML = signups.length
    ? signups.map(function(s) {
        var shift = DEMO_SHIFTS.find(function(sh) { return sh.id === s.shiftId; });
        var confirmed = s.status === 'CONFIRMED';
        return '<div class="hours-item">' +
          '<div class="hours-dot ' + (confirmed ? 'confirmed' : 'logged') + '"></div>' +
          '<div class="hours-info">' +
            '<div class="hours-title">' + (shift ? shiftTitle(shift) : 'Shift') + '</div>' +
            '<div class="hours-org">' + (shift ? formatShiftTime(shift) : '') + '</div>' +
          '</div>' +
          '<span class="tag ' + (confirmed ? 'tag-done' : 'tag-dist') + '">' + s.status + '</span>' +
        '</div>';
      }).join('')
    : '<div style="padding:8px 0;font-size:12px;color:var(--text-3);">No shifts with your org yet.</div>';

  document.getElementById('volunteer-profile-panel').classList.add('open');
}

function closeVolunteerProfile() {
  document.getElementById('volunteer-profile-panel').classList.remove('open');
}
```

- [ ] **Step 3: Verify in browser — populated volunteer**

Reload `http://localhost:8080/rcommons/dashboard.html`, go to Org → "Volunteers", click Maria Gonzalez's row.

Expected: the panel opens over the roster (background dimmed). Avatar shows "MG", name "Maria Gonzalez", role line reads "828-555-0101 · 4 hrs here · 42 hrs total". Character class shows "Sustainer". Skills show both "Cooking / Food prep" and "Driving / Transport". The availability grid shows filled cells on Sat/Sun 8-11am and is *not* clickable (clicking a cell does nothing — no toggle). "Shifts with your org" shows one row: "Meal prep & distribution shift", confirmed status tag. Click "Close" (or click the dimmed background) — panel closes.

- [ ] **Step 4: Verify in browser — discoverable volunteer with no shift history**

Click Sam Okafor's row (no filters active — clear filters first if needed).

Expected: panel opens, role line reads "828-555-0104 · 0 hrs here · 65 hrs total", "Shifts with your org" shows "No shifts with your org yet."

- [ ] **Step 5: Commit**

```bash
git add webapp/src/main/resources/public/rcommons/dashboard.html webapp/src/main/resources/public/rcommons/js/modals.js
git commit -m "feat: add read-only volunteer profile panel for org view

Reuses the existing profile-page field layout (class/skills/bio-less
variant/availability) inside the standard commit-panel modal, plus a
per-org shift-signup history list."
```

---

### Task 6: Full end-to-end verification pass

**Files:** none (verification only)

- [ ] **Step 1: Fresh reload, full flow**

Restart the app if it's been running through all prior tasks (`Ctrl+C`, re-run), open `http://localhost:8080/rcommons/dashboard.html` in a fresh tab, open devtools console.

- [ ] **Step 2: Volunteer view is unaffected**

On first load (volunteer view, default), click through Dashboard, Opportunities, Hours, Profile. Confirm nothing looks different from before this work and there are no new console errors — this feature is additive only.

- [ ] **Step 3: Org view end-to-end**

Click "Org" tab → confirm it navigates cleanly to "Shifts & signups" (Task 1 fix). Click "Volunteers" → confirm the roster renders 8 volunteers. Apply the skill filter "First aid / CPR" → confirm only Aaliyah Ferris shows. Clear filters. Apply "Available Sunday" → confirm Maria Gonzalez, Jamal Whitfield, Ricky Tran show (3 volunteers). Clear filters.

- [ ] **Step 4: Profile panel round-trip**

Click into 3 different volunteers' rows (one with confirmed history, one with canceled-only history, one pure-discoverable) and confirm each panel's hrs-here/hrs-total/shift-list match what Tasks 4-5's verification steps established. Confirm closing each panel (via Close button and via clicking the dimmed backdrop) returns cleanly to the roster with filters still applied as left.

- [ ] **Step 5: Confirm no regressions on org-shifts**

Go to "Shifts & signups", click each of the 3 shifts, confirm signups still display volunteer names/notes/status correctly (Task 3's `volunteerId` addition didn't break this).

- [ ] **Step 6: Final commit if any fixups were needed**

If steps 1-5 surfaced anything, fix it, re-verify the specific failing step, then:

```bash
git add -A
git commit -m "fix: address issues found in roster end-to-end verification"
```

If nothing needed fixing, no commit is needed for this task.
