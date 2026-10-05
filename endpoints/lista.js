'use strict';
const config = require('../config');
const db = require('../lib/db');

const TABLE = config.database.table;

// Returns [] for an empty table. Previously the `if (rows.length > 0)` had no
// else, so an empty database sent no response at all and the list page hung.
async function lista(req, res) {
    const rows = await db.query(`SELECT * FROM \`${TABLE}\``);
    console.log(`List retrieved (${rows.length} row(s))`);
    res.json(rows);
}

module.exports = { lista };
