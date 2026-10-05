'use strict';
const { on_rm } = require('../camera_functions');

// on_rm removes the plate from the cameras, switches its bay off and deletes
// the row, in that order, because it needs the booking's bay before the row
// goes. This handler previously sent no response on any path.
async function delete_targhe(req, res) {
    const plate = req.body.plate;
    if (!plate) {
        res.status(400).json({ error: 'PLATE_REQUIRED' });
        return;
    }
    await on_rm(plate);
    console.log('Targa cancellata con successo.');
    res.json({ ok: true });
}

module.exports = { delete_targhe };
