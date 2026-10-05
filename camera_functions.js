'use strict';
// Database -> camera/relay synchronisation.
//
// 'use strict' matters here: this file previously assigned `connection`,
// `addresses`, `cam_ip`, `relay_ip` and `relay` without declaring them, which
// created implicit globals shared across every concurrent call. One function's
// `finally` could close another's connection. Strict mode makes that a
// ReferenceError instead of a silent data race.
//
// Device access goes through lib/devices.js, which applies timeouts, rethrows
// failures instead of swallowing them, and refuses to drive the barrier port
// through a bay-shaped call. Bay numbers are passed as bay numbers; the
// bay-to-port mapping lives in config, not in a `+ 8` here.
//
// NOTE: the SQL date predicates below are preserved from the previous
// implementation and are known to be wrong (see Phase 3): the add/activate side
// matches every booking ever recorded rather than currently-active ones, the
// two sides disagree (`<=` vs `=`), and revocation uses `<=` so access ends on
// the morning of the departure day. They are corrected in the sync rewrite.

const config = require('./config');
const log_err = require('./log_err');
const db = require('./lib/db');
const devices = require('./lib/devices');

const TABLE = config.database.table;

///////////////////////////////////////////////////////////////////////////////
// plates

async function check_plates_delete(site = config.defaultSite()) {
    try {
        console.log('Looking for plates to delete...');
        const rows = await db.query(
            `SELECT Targa, Colonnine FROM \`${TABLE}\` WHERE DATE(Fine) <= CURDATE()`);
        if (rows.length === 0) {
            console.log('No plates to delete...');
            return;
        }
        for (const row of rows) {
            console.log('Delete plate:', row.Targa);
            await forEachCamera(site, (camera) => devices.removePlate(camera, row.Targa));
            await rm_db_plate(row.Targa);
        }
    } catch (err) {
        console.error(err);
        log_err(err);
    }
}

async function check_plates_add(site = config.defaultSite()) {
    try {
        console.log('Looking for plates to add...');
        const rows = await db.query(
            `SELECT Targa, Colonnine FROM \`${TABLE}\` WHERE DATE(Inizio) <= CURDATE()`);
        if (rows.length === 0) {
            console.log('No plates to add...');
            return;
        }
        for (const row of rows) {
            console.log('Adding plate:', row.Targa);
            await forEachCamera(site, (camera) => devices.addPlate(camera, row.Targa));
        }
    } catch (err) {
        console.error(err);
        log_err(err);
    }
}

async function rm_db_plate(plate) {
    const result = await db.query(
        `DELETE FROM \`${TABLE}\` WHERE Targa = ?`, [plate]);
    if (result.affectedRows > 0) {
        console.log('Plate deleted successfully.');
    } else {
        console.log('Plate not found in the database:', plate);
    }
    return result.affectedRows;
}

///////////////////////////////////////////////////////////////////////////////
// charging bays
//
// `Colonnine` holds a bay number (1..N). It is passed straight to
// devices.bayOn/bayOff, which resolve it to a relay port via the site's
// bay_ports and refuse to return the barrier port. The previous code did
// `output[i] + 8` here — and in the deactivate path passed the whole result
// array as the port.

async function check_relay_deactivate(site = config.defaultSite()) {
    try {
        console.log('checking relay to turn off...');
        const rows = await db.query(
            `SELECT Colonnine FROM \`${TABLE}\` WHERE DATE(Fine) <= CURDATE()`);
        if (rows.length === 0) {
            console.log('No relays to deactivate...');
            return;
        }
        for (const row of rows) {
            await switchBay(site, row.Colonnine, false);
        }
    } catch (err) {
        console.error(err);
        log_err(err);
    }
}

async function check_relay_activate(site = config.defaultSite()) {
    try {
        console.log('checking relay to activate...');
        const rows = await db.query(
            `SELECT Colonnine FROM \`${TABLE}\` WHERE DATE(Inizio) = CURDATE()`);
        if (rows.length === 0) {
            console.log('No relays to activate...');
            return;
        }
        for (const row of rows) {
            await switchBay(site, row.Colonnine, true);
        }
    } catch (err) {
        console.error(err);
        log_err(err);
    }
}

