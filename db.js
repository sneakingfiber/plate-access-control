

const mysql = require('mysql')

///////////////////////////////////////////////////////////////////////////////////////////////
//estabilish a connection to DB
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'nomi_e_targhe',
});

connection.connect((err)=>{
    if(err){
        console.error('An error occured while connecting to DB');
        return;
    }
    console.log('Connection estabilished!');
});
///////////////////////////////////////////////////////////////////////////////////////////////
module.exports = connection;