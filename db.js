const mysql = require('mysql2/promise')
const config  = require('./config.json');
const log_err = require('./log_err')

///////////////////////////////////////////////////////////////////////////////////////////////
//estabilish a connection with the DB
async function InitConnection(){
    try{
        const dbHost = config.dbHost;
        const dbName = config.dbName;
        const dbUser = config.dbUser;
        const dbPassword = config.dbPassword;
const connection = await mysql.createConnection({
    host: dbHost,
    user: dbUser,
    password: dbPassword,
    database: dbName,
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