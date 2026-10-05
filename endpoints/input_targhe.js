'use strict';
const config = require('../config');
const db = require('../lib/db');
const sync = require('../lib/sync');
const { validateBooking } = require('../lib/validate');

const TABLE = config.database.table;

// Reached by a real form POST from targhe.html, so failures redirect rather than
// returning JSON the browser would render raw. The error code travels in the
// query string for the UI to surface (Phase 6 renders it in the active
// language).
async function input_targhe(req, res) {
    const site = config.getSite(req.body.site);
    const check = validateBooking(req.body, site.relay.bay_ports);
    if (!check.ok) {
        const first = check.errors[0];
        console.warn('rejected booking:', check.errors.map((e) => e.code).join(', '));
        res.redirect(`/targhe.html?error=${encodeURIComponent(first.code)}`);
        return;
    }
    const { name, plate, data_arrivo, data_partenza, selectedCar } = check.value;

    const existing = await db.query(
        `SELECT Targa FROM \`${TABLE}\` WHERE Targa = ?`, [plate]);
    if (existing.length > 0) {
        res.redirect('/loading_existing_plate.html');
        return;
    }

    const result = await db.query(
        `INSERT INTO \`${TABLE}\` (Nome, Targa, Inizio, Fine, Colonnine) VALUES (?, ?, ?, ?, ?)`,
        [name, plate, data_arrivo, data_partenza, selectedCar]);
    if (result.affectedRows === 0) {
        res.redirect('/targhe.html?error=DB_WRITE_FAILED');
        return;
    }

    console.log('Targa inserita con successo:', plate);
    res.redirect('/loading_success_plate.html');

    // Pushes only the record just created, after the operator has been answered.
    // A slow camera must not hold up the response, and failures are logged.
    sync.addBooking(plate, selectedCar, site).catch(() => {});
}

module.exports = { input_targhe };
