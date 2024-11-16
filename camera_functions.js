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
        relay_ip = [config.ip_relay];
        connection = await InitConnection();
        console.log('Looking for plates to delete...');
        const sql = `SELECT Targa, Colonnine FROM veicoli WHERE DATE(Fine) <= CURDATE()`;
        const result = await connection.execute(sql);
        if (result[0].length > 0) {
            const output = result[0].map(row => ({
                Targa: row.Targa,
                //Colonnine: row.Colonnine
            }));

            for (let i = 0; i < output.length; i++) {
                const plate = output[i].Targa;

                console.log('Delete plate:', plate);
                await rm_plate(address, plate);
                await rm_db_plate(plate);
                //console.log('Turning off', relay);
                //console.log(relay_ip);
                //await relay_off(relay_ip, relay);


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
async function check_plates_add(address) {
    try {
        connection = await InitConnection();
        console.log('Looking for plates to add...');
        const sql = `SELECT Targa, Colonnine FROM veicoli WHERE DATE(Inizio) <= CURDATE()`;
        const result = await connection.execute(sql);
        if (result[0].length > 0) {
            const output = result[0].map(row => ({
                Targa: row.Targa,
                Colonnine: row.Colonnine
            }));

            for (let i = 0; i < output.length; i++) {
                const plate = output[i].Targa;
                const relay = output[i].Colonnine;

                console.log('Adding plate:', plate);
                await add_plate(address, plate);
                //await relay_on(config.relay_ip, relay);

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

            for (let i = 0; i < output.length; i++) {
                console.log('Dectivating relay: ');
                console.log(output[i] + 8);
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
        let relay;
        connection = await InitConnection();
        console.log('checking relay to activate...');
        const sql = `SELECT Colonnine FROM veicoli WHERE DATE(Inizio) = CURDATE()`;
        const result = await connection.execute(sql);
        if (result[0].length > 0) {
            const output = result[0].map(row => row.Colonnine);

            for (let i = 0; i < output.length; i++) {
                console.log('Activating relay: ');
                relay = output[i] + 8;
                console.log(relay);
                relay_on(address, relay);
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
async function relay_on(address, relay) {
    try {
        const username = config.relayuser;
        const password = config.relaypassword;
        const client = new DigestClient(username, password);

        const url = `http://${address}/axis-cgi/io/port.cgi?action=${relay}:/`;

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

        const url = `http://${address}/axis-cgi/io/port.cgi?action=${relay}:%5C`;

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
async function rm_db_plate(plate) {
    try {
        const tableName = config.tableName;
        connection = await InitConnection();
        console.log(plate);
        const insertQuery = `DELETE FROM ${tableName} WHERE Targa='${plate}'`;
        const result2 = await connection.execute(insertQuery);
        if (result2[0].affectedRows > 0) {
            console.log('Plate deleted successfully.');

        }
        else {
            console.log('Errore di comunicazione col DB o targa non trovata.');
            
        }

    }
    catch (err) {
        console.log(err);
        log_err(err);
        throw err;
    }
    finally {
        console.log('deleting plate..')
        if (connection) {
            await connection.end();  // close connection
            console.log('DB connection closed')
        }
    }

}
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
        //for (let i = 0; i < relay_ip.lenght; i++) { await check_relay_activate(relay_ip[i]); }
        //for (let i = 0; i < cam_ip.lenght; i++) { await check_plates_add(cam_ip[i]); }
        await Promise.all(cam_ip.map(ip => check_plates_add(ip)));
        await Promise.all(relay_ip.map(ip => check_relay_activate(ip)));
    }
    catch (err) {
        console.error(err); log_err(err);
    }
    finally { console.log('adding process completed') };
}
async function on_rm(plate) {
    try {
        let connection = await InitConnection();
        addresses = [config.ip1, config.ip2, config.ip_relay];
        cam_ip = [config.ip1, config.ip2];
        relay_ip = [config.ip_relay];
        const tableName = config.tableName;
            const checkQuery = `SELECT Targa, Colonnine FROM ${tableName} WHERE DATE(Inizio) <= CURDATE() AND Targa = '${plate}'`;
            const result = await connection.execute(checkQuery);
            console.log('on rm')
            if (result[0].length > 0) {
                const output = result[0].map(row => ({
                    Targa: row.Targa,
                    Colonnine: row.Colonnine
                }));
                relay = output[0].Colonnine + 8;
                console.log('Turning off relay:')
                console.log(relay)

                await Promise.all(relay_ip.map(ip => relay_off(ip,relay)));
            }
            await Promise.all(cam_ip.map(ip => rm_plate(ip,plate)));

        await rm_db_plate(plate);
    }
    catch (err) { console.error(err); log_err(err); }
    finally {
        console.log('removing process completed')
        await connection.end();
    }

}
async function daily_functions_add() {
    console.log('Starting daily functions add...');
    console.log('Testing devices connection...');
    addresses = [config.ip1, config.ip2, config.ip_relay];
    cam_ip = [config.ip1, config.ip2];
    relay_ip = [config.ip_relay];
    console.log('Ping devices...')
    await check_devices(addresses);
    await Promise.all(cam_ip.map(ip => check_plates_add(ip)));
    //for (let i = 0; i < cam_ip.length; i++) { await check_plates_add(cam_ip[i]); }

}
async function daily_functions() {
    console.log('Starting daily functions add...');
    console.log('Testing devices connection...');
    addresses = [config.ip1, config.ip2, config.ip_relay];
    cam_ip = [config.ip1, config.ip2];
    relay_ip = [config.ip_relay];
    console.log('Ping devices...')
    await check_devices(addresses);
    console.log('CHECK RELAYS TO TURN OFF');
    for (let i = 0; i < relay_ip.length; i++) { await check_relay_deactivate(relay_ip[i]); }
    console.log('CHECK RELAYS TO TURN ON');
    for (let i = 0; i < relay_ip.length; i++) { await check_relay_activate(relay_ip[i]); }
    console.log('CHECK PLATES TO DELETE');
    for (let i = 0; i < cam_ip.length; i++) { await check_plates_delete(cam_ip[i]); }
    //for (let i = 0; i < relay_ip.length; i++) { await check_plates_add(cam_ip[i]); }
}
module.exports = {
    daily_functions,
    daily_functions_add,
    on_add,
    on_rm,
    relay_off,
    relay_on,
    add_plate,
    rm_plate,
    check_plates_add,
    check_plates_delete,
    check_relay_activate
};