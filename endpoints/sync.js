'use strict';
const config = require('../config');
const sync = require('../lib/sync');

// Deliberate, operator-triggered reconciliation. Replaces the previous behaviour
// of running a full device sync on every process start.
//
// The mode is taken from configuration and NOT from the request: otherwise an
// unauthenticated caller could escalate a dry run to a live one, or bypass the
// max_adds_per_run ceiling with force. Changing how much the sync is allowed to
// do is a configuration decision, not a request parameter.
//
// NOTE (Phase 5): becomes admin-only and audited.
async function run_sync(req, res) {
    const site = config.getSite(req.body.site || req.query.site);
    const result = await sync.reconcile({ site });
    res.json({
        site: site.id,
        mode: config.sync.mode,
        applied: result.applied,
        reason: result.reason,
        failures: result.failures || [],
        plan: {
            today: result.plan.today,
            cameraListKnown: result.plan.cameraListKnown,
            toAdd: result.plan.toAdd,
            toRemove: result.plan.toRemove,
            baysOn: result.plan.baysOn,
            baysOff: result.plan.baysOff,
            skipped: result.plan.skipped,
        },
    });
}

module.exports = { run_sync };
