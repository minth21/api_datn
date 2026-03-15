/**
 * Calculate TOEIC Reading Score based on user provided logic.
 * 
 * Logic:
 * 1. Calculate percentage correct and scale to 100 questions: 
 *    equivalentCorrect = (correctAnswers / totalQuestions) * 100
 * 
 * 2. Scoring Rule:
 *    - 0-2 equivalent correct: 5 points
 *    - > 2: 5 + (equivalentCorrect - 2) * 5
 * 
 * 3. Max score capped at 495.
 */
export const calculateTOEICReadingScore = (correctAnswers: number, totalQuestions: number): number => {
    if (totalQuestions === 0) return 5; // Avoid division by zero, min score

    // 1. Scale to 100
    const ratio = correctAnswers / totalQuestions;
    const equivalentCorrect = Math.round(ratio * 100);

    // 2. Apply rules
    let score = 0;

    if (equivalentCorrect <= 2) {
        score = 5;
    } else {
        score = 5 + (equivalentCorrect - 2) * 5;
    }

    // 3. Cap at 495
    if (score > 495) {
        score = 495;
    }

    return score;
};
