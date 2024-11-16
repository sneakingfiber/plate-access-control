
const InitConnection = require('../db')
const log_err = require('../log_err')
const config = require('../config.json');
const check_plates_add  = require('../camera_functions');




let connection;
let plate;
async function change_targhe(req, res) {
    try {
        const tableName = config.tableName;
        connection = await InitConnection();
        console.log(req.body);

        const { name, data_arrivo, data_partenza, selectedCar } = req.body;
        plate = req.body.plate;

        // Controlla se selectedCar è un numero valido, altrimenti imposta un valore predefinito
        const colonnineValue = selectedCar ? parseInt(selectedCar, 10) : 0;

        if (isNaN(colonnineValue)) {
            res.status(400).json({ error: "Valore di 'Colonnine' non valido." });
            return;
        }

        const insertQuery = `UPDATE ${tableName} SET Nome='${name}', Inizio='${data_arrivo}', Fine='${data_partenza}', Colonnine=${colonnineValue} WHERE Targa='${plate}';`;
        const result2 = await connection.execute(insertQuery);

        if (result2[0].affectedRows > 0) {
            console.log('Targa aggiornata con successo.');
            res.status(200).json({ message: 'Aggiornamento riuscito.' });
        } else {
            console.log('Errore di comunicazione col DB');
            res.status(500).json({ error: 'Errore nel database. Riprovare più tardi.' });
        }
    } catch (err) {
        console.log(err);
        log_err(err);
        res.status(500).json({ error: 'Errore interno del server.' });
    } finally {
        if (connection) {
            await connection.end();
            console.log('DB connection closed');
            cam_ip = [config.ip1, config.ip2];
            await Promise.all(cam_ip.map(ip => check_plates_add(ip)));
        }
    }
}
module.exports = { change_targhe };




























