import * as fs from 'fs-extra';
import * as path from 'path';
import { FBTeamMember, ReportOptions } from './types';
import { FreshBooksAPI } from './freshbooks-api';
import {
  calculateLoggedHours,
  countWeekdays,
  getNoteValue,
  checkOOOStatus,
  formatDate,
  formatTime,
  escapeHtml,
  escapeCsv
} from './utils';

export class ReportGenerator {
  private api: FreshBooksAPI;
  private readonly teamMembers: FBTeamMember[];
  private options: ReportOptions;
  private readonly minimumHoursPerMonth: number;

  constructor(api: FreshBooksAPI, teamMembers: FBTeamMember[], options: ReportOptions, minimumHoursPerMonth = 160) {
    this.api = api;
    this.teamMembers = teamMembers;
    this.options = options;
    this.minimumHoursPerMonth = minimumHoursPerMonth;
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

    for (let i = 0; i < this.teamMembers.length; i++) {
      const member = this.teamMembers[i];

      try {
        const endDate = this.options.range ? this.options.endDate : this.options.startDate;
        
        if (!member.identity_id) {
          console.log(`⚠️  Skipping ${member.first_name} ${member.last_name} - no identity_id`);
          continue;
        }

        const response = await this.api.fetchTimeEntries(member.identity_id.toString(), this.options.startDate, endDate);

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
        this.showBottomProgress(i + 1, this.teamMembers.length);

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

    this.showProgress(this.teamMembers.length, this.teamMembers.length);
    console.log('\n✅ Report generation completed successfully!\n');

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
    console.log(`Progress: ${current}/${total} (${percentage}%)`);
  }

  private showProgress(current: number, total: number): void {
    if (current === total) {
      console.log(`\x1b[32m✅ Completed\x1b[0m │ \x1b[33m${current}\x1b[0m/\x1b[33m${total}\x1b[0m team members processed`);
    }
  }

  private async generateOutputFiles(
    results: Array<{ member: FBTeamMember; hours: number; note: string; oooStatus: boolean }>,
    totalHours: number,
    countOfDays: number,
    totalExpectedHours: number
  ): Promise<void> {
    const dateStr = this.options.range ? this.options.endDate : this.options.startDate;

    if (this.options.outputFormats.includes('csv')) {
      await this.generateCSV(results, dateStr);
    }

    if (this.options.outputFormats.includes('html')) {
      await this.generateHTML(results, totalHours, countOfDays, totalExpectedHours, dateStr);
    }
  }

  private async generateCSV(results: Array<{ member: FBTeamMember; hours: number; note: string; oooStatus: boolean }>, dateStr: string): Promise<void> {
    const filename = `freshbooks-time-report-${dateStr}.csv`;

    let csvContent = this.options.range
      ? 'First Name,Last Name,Total Logged Hours\n'
      : 'First Name,Last Name,Total Logged Hours,Note\n';

    for (const result of results) {
      const { member, hours, note } = result;

      if (this.options.range) {
        csvContent += `${member.first_name},${member.last_name},${hours}\n`;
      } else {
        csvContent += `${member.first_name},${member.last_name},${hours},${escapeCsv(note)}\n`;
      }
    }

    await fs.writeFile(filename, csvContent);
    console.log(`📄 CSV Report saved to: ${filename}`);
  }

  private async generateHTML(
    results: Array<{ member: FBTeamMember; hours: number; note: string; oooStatus: boolean }>,
    totalHours: number,
    countOfDays: number,
    totalExpectedHours: number,
    dateStr: string
  ): Promise<void> {
    const filename = `freshbooks-time-report-${dateStr}.html`;
    const title = this.options.range
      ? `FreshBooks Time Report - ${this.options.startDate} to ${this.options.endDate}`
      : `FreshBooks Time Report - ${this.options.startDate}`;

    const htmlContent = this.generateHTMLContent(results, totalHours, countOfDays, totalExpectedHours, title);

    await fs.writeFile(filename, htmlContent);
    console.log(`HTML Report saved to: ${filename}`);

    // Try to open in browser
    const fullPath = path.resolve(filename);
    console.log(`HTML Report URL: file://${fullPath}`);

    try {
      const { exec } = require('child_process');
      if (process.platform === 'darwin') {
        exec(`open "${fullPath}"`);
      } else if (process.platform === 'win32') {
        exec(`start "${fullPath}"`);
      } else {
        exec(`xdg-open "${fullPath}"`);
      }
      console.log('Opening HTML report in browser...');
    } catch (error) {
      console.log('Could not auto-open browser. Please manually open the file.');
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
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 40px; text-align: center; }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; font-weight: 700; }
        .header p { font-size: 1.1rem; opacity: 0.9; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 30px 40px; background: #f8f9fa; border-bottom: 1px solid #e9ecef; }
        .stat-card { text-align: center; padding: 20px; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .stat-number { font-size: 2rem; font-weight: bold; color: #2c3e50; margin-bottom: 5px; }
        .stat-label { color: #6c757d; font-size: 0.9rem; }
        .table-container { padding: 40px; overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
        th { background: #f8f9fa; padding: 16px; text-align: left; font-weight: 600; color: #495057; border-bottom: 2px solid #dee2e6; }
        td { padding: 16px; border-bottom: 1px solid #dee2e6; vertical-align: middle; }
        tr:hover { background-color: #f8f9fa; }
        .hours-cell { font-weight: 600; font-size: 1rem; }
        .hours-good { color: #28a745; }
        .hours-partial { color: #ffc107; }
        .hours-none { color: #dc3545; }
        .note-cell { max-width: 300px; word-wrap: break-word; font-style: italic; color: #6c757d; }
        .ooo-badge { background: #28a745; color: white; padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 500; }
        .warning-badge { color: #fd7e14; font-size: 1.2rem; margin-left: 8px; }
        .footer { background: #f8f9fa; padding: 20px 40px; text-align: center; color: #6c757d; font-size: 0.9rem; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 FreshBooks Time Report</h1>
            <p>${title}</p>
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
                        <th>📝 Note</th>
                        <th>🏖️ Status</th>`;
    }

    html += `
                    </tr>
                </thead>
                <tbody>`;

    for (const result of results) {
      const { member, hours, note, oooStatus } = result;

      let hourClass = 'hours-none';
      if (this.options.range) {
        if (hours >= totalExpectedHours) hourClass = 'hours-good';
        else if (hours > 0) hourClass = 'hours-partial';
      } else {
        if (hours > 0) hourClass = 'hours-partial';
      }

      html += `
                    <tr>
                        <td><strong>${member.first_name} ${member.last_name}</strong></td>
                        <td class="hours-cell ${hourClass}">${hours}h`;

      if (!this.options.range && hours > 0) {
        html += '<span class="warning-badge">⚠️</span>';
      }

      html += '</td>';

      if (!this.options.range) {
        html += `
                        <td class="note-cell">${escapeHtml(note)}</td>
                        <td>`;

        if (oooStatus) {
          html += '<span class="ooo-badge">Out of Office</span>';
        }

        html += '</td>';
      }

      html += `
                    </tr>`;
    }

    html += `
                </tbody>
            </table>
        </div>
        <div class="footer">
            Generated on ${formattedDate} at ${formattedTime} | FreshBooks API Integration
        </div>
    </div>
</body>
</html>`;

    return html;
  }
}
