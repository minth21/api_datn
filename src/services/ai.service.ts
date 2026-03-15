import axios from 'axios';
import pLimit from 'p-limit';
import { jsonrepair } from 'jsonrepair'; // Robust JSON repair
import { getNextGenerativeModel } from '../config/gemini.config';

// 1. Chỉ cho phép gọi đồng thời TỐI ĐA 3 request sang Google
const aiLimit = pLimit(3);
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

// Helper: Tải ảnh từ URL/Buffer thành định dạng Gemini hiểu
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

export const evaluateProgress = async (currentScore: number, totalQuestions: number, timeTakenSeconds: number, userName: string = 'Bạn', incorrectTags: string[] = [], errorDetails: any[] = [], partName: string = 'Part 5') => {
    // CHẶN AI ĐỐI VỚI LISTENING (Part 1, 2, 3, 4)
    const isListening = ['Part 1', 'Part 2', 'Part 3', 'Part 4'].some(p => partName.includes(p));

    if (isListening) {
        return {
            progressScore: Math.round((currentScore / totalQuestions) * 100),
            recommendationText: "Kỹ năng Nghe cần sự bền bỉ. Hãy nghe lại Audio kết hợp đọc kỹ Transcript (phụ đề) nhé!",
            assessment: `<h3>Đánh giá kỹ năng Listening</h3><p>Hệ thống tự động ghi nhận bạn đạt <b>${currentScore}/${totalQuestions}</b> câu. Đối với bài thi Nghe, phương pháp tốt nhất để khắc phục lỗi sai là Shadowing (đọc nhẩm theo Audio). Chúc bạn học tốt!</p>`
        };
    }

    try {
        const currentPercentage = Math.round((currentScore / totalQuestions) * 100);
        const timeMinutes = (timeTakenSeconds / 60).toFixed(1);
        const tagsSummary = incorrectTags.length > 0
            ? `Các chủ điểm học viên hay sai: ${Array.from(new Set(incorrectTags)).join(", ")}.`
            : "Học viên làm rất tốt, không sai ở chủ điểm cụ thể nào.";

        // Tùy chỉnh nhận xét tùy theo Part
        const partContext = partName === 'Part 6'
            ? "Part 6 (Text Completion - Điền từ vào đoạn văn) đòi hỏi khả năng hiểu ngữ cảnh toàn đoạn văn, sự liên kết giữa các câu và vốn từ vựng phong phú."
            : "Part 5 (Incomplete Sentences - Điền từ vào câu) đòi hỏi nắm chắc các quy tắc ngữ pháp cơ bản và phản xạ từ vựng nhanh trong câu đơn.";

        // Format error details for the AI to understand exactly what went wrong
        const mistakesContext = errorDetails.length > 0
            ? errorDetails.slice(0, 5).map((detail, index) => `
               LỖI SAI ${index + 1}:
               ${partName === 'Part 6' ? '- Ngữ cảnh/Câu hỏi: "' + detail.questionText + '"' : '- Câu hỏi: "' + detail.questionText + '"'}
               - Học viên chọn: ${detail.selectedOption}
               - Đáp án đúng: ${detail.correctAnswer}
               - Giải thích gốc: ${detail.explanation || 'N/A'}
            `).join('\n')
            : "Không có lỗi sai cụ thể nào để phân tích.";

        const prompt = `
            VAI TRÒ: Bạn là một GIA SƯ TOEIC TÂM HUYẾT và GIÀU KINH NGHIỆM.
            NHIỆM VỤ: Viết bài đánh giá CHI TIẾT và CHUYÊN SÂU cho học viên tên "${userName}" sau khi hoàn thành bài tập ${partName}.

            THÔNG TIN KẾT QUẢ:
            - Điểm số: ${currentScore}/${totalQuestions}
            - Thời gian: ${timeMinutes} phút
            - Đặc thù bài tập: ${partContext}
            - Phân tích chủ điểm: ${tagsSummary}

            CHI TIẾT CÁC CÂU SAI ĐIỂN HÌNH:
            ${mistakesContext}

            YÊU CẦU NỘI DUNG (PHÂN TÍCH KỸ LƯỠNG):
            1. PHÂN TÍCH LỖI SAI CỦA HỌC VIÊN (TRỌNG TÂM):
               - Dựa trên các "CHI TIẾT CÁC CÂU SAI ĐIỂN HÌNH" ở trên, hãy chỉ rõ TẠI SAO học viên lại chọn đáp án sai đó.
               - Đối với ${partName}, hãy nhấn mạnh vào ${partName === 'Part 5' ? 'phản xạ ngữ pháp và từ vựng' : 'khả năng đọc hiểu ngữ cảnh đoạn văn'}.
               - Hãy dùng các ví dụ từ chính các câu sai để giải thích lại kiến thức một cách dễ hiểu như đang giảng bài trực tiếp.
            2. CHIẾN THUẬT THỜI GIAN:
               - Nhận xét tốc độ làm bài (Tiêu chuẩn: ~12-15s/câu cho Part 5, ~30-45s/câu cho Part 6).
            3. LỘ TRÌNH CẢI THIỆN:
               - Đưa ra lời khuyên mang tính khích lệ, truyền cảm hứng mạnh mẽ.

            QUY ĐỊNH TRÌNH BÀY (BẮT BUỘC):
            - Sử dụng thẻ <h3> hoặc <h4> cho các tiêu đề mục.
            - Sử dụng <b> để làm nổi bật các từ khóa quan trọng.
            - Sử dụng <ul>, <li> cho các danh sách ý.
            - Chia đoạn rõ ràng, giọng văn thân thiện, chuyên nghiệp, khích lệ người học.

            JSON FORMAT (BẮT BUỘC - RAW JSON ONLY):
            {
                "progressScore": ${currentPercentage},
                "shortFeedback": "Tóm tắt ngắn gọn (2-3 câu): Bạn đã gặp phải bao nhiêu lỗi, ĐÓ LÀ NHỮNG LỖI GÌ (ví dụ: nhầm lẫn thì hiện tại hoàn thành, thiếu từ vựng về chủ đề kinh tế...), và cần lưu ý điều gì để cải thiện kèm lời khuyên khích lệ.",
                "skills": {
                    "grammar": 0-10,
                    "vocabulary": 0-10,
                    "inference": 0-10,
                    "mainIdea": 0-10
                },
                "strengths": ["Mảng kiến thức tốt 1", "Mảng kiến thức tốt 2"],
                "weaknesses": ["Mảng kiến thức yếu 1", "Mảng kiến thức yếu 2"],
                "detailedAssessment": "Nội dung HTML đánh giá dài, chi tiết (sử dụng p, b, h3, ul, li...)"
            }
        `;


        const result = await executeAITaskWithRetry({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: 5000, // Tăng lên cho bài viết dài
                temperature: 0.75,
                responseMimeType: "application/json",
            }
        });

        const responseText = result.response.text();
        let aiData;

        try {
            // 1. TRƯỜNG HỢP LÝ TƯỞNG: AI TRẢ VỀ JSON CHUẨN
            aiData = JSON.parse(responseText);
        } catch (e) {
            console.warn("[AI Service] JSON Parse Failed, attempting recovery logic...");

            // 2. TRƯỜNG HỢP CỨU DỮ LIỆU: AI TRẢ VỀ TEXT LỖI FORMAT (Đào dữ liệu thủ công bằng Regex)

            // Bước A: Trích xuất shortFeedback
            const recMatch = responseText.match(/"shortFeedback"\s*:\s*"([^"]+)"/);
            let recoveredRec = recMatch ? recMatch[1] : null;

            if (recoveredRec) {
                recoveredRec = recoveredRec.replace(/\\n/g, "").replace(/\n/g, "");
            }

            let cleanAssessment = responseText;

            // Bước B: Làm sạch HTML (detailedAssessment)
            cleanAssessment = cleanAssessment.replace(/^```json\s*/g, "").replace(/```\s*$/g, "");
            cleanAssessment = cleanAssessment.replace(/^\s*\{\s*"detailedAssessment"\s*:\s*"/, "");

            // Tìm điểm ngắt khi bắt đầu cụm phím JSON tiếp theo
            const scoreIndex = cleanAssessment.search(/",\s*"progressScore"/);
            const recIndex = cleanAssessment.search(/",\s*"shortFeedback"/);

            let cutoff = -1;
            if (scoreIndex !== -1 && recIndex !== -1) cutoff = Math.min(scoreIndex, recIndex);
            else if (scoreIndex !== -1) cutoff = scoreIndex;
            else if (recIndex !== -1) cutoff = recIndex;

            if (cutoff !== -1) {
                cleanAssessment = cleanAssessment.substring(0, cutoff);
            } else {
                const lastQuote = cleanAssessment.lastIndexOf('"');
                if (lastQuote !== -1 && lastQuote > cleanAssessment.length - 20) {
                    cleanAssessment = cleanAssessment.substring(0, lastQuote);
                }
            }

            cleanAssessment = cleanAssessment.replace(/\\n/g, "").replace(/\n/g, "").replace(/["},\]\s]+$/, "");

            // Bước C: Fallback nếu không đào được gì
            if (!recoveredRec) {
                if (currentPercentage >= 90) recoveredRec = "Xuất sắc! Hãy duy trì phong độ đỉnh cao này nhé.";
                else if (currentPercentage >= 75) recoveredRec = "Làm tốt lắm! Chỉ cần cẩn thận hơn một chút nữa thôi.";
                else if (currentPercentage >= 50) recoveredRec = "Khá ổn! Hãy xem lại các lỗi sai để cải thiện.";
                else recoveredRec = "Đừng nản chí! Hãy ôn lại kiến thức căn bản và thử lại.";

                if (!cleanAssessment || cleanAssessment.trim().length < 50) {
                    cleanAssessment = `<h3>Kết quả bài làm</h3><p>${recoveredRec}</p><p>Hệ thống tự động ghi nhận kết quả do kết nối AI gặp sự cố.</p>`;
                }
            }

            // 3. TẠO DATA CỨU ĐƯỢC
            aiData = {
                detailedAssessment: cleanAssessment,
                progressScore: currentPercentage,
                shortFeedback: recoveredRec,
                skills: {
                    grammar: Math.round(currentPercentage / 10),
                    vocabulary: Math.round(currentPercentage / 10),
                    inference: Math.round(currentPercentage / 10),
                    mainIdea: Math.round(currentPercentage / 10)
                },
                strengths: ["Hoàn thành bài tập đúng hạn"],
                weaknesses: incorrectTags.length > 0 ? Array.from(new Set(incorrectTags)).slice(0, 3) : ["Cần chú ý bẫy từ vựng"]
            };
        }

        // Trả về aiData này, Controller sẽ lấy nó lưu vào DB
        return aiData;

    } catch (error) {
        console.error("Critical AI Error:", error);
        // Fallback cuối cùng khi mạng lỗi hoàn toàn
        return {
            detailedAssessment: `<p>Hệ thống đang bận. Bạn đã đúng <b>${currentScore}/${totalQuestions}</b> câu.</p>`,
            progressScore: Math.round((currentScore / totalQuestions) * 100),
            shortFeedback: "Hãy thử lại bài tập này sau nhé."
        };
    }
};

export const generatePart6ExplanationService = async (passage: string, questions: Part6Question[]) => {
    const questionsText = questions.map(q => `
    Question ${q.questionNumber}:
    A. ${q.optionA} | B. ${q.optionB} | C. ${q.optionC} | D. ${q.optionD}
    Correct Answer: ${q.correctAnswer}
    `).join('\n');

    const prompt = `Bạn là chuyên gia TOEIC. Hãy phân tích đoạn văn Part 6 sau:

    ĐOẠN VĂN:
    """${passage}"""

    DANH SÁCH CÂU HỎI:
    ${questionsText}

    YÊU CẦU OUTPUT JSON (Không Markdown):
    1. "passageTranslations": Đây là phần dịch văn bản. Vui lòng tổ chức thành mảng các đoạn văn. Mỗi đoạn văn có một "label" (nhãn) và một mảng "sentences" (các câu).
       - Đối với MỖI CÂU, trích xuất thêm 2-4 từ vựng quan trọng (vocab) theo ngữ cảnh câu đó.
       - Cấu trúc: [ { "label": "Passage 1", "sentences": [ { "en": "English sentence.", "vi": "Câu dịch.", "vocab": [ { "text": "word", "meaning": "nghĩa" } ] } ] } ]
    2. "questions": Mảng phân tích cho từng câu hỏi.
       - "questionNumber": Số thứ tự câu hỏi trích xuất từ đề thi (Part 6 luôn nằm trong khoảng 131-146).
       - "analysis": Giải thích tại sao chọn đáp án đó (bằng tiếng Việt, ngắn gọn, súc tích).
       - "evidence": Trích dẫn nguyên văn câu chứa thông tin trong bài (bằng tiếng Anh) VÀ dịch sang tiếng Việt. Ví dụ: "English sentence... -> Câu dịch...".
       - "optionTranslations": Dịch nghĩa ngắn gọn 4 đáp án A, B, C, D.

    FORMAT JSON MẪU:
    {
        "passageTranslations": [
            {
                "label": "Passage 1",
                "sentences": [
                    { 
                        "en": "...", 
                        "vi": "...",
                        "vocab": [ { "text": "word", "meaning": "nghĩa" } ]
                    }
                ]
            }
        ],
        "questions": [
            {
                "questionNumber": 131,
                "optionTranslations": { "A": "...", "B": "...", "C": "...", "D": "..." },
                "analysis": "Chọn (C) vì... (tiếng Việt)",
                "evidence": "English sentence... -> Câu dịch tiếng Việt..."
            }
        ]
    }`;

    try {
        const result = await executeAITaskWithRetry({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.2,
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
    "translation": "Dịch nghĩa 1 câu ngắn gọn sang tiếng Việt",
    "explanation": "Giải thích trọng tâm cấu trúc ngữ pháp (bằng tiếng Việt, ngắn gọn)",
    "tip": "Dấu hiệu nhận biết nhanh (bằng tiếng Việt)"
}

Lưu ý: Nội dung "explanation" và "tip" phải bằng TIẾNG VIỆT. Sử dụng dấu gạch đầu dòng (-) cho mỗi ý để tự động tách dòng, tổng dưới 100 chữ.`;

    const result = await executeAITaskWithRetry({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
        }
    });

    return parseAIResponse(result.response.text());
};

export const generateBatchExplanationsService = async (questions: any[]) => {
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
        "translation": "Dịch nghĩa 1 câu ngắn gọn sang tiếng Việt",
        "explanation": "Giải thích trọng tâm cấu trúc ngữ pháp (bằng tiếng Việt, ngắn gọn)",
        "tip": "Dấu hiệu nhận biết nhanh (bằng tiếng Việt)"
    },
    ...
]

Lưu ý: Nội dung "explanation" và "tip" phải bằng TIẾNG VIỆT. Hãy sử dụng dấu gạch đầu dòng (-) cho mỗi ý để tự động tách dòng, tổng dưới 100 chữ.`;

    const result = await executeAITaskWithRetry({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
        }
    });

    return parseAIResponse(result.response.text());
};

// 1. MAGIC SCAN: Đọc ảnh chụp đề thi -> Trả về JSON để điền form
export const scanPart6FromImageService = async (imageBuffer: Buffer, mimeType: string) => {
    const prompt = `Bạn là trợ lý nhập liệu TOEIC. Hãy nhìn vào bức ảnh đề thi Part 6 này.
    
    NHIỆM VỤ:
    1. Trích xuất nội dung BÀI ĐỌC (Passage) thành HTML (giữ định dạng in đậm, xuống dòng). 
       QUAN TRỌNG: Chỗ trống phải được đánh dấu bằng dấu ngoặc vuông chứa số thứ tự câu hỏi trích xuất từ đề bài, ví dụ: [131], [132].
    2. Trích xuất danh sách CÂU HỎI (Questions) theo đúng số thứ tự ghi trên đề thi (Part 6 luôn nằm trong khoảng 131-146) và 4 đáp án.
    3. Tự động suy luận ĐÁP ÁN ĐÚNG.
    4. DỊCH SONG NGỮ: Dịch toàn bộ nội dung bài đọc thành các cặp câu Anh-Việt kèm từ vựng.

    OUTPUT JSON (Không Markdown):
    {
        "passageHtml": "<p>...</p>",
        "passageTranslations": [
            {
                "label": "Passage 1",
                "sentences": [
                    { 
                        "en": "...", 
                        "vi": "...",
                        "vocab": [ { "text": "word", "meaning": "nghĩa" } ]
                    }
                ]
            }
        ],
        "questions": [
            {
                "questionNumber": 131,
                "optionA": "...", "optionB": "...", "optionC": "...", "optionD": "...",
                "correctAnswer": "A"
            }
        ]
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
        throw new Error("Không thể đọc ảnh Part 6. Vui lòng thử ảnh rõ nét hơn.");
    }
};

// 1.5 MAGIC SCAN Part 7
export const scanPart7FromImageService = async (imageBuffer: Buffer, mimeType: string) => {
    const prompt = `Bạn là trợ lý nhập liệu TOEIC. Hãy nhìn vào bức ảnh đề thi Part 7 này.
    
    NHIỆM VỤ:
    1. Trích xuất nội dung BÀI ĐỌC (Passage) thành HTML (giữ định dạng in đậm, xuống dòng). Nếu ảnh chỉ chứa câu hỏi thì để trống phần này.
    3. Tự động suy luận ĐÁP ÁN ĐÚNG.
    4. DỊCH SONG NGỮ (THẬT KỸ & CHI TIẾT): Dịch TOÀN BỘ nội dung bài đọc (Không tóm tắt).
       - Đối với Chat Message: Giữ nguyên Tên người nói và Thời gian (Ví dụ: "10:00 AM John: Hi" -> "10:00 AM John: Chào bạn") trong cùng một câu dịch.
       - "label": Bạn tự nhận diện loại đoạn văn (Ví dụ: "Passage 1: Email", "Passage 2: Chat Message", "Notice", "Webpage", "Article", "Schedule"). Nhãn phải phản ánh đúng ngữ cảnh.
       - "sentences": Mảng các câu trích xuất tỉ mỉ {en, vi, vocab: [{text, meaning}]}.

    OUTPUT JSON (Không Markdown):
    {
        "passageHtml": "<p>...</p>",
        "passageTranslations": [
            {
                "label": "Passage 1: Email",
                "sentences": [
                    { 
                        "en": "...", 
                        "vi": "...",
                        "vocab": [ { "text": "word", "meaning": "nghĩa" } ]
                    }
                ]
            }
        ],
        "questions": [
            {
                "questionNumber": 147,
                "optionA": "...", "optionB": "...", "optionC": "...", "optionD": "...",
                "correctAnswer": "A"
            }
        ]
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
        throw new Error("Không thể đọc ảnh. Vui lòng thử ảnh rõ nét hơn.");
    }
};

// Helper: Tự động đóng ngoặc JSON bị cắt ngang
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
    // Strip markdown fences nếu có
    const text = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

    // Attempt 1: Direct parse (thường đúng)
    try { return JSON.parse(text); } catch { /* continue */ }

    // Attempt 2: fixJsonStrings - chỉ escape control chars TRONG string value (state machine)
    // normalize() thay całkowite \n sẽ vỡ structure, cần dùng state machine
    const fixJsonStrings = (json: string): string => {
        let result = '';
        let inString = false;
        let i = 0;
        while (i < json.length) {
            const char = json[i];
            const prevChar = i > 0 ? json[i - 1] : '';
            // Toggle inString khi gặp dấu nháy kép không bị escape
            if (char === '"' && prevChar !== '\\') {
                inString = !inString;
                result += char;
            } else if (inString) {
                // Bên trong string: escape raw control chars
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

    // Attempt 2: fixJsonStrings - escape control chars trong string values
    try { return JSON.parse(fixJsonStrings(text)); } catch { /* continue */ }

    // Attempt 2.5: [NEW] jsonrepair - tự động sửa lỗi cú pháp JSON do AI sinh ra
    try {
        const repaired = jsonrepair(fixJsonStrings(text));
        console.log('[AI] jsonrepair succeeded');
        return JSON.parse(repaired);
    } catch { /* continue */ }

    // Attempt 3: Recovery JSON bị cắt ngang (truncated)
    try { return recoverJSON(text); } catch { /* continue */ }

    // Attempt 4: fixJsonStrings + recoverJSON kết hợp
    try {
        const recovered = recoverJSON(fixJsonStrings(text));
        console.log('[AI] Recovery + fixJsonStrings succeeded');
        return recovered;
    } catch (finalErr) {
        console.error('[AI] All parse attempts failed. Raw (first 300):', text.substring(0, 300));
        throw finalErr;
    }
};

// 1.7a STRUCTURAL SCAN: Chỉ lấy passages & câu hỏi EN (nhỏ gọn, không dịch)
const scanStructureAndQuestions = async (
    images: { buffer: Buffer; mimeType: string }[]
): Promise<{ questions: any[]; passages: { label: string; pageIndex: number }[] }> => {
    const numImages = images.length;
    const prompt = `You are a TOEIC Part 7 expert. Analyze ${numImages} image(s) and do ONLY 2 tasks:

TASK 1 - IDENTIFY ALL PASSAGES: For each reading passage found (Email, Article, Advertisement, Notice, Chat, etc.):
  Return: { "label": "Passage N: Type", "pageIndex": N }
  If 2 passages share one page, use same pageIndex but different labels.

TASK 2 - EXTRACT ALL QUESTIONS (English only, no analysis):
  For each question return ONLY: questionNumber, questionText, optionA, optionB, optionC, optionD, correctAnswer.
  Do NOT add any explanation or analysis here.

CRITICAL JSON RULES (MUST FOLLOW):
1. Return STRICT VALID JSON ONLY. Absolutely NO Markdown code blocks.
2. ESCAPE all double quotes inside string values using backslash: \\"
3. Do NOT use literal newline characters inside string values.
4. Do NOT truncate. Output ALL questions completely.

OUTPUT FORMAT:
{
  "passages": [{"label":"Passage 1: Email","pageIndex":0},{"label":"Passage 2: Advertisement","pageIndex":1}],
  "questions": [{"questionNumber":147,"questionText":"...","optionA":"...","optionB":"...","optionC":"...","optionD":"...","correctAnswer":"A"}]
}`;

    const imageParts = images.map(img => bufferToGenerativePart(img.buffer, img.mimeType));
    const result = await executeAITaskWithRetry({
        contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
        generationConfig: { temperature: 0, maxOutputTokens: 8192, responseMimeType: 'application/json' }
    });
    const rawText = result.response.text();
    console.log(`[AI] Stage 1 raw response length: ${rawText.length} chars`);
    return parseAIResponse(rawText);
};

// 1.7a-2 TRANSLATION ENRICHMENT: Dịch câu hỏi & lấy vocabulary (chạy song song với Stage 2)
const enrichQuestionsWithTranslations = async (
    images: { buffer: Buffer; mimeType: string }[],
    questions: any[]
): Promise<{ enrichedQuestions: any[]; vocabulary: any[] }> => {
    const questionList = questions.map(q =>
        `Q${q.questionNumber}: ${q.questionText} | A:${q.optionA} B:${q.optionB} C:${q.optionC} D:${q.optionD}`
    ).join('\n');

    const prompt = `Bạn là chuyên gia TOEIC và dịch thuật. Dựa vào ảnh đề thi, hãy thực hiện 3 nhiệm vụ cho các câu hỏi sau:

CÂU HỎI:
${questionList}

1. DỊCH TIẾNG VIỆT: Dịch câu hỏi và 4 đáp án.
2. PHÂN TÍCH (ĐÁP ÁN - tiếng Việt): Với tư cách chuyên gia TOEIC, phân tích tại sao đáp án đúng là đúng bằng TIẾNG VIỆT: chỉ rõ quy tắc ngữ pháp, logic nội dung, hoặc ý nghĩa từ vựng. Tối đa 3 câu tiếng Việt.
3. DẪN CHỨNG (Evidence): Trích nguyên câu tiếng Anh từ bài đọc làm bằng chứng cho đáp án đúng KÈM THEO bản dịch tiếng Việt ngay phía sau. Ví dụ: "English sentence... -> Bản dịch...".
4. VOCABULARY: 5-8 từ vựng quan trọng nhất của toàn bộ bài đọc.

OUTPUT JSON:
{
  "translations": [
    {
      "questionNumber": 147,
      "questionTranslation": "...",
      "optionTranslations": { "A":"...", "B":"...", "C":"...", "D":"..." },
      "analysis": "Đáp án X đúng vì [giải thích bằng tiếng Việt].",
      "evidence": "[Câu tiếng Anh trích nguyên từ bài] -> [Bản dịch tiếng Việt]"
    }
  ],
  "vocabulary": [{ "word": "...", "meaning": "..." }]
}`;

    const imageParts = images.map(img => bufferToGenerativePart(img.buffer, img.mimeType));
    const result = await executeAITaskWithRetry({
        contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
        generationConfig: { temperature: 0, maxOutputTokens: 4096, responseMimeType: 'application/json' }
    });
    const parsed = parseAIResponse(result.response.text());

    // Merge translations + analysis + evidence vào questions
    const translationsMap = new Map((parsed.translations || []).map((t: any) => [t.questionNumber, t]));
    const enrichedQuestions = questions.map(q => {
        const t: any = translationsMap.get(q.questionNumber) || {};
        return {
            ...q,
            questionTranslation: t.questionTranslation || '',
            optionTranslations: t.optionTranslations || {},
            analysis: t.analysis || '',      // Phân tích tiếng Việt từ enrichment
            evidence: t.evidence || ''       // Dẫn chứng từ enrichment
        };
    });

    return { enrichedQuestions, vocabulary: parsed.vocabulary || [] };
};


// 1.7b DEEP EXTRACTION: Bước 2 - Dịch chi tiết MỘT đoạn văn cụ thể
const extractPassageDetailService = async (
    images: { buffer: Buffer; mimeType: string }[],
    passageLabel: string,
    passageIndex: number // Số thứ tự (0-indexed) trong tổng số passages
): Promise<{ label: string; sentences: any[]; keyVocabulary: any[] }> => {
    const ordinalMap = ['đầu tiên (thứ nhất)', 'thứ hai', 'thứ ba', 'thứ tư'];
    const ordinal = ordinalMap[passageIndex] || `số ${passageIndex + 1}`;

    const prompt = `Bạn là chuyên gia TOEIC và dịch thuật.
Trong ảnh có nhiều đoạn văn. Nhiệm vụ: CHỈ TRÍCH XUẤT VÀ DỊCH ĐOẠN VĂN "${passageLabel}" (đoạn ${ordinal}).
BỎ QUA hoàn toàn: các đoạn văn khác, câu hỏi trắc nghiệm, đáp án A/B/C/D.

QUY TẮC TRÍCH XUẤT THEO TỪNG LOẠI VĂN BẢN:

EMAIL / LETTER: Phải trích xuất DAY DU cả phần HEADER và BODY:
  - Header fields: To, From, Date, Subject, CC — mỗi field = 1 sentence riêng.
    Ví dụ: { "en": "To: marketing@company.com", "vi": "Kính gửi: marketing@company.com" }
  - Body: trích từng câu bình thường.

NOTICE / MEMO / ADVERTISEMENT / ARTICLE: Trích từng câu, bao gồm cả tiêu đề.

CHAT / TEXT MESSAGE: Mỗi tin nhắn = 1 sentence, giữ tên người gửi + thời gian.
  Ví dụ: { "en": "Sarah (10:15 AM): Are you free tomorrow?", "vi": "Sarah (10:15 SA): Bạn rảnh ngày mai không?" }

TABLE / SCHEDULE: Mỗi hàng dữ liệu = 1 sentence.

YÊU CẦU CHUNG:
- KHÔNG bỏ sót bất kỳ dòng nào (kể cả chữ ký, ngày tháng cuối thư).
- DỊCH ĐẦY ĐỦ, KHÔNG tóm tắt.
- "keyVocabulary": 5-8 từ vựng quan trọng tổng hợp từ đoạn văn.

OUTPUT JSON:
{
    "label": "${passageLabel}",
    "sentences": [
        { "en": "...", "vi": "..." }
    ],
    "keyVocabulary": [
        { "word": "...", "type": "v/n/adj", "meaning": "...", "ipa": "/.../" }
    ]
}`;

    const imageParts = images.map(img => bufferToGenerativePart(img.buffer, img.mimeType));
    const result = await executeAITaskWithRetry({
        contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
        generationConfig: { temperature: 0, maxOutputTokens: 6144, responseMimeType: "application/json" }
    });
    return parseAIResponse(result.response.text());
};

// 1.7 MAGIC SCAN Part 7 (Orchestrator - Multi-stage Pipeline)
const limit = pLimit(2);
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const magicScanPart7FromImagesService = async (
    images: { buffer: Buffer; mimeType: string }[]
) => {
    // === GIAI ĐOẠN 1: QUÉT CẤU TRÚC & CÂU HỎI (English only, nhỏ gọn) ===
    console.log('[AI] Stage 1: Scanning structure and questions...');
    let structure: { questions: any[]; passages: { label: string; pageIndex: number }[] };
    try {
        structure = await scanStructureAndQuestions(images);
        console.log(`[AI] Stage 1 done: ${structure.passages?.length || 0} passages, ${structure.questions?.length || 0} questions`);
    } catch (err: any) {
        console.error('[AI] Stage 1 failed:', err.message);
        throw new Error('Không thể phân tích cấu trúc bài thi. Vui lòng kiểm tra ảnh.');
    }

    const passages = structure.passages || [];
    const questions = structure.questions || [];

    // Nếu không nhận diện được passage nào thì fallback: 1 passage/image
    const passageTargets = passages.length > 0
        ? passages
        : images.map((_, i) => ({ label: `Passage ${i + 1}`, pageIndex: i }));

    // === GIAI ĐOẠN 2: CHẠY SONG SONG QUA QUEUE ===
    console.log(`[AI] Stage 2: Running ${passageTargets.length} passage extractions + enrichment via queue limit 2...`);

    const passagePromises = passageTargets.map((p, index) =>
        limit(async () => {
            // Cứ mỗi đoạn xếp hàng, cho nó nghỉ để dàn đều request, tránh bị Google "đá" (429)
            if (index > 0) {
                await delay(index * 2500);
            }
            console.log(`[AI]   Đang dịch đoạn văn: "${p.label}"...`);
            try {
                const result = await extractPassageDetailService(images, p.label, index);
                console.log(`[AI]   ✓ Passage "${p.label}" extracted`);
                return result;
            } catch (err: any) {
                console.error(`[AI]   ✗ Passage "${p.label}" failed:`, err.message);
                return { label: p.label, sentences: [], keyVocabulary: [] };
            }
        })
    );

    const enrichmentPromise = limit(async () => {
        try {
            const result = await enrichQuestionsWithTranslations(images, questions);
            console.log(`[AI]   ✓ Question translations & vocabulary done`);
            return result;
        } catch (err: any) {
            console.error(`[AI]   ✗ Enrichment failed:`, err.message);
            return { enrichedQuestions: questions, vocabulary: [] };
        }
    });

    // Chờ tất cả cùng lúc (nhưng limit bên trong sẽ tự chia batch)
    const [passageTranslations, enrichmentResult] = await Promise.all([
        Promise.all(passagePromises),
        enrichmentPromise
    ]);

    // Gộp tất cả keyVocabulary từ các đoạn passage vào một mảng vocabulary dùng chung
    const mergedVocabMap = new Map();
    // Thêm vocab từ enrichment (nếu có)
    (enrichmentResult.vocabulary || []).forEach((v: any) => {
        if (v.word) mergedVocabMap.set(v.word, v);
    });
    // Thêm vocab từ passage extraction
    passageTranslations.forEach(pt => {
        (pt.keyVocabulary || []).forEach((v: any) => {
            if (v.word) mergedVocabMap.set(v.word, v);
        });
    });

    // === GIAI ĐOẠN 3: GỘP KẾT QUẢ ===
    console.log('[AI] Stage 3: Merging results...');
    return {
        passageTranslations,
        questions: enrichmentResult.enrichedQuestions,
        vocabulary: Array.from(mergedVocabMap.values()),
        passageRegions: [],
        isPartial: false
    };
};


// 2. AI EXPLANATION: Sinh lời giải từ Text hoặc Ảnh (Multimodal)
export const generatePart7ExplanationService = async (
    type: 'text' | 'image',
    content: string | string[], // Text hoặc mảng URL ảnh
    questions: any[]
) => {
    const questionsText = questions.map(q => {
        // Tương thích cả 2 format: { optionA, optionB,... } và { options: { A, B,... } }
        const optA = q.optionA || q.options?.A || '';
        const optB = q.optionB || q.options?.B || '';
        const optC = q.optionC || q.options?.C || '';
        const optD = q.optionD || q.options?.D || '';
        return `
    Câu ${q.questionNumber}: ${q.questionText || ''}
    A. ${optA} | B. ${optB} | C. ${optC} | D. ${optD}
    Đáp án đúng: ${q.correctAnswer}
    `;
    }).join('\n');

    const promptText = `Bạn là chuyên gia TOEIC Part 7.
    NHIỆM VỤ: Dựa vào nội dung ${type === 'image' ? 'trong các hình ảnh đính kèm' : 'văn bản được cung cấp'}, hãy phân tích và giải thích.

    ${type === 'text' ? `ĐOẠN VĂN BẢN:\n"""${content}"""` : ''}

    DANH SÁCH CÂU HỎI:
    ${questionsText}

    YÊU CẦU OUTPUT JSON:
    1. "passageTranslations": Đây là phần dịch văn bản. Vui lòng dịch THẬT KỸ, THẬT CHI TIẾT và TOÀN BỘ nội dung (KHÔNG tóm tắt). 
       - Tổ chức thành mảng các đoạn văn. Mỗi đoạn văn có một "label" (nhãn) và một mảng "sentences" (các câu).
       - Đối với "label": Vui lòng nhận diện kỹ loại hình (Ví dụ: "Passage 1: Email", "Passage 2: Chat Message", "Notice", "Article", "Schedule").
       - Đối với Chat Message: Giữ nguyên Tên người và Thời gian đi kèm nội dung tin nhắn trong 1 sentence.
       - Đối với MỖI CÂU, trích xuất thêm 2-4 từ vựng quan trọng (vocab) theo đúng ngữ cảnh.
       - Cấu trúc: [ { "label": "Passage 1: Email", "sentences": [ { "en": "English sentence.", "vi": "Câu dịch.", "vocab": [ { "text": "word", "meaning": "nghĩa" } ] } ] } ]
    2. "vocabulary": List 3-5 từ vựng khó của toàn bài (từ vựng tổng hợp).
    3. "questions": Mảng giải thích chi tiết từng câu.
       - "analysis": Tại sao chọn đáp án này (giải thích bằng TIẾNG VIỆT về ngữ pháp/từ vựng).
       - "evidence": Trích dẫn nguyên văn câu chứa thông tin trong bài (Tiếng Anh) KÈM THEO bản dịch tiếng Việt. Ví dụ: "English sentence... -> Dịch Việt...".
       - "questionTranslation": Dịch câu hỏi sang tiếng Việt.
       - "optionTranslations": { "A": "...", "B": "...", "C": "...", "D": "..." }

    FORMAT JSON (Chỉ trả về chuỗi JSON thuần, KHÔNG kèm giải thích, KHÔNG có markdown):
    {
        "passageTranslations": [
            {
                "label": "Passage 1: Article",
                "items": [
                    { 
                        "en": "...", 
                        "vi": "...",
                        "vocab": [ { "text": "word", "meaning": "nghĩa" } ]
                    }
                ]
            }
        ],
        "vocabulary": [{ "word": "...", "meaning": "..." }],
        "questions": [
            {
                "questionNumber": 147,
                "analysis": "Giải thích lý do chọn đáp án bằng tiếng Việt...",
                "evidence": "Original English sentence from passage -> Bản dịch tiếng Việt...",
                "questionTranslation": "Dịch câu hỏi sang tiếng Việt...",
                "optionTranslations": { "A": "Dịch A...", "B": "Dịch B...", "C": "Dịch C...", "D": "Dịch D..." }
            }
        ]
    }`;

    try {
        let parts: any[] = [{ text: promptText }];
        if (type === 'image' && Array.isArray(content)) {
            const imageParts = await Promise.all(content.map(async (item: any) => {
                if (typeof item === 'string') {
                    return urlToGenerativePart(item, 'image/jpeg');
                } else if (item.buffer) {
                    return bufferToGenerativePart(item.buffer, item.mimeType || 'image/jpeg');
                }
                return null;
            }));
            parts = [...parts, ...imageParts.filter(Boolean)];
        }

        const result = await executeAITaskWithRetry({
            contents: [{ role: 'user', parts: parts }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: "application/json" }
        });

        const rawText = result.response.text();
        return parseAIResponse(rawText);
    } catch (error: any) {
        console.error("AI Part 7 Error:", error);
        throw new Error(error.message || "Lỗi khi xử lý AI đa phương thức.");
    }
};
// 1.8 MAGIC SCAN Part 6 (Đa ảnh & Tự động Insights)
export const magicScanPart6FromImagesService = async (
    images: { buffer: Buffer; mimeType: string }[]
) => {
    const prompt = `Bạn là chuyên gia TOEIC Part 6 và trợ lý nhập liệu thông minh.
    
    NHIỆM VỤ: Dựa vào các hình ảnh đề thi đính kèm, hãy:
    1. Trích xuất nội dung BÀI ĐỌC (Passage) thành HTML (giữ định dạng in đậm, xuống dòng).
       QUAN TRỌNG: Chỗ trống phải được đánh dấu bằng dấu ngoặc vuông chứa số thứ tự câu hỏi trích xuất từ đề bài, ví dụ: [131], [132].
    2. QUAN TRỌNG: Part 6 mỗi đoạn văn LUÔN CÓ 4 CÂU HỎI liên tiếp (ví dụ: 131, 132, 133, 134). Bạn PHẢI trích xuất đủ cả 4 câu này và 4 đáp án cho mỗi câu. KHÔNG ĐƯỢC BỎ SÓT.
    3. **SIÊU QUAN TRỌNG - PHÂN TÍCH ĐÁP ÁN ĐÚNG**: Với tư cách là chuyên gia TOEIC, hãy phân tích logic ngữ pháp, sự hòa hợp thì, từ vựng và sự liên kết đoạn văn để chọn ra ĐÁP ÁN ĐÚNG TUYỆT ĐỐI. Tránh các bẫy thường gặp.
    4. **Dịch bài đọc theo từng câu song ngữ (Sentence Segmentation)**: Trích xuất nội dung bài đọc bằng cách chia nhỏ thành **từng câu riêng biệt**. Mỗi câu tiếng Anh đi kèm một câu dịch tiếng Việt sát nghĩa. Trả về dưới dạng mảng JSON \`[{"en": "...", "vi": "...", "vocab": [{"text": "word", "meaning": "nghĩa sát ngữ cảnh"}]}]\`. KHÔNG trả về một đoạn văn dài. Cắt đúng dấu chấm câu. Với mỗi câu TRÍCH XUẤT 2-4 TỪ VỰNG QUAN TRỌNG.
    5. Trích xuất từ vựng khó của toàn bài, phân tích lời giải (analysis) và chỉ ra dẫn chứng (evidence).
    6. Dịch 4 đáp án sang tiếng Việt.

    YÊU CẦU QUAN TRỌNG VỀ ĐỘ CHÍNH XÁC:
    - **Đáp án đúng (correctAnswer)**: Phải được suy luận chuẩn xác dựa trên cấu trúc ngữ pháp và logic của toàn bài đọc. KHÔNG ĐƯỢC chọn đại. 
    - **Lời giải (analysis)**: Phải chỉ rõ lý do ngữ pháp hoặc từ vựng tại sao đáp án đó là duy nhất đúng trong ngữ cảnh này.

    YÊU CẦU OUTPUT JSON CHI TIẾT. CHỈ TRẢ VỀ JSON, KHÔNG CÓ GIẢI THÍCH HAY VĂN BẢN THỪA.
    QUAN TRỌNG: 
    - TRẢ VỀ ĐỦ 4 CÂU HỎI trong mảng "questions".
    - Tất cả dấu ngoặc và dấu phẩy phải đúng cú pháp JSON. 
    - KHÔNG dùng dấu phẩy ở cuối phần tử cuối cùng (no trailing commas).
    - TRONG nội dung chuỗi (string), nếu có dấu ngoặc kép (") thì PHẢI được escape bằng dấu gạch chéo ngược (\").
    - Giữ nguyên cấu trúc JSON sau đây (THEO ĐÚNG THỨ TỰ NÀY):
    {
        "questions": [
            {
                "questionNumber": 131,
                "optionA": "...", "optionB": "...", "optionC": "...", "optionD": "...",
                "correctAnswer": "A",
                "optionTranslations": { "A": "...", "B": "...", "C": "...", "D": "..." },
                "analysis": "Giải thích bằng tiếng Việt lý do chọn đáp án này.",
                "evidence": "Câu tiếng Anh trích từ bài -> Bản dịch tiếng Việt."
            }
        ],
        "passageHtml": "...",
        "passageTranslations": [
            {
                "label": "Passage 1",
                "items": [
                    { 
                        "en": "English sentence 1.", 
                        "vi": "Câu dịch tiếng Việt 1.",
                        "vocab": [ { "text": "word", "meaning": "nghĩa" } ]
                    }
                ]
            }
        ],
        "vocabulary": [{ "word": "...", "meaning": "..." }]
    }
    Lưu ý quan trọng: Đảm bảo trích xuất đầy đủ văn bản và logic đáp án.`;

    try {
        const imageParts = images.map(img => bufferToGenerativePart(img.buffer, img.mimeType));
        const result = await executeAITaskWithRetry({
            contents: [{
                role: 'user',
                parts: [{ text: prompt }, ...imageParts]
            }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 8192, // Ensure full JSON is returned
                responseMimeType: "application/json"
            }
        });

        const rawText = result.response.text();
        // Loại bỏ markdown code blocks nếu có
        const text = rawText.replace(/^```json\s*/, "").replace(/```$/, "").trim();

        try {
            return JSON.parse(text);
        } catch (parseError) {
            console.error("JSON Parse Error metadata:", {
                length: text.length,
                preview: text.substring(0, 100) + "...",
                lastChar: text.substring(text.length - 20)
            });

            // Attempt JSON recovery using a regex approach to extract partial blocks or close the structure
            try {
                // Thêm ngoặc đóng nếu bị cắt ngang
                let recovered = text.trim();
                if (recovered.endsWith(',')) recovered = recovered.slice(0, -1);

                // Cố gắng đóng mảng và object nếu thiếu
                const openBraces = (recovered.match(/\{/g) || []).length;
                const closeBraces = (recovered.match(/\}/g) || []).length;
                const openBrackets = (recovered.match(/\[/g) || []).length;
                const closeBrackets = (recovered.match(/\]/g) || []).length;

                if (openBrackets > closeBrackets) {
                    recovered += '\n]'.repeat(openBrackets - closeBrackets);
                }
                if (openBraces > closeBraces) {
                    recovered += '\n}'.repeat(openBraces - closeBraces);
                }

                const parsed = JSON.parse(recovered);
                console.warn(`[AI] JSON recovered with regex matchers. Found ${parsed.questions?.length || 0} questions.`);
                if (!parsed.questions || parsed.questions.length === 0) {
                    throw new Error("No questions found after recovery");
                }
                return parsed;
            } catch (_) { /* recovery failed */ }

            console.error("Raw AI Output (Partial):", text.substring(0, 5000));
            throw new Error("Dữ liệu AI trả về không đúng định dạng JSON. Vui lòng thử lại với ảnh rõ nét hơn.");
        }
    } catch (error: any) {
        console.error("Magic Scan Part 6 Error:", error);
        throw error;
    }
};

/**
 * 3. WORD TRANSLATION: Dịch một từ cụ thể trong ngữ cảnh của câu
 */
export const translateWordService = async (word: string, sentence: string) => {
    const prompt = `Bạn là một từ điển Anh-Việt thông minh. 
    NHIỆM VỤ: Dịch từ "${word}" trong ngữ cảnh của câu: "${sentence}".
    
    YÊU CẦU:
    1. Trả về nghĩa chính xác NHẤT của từ đó trong câu này.
    2. Cung cấp phiên âm IPA.
    3. Trích xuất loại từ (Grammar category: noun, verb, adj...).
    4. Gợi ý thêm 1 ví dụ khác sử dụng từ này. (Ví dụ mới HOÀN TOÀN khác câu trên).

    OUTPUT JSON (Không Markdown):
    {
        "word": "${word}",
        "ipa": "/.../",
        "type": "noun/verb/adj",
        "meaning": "Dịch nghĩa Tiếng Việt",
        "example": "An example sentence.",
        "exampleVi": "Câu dịch ví dụ."
    }`;

    try {
        const result = await executeAITaskWithRetry({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json",
            }
        });

        const text = result.response.text().replace(/^```json\s*/, "").replace(/```$/, "").trim();
        return JSON.parse(text);
    } catch (error) {
        console.error("AI Word Translation Error:", error);
        throw new Error("Không thể dịch từ này lúc này.");
    }
};
