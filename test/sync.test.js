'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { computeSync } = require('../lib/sync_plan');

// Fixtures are inlined rather than kept in a shared module: node --test treats
// every file under test/ as a test file, so a helpers.js would be reported as a
// test of its own.
function site(overrides = {}) {
    return {
        id: 'test',
        name: 'Test Site',
        cameras: [{ address: '10.0.0.1', user: 'root', password: 'p' }],
        relay: Object.assign({
            address: '10.0.0.9', user: 'root', password: 'p',
            barrier_port: 1, bay_ports: [9, 10, 11, 12, 13, 14, 15, 16],
            barrier_pulse_ms: 2000,
        }, overrides.relay || {}),
    };
}

function booking(plate, bay, inizio, fine) {
    return { Nome: `guest ${plate}`, Targa: plate, Colonnine: bay, Inizio: inizio, Fine: fine };
}


const TODAY = '2026-03-10';
const S = site();

test('a booking live today is added; its bay is switched on', () => {
    const plan = computeSync([booking('AB123CD', 3, '2026-03-01', '2026-03-20')], null, TODAY, S);
    assert.deepEqual(plan.toAdd, ['AB123CD']);
    assert.deepEqual(plan.toRemove, []);
    assert.deepEqual(plan.baysOn, [3]);
    assert.deepEqual(plan.baysOff, []);
});

test('a booking that ended yesterday is removed; its bay is switched off', () => {
    const plan = computeSync([booking('AB123CD', 3, '2026-02-01', '2026-03-09')], null, TODAY, S);
    assert.deepEqual(plan.toAdd, []);
    assert.deepEqual(plan.toRemove, ['AB123CD']);
    assert.deepEqual(plan.baysOff, [3]);
});

test('a booking starting tomorrow is neither added nor removed', () => {
    const plan = computeSync([booking('AB123CD', 3, '2026-03-11', '2026-03-20')], null, TODAY, S);
    assert.deepEqual(plan.toAdd, []);
    assert.deepEqual(plan.toRemove, []);
    assert.deepEqual(plan.baysOn, []);
    assert.deepEqual(plan.baysOff, []);
});

test('REGRESSION: an ancient booking is removed, never added', () => {
    // The old predicate was `DATE(Inizio) <= CURDATE()`, which matched every
    // booking ever recorded. With the loops repaired that would have pushed the
    // entire history of the table at the cameras.
    const plan = computeSync([booking('OLD111', 2, '2024-01-01', '2024-01-10')], null, TODAY, S);
    assert.deepEqual(plan.toAdd, [], 'a 2024 booking must not be re-added');
    assert.deepEqual(plan.toRemove, ['OLD111']);
});

test('a plate with both an expired and a live booking is kept', () => {
    const plan = computeSync([
        booking('AB123CD', 3, '2026-02-01', '2026-03-09'),   // expired
        booking('AB123CD', 4, '2026-03-10', '2026-03-20'),   // rebooked
    ], null, TODAY, S);
    assert.deepEqual(plan.toRemove, [], 'the guest has rebooked — do not revoke');
    assert.deepEqual(plan.toAdd, ['AB123CD']);
});

test('a bay reused by a live booking is NOT switched off', () => {
    // Would otherwise kill the incoming guest's charger.
    const plan = computeSync([
        booking('OLD111', 5, '2026-02-01', '2026-03-09'),    // expired, bay 5
        booking('NEW222', 5, '2026-03-10', '2026-03-20'),    // live, same bay
    ], null, TODAY, S);
    assert.deepEqual(plan.baysOff, [], 'bay 5 is occupied again');
    assert.deepEqual(plan.baysOn, [5]);
});

test('plates are normalised before comparison', () => {
    const plan = computeSync([booking('ab-123 cd', 1, '2026-03-01', '2026-03-20')], null, TODAY, S);
    assert.deepEqual(plan.toAdd, ['AB123CD']);
});

