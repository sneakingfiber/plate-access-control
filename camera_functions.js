const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const { exec } = require('child_process');
const config = require('./config.json');
const log_err = require('./log_err');
const http = require('http');
const InitConnection = require('./db');
const DigestClient = require('digest-fetch');

async function check_plates_delete(address) {
    try {
        connection = await InitConnection();
        console.log('Looking for plates to delete...');
        const sql = `SELECT Targa FROM veicoli WHERE DATE(Fine) <= CURDATE()`;
        const result = await connection.execute(sql);
        if (result[0].length > 0) {
            const output = result[0].map(row => row.Targa);

            for (let i = 0; i < output.length; i++) {
                console.log('Delete plate: ');
                console.log(output[i]);
                await rm_plate(address, output[i]);
                await rm_db_plate(output[i]);
            }
        }
        else {
            console.log('No plates to delete...')
        }
    }
    catch (err) {
        console.log(err);
        log_err(err)
    }
    finally {
        if (connection) {
            await connection.end();  // close connection
            console.log('DB connection closed')
        }
    }
};
async function rm_db_plate(plate) {
    try {
        const tableName = config.tableName;
        connection = await InitConnection();
        const insertQuery = `DELETE FROM ${tableName} WHERE Targa='${plate}'`;
        const result2 = await connection.execute(insertQuery);
        if (result2[0].affectedRows > 0) {
            console.log('Targa cancellata con successo.');
        }
        else {
            console.log('Errore di comunicazione col DB');
            res.status(500).json({ error: 'Errore nel database. Riprovare più tardi.' });
        }

    }
    catch (err) {
        console.log(err);
        log_err(err);
        throw err;
    }
    finally {
        console.log('deleting plate..')
        await on_rm(plate);
        if (connection) {
            await connection.end();  // close connection
            console.log('DB connection closed')
        }
    }

}
async function check_plates_add(address) {
    try {
        connection = await InitConnection();
        console.log('Looking for plates to add...');
        const sql = `SELECT Targa FROM veicoli WHERE DATE(Inizio) <= CURDATE()`;
        const result = await connection.execute(sql);
        if (result[0].length > 0) {
            const output = result[0].map(row => row.Targhe);

            for (let i = 0; i >= output.length; i++) {
                console.log('Add plate: ');
                console.log(output[i]);
                add_plate(address, output[i]);
            }
        }
        else {
            console.log('No plates to add...')
        }
    }
    catch (err) {
        console.log(err);
        log_err(err)
    }
    finally {
        if (connection) {
            await connection.end();  // close connection
            console.log('DB connection closed')
        }
    }
};
async function check_relay_deactivate(address) {
    try {
        connection = await InitConnection();
        console.log('checking relay to turn off...');
        const sql = `SELECT Colonnine FROM veicoli WHERE DATE(Fine) <= CURDATE()`;
        const result = await connection.execute(sql);
        if (result[0].length > 0) {
            const output = result[0].map(row => row.Colonnine);

            for (let i = 0; i >= output.length; i++) {
                console.log('Dectivating relay: ');
                console.log(output[i]);
                relay_off(address, output);
            }
        }
        else {
            console.log('No relays to deactivate...')
        }
    }
    catch (err) {
        console.log(err);
        log_err(err)
    }
    finally {
        if (connection) {
            await connection.end();  // close connection
            console.log('DB connection closed')
        }
    }
};
async function check_relay_activate(address) {
    try {
        connection = await InitConnection();
        console.log('checking relay to activate...');
        const sql = `SELECT Colonnine FROM veicoli WHERE DATE(Inizio) <= CURDATE()`;
        const result = await connection.execute(sql);
        if (result[0].length > 0) {
            const output = result[0].map(row => row.Colonnine);

            for (let i = 0; i >= output.length; i++) {
                console.log('Activating relay: ');
                console.log(output[i]);
                relay_on(address, output[i]);
            }
        }
        else {
            console.log('No relays to activate...')
        }
    }
    catch (err) {
        console.error(err);
        log_err(err)
    }
    finally {
        if (connection) {
            await connection.end();  // close connection
            console.log('DB connection closed')
        }
    }

};
/*
async function relay_off(address, relay) {
    return new Promise((resolve, reject) => {
        http.get(`http://${address}/axis-cgi/io/port.cgi?action=${relay}:\\`, (resp) => { //double '\\' is for turning relay off
            let data = '';
            resp.on('data', (chunk) => {
                data += chunk;
            });
            resp.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    resolve(parsedData);
                } catch (error) {
                    log_err(error.message);
                    reject(error);
                }
            });
        }).on('error', (err) => {
            console.error('Error:', err.message);
        })
    })
};*/
async function relay_on(address, relay) {
    try {
        const username = config.relayuser;
        const password = config.relaypassword;
        const client = new DigestClient(username, password);

        const url = `http://${address}/axis-cgi/io/port.cgi?action=${relay}::/`;

        // Esegui la richiesta GET
        const response = await client.fetch(url, {
            method: 'GET'
        });

        if (response.ok) {
            const data = await response.text();
            console.log('Risposta:', data);
        } else {
            console.error('Errore nella richiesta:', response.statusText);
        }
    } catch (error) {
        console.error('Errore durante l\'esecuzione della richiesta:', error.message);
    }
}
async function relay_off(address, relay) {
    try {
        const username = config.relayuser;
        const password = config.relaypassword;
        const client = new DigestClient(username, password);

        const url = `http://${address}/axis-cgi/io/port.cgi?action=${relay}:\\`;

        // Esegui la richiesta GET
        const response = await client.fetch(url, {
            method: 'GET'
        });

        if (response.ok) {
            const data = await response.text();
            console.log('Risposta:', data);
        } else {
            console.error('Errore nella richiesta:', response.statusText);
        }
    } catch (error) {
        console.error('Errore durante l\'esecuzione della richiesta:', error.message);
    }
}
async function add_plate(address, plate) {
    try {
        const username = config.camerauser;
        const password = config.cameraPassword;
        const client = new DigestClient(username, password);

        const url = `http://${address}/local/fflprapp/api.cgi?api=addplate&plate=${plate}&list=allow`;

        // Esegui la richiesta GET
        const response = await client.fetch(url, {
            method: 'GET'
        });

        if (response.ok) {
            const data = await response.text();
            console.log('Risposta:', data);
        } else {
            console.error('Errore nella richiesta:', response.statusText);
        }
    } catch (error) {
        console.error('Errore durante l\'esecuzione della richiesta:', error.message);
    }
}
async function rm_plate(address, plate) {
    try {
        const username = config.camerauser;
        const password = config.cameraPassword;
        const client = new DigestClient(username, password);

        const url = `http://${address}/local/fflprapp/api.cgi?api=delplate&plate=${plate}&list=allow`;

        // Esegui la richiesta GET
        const response = await client.fetch(url, {
            method: 'GET'
        });

        if (response.ok) {
            const data = await response.text();
            console.log('Risposta:', data);
        } else {
            console.error('Errore nella richiesta:', response.statusText);
        }
    } catch (error) {
        console.error('Errore durante l\'esecuzione della richiesta:', error.message);
    }
}
/*
async function rm_plate(address,plate){
    return new Promise((resolve, reject) => {
    http.get(`http://${address}/local/fflprapp/api.cgi?api=delplate&plate=${plate}&list=allow`, (resp) => {
    let data = '';
    resp.on('data', (chunk) => {
        data += chunk;
    });

    resp.on('end', () => {
        try {
            // Verifica se la risposta è JSON o HTML
            if (resp.headers['content-type'].includes('application/json')) {
                const jsonData = JSON.parse(data);
                console.log(jsonData);
                resolve(jsonData); // Risolvi la promessa se tutto va bene
            } else {
                console.log('La risposta non è JSON. Risposta ricevuta:', data);
                reject(new Error('La risposta non è JSON'));
            }
        } catch (err) {
            reject('Errore durante il parsing della risposta: ' + err.message); // Rifiuta in caso di errore
        }
    });


}).on('error', (err) => {
    console.error('Error:', err.message);
    reject(new Error('An error occurred during http req for deleting a plate.'))
})})
};*/
async function ping(address) {
    try {
        return new Promise((resolve, reject) => {
            exec(`ping -n 1 ${address}`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error pinging ${address}: ${stderr}`);
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });
    }
    catch (err) {
        console.error(err);
        log_err(err);
    }
};
async function check_devices(addresses) {
    try {
        for (let i = 0; i < addresses.length; i++) {
            await ping(addresses[i]);
        }
    }
    catch (err) {
        console.error(err);
        log_err(err);
    }
};
async function on_add() {
    try {
        addresses = [config.ip1, config.ip2, config.ip_relay];
        cam_ip = [config.ip1, config.ip2];
        relay_ip = [config.ip_relay];
        for (let i = 0; i < relay_ip.lenght; i++) { await check_relay_activate(relay_ip[i]); }
        for (let i = 0; i < relay_ip.lenght; i++) { await check_plates_add(cam_ip[i]); }
    }
    catch (err) {
        console.error(err); log_err(err);
    }
    finally { console.log('adding process completed') };
}
async function on_rm(plate) {
    try {
        addresses = [config.ip1, config.ip2, config.ip_relay];
        cam_ip = [config.ip1, config.ip2];
        relay_ip = [config.ip_relay];
        for (let i = 0; i < relay_ip.lenght; i++) { await relay_off(relay_ip[i], plate); }
        for (let i = 0; i < relay_ip.lenght; i++) { await rm_plate(cam_ip[i], plate); }
    }
    catch (err) { console.error(err); log_err(err); }
    finally { console.log('removing process completed') }

}
async function daily_functions() {
    console.log('Starting daily functions...');
    console.log('Testing devices connection...');
    addresses = [config.ip1, config.ip2, config.ip_relay];
    cam_ip = [config.ip1, config.ip2];
    relay_ip = [config.ip_relay];
    console.log('Ping devices...')
    await check_devices(addresses);
    for (let i = 0; i < relay_ip.length; i++) { await check_relay_deactivate(relay_ip[i]); }
    for (let i = 0; i < relay_ip.length; i++) { await check_relay_activate(relay_ip[i]); }
    for (let i = 0; i < cam_ip.length; i++) { await check_plates_delete(cam_ip[i]); }
    for (let i = 0; i < relay_ip.length; i++) { await check_plates_add(cam_ip[i]); }

}
module.exports = {
    daily_functions,
    on_add,
    on_rm
};