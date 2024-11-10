const log_err = require('../log_err')
const config = require('../config.json');
const http = require('http');
const { relay_off } = require('../camera_functions');
const { relay_on } = require('../camera_functions');
const InitConnection = require('../db');
const DigestClient = require('digest-fetch');


async function change_state(req, res) {
    try {
        console.log('CHANGING STATE');

        let { id } = req.body;
        const ip_address = config.ip_relay; // Assicurati che questo sia impostato correttamente
        const username = config.relayuser;  // Nome utente per l'autenticazione
        const password = config.relaypassword; // Password per l'autenticazione
        console.log(id)
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
                relay_off(ip_address, id);
            } else if (result === 'inactive') {
                relay_on(ip_address, id);
            }
            else {
                console.log("State hasn't changed due to an error");
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
/*function parseResponse(data) {
    let lines = data.split('\n');
    let result = {};
    lines.forEach(line => {
        let [port, status] = line.split('=');
        result[port] = status;
    });
    console.log(result)
    return result;

};*/
function parseResponse(data, portId) {
    const lines = data.split('\n');
    let status;

    lines.forEach(line => {
        const [port, state] = line.split('=');
        if (port === `port${portId}`) { // Verifica se la porta corrisponde a quella cercata
            status = state; // Prendi lo stato della porta specifica
        }
    });

    console.log(`Status for port${portId}:`, status); // Mostra lo stato trovato
    return status; // Restituisci lo stato trovato
}

module.exports = { change_state };
