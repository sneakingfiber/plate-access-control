'use strict';
// Pure configuration helpers: no disk, no network, no side effects.
// config.js does the file loading; everything here is testable in isolation.

const PLACEHOLDER = 'CHANGE_ME';
const IDENT = /^[A-Za-z0-9_]+$/;      // SQL identifier: cannot be a bound parameter
const SITE_ID = /^[A-Za-z0-9_-]+$/;

///////////////////////////////////////////////////////////////////////////////
// helpers

function isObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isInt(v, min, max) {
    return Number.isInteger(v) && v >= min && v <= max;
}

function isText(v) {
    return typeof v === 'string' && v.trim() !== '';
}

// Deep merge used to layer config.local.json over the committed template.
// Arrays are replaced wholesale, never merged element-wise: a local override
// listing two cameras must not leave a third behind from the template.
function deepMerge(base, override) {
    if (!isObject(base) || !isObject(override)) {
        return override === undefined ? base : override;
    }
    const out = { ...base };
    for (const [key, value] of Object.entries(override)) {
        out[key] = isObject(value) && isObject(base[key])
            ? deepMerge(base[key], value)
            : value;
    }
    return out;
}

// Every string still left at the placeholder, reported by dotted path so the
// message names the key the user has to edit.
function findPlaceholders(node, path = '', found = []) {
    if (typeof node === 'string') {
        if (node === PLACEHOLDER) found.push(path);
    } else if (Array.isArray(node)) {
        node.forEach((v, i) => findPlaceholders(v, `${path}[${i}]`, found));
    } else if (isObject(node)) {
        for (const [k, v] of Object.entries(node)) {
            findPlaceholders(v, path ? `${path}.${k}` : k, found);
        }
    }
    return found;
}

///////////////////////////////////////////////////////////////////////////////
// defaults

function normalize(raw) {
    const cfg = deepMerge({
        server: { port: 3000, language: 'it' },
        database: { host: 'localhost', port: 3306, name: '', user: '', password: '', table: 'veicoli' },
        mail: { enabled: false, host: '', port: 587, user: '', password: '', from: '', to: '' },
        sync: { mode: 'dryrun', max_adds_per_run: 25, device_timeout_ms: 5000 },
        sites: [],
    }, raw || {});

    cfg.sites = (cfg.sites || []).map((site) => deepMerge({
        id: '',
        name: '',
        cameras: [],
        relay: { address: '', user: '', password: '', barrier_port: null, bay_ports: [], barrier_pulse_ms: 2000 },
    }, site || {}));

    // from defaults to the authenticating user, matching the single-address
    // behaviour the original config had.
    if (!isText(cfg.mail.from)) cfg.mail.from = cfg.mail.user;
    return cfg;
}

///////////////////////////////////////////////////////////////////////////////
// validation — returns every problem at once, so one run lists all edits needed

