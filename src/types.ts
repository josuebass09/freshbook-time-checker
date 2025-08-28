export interface FBTeamMember {
  identity_id: string;
  first_name: string;
  last_name: string;
}

export interface FBTeamMembersResponse {
  users: FBTeamMember[];
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
  error?: string;
}

export interface Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  businessId: string;
  accessToken: string;
}

export interface ReportOptions {
  startDate: string;
  endDate: string;
  range: boolean;
  outputFormats: ('csv' | 'html')[];
}
