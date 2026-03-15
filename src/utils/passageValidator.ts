/**
 * Utility to validate and standardize passage translation data.
 * Ensures the data follows the structure: [{label, sentences: [{en, vi, vocab: [{text, meaning}]}]}]
 */

export interface VocabItem {
    text: string;
    meaning: string;
}

export interface SentenceItem {
    en: string;
    vi: string;
    vocab?: VocabItem[];
}

export interface PassageBlock {
    label: string;
    sentences: SentenceItem[];
}

/**
 * Validates and standardizes passage translation data.
 * @param data Stringified JSON or Object
 * @returns Standardized JSON string
 */
export const validateAndStandardizePassageData = (data: any): string | null => {
    if (!data) return null;

    let parsed: any;
    try {
        parsed = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
        throw new Error('Định dạng JSON của bản dịch không hợp lệ.');
    }

    // --- Support for "Insight Object" wrapper: { passages: [], vocabulary: [], questions: [] } ---
    let vocabulary: any[] = [];
    let aiQuestions: any[] = [];
    
    if (parsed && !Array.isArray(parsed)) {
        if (Array.isArray(parsed.passages)) {
            vocabulary = parsed.vocabulary || [];
            aiQuestions = parsed.questions || [];
            parsed = parsed.passages;
        } else {
            // Handle single object case
            parsed = [parsed];
        }
    }

    if (!Array.isArray(parsed)) return null;

    // Auto-migration & Validation
    const standardized: any[] = parsed.map((block: any, index: number) => {
        // Case 1: Legacy Part 6 format (Flat array of {en, vi})
        if (block.en || block.vi) {
            return {
                type: 'passage',
                label: index === 0 ? 'Passage' : `Passage ${index + 1}`,
                items: [{
                    en: String(block.en || ''),
                    vi: String(block.vi || ''),
                    vocab: Array.isArray(block.vocab) ? block.vocab.map((v: any) => ({
                        text: String(v.text || v.lemma || ''),
                        meaning: String(v.meaning || ''),
                        ipa: String(v.ipa || '')
                    })) : []
                }]
            };
        }

        // Case 2: New format (supports both 'sentences' and 'items')
        const rawItems = Array.isArray(block.items) ? block.items : (Array.isArray(block.sentences) ? block.sentences : []);
        
        const items = rawItems.map((s: any) => ({
            en: String(s.en || ''),
            vi: String(s.vi || ''),
            vocab: Array.isArray(s.vocab) ? s.vocab.map((v: any) => ({
                text: String(v.text || v.lemma || ''),
                meaning: String(v.meaning || ''),
                ipa: String(v.ipa || '')
            })) : []
        }));

        return {
            type: block.type || 'passage',
            label: String(block.label || (index === 0 ? 'Passage' : `Passage ${index + 1}`)),
            items
        };
    }).filter((block: any) => block.items && block.items.length > 0);

    if (standardized.length === 0) return null;

    // If we have extra metadata (vocabulary/questions), we might want to preserve it, 
    // but the main UI expects an array for bilingual display.
    // For now, let's keep it as an array to ensure UI compatibility, 
    // OR wrap it back if we want to preserve AI insights.
    
    // To satisfy both PartDetail (wants array) and Modal (wants full object), 
    // let's stick to the Array format if possible, or a hybrid.
    if (vocabulary.length > 0 || aiQuestions.length > 0) {
        return JSON.stringify({
            passages: standardized,
            vocabulary,
            questions: aiQuestions
        });
    }

    return JSON.stringify(standardized);
};
