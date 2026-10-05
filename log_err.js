const moment = require('moment');
const fs = require('fs').promises;
const nodemailer = require('nodemailer');
const config = require('./config');
const email_address = config.emailaddress;
const receiver = config.emailreceiver;
const email_pw = config.emailpassword;

async function log_err(err_message) {
  const current_time = moment().format('YYYY-MM-DD HH:mm:ss');
  const form_err = `${current_time} - ${err_message}`;
  // Scrittura su file ed invio email sono indipendenti: se il file non e'
  // scrivibile la notifica deve partire comunque.
  try {
    await fs.appendFile('errors_log.txt', `${form_err}\n`);
  }
  catch (error) {
    console.error('Impossibile scrivere errors_log.txt:', error);
  }
  try {
    sendEmail(form_err);
  }
  catch (error) {
    console.error(error);
  }
}

function sendEmail(err_message) {
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.smtp_port,
      secure: false,
      auth: {
        user: config.emailaddress,
        pass: config.emailpassword,
      },
    });

    const mailOptions = {
      from: config.emailaddress,
      to: config.emailreceiver,
      subject: 'ParkingLot Error Notification',
      text: err_message,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error while sending email:", error);
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