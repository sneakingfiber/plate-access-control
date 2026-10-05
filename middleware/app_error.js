'use strict';
// An error carrying an HTTP status and a stable machine-readable code.
//
// Handlers return codes rather than sentences so the client can render the
// message in the active language. Phase 6 maps these codes to translations.

class AppError extends Error {
    constructor(code, { status = 400, message, details } = {}) {
        super(message || code);
        this.name = 'AppError';
        this.code = code;
        this.status = status;
        if (details !== undefined) this.details = details;
    }
}

const badRequest = (code, details) => new AppError(code, { status: 400, details });
const notFound = (code = 'NOT_FOUND', details) => new AppError(code, { status: 404, details });
const conflict = (code, details) => new AppError(code, { status: 409, details });
const deviceError = (code = 'DEVICE_UNREACHABLE', details) =>
    new AppError(code, { status: 502, details });

module.exports = { AppError, badRequest, notFound, conflict, deviceError };
