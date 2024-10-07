const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const { exec } = require('child_process');
const config = require('./config.json');
const log_err = require('./log_err');
const https = require('https');
const InitConnection = require('./db');

async function check_plates_delete(address){
    try{
    connection = await InitConnection();
    console.log('Looking for plates to add...');
    const sql=`SELECT Targa FROM veicoli WHERE DATE(Fine) <= CURDATE()`;
    const result = await connection.execute(sql);
        if (result[0].length > 0) {
            const output = result[0].map(row => row.Targhe);

            for(let i=0;i>=output.length;i++){
                console.log('Add plate: ');
                console.log(output[i]);
                rm_plate(address,output[i]);
            }
        } 
        else{
            console.log('No plates to add...')
        }
    }
    catch(err){
            console.log(err);
            log_err(err)
        }
    finally {
        if (connection) {
            await connection.end();  // close connection
            console.log('DB connection closed')
        }}
};
async function check_plates_add(address){
    try{
    connection = await InitConnection();
    console.log('Looking for plates to add...');
    const sql=`SELECT Targa FROM veicoli WHERE DATE(Inizio) <= CURDATE()`;
    const result = await connection.execute(sql);
        if (result[0].length > 0) {
            const output = result[0].map(row => row.Targhe);

            for(let i=0;i>=output.length;i++){
                console.log('Add plate: ');
                console.log(output[i]);
                add_plate(address,output[i]);
            }
        } 
        else{
            console.log('No plates to add...')
        }
    }
    catch(err){
            console.log(err);
            log_err(err)
        }
    finally {
        if (connection) {
            await connection.end();  // close connection
            console.log('DB connection closed')
        }}
};
async function check_relay_deactivate(address){    
    try{
    connection = await InitConnection();
    console.log('checking relay to turn off...');
    const sql=`SELECT Colonnine FROM veicoli WHERE DATE(Fine) <= CURDATE()`;
    const result = await connection.execute(sql);
        if (result[0].length > 0) {
            const output = result[0].map(row => row.Colonnine);

            for(let i=0;i>=output.length;i++){
                console.log('Dectivating relay: ');
                console.log(output[i]);
                relay_off(address,output);
            }
        } 
        else{
            console.log('No relays to deactivate...')
        }
    }
    catch(err){
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
async function check_relay_activate(address){
    try{
        connection = await InitConnection();
        console.log('checking relay to activate...');
        const sql=`SELECT Colonnine FROM veicoli WHERE DATE(Inizio) <= CURDATE()`;
        const result = await connection.execute(sql);
            if (result[0].length > 0) {
                const output = result[0].map(row => row.Colonnine);

                for(let i=0;i>=output.length;i++){
                    console.log('Activating relay: ');
                    console.log(output[i]);
                    relay_on(address,output[i]);
                }
            } 
            else{
                console.log('No relays to activate...')
            }
        }
        catch(err){
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
async function relay_on(address,relay){
    return new Promise((resolve, reject) => {
        https.get(`http://${address}/axis-cgi/io/port.cgi?action=${relay}::/`, (resp) => {
        let data = '';
        resp.on('data',(chunk) => {
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
        log_err(err.message);
        reject(err);
        })
    } )
};
async function relay_off(address,relay){
    return new Promise((resolve, reject) => {
    https.get(`http://${address}/axis-cgi/io/port.cgi?action=${relay}:\\`, (resp) => { //double '\\' is for turning relay off
        let data = '';
        resp.on('data',(chunk) => {
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
})})
};
async function add_plate(address,plate){
    return new Promise((resolve, reject) => {
    https.get(`http://${address}/local/fflprapp/api.cgi?api=addplate&plate=${plate}&list=allow`, (resp) => {
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
})})
};
async function rm_plate(address,plate){
    return new Promise((resolve, reject) => {
    https.get(`http://${address}/local/fflprapp/api.cgi?api=delplate&plate=${plate}&list=allow`, (resp) => {
    let data = '';
    resp.on('data', (chunk) => {
        data += chunk;
    });

    resp.on('end', () => {
        console.log(JSON.parse(data));  
    });

}).on('error', (err) => {
    console.error('Error:', err.message);
})})
};
async function ping(address){
    try{
    return new Promise((resolve, reject) => {
        exec(`ping -n 1 ${address}`, (error,stdout, stderr) => {
            if(error){
                console.error(`Error pinging ${address}: ${stderr}`);
                resolve(true);
            } else{
                resolve(false);
            }
        });
    });}
    catch(err){
        console.error(err);
        log_err(err);}
};
async function check_devices(addresses){
    try{
    for(let i=0; i <addresses.length; i++ ){
        await ping(addresses[i]);
    }}
    catch(err){
        console.error(err);
        log_err(err);}
};
async function on_add(){
    addresses = [config.ip1,config.ip2, config.ip_relay];
    cam_ip = [config.ip1,config.ip2];
    relay_ip = [config.ip_relay];
    for(let i=0;i<relay_ip.lenght;i++){check_relay_activate(relay_ip[i]);}
    for(let i=0;i<relay_ip.lenght;i++){ check_plates_add(cam_ip[i]); }
}
async function on_rm(plate){
    addresses = [config.ip1,config.ip2, config.ip_relay];
    cam_ip = [config.ip1,config.ip2];
    relay_ip = [config.ip_relay];
    for(let i=0;i<relay_ip.lenght;i++){relay_off(relay_ip[i],plate);}
    for(let i=0;i<relay_ip.lenght;i++){ rm_plate(cam_ip[i],plate); }

}
async function daily_functions(){
    console.log('Starting daily functions...');
    console.log('Testing devices connection...');
    addresses = [config.ip1,config.ip2, config.ip_relay];
    cam_ip = [config.ip1,config.ip2];
    relay_ip = [config.ip_relay];
    console.log('Ping devices...')
    await check_devices(addresses);
    for(let i=0;i<relay_ip.length;i++){await check_relay_deactivate(relay_ip[i]);}
    for(let i=0;i<relay_ip.length;i++){await check_relay_activate(relay_ip[i]);}
    for(let i=0;i<cam_ip.length;i++){await check_plates_delete(cam_ip[i]); }
    for(let i=0;i<relay_ip.length;i++){await check_plates_add(cam_ip[i]); }
    
}
module.exports = {
    daily_functions,
    on_add,
    on_rm
};