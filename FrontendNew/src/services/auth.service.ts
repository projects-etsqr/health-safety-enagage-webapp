import axiosInstance from '../api/axiosInstance';

export interface HSELoginResponse {
  access_token: string;
  token_type: string;
  user: {
    user_id: number;
    username: string;
    email: string;
    role: string;
    role_level: number;
  };
}

export const loginWithHSEBackend = async (
  usernameOrEmail: string,
  password: string,
): Promise<HSELoginResponse> => {
  const response = await axiosInstance.post<HSELoginResponse>('/auth/login', {
    username: usernameOrEmail,
    password,
  });
  return response.data;
};

import type {
  ThetaAuthLoginResponse,
  ThetaPasswordResetRequestResponse,
  ThetaPasswordResetConfirmResponse,
  ThetaPasswordResetDirectResponse,
  OnboardingAccessRequestResponse,
  OrgAccessRequestItem,
  OrgAccessRequestsResponse,
  ReviewOrgAccessRequestResponse,
} from '../types';

export const loginWithThetaCredentials = async (
  email: string,
  password: string,
  orgCode?: string,
): Promise<ThetaAuthLoginResponse> => {
  const payload: { email: string; password: string; org_code?: string } = {
    email: email.trim().toLowerCase(),
    password,
  };
  if (orgCode?.trim()) payload.org_code = orgCode.trim().toUpperCase();

  try {
    const response = await axiosInstance.post<ThetaAuthLoginResponse>(
      '/onboarding/theta-auth/login',
      payload,
    );
    return response.data;
  } catch (error: unknown) {
    // Return structured error response if backend returned a status field
    const axiosError = error as { response?: { data?: ThetaAuthLoginResponse } };
    if (axiosError?.response?.data?.status) return axiosError.response.data;
    throw error;
  }
};

export const requestThetaPasswordResetOtp = (email: string, orgCode?: string) => {
  const payload: { email: string; org_code?: string } = {
    email: email.trim().toLowerCase(),
  };
  if (orgCode?.trim()) payload.org_code = orgCode.trim().toUpperCase();
  return axiosInstance
    .post<ThetaPasswordResetRequestResponse>(
      '/onboarding/password-reset/theta/request',
      payload,
    )
    .then((r) => r.data);
};

export const confirmThetaPasswordReset = (
  email: string,
  otp: string,
  newPassword: string,
  orgCode?: string,
) => {
  const payload: { email: string; otp: string; new_password: string; org_code?: string } = {
    email: email.trim().toLowerCase(),
    otp: otp.trim(),
    new_password: newPassword,
  };
  if (orgCode?.trim()) payload.org_code = orgCode.trim().toUpperCase();
  return axiosInstance
    .post<ThetaPasswordResetConfirmResponse>(
      '/onboarding/password-reset/theta/confirm',
      payload,
    )
    .then((r) => r.data);
};

export const resetThetaPasswordDirect = (
  email: string,
  newPassword: string,
  orgCode?: string,
) => {
  const payload: { email: string; new_password: string; org_code?: string } = {
    email: email.trim().toLowerCase(),
    new_password: newPassword,
  };
  if (orgCode?.trim()) payload.org_code = orgCode.trim().toUpperCase();
  return axiosInstance
    .post<ThetaPasswordResetDirectResponse>(
      '/onboarding/password-reset/theta/direct',
      payload,
    )
    .then((r) => r.data);
};

export const submitOnboardingAccessRequest = (
  email: string,
  orgCode: string,
  name?: string,
) => {
  const payload: { email: string; org_code: string; name?: string } = {
    email: email.trim().toLowerCase(),
    org_code: orgCode.trim().toUpperCase(),
  };
  if (name?.trim()) payload.name = name.trim();
  return axiosInstance
    .post<OnboardingAccessRequestResponse>('/onboarding/access-request', payload)
    .then((r) => r.data);
};

export const fetchOrgAccessRequests = (orgCode?: string) => {
  const params = new URLSearchParams();
  if (orgCode?.trim()) params.set('org_code', orgCode.trim().toUpperCase());
  const query = params.toString();
  return axiosInstance
    .get<OrgAccessRequestsResponse>(
      `/onboarding/access-requests${query ? `?${query}` : ''}`,
    )
    .then((r) => r.data);
};

export const reviewOrgAccessRequest = (
  requestId: number,
  action: 'approve' | 'reject',
  role: OrgAccessRequestItem['role'],
) =>
  axiosInstance
    .patch<ReviewOrgAccessRequestResponse>(
      `/onboarding/access-requests/${requestId}/review`,
      { action, role },
    )
    .then((r) => r.data);

export type {
  ThetaAuthLoginResponse,
  ThetaPasswordResetRequestResponse,
  ThetaPasswordResetConfirmResponse,
  ThetaPasswordResetDirectResponse,
  OnboardingAccessRequestResponse,
  OrgAccessRequestItem,
  OrgAccessRequestsResponse,
  ReviewOrgAccessRequestResponse,
};
