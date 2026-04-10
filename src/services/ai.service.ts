import axios from 'axios';
import pLimit from 'p-limit';
import { jsonrepair } from 'jsonrepair'; // Robust JSON repair
import { getNextGenerativeModel } from '../config/gemini.config';
import { cleanObjectToEICData } from '../utils/string.util';

// 1. Cho phép gọi đồng thời nhiều request hơn (Billing đã bật)
const aiLimit = pLimit(10);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 2. Hàm Wrapper: Đưa request vào hàng đợi và tự động Retry khi gặp lỗi 429/503
export const executeAITaskWithRetry = async (requestPayload: any, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await aiLimit(() => {
                const model = getNextGenerativeModel();
                return model.generateContent(requestPayload);
            });
        } catch (error: any) {
            if ((error.status === 429 || error.status === 503) && attempt < maxRetries) {
                const waitTime = attempt * 2500; // Delay 2.5s, 5s...
                console.warn(`[AI WARNING] Quota/Rate Limit hit. Đang thử lại lần ${attempt} sau ${waitTime}ms...`);
                await sleep(waitTime);
                continue;
            }
            throw error;
        }
    }
    throw new Error("AI Task failed after maximum retries.");
};

// ============================================
// SYSTEM MASTER PROMPT (BẮT BUỘC)
// ============================================
const MASTER_PROMPT_RULES = `
### VAI TRÒ: 
Bạn là một chuyên gia số hóa đề thi TOEIC chuyên nghiệp, có nhiệm vụ chuyển đổi hình ảnh đề thi thành dữ liệu JSON sạch để lưu trữ vào hệ thống.

### QUY TẮC TRÍCH XUẤT VĂN BẢN (BẮT BUỘC):
1. **BẢO TOÀN NỘI DUNG GỐC 100%:** 
   - Không được tóm tắt, không được tự ý sửa lỗi chính tả của đề, không được tạo dữ liệu giả (mockup). 
   - Nếu văn bản trong ảnh có chữ gì, bạn phải trích xuất đúng chữ đó.
2. **LÀM SẠCH TYPOGRAPHY (CHỐNG LỖI UI):**
   - TUYỆT ĐỐI KHÔNG sử dụng các thực thể HTML như &nbsp;, &amp;, &lt;, &gt;.
   - TUYỆT ĐỐI KHÔNG sử dụng ký tự khoảng trắng không ngắt dòng (Unicode \\u00A0).
   - TẤT CẢ khoảng trắng phải là dấu cách bàn phím tiêu chuẩn (Unicode U+0020).
   - Nếu một từ bị ngắt bởi dấu gạch ngang ở cuối dòng (VD: "e-" ở dòng 1 và "mails" ở dòng 2), bạn PHẢI ghép chúng lại thành một từ duy nhất ("e-mails").

5. **GIỮ NGUYÊN BỐ CỤC (CHỈ cho trường passageHtml):**
   - Sử dụng các thẻ HTML cơ bản (p, br, b) để tái hiện lại bố cục văn bản trong ảnh.
   - Các dạng đặc biệt như Email, Advert, Memo, Article PHẢI được trình bày xuống dòng và ngắt đoạn.

6. **DỊCH SONG NGỮ (CHỈ cho passageTranslations):**
   - Các nội dung trong passageTranslations (trường 'en' và 'vi') PHẢI là VĂN BẢN THUẦN (Plain Text), TUYỆT ĐỐI KHÔNG chứa thẻ HTML.
   - BẮT BUỘC viết hoa chữ cái đầu câu và các danh từ riêng theo đúng quy tắc ngữ pháp.
`;

// ============================================
// [NEW] ROBUST JSON PARSING HELPERS
// ============================================

// 2. [NEW] Sanitize utility for Flutter compatibility
const sanitizeForFlutter = (obj: any): any => {
    if (typeof obj === 'string') {
        let s = obj.replace(/\u00A0/g, ' ');
        return s.trim();
    }
    if (Array.isArray(obj)) return obj.map(sanitizeForFlutter);
    if (obj !== null && typeof obj === 'object') {
        const cleaned: any = {};
        for (const key in obj) {
            if ((key === 'en' || key === 'vi') && typeof obj[key] === 'string') {
                cleaned[key] = obj[key].replace(/<[^>]*>?/gm, '').replace(/\u00A0/g, ' ').trim();
            } else {
                cleaned[key] = sanitizeForFlutter(obj[key]);
            }
        }
        return cleaned;
    }
    return obj;
};

const recoverJSON = (raw: string): any => {
    let text = raw.trim();
    const lastBrace = text.lastIndexOf('}');
    const lastBracket = text.lastIndexOf(']');
    const cutAt = Math.max(lastBrace, lastBracket);
    if (cutAt <= 0) throw new Error('JSON rỗng');
    text = text.substring(0, cutAt + 1);

    const stack: string[] = [];
    let inStr = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"' && text[i - 1] !== '\\') inStr = !inStr;
        if (!inStr) {
            if (c === '{' || c === '[') stack.push(c);
            else if (c === '}' && stack[stack.length - 1] === '{') stack.pop();
            else if (c === ']' && stack[stack.length - 1] === '[') stack.pop();
        }
    }
    while (stack.length > 0) {
        text += stack.pop() === '{' ? '}' : ']';
    }
    return JSON.parse(text);
};

