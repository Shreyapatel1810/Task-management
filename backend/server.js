import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRouter from './routes/authRouter.js';
import userRouter from './routes/userRouter.js';
import taskRouter from './routes/taskRouter.js';

dotenv.config();
console.log('ENV keys loaded:', Object.keys(process.env).filter((k) => /JWT|MONGO|PORT|CLIENT/.test(k)));

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

app.get('/', (req, res) => res.send('API is running...'));

app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/tasks', taskRouter);

app.use('/api', (req, res) => res.status(404).json({ message: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error' });
});

const PORT = process.env.PORT || 5000;
connectDB().then(() => app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)));