import axiosInstance from '../api/axiosInstance';
import type {
  OnboardingAccessProfile,
  OnboardingSubmissionPayload,
  OnboardingSubmissionResponse,
  OnboardingLayerOption,
  OnboardingLayerOptionsResponse,
  RequestStatusResponse,
  OnboardingProcessingQueueResponse,
  StartOnboardingProcessingResponse,
  PostApprovalSetupPayload,
  PostApprovalSetupResponse,
  DeletePostApprovalFileResponse,
} from '../types';

export const getOnboardingAccessProfile = (email: string, orgCode?: string) => {
  const params = new URLSearchParams();
  params.set('email', email.trim().toLowerCase());
  if (orgCode?.trim()) params.set('org_code', orgCode.trim().toUpperCase());
  return axiosInstance
    .get<OnboardingAccessProfile>(`/onboarding/access-profile?${params.toString()}`)
    .then((r) => r.data);
};

export const submitClientOnboarding = (payload: OnboardingSubmissionPayload) =>
  axiosInstance
    .post<OnboardingSubmissionResponse>('/onboarding', payload)
    .then((r) => r.data);

export const deleteOnboardingRequest = (uuid: string) =>
  axiosInstance.delete(`/onboarding/requests/${uuid}`).then((r) => r.data);

export const updateOnboardingStatus = (
  uuid: string,
  status: 'approved' | 'archived' | 'submitted',
) =>
  axiosInstance
    .patch<{ message: string; email_delivery?: { attempted: boolean; sent: boolean; detail: string } }>(
      `/onboarding/requests/${uuid}/status`,
      { status },
    )
    .then((r) => r.data);

export const fetchOnboardingRequests = () =>
  axiosInstance.get('/onboarding/requests').then((r) => r.data);

export const fetchOnboardingProcessingQueue = () =>
  axiosInstance
    .get<OnboardingProcessingQueueResponse>('/onboarding/processing-queue')
    .then((r) => r.data);

export const startOnboardingProcessing = (onboardingUuid: string) =>
  axiosInstance
    .post<StartOnboardingProcessingResponse>(
      `/onboarding/requests/${onboardingUuid}/start-processing`,
    )
    .then((r) => r.data);

export const fetchRequestStatusByEmail = (email: string) =>
  axiosInstance
    .get<RequestStatusResponse>(
      `/onboarding/request-status?email=${encodeURIComponent(email.trim().toLowerCase())}`,
    )
    .then((r) => r.data);

export const fetchOnboardingLayerOptions = (countryCode: string) => {
  const code = (countryCode || '').trim().toUpperCase();
  return axiosInstance
    .get<OnboardingLayerOptionsResponse>(
      `/onboarding/layer-options?country_code=${encodeURIComponent(code)}`,
    )
    .then((r) => r.data);
};

export const savePostApprovalSetup = (
  onboardingUuid: string,
  payload: PostApprovalSetupPayload,
) => {
  const formData = new FormData();
  formData.append('org_data_summary', payload.org_data_summary || '');
  formData.append('workers_json', JSON.stringify(payload.workers || []));
  (payload.org_files || []).forEach((file) => formData.append('org_files', file));
  (payload.worker_files || []).forEach((file) => formData.append('worker_files', file));

  return axiosInstance
    .post<PostApprovalSetupResponse>(
      `/onboarding/requests/${onboardingUuid}/post-approval-setup`,
      formData,
    )
    .then((r) => r.data);
};

export const deletePostApprovalFile = (
  onboardingUuid: string,
  storedName: string,
  fileGroup: 'org' | 'worker',
) =>
  axiosInstance
    .delete<DeletePostApprovalFileResponse>(
      `/onboarding/requests/${onboardingUuid}/post-approval-files`,
      { data: { stored_name: storedName, file_group: fileGroup } },
    )
    .then((r) => r.data);

export type {
  OnboardingAccessProfile,
  OnboardingSubmissionPayload,
  OnboardingSubmissionResponse,
  OnboardingLayerOption,
  OnboardingLayerOptionsResponse,
  RequestStatusResponse,
  OnboardingProcessingQueueResponse,
  StartOnboardingProcessingResponse,
  PostApprovalSetupPayload,
  PostApprovalSetupResponse,
  DeletePostApprovalFileResponse,
};