const parseAIResponse = (raw: string): any => {
    if (!raw || raw.trim().length === 0) throw new Error("AI response is empty");

    let text = raw.trim();

    // [NEW] Remove zero-width spaces and other invisible control characters that break JSON.parse
    text = text.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '');

    // 1. Handle Markdown fences
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (jsonMatch) {
        text = jsonMatch[1].trim();
    } else {
        // Find from first { to last }
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
            text = text.substring(start, end + 1).trim();
        }
    }

    try { 
        const parsed = JSON.parse(text);
        return cleanObjectToEICData(parsed);
    } catch { /* continue */ }

    // 2. Fix control characters inside strings
    const fixJsonStrings = (json: string): string => {
        let result = '';
        let inString = false;
        let i = 0;
        while (i < json.length) {
            const char = json[i];
            const prevChar = i > 0 ? json[i - 1] : '';
            if (char === '"' && prevChar !== '\\') {
                inString = !inString;
                result += char;
            } else if (inString) {
                if (char === '\n') result += '\\n';
                else if (char === '\r') result += '\\r';
                else if (char === '\t') result += '\\t';
                else result += char;
            } else {
                result += char;
            }
            i++;
        }
        return result;
    };

    try { return JSON.parse(fixJsonStrings(text)); } catch { /* continue */ }

    // 2.5 [NEW] Extremely aggressive cleaning for cases where AI adds text outside JSON
    const aggressiveClean = (s: string) => {
        const start = s.indexOf('{');
        const end = s.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
            return s.substring(start, end + 1);
        }
        return s;
    };
    try { return JSON.parse(aggressiveClean(fixJsonStrings(text))); } catch { /* continue */ }

    try {
        const repaired = jsonrepair(fixJsonStrings(text));
        const parsed = JSON.parse(repaired);
        return cleanObjectToEICData(parsed);
    } catch { /* continue */ }

    // 4. Recover truncated JSON
    try { 
        const recovered = recoverJSON(text);
        return cleanObjectToEICData(recovered);
    } catch { /* continue */ }

    console.error("[AI Service] Parse Failed. Raw Response length:", raw.length);
    throw new Error("Could not parse AI response as JSON after 4 attempts");
};

const bufferToGenerativePart = (buffer: Buffer, mimeType: string) => ({
    inlineData: { data: buffer.toString('base64'), mimeType },
});

const urlToGenerativePart = async (url: string, mimeType: string) => {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return { inlineData: { data: Buffer.from(response.data).toString('base64'), mimeType } };
};

interface Part6Question {
    questionNumber: number;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: string;
}

export const generateBatchExplanationsService = async (questions: any[]) => {
    return Promise.all(questions.map(q => 
        aiLimit(async () => {
            const prompt = `Nhiệm vụ: Giải thích câu TOEIC ngắn gọn.
            Q: "${q.questionText}"
            Options: A:${q.options.A}, B:${q.options.B}, C:${q.options.C}, D:${q.options.D}
            Correct: ${q.correctAnswer}

            Output JSON: { "questionNumber": ${q.questionNumber}, "translation": "...", "explanation": "...", "tip": "..." }`;

            const result = await executeAITaskWithRetry({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 800,
                    responseMimeType: "application/json",
                }
            });

            return parseAIResponse(result.response.text());
        })
    ));
};

/**
 * [NEW] Chiến thuật "Defensive Programming": Fallback JSON chuẩn 100% khi AI thật gặp lỗi
 */
const generateSafeFeedback = (currentScore: number, totalQuestions: number, partName: string) => {
    const percentage = Math.round((currentScore / totalQuestions) * 100);
    const isExcellent = percentage >= 90;
    const isGood = percentage >= 70;

    return {
        progressScore: percentage,
        shortFeedback: isExcellent ? "Kết quả tuyệt vời! Bạn đang làm chủ bài thi đấy." : (isGood ? "Làm tốt lắm! Hãy tiếp tục duy trì phong độ này." : "Ghi nhận nỗ lực của bạn. Cùng luyện thêm để tiến bộ nhé!"),
        skills: {
            grammar: isExcellent ? 9 : (isGood ? 7 : 5),
            vocabulary: isExcellent ? 9 : (isGood ? 7 : 5),
            inference: isExcellent ? 8 : (isGood ? 6 : 4),
            mainIdea: isExcellent ? 9 : (isGood ? 8 : 6)
        },
        strengths: isExcellent ? ["Độ chính xác cao", "Phản xạ nhanh"] : (isGood ? ["Nắm vững kiến thức cơ bản"] : ["Tinh thần học tập tốt"]),
        weaknesses: isExcellent ? ["Các bẫy nâng cao"] : (isGood ? ["Quản lý thời gian", "Từ vựng chuyên sâu"] : ["Từ vựng cơ bản", "Ngữ pháp nền tảng"]),
        vocabularyFlashcards: [],
        detailedAssessment: `<p>Hệ thống ghi nhận bạn đã hoàn thành <b>${partName}</b> với kết quả <b>${currentScore}/${totalQuestions}</b>.</p>
                             <p><b>Nhận xét:</b> Bạn có nền tảng ${isExcellent ? 'rất vững chắc' : (isGood ? 'khá tốt' : 'cần cải thiện thêm')}. 
                             Hãy xem lại danh sách câu sai để hiểu rõ các bẫy distractors. AI Coach sẽ tiếp tục đồng hành cùng bạn trong các bài tiếp theo!</p>`
    };
};

