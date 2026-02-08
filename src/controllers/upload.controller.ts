import { Request, Response, NextFunction } from 'express';
import { uploadExamImageToCloudinary, uploadAudioToCloudinary } from '../config/cloudinary.config';

/**
 * Upload image to Cloudinary (Exam Images)
 */
export const uploadExamImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, message: 'No file uploaded' });
            return;
        }

        const result = await uploadExamImageToCloudinary(req.file.buffer);

        res.status(200).json({
            success: true,
            message: 'Image uploaded successfully',
            url: result.secure_url,
            publicId: result.public_id
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Upload audio to Cloudinary
 */
export const uploadAudio = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, message: 'No file uploaded' });
            return;
        }

        const result = await uploadAudioToCloudinary(req.file.buffer);

        res.status(200).json({
            success: true,
            message: 'Audio uploaded successfully',
            url: result.secure_url,
            publicId: result.public_id
        });
    } catch (error) {
        next(error);
    }
};
