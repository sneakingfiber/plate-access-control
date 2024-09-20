const connection = require('./db');
const moment = require('moment');
const axios = require('axios');
const log_err = require('./log_err')

async function query_post(query){
connection.query(query, async (err, results) => {
    try{
    console.log('sending SQL...')
    console.log(results);
    return results;
    }
    catch(err){
        console.log('SQL error')
        log_err(err);
    }
  });
}
