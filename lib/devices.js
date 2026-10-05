'use strict';
// The only place that talks to AXIS hardware.
//
// Everything funnels through deviceFetch so that timeouts, error propagation
// and the bay/barrier port check exist in exactly one place. Previously each
// endpoint built its own DigestClient, had no timeout at all (a hung camera
// pinned an Express request forever), and swallowed failures with console.error
// so a device that stopped responding looked identical to success.
//
// The VAPIX query shapes are kept verbatim from the working implementation.

// digest-fetch has an undeclared runtime dependency on node-fetch: it calls
// require('node-fetch') but lists it in neither dependencies nor
// peerDependencies, and it always takes that branch because its `var fetch`
// hoists and shadows the global fetch. So node-fetch must stay an explicit
// dependency of this project, pinned to v2 (v3+ is ESM-only). Do not "clean it
// up" as unused — nothing in our own code requires it.
const DigestClient = require('digest-fetch');
const schema = require('./config_schema');
const { deviceError } = require('../middleware/app_error');
const config = require('../config');

const DEFAULT_TIMEOUT_MS = 5000;

function timeoutMs() {
    return (config.sync && config.sync.device_timeout_ms) || DEFAULT_TIMEOUT_MS;
}

///////////////////////////////////////////////////////////////////////////////
// transport

// Rejects on timeout, transport failure, or any non-2xx response. Callers that
// want to tolerate a dead device must catch deliberately; silence is never the
// default.
async function deviceFetch(address, credentials, queryPath, { expect = 'text' } = {}) {
    const url = `http://${address}${queryPath}`;
    const client = new DigestClient(credentials.user, credentials.password);
    const controller = new AbortController();
    const ms = timeoutMs();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        const response = await client.fetch(url, { method: 'GET', signal: controller.signal });
        if (!response.ok) {
            throw deviceError('DEVICE_REJECTED',
                { address, status: response.status, statusText: response.statusText });
        }
        return expect === 'none' ? null : await response.text();
    } catch (err) {
        // Surfaced as 502 rather than 500: a device that is off or unplugged is
        // an operational condition, not a bug in this application, and the
        // operator needs to be able to tell those apart.
        if (err.name === 'AbortError') {
            throw deviceError('DEVICE_TIMEOUT', { address, timeout_ms: ms });
        }
        throw deviceError('DEVICE_UNREACHABLE', { address, reason: err.message });
    } finally {
        clearTimeout(timer);
    }
}

///////////////////////////////////////////////////////////////////////////////
// plate allow-list (camera LPR application)

async function addPlate(camera, plate) {
    const p = encodeURIComponent(plate);
    return deviceFetch(camera.address, camera,
        `/local/fflprapp/api.cgi?api=addplate&plate=${p}&list=allow`);
}

async function removePlate(camera, plate) {
    const p = encodeURIComponent(plate);
    return deviceFetch(camera.address, camera,
        `/local/fflprapp/api.cgi?api=delplate&plate=${p}&list=allow`);
}

///////////////////////////////////////////////////////////////////////////////
// relay I/O
//
// AXIS port.cgi action syntax: '/' closes (activates) a port, '\' opens
// (deactivates) it, and a number between them is a delay in milliseconds.

// Guards every relay write. A caller must never be able to address the barrier
// through a bay-shaped call, whatever it passes.
function assertNotBarrier(site, port) {
    // Deliberately strict about what counts as a port. Number(null), Number('')
    // and Number(false) are all 0, which passes Number.isInteger and would
    // otherwise sail through as "port 0".
    const n = typeof port === 'number'
        ? port
        : (typeof port === 'string' && port.trim() !== '' ? Number(port) : NaN);
    if (!Number.isInteger(n) || n < 1 || n > 9999) {
        throw new Error(`relay port must be an integer 1-9999, got ${JSON.stringify(port)}`);
    }
    if (site && site.relay && n === site.relay.barrier_port) {
        throw new Error(
            `refusing to drive barrier port ${n} as a bay on site "${site.id}" `
            + '— use pulseBarrier() for the barrier');
    }
    return n;
}

// `bay` is the site-local bay number (1..N), never a raw port.
async function bayOn(site, bay) {
    const port = assertNotBarrier(site, schema.resolveBayPort(site, bay));
    return deviceFetch(site.relay.address, site.relay,
        `/axis-cgi/io/port.cgi?action=${port}::/`);
}

async function bayOff(site, bay) {
    const port = assertNotBarrier(site, schema.resolveBayPort(site, bay));
    return deviceFetch(site.relay.address, site.relay,
        `/axis-cgi/io/port.cgi?action=${port}:%5C`);
}

async function pulseBarrier(site) {
    const port = site.relay.barrier_port;
    const ms = site.relay.barrier_pulse_ms;
    return deviceFetch(site.relay.address, site.relay,
        `/axis-cgi/io/port.cgi?action=${port}:/${ms}%5C`);
}

// Reads the bays' ports only. The barrier is read separately so a status poll
// can never be confused about which value belongs to the gate.
async function readBayStates(site) {
    const ports = site.relay.bay_ports;
    const text = await deviceFetch(site.relay.address, site.relay,
        `/axis-cgi/io/port.cgi?checkactive=${ports.join(',')}`);
    const byPort = parsePortStates(text);
    // Re-key by bay number so callers never index by array position.
    const byBay = {};
    ports.forEach((port, i) => { byBay[i + 1] = byPort[port] ?? null; });
    return { byBay, byPort };
}

async function readBarrierState(site) {
    const port = site.relay.barrier_port;
    const text = await deviceFetch(site.relay.address, site.relay,
        `/axis-cgi/io/port.cgi?checkactive=${port}`);
    return parsePortStates(text)[port] ?? null;
}

// Parses `port9=active` lines into { 9: 'active' }, keyed by port NUMBER.
// The old implementations keyed by the raw left-hand side and were then indexed
// by array position, which is how the barrier's value ended up misaligned with
// the bay tiles.
function parsePortStates(text) {
    const out = {};
    String(text || '').split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const eq = trimmed.indexOf('=');
        if (eq === -1) return;
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim();
        const match = key.match(/(\d+)\s*$/);
        if (match) out[Number(match[1])] = value;
    });
    return out;
}

///////////////////////////////////////////////////////////////////////////////
// reachability — replaces the old exec('ping -n 1 ...'), which used the Windows
// flag (macOS and Linux reject it outright), inverted its result, and shelled
// out with an interpolated address. A TCP connect answers the question that
// actually matters: is the HTTP API up?

const net = require('net');

function tcpReachable(address, port = 80, ms = 2000) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        const done = (result) => { socket.destroy(); resolve(result); };
        socket.setTimeout(ms);
        socket.once('connect', () => done(true));
        socket.once('timeout', () => done(false));
        socket.once('error', () => done(false));
        socket.connect(port, address);
    });
}

async function siteReachability(site) {
    const targets = [
        ...site.cameras.map((c) => ({ role: 'camera', address: c.address })),
        { role: 'relay', address: site.relay.address },
    ];
    const results = await Promise.all(
        targets.map(async (t) => ({ ...t, up: await tcpReachable(t.address) })));
    return results;
}

module.exports = {
    deviceFetch,
    addPlate,
    removePlate,
    bayOn,
    bayOff,
    pulseBarrier,
    readBayStates,
    readBarrierState,
    parsePortStates,
    assertNotBarrier,
    tcpReachable,
    siteReachability,
};
