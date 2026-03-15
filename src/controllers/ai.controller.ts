import { Request, Response } from 'express';
import sharp from 'sharp'; // Image optimization
import {
    generatePart6ExplanationService,
    generateExplanationService,
    generateBatchExplanationsService,
    generatePart7ExplanationService,
    scanPart7FromImageService,
    scanPart6FromImageService,
    magicScanPart7FromImagesService,
    magicScanPart6FromImagesService,
    translateWordService
} from '../services/ai.service';
import axios from 'axios';

// Helper: Resize & nén ảnh trước khi gửi Gemini (giảm 80% dung lượng, tăng tốc 2-3x)
const optimizeImage = async (buffer: Buffer): Promise<Buffer> => {
    try {
        return await sharp(buffer)
            .resize({ width: 1024, withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
    } catch (error) {
        console.warn('[AI] Image optimization failed, using original:', error);
        return buffer; // Fallback: dùng buffer gốc nếu sharp lỗi
    }
};

export const generatePart6Explanations = async (req: Request, res: Response) => {
    try {
        let { passage, questions }: { passage: string; questions: any } = req.body;

        if (typeof questions === 'string') questions = JSON.parse(questions);
        if (!passage && req.body.passageText) passage = req.body.passageText;

        if (!passage || !questions || questions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Passage and questions are required'
            });
        }

        const aiResponse = await generatePart6ExplanationService(passage, questions);
        console.log(`[INFO] AI Part 6 generated successfully for ${questions.length} questions`);

        return res.json({
            success: true,
            data: aiResponse
        });

    } catch (error: any) {
        console.error('AI Part 6 Error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate explanations'
        });
    }
};

export const generateExplanation = async (req: Request, res: Response) => {
    try {
        const { questionText, options, correctAnswer } = req.body;

        if (!questionText || !options || !correctAnswer) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin câu hỏi'
            });
        }

        const aiResponse = await generateExplanationService(questionText, options, correctAnswer);

        let fullExplanation = '';
        if (correctAnswer) {
            fullExplanation += `<b>Đáp án đúng: ${correctAnswer}</b><br/><br/>`;
        }
        if (aiResponse.translation) {
            fullExplanation += `📍 <b>Tạm dịch:</b><br/>${aiResponse.translation.replace(/\n/g, '<br/>')}<br/><br/>`;
        }
        if (aiResponse.explanation) {
            fullExplanation += `💡 <b>Giải thích:</b><br/>${aiResponse.explanation.replace(/\n/g, '<br/>')}<br/><br/>`;
        }
        if (aiResponse.tip) {
            fullExplanation += `💎 <b>Mẹo nhỏ:</b><br/>${aiResponse.tip.replace(/\n/g, '<br/>')}`;
        }

        return res.json({
            success: true,
            explanation: fullExplanation.trim() || aiResponse.explanation,
            translation: aiResponse.translation
        });

    } catch (error: any) {
        console.error('AI Explanation Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const generateBatchExplanations = async (req: Request, res: Response) => {
    try {
        const { questions } = req.body;

        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Questions array is required'
            });
        }

        const aiResponses = await generateBatchExplanationsService(questions);

        const formattedExplanations = aiResponses.map((resp: any) => {
            let fullExplanation = '';
            if (resp.translation) {
                fullExplanation += `📍 <b>Tạm dịch:</b><br/>${resp.translation.replace(/\n/g, '<br/>')}<br/><br/>`;
            }
            if (resp.explanation) {
                fullExplanation += `💡 <b>Giải thích:</b><br/>${resp.explanation.replace(/\n/g, '<br/>')}<br/><br/>`;
            }
            if (resp.tip) {
                fullExplanation += `💎 <b>Mẹo nhỏ:</b><br/>${resp.tip.replace(/\n/g, '<br/>')}`;
            }

            return {
                questionNumber: resp.questionNumber,
                explanation: fullExplanation.trim() || resp.explanation || 'Không có lời giải'
            };
        });

        return res.json({
            success: true,
            explanations: formattedExplanations
        });

    } catch (error: any) {
        console.error('Batch AI Error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate batch explanations'
        });
    }
};

