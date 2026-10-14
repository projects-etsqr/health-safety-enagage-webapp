export interface LoginRequest {
  employee_id: string;
  pin: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  must_change_password?: boolean;
  user: User;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface User {
  id: string;
  employee_id: string;
  name: string;
  role: string;
  site: string;
  department: string;
  avatar_url?: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
