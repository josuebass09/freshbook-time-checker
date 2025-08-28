import axios from 'axios';
import { config } from './config';
import { FBTokenResponse, FBTimeEntriesResponse, FBTeamMembersResponse } from './types';

export class FreshBooksAPI {
  private accessToken: string;

  constructor(accessToken?: string) {
    this.accessToken = accessToken || config.accessToken;
  }

  async generateAccessToken(code: string): Promise<string> {
    const response = await axios.post<FBTokenResponse>('https://api.freshbooks.com/auth/oauth/token', {
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      transformRequest: [(data) => {
        return Object.keys(data)
          .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
          .join('&');
      }]
    });

    if (response.data.error || !response.data.access_token) {
      throw new Error('Code expired or is not valid');
    }

    this.accessToken = response.data.access_token;
    return response.data.access_token;
  }

  async fetchTimeEntries(identityId: string, startDate: string, endDate: string): Promise<FBTimeEntriesResponse> {
    if (!this.accessToken) {
      throw new Error('Access token is required');
    }

    const startParam = `${startDate}T00:00:00Z`;
    const endParam = `${endDate}T23:59:59Z`;

    const url = `https://api.freshbooks.com/timetracking/business/${config.businessId}/time_entries`;

    const response = await axios.get<FBTimeEntriesResponse>(url, {
      params: {
        started_from: startParam,
        started_to: endParam,
        team: true,
        identity_id: identityId
      },
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.message?.includes('The server could not verify that you are authorized')) {
      throw new Error('You are not allowed to access this resource, ensure you have a valid token.');
    }

    return response.data;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  getAccessToken(): string {
    return this.accessToken;
  }

  async fetchTeamMembers(): Promise<FBTeamMembersResponse> {
    if (!this.accessToken) {
      throw new Error('Access token is required');
    }

    const url = `https://api.freshbooks.com/auth/api/v1/users/me`;
    
    try {
      // First get the current user to understand the business structure
      const meResponse = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Then fetch business users/team members
      const businessUrl = `https://api.freshbooks.com/auth/api/v1/users`;
      const teamResponse = await axios.get<FBTeamMembersResponse>(businessUrl, {
        params: {
          business_id: config.businessId
        },
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!teamResponse.data.users) {
        throw new Error('No team members found in API response');
      }

      return teamResponse.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Access token is invalid or expired');
        }
        throw new Error(`Failed to fetch team members: ${error.response?.data?.message || error.message}`);
      }
      throw new Error(`Failed to fetch team members: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
