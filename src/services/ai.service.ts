import { geminiModel } from '../config/gemini.config';

interface AttemptHistory {
    attemptNumber: number;
    score: number;
    totalQuestions: number;
    percentage: number;
    date: Date;
}

interface AIProgressEvaluation {
    assessment: string;
    progressScore: number;
}

export const evaluateProgress = async (
    currentScore: number,
    totalQuestions: number,
    history: AttemptHistory[]
): Promise<AIProgressEvaluation> => {
    try {
        const historyText = history.map(h =>
            `- Attempt ${h.attemptNumber}: ${h.score}/${h.totalQuestions} (${h.percentage}%) on ${h.date.toISOString().split('T')[0]}`
        ).join('\n');

        const currentPercentage = Math.round((currentScore / totalQuestions) * 100);

        const prompt = `
Context: A student submitted a practice test (Part 5 TOEIC).
Current Score: ${currentScore}/${totalQuestions} (${currentPercentage}%)
History:
${historyText || "No previous attempts."}

Task: Analyze the student's progress and provide:
1. "assessment": A short, encouraging feedback message (max 2 sentences). Compare with previous attempts if available. Praise improvement or encourage review if score dropped.
2. "progressScore": An integer (0-100) representing their mastery level based on this trend.

Output JSON format:
{
    "assessment": "...",
    "progressScore": 0
}
`;

        const result = await geminiModel.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Extract JSON
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
        const jsonText = jsonMatch ? jsonMatch[1] : text;

        try {
            const data = JSON.parse(jsonText);
            return {
                assessment: data.assessment || "Good job! Keep practicing.",
                progressScore: typeof data.progressScore === 'number' ? data.progressScore : currentPercentage
            };
        } catch (e) {
            console.error("AI Parse Error", text);
            return {
                assessment: text.replace(/```json/g, '').replace(/```/g, '').trim().substring(0, 100),
                progressScore: currentPercentage
            };
        }

    } catch (error) {
        console.error("AI Service Error:", error);
        return {
            assessment: "Great effort! Keep practicing to improve your score.",
            progressScore: Math.round((currentScore / totalQuestions) * 100)
        };
    }
};
