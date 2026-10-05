'use strict';
const config = require('../config');
const devices = require('../lib/devices');

// NOTE (Phase 5): still reachable unauthenticated, and still a GET, so an
// <img> tag or a prefetch can open the gate. Becomes an authenticated POST
// with CSRF protection and an audit record.
async function open_barrier(req, res) {
    const site = config.getSite(req.query.site || req.body.site);
    console.log(`Opening barrier on site "${site.id}" ` +
        `(port ${site.relay.barrier_port}, ${site.relay.barrier_pulse_ms}ms)`);
    await devices.pulseBarrier(site);
    console.log('Barrier opened successfully');
    res.json({ ok: true });
}

module.exports = { open_barrier };
