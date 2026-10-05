'use strict';
const config = require('../config');
const db = require('../lib/db');
const { on_rm, on_add } = require('../camera_functions');

const TABLE = config.database.table;

// The success path previously sent no response at all, so the browser hung and
// only the UI's own reload hid it. The device sync also ran from `finally`,
// meaning a failed UPDATE still pushed changes to the cameras.
async function change_targhe(req, res) {
    const { name, data_arrivo, data_partenza, selectedCar } = req.body;
    const plate = req.body.plate;

    const result = await db.query(
        `UPDATE \`${TABLE}\` SET Nome = ?, Inizio = ?, Fine = ?, Colonnine = ? ` +
        'WHERE Targa = ?',
        [name, data_arrivo, data_partenza, selectedCar, plate]);

    if (result.affectedRows === 0) {
        res.status(404).json({ error: 'PLATE_NOT_FOUND' });
        return;
    }

    console.log('Targa aggiornata con successo.');
    res.json({ ok: true });

    // Re-sync only after a successful update.
    on_rm(plate).then(() => on_add()).catch(() => {});
}

module.exports = { change_targhe };