export const evaluateProgress = async (
    currentScore: number, 
    totalQuestions: number, 
    timeTakenSeconds: number, 
    userName: string = 'Bạn', 
    topicMatrixJson: string = '{}', 
    partName: string = 'Part 5',
    targetScore?: number,
    isFullTest: boolean = false
) => {
    const currentPercentage = Math.round((currentScore / totalQuestions) * 100);
    const timeMinutes = (timeTakenSeconds / 60).toFixed(1);

    try {
        const isListening = ['Part 1', 'Part 2', 'Part 3', 'Part 4'].some(p => partName.includes(p));
        
        const commonPromptContext = `
            Học viên: ${userName} | Mục tiêu: ${targetScore || 'Chưa đặt'}
            Bài thi: ${partName} ${isFullTest ? '(TOÀN BỘ ĐỀ THI - 200 CÂU)' : ''}
            Kết quả: ${currentScore}/${totalQuestions} (${currentPercentage}%) | Thời gian: ${timeMinutes}p
            MA TRẬN KIẾN THỨC (JSON): ${topicMatrixJson}
        `;

        let prompt = `
            ${commonPromptContext}
            VAI TRÒ: Bạn là "Mentor Expert" - Huấn luyện viên TOEIC chuyên gia.
            
            NHIỆM VỤ: ${isFullTest 
                ? 'PHÂN TÍCH CHIẾN THUẬT TOÀN DIỆN. Dựa trên ma trận kiến thức, hãy lọc ra TOP 5 CHỦ ĐIỂM (Topic Tags) YẾU NHẤT của học viên trong bài thi này để tư vấn hành động.' 
                : `Phân tích bài làm và đưa ra lời khuyên "chạm đúng chỗ ngứa" của học viên về ${isListening ? 'khả năng phản xạ âm thanh' : 'kỹ năng đọc hiểu'}.`}
            
            NGUYÊN TẮC "VOICE & TONE":
            1. Ngôn ngữ: Tiếng Việt, chuyên nghiệp nhưng gần gũi.
            2. "detailedAssessment": 
               ${isFullTest 
                 ? '- Nhận xét về sự phân bổ điểm giữa Listening/Reading.\n- Liệt kê rõ TOP 5 chủ điểm cần cải thiện ngay lập tức.\n- Đưa ra lộ trình ngắn hạn để bứt phá.' 
                 : '- Sử dụng công thức "Sandwich" (Khen ngợi -> Chỉ ra lỗ hổng -> Hành động cụ thể). Viết 2-3 câu.'}
            3. "weaknesses" & "strengths": Trả về tối đa 3-5 mục cụm từ ngắn < 5 chữ.
            
            OUTPUT JSON THUẦN TÚY:
            {
                "progressScore": ${currentPercentage},
                "shortFeedback": "...",
                "skills": { "grammar": 0-10, "vocabulary": 0-10, "inference": 0-10, "mainIdea": 0-10 },
                "strengths": ["...", "...", "..."],
                "weaknesses": ["...", "...", "..."],
                "vocabularyFlashcards": [],
                "detailedAssessment": "..."
            }
        `;

        const result = await executeAITaskWithRetry({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: 1000,
                temperature: 0.4,
                responseMimeType: "application/json",
            }
        });

        const aiData = parseAIResponse(result.response.text());
        const isPerfect = currentScore === totalQuestions;

        return {
            progressScore: aiData.progressScore ?? currentPercentage,
            shortFeedback: aiData.shortFeedback ?? (isPerfect ? "🎯 Phong độ hoàn hảo!" : "🛡️ Vững vàng nền tảng"),
            skills: aiData.skills ?? { grammar: 5, vocabulary: 5, inference: 5, mainIdea: 5 },
            strengths: aiData.strengths?.slice(0, 3) ?? ["Nỗ lực bền bỉ"],
            weaknesses: aiData.weaknesses?.slice(0, 3) ?? (isPerfect ? ["Không có lỗi sai"] : ["Thiếu tập trung"]),
            vocabularyFlashcards: aiData.vocabularyFlashcards ?? [],
            detailedAssessment: aiData.detailedAssessment ?? `<p>Bạn đã hoàn thành tốt <b>${partName}</b>. Hãy duy trì sự tập trung này nhé!</p>`
        };

    } catch (error) {
        console.error("Critical AI Error in evaluateProgress, using Fallback:", error);
        return generateSafeFeedback(currentScore, totalQuestions, partName);
    }
};

export const generatePart6ExplanationService = async (passage: string, questions: Part6Question[]) => {
    const questionsText = questions.map(q => `
    Question ${q.questionNumber}:
    A. ${q.optionA} | B. ${q.optionB} | C. ${q.optionC} | D. ${q.optionD}
    Correct Answer: ${q.correctAnswer}
    `).join('\n');

    const prompt = `${MASTER_PROMPT_RULES}\nBạn là chuyên gia TOEIC. Hãy phân tích đoạn văn Part 6 sau:
    LƯU Ý: Part 6 là dạng điền từ vào chỗ trống, KHÔNG có câu hỏi riêng biệt. Bạn chỉ cần dịch đáp án và phân tích.

    ĐOẠN VĂN:
    """${passage}"""

    DANH SÁCH CÂU HỎI:
    ${questionsText}

    YÊU CẦU OUTPUT JSON (Không Markdown):
    1. "passageTranslations": [ { "type": "passage", "label": "Đoạn văn", "items": [ { "id": "s1", "en": "...", "vi": "...", "vocab": [ { "text": "word", "meaning": "nghĩa" } ] } ] } ]
    2. "vocabulary": [ { "word": "...", "type": "n/v/adj/adv", "ipa": "/.../", "meaning": "..." } ]
    3. "questions": [ { "questionNumber": 131, "optionTranslations": { "A": "...", "B": "...", "C": "...", "D": "..." }, "analysis": "...", "evidence": "..." } ]
    `;

    try {
        const result = await executeAITaskWithRetry({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4000,
                responseMimeType: "application/json",
            }
        });

        const rawText = result.response.text();
        return parseAIResponse(rawText);
    } catch (error) {
        console.error("AI Part 6 Error:", error);
        throw new Error("Lỗi khi tạo giải thích AI");
    }
};

