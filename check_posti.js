const InitConnection = require('./db')
const log_err = require('./log_err')
const config = require('./config.json');


let connection;
async function check_posti(req, res){
    try{
    const tableName = config.tableName;
    connection = await InitConnection();
    console.log('checking free spots...')
    const { data_arrivo, data_partenza } = req.body;
    const sql=`SELECT Colonnine FROM ${tableName} WHERE ('${data_arrivo}' BETWEEN Inizio AND Fine)
    OR ('${data_partenza}' BETWEEN Inizio AND Fine)`;
    //AND Targa != '${plate}'
    const result = await connection.execute(sql);
        if (result[0].length > 0) {
            const output = result[0].map(row => row.Colonnine);
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
module.exports = {check_posti};
    
