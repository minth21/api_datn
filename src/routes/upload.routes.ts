import { Router } from 'express';
import multer from 'multer';
import { uploadExamImage } from '../controllers/upload.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Configure multer for memory storage (Cloudinary upload from buffer)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

// Route: POST /api/upload/image
// Protected by auth middleware
router.post('/image', authMiddleware, upload.single('image'), uploadExamImage);

export default router;
