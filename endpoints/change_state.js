const log_err = require('../log_err')
const config = require('../config.json');
const http = require('http');
const { relay_off } = require('../camera_functions');
const { relay_on } = require('../camera_functions');
const InitConnection = require('../db');
const DigestClient = require('digest-fetch');
/*async function change_state(req,res){
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
    }*/


async function change_state(req, res) {
    try {
        console.log('CHANGING STATE');

        let { id } = req.body;
        const ip_address = config.ip_relay; // Assicurati che questo sia impostato correttamente
        const username = config.relayuser;  // Nome utente per l'autenticazione
        const password = config.relaypassword; // Password per l'autenticazione

        // Crea un client per l'autenticazione Digest
        const client = new DigestClient(username, password);
        const url = `http://${ip_address}/axis-cgi/io/port.cgi?checkactive=${id}`;

        // Esegui la richiesta GET
        const response = await client.fetch(url, {
            method: 'GET'
        });

        if (response.ok) {
            const data = await response.text();
            const result = parseResponse(data);
            console.log('relay data retrieved..');

            if (result === 'active') {
                relay_off(id);
            } else if (result === 'inactive') {
                relay_on(id);
            }

            res.json(result);
        } else {
            console.error('Errore nella richiesta:', response.statusText);
            res.status(response.status).send('Internal Server Error');
        }
    } catch (err) {
        console.error('Failed to retrieve charging ports info.');
        res.status(500).send('Internal Server Error');
    }
}
function parseResponse(data) {
    let lines = data.split('\n');
    let result = {};
    lines.forEach(line => {
        let [port, status] = line.split('=');
        result[port] = status;
    });
    return result;

};

module.exports = { change_state };
