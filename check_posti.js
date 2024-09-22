const InitConnection = require('./db')
const log_err = require('./log_err')
let connection;
async function check_posti(req, res){
    try{
    connection = await InitConnection();
    const { data_arrivo, data_partenza } = req.body;
    const sql=`SELECT Colonnine FROM veicoli WHERE ('${data_arrivo}' BETWEEN Inizio AND Fine)
    OR ('${data_partenza}' BETWEEN Inizio AND Fine)`;
    const result = await connection.execute(sql);
        if (result[0].length > 0) {
            const output = result[0].map(row => row.Colonnine);
            res.json(output);
        } 
        else{
            res.json([]); // No result found return an empty array
        }
        await connection.end(); //closing connection
        }
        catch(err){
            console.log(err);
            log_err(err)
        }
        }
module.exports = {check_posti};
    
