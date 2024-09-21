const express = require('express');
const bodyParser = require('body-parser');
const { check_posti } = require('./check_posti');
const { input_targhe } = require('./input_targhe');
const app = express();
const port = 3000; //server listening on this port
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); // Parsing delle richieste con JSON payload
app.use(express.urlencoded({ extended: true })); // Parsing delle richieste URL-encoded
app.use(express.static('public')); //definisci la cartella statica //middleware
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//ENDPOINT check_posti /////////////////////////////////////////////////////////////////////////////////////////////
app.post('/check_posti', check_posti );

//ENDPOINT input targhe/////////////////////////////////////////////////////////////////////////////////////////////
app.post('/input_targhe', input_targhe);

// Avvia il server su una specifica porta///////////////////////////////////////////////////////////////////////////
app.listen(port, () => {
    console.log(`Server avviato su http://localhost:${port}`);
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
