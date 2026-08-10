/**
 * roster.js — Org-side volunteer roster: demo-data-derived list, skill +
 * availability-day filtering, and the row → profile-panel handoff.
 *
 * Roster membership: a volunteer appears for this org if they have any
 * signup (any status) against one of DEMO_SHIFTS, OR their profile has
 * discoverable:true. See DEMO_VOLUNTEERS in data.js.
 */

// TODO: once a real `volunteer` table/API exists, this file's DEMO_VOLUNTEERS
// dependency goes away. See docs/superpowers/specs/2026-07-26-org-volunteer-roster-design.md
// for the membership-gate rationale and docs/superpowers/plans/2026-07-26-org-volunteer-roster.md
// for what was deferred. Two things the real integration will need that this
// demo version doesn't: (1) an org-identity field so signups/hours are
// actually scoped to the viewing org, not global across all orgs; (2) HTML
// escaping for all volunteer-controlled fields rendered via innerHTML
// (name, skills, etc.) — safe today only because DEMO_VOLUNTEERS is static.

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

// NOTE: DEMO_SIGNUPS/DEMO_SHIFTS have no org-identity field, so this
// treats every signup as belonging to "this org" — matching
// renderOrgShifts()'s existing (equally unscoped) behavior elsewhere in
// org.js. Proper org-scoping needs to land before this is wired to real
// data.
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
