'use strict';
const config = require('../config');
const db = require('../lib/db');
const { validateDate } = require('../lib/validate');

const TABLE = config.database.table;

// Bays already occupied during the requested range.
//
// The predicate used to ask whether the requested arrival OR departure fell
// inside an existing booking. That misses a requested range which fully
// CONTAINS an existing booking — neither endpoint is inside it — so the bay was
// reported free and could be double-booked. Two closed ranges overlap exactly
// when each starts no later than the other ends.
async function check_posti(req, res) {
    const arrival = validateDate(req.body.data_arrivo, 'ARRIVAL_DATE_INVALID');
    const departure = validateDate(req.body.data_partenza, 'DEPARTURE_DATE_INVALID');
    // The form asks as soon as one date is typed, so an incomplete pair is
    // normal: answer "nothing occupied" rather than erroring at the operator.
    if (!arrival.ok || !departure.ok) {
        res.json([]);
        return;
    }

    const rows = await db.query(
        `SELECT Colonnine FROM \`${TABLE}\` WHERE Inizio <= ? AND Fine >= ?`,
        [departure.value, arrival.value]);
    res.json(rows.map((row) => row.Colonnine));
}

module.exports = { check_posti };
