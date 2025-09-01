import * as fs from 'fs-extra';
import * as path from 'path';
import puppeteer from 'puppeteer';
import * as XLSX from 'xlsx';
import { exec } from 'child_process';
import { FBTeamMember, ReportOptions } from './types';
import { FreshBooksAPI } from './freshbooks-api';
import {
  calculateLoggedHours,
  countWeekdays,
  getNoteValue,
  checkOOOStatus,
  formatDate,
  formatTime,
  escapeHtml
} from './utils';
import {TokenManager} from "./token-manager";

export class ReportGenerator {
  private api: FreshBooksAPI;
  private readonly teamMembers: FBTeamMember[];
  private options: ReportOptions;
  private readonly minimumHoursPerMonth: number;
  private readonly tokenManager?: TokenManager;

  constructor(api: FreshBooksAPI, teamMembers: FBTeamMember[], options: ReportOptions, minimumHoursPerMonth = 160, tokenManager?: TokenManager) {
    this.api = api;
    this.teamMembers = teamMembers;
    this.options = options;
    this.minimumHoursPerMonth = minimumHoursPerMonth;
    this.tokenManager = tokenManager;
  }

  async generateReport(): Promise<void> {
    console.log('\nStarting FreshBooks Time Report Generation...\n');

    const countOfDays = countWeekdays(this.options.startDate, this.options.endDate, this.options.range);
    const totalExpectedHours = countOfDays < 20 ? (countOfDays * 8) : this.minimumHoursPerMonth;

    const results: Array<{
      member: FBTeamMember;
      hours: number;
      note: string;
      oooStatus: boolean;
    }> = [];

    let totalHoursSum = 0;
    let processedCount = 0;

    for (let i = 0; i < this.teamMembers.length; i++) {
      const member = this.teamMembers[i];

      try {
        const endDate = this.options.range ? this.options.endDate : this.options.startDate;

        if (!member.identity_id) {
          console.log(`⚠️ Skipping ${member.first_name} ${member.last_name} - no identity_id`);
          continue;
        }

        processedCount++;

        let response;
        try {
          response = await this.api.fetchTimeEntries(member.identity_id.toString(), this.options.startDate, endDate);
        } catch (apiError) {
          if (apiError instanceof Error && apiError.message.includes('Access token is invalid or expired') && this.tokenManager) {
            console.log('\n🔑 Token expired during report generation, requesting new authorization...');
            await this.tokenManager.handleExpiredToken();
            response = await this.api.fetchTimeEntries(member.identity_id.toString(), this.options.startDate, endDate);
          } else {
            throw apiError;
          }
        }

        const totalLoggedHours = calculateLoggedHours(response.meta.total_logged || 0);
        const note = this.options.range ? '' : getNoteValue(response);
        const oooStatus = checkOOOStatus(response, totalLoggedHours, this.options.range);

        totalHoursSum += totalLoggedHours;

        results.push({
          member,
          hours: totalLoggedHours,
          note,
          oooStatus
        });

        this.displayMemberResult(member, totalLoggedHours, note, oooStatus, totalExpectedHours);
        this.showBottomProgress(processedCount, this.teamMembers.length);

      } catch (error) {
        console.error(`  👤 ${member.first_name} ${member.last_name} .................. ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);

        results.push({
          member,
          hours: 0,
          note: 'API Error',
          oooStatus: false
        });
      }
    }

    this.showProgress(processedCount, this.teamMembers.length);
    console.log('\n✅ Report generation completed successfully!\n');

    // Show member breakdown summary
    const skippedCount = this.teamMembers.length - processedCount;
    console.log(`📊 Member Summary:`);
    console.log(`   • ${processedCount} members with identity_id processed`);
    if (skippedCount > 0) {
      console.log(`   • ${skippedCount} members skipped (no identity_id)`);
    }
    console.log(`   • ${this.teamMembers.length} total members found\n`);

    if (this.options.range) {
      console.log(`Minimum Expected Hours: ${totalExpectedHours}`);
    }

    await this.generateOutputFiles(results, totalHoursSum, countOfDays, totalExpectedHours);
  }

  private displayMemberResult(member: FBTeamMember, hours: number, note: string, oooStatus: boolean, expectedHours: number): void {
    const fullName = `${member.first_name} ${member.last_name}`;
    const dots = '.'.repeat(Math.max(3, 45 - fullName.length));

    let color = '\x1b[31m'; // Red
    if (this.options.range) {
      if (hours >= expectedHours) color = '\x1b[32m'; // Green
      else if (hours > 0) color = '\x1b[33m'; // Yellow
    } else {
      if (hours > 0) color = '\x1b[33m'; // Yellow
    }

    const resetColor = '\x1b[0m';
    const grayColor = '\x1b[90m';
    const blueColor = '\x1b[34m';

    let output = `  ${blueColor}👤${resetColor} ${fullName} ${grayColor}${dots}${resetColor} ${color}${hours}h${resetColor}`;

    if (!this.options.range && note) {
      output += ` Note: ${note}`;
    }

    if (oooStatus) {
      output += ' ✅     ';
    }

    if (!this.options.range && hours > 0) {
      output += ' ⚠️';
    }

    console.log(output);
  }

  private showBottomProgress(current: number, total: number): void {
    const percentage = Math.floor((current * 100) / total);
    // Simple progress display on same line, then newline
    console.log(`Progress: (${percentage}%)`);
  }

  private showProgress(current: number, total: number): void {
    if (current === total) {
      console.log(`\x1b[32m✅ Completed\x1b[0m │ \x1b[33m${current}\x1b[0m/\x1b[33m${total}\x1b[0m team members processed`);
    }
  }

  private groupResults(results: Array<{ member: FBTeamMember; hours: number; note: string; oooStatus: boolean }>) {
    const workedHours: typeof results = [];
    const ooo: typeof results = [];
    const other: typeof results = [];

    for (const result of results) {
      if (result.hours > 0) {
        workedHours.push(result);
      } else if (result.oooStatus
          || result.note.toLowerCase().includes('ooo')
          || result.note.toLowerCase().includes('out of office')) {
        ooo.push(result);
      } else {
        other.push(result);
      }
    }

    return { workedHours, ooo, other };
  }

  private async generateOutputFiles(
    results: Array<{ member: FBTeamMember; hours: number; note: string; oooStatus: boolean }>,
    totalHours: number,
    countOfDays: number,
    totalExpectedHours: number
  ): Promise<void> {
    const dateStr = this.options.range ? this.options.endDate : this.options.startDate;

    if (this.options.outputFormats.includes('csv')) {
      await this.generateExcel(results, dateStr);
    }

    if (this.options.outputFormats.includes('html')) {
      await this.generatePDF(results, totalHours, countOfDays, totalExpectedHours, dateStr);
    }
  }

  private async generateExcel(results: Array<{ member: FBTeamMember; hours: number; note: string; oooStatus: boolean }>, dateStr: string): Promise<void> {
    const filename = `freshbooks-time-report-${dateStr}.xlsx`;

    const excelData = [];

    if (this.options.range) {
        excelData.push(['First Name', 'Last Name', 'Total Logged Hours']);
      for (const result of results) {
        const { member, hours } = result;
          excelData.push([member.first_name, member.last_name, hours]);
      }
    } else {
        excelData.push(['First Name', 'Last Name', 'Total Logged Hours', 'Note']);
      for (const result of results) {
        const { member, hours, note } = result;
          excelData.push([member.first_name, member.last_name, hours, note]);
      }
    }

    const worksheet = XLSX.utils.aoa_to_sheet(excelData);

    const hoursColumnIndex = this.options.range ? 2 : 2; // Column C (0-based index 2)
    const range = XLSX.utils.decode_range(worksheet['!ref']!);

    for (let row = range.s.r; row <= range.e.r; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: hoursColumnIndex });
      if (!worksheet[cellAddress]) continue;

      if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
      worksheet[cellAddress].s.alignment = { horizontal: 'center' };
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Time Report');

    await XLSX.writeFile(workbook, filename);
    console.log(`📄 Excel Report saved to: ${filename}`);
  }

  private async generatePDF(
    results: Array<{ member: FBTeamMember; hours: number; note: string; oooStatus: boolean }>,
    totalHours: number,
    countOfDays: number,
    totalExpectedHours: number,
    dateStr: string
  ): Promise<void> {
    const filename = `freshbooks-time-report-${dateStr}.pdf`;
    const title = this.options.range
      ? `FreshBooks Time Report - ${this.options.startDate} to ${this.options.endDate}`
      : `FreshBooks Time Report - ${this.options.startDate}`;

    const htmlContent = this.generateHTMLContent(results, totalHours, countOfDays, totalExpectedHours, title);

    try {
      console.log('⏳ Generating PDF...');
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();

      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      });

      await browser.close();
      await fs.writeFile(filename, pdf);

      console.log(`PDF Report saved to: ${filename}`);

      // Try to open in browser/default PDF viewer
      const fullPath = path.resolve(filename);
      console.log(`PDF Report path: ${fullPath}`);

      try {
        if (process.platform === 'darwin') {
          exec(`open "${fullPath}"`);
        } else if (process.platform === 'win32') {
          exec(`start "${fullPath}"`);
        } else {
          exec(`xdg-open "${fullPath}"`);
        }
        console.log('Opening PDF report...');
      } catch (error) {
        console.log('Could not auto-open PDF. Please manually open the file.', error);
      }
    } catch (error) {
      console.error('❌ Error generating PDF:', error instanceof Error ? error.message : 'Unknown error');
      console.log('Falling back to HTML generation...');

      // Fallback to HTML if PDF generation fails
      const htmlFilename = `freshbooks-time-report-${dateStr}.html`;
      await fs.writeFile(htmlFilename, htmlContent);
      console.log(`HTML Report saved to: ${htmlFilename}`);
    }
  }

  private generateHTMLContent(
    results: Array<{ member: FBTeamMember; hours: number; note: string; oooStatus: boolean }>,
    totalHours: number,
    countOfDays: number,
    totalExpectedHours: number,
    title: string
  ): string {
    const currentDate = new Date();
    const formattedDate = formatDate(currentDate);
    const formattedTime = formatTime(currentDate);

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: #ffffff; 
            color: #1a202c; 
            line-height: 1.5;
            padding: 0;
        }
        .container { 
            max-width: 210mm; 
            margin: 0 auto; 
            background: white; 
            padding: 15mm;
        }
        
        .header { 
            margin-bottom: 25px; 
            padding-bottom: 15px;
            border-bottom: 2px solid #2563eb;
        }
        .header h1 { 
            font-size: 24px; 
            color: #2563eb; 
            font-weight: 600; 
            margin-bottom: 4px;
            letter-spacing: -0.3px;
        }
        .header .subtitle { 
            font-size: 13px; 
            color: #64748b; 
            font-weight: 400;
        }
        
        .meta-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding: 12px 0;
            border-bottom: 1px solid #e2e8f0;
        }
        .date-info {
            font-size: 13px;
            color: #475569;
            font-weight: 500;
        }
        .report-id {
            font-size: 11px;
            color: #94a3b8;
            font-family: 'Courier New', monospace;
        }
        
        .stats { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); 
            gap: 15px; 
            margin-bottom: 25px;
        }
        .stat-card { 
            background: #f8fafc; 
            border: 1px solid #e2e8f0;
            padding: 16px; 
            border-radius: 6px; 
            text-align: center;
        }
        .stat-number { 
            font-size: 20px; 
            font-weight: 700; 
            color: #1e293b;
            margin-bottom: 3px;
        }
        .stat-label { 
            font-size: 11px; 
            color: #64748b;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }
        
        .table-container { 
            border: 1px solid #e2e8f0;
            border-radius: 6px; 
            overflow: hidden; 
            margin-bottom: 25px;
        }
        table { width: 100%; border-collapse: collapse; }
        th { 
            background: #f1f5f9; 
            padding: 12px 14px; 
            text-align: left; 
            font-weight: 600; 
            color: #334155; 
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            border-bottom: 1px solid #cbd5e1;
        }
        td { 
            padding: 10px 14px; 
            border-bottom: 1px solid #f1f5f9; 
            vertical-align: middle;
            font-size: 13px;
        }
        tr:last-child td { border-bottom: none; }
        
        .hours-cell { font-weight: 600; }
        .hours-good { color: #059669; }
        .hours-partial { color: #d97706; }
        .hours-none { color: #dc2626; }
        
        .highlight-row { 
            background-color: #fef3c7 !important; 
            border-left: 3px solid #f59e0b;
        }
        
        .group-header { 
            background-color: #e2e8f0 !important; 
            font-weight: 600;
            color: #475569;
        }
        .group-header td {
            padding: 8px 14px;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }
        
        .note-cell { 
            max-width: 200px; 
            word-wrap: break-word; 
            color: #64748b; 
            font-size: 12px;
            line-height: 1.4;
        }
        
        .warning-badge { 
            color: #ea580c; 
            font-size: 13px; 
            margin-left: 5px;
        }
        
        .footer { 
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #e2e8f0;
            text-align: center; 
            color: #94a3b8; 
            font-size: 10px;
            line-height: 1.5;
        }
        .footer a {
            color: #2563eb;
            text-decoration: none;
            font-weight: 500;
        }
        .footer a:hover {
            text-decoration: underline;
        }
        
        /* Print optimizations */
        @media print {
            .container { padding: 10mm; }
            .header h1 { font-size: 20px; }
            .stat-number { font-size: 18px; }
            th, td { padding: 8px 10px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 ${title}</h1>
        </div>
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${results.length}</div>
                <div class="stat-label">Team Members</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalHours}</div>
                <div class="stat-label">Total Hours Logged</div>
            </div>`;

    if (this.options.range) {
      html += `
            <div class="stat-card">
                <div class="stat-number">${countOfDays}</div>
                <div class="stat-label">Working Days</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalExpectedHours}</div>
                <div class="stat-label">Minimum Expected Hours</div>
            </div>`;
    }

    html += `
        </div>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>👤 Team Member</th>
                        <th>⏰ Hours Logged</th>`;

    if (!this.options.range) {
      html += `
                        <th>📝 Note</th>`;
    }

    html += `
                    </tr>
                </thead>
                <tbody>`;

    // Group results for better organization
    const groupedResults = this.groupResults(results);

    // Display groups in order: worked hours first, then OOO, then others
    const orderedGroups = [
      { title: '💼 Worked Hours', results: groupedResults.workedHours, highlight: !this.options.range },
      { title: '🏖️ Out of Office', results: groupedResults.ooo, highlight: false },
      { title: '❓ No Hours / Other', results: groupedResults.other, highlight: false }
    ].filter(group => group.results.length > 0);

    for (const group of orderedGroups) {
      if (orderedGroups.length > 1) {
        html += `
                    <tr class="group-header">
                        <td colspan="${this.options.range ? 2 : 3}"><strong>${group.title}</strong></td>
                    </tr>`;
      }

      for (const result of group.results) {
        const { member, hours, note } = result;

        let hourClass = 'hours-none';
        let rowClass = '';

        if (this.options.range) {
          if (hours >= totalExpectedHours) hourClass = 'hours-good';
          else if (hours > 0) hourClass = 'hours-partial';
        } else {
          if (hours > 0) {
            hourClass = 'hours-partial';
            rowClass = 'highlight-row'; // Highlight rows with >0 hours for single day
          }
        }

        html += `
                    <tr class="${rowClass}">
                        <td><strong>${member.first_name} ${member.last_name}</strong></td>
                        <td class="hours-cell ${hourClass}">${hours}h`;

        if (!this.options.range && hours > 0) {
          html += '<span class="warning-badge">⚠️</span>';
        }

        html += '</td>';

        if (!this.options.range) {
          html += `
                        <td class="note-cell">${escapeHtml(note)}</td>`;
        }

        html += `
                    </tr>`;
      }
    }

    html += `
                </tbody>
            </table>
        </div>
        <div class="footer">
            Generated on ${formattedDate} at ${formattedTime} | by Josue Hidalgo Ramírez via <a href="https://github.com/josuebass09/freshbook-time-checker" target="_blank">FreshBooks Time Checker</a>
        </div>
    </div>
</body>
</html>`;

    return html;
  }
}
