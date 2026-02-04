import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload file to Cloudinary from buffer
 */
export const uploadToCloudinary = (
    fileBuffer: Buffer,
    folder: string = 'toeic_practice/avatars'
): Promise<any> => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                transformation: [
                    {
                        width: 500,
                        height: 500,
                        crop: 'fill',
                        gravity: 'face',
                    },
                ],
                format: 'jpg',
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        );

        // Create a readable stream from buffer and pipe to Cloudinary
        const streamifier = require('streamifier');
        streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
};

/**
 * Upload exam image to Cloudinary (no transformation)
 */
export const uploadExamImageToCloudinary = (
    fileBuffer: Buffer,
    folder: string = 'toeic_practice/exam-images'
): Promise<any> => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: 'image',
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        );

        // Create a readable stream from buffer and pipe to Cloudinary
        const streamifier = require('streamifier');
        streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
};

/**
 * Delete file from Cloudinary
 */
export const deleteFromCloudinary = async (
    publicId: string
): Promise<any> => {
    return cloudinary.uploader.destroy(publicId);
};

/**
 * Extract public_id from Cloudinary URL
 */
export const extractPublicId = (url: string): string | null => {
    // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{folder}/{public_id}.{format}
    const matches = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
    return matches ? matches[1] : null;
};

export default cloudinary;
