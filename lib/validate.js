'use strict';
// Server-side validation. Pure: no config, no database, no request objects.
//
// There was none of this before — name, dates and bay arrived raw from the
// client, and the only client-side date check wrote a message that the submit
// handler never consulted, so invalid ranges were accepted and stored. Bad
// dates in the table are what make the sync predicates misbehave, so this is
// the gate that keeps the rest honest.
//
// Validators return error CODES, not sentences, so the UI can render them in
// the active language (Phase 6).

const { isValidDateKey, toDateKey } = require('./dates');

const MAX_NAME = 100;
const MAX_PLATE = 16;

// Strip anything that is not alphanumeric and uppercase the rest. Kept
// byte-identical in behaviour to the original processPlate, which only ran on
// insert; it must now run on every path that accepts a plate, or a plate can be
// stored normalised and looked up unnormalised, so an edit or delete silently
// matches nothing.
function normalizePlate(plate) {
    if (typeof plate !== 'string' && typeof plate !== 'number') return '';
    return String(plate).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function validatePlate(raw) {
    const plate = normalizePlate(raw);
    if (plate === '') return { ok: false, code: 'PLATE_REQUIRED' };
    if (plate.length > MAX_PLATE) {
        return { ok: false, code: 'PLATE_TOO_LONG', details: { max: MAX_PLATE } };
    }
    return { ok: true, value: plate };
}

function validateName(raw) {
    if (typeof raw !== 'string') return { ok: false, code: 'NAME_REQUIRED' };
    const name = raw.trim();
    if (name === '') return { ok: false, code: 'NAME_REQUIRED' };
    if (name.length > MAX_NAME) {
        return { ok: false, code: 'NAME_TOO_LONG', details: { max: MAX_NAME } };
    }
    // Control characters would corrupt logs and the rendered table.
    if (/[\u0000-\u001f\u007f]/.test(name)) return { ok: false, code: 'NAME_INVALID' };
    return { ok: true, value: name };
}

function validateDate(raw, code) {
    const key = typeof raw === 'string' ? raw.trim() : toDateKey(raw);
    if (!key || !isValidDateKey(key)) return { ok: false, code };
    return { ok: true, value: key };
}

// Bay must be one the site actually has. `bayPorts` is the site's array, so the
// valid range is its length — there is no separate count to disagree with it.
function validateBay(raw, bayPorts) {
    const count = Array.isArray(bayPorts) ? bayPorts.length : 0;
    const bay = typeof raw === 'number' ? raw
        : (typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN);
    if (!Number.isInteger(bay) || bay < 1 || bay > count) {
        return { ok: false, code: 'INVALID_BAY', details: { bay: raw, max: count } };
    }
    return { ok: true, value: bay };
}

// Validates a whole booking and returns either every problem found or the
// cleaned values. Collecting all of them means the operator fixes one form once
// instead of discovering errors one at a time.
function validateBooking(body, bayPorts) {
    const errors = [];
    const out = {};

    for (const [field, result] of Object.entries({
        name: validateName(body.name),
        plate: validatePlate(body.plate),
        data_arrivo: validateDate(body.data_arrivo, 'ARRIVAL_DATE_INVALID'),
        data_partenza: validateDate(body.data_partenza, 'DEPARTURE_DATE_INVALID'),
        selectedCar: validateBay(body.selectedCar, bayPorts),
    })) {
        if (result.ok) out[field] = result.value;
        else errors.push({ field, code: result.code, ...(result.details ? { details: result.details } : {}) });
    }

    // Only meaningful once both dates parsed.
    if (out.data_arrivo && out.data_partenza && out.data_partenza < out.data_arrivo) {
        errors.push({ field: 'data_partenza', code: 'DEPARTURE_BEFORE_ARRIVAL' });
    }

    return errors.length > 0 ? { ok: false, errors } : { ok: true, value: out };
}

module.exports = {
    MAX_NAME,
    MAX_PLATE,
    normalizePlate,
    validatePlate,
    validateName,
    validateDate,
    validateBay,
    validateBooking,
};
