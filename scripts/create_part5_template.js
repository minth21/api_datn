const XLSX = require('xlsx');
const path = require('path');

// Create Part 5 template with explanation column
function createPart5Template() {
    const headers = [
        'Số câu',
        'Nội dung câu hỏi',
        'Đáp án A',
        'Đáp án B',
        'Đáp án C',
        'Đáp án D',
        'Đáp án đúng (A/B/C/D)',
        'Giải thích'
    ];

    // Create 30 empty rows for Part 5 questions (101-130)
    const data = [headers];
    for (let i = 101; i <= 130; i++) {
        data.push([
            i,  // Question number
            '', // Question text
            '', // Option A
            '', // Option B
            '', // Option C
            '', // Option D
            '', // Correct answer
            ''  // Explanation
        ]);
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    ws['!cols'] = [
        { wch: 8 },  // Số câu
        { wch: 50 }, // Nội dung câu hỏi
        { wch: 30 }, // Đáp án A
        { wch: 30 }, // Đáp án B
        { wch: 30 }, // Đáp án C
        { wch: 30 }, // Đáp án D
        { wch: 15 }, // Đáp án đúng
        { wch: 50 }  // Giải thích
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Part 5');

    // Save file
    const outputPath = path.join(__dirname, '..', '..', 'toeic_practice_admin', 'public', 'templates', 'part5_template.xlsx');
    XLSX.writeFile(wb, outputPath);
    console.log('✅ Part 5 template created successfully at:', outputPath);
    console.log('📋 Headers:', headers);
}

createPart5Template();