export const generateExplanationService = async (questionText: string, options: any, correctAnswer: string) => {
    const prompt = `Nhiệm vụ: Giải thích câu TOEIC ngắn gọn.
    Q: "${questionText}"
    Options: A:${options.A}, B:${options.B}, C:${options.C}, D:${options.D}
    Correct: ${correctAnswer}

    Output JSON: { "answer": "${correctAnswer}", "translation": "...", "explanation": "...", "tip": "..." }`;

    const result = await executeAITaskWithRetry({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 600,
            responseMimeType: "application/json",
        }
    });

    return parseAIResponse(result.response.text());
};

export const enrichPart5QuestionService = async (questionText: string, options: any, correctAnswer: string) => {
    const prompt = `Bạn là chuyên gia TOEIC 990 điểm. Phân tích câu hỏi Part 5 (gồm Câu hỏi thô, 4 Đáp án A/B/C/D, và Đáp án đúng) và trả về kết quả DƯỚI ĐẠNG JSON THUẦN TÚY (không dùng markdown \`\`\`json).

    Q: "${questionText}"
    Options: A:${options.A}, B:${options.B}, C:${options.C}, D:${options.D}
    Correct Answer: "${correctAnswer || '(BỊ TRỐNG)'}"

    LƯU Ý QUAN TRỌNG: Nếu Correct Answer bị trống, bạn BẮT BUỘC phải tự phân tích và chọn ra đáp án đúng nhất (A, B, C hoặc D) dựa trên kiến thức 990 điểm của mình. Trả về đáp án này trong trường "calculatedAnswer".

    Cấu trúc JSON Output BẮT BUỘC:
    {
       "calculatedAnswer": "A | B | C | D", // Bắt buộc trùng với Correct Answer hoặc tự giải nếu trống
       "questionTranslation": "Bản dịch tiếng Việt (có chỗ trống tương ứng '...').",
       "optionTranslations": { "A": "...", "B": "...", "C": "...", "D": "..." },
       "explanation": "Giải thích chi tiết tiếng Việt tại sao chọn đáp án đúng, chỉ ra bẫy ngữ pháp/từ vựng. Format HTML sinh động (VD: dùng <b>dày</b>, <br/>).",
       "keyVocabulary": [
         { "word": "từ_vựng", "type": "n/v/adj/adv", "ipa": "/IPA/", "meaning": "nghĩa" }
       ],
       "level": "A1_A2 | B1_B2 | C1"
    }`;

    const result = await executeAITaskWithRetry({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2000,
            responseMimeType: "application/json",
        }
    });

    return parseAIResponse(result.response.text());
};

export const enrichPart5BatchService = async (questions: any[]) => {
    const prompt = `Bạn là chuyên gia TOEIC 990 điểm. Phân tích MẢNG các câu hỏi Part 5 sau và trả về MẢNG DỮ LIỆU JSON THUẦN TÚY tương ứng (không dùng markdown).

    INPUT:
    ${questions.map((q: any) => `Q${q.questionNumber}: "${q.questionText}" | Opts: A:${q.options.A}, B:${q.options.B}, C:${q.options.C}, D:${q.options.D} | Correct: ${q.correctAnswer || '(BỊ TRỐNG)'}`).join('\n')}

    LƯU Ý CỰC KỲ QUAN TRỌNG: 
    Nếu trường "Correct" của bất kỳ câu nào bị trống, bạn BẮT BUỘC phải đóng vai trò thí sinh 990 điểm để TỰ PHÂN TÍCH VÀ TÌM ĐÁP ÁN ĐÚNG. Trả về đáp án tìm được trong trường "calculatedAnswer".

    Cấu trúc JSON Output BẮT BUỘC (trả về 1 mảng các object):
    [
      {
         "questionNumber": 101, // Lấy theo input
         "calculatedAnswer": "A | B | C | D", // Trùng với Correct hoặc tự giải nếu trống
         "questionTranslation": "...",
         "optionTranslations": { "A": "...", "B": "...", "C": "...", "D": "..." },
         "explanation": "Giải thích chi tiết tiếng Việt format HTML sinh động (dùng <b>, <br/>).",
         "keyVocabulary": [
           { "word": "...", "type": "...", "ipa": "...", "meaning": "..." }
         ],
         "level": "A1_A2 | B1_B2 | C1"
      }
    ]`;

    const result = await executeAITaskWithRetry({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.1, // Giảm nhiệt độ để chính xác hơn trong batch
            maxOutputTokens: 8000,
            responseMimeType: "application/json",
        }
    });

    return parseAIResponse(result.response.text());
};

