import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Use Gemini 2.5 Flash - optimal for TOEIC explanations
// New API key = fresh quota: 20 requests/day
export const geminiModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash'
});

export default genAI;
