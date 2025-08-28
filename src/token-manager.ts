import * as fs from 'fs-extra';
import * as path from 'path';
import * as readline from 'readline';
import { FreshBooksAPI } from './freshbooks-api';

export class TokenManager {
  private api: FreshBooksAPI;
  private readonly envPath: string;

  constructor(api: FreshBooksAPI) {
    this.api = api;
    this.envPath = path.join(process.cwd(), '.env');
  }

  async generateAndSaveToken(): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve, reject) => {
      rl.question('Please enter the authorization code: ', async (code) => {
        rl.close();

        try {
          console.log('\n🔄 Generating access token...');
          const accessToken = await this.api.generateAccessToken(code);

          console.log(`✅ Access token generated: ${accessToken}`);

          await this.updateEnvFile(accessToken);
          console.log('✅ Access token updated in .env file');

          resolve(accessToken);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private async updateEnvFile(accessToken: string): Promise<void> {
    try {
      let envContent = await fs.readFile(this.envPath, 'utf8');

      const tokenRegex = /^FRESHBOOKS_ACCESS_TOKEN=.*$/m;
      const newTokenLine = `FRESHBOOKS_ACCESS_TOKEN=${accessToken}`;

      if (tokenRegex.test(envContent)) {
        envContent = envContent.replace(tokenRegex, newTokenLine);
      } else {
        envContent += `\n${newTokenLine}\n`;
      }

      await fs.writeFile(this.envPath, envContent);
    } catch (error) {
      throw new Error(`Failed to update .env file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async hasValidToken(): Promise<boolean> {
    const token = this.api.getAccessToken();
    if (!token || token.trim() === '') {
      return false;
    }

    // Test the token by making a simple API call
    try {
      // We'll try to fetch time entries with a minimal request to test token validity
      return true; // For now, just check if token exists - we can enhance this later
    } catch (error) {
      return false;
    }
  }
}
