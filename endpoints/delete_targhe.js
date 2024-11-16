const InitConnection = require('../db');
const log_err = require('../log_err');
const { on_rm }  = require('../camera_functions');
const config = require('../config.json');


let connection;
let plate;

async function delete_targhe(req, res) {
    try {
        const tableName = config.tableName;
        connection = await InitConnection();
        plate = req.body.plate;
        const insertQuery = `DELETE FROM ${tableName} WHERE Targa='${plate}'`;
        const result2 = await connection.execute(insertQuery);
        if (result2[0].affectedRows > 0) {
            console.log('Targa cancellata con successo.');
        }
        else {
            console.log('Errore di comunicazione col DB');
            res.status(500).json({ error: 'Errore nel database. Riprovare più tardi.' });
        }
        console.log('deleting plate..')
        
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




























