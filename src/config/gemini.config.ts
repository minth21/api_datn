import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEYS = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_KEY_2, // Key dự phòng (nếu có)
].filter(Boolean) as string[];

let currentKeyIndex = 0;

export const getNextGenerativeModel = (modelName = 'gemini-2.5-flash-lite') => {
    if (API_KEYS.length === 0) {
        throw new Error("CRITICAL: Không tìm thấy API Key nào trong môi trường!");
    }

    const key = API_KEYS[currentKeyIndex];
    // Xoay vòng index nếu có nhiều hơn 1 key
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;

    const genAI = new GoogleGenerativeAI(key);
    return genAI.getGenerativeModel({ model: modelName });
};
