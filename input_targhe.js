const InitConnection = require('./db')
const log_err = require('./log_err')

function processPlate(plate) {
    //Remove special chars and put every letter in uppercase
    let processedPlate = plate.replace(/[^a-zA-Z]/g, '').toUpperCase();

    return processedPlate;
}
let connection;
async function input_targhe(req,res){
    try{
    connection = await InitConnection();
    let { name, plate, data_arrivo, data_partenza, selectedCar } = req.body;
    plate = processPlate(plate);
    const checkQuery = `SELECT Targa FROM veicoli WHERE Targa = '${plate}'`;
    const result = await connection.execute(checkQuery);
    console.log(result);
    if (result[0].length > 0){
        res.redirect('/loading_existing_plate.html');
        return;
    }
    //else...
    const insertQuery = `INSERT INTO veicoli (Nome, Targa, Inizio, Fine, Colonnine) VALUES ('${name}', '${plate}', '${data_arrivo}', '${data_partenza}', '${selectedCar}')`;
    const result2 = await connection.execute(insertQuery);
    if(result2[0].affectedRows > 0){
        console.log('Targa inserita con successo.');
        res.redirect('/loading_success_plate.html');
    }
    }
    catch(err){
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
module.exports = { input_targhe };