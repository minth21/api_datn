import multer from 'multer';

// Configure storage - Use memory storage for Cloudinary upload
const storage = multer.memoryStorage();

// File filter - only allow images
const fileFilter = (_req: any, file: any, cb: any) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'), false);
    }
};

// Create multer instance
export const uploadAvatar = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max file size
    },
});
