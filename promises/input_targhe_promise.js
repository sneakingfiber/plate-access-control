const InitConnection = require('./db')
const log_err = require('./log_err')

async function input_targhe(){
    try{
    const connection = InitConnection();
    const { name, plate, data_arrivo, data_partenza, selectedCar } = req.body;
    const checkQuery = `SELECT Targa FROM veicoli WHERE Targa = '${plate}'`;
    const result = await connection.execute(checkQuery);
    if (err){
        console.error('Errore nel controllo della targa nel database:', err);
        res.status(500).send('Errore nel controllo della targa nel database.');
        //aggiungere log err
    }
    if (result.length > 0){
        res.redirect('/loading_existing_plate.html');
        return;
    }
    //else...
    const insertQuery = `INSERT INTO veicoli (Nome, Targa, Inizio, Fine, Colonnine) VALUES (${name}, ${plate}, ${data_arrivo}, ${data_partenza}, ${selectedCar})`;
    const result2 = await connection.execute(insertQuery);
    if(err){
        console.error('Errore nel controllo della targa nel database:', err);
        res.status(500).send('Errore nel controllo della targa nel database.');
        //aggiungere log err
    }
    else{
        console.log('Targa inserita con successo.');
        res.redirect('/loading_success_plate.html');
    }
    }
    catch(err){
        console.log(err);
        log_err(err);
        throw err;
    }

}