import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_MB = 5;
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.txt'];
const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  // random name so users can't overwrite or guess files
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXT.includes(ext) && ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
    cb(new Error('File type not allowed. Use an image, PDF, DOC/DOCX or TXT file'));
  },
});

// Wrapper so Multer errors become clean JSON responses
export const uploadAttachment = (req, res, next) => {
  upload.single('attachment')(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? `File too large (max ${MAX_MB} MB)` : err.message;
    res.status(400).json({ message });
  });
};