function validate(cfg) {
    const errors = [];
    const bad = (msg) => errors.push(msg);

    for (const path of findPlaceholders(cfg)) {
        bad(`${path} is still "${PLACEHOLDER}" — edit it before starting`);
    }

    if (!isInt(cfg.server.port, 1, 65535)) bad('server.port must be an integer 1-65535');
    if (!isText(cfg.server.language)) bad('server.language must be a non-empty string');

    const db = cfg.database;
    if (!isText(db.host)) bad('database.host must be a non-empty string');
    if (!isInt(db.port, 1, 65535)) bad('database.port must be an integer 1-65535');
    if (!isText(db.name)) bad('database.name must be a non-empty string');
    if (!isText(db.user)) bad('database.user must be a non-empty string');
    if (typeof db.password !== 'string') bad('database.password must be a string (may be empty)');
    // Interpolated into SQL as an identifier, so it is validated here rather
    // than bound at the call site.
    if (!IDENT.test(String(db.table || ''))) bad('database.table must match /^[A-Za-z0-9_]+$/');

    const mail = cfg.mail;
    if (typeof mail.enabled !== 'boolean') bad('mail.enabled must be true or false');
    if (mail.enabled) {
        if (!isText(mail.host)) bad('mail.host is required when mail.enabled is true');
        if (!isInt(mail.port, 1, 65535)) bad('mail.port must be an integer 1-65535');
        if (!isText(mail.user)) bad('mail.user is required when mail.enabled is true');
        if (typeof mail.password !== 'string') bad('mail.password must be a string');
        if (!isText(mail.to)) bad('mail.to is required when mail.enabled is true');
    }

    const sync = cfg.sync;
    if (!['off', 'dryrun', 'live'].includes(sync.mode)) bad("sync.mode must be 'off', 'dryrun' or 'live'");
    if (!isInt(sync.max_adds_per_run, 1, 100000)) bad('sync.max_adds_per_run must be a positive integer');
    if (!isInt(sync.device_timeout_ms, 100, 120000)) bad('sync.device_timeout_ms must be 100-120000');

    if (!Array.isArray(cfg.sites) || cfg.sites.length === 0) {
        bad('sites must be a non-empty array');
        return errors;
    }

    const seen = new Set();
    cfg.sites.forEach((site, i) => {
        const at = `sites[${i}]`;
        if (!SITE_ID.test(String(site.id || ''))) {
            bad(`${at}.id must match /^[A-Za-z0-9_-]+$/`);
        } else if (seen.has(site.id)) {
            bad(`${at}.id "${site.id}" is duplicated`);
        } else {
            seen.add(site.id);
        }
        if (!isText(site.name)) bad(`${at}.name must be a non-empty string`);

        if (!Array.isArray(site.cameras) || site.cameras.length === 0) {
            bad(`${at}.cameras must list at least one camera`);
        } else {
            site.cameras.forEach((cam, c) => {
                if (!isObject(cam)) return bad(`${at}.cameras[${c}] must be an object`);
                if (!isText(cam.address)) bad(`${at}.cameras[${c}].address must be a non-empty string`);
                if (!isText(cam.user)) bad(`${at}.cameras[${c}].user must be a non-empty string`);
                if (typeof cam.password !== 'string') bad(`${at}.cameras[${c}].password must be a string`);
            });
        }

        const relay = site.relay;
        if (!isObject(relay)) return bad(`${at}.relay must be an object`);
        if (!isText(relay.address)) bad(`${at}.relay.address must be a non-empty string`);
        if (!isText(relay.user)) bad(`${at}.relay.user must be a non-empty string`);
        if (typeof relay.password !== 'string') bad(`${at}.relay.password must be a string`);
        if (!isInt(relay.barrier_pulse_ms, 1, 600000)) bad(`${at}.relay.barrier_pulse_ms must be 1-600000`);
        if (!isInt(relay.barrier_port, 1, 9999)) bad(`${at}.relay.barrier_port must be an integer 1-9999`);

        if (!Array.isArray(relay.bay_ports) || relay.bay_ports.length === 0) {
            bad(`${at}.relay.bay_ports must be a non-empty array of port numbers`);
            return;
        }
        const ports = new Set();
        relay.bay_ports.forEach((port, b) => {
            if (!isInt(port, 1, 9999)) {
                bad(`${at}.relay.bay_ports[${b}] must be an integer 1-9999`);
                return;
            }
            if (ports.has(port)) bad(`${at}.relay.bay_ports contains port ${port} more than once`);
            ports.add(port);
            // The invariant that keeps a bay toggle from opening the gate.
            if (port === relay.barrier_port) {
                bad(`${at}.relay.bay_ports[${b}] is ${port}, which is also barrier_port — `
                    + 'a bay must never share the barrier relay port');
            }
        });
    });

    return errors;
}

///////////////////////////////////////////////////////////////////////////////
// lookups — the only sanctioned way to turn a bay number into a relay port

function resolveBayPort(site, bay) {
    const n = Number(bay);
    const ports = site && site.relay ? site.relay.bay_ports : null;
    if (!Array.isArray(ports)) {
        throw new Error(`site "${site && site.id}" has no bay_ports configured`);
    }
    if (!Number.isInteger(n) || n < 1 || n > ports.length) {
        throw new Error(
            `bay ${bay} is out of range for site "${site.id}" (valid: 1-${ports.length})`);
    }
    const port = ports[n - 1];
    // Defence in depth: validate() already rejects this, but a bay must never
    // be able to address the barrier even if config is reloaded unvalidated.
    if (port === site.relay.barrier_port) {
        throw new Error(
            `refusing to drive barrier port ${port} as bay ${n} on site "${site.id}"`);
    }
    return port;
}

function bayForPort(site, port) {
    const i = site.relay.bay_ports.indexOf(Number(port));
    return i === -1 ? null : i + 1;
}

function bayCount(site) {
    return site.relay.bay_ports.length;
}

///////////////////////////////////////////////////////////////////////////////
// Flat aliases for the pre-generalization call sites, derived from the FIRST
// site. Lets the existing endpoints keep working while they are migrated to
// the site-aware API one at a time. Single-site installs only; multi-site code
// must use getSite()/resolveBayPort().

function legacyAliases(cfg) {
    const site = cfg.sites[0];
    const cams = site.cameras;
    return {
        dbHost: cfg.database.host,
        dbName: cfg.database.name,
        dbUser: cfg.database.user,
        dbPassword: cfg.database.password,
        tableName: cfg.database.table,
        ip1: cams[0] ? cams[0].address : undefined,
        ip2: cams[1] ? cams[1].address : undefined,
        ip_relay: site.relay.address,
        camerauser: cams[0] ? cams[0].user : undefined,
        cameraPassword: cams[0] ? cams[0].password : undefined,
        relayuser: site.relay.user,
        relaypassword: site.relay.password,
        emailaddress: cfg.mail.user,
        emailreceiver: cfg.mail.to,
        emailpassword: cfg.mail.password,
        smtp_port: String(cfg.mail.port),
        host: cfg.mail.host,
    };
}

module.exports = {
    PLACEHOLDER,
    deepMerge,
    findPlaceholders,
    normalize,
    validate,
    resolveBayPort,
    bayForPort,
    bayCount,
    legacyAliases,
};