export const scanPart6FromImageService = async (imageBuffer: Buffer, mimeType: string) => {
    const prompt = `${MASTER_PROMPT_RULES}\nTrợ lý nhập liệu TOEIC Part 6. Trích xuất passage, questions, và dịch song ngữ đoạn văn.
    Output JSON: 
    { 
        "passageHtml": "Nội dung đoạn văn (giữ nguyên layout, ngắt dòng bằng <p>, <br/>, <b>)", 
        "passageTranslations": [{"type": "passage", "label": "Đoạn văn", "items": [{"id": "s1", "en": "Clean text sentence 1", "vi": "Dịch văn bản sạch...", "vocab": []}]}], 
        "vocabulary": [{"word": "...", "type": "n/v/adj/adv", "ipa": "/.../", "meaning": "..."}],
        "questions": [{"questionNumber": 131, "questionText": "...", "optionA": "...", "optionB": "...", "optionC": "...", "optionD": "...", "correctAnswer": "..."}]
    }`;

    try {
        const result = await executeAITaskWithRetry({
            contents: [{
                role: 'user',
                parts: [{ text: prompt }, bufferToGenerativePart(imageBuffer, mimeType)]
            }],
            generationConfig: { responseMimeType: "application/json" }
        });
        return parseAIResponse(result.response.text());
    } catch (error) {
        console.error("Scan Part 6 Error:", error);
        throw new Error("Không thể đọc ảnh Part 6.");
    }
};

export const scanPart7FromImageService = async (imageBuffer: Buffer, mimeType: string) => {
    const prompt = `${MASTER_PROMPT_RULES}\nTrợ lý nhập liệu TOEIC Part 7. Trích xuất passage, questions, suy luận đáp án và dịch chi tiết. 
    LƯU Ý: Phải xác định loại đoạn văn (Email, Advert, Article, Schedule, Web Page) để điền vào "label".
    Output JSON: { 
        "passageHtml": "Nội dung đoạn văn (giữ nguyên layout, ngắt dòng bằng <p>, <br/>, <b>)", 
        "passageTranslations": [{"type": "passage", "label": "Passage 1: [Loại]", "items": [{"id": "s1", "en": "Clean text sentence 1", "vi": "Dịch văn bản sạch...", "vocab": []}]}], 
        "vocabulary": [{"word": "...", "type": "n/v/adj/adv", "ipa": "/.../", "meaning": "..."}],
        "questions": [{"questionNumber": 147, "questionText": "...", "optionA": "...", "optionB": "...", "optionC": "...", "optionD": "...", "correctAnswer": "...", "analysis": "...", "evidence": "..."}] 
    }`;

    try {
        const result = await executeAITaskWithRetry({
            contents: [{
                role: 'user',
                parts: [{ text: prompt }, bufferToGenerativePart(imageBuffer, mimeType)]
            }],
            generationConfig: { responseMimeType: "application/json" }
        });
        return parseAIResponse(result.response.text());
    } catch (error) {
        console.error("Scan Error:", error);
        throw new Error("Không thể đọc ảnh.");
    }
};

const scanStructureAndQuestions = async (
    images: { buffer: Buffer; mimeType: string }[]
): Promise<{ questions: any[]; passages: { label: string; pageIndex: number }[] }> => {
    const prompt = `${MASTER_PROMPT_RULES}\nBạn là chuyên gia nhập liệu TOEIC Part 7. 
    NHIỆM VỤ: Nhận diện kiến trúc bài đọc (Passages) và trích xuất danh sách CÂU HỎI (Questions) từ các hình ảnh được cung cấp.
    
    YÊU CỰC KỲ QUAN TRỌNG:
    1. PHÂN LOẠI PASSAGES: Với mỗi văn bản xuất hiện, bạn phải xác định chính xác nó là loại gì (Email, Article, Advertisement, Web Page, Memo, Schedule, Review, Message Chain, v.v.).
    2. ĐẶT TÊN LABEL CHI TIẾT: Gán nhãn cho mỗi đoạn theo định dạng: "Passage 1: [Loại]" (VD: "Passage 1: Email", "Passage 2: Article"). 
    
    3. Trích xuất Questions: Tìm tất cả câu hỏi có trong ảnh. Với mỗi câu hỏi, lấy ra: 
       - questionNumber (Số câu, ví dụ: 147)
       - questionText (Nội dung câu hỏi)
       - optionA, optionB, optionC, optionD (Nội dung 4 lựa chọn)
       - correctAnswer (Tự suy luận đáp án đúng nhất A/B/C/D dựa trên kiến thức 990 điểm)

    Output JSON THUẦN TÚY:
    {
        "passages": [ { "label": "Passage 1: Email", "pageIndex": 0 } ],
        "questions": [
            {
                "questionNumber": 147,
                "questionText": "...",
                "optionA": "...", "optionB": "...", "optionC": "...", "optionD": "...",
                "correctAnswer": "A/B/C/D"
            }
        ]
    }`;

    const imageParts = images.map(img => bufferToGenerativePart(img.buffer, img.mimeType));
    const result = await executeAITaskWithRetry({
        contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
        generationConfig: { temperature: 0, maxOutputTokens: 8192, responseMimeType: 'application/json' }
    });
    return parseAIResponse(result.response.text());
};

