'use strict';
const test = require('node:test');
const assert = require('node:assert');
const v = require('../lib/validate');

const BAYS = [9, 10, 11, 12, 13, 14, 15, 16];
const good = {
    name: 'Mario Rossi', plate: 'AB123CD',
    data_arrivo: '2026-03-01', data_partenza: '2026-03-05', selectedCar: 3,
};
const codes = (r) => r.errors.map((e) => e.code);

test('normalizePlate strips punctuation and uppercases', () => {
    assert.equal(v.normalizePlate('ab-123 cd'), 'AB123CD');
    assert.equal(v.normalizePlate('  xy.9.8  '), 'XY98');
    assert.equal(v.normalizePlate(''), '');
    assert.equal(v.normalizePlate(null), '');
    assert.equal(v.normalizePlate(undefined), '');
    assert.equal(v.normalizePlate({}), '');
});

test('a valid booking passes and returns cleaned values', () => {
    const r = v.validateBooking(good, BAYS);
    assert.ok(r.ok);
    assert.equal(r.value.plate, 'AB123CD');
    assert.equal(r.value.selectedCar, 3);
});

test('a plate of only punctuation is rejected as missing', () => {
    assert.deepEqual(codes(v.validateBooking({ ...good, plate: '---' }, BAYS)), ['PLATE_REQUIRED']);
});

test('departure before arrival is rejected', () => {
    const r = v.validateBooking({ ...good, data_arrivo: '2026-03-05', data_partenza: '2026-03-01' }, BAYS);
    assert.deepEqual(codes(r), ['DEPARTURE_BEFORE_ARRIVAL']);
});

test('same-day arrival and departure is allowed', () => {
    assert.ok(v.validateBooking({ ...good, data_arrivo: '2026-03-01', data_partenza: '2026-03-01' }, BAYS).ok);
});

test('non-existent dates are rejected', () => {
    assert.deepEqual(codes(v.validateBooking({ ...good, data_arrivo: '2026-02-30' }, BAYS)),
        ['ARRIVAL_DATE_INVALID']);
    assert.deepEqual(codes(v.validateBooking({ ...good, data_partenza: '' }, BAYS)),
        ['DEPARTURE_DATE_INVALID']);
});

test('bay must exist in the site wiring, and range comes from bay_ports length', () => {
    assert.deepEqual(codes(v.validateBooking({ ...good, selectedCar: 0 }, BAYS)), ['INVALID_BAY']);
    assert.deepEqual(codes(v.validateBooking({ ...good, selectedCar: 9 }, BAYS)), ['INVALID_BAY']);
    assert.ok(v.validateBooking({ ...good, selectedCar: 8 }, BAYS).ok);
    // A site with four bays rejects bay 5.
    assert.deepEqual(codes(v.validateBooking({ ...good, selectedCar: 5 }, [9, 10, 11, 12])), ['INVALID_BAY']);
    // A numeric string from a form field is accepted.
    assert.ok(v.validateBooking({ ...good, selectedCar: '3' }, BAYS).ok);
});

test('missing and control-character names are rejected', () => {
    assert.deepEqual(codes(v.validateBooking({ ...good, name: '   ' }, BAYS)), ['NAME_REQUIRED']);
    assert.deepEqual(codes(v.validateBooking({ ...good, name: undefined }, BAYS)), ['NAME_REQUIRED']);
    assert.deepEqual(codes(v.validateBooking({ ...good, name: 'a\u0007b' }, BAYS)), ['NAME_INVALID']);
    assert.deepEqual(codes(v.validateBooking({ ...good, name: 'x'.repeat(101) }, BAYS)), ['NAME_TOO_LONG']);
});

test('all problems are reported at once, not one per submit', () => {
    const r = v.validateBooking({ name: '', plate: '', data_arrivo: 'x', data_partenza: 'y', selectedCar: 99 }, BAYS);
    assert.equal(r.errors.length, 5);
});

test('an empty body does not throw', () => {
    assert.ok(!v.validateBooking({}, BAYS).ok);
});
