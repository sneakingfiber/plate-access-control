'use strict';
const config = require('../config');
const db = require('../lib/db');
const { validateDate, normalizePlate } = require('../lib/validate');

const TABLE = config.database.table;

// As check_posti, but excludes the booking being edited so its own bay is not
// reported as occupied against itself. Same corrected overlap predicate.
async function check_posti_modal(req, res) {
    const arrival = validateDate(req.body.data_arrivo, 'ARRIVAL_DATE_INVALID');
    const departure = validateDate(req.body.data_partenza, 'DEPARTURE_DATE_INVALID');
    if (!arrival.ok || !departure.ok) {
        res.json([]);
        return;
    }
    // Normalised, or the exclusion silently fails to match the stored plate.
    const plate = normalizePlate(req.body.plate);

    const rows = await db.query(
        `SELECT Colonnine FROM \`${TABLE}\` WHERE Targa <> ? AND Inizio <= ? AND Fine >= ?`,
        [plate, departure.value, arrival.value]);
    res.json(rows.map((row) => row.Colonnine));
}

module.exports = { check_posti_modal };
