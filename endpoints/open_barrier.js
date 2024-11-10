const log_err = require('../log_err')
const config = require('../config.json');
const DigestClient = require('digest-fetch');


async function open_barrier(req, res) {
    try {
        console.log('Opening barrier..');

        const ip_address = config.ip_relay; // Assicurati che questo sia impostato correttamente
        const username = config.relayuser;  // Nome utente per l'autenticazione
        const password = config.relaypassword; // Password per l'autenticazione

        // Crea un client per l'autenticazione Digest
        const client = new DigestClient(username, password);
        const url = `http://${ip_address}/axis-cgi/io/port.cgi?action=1:/2000%5C`;

        // Esegui la richiesta GET
        const response = await client.fetch(url, {
            method: 'GET'
        });

        if (response.ok) {

            console.log('Barrier opened successfully');
            console.log(response)
            res.json(result);
        } else {
            console.error('Errore nella richiesta:', response.statusText);
            res.status(response.status).send('Internal Server Error');
        }
    } catch (err) {
        console.error('Failed to open the barrier');
        log_err('Failed to open the barrier')
        res.status(500).send('Internal Server Error');
    }
}

module.exports = { open_barrier };
