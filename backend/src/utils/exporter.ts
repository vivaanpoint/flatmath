import PDFDocument from 'pdfkit';
import XLSX from 'xlsx';
import { Response } from 'express';

interface ExpenseReportItem {
  date: string;
  title: string;
  category: string;
  paidBy: string;
  amount: number;
  status: string;
}

export class Exporter {
  static exportExcel(res: Response, filename: string, data: ExpenseReportItem[]) {
    // Convert data to worksheet
    const worksheet = XLSX.utils.json_to_sheet(
      data.map((item) => ({
        Date: item.date,
        Title: item.title,
        Category: item.category,
        'Paid By': item.paidBy,
        Amount: item.amount,
        Status: item.status,
      }))
    );

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');

    // Set headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);

    // Write to buffer and send
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return res.send(buffer);
  }

  static exportPDF(
    res: Response,
    title: string,
    householdName: string,
    stats: { total: number; members: number; avg: number },
    data: ExpenseReportItem[]
  ) {
    const doc = new PDFDocument({ margin: 50 });

    // Stream PDF directly to Express response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${title}.pdf`);
    doc.pipe(res);

    // Header
    doc
      .fontSize(24)
      .fillColor('#2563eb')
      .text('FlatMate Ledger - Expense Report', { align: 'center' })
      .moveDown(0.2);

    doc
      .fontSize(12)
      .fillColor('#4b5563')
      .text(`Household: ${householdName}`, { align: 'center' })
      .text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' })
      .moveDown(1.5);

    // Summary Card
    doc
      .fillColor('#f3f4f6')
      .rect(50, 120, 512, 60)
      .fill()
      .fillColor('#1f2937')
      .fontSize(10)
      .text(`Total Household Expenses: INR ${stats.total.toFixed(2)}`, 70, 135)
      .text(`Active Roommates: ${stats.members}`, 70, 155)
      .text(`Average Monthly Spend: INR ${stats.avg.toFixed(2)}`, 320, 135)
      .moveDown(2);

    // Table Header
    let y = 210;
    doc
      .fontSize(10)
      .fillColor('#ffffff')
      .rect(50, y, 512, 20)
      .fill('#2563eb');

    doc
      .fillColor('#ffffff')
      .text('Date', 60, y + 5)
      .text('Expense Title', 130, y + 5)
      .text('Category', 280, y + 5)
      .text('Paid By', 370, y + 5)
      .text('Amount', 450, y + 5)
      .text('Status', 510, y + 5);

    y += 20;

    // Table Rows
    let isRowEven = false;
    for (const item of data) {
      if (y > 700) {
        doc.addPage();
        y = 50;

        // Re-draw headers on new page
        doc
          .fillColor('#2563eb')
          .rect(50, y, 512, 20)
          .fill();
        doc
          .fillColor('#ffffff')
          .text('Date', 60, y + 5)
          .text('Expense Title', 130, y + 5)
          .text('Category', 280, y + 5)
          .text('Paid By', 370, y + 5)
          .text('Amount', 450, y + 5)
          .text('Status', 510, y + 5);
        y += 20;
      }

      // Zebra striping
      doc
        .fillColor(isRowEven ? '#f9fafb' : '#ffffff')
        .rect(50, y, 512, 18)
        .fill();

      doc
        .fillColor('#374151')
        .text(item.date, 60, y + 4)
        .text(item.title.substring(0, 24), 130, y + 4)
        .text(item.category, 280, y + 4)
        .text(item.paidBy.substring(0, 12), 370, y + 4)
        .text(`INR ${item.amount.toFixed(2)}`, 450, y + 4)
        .fillColor(item.status === 'APPROVED' ? '#10b981' : item.status === 'REJECTED' ? '#ef4444' : '#f59e0b')
        .text(item.status, 510, y + 4);

      y += 18;
      isRowEven = !isRowEven;
    }

    doc.end();
  }
}
