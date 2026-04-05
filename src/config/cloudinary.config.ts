import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

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
 * Upload any file to Cloudinary (PDF, Doc, etc.)
 */
export const uploadFileToCloudinary = (
    fileBuffer: Buffer,
    folder: string = 'class_materials'
): Promise<any> => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: 'auto', // Cloudinary detects type (PDF, zip, etc.)
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );

        const stream = new Readable();
        stream.push(fileBuffer);
        stream.push(null);
        stream.pipe(uploadStream);
    });
};

/**
 * Upload audio to Cloudinary (resource_type: video)
 */
export const uploadAudioToCloudinary = (
    fileBuffer: Buffer,
    folder: string = 'toeic_practice/exam-audio'
): Promise<any> => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: 'video', // Cloudinary handles audio as video
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

/**
 * Cleanup multiple Cloudinary assets from URLs (handles CSV strings and arrays)
 */
export const cleanupCloudinaryAssets = async (
    urls: string | string[] | null | undefined
): Promise<void> => {
    if (!urls) return;

    let urlList: string[] = [];
    if (typeof urls === 'string') {
        urlList = urls.split(',').map(u => u.trim()).filter(Boolean);
    } else if (Array.isArray(urls)) {
        urlList = urls.filter(Boolean);
    }

    const deletePromises = urlList.map(async (url) => {
        const publicId = extractPublicId(url);
        if (publicId) {
            try {
                // Determine resource type based on URL (optional but safer)
                // Cloudinary handles 'image' by default in destroy, 
                // but audio usually needs resource_type: 'video'
                const resourceType = url.includes('/video/upload/') || url.includes('/raw/upload/') ? 'video' : 'image';
                await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
            } catch (error) {
                console.error(`Failed to delete asset ${publicId} from Cloudinary:`, error);
            }
        }
    });

    await Promise.all(deletePromises);
};

export default cloudinary;
