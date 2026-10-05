'use strict';
// Date handling, kept in one place and deliberately string-based.
//
// mysql2 returns DATE columns as JS Date objects in the server's local
// timezone; the UI submits 'YYYY-MM-DD' strings. Comparing those two forms
// directly, or round-tripping through toISOString(), is how a booking silently
// shifts by a day either side of midnight. Everything is therefore normalised
// to a 'YYYY-MM-DD' key first, and compared as strings — which for that format
// is exactly chronological order.

function pad(n) {
    return String(n).padStart(2, '0');
}

// Accepts a Date or a 'YYYY-MM-DD...' string; returns the key or null.
// A Date is read in LOCAL time, matching how mysql2 constructed it from a DATE
// column, so the calendar day is preserved rather than shifted into UTC.
function toDateKey(value) {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    }
    const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const key = `${match[1]}-${match[2]}-${match[3]}`;
    return isValidDateKey(key) ? key : null;
}

// Strict: rejects a well-formed but non-existent date such as 2026-02-30.
function isValidDateKey(value) {
    if (typeof value !== 'string') return false;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return false;
    const probe = new Date(Date.UTC(year, month - 1, day));
    return probe.getUTCFullYear() === year
        && probe.getUTCMonth() === month - 1
        && probe.getUTCDate() === day;
}

function todayKey(now = new Date()) {
    return toDateKey(now);
}

// Inclusive overlap of two closed date ranges.
//
// This replaces the predicate used by both availability endpoints, which asked
// whether the requested arrival OR departure fell inside an existing booking.
// That misses a requested range that fully CONTAINS an existing booking —
// neither endpoint is inside it — so the bay was reported free and could be
// double-booked. Two ranges overlap exactly when each starts no later than the
// other ends.
function overlaps(aStart, aEnd, bStart, bEnd) {
    const a1 = toDateKey(aStart);
    const a2 = toDateKey(aEnd);
    const b1 = toDateKey(bStart);
    const b2 = toDateKey(bEnd);
    if (!a1 || !a2 || !b1 || !b2) return false;
    return a1 <= b2 && a2 >= b1;
}

// Access runs to the END of the departure day: a guest may still drive out on
// their Fine date. So a booking is live while today is within [Inizio, Fine],
// and is revoked only once today is strictly past Fine.
function isActiveOn(inizio, fine, today) {
    const start = toDateKey(inizio);
    const end = toDateKey(fine);
    const day = toDateKey(today);
    if (!start || !end || !day) return false;
    return start <= day && day <= end;
}

function isExpiredOn(fine, today) {
    const end = toDateKey(fine);
    const day = toDateKey(today);
    if (!end || !day) return false;
    return end < day;
}

module.exports = { toDateKey, isValidDateKey, todayKey, overlaps, isActiveOn, isExpiredOn };
