require('dotenv').config();
import nodemailer from "nodemailer"

class UserEmailManager {

    constructor() {

        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE, // SSL
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    recovery(to) {
        this.sendmail(
            {
                from: process.env.SMTP_USER,
                to: to,
                subject: process.env.APP_NAME + " - Recuperacion de contraseña ",
                text: "Su nueva contraseña es:  ",
                html: "<p>Su nueva contraseña es:  </p>"
            }
        ).then(result => {
            console.log(result)
        }).catch((err) => {
            console.log(err)
        })
    }

    activation(to) {

        this.sendmail(
            {
                from: process.env.SMTP_USER,
                to: to,
                subject: process.env.APP_NAME + " - Activación de Cuenta",
                text: "Active su cuenta desde el link: ",
                html: "<p>Active su cuenta desde el link: </p>"
            }
        ).then(result => {
            console.log(result)
        }).catch((err) => {
            console.log(err)
        })
    }


    async sendmail({from, to, subject, text, html}) {
        let info = await this.transporter.sendMail({
            from: from,
            to: to, //LIST  1,2,3
            subject: subject,
            text: text,
            html: html
        });

        console.log(info)
        return info;
    }

}

module.exports = new UserEmailManager();