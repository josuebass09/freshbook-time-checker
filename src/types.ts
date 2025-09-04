export interface FBTeamMember {
  uuid: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  email: string;
  job_title?: string;
  street_1?: string;
  street_2?: string;
  city?: string;
  province?: string;
  country?: string;
  postal_code?: string;
  phone_number?: string;
  business_id: number;
  business_role_name: string;
  active: boolean;
  identity_id?: number;
  invitation_date_accepted?: string;
  created_at: string;
  updated_at: string;
}

export interface FBTeamMembersResponse {
  users: FBTeamMember[];
}

export interface FBTeamMembersAPIResponse {
  response: FBTeamMember[];
  meta: {
    page: number;
    per_page: number;
    total: number;
  };
}

export interface FBTimeEntry {
  note?: string;
  logged_duration: number;
}

export interface FBTimeEntriesResponse {
  time_entries: FBTimeEntry[];
  meta: {
    total_logged: number;
  };
  message?: string;
}

export interface FBTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
}

export interface Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  businessId: string;
  accessToken: string;
  refreshToken?: string;
  baseUrl: string;
}

export interface ReportOptions {
  startDate: string;
  endDate: string;
  range: boolean;
  outputFormats: ('csv' | 'html')[];
}

export enum GrantType {
    AUTHORIZATION_CODE = 'authorization_code',
    REFRESH_TOKEN = 'refresh_token'
}