// One bay's state change. A bad bay number is reported and skipped rather than
// aborting the whole run — one corrupt row should not stop the nightly sync.
async function switchBay(site, bay, on) {
    try {
        console.log(`${on ? 'Activating' : 'Deactivating'} bay ${bay} ` +
            `(port ${config.resolveBayPort(site, bay)})`);
        await (on ? devices.bayOn(site, bay) : devices.bayOff(site, bay));
    } catch (err) {
        console.error(`bay ${bay} on site "${site.id}":`, err.message);
        log_err(`bay ${bay} on site "${site.id}": ${err.message}`);
    }
}

///////////////////////////////////////////////////////////////////////////////
// per-booking hooks, called by the endpoints

async function on_add(site = config.defaultSite()) {
    try {
        await check_plates_add(site);
        await check_relay_activate(site);
    } catch (err) {
        console.error(err);
        log_err(err);
    } finally {
        console.log('adding process completed');
    }
}

// Looks up the booking's bay BEFORE deleting the row, so the relay is switched
// by bay number rather than being handed the plate string.
async function on_rm(plate, site = config.defaultSite()) {
    try {
        const rows = await db.query(
            `SELECT Targa, Colonnine FROM \`${TABLE}\` ` +
            'WHERE DATE(Inizio) <= CURDATE() AND Targa = ?', [plate]);
        if (rows.length > 0) {
            await switchBay(site, rows[0].Colonnine, false);
        }
        await forEachCamera(site, (camera) => devices.removePlate(camera, plate));
        await rm_db_plate(plate);
    } catch (err) {
        console.error(err);
        log_err(err);
    } finally {
        console.log('removing process completed');
    }
}

///////////////////////////////////////////////////////////////////////////////
// helpers

// Applies an operation to every camera at a site. A failure on one camera is
// logged and the others still run, but it is never silent. The previous code
// iterated the relay list while indexing the camera list, so a site's second
// camera was never reached.
async function forEachCamera(site, fn) {
    const results = await Promise.allSettled(site.cameras.map(fn));
    results.forEach((result, i) => {
        if (result.status === 'rejected') {
            const address = site.cameras[i].address;
            console.error(`camera ${address}:`, result.reason.message);
            log_err(`camera ${address}: ${result.reason.message}`);
        }
    });
    return results;
}

async function check_devices(site = config.defaultSite()) {
    const results = await devices.siteReachability(site);
    results.forEach(({ role, address, up }) => {
        console.log(`  ${up ? 'up  ' : 'DOWN'} ${role} ${address}`);
        if (!up) log_err(`${role} ${address} is unreachable`);
    });
    return results;
}

///////////////////////////////////////////////////////////////////////////////
// scheduled entry points

async function daily_functions_add(site = config.defaultSite()) {
    console.log(`Starting daily add for site "${site.id}"...`);
    await check_devices(site);
    await check_plates_add(site);
}

async function daily_functions(site = config.defaultSite()) {
    console.log(`Starting daily sync for site "${site.id}"...`);
    await check_devices(site);
    console.log('CHECK RELAYS TO TURN OFF');
    await check_relay_deactivate(site);
    console.log('CHECK RELAYS TO TURN ON');
    await check_relay_activate(site);
    console.log('CHECK PLATES TO DELETE');
    await check_plates_delete(site);
}

///////////////////////////////////////////////////////////////////////////////
// Compatibility shims for endpoints not yet migrated to the site-aware API.
// `relay` here is a BAY number, matching how change_state calls it.

const relay_on = (_address, bay, site = config.defaultSite()) => devices.bayOn(site, bay);
const relay_off = (_address, bay, site = config.defaultSite()) => devices.bayOff(site, bay);
const add_plate = (_address, plate, site = config.defaultSite()) =>
    forEachCamera(site, (camera) => devices.addPlate(camera, plate));
const rm_plate = (_address, plate, site = config.defaultSite()) =>
    forEachCamera(site, (camera) => devices.removePlate(camera, plate));

module.exports = {
    daily_functions,
    daily_functions_add,
    on_add,
    on_rm,
    rm_db_plate,
    check_plates_add,
    check_plates_delete,
    check_relay_activate,
    check_relay_deactivate,
    check_devices,
    relay_on,
    relay_off,
    add_plate,
    rm_plate,
};
