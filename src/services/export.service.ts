import { PrismaClient } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import PdfPrinter from 'pdfmake';
import { TDocumentDefinitions, Alignment } from 'pdfmake/interfaces';

const prisma = new PrismaClient();

export class ExportService {
    private printer: any;

    constructor() {
        // Standard fonts configuration for pdfmake
        const fonts = {
            Roboto: {
                normal: 'Helvetica',
                bold: 'Helvetica-Bold',
                italics: 'Helvetica-Oblique',
                bolditalics: 'Helvetica-BoldOblique'
            }
        };
        // @ts-ignore
        this.printer = new (PdfPrinter as any)(fonts);
    }

    /**
     * Generate Excel for Student Practice History
     */
    async generateStudentHistoryExcel(studentId: string): Promise<Buffer> {
        const student = await prisma.user.findUnique({
            where: { id: studentId },
            select: { name: true, username: true }
        });

        const history = await prisma.testAttempt.findMany({
            where: { userId: studentId },
            include: {
                test: { select: { title: true } },
                part: { select: { partName: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Lịch sử luyện tập');

        // Styles
        const headerStyle: Partial<ExcelJS.Style> = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } },
            alignment: { horizontal: 'center' }
        };

        // Student Info Header
        worksheet.mergeCells('A1:E1');
        worksheet.getCell('A1').value = `BÁO CÁO LỊCH SỬ LUYỆN TẬP - HỌC VIÊN: ${student?.name || 'N/A'} (${student?.username})`;
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };
        worksheet.addRow([]);

        // Table Header
        const headerRow = worksheet.addRow(['STT', 'Ngày làm', 'Nội dung', 'Số câu đúng', 'Điểm quy đổi']);
        headerRow.eachCell((cell) => {
            cell.style = headerStyle;
        });

        // Data Rows
        history.forEach((attempt, index) => {
            const row = worksheet.addRow([
                index + 1,
                attempt.createdAt.toLocaleDateString('vi-VN'),
                attempt.test?.title || attempt.part?.partName || 'Luyện tập lẻ',
                `${attempt.correctCount}/${attempt.totalQuestions}`,
                attempt.totalScore || 0
            ]);
            row.getCell(1).alignment = { horizontal: 'center' };
            row.getCell(4).alignment = { horizontal: 'center' };
            row.getCell(5).alignment = { horizontal: 'center' };
        });

        // Column Widths
        worksheet.getColumn(1).width = 8;
        worksheet.getColumn(2).width = 15;
        worksheet.getColumn(3).width = 40;
        worksheet.getColumn(4).width = 15;
        worksheet.getColumn(5).width = 15;

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    /**
     * Generate PDF for Student Practice History
     */
    async generateStudentHistoryPdf(studentId: string): Promise<any> {
        const student = await prisma.user.findUnique({
            where: { id: studentId },
            select: { name: true, username: true, estimatedScore: true }
        });

        const history = await prisma.testAttempt.findMany({
            where: { userId: studentId },
            include: {
                test: { select: { title: true } },
                part: { select: { partName: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const centerAlign: Alignment = 'center';

        const docDefinition: TDocumentDefinitions = {
            content: [
                { text: 'ANTIGRAVITY TOEIC LEARNING SYSTEM', style: 'header', alignment: centerAlign },
                { text: 'BÁO CÁO KẾT QUẢ LUYỆN TẬP HỌC VIÊN', style: 'subheader', alignment: centerAlign, margin: [0, 0, 0, 20] },
                
                {
                    columns: [
                        { text: `Họ tên: ${student?.name}`, bold: true },
                        { text: `Mã HV: ${student?.username}`, bold: true },
                        { text: `Điểm hiện tại: ${student?.estimatedScore || 0}`, bold: true, color: '#1E3A8A' }
                    ],
                    margin: [0, 0, 0, 20]
                },

                {
                    table: {
                        headerRows: 1,
                        widths: [30, 80, '*', 70, 70] as (number | string)[],
                        body: [
                            [
                                { text: 'STT', style: 'tableHeader' },
                                { text: 'Ngày làm', style: 'tableHeader' },
                                { text: 'Nội dung', style: 'tableHeader' },
                                { text: 'Số câu đúng', style: 'tableHeader' },
                                { text: 'Điểm', style: 'tableHeader' }
                            ],
                            ...history.map((a, i) => [
                                { text: (i + 1).toString(), alignment: centerAlign },
                                a.createdAt.toLocaleDateString('vi-VN'),
                                a.test?.title || a.part?.partName || 'Luyện tập lẻ',
                                { text: `${a.correctCount}/${a.totalQuestions}`, alignment: centerAlign },
                                { text: (a.totalScore || 0).toString(), alignment: centerAlign, bold: true }
                            ])
                        ]
                    },
                    layout: 'lightHorizontalLines'
                }
            ],
            styles: {
                header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10], color: '#1E3A8A' },
                subheader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
                tableHeader: { bold: true, fontSize: 12, color: 'black', fillColor: '#F3F4F6', alignment: centerAlign, margin: [0, 5, 0, 5] }
            },
            defaultStyle: {
                font: 'Roboto'
            }
        };

        return this.printer.createPdfKitDocument(docDefinition);
    }
}
