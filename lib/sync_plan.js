'use strict';
// The PURE planner. Given rows, a date and a site it returns the intended
// actions and touches nothing — no config, no database, no network.
//
// It lives in its own module precisely so the tests can require it without
// loading configuration or opening a connection pool. Every historical failure
// in this feature was an error in deciding *what* to do (inverted loop
// conditions, a misspelled column, predicates matching every booking ever
// recorded) rather than in performing it, so this is the part worth testing.

const { toDateKey, todayKey, isActiveOn, isExpiredOn } = require('./dates');
const { normalizePlate } = require('./validate');

///////////////////////////////////////////////////////////////////////////////
// pure planning

function uniq(values) {
    return [...new Set(values)];
}

// bookings: rows with Targa, Colonnine, Inizio, Fine.
// cameraPlates: plates currently on the camera, or null when that is unknown.
// opts.pruneUnknown: also remove camera plates with no active booking. OFF by
//   default, because a plate added by hand on the camera's own web interface is
//   indistinguishable from a stale one, and removing it locks someone out.
function computeSync(bookings, cameraPlates, today, site, opts = {}) {
    const day = toDateKey(today) || todayKey();
    const bayCount = site && site.relay && Array.isArray(site.relay.bay_ports)
        ? site.relay.bay_ports.length : 0;
    const known = Array.isArray(cameraPlates);
    const onCamera = new Set(known ? cameraPlates.map(normalizePlate) : []);

    const active = [];
    const expired = [];
    const skipped = [];

    for (const row of bookings || []) {
        const plate = normalizePlate(row.Targa);
        const start = toDateKey(row.Inizio);
        const end = toDateKey(row.Fine);
        const bay = Number(row.Colonnine);

        if (!plate) { skipped.push({ row, reason: 'EMPTY_PLATE' }); continue; }
        if (!start || !end) { skipped.push({ plate, reason: 'UNPARSEABLE_DATES' }); continue; }
        if (end < start) { skipped.push({ plate, reason: 'END_BEFORE_START' }); continue; }

        // A bay outside the site's wiring is reported and the plate is still
        // handled; the booking is real even if its bay number is not.
        const validBay = Number.isInteger(bay) && bay >= 1 && bay <= bayCount;
        if (!validBay) skipped.push({ plate, bay: row.Colonnine, reason: 'BAY_OUT_OF_RANGE' });

        const entry = { plate, bay: validBay ? bay : null, start, end };
        if (isActiveOn(start, end, day)) active.push(entry);
        else if (isExpiredOn(end, day)) expired.push(entry);
        // else: starts in the future — neither added nor removed.
    }

    const activePlates = new Set(active.map((e) => e.plate));
    const activeBays = new Set(active.filter((e) => e.bay).map((e) => e.bay));

    // Adding a plate the camera already has is harmless but pointless, so skip
    // it when we can see the list.
    const toAdd = uniq(active.map((e) => e.plate))
        .filter((plate) => !known || !onCamera.has(plate));

    // A plate with both an expired and a live booking must stay: the guest has
    // rebooked. And there is nothing to remove if the camera does not have it.
    const toRemove = uniq(expired.map((e) => e.plate))
        .filter((plate) => !activePlates.has(plate))
        .filter((plate) => !known || onCamera.has(plate));

    const baysOn = uniq(active.filter((e) => e.bay).map((e) => e.bay));

    // The important subtraction: a bay whose previous booking expired but which
    // a current booking occupies must NOT be switched off, or the new guest's
    // charger dies.
    const baysOff = uniq(expired.filter((e) => e.bay).map((e) => e.bay))
        .filter((bay) => !activeBays.has(bay));

    const extraOnCamera = known
        ? [...onCamera].filter((plate) => plate && !activePlates.has(plate))
        : [];

    return {
        today: day,
        cameraListKnown: known,
        active,
        expired,
        toAdd,
        toRemove: opts.pruneUnknown && known
            ? uniq([...toRemove, ...extraOnCamera])
            : toRemove,
        baysOn,
        baysOff,
        extraOnCamera,
        skipped,
    };
}

function describePlan(plan, site) {
    const lines = [
        `sync plan for site "${site.id}" on ${plan.today}`,
        `  camera allow-list: ${plan.cameraListKnown ? 'known' : 'UNKNOWN (no diff possible)'}`,
        `  active bookings:   ${plan.active.length}`,
        `  expired bookings:  ${plan.expired.length}`,
        `  plates to add:     ${plan.toAdd.length}${plan.toAdd.length ? ` [${plan.toAdd.join(', ')}]` : ''}`,
        `  plates to remove:  ${plan.toRemove.length}${plan.toRemove.length ? ` [${plan.toRemove.join(', ')}]` : ''}`,
        `  bays to switch on: ${plan.baysOn.length ? plan.baysOn.join(', ') : '-'}`,
        `  bays to switch off:${plan.baysOff.length ? ` ${plan.baysOff.join(', ')}` : ' -'}`,
    ];
    if (plan.skipped.length) {
        lines.push(`  skipped rows:      ${plan.skipped.length}`);
        for (const s of plan.skipped) lines.push(`    - ${s.plate || '(no plate)'}: ${s.reason}`);
    }
    return lines.join('\n');
}


module.exports = { computeSync, describePlan };
