const InitConnection = require('../db');
const log_err = require('../log_err');
const { on_rm }  = require('../camera_functions');
const config = require('../config.json');


let connection;
let plate;

async function delete_targhe(req, res) {
    try {
        const tableName = config.tableName;

        plate = req.body.plate;
        
        await on_rm(plate);
    }
    catch (err) {
        console.log(err);
        log_err(err);
        throw err;
    }
    finally {
        
        if (connection) {
            await connection.end();  // close connection
            console.log('DB connection closed')
        }
    }

}
module.exports = { delete_targhe };




























