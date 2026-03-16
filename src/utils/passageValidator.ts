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
        // Support both "passages" and "passageTranslations" keys
        const rawPassages = parsed.passages || parsed.passageTranslations;
        
        if (Array.isArray(rawPassages)) {
            vocabulary = parsed.vocabulary || [];
            aiQuestions = parsed.questions || [];
            parsed = rawPassages;
        } else if (parsed.en || parsed.vi) {
             // Handle single object case (Legacy)
             parsed = [parsed];
        } else {
            // Might be a single passage object without wrapper
            parsed = [parsed];
        }
    }

    if (!Array.isArray(parsed)) return null;

    // Auto-migration & Validation
    const standardized: any[] = parsed.map((block: any, index: number) => {
        // Case 1: Legacy format (Flat array of {en, vi})
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

    // Preserve metadata if exists
    if (vocabulary.length > 0 || aiQuestions.length > 0) {
        return JSON.stringify({
            passages: standardized,
            vocabulary,
            questions: aiQuestions
        });
    }

    return JSON.stringify(standardized);
};
