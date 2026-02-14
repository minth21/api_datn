const XLSX = require('xlsx');

// Create workbook
const wb = XLSX.utils.book_new();

// Part 5 Template Data (1 example question for admin reference)
const part5Data = [
    // Header row
    ['questionText', 'optionA', 'optionB', 'optionC', 'optionD', 'correctAnswer'],

    // Example: Word form
    [
        'The company\'s new policy has been ___ implemented across all departments.',
        'success',
        'successful',
        'successfully',
        'succeed',
        'C'
    ]
];

// Create worksheet
const ws = XLSX.utils.aoa_to_sheet(part5Data);

// Set column widths
ws['!cols'] = [
    { wch: 60 }, // questionText
    { wch: 20 }, // optionA
    { wch: 20 }, // optionB
    { wch: 20 }, // optionC
    { wch: 20 }, // optionD
    { wch: 15 }  // correctAnswer
];

// Add worksheet to workbook
XLSX.utils.book_append_sheet(wb, ws, 'Part5');

// Write file
const path = require('path');
const outputPath = path.join(__dirname, '..', 'toeic_practice_admin', 'public', 'templates', 'part5_template.xlsx');
XLSX.writeFile(wb, outputPath);

console.log('✅ Part 5 template created successfully at:', outputPath);
