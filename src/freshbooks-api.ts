import axios from 'axios';
import { config } from './config';
import { FBTokenResponse, FBTimeEntriesResponse, FBTeamMembersResponse, FBTeamMembersAPIResponse } from './types';
const BASE_URL = 'https://api.freshbooks.com';
export class FreshBooksAPI {
  private accessToken: string;

  constructor(accessToken?: string) {
    this.accessToken = accessToken || config.accessToken;
  }

  async generateAccessToken(code: string): Promise<string> {
    const response = await axios.post<FBTokenResponse>(`${BASE_URL}/auth/oauth/token`, {
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

    const url = `${BASE_URL}/timetracking/business/${config.businessId}/time_entries`;

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

    const url = `${BASE_URL}/auth/api/v1/businesses/${config.businessId}/team_members`;

    try {
      const teamResponse = await axios.get<FBTeamMembersAPIResponse>(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!teamResponse.data.response || !Array.isArray(teamResponse.data.response)) {
        throw new Error('No team members found in API response');
      }

      const { response: users } = teamResponse.data;

      return { users };
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