test('a bay outside the site wiring is reported but the plate still syncs', () => {
    const plan = computeSync([booking('AB123CD', 99, '2026-03-01', '2026-03-20')], null, TODAY, S);
    assert.deepEqual(plan.toAdd, ['AB123CD']);
    assert.deepEqual(plan.baysOn, [], 'no relay call for an impossible bay');
    assert.equal(plan.skipped.length, 1);
    assert.equal(plan.skipped[0].reason, 'BAY_OUT_OF_RANGE');
});

test('unparseable or inverted dates are skipped, not guessed at', () => {
    const plan = computeSync([
        booking('BAD111', 1, 'not-a-date', '2026-03-20'),
        booking('BAD222', 2, '2026-03-20', '2026-03-01'),
        { Targa: '', Colonnine: 3, Inizio: '2026-03-01', Fine: '2026-03-20' },
    ], null, TODAY, S);
    assert.deepEqual(plan.toAdd, []);
    assert.deepEqual(plan.skipped.map((s) => s.reason),
        ['UNPARSEABLE_DATES', 'END_BEFORE_START', 'EMPTY_PLATE']);
});

test('with the camera list known, already-present plates are not re-added', () => {
    const rows = [
        booking('HERE11', 1, '2026-03-01', '2026-03-20'),
        booking('MISS22', 2, '2026-03-01', '2026-03-20'),
    ];
    const plan = computeSync(rows, ['HERE11'], TODAY, S);
    assert.ok(plan.cameraListKnown);
    assert.deepEqual(plan.toAdd, ['MISS22']);
});

test('with the camera list known, a plate it does not have is not removed', () => {
    const plan = computeSync([booking('GONE11', 1, '2026-02-01', '2026-03-09')], [], TODAY, S);
    assert.deepEqual(plan.toRemove, [], 'nothing to delete if it is not there');
});

test('unknown camera list means no diffing, and never "delete everything"', () => {
    // readCameraPlates returns null when the list cannot be read. If that ever
    // became [] instead, pruneUnknown would read it as "nothing provisioned".
    const rows = [booking('AB123CD', 1, '2026-03-01', '2026-03-20')];
    const plan = computeSync(rows, null, TODAY, S, { pruneUnknown: true });
    assert.equal(plan.cameraListKnown, false);
    assert.deepEqual(plan.extraOnCamera, []);
    assert.deepEqual(plan.toRemove, [], 'pruning must not act on an unknown list');
    assert.deepEqual(plan.toAdd, ['AB123CD']);
});

test('pruneUnknown only removes unexpected plates when explicitly enabled', () => {
    const rows = [booking('KNOWN1', 1, '2026-03-01', '2026-03-20')];
    const onCamera = ['KNOWN1', 'MANUAL9'];

    const careful = computeSync(rows, onCamera, TODAY, S);
    assert.deepEqual(careful.toRemove, [], 'a hand-added plate is left alone by default');
    assert.deepEqual(careful.extraOnCamera, ['MANUAL9'], 'but it is reported');

    const pruning = computeSync(rows, onCamera, TODAY, S, { pruneUnknown: true });
    assert.deepEqual(pruning.toRemove, ['MANUAL9']);
});

test('duplicate rows collapse to one action each', () => {
    const plan = computeSync([
        booking('SAME11', 3, '2026-03-01', '2026-03-20'),
        booking('SAME11', 3, '2026-03-02', '2026-03-21'),
    ], null, TODAY, S);
    assert.deepEqual(plan.toAdd, ['SAME11']);
    assert.deepEqual(plan.baysOn, [3]);
});

test('an empty table produces no actions at all', () => {
    const plan = computeSync([], null, TODAY, S);
    assert.deepEqual(plan.toAdd, []);
    assert.deepEqual(plan.toRemove, []);
    assert.deepEqual(plan.baysOn, []);
    assert.deepEqual(plan.baysOff, []);
});
