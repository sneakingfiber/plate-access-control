'use strict';
const express = require('express');
const cron = require('node-cron');

const config = require('./config');
const asyncHandler = require('./middleware/async_handler');
const { errorHandler } = require('./middleware/error_handler');

const { check_posti } = require('./endpoints/check_posti');
const { check_posti_modal } = require('./endpoints/check_posti_modal');
const { input_targhe } = require('./endpoints/input_targhe');
const { lista } = require('./endpoints/lista');
const { delete_targhe } = require('./endpoints/delete_targhe');
const { change_targhe } = require('./endpoints/change_targhe');
const { checkactive } = require('./endpoints/charging');
const { change_state } = require('./endpoints/change_state');
const { open_barrier } = require('./endpoints/open_barrier');
const { daily_functions, daily_functions_add } = require('./camera_functions');

const app = express();
const port = config.server.port;

// body-parser was registered alongside these and did the same job twice; it is
// bundled inside Express and needed no separate dependency.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

////////////////////////////////////////////////////////////////////////////////
// Every handler is wrapped: Express 4 does not await handlers, so without this
// a rejected promise is an unhandled rejection and the client simply hangs.

app.post('/endpoints/check_posti', asyncHandler(check_posti));
app.post('/endpoints/input_targhe', asyncHandler(input_targhe));
app.post('/endpoints/check_posti_modal', asyncHandler(check_posti_modal));
app.post('/endpoints/lista', asyncHandler(lista));
app.post('/endpoints/change_targhe', asyncHandler(change_targhe));
app.post('/endpoints/delete_targhe', asyncHandler(delete_targhe));
app.get('/endpoints/charging', asyncHandler(checkactive));
app.post('/endpoints/change_state', asyncHandler(change_state));
// NOTE (Phase 5): unauthenticated GET that opens a physical gate.
app.get('/endpoints/open_barrier', asyncHandler(open_barrier));

app.get('/', (req, res) => {
    res.sendFile(`${__dirname}/public/targhe.html`);
});

// Must be last: turns any thrown or rejected error into a single JSON response
// and keeps stack traces server-side.
app.use(errorHandler);

////////////////////////////////////////////////////////////////////////////////

async function runSync(label, fn) {
    try {
        console.log(`Esecuzione di ${label} ...`);
        await fn();
        console.log(`Fine ${label}`);
    } catch (error) {
        console.error(`Errore durante l'esecuzione di ${label}:`, error);
    }
}

app.listen(port, () => {
    console.log(`Server avviato su http://localhost:${port}`);
    for (const site of config.sites) {
        console.log(`  site "${site.id}" (${site.name}): `
            + `${site.cameras.length} camera(s), ${config.bayCount(site)} bay(s), `
            + `barrier on port ${site.relay.barrier_port}`);
    }

    // NOTE (Phase 3): these also run on every process start, not only on cron.
    // That is wrong for a gate controller and is removed together with the sync
    // rewrite and the admin-triggered sync endpoint.
    runSync('daily_functions_add', daily_functions_add);
    runSync('daily_functions', daily_functions);

    cron.schedule('10 00 * * *', () => runSync('daily_functions', daily_functions));
    cron.schedule('8 00 * * *', () => runSync('daily_functions_add', daily_functions_add));
});
