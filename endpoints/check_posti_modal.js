'use strict';
const config = require('../config');
const db = require('../lib/db');

const TABLE = config.database.table;

// As check_posti, but excludes the booking being edited. Carries the same
// overlap-predicate flaw, corrected in Phase 3.
async function check_posti_modal(req, res) {
    const { plate, data_arrivo, data_partenza } = req.body;
    console.log('checking free spots...');
    const rows = await db.query(
        `SELECT Colonnine FROM \`${TABLE}\` ` +
        'WHERE Targa <> ? ' +
        'AND ((? BETWEEN Inizio AND Fine) OR (? BETWEEN Inizio AND Fine))',
        [plate, data_arrivo, data_partenza]);
    res.json(rows.map((row) => row.Colonnine));
}

module.exports = { check_posti_modal };
