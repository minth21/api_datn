import he from 'he';

/**
 * Hàm sanitize chuẩn: Chỉ lọc rác, giữ nguyên nội dung gốc.
 * Nếu text đã sạch sẵn, hàm sẽ trả về nguyên bản, không xóa hay làm mất dữ liệu.
 */
export const cleanToEICData = (rawText: string): string => {
  if (!rawText || typeof rawText !== 'string') return rawText || '';

  // 1. Giải mã HTML Entities (&nbsp; -> ' ')
  // Nếu không có entities, he.decode trả về nguyên bản.
  let clean = he.decode(rawText);

  // 2. Triệt hạ ký tự \u00A0 (Non-breaking space) ẩn
  clean = clean.replace(/\u00A0/g, ' ');

  // 3. Chuẩn hóa khoảng trắng (nhiều dấu cách liền nhau -> 1 dấu cách)
  // Giúp trình duyệt tự động ngắt dòng (word-wrap) cực chuẩn.
  clean = clean.replace(/\s+/g, ' ');

  return clean.trim();
};

/**
 * Clean all string values in a nested object/array
 */
export const cleanObjectToEICData = (obj: any): any => {
  if (!obj) return obj;

  if (typeof obj === 'string') {
    return cleanToEICData(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => cleanObjectToEICData(item));
  }

  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      cleaned[key] = cleanObjectToEICData(obj[key]);
    }
    return cleaned;
  }

  return obj;
};
