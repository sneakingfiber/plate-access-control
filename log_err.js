'use strict';
const moment = require('moment');
const fs = require('fs').promises;
const nodemailer = require('nodemailer');
const config = require('./config');

const LOG_FILE = 'errors_log.txt';

async function log_err(err_message) {
  const current_time = moment().format('YYYY-MM-DD HH:mm:ss');
  const form_err = `${current_time} - ${err_message}`;
  // Scrittura su file ed invio email sono indipendenti: se il file non e'
  // scrivibile la notifica deve partire comunque.
  try {
    await fs.appendFile(LOG_FILE, `${form_err}\n`);
  }
  catch (error) {
    console.error(`Impossibile scrivere ${LOG_FILE}:`, error);
  }
  try {
    sendEmail(form_err);
  }
  catch (error) {
    console.error(error);
  }
}

// Honours config.mail.enabled: a general-purpose install should not need an
// SMTP account, and the previous version built a transport and attempted a
// connection unconditionally.
//
// NOTE (Phase 8): still unthrottled — one unreachable device at sync time means
// one email per plate. Needs dedup by message hash with an hourly cap.
function sendEmail(err_message) {
  const mail = config.mail;
  if (!mail.enabled) return;

  try {
    const transporter = nodemailer.createTransport({
      host: mail.host,
      port: mail.port,
      secure: false,
      auth: { user: mail.user, pass: mail.password },
    });

    transporter.sendMail({
      from: mail.from || mail.user,
      to: mail.to,
      subject: 'Plate Access Control - Error Notification',
      text: err_message,
    }, (error, info) => {
      if (error) {
        console.error('Error while sending email:', error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });
  }
  catch (err) {
    console.error(err);
  }
}

module.exports = log_err;
