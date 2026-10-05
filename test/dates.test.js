'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { toDateKey, isValidDateKey, overlaps, isActiveOn, isExpiredOn } = require('../lib/dates');

test('toDateKey normalises strings and Dates to the same local calendar day', () => {
    assert.equal(toDateKey('2026-03-04'), '2026-03-04');
    assert.equal(toDateKey('2026-03-04T22:00:00.000Z'), '2026-03-04');
    // A Date must be read in local time. Using toISOString() here is what shifts
    // a booking by a day for anyone east or west of UTC.
    assert.equal(toDateKey(new Date(2026, 2, 4)), '2026-03-04');
    assert.equal(toDateKey(null), null);
    assert.equal(toDateKey('nonsense'), null);
    assert.equal(toDateKey(new Date('nonsense')), null);
});

test('isValidDateKey rejects well-formed but non-existent dates', () => {
    assert.ok(isValidDateKey('2024-02-29'));      // leap year
    assert.ok(!isValidDateKey('2026-02-29'));     // not a leap year
    assert.ok(!isValidDateKey('2026-02-30'));
    assert.ok(!isValidDateKey('2026-13-01'));
    assert.ok(!isValidDateKey('2026-00-10'));
    assert.ok(!isValidDateKey('26-01-01'));
});

test('overlaps catches a range that fully CONTAINS another', () => {
    // The regression that caused double-booking: the old predicate asked whether
    // either endpoint fell inside the existing booking, and neither does here.
    assert.ok(overlaps('2026-03-01', '2026-03-31', '2026-03-10', '2026-03-12'));
    assert.ok(overlaps('2026-03-10', '2026-03-12', '2026-03-01', '2026-03-31'));
});

test('overlaps handles touching, partial and disjoint ranges', () => {
    assert.ok(overlaps('2026-03-01', '2026-03-10', '2026-03-10', '2026-03-20'), 'shared endpoint overlaps');
    assert.ok(overlaps('2026-03-01', '2026-03-10', '2026-03-05', '2026-03-20'), 'partial');
    assert.ok(!overlaps('2026-03-01', '2026-03-09', '2026-03-10', '2026-03-20'), 'adjacent days do not overlap');
    assert.ok(!overlaps('2026-03-20', '2026-03-25', '2026-03-01', '2026-03-10'));
});

test('access runs to the end of the departure day', () => {
    assert.ok(isActiveOn('2026-03-01', '2026-03-05', '2026-03-05'), 'live on the departure day itself');
    assert.ok(isActiveOn('2026-03-01', '2026-03-05', '2026-03-01'), 'live on the arrival day');
    assert.ok(!isActiveOn('2026-03-01', '2026-03-05', '2026-02-28'), 'not live before arrival');
    assert.ok(!isActiveOn('2026-03-01', '2026-03-05', '2026-03-06'));

    assert.ok(!isExpiredOn('2026-03-05', '2026-03-05'), 'not expired on the departure day');
    assert.ok(isExpiredOn('2026-03-05', '2026-03-06'), 'expired the day after');
});
