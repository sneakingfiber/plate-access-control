const InitConnection = require('./db')
const log_err = require('./log_err')
let connection;
const config = require('./config.json');

async function check_posti_modal(req, res){
    try{
    connection = await InitConnection();
    const tableName = config.tableName;
    console.log('checking free spots...')
    const { plate, data_arrivo, data_partenza } = req.body;
    console.log(plate);
    //const sql=`SELECT Colonnine FROM veicoli WHERE Targa !='${plate}' AND ('${data_arrivo}' BETWEEN Inizio AND Fine)
    //OR ('${data_partenza}' BETWEEN Inizio AND Fine)  `;
    const sql= `SELECT Colonnine 
    FROM ${tableName} 
    WHERE Targa != '${plate}' 
    AND (('${data_arrivo}' BETWEEN Inizio AND Fine) OR ('${data_partenza}' BETWEEN Inizio AND Fine))`;
    const result = await connection.execute(sql);
        if (result[0].length > 0) {
            const output = result[0].map(row => row.Colonnine);
            console.log(output)
            res.json(output);
        } 
        else{
            res.json([]); // No result found return an empty array
        }
    }
    catch(err){
            console.log(err);
            log_err(err)
        }
    finally {
        if (connection) {
            await connection.end();  // close connection
            console.log('DB connection closed')
        }
    }
    }
module.exports = {check_posti_modal};