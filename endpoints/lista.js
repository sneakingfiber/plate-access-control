const InitConnection = require('../db')
const log_err = require('../log_err')
const config = require('../config.json');

let connection;
async function lista(req, res) {
    try {
        const tableName = config.tableName;
        connection = await InitConnection();
        const sql = `SELECT * FROM ${tableName} `;
        const result = await connection.execute(sql);


        if (result[0].length > 0) {
            const output = await result[0].map(row => row);  // Restituisce tutte le colonne di ogni riga
            console.log('List retrieved');
            res.json(output);
        }
    }
    catch (err) {
        log_err(err);
        throw err;
    }
    finally {
        if (connection) {
            await connection.end();
            console.log('DB connection closed');
        }
    }
}
module.exports = { lista };