import { Router } from 'express';
import multer from 'multer';
import { uploadExamImage, uploadAudio } from '../controllers/upload.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Configure multer for memory storage (Cloudinary upload from buffer)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images and audio are allowed'));
        }
    }
});

// Route: POST /api/upload/image
// Protected by auth middleware
router.post('/image', authMiddleware, upload.single('image'), uploadExamImage);

// Route: POST /api/upload/audio
// Protected by auth middleware
router.post('/audio', authMiddleware, upload.single('audio'), uploadAudio);

export default router;
