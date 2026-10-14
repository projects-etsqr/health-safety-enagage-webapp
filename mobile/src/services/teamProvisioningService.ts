import { apiClient } from '../api/client';

export interface TeamMember {
  id: number;
  name: string;
  email: string;
  username: string;
  active: boolean;
}

export const teamProvisioningService = {
  async members(): Promise<{ role: string; items: TeamMember[] }> {
    const { data } = await apiClient.get('/team/members');
    return data ?? { role: 'member', items: [] };
  },
};
