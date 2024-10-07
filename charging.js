
const {log_err} = require('./log_err')
const http = require('http');
const config = require('./config.json')

async function checkactive(req,res) {
    try{
        //let ip_address = config.ip_relay;
        //http.get(`http://${ip_address}/axis-cgi/io/port.cgi?checkactive=1,9,10,11,12,13,14,15,16`)
        http.get(`http://localhost:3001`, (resp) => {
            let data = '';
            resp.on('data',(chunk) => {
                data += chunk; //metti insieme i dati ricevuti
                console.log('relay data retrieved..');
            });
            resp.on('end', () => {
                const result = parseResponse(data); //Parsing
                res.json(result); 
            });
        }).on('error', (err) => {
                console.error('Failed to retrieve charging ports info:', err);
                res.status(500).send('Internal Server Error');})}
        catch(err){console.error('Failed to retrieve charging ports info.')
                    console.log(err); log_err(err);}
};
function parseResponse(data){
    let lines = data.split('\n');
    let result = {};
    lines.forEach(line => {
        let [port,status] = line.split('=');
        result[port] = status;
    });
    return result;
        
    };

module.exports = { checkactive };
