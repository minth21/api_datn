const xlsx = require('xlsx');
const path = require('path');

const headers = [
    'Question Text',
    'Option A',
    'Option B',
    'Option C',
    'Option D',
    'Correct Answer (A/B/C/D)',
    'Explanation'
];

const sampleRow = [
    'She _____ to the store yesterday.',
    'go',
    'went',
    'gone',
    'going',
    'B',
    'Went is past tense of go'
];

const workbook = xlsx.utils.book_new();
const worksheet = xlsx.utils.aoa_to_sheet([headers, sampleRow]);

// Auto-width columns
const wscols = [
    { wch: 40 }, // Question
    { wch: 15 }, // A
    { wch: 15 }, // B
    { wch: 15 }, // C
    { wch: 15 }, // D
    { wch: 25 }, // Answer
    { wch: 40 }, // Explanation
];
worksheet['!cols'] = wscols;

xlsx.utils.book_append_sheet(workbook, worksheet, 'Template');

const outputPath = path.join(__dirname, 'Question_Template.xlsx');
xlsx.writeFile(workbook, outputPath);

console.log(`Template created at: ${outputPath}`);
