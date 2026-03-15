/**
 * TOEIC Score Mapping Utility
 * Converts number of correct questions (0-100) to TOEIC scaled score (5-495)
 */

export const LISTENING_SCORE_MAP = [
  5, 5, 5, 5, 5, 5, 5, 10, 15, 20, 
  25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 
  75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 
  125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 
  175, 180, 185, 190, 195, 200, 205, 210, 215, 220, 
  225, 230, 235, 240, 245, 250, 255, 260, 265, 270, 
  275, 280, 285, 290, 295, 300, 305, 310, 315, 320, 
  325, 330, 335, 340, 345, 350, 355, 360, 365, 370, 
  375, 380, 385, 395, 400, 405, 410, 415, 420, 425, 
  430, 435, 440, 445, 450, 455, 460, 465, 470, 475, 480, 485, 490, 495, 495, 495, 495
];

// Note: The mapping provided by user has 101 items (0-100)
// Adjusted the start to match 0-100 correctly based on typical TOEIC charts if needed, 
// but using the user provided array exactly.
// User provided LISTENING_SCORE_MAP has 100 items in the prompt description, checking length.
// Actually, let's re-count or just use the exact sequence.
export const LISTENING_RAW = [5, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180, 185, 190, 195, 200, 205, 210, 215, 220, 225, 230, 235, 240, 245, 250, 255, 260, 265, 270, 275, 280, 285, 290, 295, 300, 305, 310, 315, 320, 325, 330, 335, 340, 345, 350, 355, 360, 365, 370, 375, 380, 385, 395, 400, 405, 410, 415, 420, 425, 430, 435, 440, 445, 450, 455, 460, 465, 470, 475, 480, 485, 490, 495, 495, 495, 495];
// Count: 100 items. Index 0-99. 0 correct = index 0. 100 correct? 
// TOEIC has 100 questions per skill. So 0 to 100 is 101 values.
// I will append one more 495 if it's 100 items to make it 101 (0 to 100).

export const LISTENING_FINAL = [...LISTENING_RAW];
if (LISTENING_FINAL.length === 100) LISTENING_FINAL.push(495);

export const READING_RAW = [5, 5, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180, 185, 190, 195, 200, 205, 210, 215, 220, 225, 230, 235, 240, 245, 250, 255, 260, 265, 270, 275, 280, 285, 290, 295, 300, 305, 310, 315, 320, 325, 330, 335, 340, 345, 350, 355, 360, 365, 370, 375, 380, 385, 390, 395, 400, 405, 410, 415, 420, 425, 430, 435, 440, 445, 450, 455, 460, 465, 470, 475, 480, 485, 490, 495];
// Count: 101 items. Index 0-100. Perfect.

export const getListeningScore = (correctCount: number): number => {
  const index = Math.max(0, Math.min(100, Math.round(correctCount)));
  return LISTENING_FINAL[index];
};

export const getReadingScore = (correctCount: number): number => {
  const index = Math.max(0, Math.min(100, Math.round(correctCount)));
  return READING_RAW[index];
};
