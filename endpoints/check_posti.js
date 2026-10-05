'use strict';
const config = require('../config');
const db = require('../lib/db');

const TABLE = config.database.table;

// Bays already taken for the requested range.
//
// NOTE (Phase 3): this overlap test misses a booking entirely contained within
// the requested range, so such a bay is reported free and can be double-booked.
// The correct predicate is `Inizio <= :departure AND Fine >= :arrival`.
async function check_posti(req, res) {
    const { data_arrivo, data_partenza } = req.body;
    console.log('checking free spots...');
    const rows = await db.query(
        `SELECT Colonnine FROM \`${TABLE}\` ` +
        'WHERE (? BETWEEN Inizio AND Fine) OR (? BETWEEN Inizio AND Fine)',
        [data_arrivo, data_partenza]);
    res.json(rows.map((row) => row.Colonnine));
}

module.exports = { check_posti };