const enrichQuestionsWithTranslations = async (
    images: { buffer: Buffer; mimeType: string }[],
    questions: any[]
): Promise<{ enrichedQuestions: any[]; vocabulary: any[] }> => {
    const prompt = `${MASTER_PROMPT_RULES}\nBạn là chuyên gia luyện thi TOEIC 990. Nhiệm vụ cực kỳ quan trọng: Dịch và cung cấp PHÂN TÍCH & BẰNG CHỨNG GIẢI THÍCH CHI TIẾT cho các câu hỏi Part 7 sau đây dựa vào văn bản trong hình ảnh. TẤT CẢ câu hỏi đều phải có "analysis" và "evidence", tuyệt đối không được lười biếng hay bỏ trống!
    
    DANH SÁCH CÂU HỎI CẦN XỬ LÝ (Hãy dùng hình ảnh để tìm đáp án và giải thích):
    ${JSON.stringify(questions, null, 2)}

    YÊU CẦU BẮT BUỘC CHO TỪNG CÂU HỎI MỘT:
    1. questionTranslation: Dịch chuẩn xác câu hỏi sang tiếng Việt.
    2. optionTranslations: Dịch chuẩn 4 lựa chọn A/B/C/D sang tiếng Việt.
    3. analysis: Bắt buộc điền giải thích TƯỜNG TẬN tại sao đáp án đúng lại là đáp án đó (dựa trên bài đọc). Suy luận logic rõ ràng. Tối thiểu 30 chữ, tuyệt đối không để chuỗi rỗng "".
    4. evidence: Bắt buộc trích dẫn XÁC ĐÁNG câu văn chứa thông tin trả lời trong ảnh, kèm theo dịch nghĩa tiếng Việt. Tuyệt đối không để chuỗi rỗng "".
    
    YÊU CẦU TỪ VỰNG TỔNG:
    5. vocabulary: Phải trích xuất từ 5-10 từ vựng quan trọng (hay/khó) xuất hiện trong bài đọc và câu hỏi, định nghĩa rõ ràng. Tuyệt đối không để mảng rỗng [].

    Output JSON THUẦN TÚY (Lưu ý: return đúng schema này, không bọc Markdown, mảng "translations" phải có đủ số phần tử bằng với số câu hỏi truyền vào): 
    { 
        "translations": [
            {
                "questionNumber": 147, 
                "questionTranslation": "...", 
                "optionTranslations": {"A": "...", "B": "...", "C": "...", "D": "..."}, 
                "analysis": "...", 
                "evidence": "..."
            }
        ], 
        "vocabulary": [{"word": "...", "type": "n/v/adj/adv", "meaning": "...", "ipa": "/.../"}] 
    }`;

    const imageParts = images.map(img => bufferToGenerativePart(img.buffer, img.mimeType));
    const result = await executeAITaskWithRetry({
        contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
        generationConfig: { temperature: 0, maxOutputTokens: 8192, responseMimeType: 'application/json' }
    });
    const parsed = parseAIResponse(result.response.text());

    const translationsMap = new Map((parsed.translations || []).map((t: any) => [t.questionNumber, t]));
    return {
        enrichedQuestions: questions.map(q => {
            const t: any = translationsMap.get(q.questionNumber) || {};
            return { ...q, questionTranslation: t.questionTranslation, optionTranslations: t.optionTranslations, analysis: t.analysis, evidence: t.evidence };
        }),
        vocabulary: parsed.vocabulary || []
    };
};

const extractPassageDetailService = async (
    images: { buffer: Buffer; mimeType: string }[],
    passageLabel: string
): Promise<{ type: string; label: string; passageHtml: string; items: any[]; keyVocabulary: any[] }> => {
    const prompt = `${MASTER_PROMPT_RULES}
Trích xuất nội dung văn bản cụ thể dựa trên nhãn "${passageLabel}" được chỉ định. 

### QUY TẮC PHÂN TÁCH:
1. Nếu nhãn là "Email", hãy tập trung quét vùng chứa Email.
2. Đảm bảo bản dịch tiếng Việt ('vi') được thực hiện kỹ lưỡng.

### Output JSON structure:
{
  "type": "passage",
  "label": "${passageLabel}",
  "passageHtml": "Nội dung gốc có format HTML (dùng <p>, <b>, <br/>) để giữ bố cục y hệt ảnh.",
  "items": [
     { "id": "s1", "en": "Clean English text sentence (NO HTML)", "vi": "Bản dịch tiếng Việt sạch (KHÔNG HTML)" }
  ],
  "keyVocabulary": [
     { "word": "...", "type": "n/v/adj/adv", "meaning": "...", "ipa": "/.../" }
  ]
}`;

    const imageParts = images.map(img => bufferToGenerativePart(img.buffer, img.mimeType));
    const result = await executeAITaskWithRetry({
        contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
        generationConfig: { temperature: 0, maxOutputTokens: 6144, responseMimeType: "application/json" }
    });
    
    const parsed = parseAIResponse(result.response.text());
    return sanitizeForFlutter(parsed);
};

const limit = pLimit(5);

