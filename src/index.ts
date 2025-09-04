#!/usr/bin/env node

import { Command } from 'commander';
import { validateConfig } from './config';
import { FreshBooksAPI } from './freshbooks-api';
import { TokenManager } from './token-manager';
import { ReportGenerator } from './report-generator';
import { ReportOptions } from './types';
import { config } from './config';

const program = new Command();

program
  .name('freshbooks-checker')
  .description('FreshBooks time tracking checker')
  .version('1.0.0');

program
  .command('generate-token')
  .description('Generate a new access token from authorization code')
  .action(async () => {
    try {
      validateConfig();
      const accessToken = config.accessToken;
      const refreshToken = config.refreshToken;
      const api = new FreshBooksAPI(accessToken, refreshToken);
      const tokenManager = new TokenManager(api);

      await tokenManager.generateAndSaveToken();
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Main command - simplified single command for the entire flow
program
  .argument('<start-date>', 'Start date (YYYY-MM-DD)')
  .argument('[end-date]', 'End date (YYYY-MM-DD), defaults to start date')
  .option('-s, --single-day', 'Query only for start date (overrides end-date)')
  .option('--excel', 'Generate Excel output only')
  .option('--pdf', 'Generate PDF output only')
  .action(async (startDate: string, endDate: string = startDate, options: { singleDay?: boolean; excel?: boolean; pdf?: boolean }) => {
    try {
      validateConfig();

      const isRange = !options.singleDay && endDate !== startDate;
      const outputFormats: ('csv' | 'html')[] = [];

      // If no specific format is requested, generate both by default
      if (!options.excel && !options.pdf) {
        outputFormats.push('csv', 'html');
      } else {
        if (options.excel) outputFormats.push('csv');
        if (options.pdf) outputFormats.push('html');
      }

      validateDates(startDate, endDate);
      const accessToken = config.accessToken;
      const refreshToken = config.refreshToken;
      const api = new FreshBooksAPI(accessToken, refreshToken);
      const tokenManager = new TokenManager(api);

      if (!(await tokenManager.hasValidToken())) {
        console.log('⚠️  No valid access token found. Generating new token...');
        await tokenManager.generateAndSaveToken();
      }

      console.log('🔍 Fetching team members from FreshBooks API...');

      let teamMembersResponse;
      try {
        teamMembersResponse = await api.fetchTeamMembers();
      } catch (error) {
        if (error instanceof Error && error.message.includes('Access token is invalid or expired')) {
          console.log('🔑 Token expired, requesting new authorization...');
          await tokenManager.handleExpiredToken();
          teamMembersResponse = await api.fetchTeamMembers();
        } else {
          throw error;
        }
      }

      const teamMembers = teamMembersResponse.users;
      console.log(`👥 Found ${teamMembers.length} active team members`);

      const reportOptions: ReportOptions = {
        startDate,
        endDate: isRange ? endDate : startDate,
        range: isRange,
        outputFormats
      };

      const reportGenerator = new ReportGenerator(api, teamMembers, reportOptions, 160, tokenManager);
      await reportGenerator.generateReport();

    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

function validateDates(startDate: string, endDate: string): void {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!dateRegex.test(startDate)) {
    throw new Error('Start date must be in format YYYY-MM-DD');
  }

  if (!dateRegex.test(endDate)) {
    throw new Error('End date must be in format YYYY-MM-DD');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime())) {
    throw new Error('Invalid start date');
  }

  if (isNaN(end.getTime())) {
    throw new Error('Invalid end date');
  }

  if (start > end) {
    throw new Error('Start date must be before or equal to end date');
  }
}

program.parse();

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
