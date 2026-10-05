'use strict';
const config = require('../config');
const db = require('../lib/db');
const { on_add } = require('../camera_functions');

const TABLE = config.database.table;

function processPlate(plate) {
    // Remove special chars and put every letter in uppercase
    return String(plate).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

// NOTE (Phase 3): check-then-insert still races without a UNIQUE index on
// Targa, and name/dates/bay are not yet validated server-side.
async function input_targhe(req, res) {
    const { name, data_arrivo, data_partenza, selectedCar } = req.body;
    const plate = processPlate(req.body.plate);

    const existing = await db.query(
        `SELECT Targa FROM \`${TABLE}\` WHERE Targa = ?`, [plate]);
    if (existing.length > 0) {
        res.redirect('/loading_existing_plate.html');
        return;
    }

    const result = await db.query(
        `INSERT INTO \`${TABLE}\` (Nome, Targa, Inizio, Fine, Colonnine) ` +
        'VALUES (?, ?, ?, ?, ?)',
        [name, plate, data_arrivo, data_partenza, selectedCar]);

    if (result.affectedRows === 0) {
        res.status(500).json({ error: 'DB_WRITE_FAILED' });
        return;
    }

    console.log('Targa inserita con successo.');
    res.redirect('/loading_success_plate.html');

    // Device sync runs after the operator has been answered: a slow or
    // unreachable camera must not hold up the response. Failures are logged by
    // on_add itself.
    on_add().catch(() => {});
}

module.exports = { input_targhe, processPlate };
