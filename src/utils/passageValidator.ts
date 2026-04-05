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
 * @returns Standardized flat JSON string [ { type: 'passage', ... } ]
 */
export const validateAndStandardizePassageData = (data: any): string | null => {
    if (!data) return null;

    let parsed: any;
    try {
        parsed = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
        throw new Error('Định dạng JSON của bản dịch không hợp lệ.');
    }

    // --- RULE 4: Flatten any nested "Insight Object" wrapper ---
    // wrapper: { passages: [], vocabulary: [], questions: [] }
    if (parsed && !Array.isArray(parsed)) {
        const rawPassages = parsed.passages || parsed.passageTranslations;
        if (Array.isArray(rawPassages)) {
            parsed = rawPassages;
        } else if (parsed.en || parsed.vi || parsed.items || parsed.sentences) {
            // Handle single object case
            parsed = [parsed];
        } else {
            // Unexpected object structure
            return null;
        }
    }

    if (!Array.isArray(parsed)) return null;

    // Standardization & Validation
    const standardized: any[] = parsed.map((block: any, index: number) => {
        // Case 1: Legacy format (Flat array of {en, vi})
        if (block.en || block.vi) {
            return {
                type: 'passage',
                label: String(block.label || (index === 0 ? 'Passage' : `Passage ${index + 1}`)),
                items: [{
                    en: String(block.en || '').replace(/&nbsp;/g, ' ').trim(),
                    vi: String(block.vi || '').replace(/&nbsp;/g, ' ').trim(),
                    vocab: Array.isArray(block.vocab) ? block.vocab.map((v: any) => ({
                        text: String(v.text || v.lemma || '').replace(/&nbsp;/g, ' ').trim(),
                        meaning: String(v.meaning || '').replace(/&nbsp;/g, ' ').trim(),
                        ipa: String(v.ipa || '').replace(/&nbsp;/g, ' ').trim()
                    })) : []
                }]
            };
        }

        // Case 2: Standard format (supports both 'sentences' and 'items')
        const rawItems = Array.isArray(block.items) ? block.items : (Array.isArray(block.sentences) ? block.sentences : []);
        
        const items = rawItems.map((s: any) => ({
            en: String(s.en || '').replace(/&nbsp;/g, ' ').trim(),
            vi: String(s.vi || '').replace(/&nbsp;/g, ' ').trim(),
            vocab: Array.isArray(s.vocab) ? s.vocab.map((v: any) => ({
                text: String(v.text || v.lemma || '').replace(/&nbsp;/g, ' ').trim(),
                meaning: String(v.meaning || '').replace(/&nbsp;/g, ' ').trim(),
                ipa: String(v.ipa || '').replace(/&nbsp;/g, ' ').trim()
            })) : []
        }));

        return {
            type: block.type || 'passage',
            label: String(block.label || (index === 0 ? 'Passage' : `Passage ${index + 1}`)),
            items
        };
    }).filter((block: any) => block.items && block.items.length > 0);

    if (standardized.length === 0) return null;

    // RULE 4: Always return the flat array as JSON string
    return JSON.stringify(standardized);
};
