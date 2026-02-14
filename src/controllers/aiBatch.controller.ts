import { Request, Response } from 'express';
import { geminiModel } from '../config/gemini.config';

/**
 * Generate AI explanations for multiple questions in one request
 * POST /api/ai/generate-batch-explanations
 */
export const generateBatchExplanations = async (req: Request, res: Response) => {
    try {
        const { questions } = req.body;

        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Questions array is required'
            });
        }

        // Build prompt for multiple questions
        const prompt = `Nhiệm vụ: Giải thích ${questions.length} câu TOEIC sau, mỗi câu thật ngắn gọn (dưới 100 chữ).

${questions.map((q: any) => `
Câu ${q.questionNumber}: "${q.questionText}"
A. ${q.options.A}
B. ${q.options.B}
C. ${q.options.C}
D. ${q.options.D}
Đáp án đúng: ${q.correctAnswer}
`).join('\n---\n')}

Cấu trúc output (JSON array):
[
    {
        "questionNumber": 101,
        "answer": "A",
        "translation": "Dịch nghĩa 1 câu ngắn gọn",
        "explanation": "Giải thích trọng tâm cấu trúc ngữ pháp (ngắn gọn)",
        "tip": "Dấu hiệu nhận biết nhanh"
    },
    ...
]

Lưu ý: Mỗi câu chỉ 1-2 câu ngắn cho mỗi phần, tổng dưới 100 chữ.`;

        const result = await geminiModel.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        console.log('=== AI Raw Response ===');
        console.log(text);
        console.log('======================');

        let aiResponses;
        try {
            const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
            const jsonText = jsonMatch ? jsonMatch[1] : text;
            console.log('Extracted JSON:', jsonText);
            aiResponses = JSON.parse(jsonText);
            console.log('Parsed AI Responses:', aiResponses);
        } catch (e) {
            console.error('JSON Parse Error:', e);
            console.error('Failed to parse text:', text);
            // Fallback: create simple responses
            aiResponses = questions.map((q: any) => ({
                questionNumber: q.questionNumber,
                answer: q.correctAnswer,
                translation: '',
                explanation: text,
                tip: ''
            }));
        }

        // Format explanations with emojis and clear spacing
        const formattedExplanations = aiResponses.map((resp: any) => {
            let fullExplanation = '';

            // Add answer section
            if (resp.answer) {
                fullExplanation += `✅ Đáp án: ${resp.answer}\n\n`;
            }

            // Add translation
            if (resp.translation) {
                fullExplanation += `📖 Tạm dịch:\n${resp.translation}\n\n`;
            }

            // Add explanation
            if (resp.explanation) {
                fullExplanation += `✏️ Giải thích:\n${resp.explanation}\n\n`;
            }

            // Add tip
            if (resp.tip) {
                fullExplanation += `💡 Mẹo:\n${resp.tip}`;
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
