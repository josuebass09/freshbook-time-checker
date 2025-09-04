import dotenv from 'dotenv';
import { Config } from './types';

dotenv.config();

export const config: Config = {
  clientId: process.env.FRESHBOOKS_CLIENT_ID || '',
  clientSecret: process.env.FRESHBOOKS_CLIENT_SECRET || '',
  redirectUri: process.env.FRESHBOOKS_REDIRECT_URI || '',
  businessId: process.env.FRESHBOOKS_BUSINESS_ID || '',
  accessToken: process.env.FRESHBOOKS_ACCESS_TOKEN || '',
  refreshToken: process.env.FRESHBOOKS_REFRESH_TOKEN || '',
  baseUrl: process.env.FRESHBOOKS_BASE_URL || ''
};

export function validateConfig(): void {
  const required = ['clientId', 'clientSecret', 'redirectUri', 'businessId'];

  for (const key of required) {
    if (!config[key as keyof Config]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}
