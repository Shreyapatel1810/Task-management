import express from 'express';
import { protect } from '../middleware/auth.js';
import { listUsers } from '../controller/userController.js';

const router = express.Router();
router.post('/list', protect, listUsers);
export default router;