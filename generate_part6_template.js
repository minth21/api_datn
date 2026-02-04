const XLSX = require('xlsx');

// Create workbook
const wb = XLSX.utils.book_new();

// Part 6 Template Data (4 passages × 4 questions = 16 questions)
const part6Data = [
    // Header row
    ['passage', 'questionText', 'optionA', 'optionB', 'optionC', 'optionD', 'correctAnswer', 'explanation'],

    // Passage 1 - Questions 1-4
    [
        'Dear Valued Customer,\n\nThank you for your recent purchase from TechMart. We appreciate your business and want to ensure you have the best experience with our products. If you have any questions or concerns, please don\'t hesitate to ___(1)___ our customer service team. We are available 24/7 to assist you.\n\nYour satisfaction is our top priority, and we ___(2)___ to providing excellent service. As a token of our appreciation, we\'re offering you a 10% discount on your next purchase. Simply use the code THANKYOU10 at checkout.\n\nWe look forward to ___(3)___ you again soon. If you enjoyed your shopping experience, we would be grateful if you could ___(4)___ a review on our website.\n\nBest regards,\nThe TechMart Team',
        'What is the best word for blank (1)?',
        'contact',
        'contacting',
        'contacted',
        'contacts',
        'A',
        'Đáp án đúng là A. Sau \"hesitate to\" cần dùng động từ nguyên mẫu \"contact\".'
    ],
    [
        'Dear Valued Customer,\n\nThank you for your recent purchase from TechMart. We appreciate your business and want to ensure you have the best experience with our products. If you have any questions or concerns, please don\'t hesitate to ___(1)___ our customer service team. We are available 24/7 to assist you.\n\nYour satisfaction is our top priority, and we ___(2)___ to providing excellent service. As a token of our appreciation, we\'re offering you a 10% discount on your next purchase. Simply use the code THANKYOU10 at checkout.\n\nWe look forward to ___(3)___ you again soon. If you enjoyed your shopping experience, we would be grateful if you could ___(4)___ a review on our website.\n\nBest regards,\nThe TechMart Team',
        'What is the best word for blank (2)?',
        'commit',
        'are committed',
        'committing',
        'have committed',
        'B',
        'Đáp án đúng là B. Cần dùng \"are committed to\" (cam kết) để diễn tả sự tận tâm.'
    ],
    [
        'Dear Valued Customer,\n\nThank you for your recent purchase from TechMart. We appreciate your business and want to ensure you have the best experience with our products. If you have any questions or concerns, please don\'t hesitate to ___(1)___ our customer service team. We are available 24/7 to assist you.\n\nYour satisfaction is our top priority, and we ___(2)___ to providing excellent service. As a token of our appreciation, we\'re offering you a 10% discount on your next purchase. Simply use the code THANKYOU10 at checkout.\n\nWe look forward to ___(3)___ you again soon. If you enjoyed your shopping experience, we would be grateful if you could ___(4)___ a review on our website.\n\nBest regards,\nThe TechMart Team',
        'What is the best word for blank (3)?',
        'serve',
        'served',
        'serving',
        'to serve',
        'C',
        'Đáp án đúng là C. Sau \"look forward to\" cần dùng V-ing \"serving\".'
    ],
    [
        'Dear Valued Customer,\n\nThank you for your recent purchase from TechMart. We appreciate your business and want to ensure you have the best experience with our products. If you have any questions or concerns, please don\'t hesitate to ___(1)___ our customer service team. We are available 24/7 to assist you.\n\nYour satisfaction is our top priority, and we ___(2)___ to providing excellent service. As a token of our appreciation, we\'re offering you a 10% discount on your next purchase. Simply use the code THANKYOU10 at checkout.\n\nWe look forward to ___(3)___ you again soon. If you enjoyed your shopping experience, we would be grateful if you could ___(4)___ a review on our website.\n\nBest regards,\nThe TechMart Team',
        'What is the best word for blank (4)?',
        'leave',
        'leaving',
        'left',
        'to leave',
        'A',
        'Đáp án đúng là A. Sau \"could\" cần dùng động từ nguyên mẫu \"leave\".'
    ],

    // Passage 2 - Questions 5-8 (Add more passages as needed)
    // ... (You can add 3 more passages with 4 questions each)
];

// Create worksheet
const ws = XLSX.utils.aoa_to_sheet(part6Data);

// Set column widths
ws['!cols'] = [
    { wch: 80 }, // passage
    { wch: 40 }, // questionText
    { wch: 20 }, // optionA
    { wch: 20 }, // optionB
    { wch: 20 }, // optionC
    { wch: 20 }, // optionD
    { wch: 15 }, // correctAnswer
    { wch: 60 }  // explanation
];

// Add worksheet to workbook
XLSX.utils.book_append_sheet(wb, ws, 'Part6');

// Write file
const path = require('path');
const outputPath = path.join(__dirname, '..', 'toeic_practice_admin', 'public', 'templates', 'part6_template.xlsx');
XLSX.writeFile(wb, outputPath);

console.log('✅ Part 6 template created successfully at:', outputPath);