export const magicScanPart7FromImagesService = async (
    images: { buffer: Buffer; mimeType: string }[],
    cloudinaryUrls: string[] = [] // Support Cloudinary URLs
) => {
    const structure = await scanStructureAndQuestions(images);
    const passages = structure.passages || [];
    const questions = structure.questions || [];

    const passageTargets = passages.length > 0 ? passages : images.map((_, i) => ({ label: `Passage ${i+1}`, pageIndex: i }));

    // [FIX] Pass ONLY the target image matching the pageIndex to avoid AI context confusion
    const passagePromises = passageTargets.map((p) => 
        limit(() => {
            const targetImage = images[p.pageIndex] ? [images[p.pageIndex]] : images;
            return extractPassageDetailService(targetImage, p.label).catch(() => ({ 
                type: 'passage', 
                label: p.label, 
                items: [], 
                keyVocabulary: [] 
            }));
        })
    );

    const enrichmentPromise = limit(() => enrichQuestionsWithTranslations(images, questions).catch(() => ({ enrichedQuestions: questions, vocabulary: [] })));

    const [passageTranslations, enrichmentResult] = await Promise.all([Promise.all(passagePromises), enrichmentPromise]);

    const mergedVocabMap = new Map();
    (enrichmentResult.vocabulary || []).forEach((v: any) => v.word && mergedVocabMap.set(v.word, v));
    passageTranslations.forEach(pt => pt.keyVocabulary?.forEach((v: any) => v.word && mergedVocabMap.set(v.word, v)));

    const passageHtml = passageTranslations.map(pt => pt.items?.map((s: any) => s.en).join(' ') || '').join('\n\n');

    // --- CONSTRUCT passageData (Structural array) ---
    const passageData = passageTranslations.map((pt, index) => {
        const pageIndex = passageTargets[index]?.pageIndex ?? index;
        return {
            label: pt.label || passageTargets[index]?.label || `Passage ${index + 1}`,
            imageUrl: cloudinaryUrls[pageIndex] || '', 
            translation: pt.items || []
        };
    });

    // [FIX] Rename passageTranslations to passageTranslationData for Frontend compatibility
    return { 
        passageHtml, 
        passageTranslationData: passageTranslations, 
        passageData, // 💎 NEW structured field for DB
        questions: enrichmentResult.enrichedQuestions, 
        vocabulary: Array.from(mergedVocabMap.values()), 
        passageRegions: [], 
        isPartial: false 
    };
};

export const generatePart7ExplanationService = async (
    type: 'text' | 'image',
    content: string | string[]
) => {
    const prompt = `${MASTER_PROMPT_RULES}\nBạn là chuyên gia luyện thi TOEIC 990. Nhiệm vụ cực kỳ quan trọng: Giải thích chi tiết Part 7.
    LƯU Ý 1: Phải xác định loại đoạn văn (Email, Article, Invoice...) cho từng đoạn trong "passageTranslations".
    LƯU Ý 2: Cung cấp "analysis" (tối thiểu 30 chữ) và "evidence" (trích dẫn chuẩn xác gốc + dịch) cho tất cả các câu hỏi. Tuyệt đối không để chuỗi rỗng "".
    LƯU Ý 3: Trích xuất 5-10 từ vựng cốt lõi vào mảng "vocabulary".
    Output JSON THUẦN TÚY: { "passageTranslations": [{"type": "passage", "label": "Passage 1: [Loại]", "items": [{"id": "s1", "en": "...", "vi": "...", "vocab": []}]}], "vocabulary": [{"word": "...", "type": "n/v/adj/adv", "ipa": "/.../", "meaning": "..."}], "questions": [{"questionNumber": 147, "analysis": "...", "evidence": "...", "optionTranslations": {}}] }`;

    let parts: any[] = [{ text: prompt }];
    if (type === 'image' && Array.isArray(content)) {
        const imageParts = await Promise.all(content.map(async (item: any) => typeof item === 'string' ? urlToGenerativePart(item, 'image/jpeg') : bufferToGenerativePart(item.buffer, item.mimeType || 'image/jpeg')));
        parts = [...parts, ...imageParts.filter(Boolean)];
    } else if (type === 'text') {
        parts[0].text += `\nText: ${content}`;
    }

    const result = await executeAITaskWithRetry({
        contents: [{ role: 'user', parts: parts }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: "application/json" }
    });

    return parseAIResponse(result.response.text());
};

// GIAI ĐOẠN 1: Quét cấu trúc thô (Chống sai số câu, thiếu đáp án)
const scanPart6Structure = async (images: { buffer: Buffer; mimeType: string }[]) => {
    const prompt = `${MASTER_PROMPT_RULES}
    NHIỆM VỤ: Trích xuất chính xác văn bản từ ảnh đề thi TOEIC Part 6.
    
    YÊU CẦU CỰC KỲ NGHIÊM NGẶT:
    1. QUÉT ĐÚNG SỐ CÂU: Liệt kê chính xác các số câu xuất hiện (VD: 131, 132, 133, 134).
    2. ĐẦY ĐỦ 4 ĐÁP ÁN: Với mỗi câu, trích xuất nguyên văn 4 lựa chọn A, B, C, D. **LƯU Ý: Loại bỏ các ký tự (A), (B), (C), (D) hoặc A. B. C. D. ở đầu mỗi đáp án, chỉ lấy nội dung văn bản.**
    3. ĐÁP ÁN ĐÚNG (correctAnswer): Dựa trên nội dung đoạn văn, hãy suy luận và đưa ra đáp án đúng nhất (A, B, C hoặc D). Bạn là chuyên gia 990 TOEIC, không được bỏ trống trường này.
    4. TRÍCH XUẤT ĐOẠN VĂN: Lấy toàn bộ nội dung đoạn văn (Passage).

    OUTPUT JSON:
    {
        "passageHtml": "Nội dung đoạn văn dạng HTML (giữ nguyên layout, ngắt dòng bằng <p>, <br/>, <b>)",
        "questions": [
            { "questionNumber": 131, "questionText": "...", "optionA": "...", "optionB": "...", "optionC": "...", "optionD": "...", "correctAnswer": "A/B/C/D" }
        ]
    }`;

    const imageParts = images.map(img => bufferToGenerativePart(img.buffer, img.mimeType));
    const result = await executeAITaskWithRetry({
        contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
        generationConfig: { temperature: 0, maxOutputTokens: 4000, responseMimeType: "application/json" }
    });

    return parseAIResponse(result.response.text());
};

