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

          const refreshToken = this.api.getRefreshToken();
          await this.updateEnvFile(accessToken, refreshToken);
          console.log('✅ Access token and refresh token updated in .env file');

          this.api.setAccessToken(accessToken);

          resolve(accessToken);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async handleExpiredToken(): Promise<void> {
    // First try to refresh using refresh token
    if (this.api.getRefreshToken()) {
      try {
        console.log('\n🔄 Attempting to refresh access token...');
        const newAccessToken = await this.api.refreshAccessToken();
        const newRefreshToken = this.api.getRefreshToken();

        await this.updateEnvFile(newAccessToken, newRefreshToken);
        console.log('✅ Access token refreshed successfully');
        return;
      } catch (error) {
        console.log('⚠️  Refresh token failed, falling back to authorization code...', error);
      }
    }

    console.log('\n⚠️  Access token is invalid or expired. Please provide a new authorization code.');
    console.log('💡 To get a new authorization code, visit your FreshBooks OAuth authorization URL.');

    await this.generateAndSaveToken();
  }

  private async updateEnvFile(accessToken: string, refreshToken?: string): Promise<void> {
    try {
      let envContent = await fs.readFile(this.envPath, 'utf8');

      const accessTokenRegex = /^FRESHBOOKS_ACCESS_TOKEN=.*$/m;
      const refreshTokenRegex = /^FRESHBOOKS_REFRESH_TOKEN=.*$/m;

      const newAccessTokenLine = `FRESHBOOKS_ACCESS_TOKEN=${accessToken}`;

      if (accessTokenRegex.test(envContent)) {
        envContent = envContent.replace(accessTokenRegex, newAccessTokenLine);
      } else {
        envContent += `\n${newAccessTokenLine}\n`;
      }

      if (refreshToken) {
        const newRefreshTokenLine = `FRESHBOOKS_REFRESH_TOKEN=${refreshToken}`;

        if (refreshTokenRegex.test(envContent)) {
          envContent = envContent.replace(refreshTokenRegex, newRefreshTokenLine);
        } else {
          envContent += `${newRefreshTokenLine}\n`;
        }
      }

      await fs.writeFile(this.envPath, envContent);
    } catch (error) {
      throw new Error(`Failed to update .env file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async hasValidToken(): Promise<boolean> {
    const token = this.api.getAccessToken();
    return !(!token || token.trim() === '');
  }
}
