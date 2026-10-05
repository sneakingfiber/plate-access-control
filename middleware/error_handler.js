'use strict';
// Terminal error handler. Registered last, after every route.
//
// Sends one response, always; logs the real error server-side and returns only
// a code to the client, so stack traces and SQL text never reach the browser.

const log_err = require('../log_err');
const { AppError } = require('./app_error');

function errorHandler(err, req, res, _next) {
    const status = err instanceof AppError ? err.status : 500;
    const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';

    // Expected 4xx outcomes are normal operation, not incidents worth emailing.
    if (status >= 500) {
        console.error(`${req.method} ${req.originalUrl} failed:`, err);
        log_err(`${req.method} ${req.originalUrl} - ${err.stack || err.message}`);
    } else {
        console.warn(`${req.method} ${req.originalUrl} rejected: ${code}`);
    }

    // The client may already have received headers from a partial response.
    if (res.headersSent) return;

    const body = { error: code };
    if (err instanceof AppError && err.details !== undefined) body.details = err.details;
    res.status(status).json(body);
}

function notFoundHandler(req, res) {
    res.status(404).json({ error: 'NOT_FOUND' });
}

module.exports = { errorHandler, notFoundHandler };