export const scanPart7 = async (req: Request, res: Response) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'Vui lòng upload ảnh' });
        const data = await scanPart7FromImageService(req.file.buffer, req.file.mimetype);
        return res.json({ success: true, data });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const scanPart6 = async (req: Request, res: Response) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'Vui lòng upload ảnh' });
        const data = await scanPart6FromImageService(req.file.buffer, req.file.mimetype);
        return res.json({ success: true, data });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const generatePart7Explanations = async (req: Request, res: Response) => {
    try {
        let { passageType, passageContent, questions } = req.body;

        if (typeof questions === 'string') questions = JSON.parse(questions);
        if (!passageContent && req.body.passageText) passageContent = req.body.passageText;

        const files = req.files as Express.Multer.File[];
        if (files && files.length > 0) {
            passageType = 'image';
            passageContent = files.map(f => ({
                buffer: f.buffer,
                mimeType: f.mimetype
            }));
        }

        if (!questions || !passageContent) return res.status(400).json({ success: false, message: 'Thiếu dữ liệu' });

        const data = await generatePart7ExplanationService(passageType || 'text', passageContent, questions);
        console.log(`[INFO] AI Part 7 generated successfully for ${questions.length} questions`);
        return res.json({ success: true, data });
    } catch (error: any) {
        console.error('AI Part 7 Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const magicScanPart7 = async (req: Request, res: Response) => {
    try {
        const files = (req.files as Express.Multer.File[]) || [];
        
        let { imageUrls } = req.body;
        if (typeof imageUrls === 'string') imageUrls = JSON.parse(imageUrls);
        
        const urlImages = [];
        if (imageUrls && Array.isArray(imageUrls)) {
            console.log(`[AI] Downloading ${imageUrls.length} image URLs for Part 7 Magic Scan...`);
            for (const url of imageUrls) {
                try {
                    const response = await axios.get(url, { responseType: 'arraybuffer' });
                    urlImages.push({
                        buffer: await optimizeImage(Buffer.from(response.data)),
                        mimeType: 'image/jpeg'
                    });
                } catch (e) {
                    console.error(`[AI] Failed to download image from ${url}:`, e);
                }
            }
        }

        const uploadedImages = await Promise.all(files.map(async file => ({
            buffer: await optimizeImage(file.buffer),
            mimeType: 'image/jpeg'
        })));

        const allImages = [...urlImages, ...uploadedImages];
        if (allImages.length === 0) {
            return res.status(400).json({ success: false, message: 'Vui lòng upload ít nhất một ảnh hoặc cung cấp URL ảnh' });
        }

        console.log(`[AI] Starting Magic Scan Part 7 with ${allImages.length} images...`);

        let data: any;
        try {
            data = await magicScanPart7FromImagesService(allImages);
        } catch (firstErr: any) {
            console.warn(`[AI] Attempt 1 failed: ${firstErr.message}. Retrying once...`);
            data = await magicScanPart7FromImagesService(allImages);
        }

        const passageRegions: any[] = Array.isArray(data.passageRegions) ? data.passageRegions : [];
        if (passageRegions.length > 0) {
            const Jimp: any = (await import('jimp')).Jimp;
            const { uploadExamImageToCloudinary } = await import('../config/cloudinary.config');
            const croppedUrls: string[] = [];

            for (const region of passageRegions) {
                try {
                    const imgIndex = region.pageIndex;
                    if (imgIndex !== undefined && files[imgIndex]) {
                        const image = await Jimp.read(files[imgIndex].buffer);
                        const width = image.bitmap.width;
                        const height = image.bitmap.height;
                        const [ymin, xmin, ymax, xmax] = region.box_2d;
                        const left = Math.floor((xmin / 1000) * width);
                        const top = Math.floor((ymin / 1000) * height);
                        const cropWidth = Math.floor(((xmax - xmin) / 1000) * width);
                        const cropHeight = Math.floor(((ymax - ymin) / 1000) * height);

                        if (cropWidth > 0 && cropHeight > 0 && left >= 0 && top >= 0) {
                            image.crop({ x: left, y: top, w: cropWidth, h: cropHeight });
                            const croppedBuffer = await image.getBuffer('image/jpeg');
                            const uploadRes = await uploadExamImageToCloudinary(croppedBuffer);
                            if (uploadRes && uploadRes.secure_url) {
                                croppedUrls.push(uploadRes.secure_url);
                            }
                        }
                    }
                } catch (cropErr) {
                    console.error('Error cropping image region:', cropErr);
                }
            }

            if (croppedUrls.length > 0) {
                (data as any).croppedPassageUrls = croppedUrls;
            }
        }

        return res.json({ success: true, data });
    } catch (error: any) {
        console.error('Magic Scan Part 7 Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const magicScanPart6 = async (req: Request, res: Response) => {
    try {
        const files = (req.files as Express.Multer.File[]) || [];
        
        let { imageUrls } = req.body;
        if (typeof imageUrls === 'string') imageUrls = JSON.parse(imageUrls);

        const urlImages = [];
        if (imageUrls && Array.isArray(imageUrls)) {
            console.log(`[AI] Downloading ${imageUrls.length} image URLs for Part 6 Magic Scan...`);
            for (const url of imageUrls) {
                try {
                    const response = await axios.get(url, { responseType: 'arraybuffer' });
                    urlImages.push({
                        buffer: await optimizeImage(Buffer.from(response.data)),
                        mimeType: 'image/jpeg'
                    });
                } catch (e) {
                    console.error(`[AI] Failed to download image from ${url}:`, e);
                }
            }
        }

        const uploadedImages = await Promise.all(files.map(async file => ({
            buffer: await optimizeImage(file.buffer),
            mimeType: file.mimetype
        })));

        const allImages = [...urlImages, ...uploadedImages];

        if (allImages.length === 0) {
            return res.status(400).json({ success: false, message: 'Vui lòng upload ít nhất một ảnh hoặc cung cấp URL ảnh' });
        }

        const data = await magicScanPart6FromImagesService(allImages);
        console.log(`[INFO] Magic Scan Part 6 completed for ${data.questions?.length || 0} questions across ${allImages.length} images`);

        return res.json({ success: true, data });
    } catch (error: any) {
        console.error('Magic Scan Part 6 Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const translateWord = async (req: Request, res: Response) => {
    try {
        const { word, sentence } = req.body;
        if (!word || !sentence) {
            return res.status(400).json({ success: false, message: 'Thiếu từ hoặc câu ngữ cảnh' });
        }

        const data = await translateWordService(word, sentence);
        return res.json({ success: true, data });
    } catch (error: any) {
        console.error('AI Translate Word Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
