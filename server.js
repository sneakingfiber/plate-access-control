const express = require('express');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const { check_posti } = require('./endpoints/check_posti');
const { check_posti_modal } = require('./endpoints/check_posti_modal');
const { input_targhe } = require('./endpoints/input_targhe');
const { lista } = require('./endpoints/lista');
const { delete_targhe } = require('./endpoints/delete_targhe');
const { change_targhe } = require('./endpoints/change_targhe');
const { checkactive } = require('./endpoints/charging');
const { change_state } = require('./endpoints/change_state');
const { open_barrier } = require('./endpoints/open_barrier');
const { config } = require('./config.json');
const { daily_functions } = require('./camera_functions');
const { daily_functions_add } = require('./camera_functions');
const app = express();
const port = 3000; //server listening on this port
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); // Parsing delle richieste con JSON payload
app.use(express.urlencoded({ extended: true })); // Parsing delle richieste URL-encoded
app.use(express.static('public')); //definisci la cartella statica //middleware
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//ENDPOINT check_posti /////////////////////////////////////////////////////////////////////////////////////////////
app.post('/endpoints/check_posti', check_posti);
//ENDPOINT input targhe/////////////////////////////////////////////////////////////////////////////////////////////
app.post('/endpoints/input_targhe', input_targhe);
//ENDPOINT check_posti modal ///////////////////////////////////////////////////////////////////////////////////////
app.post('/endpoints/check_posti_modal', check_posti_modal);
// ENDPOINT list targhe db  ////////////////////////////////////////////////////////////////////////////////////////
app.post('/endpoints/lista', lista);
// ENDPOINT modifica targhe db  ////////////////////////////////////////////////////////////////////////////////////
app.post('/endpoints/change_targhe', change_targhe);
// ENDPOINT elimina targhe db  /////////////////////////////////////////////////////////////////////////////////////
app.post('/endpoints/delete_targhe', delete_targhe);
// ENDPOINT fetch dati colonnine  //////////////////////////////////////////////////////////////////////////////////
app.get('/endpoints/charging', checkactive);
// ENDPOINT on/off stazioni di ricarica ////////////////////////////////////////////////////////////////////////////
app.post('/endpoints/change_state', change_state);
// ENDPOINT apertura barriera  /////////////////////////////////////////////////////////////////////////////////////
app.get('/endpoints/open_barrier', open_barrier);
// Mostra la home  /////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/targhe.html');
});
// Avvia il server su una specifica porta///////////////////////////////////////////////////////////////////////////
app.listen(port, () => {
  console.log(`Server avviato su http://localhost:${port}`);
  daily_functions_add(config);
  daily_functions(config);
  // Esegui la funzione ogni giorno 
  cron.schedule('10 00 * * *', async () => {
    try {
      console.log('Esecuzione di daily_functions ...');
      await daily_functions(config);
      console.log('Fine Daily functions')
    } catch (error) {
      console.error('Errore durante l\'esecuzione di daily_functions:', error);
    }
  });
  cron.schedule('8 00 * * *', async () => {
    try {
      console.log('Esecuzione di daily_functions_add...');
      await daily_functions_add(config);
      console.log('Fine Daily functions add...')
    } catch (error) {
      console.error('Errore durante l\'esecuzione di daily_functions:', error);
    }
  });
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
