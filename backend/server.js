
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import connectDB from './config/db.js';
import authRouter from './routes/authRouter.js';
import userRouter from './routes/userRouter.js';
import taskRouter from './routes/taskRouter.js';

// Load the .env file from the backend folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envResult = dotenv.config({
  path: path.join(__dirname, '.env'),
});

if (envResult.error) {
  console.error('Failed to load .env:', envResult.error.message);
} else {
  console.log('.env file loaded');
}

console.log('EMAIL_USER loaded:', Boolean(process.env.EMAIL_USER));
console.log('EMAIL_PASS loaded:', Boolean(process.env.EMAIL_PASS));

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
}));

app.use(express.json());

app.get('/', (req, res) => res.send('API is running...'));

app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/tasks', taskRouter);

app.use('/api', (req, res) =>
  res.status(404).json({ message: 'Route not found' })
);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error' });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch((error) => {
  console.error('Database connection failed:', error);
});
