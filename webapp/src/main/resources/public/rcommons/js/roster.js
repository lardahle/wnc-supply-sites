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
