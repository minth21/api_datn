import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Generate AI explanations for multiple questions in a part
 * POST /api/parts/:partId/questions/generate-explanations
 */
export const generateBatchExplanations = async (req: Request, res: Response) => {
    try {
        const { partId } = req.params;
        const { questionIds } = req.body; // Array of question numbers

        if (!questionIds || !Array.isArray(questionIds)) {
            res.status(400).json({
                success: false,
                message: 'questionIds array is required'
            });
            return;
        }

        // Fetch all questions from this part
        const questions = await prisma.question.findMany({
            where: {
                partId,
                questionNumber: {
                    in: questionIds
                }
            }
        });

        if (questions.length === 0) {
            res.status(404).json({
                success: false,
                message: 'No questions found'
            });
            return;
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        let successCount = 0;

        // Generate explanations for each question
        for (const question of questions) {
            try {
                const prompt = `You are a TOEIC expert. Explain why the correct answer is right for this Part 5 incomplete sentence.

Sentence: ${question.questionText}
A) ${question.optionA}
B) ${question.optionB}
C) ${question.optionC}
D) ${question.optionD}
Correct Answer: ${question.correctAnswer}

Provide a concise explanation in Vietnamese (2-3 sentences) focusing on grammar rules or vocabulary usage.`;

                const result = await model.generateContent(prompt);
                const explanation = result.response.text();

                // Update question with AI-generated explanation
                await prisma.question.update({
                    where: { id: question.id },
                    data: { explanation }
                });

                successCount++;

                // Add delay to avoid rate limiting (1 second between requests)
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`Failed to generate explanation for question ${question.questionNumber}:`, error);
                // Continue with other questions even if one fails
            }
        }

        res.status(200).json({
            success: true,
            message: `Generated explanations for ${successCount} questions`,
            count: successCount
        });

    } catch (error: any) {
        console.error('Batch AI generation error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate AI explanations'
        });
    }
};
