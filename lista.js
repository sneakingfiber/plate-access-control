const InitConnection = require('./db')
const log_err = require('./log_err')

let connection;
async function lista (req,res){
    try{
    connection = await InitConnection();
    const sql = `SELECT * FROM veicoli `;
    const result = await connection.execute(sql);
    console.log(result[0]);
    if(result[0].length > 0){
        const output = await result[0].map(row => row);  // Restituisce tutte le colonne di ogni riga
        res.json(output);
    }
    }
    catch(err){
        log_err(err);
        throw err;
    }
    finally{
        if(connection){
        await connection.end();
        console.log('DB connection closed');
    }
    }
}
module.exports = {lista};