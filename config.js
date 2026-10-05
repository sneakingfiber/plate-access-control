'use strict';
// Loads and validates configuration, then exposes it to the rest of the app.
//
//   config.json        committed template, placeholders for every secret
//   config.local.json  optional, gitignored, layered on top
//
// A deployment copies the template's keys into config.local.json rather than
// editing the tracked file, so `git pull` never conflicts with local settings.
//
// Requiring this module THROWS when configuration is invalid. That is
// deliberate: a gate controller should refuse to start rather than discover at
// 00:08 that it cannot reach a camera, or drive the wrong relay port.

const fs = require('fs');
const path = require('path');
const schema = require('./lib/config_schema');

const TEMPLATE = process.env.PAC_CONFIG || path.join(__dirname, 'config.json');
const LOCAL = process.env.PAC_CONFIG_LOCAL || path.join(__dirname, 'config.local.json');

function readJson(file, required) {
    if (!fs.existsSync(file)) {
        if (required) throw new Error(`configuration file not found: ${file}`);
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        throw new Error(`${file} is not valid JSON: ${err.message}`);
    }
}

function load() {
    const template = readJson(TEMPLATE, true);
    const local = readJson(LOCAL, false);
    const merged = local ? schema.deepMerge(template, local) : template;
    const cfg = schema.normalize(merged);

    const errors = schema.validate(cfg);
    if (errors.length > 0) {
        const hint = local
            ? `Edit ${path.basename(LOCAL)} to correct these.`
            : `Copy ${path.basename(TEMPLATE)} to ${path.basename(LOCAL)} and fill it in.`;
        throw new Error(
            `Invalid configuration (${errors.length} problem(s)):\n`
            + errors.map((e) => `  - ${e}`).join('\n')
            + `\n${hint}`);
    }
    return cfg;
}

const cfg = load();
const byId = new Map(cfg.sites.map((s) => [s.id, s]));

function getSite(id) {
    if (id === undefined || id === null || id === '') return cfg.sites[0];
    const site = byId.get(String(id));
    if (!site) throw new Error(`unknown site "${id}"`);
    return site;
}

module.exports = {
    ...cfg,

    // Site-aware API. New code uses these.
    getSite,
    listSites: () => cfg.sites.map(({ id, name }) => ({ id, name })),
    defaultSite: () => cfg.sites[0],
    isMultiSite: () => cfg.sites.length > 1,
    resolveBayPort: (siteOrId, bay) =>
        schema.resolveBayPort(typeof siteOrId === 'object' ? siteOrId : getSite(siteOrId), bay),
    bayForPort: (siteOrId, port) =>
        schema.bayForPort(typeof siteOrId === 'object' ? siteOrId : getSite(siteOrId), port),
    bayCount: (siteOrId) =>
        schema.bayCount(typeof siteOrId === 'object' ? siteOrId : getSite(siteOrId)),

    // Deprecated flat keys from before multi-site, derived from the first site.
    // Kept so the existing endpoints keep working while they are migrated.
    ...schema.legacyAliases(cfg),
};
