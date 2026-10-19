
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: path.join(__dirname, '.env'),
});

const user = process.env.EMAIL_USER?.trim();
const pass = process.env.EMAIL_PASS?.trim();

console.log('Email configured:', Boolean(user), Boolean(pass));
console.log('Password length:', pass?.length);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user,
    pass,
  },
});

try {
  await transporter.verify();
  console.log('SUCCESS: Gmail authentication works.');
} catch (error) {
  console.log('FAILED:', error.message);
}
