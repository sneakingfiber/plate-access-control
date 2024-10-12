const log_err = require('./log_err')
const config = require('./config.json');
const http = require('http');
const {relay_off} = require('./camera_functions');
const {relay_on} = require('./camera_functions');
const InitConnection = require('./db');

async function change_state(req,res){
    try{
        //let ip_address = config.ip_relay;
        //http.get(`http://${ip_address}/axis-cgi/io/port.cgi?checkactive=${id}`);
        console.log('CHANGING STATE');
        let{id} = req.body;
        http.get(`http://localhost:3001/change_state_demo`, (resp) => {
            let data = '';
            resp.on('data',(chunk) => {
                data += chunk; //metti insieme i dati ricevuti
                console.log('relay data retrieved..');
            });
            resp.on('end', () => {
                const result = parseResponse(data); 
                if (result === 'active') {
                    relay_off(id);
                } else if (result === 'inactive') {
                    relay_on(id);
                }
                res.json(result); 
            });
        }).on('error', (err) => {
                console.error('Failed to retrieve charging ports info:', err);
                res.status(500).send('Internal Server Error');})}
        catch(err){console.error('Failed to retrieve charging ports info.')
                    console.log(err); log_err(err);}
    }
    function parseResponse(data){
        let lines = data.split('\n');
        let result = {};
        lines.forEach(line => {
            let [port,status] = line.split('=');
            result[port] = status;
        });
        return result;
            
        };

module.exports = {change_state};
