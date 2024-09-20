const mysql = require('mysql');
const express = require('express');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    db: 'nomi_e_targhe'
});

connection.connect((err)=>{
    if(err){
        console.err('An error occured while connecting to DB');
        return;
    }
    console.log('Connection estabilished!');
});

app.post('/getData', (req, res) => {
    const { data_arrivo, data_partenza } = req.body;
    const sql=`SELECT Colonnine FROM veicoli WHERE ('$data_arrivo' BETWEEN Inizio AND Fine)
    OR ('$data_partenza' BETWEEN Inizio AND Fine)`;
    connection.query(sql,(err,result)=> {
        if (err) {
            console.error('Errore nella query:', err);
            res.status(500).send('Errore nella query.');
            return;
          }
      
          if (results.length > 0) {
            const output = results.map(row => row.Colonnine);
            res.json(output);
          } else {
            res.json([]); // No result found return an empty array
          }
        });
      });
