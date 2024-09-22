const moment = require('moment');
const fs = require('fs');
const nodemailer = require('nodemailer')

function log_err(err_message){
    try{
        const current_time = moment().format('YYYY-MM-DD HH:mm:ss');
        const form_err= `${current_time} - ${err_message}`;
        fs.appendFile('errors_log.txt', `${form_err}\n`, (err) => {
            if (err) throw err; 
          });
          sendEmail(form_err);
    }
    catch(error){

    }
}

function sendEmail(err_message) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'your_email@gmail.com',
        pass: 'your_password',
      },
    });
  
    const mailOptions = {
      from: 'your_email@gmail.com',
      to: 'recipient_email@gmail.com',
      subject: 'Error Notification',
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

  module.exports = log_err;