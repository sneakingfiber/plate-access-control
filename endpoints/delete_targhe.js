'use strict';
const config = require('../config');
const sync = require('../lib/sync');
const { validatePlate } = require('../lib/validate');
const { badRequest, notFound } = require('../middleware/app_error');

// removeBooking takes the plate off the cameras, switches its bay off unless
// another live booking occupies it, then deletes the row — in that order,
// because the bay is only knowable before the row goes.
async function delete_targhe(req, res) {
    const site = config.getSite(req.body.site);
    const check = validatePlate(req.body.plate);
    if (!check.ok) throw badRequest(check.code);

    const { deleted, bay } = await sync.removeBooking(check.value, site);
    if (deleted === 0) throw notFound('PLATE_NOT_FOUND');

    console.log('Targa cancellata con successo:', check.value);
    res.json({ ok: true, bay });
}

module.exports = { delete_targhe };
