'use strict';
// Reconciles the database (source of truth) with the cameras' allow-lists and
// the charging-bay relays.
//
// computeSync is PURE — given rows, a date and a site it returns the intended
// actions and touches nothing. That is deliberate: every historical failure in
// this feature was a logic error in deciding *what* to do (inverted loop
// conditions, a misspelled column, predicates matching every booking ever
// recorded), not in performing it. Pure logic is the part worth testing, and it
// needs no camera and no MySQL.

const config = require('../config');
const db = require('./db');
const devices = require('./devices');
const log_err = require('../log_err');
const { isActiveOn } = require('./dates');
const { normalizePlate } = require('./validate');
const { computeSync, describePlan } = require('./sync_plan');

const TABLE = config.database.table;

///////////////////////////////////////////////////////////////////////////////
// data access

async function loadBookings() {
    return db.query(`SELECT Nome, Targa, Inizio, Fine, Colonnine FROM \`${TABLE}\``);
}

// The LPR application's verb for enumerating a list is not known: the codebase
// only ever used addplate and delplate, and the hardware is unavailable to probe
// for it. Until it is confirmed against a device, the camera's current contents
// are treated as UNKNOWN, which makes computeSync fall back to "add every active
// plate, remove every expired one" rather than diffing. That is idempotent and
// safe; it just does more calls than strictly necessary. It must never be made
// to return [] on failure — computeSync would read an empty allow-list as
// "nothing is provisioned" and, with pruneUnknown on, delete everything.
async function readCameraPlates(_site) {
    return null;
}

///////////////////////////////////////////////////////////////////////////////
// execution

// SYNC_MODE governs the AUTOMATED reconciliation only. It is checked here rather
// than inside lib/devices, because the device layer also serves operator actions
// — opening the barrier, toggling a bay by hand — and those must keep working
// regardless of whether automatic syncing is enabled.
async function reconcile({ site = config.defaultSite(), mode = config.sync.mode,
    force = false, now = new Date() } = {}) {
    const bookings = await loadBookings();
    const cameraPlates = await readCameraPlates(site);
    const plan = computeSync(bookings, cameraPlates, now, site);

    console.log(describePlan(plan, site));

    if (mode === 'off') {
        console.log('  SYNC_MODE=off — no device calls made');
        return { plan, applied: false, reason: 'off' };
    }
    if (mode !== 'live') {
        console.log('  SYNC_MODE=dryrun — no device calls made');
        return { plan, applied: false, reason: 'dryrun' };
    }

    // Guard against a misconfiguration or a bad predicate pushing the whole
    // table at the cameras.
    const ceiling = config.sync.max_adds_per_run;
    if (plan.toAdd.length > ceiling && !force) {
        const message = `refusing to add ${plan.toAdd.length} plates in one run `
            + `(max_adds_per_run=${ceiling}); pass force to override`;
        console.error(`  ${message}`);
        log_err(`sync refused for site "${site.id}": ${message}`);
        return { plan, applied: false, reason: 'ceiling' };
    }

    const failures = [];
    const limit = Math.max(5, Math.ceil(plan.toAdd.length + plan.toRemove.length) / 2);

    const run = async (label, fn) => {
        try {
            await fn();
        } catch (err) {
            failures.push(`${label}: ${err.message}`);
            console.error(`  failed ${label}: ${err.message}`);
            // A device that has started rejecting everything should stop the
            // run, not receive hundreds more requests.
            if (failures.length > limit) {
                throw new Error(`aborting sync after ${failures.length} failures`);
            }
        }
    };

    try {
        for (const plate of plan.toRemove) {
            await run(`remove ${plate}`, () => eachCamera(site, (c) => devices.removePlate(c, plate)));
        }
        for (const plate of plan.toAdd) {
            await run(`add ${plate}`, () => eachCamera(site, (c) => devices.addPlate(c, plate)));
        }
        for (const bay of plan.baysOff) {
            await run(`bay ${bay} off`, () => devices.bayOff(site, bay));
        }
        for (const bay of plan.baysOn) {
            await run(`bay ${bay} on`, () => devices.bayOn(site, bay));
        }
    } catch (err) {
        log_err(`sync aborted for site "${site.id}": ${err.message}`);
        return { plan, applied: true, aborted: true, failures };
    }

    if (failures.length) log_err(`sync for site "${site.id}" had ${failures.length} failure(s)`);
    console.log(`  sync complete${failures.length ? ` with ${failures.length} failure(s)` : ''}`);
    return { plan, applied: true, failures };
}

// Every camera at the site. The old code looped over the relay list while
// indexing the camera list, so a site's second camera was never reached.
async function eachCamera(site, fn) {
    const results = await Promise.allSettled(site.cameras.map(fn));
    const rejected = results.filter((r) => r.status === 'rejected');
    if (rejected.length === site.cameras.length) {
        throw new Error(rejected.map((r) => r.reason.message).join('; '));
    }
    rejected.forEach((r, i) => {
        console.error(`  camera ${site.cameras[i].address}: ${r.reason.message}`);
    });
    return results;
}

///////////////////////////////////////////////////////////////////////////////
// per-booking operations, used by the endpoints

// Pushes one plate and switches its bay on. Only the record just touched, rather
// than a full table scan, so creating a booking cannot trigger a mass push.
async function addBooking(plate, bay, site = config.defaultSite()) {
    const normalized = normalizePlate(plate);
    await eachCamera(site, (camera) => devices.addPlate(camera, normalized));
    if (bay !== null && bay !== undefined) await devices.bayOn(site, bay);
}

// Removes one plate, switches its bay off unless another live booking uses that
// bay, then deletes the row. The bay is read BEFORE the delete, because
// afterwards it is gone.
async function removeBooking(plate, site = config.defaultSite(), now = new Date()) {
    const normalized = normalizePlate(plate);
    const rows = await db.query(
        `SELECT Targa, Colonnine, Inizio, Fine FROM \`${TABLE}\` WHERE Targa = ?`, [normalized]);

    const bay = rows.length > 0 ? Number(rows[0].Colonnine) : null;

    await eachCamera(site, (camera) => devices.removePlate(camera, normalized));
    if (bay) await releaseBay(bay, normalized, site, now);

    const result = await db.query(`DELETE FROM \`${TABLE}\` WHERE Targa = ?`, [normalized]);
    return { deleted: result.affectedRows, bay };
}

// Switches a bay off, but only if no OTHER live booking occupies it. Shared by
// deletion and by an edit that moves a booking to a different bay. Without this
// check, freeing one guest's bay would cut power to whoever is using it now.
async function releaseBay(bay, exceptPlate, site = config.defaultSite(), now = new Date()) {
    const others = await db.query(
        `SELECT Inizio, Fine FROM \`${TABLE}\` WHERE Colonnine = ? AND Targa <> ?`,
        [bay, normalizePlate(exceptPlate)]);
    if (others.some((r) => isActiveOn(r.Inizio, r.Fine, now))) {
        console.log(`bay ${bay} left on: another active booking uses it`);
        return false;
    }
    await devices.bayOff(site, bay);
    return true;
}

module.exports = {
    computeSync,
    describePlan,
    loadBookings,
    readCameraPlates,
    reconcile,
    addBooking,
    removeBooking,
    releaseBay,
};
