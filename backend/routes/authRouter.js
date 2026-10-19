import express from 'express';
import { register, login, me } from '../controller/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/me',protect,me);

export default router;