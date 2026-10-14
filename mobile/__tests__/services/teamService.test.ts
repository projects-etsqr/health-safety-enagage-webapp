import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../src/api/client';
import { teamService } from '../../src/services/teamService';
import { ENDPOINTS } from '../../src/api/endpoints';

const mock = new MockAdapter(apiClient);

describe('teamService', () => {
  beforeEach(() => {
    mock.reset();
  });

  it('getMembers() hits /supervisor/team/members and returns the unwrapped array', async () => {
    const members = [
      {
        id: 'm-1',
        name: 'Alice',
        role: 'welder',
        zone: 'Zone A',
        status: 'logged_in',
      },
      {
        id: 'm-2',
        name: 'Bob',
        role: 'rigger',
        zone: 'Zone B',
        status: 'pending',
      },
    ];
    mock.onGet(ENDPOINTS.TEAM.MEMBERS).reply(200, {
      success: true,
      data: members,
    });

    const out = await teamService.getMembers();
    expect(out).toEqual(members);
  });

  it('getShiftStatus() hits /supervisor/team/shift-status and returns the unwrapped payload', async () => {
    const payload = { total: 10, logged_in: 7, pending: 2, is_live: true };
    mock.onGet(ENDPOINTS.TEAM.SHIFT_STATUS).reply(200, {
      success: true,
      data: payload,
    });

    const out = await teamService.getShiftStatus();
    expect(out).toEqual(payload);
  });

  it('getToolboxTalk() hits /supervisor/team/toolbox-talk', async () => {
    const payload = {
      id: 'tt-1',
      title: 'Working at height',
      scheduled_at: '2025-06-15T09:00:00Z',
      priority: 'high',
      description: 'Harness and lanyard',
      key_points: ['inspect gear', 'anchor point'],
      attendees: [],
    };
    mock.onGet(ENDPOINTS.TEAM.TOOLBOX_TALK).reply(200, {
      success: true,
      data: payload,
    });

    const out = await teamService.getToolboxTalk();
    expect(out).toEqual(payload);
  });

  it('submitToolboxLog() POSTs the full data body to /supervisor/team/toolbox-talk/submit', async () => {
    let urlHit = '';
    let bodySent: any = null;
    mock.onPost(ENDPOINTS.TEAM.SUBMIT_TOOLBOX).reply((config) => {
      urlHit = config.url ?? '';
      bodySent = JSON.parse(config.data ?? '{}');
      return [200, { success: true, data: null }];
    });

    const data = {
      talk_id: 'tt-1',
      attendees: [
        { id: 'm-1', present: true },
        { id: 'm-2', present: false },
      ],
      notes: 'Bob off site',
    };
    await teamService.submitToolboxLog(data);
    expect(urlHit).toBe(ENDPOINTS.TEAM.SUBMIT_TOOLBOX);
    expect(bodySent).toEqual(data);
  });

  it('getAttendance() hits /supervisor/team/attendance and returns { stats, members }', async () => {
    const payload = {
      stats: {
        total_workforce: 12,
        present: 9,
        off_site: 2,
        pending: 1,
        active_zones: 3,
      },
      members: [
        {
          id: 'm-1',
          name: 'Alice',
          role: 'welder',
          zone: 'Zone A',
          status: 'logged_in',
        },
      ],
    };
    mock.onGet(ENDPOINTS.TEAM.ATTENDANCE).reply(200, {
      success: true,
      data: payload,
    });

    const out = await teamService.getAttendance();
    expect(out).toEqual(payload);
  });

  it('forceIn(id) POSTs to /supervisor/team/members/:id/force-in with no body', async () => {
    let urlHit = '';
    let bodySent: any = 'not-set';
    mock.onPost(ENDPOINTS.TEAM.FORCE_IN('m-1')).reply((config) => {
      urlHit = config.url ?? '';
      bodySent = config.data;
      return [200, { success: true, data: null }];
    });

    await teamService.forceIn('m-1');
    expect(urlHit).toBe(ENDPOINTS.TEAM.FORCE_IN('m-1'));
    expect(bodySent).toBeUndefined();
  });
});
