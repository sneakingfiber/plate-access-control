'use strict';
const config = require('../config');
const db = require('../lib/db');
const sync = require('../lib/sync');
const { validateBooking } = require('../lib/validate');
const { badRequest, notFound } = require('../middleware/app_error');

const TABLE = config.database.table;

// Called over AJAX, so it answers in JSON. The plate itself is read-only in the
// edit modal; name, dates and bay may change.
async function change_targhe(req, res) {
    const site = config.getSite(req.body.site);
    const check = validateBooking(req.body, site.relay.bay_ports);
    if (!check.ok) throw badRequest('VALIDATION_FAILED', check.errors);

    const { name, plate, data_arrivo, data_partenza, selectedCar } = check.value;

    const before = await db.query(
        `SELECT Colonnine FROM \`${TABLE}\` WHERE Targa = ?`, [plate]);
    if (before.length === 0) throw notFound('PLATE_NOT_FOUND');
    const previousBay = Number(before[0].Colonnine);

    const result = await db.query(
        `UPDATE \`${TABLE}\` SET Nome = ?, Inizio = ?, Fine = ?, Colonnine = ? WHERE Targa = ?`,
        [name, data_arrivo, data_partenza, selectedCar, plate]);

    console.log('Targa aggiornata con successo:', plate);
    res.json({ ok: true, changed: result.affectedRows });

    // Re-sync only after a successful update, and only this record. If the bay
    // moved, the old one is switched off first — removeBooking is not used here
    // because it would delete the row we just updated.
    (async () => {
        if (previousBay && previousBay !== selectedCar) {
            await sync.releaseBay(previousBay, plate, site).catch(() => {});
        }
        await sync.addBooking(plate, selectedCar, site);
    })().catch(() => {});
}

module.exports = { change_targhe };
