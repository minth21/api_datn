import { Request, Response } from 'express';
import { geminiModel } from '../config/gemini.config';

interface Part6Question {
    questionNumber: number;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: string;
}

interface Part6Request {
    passage: string;
    questions: Part6Question[];
}

export const generatePart6Explanations = async (req: Request, res: Response) => {
    try {
        const { passage, questions }: Part6Request = req.body;

        // Validate input
        if (!passage || !questions || questions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Passage and questions are required'
            });
        }

        // Build prompt
        const prompt = buildPart6Prompt(passage, questions);

        // Call Gemini API
        const result = await geminiModel.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Parse JSON response
        let aiResponse;
        try {
            // Extract JSON from markdown code blocks if present
            const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
            const jsonText = jsonMatch ? jsonMatch[1] : text;
            aiResponse = JSON.parse(jsonText);
        } catch (parseError) {
            console.error('Failed to parse AI response:', text);
            return res.status(500).json({
                success: false,
                message: 'Failed to parse AI response',
                rawResponse: text
            });
        }

        return res.json({
            success: true,
            data: aiResponse
        });

    } catch (error: any) {
        console.error('Gemini API Error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate explanations'
        });
    }
};

function buildPart6Prompt(passage: string, questions: Part6Question[]): string {
    const questionsText = questions.map(q => `
Question ${q.questionNumber}:
A. ${q.optionA}
B. ${q.optionB}
C. ${q.optionC}
D. ${q.optionD}
Correct Answer: ${q.correctAnswer}
    `).join('\n');

    return `Bạn là một giáo viên TOEIC chuyên nghiệp. Hãy phân tích đoạn văn Part 6 sau và tạo lời giải chi tiết cho từng câu hỏi.

ĐOẠN VĂN:
${passage}

CÁC CÂU HỎI:
${questionsText}

YÊU CẦU:
- Giải thích bằng tiếng Việt rõ ràng, dễ hiểu
- Phân tích ngữ cảnh của đoạn văn
- Giải thích tại sao đáp án đúng là đúng
- Nếu cần, giải thích tại sao các đáp án khác sai
- Cung cấp dịch nghĩa nếu cần thiết

Trả về kết quả dưới dạng JSON với cấu trúc sau (KHÔNG thêm markdown code blocks):
{
    "explanations": [
        {
            "questionNumber": 131,
            "explanation": "Lời giải chi tiết bằng tiếng Việt...",
            "translation": "Bản dịch hoặc giải thích thêm (nếu cần)..."
        }
    ]
}`;
}

export const generateExplanation = async (req: Request, res: Response) => {
    try {
        const { questionText, options, correctAnswer } = req.body;

        if (!questionText || !options || !correctAnswer) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin câu hỏi'
            });
        }

        const prompt = `Nhiệm vụ: Giải thích câu TOEIC sau thật ngắn gọn (dưới 100 chữ).

Câu hỏi: "${questionText}"
Lựa chọn:
A. ${options.A}
B. ${options.B}
C. ${options.C}
D. ${options.D}
Đáp án đúng: ${correctAnswer}

Cấu trúc output (JSON):
{
    "answer": "${correctAnswer}",
    "translation": "Dịch nghĩa 1 câu ngắn gọn",
    "explanation": "Giải thích trọng tâm cấu trúc ngữ pháp (ngắn gọn)",
    "tip": "Dấu hiệu nhận biết nhanh"
}

Lưu ý: Mỗi phần chỉ 1-2 câu ngắn, tổng dưới 100 chữ.`;

        const result = await geminiModel.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        let aiResponse;
        try {
            const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
            const jsonText = jsonMatch ? jsonMatch[1] : text;
            aiResponse = JSON.parse(jsonText);
        } catch (e) {
            // Fallback if not JSON
            aiResponse = { explanation: text, translation: '', tip: '' };
        }

        // Combine all parts into one explanation for display
        let fullExplanation = '';

        // Add answer section
        if (correctAnswer) {
            fullExplanation += `✅ Đáp án: ${correctAnswer}\n\n`;
        }

        // Add translation
        if (aiResponse.translation) {
            fullExplanation += `📖 Tạm dịch:\n${aiResponse.translation}\n\n`;
        }

        // Add explanation
        if (aiResponse.explanation) {
            fullExplanation += `✏️ Giải thích:\n${aiResponse.explanation}\n\n`;
        }

        // Add tip
        if (aiResponse.tip) {
            fullExplanation += `💡 Mẹo:\n${aiResponse.tip}`;
        }

        return res.json({
            success: true,
            explanation: fullExplanation.trim() || aiResponse.explanation || text,
            translation: aiResponse.translation
        });

    } catch (error: any) {
        console.error('Gemini Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
