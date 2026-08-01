const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Files are stored on local disk under /uploads for this project. A production
// version would swap this storage engine for S3/Cloudinary without touching
// any of the route logic - multer's storage is pluggable by design.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB cap per file

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    // A basic allowlist - blocks executables/scripts from being uploaded as
    // "attachments", which is a real (if small) security consideration for
    // any file-upload feature.
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|txt|mp4|mov|webm/;
    const isAllowed = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (isAllowed) return cb(null, true);
    cb(new Error('File type not allowed'));
  },
});

module.exports = upload;
