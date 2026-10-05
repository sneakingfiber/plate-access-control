'use strict';
// A single connection pool for the whole process.
//
// The previous implementation opened a fresh connection per call and closed it
// in a `finally`. Combined with module-scope and implicit-global `connection`
// variables, that let one request's cleanup close another request's live
// connection. Routing everything through `withConnection` removes that class of
// bug structurally: each caller gets its own connection and always releases it.

const mysql = require('mysql2/promise');
const config = require('../config');

let pool = null;

// Created lazily so requiring this module does not try to reach MySQL — tests
// and `--check` style loads must not open sockets.
function getPool() {
    if (!pool) {
        pool = mysql.createPool({
            host: config.database.host,
            port: config.database.port,
            user: config.database.user,
            password: config.database.password,
            database: config.database.name,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            enableKeepAlive: true,
        });
    }
    return pool;
}

// Borrow a connection for the duration of `fn`. Always released, including on
// throw. Use this when several statements must share one connection (or a
// transaction); otherwise prefer query().
async function withConnection(fn) {
    const connection = await getPool().getConnection();
    try {
        return await fn(connection);
    } finally {
        connection.release();
    }
}

// Single parameterized statement. Returns rows directly rather than mysql2's
// [rows, fields] tuple.
async function query(sql, params = []) {
    const [rows] = await getPool().execute(sql, params);
    return rows;
}

async function transaction(fn) {
    return withConnection(async (connection) => {
        await connection.beginTransaction();
        try {
            const out = await fn(connection);
            await connection.commit();
            return out;
        } catch (err) {
            await connection.rollback();
            throw err;
        }
    });
}

async function close() {
    if (pool) {
        const p = pool;
        pool = null;
        await p.end();
    }
}

module.exports = { getPool, withConnection, query, transaction, close };
