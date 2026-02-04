import * as XLSX from 'xlsx';

export interface Part5QuestionData {
    questionNumber: number; // For manual numbering support
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: 'A' | 'B' | 'C' | 'D';
    explanation: string;
}

export interface Part6QuestionData {
    passage: string;         // Đoạn văn chung cho 4 câu
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: 'A' | 'B' | 'C' | 'D';
    explanation: string;
}

export class ExcelParser {
    /**
     * Parse Part 5 Excel template
     * @param buffer Excel file buffer
     * @returns Array of question data
     */
    static parsePart5Template(buffer: Buffer): Part5QuestionData[] {
        try {
            // Read workbook
            const workbook = XLSX.read(buffer, { type: 'buffer' });

            // Get first sheet
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            // Convert to JSON (skip header row)
            const rawData: any[] = XLSX.utils.sheet_to_json(sheet);

            // Validate and transform data
            const questions: Part5QuestionData[] = [];

            for (let i = 0; i < rawData.length; i++) {
                const row = rawData[i];

                // Map columns: 'Nội dung câu hỏi' -> questionText, 'Số câu' / 'Số thứ tự' -> questionNumber (not used in text but for logic if needed)
                // Note: The template now has headers: 'Số câu', 'Nội dung câu hỏi', 'Đáp án A', ...

                // Flexible column mapping
                const qNumber = row['Số câu'] || row['Số thứ tự'];
                const qText = row.questionText || row['Nội dung câu hỏi'];
                const optA = row.optionA || row['Đáp án A'];
                const optB = row.optionB || row['Đáp án B'];
                const optC = row.optionC || row['Đáp án C'];
                const optD = row.optionD || row['Đáp án D'];
                const correct = row.correctAnswer || row['Đáp án đúng (A/B/C/D)'];
                const explain = row.explanation || row['Giải thích'];

                // Skip empty rows
                if (!qText || qText.trim() === '') {
                    continue;
                }

                // Validate required fields
                if (!optA || !optB || !optC || !optD) {
                    throw new Error(`Row ${i + 2}: Missing options (A, B, C, or D)`);
                }

                if (!correct || !['A', 'B', 'C', 'D'].includes(correct.toUpperCase())) {
                    throw new Error(`Row ${i + 2}: Invalid correctAnswer (must be A, B, C, or D)`);
                }

                // Validate explanation is provided
                if (!explain || explain.trim() === '') {
                    throw new Error(`Row ${i + 2}: Missing explanation (Giải thích)`);
                }

                questions.push({
                    questionNumber: qNumber ? parseInt(qNumber) : (101 + i), // Prefer explicitly set number, else fallback
                    questionText: qText.trim(),
                    optionA: optA.trim(),
                    optionB: optB.trim(),
                    optionC: optC.trim(),
                    optionD: optD.trim(),
                    correctAnswer: correct.toUpperCase() as 'A' | 'B' | 'C' | 'D',
                    explanation: explain.trim()
                });
            }

            // Validate question count for Part 5 (should be 30)
            if (questions.length === 0) {
                throw new Error('No valid questions found in Excel file');
            }

            if (questions.length > 30) {
                throw new Error(`Too many questions (${questions.length}). Part 5 should have maximum 30 questions.`);
            }

            return questions;

        } catch (error: any) {
            if (error.message.includes('Row')) {
                throw error; // Re-throw validation errors
            }
            throw new Error(`Failed to parse Excel file: ${error.message}`);
        }
    }

    /**
     * Parse Part 6 Excel template
     * @param buffer Excel file buffer
     * @returns Array of question data with passages
     */
    static parsePart6Template(buffer: Buffer): Part6QuestionData[] {
        try {
            // Read workbook
            const workbook = XLSX.read(buffer, { type: 'buffer' });

            // Get first sheet
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            // Convert to JSON (skip header row)
            const rawData: any[] = XLSX.utils.sheet_to_json(sheet);

            // Validate and transform data
            const questions: Part6QuestionData[] = [];

            for (let i = 0; i < rawData.length; i++) {
                const row = rawData[i];

                // Skip empty rows
                if (!row.passage || row.passage.trim() === '') {
                    continue;
                }

                // Validate required fields
                if (!row.questionText || row.questionText.trim() === '') {
                    throw new Error(`Row ${i + 2}: Missing questionText`);
                }

                if (!row.optionA || !row.optionB || !row.optionC || !row.optionD) {
                    throw new Error(`Row ${i + 2}: Missing options (A, B, C, or D)`);
                }

                if (!row.correctAnswer || !['A', 'B', 'C', 'D'].includes(row.correctAnswer.toUpperCase())) {
                    throw new Error(`Row ${i + 2}: Invalid correctAnswer (must be A, B, C, or D)`);
                }

                if (!row.explanation || row.explanation.trim() === '') {
                    throw new Error(`Row ${i + 2}: Missing explanation`);
                }

                questions.push({
                    passage: row.passage.trim(),
                    questionText: row.questionText.trim(),
                    optionA: row.optionA.trim(),
                    optionB: row.optionB.trim(),
                    optionC: row.optionC.trim(),
                    optionD: row.optionD.trim(),
                    correctAnswer: row.correctAnswer.toUpperCase() as 'A' | 'B' | 'C' | 'D',
                    explanation: row.explanation.trim()
                });
            }

            // Validate question count for Part 6 (should be 16 = 4 passages × 4 questions)
            if (questions.length === 0) {
                throw new Error('No valid questions found in Excel file');
            }

            if (questions.length > 16) {
                throw new Error(`Too many questions (${questions.length}). Part 6 should have maximum 16 questions.`);
            }

            // Validate passage grouping (every 4 questions should share same passage)
            for (let i = 0; i < questions.length; i += 4) {
                const groupPassage = questions[i].passage;
                for (let j = 1; j < 4 && (i + j) < questions.length; j++) {
                    if (questions[i + j].passage !== groupPassage) {
                        throw new Error(`Questions ${i + 1}-${i + 4} must share the same passage`);
                    }
                }
            }

            return questions;

        } catch (error: any) {
            if (error.message.includes('Row') || error.message.includes('Questions')) {
                throw error; // Re-throw validation errors
            }
            throw new Error(`Failed to parse Excel file: ${error.message}`);
        }
    }
}
