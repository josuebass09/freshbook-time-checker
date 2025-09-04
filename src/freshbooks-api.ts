import axios from 'axios';
import { config } from './config';
import {
    FBTokenResponse,
    FBTimeEntriesResponse,
    FBTeamMembersResponse,
    FBTeamMembersAPIResponse,
    GrantType
} from './types';

export class FreshBooksAPI {
  private _accessToken: string;
  private _refreshToken: string;
  private static readonly BASE_URL = config.baseUrl;
  private static readonly BUSINESS_ID = config.businessId;

  constructor(accessToken: string, refreshToken?: string) {
    this._accessToken = accessToken;
    this._refreshToken = refreshToken || '';
  }

  async generateAccessToken(code: string): Promise<string> {
      const endpoint = `${FreshBooksAPI.BASE_URL}/auth/oauth/token`;
      const response = await axios.post<FBTokenResponse>(endpoint, {
      grant_type: GrantType.AUTHORIZATION_CODE,
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

    this._accessToken = response.data.access_token;
    if (response.data.refresh_token) {
      this._refreshToken = response.data.refresh_token;
    }

    return response.data.access_token;
  }

  async fetchTimeEntries(identityId: string, startDate: string, endDate: string): Promise<FBTimeEntriesResponse> {
    if (!this._accessToken) {
      throw new Error('Access token is required');
    }

    const startParam = `${startDate}T00:00:00Z`;
    const endParam = `${endDate}T23:59:59Z`;

    const url = `${FreshBooksAPI.BASE_URL}/timetracking/business/${FreshBooksAPI.BUSINESS_ID}/time_entries`;

    const response = await axios.get<FBTimeEntriesResponse>(url, {
      params: {
        started_from: startParam,
        started_to: endParam,
        team: true,
        identity_id: identityId
      },
      headers: {
        'Authorization': `Bearer ${this._accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.message?.includes('The server could not verify that you are authorized')) {
      throw new Error('You are not allowed to access this resource, ensure you have a valid token.');
    }

    return response.data;
  }

  async refreshAccessToken(): Promise<{ accessToken: string; refreshToken?: string }> {
    if (!this._refreshToken) {
      throw new Error('No refresh token available');
    }
    const payload = {
        grant_type: GrantType.REFRESH_TOKEN,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: this._refreshToken
    };
    const endpoint = `${FreshBooksAPI.BASE_URL}/auth/oauth/token`;
    const response = await axios.post<FBTokenResponse>(
        endpoint,
        payload, {
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
      throw new Error('Failed to refresh token');
    }

    this._accessToken = response.data.access_token;
    let newRefreshToken = undefined;
    if (response.data.refresh_token) {
      this._refreshToken = response.data.refresh_token;
      newRefreshToken = response.data.refresh_token;
    }

    return {
      accessToken: this._accessToken,
      refreshToken: newRefreshToken
    };
  }

  setAccessToken(token: string): void {
    this._accessToken = token;
  }

  setRefreshToken(token: string): void {
    this._refreshToken = token;
  }

  accessToken(): string {
    return this._accessToken;
  }

  refreshToken(): string {
    return this._refreshToken;
  }

  async fetchTeamMembers(): Promise<FBTeamMembersResponse> {
    if (!this._accessToken) {
      throw new Error('Access token is required');
    }

    const endpoint = `${FreshBooksAPI.BASE_URL}/auth/api/v1/businesses/${FreshBooksAPI.BUSINESS_ID}/team_members`;

    try {
      const teamResponse = await axios.get<FBTeamMembersAPIResponse>(endpoint, {
        params: {
          active: true
        },
        headers: {
          'Authorization': `Bearer ${this._accessToken}`,
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
