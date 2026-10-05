'use strict';
// Forwards a rejected async handler to Express's error pipeline.
//
// Express 4 does not await handlers, so a promise rejection inside one is an
// unhandled rejection: nothing responds and the browser hangs until it gives
// up. Several handlers made this worse by rethrowing from their catch block
// with no error middleware registered at all.

function asyncHandler(fn) {
    return function wrapped(req, res, next) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = asyncHandler;
