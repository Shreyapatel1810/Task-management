
import express from 'express';

import {
  createTask,
  getTasks,
  getTask,
  updateTask,
  updateStatus,
  deleteTask,
  getStats,
  assignTask,
  getTaskAttachment,
  removeTaskAttachment
} from '../controller/taskController.js';

import { protect } from '../middleware/auth.js';
import { uploadAttachment } from '../middleware/upload.js';

const router = express.Router();

router.post('/create', protect, uploadAttachment, createTask);

router.post('/list', protect, getTasks);

router.post('/details', protect, getTask);

router.post('/update', protect, uploadAttachment, updateTask);

router.post('/update-status', protect, updateStatus);

router.post('/delete', protect, deleteTask);

router.post('/stats', protect, getStats);

router.post('/assign', protect, assignTask);

router.post('/attachment', protect, getTaskAttachment);

router.post('/remove-attachment',protect,removeTaskAttachment);

export default router;
