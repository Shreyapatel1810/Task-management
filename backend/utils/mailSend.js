import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const emailUser = process.env.EMAIL_USER?.trim();
const emailPass = process.env.EMAIL_PASS?.replace(/\s+/g, '');

let transporter;

const getTransporter = () => {
  if (!emailUser || !emailPass) {
    throw new Error('EMAIL_USER or EMAIL_PASS is missing');
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: emailUser, pass: emailPass },
    });
  }

  return transporter;
};

export const sendEmail = async (to, subject, html) => {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return getTransporter().sendMail({
    from: `"Task Management" <${emailUser}>`,
    to,
    subject,
    html,
    text,
  });
};