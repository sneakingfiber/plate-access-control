const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');

const app = express();
const port = 3000; // Porta del server

// Configurazione delle credenziali di accesso al database
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // La tua password del database, se presente
  database: 'nomi_e_targhe'
});

// Connessione al database
connection.connect((err) => {
  if (err) {
    console.error('Errore di connessione al database:', err.stack);
    return;
  }
  console.log('Connessione al database avvenuta con successo.');
});

// Middleware per il parsing del corpo della richiesta
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Gestisce la richiesta POST per l'inserimento delle targhe
app.post('/insert_plate', (req, res) => {
  // Recupera i dati dal corpo della richiesta
  const { name, plate, data_arrivo, data_partenza, selectedCar } = req.body;

  // Controlla se la targa esiste già nel database
  const checkQuery = `SELECT Targa FROM veicoli WHERE Targa = '${plate}'`;
  connection.query(checkQuery, (err, results) => {
    if (err) {
      console.error('Errore nel controllo della targa nel database:', err);
      res.status(500).send('Errore nel controllo della targa nel database.');
      return;
    }
    
    // Se esiste già una targa con lo stesso valore
    if (results.length > 0) {
      res.redirect('/loading_existing_plate.html');
      return;
    }

    // Altrimenti, esegui l'inserimento nel database
    const insertQuery = `INSERT INTO veicoli (Nome, Targa, Inizio, Fine, Colonnine) VALUES (?, ?, ?, ?, ?)`;
    connection.query(insertQuery, [name, plate, data_arrivo, data_partenza, selectedCar], (err, result) => {
      if (err) {
        console.error('Errore nell\'inserimento dei dati nel database:', err);
        res.status(500).send('Errore nell\'inserimento dei dati nel database.');
        return;
      }
      console.log('Dati inseriti con successo nel database.');
      res.redirect('/loading_success_plate.html');
    });
  });
});

