const mysql = require('mysql2/promise')
const log_err = require('../log_err')

///////////////////////////////////////////////////////////////////////////////////////////////
//estabilish a connection with the DB
async function InitConnection(){
    try{
const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'nomi_e_targhe',
    });
    console.log('DB connection estabilished')
    return connection;
    }
catch(err){
    console.log('DB connection ERROR',err)
    log_err(err)
    throw err;
}
}
///////////////////////////////////////////////////////////////////////////////////////////////
module.exports = InitConnection;