'use strict';
const config = require('../config');
const devices = require('../lib/devices');

// Bay states keyed by BAY number (1..N), not by relay port and not by array
// position. The previous version asked the relay for ports 1,9..16 — nine
// values for eight tiles — and the page mapped them by index, so the barrier's
// state was rendered as bay 1 and every tile after it was off by one.
async function checkactive(req, res) {
    const site = config.getSite(req.query.site || req.body.site);
    const { byBay } = await devices.readBayStates(site);
    console.log('Risposta:', byBay);
    res.json(byBay);
}

module.exports = { checkactive };