// GIAI ĐOẠN 2: Làm giàu dữ liệu (Dịch và Phân tích)
const enrichPart6WithInsights = async (passage: string, questions: any[]) => {
    const prompt = `${MASTER_PROMPT_RULES}
    NHIỆM VỤ: Dịch và phân tích chi tiết Part 6 dựa trên văn bản đã trích xuất.
    LƯU Ý: Part 6 là dạng điền từ vào chỗ trống, KHÔNG có câu hỏi riêng biệt. Bạn chỉ cần dịch đáp án và phân tích tường tận. TẤT CẢ câu hỏi đều phải có "analysis" và "evidence", tuyệt đối không được lười biếng hay bỏ trống!
    
    ĐOẠN VĂN:
    """${passage}"""

    DANH SÁCH CÂU HỎI:
    ${JSON.stringify(questions, null, 2)}

    YÊU CẦU BẮT BUỘC CHO TỪNG MỖI CÂU:
    1. optionTranslations: Dịch chuẩn xác TẤT CẢ 4 đáp án { "A": "...", "B": "...", "C": "...", "D": "..." }.
    2. correctAnswer: Kiểm tra lại một lần nữa đáp án đúng nhất (A/B/C/D) dựa trên ngữ cảnh toàn bài.
    3. analysis: Bắt buộc giải thích TƯỜNG TẬN chi tiết ngữ pháp/ngữ cảnh tại sao chọn đáp án đó. Ghi chú rõ ràng, mạch lạc, dễ hiểu. Tối thiểu 30 chữ, tuyệt đối không được để chuỗi rỗng "".
    4. evidence: Bắt buộc trích dẫn XÁC ĐÁNG câu gốc chứa chỗ trống + dịch nghĩa tiếng Việt làm bằng chứng vững chắc. Tuyệt đối không được để chuỗi rỗng "".

    YÊU CẦU ĐẶC BIỆT CHO DỊCH SONG NGỮ BAO GỒM (passageTranslations):
    5. Trong mảng "passageTranslations" -> "items", đối với cả câu Tiếng Anh ("en") và câu Tiếng Việt ("vi"), ở vị trí có khoét lỗ / chỗ trống điền từ, BẮT BUỘC ghép trực tiếp CỤM TỪ CỦA ĐÁP ÁN ĐÚNG vào thẳng trong câu, đi kèm với số thứ tự câu hỏi trong ngoặc đơn ở đằng sau. 
    - Cấu trúc: "[cụm từ đáp án đúng] (Số câu hỏi)".
    - VD Tiếng Anh: "Over the years, you have shown great initiative (136), creativity, and leadership."
    - VD Tiếng Việt: "Trong những năm qua, bạn đã thể hiện sự chủ động tuyệt vời (136), sự sáng tạo và năng lực lãnh đạo."
    - LƯU Ý: Luôn luôn viết hoa chữ cái đầu tiên của mọi câu trong bản dịch theo đúng chuẩn ngữ pháp.
    - TUYỆT ĐỐI không được để lại dấu gạch dưới "___" hoặc khoảng trắng nào trong bản dịch!

    YÊU CẦU TỪ VỰNG TỔNG:
    6. vocabulary: Phải trích xuất từ 5-10 từ vựng quan trọng, từ ngữ pháp hay xuất hiện trong bài đọc và câu hỏi, định nghĩa rõ ràng. Tuyệt đối không để mảng rỗng [].

    OUTPUT JSON THUẦN TÚY (trả về đúng schema này, không bọc Markdown bằng \`\`\`json):
    {
        "passageTranslations": [ { "type": "passage", "label": "Đoạn văn", "items": [{ "en": "...", "vi": "..." }] } ],
        "vocabulary": [ { "word": "...", "type": "n/v/adj/adv", "ipa": "/.../", "meaning": "..." } ],
        "enrichedQuestions": [
            { "questionNumber": 131, "correctAnswer": "A", "optionTranslations": { "A": "...", "B": "...", "C": "...", "D": "..." }, "analysis": "...", "evidence": "..." }
        ]
    }`;

    const result = await executeAITaskWithRetry({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8000, responseMimeType: "application/json" }
    });

    return parseAIResponse(result.response.text());
};

// HÀM CHÍNH (Gộp 2 giai đoạn)
export const magicScanPart6FromImagesService = async (images: { buffer: Buffer; mimeType: string }[]) => {
    // Bước 1: Quét cấu trúc (OCR thuần túY)
    const rawStructure = await scanPart6Structure(images);
    
    // Bước 2: Dịch và Phân tích dựa trên cấu trúc đã có
    const insights = await enrichPart6WithInsights(rawStructure.passageHtml, rawStructure.questions);

    // Bước 3: Merge dữ liệu
    const finalQuestions = rawStructure.questions.map((q: any) => {
        const insight = (insights.enrichedQuestions || []).find((iq: any) => iq.questionNumber === q.questionNumber);
        return { ...q, ...insight };
    });

    return { 
        passageHtml: rawStructure.passageHtml, 
        passageTranslations: insights.passageTranslations || [], 
        questions: finalQuestions, 
        vocabulary: insights.vocabulary || [] 
    };
};

export const translateWordService = async (word: string, sentence: string) => {
    const prompt = `${MASTER_PROMPT_RULES}\nDịch từ "${word}" trong ngữ cảnh: "${sentence}".
    Output JSON: { "word": "${word}", "ipa": "...", "type": "...", "meaning": "...", "example": "...", "exampleVi": "..." }`;

    const result = await executeAITaskWithRetry({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
    });

    return parseAIResponse(result.response.text());
};