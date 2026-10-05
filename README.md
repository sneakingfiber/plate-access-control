# Plate Access Control

A Node.js server and web interface for controlling vehicle gates with AXIS ANPR
(licence plate recognition) cameras, plus the EV charging bays behind the gate.

## How it works

The important thing to understand is **where the access decision happens**: on
the camera, not in this application.

1. An operator books a guest through the web UI — name, plate, arrival and
   departure dates, and a charging bay.
2. The booking is stored in MySQL. MySQL is the *source of truth*.
3. The plate is pushed to the site's cameras via the LPR application's CGI
   (`/local/fflprapp/api.cgi?api=addplate&plate=…&list=allow`).
4. When a vehicle arrives, **the camera** recognises the plate, checks its own
   allow-list and opens the barrier on its own. The server is not involved and
   never sees the plate read.
5. A nightly cron reconciles the database to the cameras: plates whose booking
   has expired are removed, newly-active plates are added, and the charging-bay
   relays are switched accordingly.

The barrier and the charging bays are driven through an AXIS I/O relay module
(`/axis-cgi/io/port.cgi`). All device communication uses HTTP Digest auth.

A consequence worth knowing: because the camera decides and acts alone, this
server holds no record of who actually drove through. If you need an audit
trail of gate activity, it has to come from the camera's own logs.

## Requirements

- Node.js 20 or newer
- MySQL 5.7 or newer
- One or more AXIS cameras running the LPR (`fflprapp`) application
- An AXIS I/O relay module reachable from the server

## Setup

```bash
git clone https://github.com/sneakingfiber/plate-access-control.git
cd plate-access-control
npm ci
```

Create the database and table:

```sql
CREATE DATABASE nomi_e_targhe;
USE nomi_e_targhe;
CREATE TABLE veicoli (
  Nome      VARCHAR(100) NOT NULL,
  Targa     VARCHAR(16)  NOT NULL,
  Inizio    DATE         NOT NULL,
  Fine      DATE         NOT NULL,
  Colonnine INT          NOT NULL
);
```

Then configure it (next section) and start:

```bash
npm start     # production
npm run dev   # with auto-reload
```

The UI is served at `http://localhost:3000`.

## Configuration

`config.json` is a **committed template**. Every secret in it reads
`CHANGE_ME`, and the server **refuses to start** while any placeholder is left
unedited — it reports every offending key at once rather than failing later at
the first device call.

Do not edit `config.json` directly. Copy the keys you need into
`config.local.json`, which is gitignored and layered over the template:

```bash
cp config.json config.local.json
$EDITOR config.local.json
```

Only the keys you want to override need to be present. Nested objects are
merged; **arrays are replaced wholesale**, so if you override `cameras` or
`bay_ports` you must list every entry you want.

Alternative paths can be given with the `PAC_CONFIG` and `PAC_CONFIG_LOCAL`
environment variables.

### Keys

| Key | Meaning |
|---|---|
| `server.port` | TCP port the web UI listens on. Default `3000`. |
| `server.language` | UI language code. Default `it`. |
| `database.host` / `.port` | MySQL host and port. Default `localhost` / `3306`. |
| `database.name` | Database name. |
| `database.user` / `.password` | MySQL credentials. Use a least-privilege account, not `root`. |
| `database.table` | Bookings table. Must match `/^[A-Za-z0-9_]+$/` — it is a SQL identifier and cannot be passed as a bound parameter, so it is validated at startup instead. |
| `mail.enabled` | Whether to email error reports. Default `false`; the rest of `mail` is only required when this is `true`. |
| `mail.host` / `.port` / `.user` / `.password` | SMTP server and credentials. |
| `mail.from` / `.to` | Sender and recipient. `from` defaults to `mail.user`. |
| `sync.mode` | `off`, `dryrun` or `live`. Reserved — read by the sync layer, not yet enforced. |
| `sync.max_adds_per_run` | Ceiling on plates added in one live run, as a guard against a misconfigured mass push. Reserved. |
| `sync.device_timeout_ms` | Per-request timeout for camera and relay calls. Reserved. |
| `sites[]` | One entry per gate. At least one required; `id`s must be unique. |
| `sites[].id` | Short identifier, `/^[A-Za-z0-9_-]+$/`. Stored against bookings. |
| `sites[].name` | Human-readable name shown in the UI. |
| `sites[].cameras[]` | The site's cameras. At least one. Each needs `address`, `user`, `password`. |
| `sites[].relay.address` / `.user` / `.password` | The I/O relay module. |
| `sites[].relay.barrier_port` | Relay port that opens the barrier. |
| `sites[].relay.bay_ports` | Relay ports for the charging bays, in bay order. See below. |
| `sites[].relay.barrier_pulse_ms` | How long the barrier relay is held closed. Default `2000`. |

### Bay numbers and relay ports

This is the part worth reading carefully, because getting it wrong means a
charging bay opens your gate.

Bays are numbered **1..N** in the UI and stored that way against a booking.
The relay speaks in **physical port numbers**. The two are not the same, and on
real wiring they usually do not line up: on the original installation the
barrier is port 1 while bays 1–8 are ports 9–16.

`bay_ports` maps one to the other, in order — the first entry is bay 1:

```json
"barrier_port": 1,
"bay_ports": [9, 10, 11, 12, 13, 14, 15, 16]
```

The number of bays is simply `bay_ports.length`; there is no separate count to
keep in sync. Ports need not be contiguous, so unusual wiring is fine:

```json
"bay_ports": [9, 12, 40]
```

Two rules are enforced at startup, and again at every lookup:

- A port may not appear twice in `bay_ports`.
- `barrier_port` may **not** appear in `bay_ports`.

Code must resolve a bay to a port only through `config.resolveBayPort(site, bay)`,
never by arithmetic on the bay number. That function throws for an out-of-range
bay and refuses outright to return `barrier_port`.

### Multiple sites

Add further entries to `sites`. Each has its own cameras, relay and wiring:

```json
"sites": [
  { "id": "nord", "name": "Ingresso Nord", "cameras": [ … ],
    "relay": { "barrier_port": 1, "bay_ports": [9, 10, 11, 12], … } },
  { "id": "sud",  "name": "Ingresso Sud",  "cameras": [ … ],
    "relay": { "barrier_port": 2, "bay_ports": [20, 21], … } }
]
```

With one site configured the UI hides the site selector, so a single-gate
install does not look multi-site.
