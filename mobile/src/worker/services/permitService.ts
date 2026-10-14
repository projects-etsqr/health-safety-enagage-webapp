import apiClient, { uploadClient } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import { Permit, PermitRequest, PermitListResponse } from '../types';

export const permitService = {
  async getPermits(params?: { status?: string }): Promise<PermitListResponse> {
    const { data } = await apiClient.get<PermitListResponse>(ENDPOINTS.PERMITS.LIST, { params });
    return data;
  },

  async getPermit(id: string): Promise<Permit> {
    const { data } = await apiClient.get<Permit>(ENDPOINTS.PERMITS.DETAIL(id));
    return data;
  },

  async createPermit(payload: PermitRequest): Promise<Permit> {
    const { data } = await apiClient.post<Permit>(ENDPOINTS.PERMITS.CREATE, payload);
    return data;
  },

  /**
   * Raise a permit with the risk assessment attached.
   *
   * The file part is named `media_0`, which is what `app/utils/report_media`
   * reads — it was `risk_assessment_file`, a name nothing on the server has
   * ever looked for, posted at an endpoint that only accepted JSON. Both ends
   * of that were broken and neither could be noticed, because the attach box on
   * the form had no handler and so nothing ever called this.
   */
  async createPermitWithFile(
    payload: PermitRequest,
    riskAssessmentFile?: { uri: string; name: string; type: string },
  ): Promise<Permit> {
    if (!riskAssessmentFile) {
      return this.createPermit(payload);
    }
    const form = new FormData();
    form.append('data', JSON.stringify(payload));
    form.append('media_0', {
      uri: riskAssessmentFile.uri,
      name: riskAssessmentFile.name,
      type: riskAssessmentFile.type,
    } as any);
    const { data } = await uploadClient.post<Permit>(ENDPOINTS.PERMITS.CREATE, form);
    return data;
  },

  async acknowledgePermit(id: string): Promise<Permit> {
    const { data } = await apiClient.post<Permit>(ENDPOINTS.PERMITS.ACKNOWLEDGE(id));
    return data;
  },

  /**
   * Accept the issued permit and start work under it.
   *
   * The window is enforced server-side — a permit whose validity has passed, or
   * has not begun, is refused with the reason — so this does not second-guess
   * it. The refusal text is what the screen shows.
   */
  async startWork(id: string): Promise<void> {
    await apiClient.post(ENDPOINTS.PERMITS.START_WORK(id));
  },

  /** Work is finished; the permit is spent and goes to the supervisor to close. */
  async completeWork(id: string): Promise<void> {
    await apiClient.post(ENDPOINTS.PERMITS.COMPLETE_WORK(id));
  },
};
