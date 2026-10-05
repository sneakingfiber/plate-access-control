'use strict';
const config = require('../config');
const devices = require('../lib/devices');
const { badRequest } = require('../middleware/app_error');

// Toggles one charging bay.
//
// This handler was the most dangerous thing in the codebase. It passed the UI's
// bay number (1..8) straight to the relay as a port number, while the barrier
// sits on port 1 — so bay 1 would have opened the gate. It was masked only by a
// second bug: parseResponse was called without its portId argument, so it
// searched for "portundefined", always returned undefined, and neither branch
// of the toggle ever ran.
//
// Now the bay number stays a bay number. lib/devices resolves it to a port via
// the site's bay_ports and refuses outright to return barrier_port.
async function change_state(req, res) {
    const site = config.getSite(req.body.site);
    const bay = Number(req.body.id);

    if (!Number.isInteger(bay) || bay < 1 || bay > config.bayCount(site)) {
        throw badRequest('INVALID_BAY', { bay: req.body.id, max: config.bayCount(site) });
    }

    const { byBay } = await devices.readBayStates(site);
    const current = byBay[bay];
    console.log(`bay ${bay} is currently ${current}`);

    if (current !== 'active' && current !== 'inactive') {
        throw badRequest('BAY_STATE_UNKNOWN', { bay, reported: current });
    }

    const turnOn = current === 'inactive';
    await (turnOn ? devices.bayOn(site, bay) : devices.bayOff(site, bay));

    const next = turnOn ? 'active' : 'inactive';
    console.log(`bay ${bay} switched to ${next}`);
    res.json({ bay, previous: current, state: next });
}

module.exports = { change_state };
