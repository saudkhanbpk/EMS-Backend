import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Create email transporter
const createEmailTransporter = () => {
    return nodemailer.createTransporter({
        service: "gmail",
        auth: {
            user: process.env.VITE_EMAIL_USER,
            pass: process.env.VITE_EMAIL_PASS,
        },
    });
};

export { createEmailTransporter };
