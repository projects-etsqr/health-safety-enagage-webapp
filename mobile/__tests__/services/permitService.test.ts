import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../src/api/client';
import { permitService } from '../../src/services/permitService';
import { ENDPOINTS } from '../../src/api/endpoints';

const mock = new MockAdapter(apiClient);

describe('permitService', () => {
  beforeEach(() => {
    mock.reset();
  });

  it('getPermits() hits /supervisor/permits and unwraps the data envelope', async () => {
    const payload = {
      items: [
        {
          id: 'p-1',
          permit_ref: 'PR-1',
          permit_type: 'hot_work',
          title: 'Hot work on pipe',
          location: 'Zone A',
          requestor: 'Alice',
          status: 'pending',
          risk_level: 'high',
        },
      ],
      total: 1,
      pending_count: 1,
      approved_today: 0,
      risk_flags: 1,
    };
    mock.onGet(ENDPOINTS.PERMITS.LIST).reply(200, {
      success: true,
      data: payload,
    });

    const out = await permitService.getPermits();
    expect(out).toEqual(payload);
  });

  it('getPermits() forwards query params via axios params config', async () => {
    const payload = {
      items: [],
      total: 0,
      pending_count: 0,
      approved_today: 0,
      risk_flags: 0,
    };
    let capturedUrl: string | undefined;
    let capturedParams: any = 'not-called';
    mock.onGet(ENDPOINTS.PERMITS.LIST).reply((config) => {
      capturedUrl = config.url;
      capturedParams = config.params;
      return [200, { success: true, data: payload }];
    });

    await permitService.getPermits({ status: 'pending', type: 'hot_work' });
    expect(capturedUrl).toBe(ENDPOINTS.PERMITS.LIST);
    expect(capturedParams).toEqual({ status: 'pending', type: 'hot_work' });
  });

  it('getPermit(id) hits /supervisor/permits/:id and returns the unwrapped permit', async () => {
    const permit = {
      id: 'p-1',
      permit_ref: 'PR-1',
      permit_type: 'hot_work',
      title: 'Hot work on pipe',
      location: 'Zone A',
      requestor: 'Alice',
      status: 'pending',
      risk_level: 'high',
    };
    mock.onGet(ENDPOINTS.PERMITS.DETAIL('p-1')).reply(200, {
      success: true,
      data: permit,
    });

    const out = await permitService.getPermit('p-1');
    expect(out).toEqual(permit);
  });

  it('approvePermit(id) POSTs notes to /supervisor/permits/:id/approve', async () => {
    let urlHit = '';
    let bodySent: any = null;
    mock.onPost(ENDPOINTS.PERMITS.APPROVE('p-1')).reply((config) => {
      urlHit = config.url ?? '';
      bodySent = JSON.parse(config.data ?? '{}');
      return [200, { success: true, data: null }];
    });

    await permitService.approvePermit('p-1', 'looks good');
    expect(urlHit).toBe(ENDPOINTS.PERMITS.APPROVE('p-1'));
    expect(bodySent).toEqual({ notes: 'looks good' });
  });

  it('approvePermit(id) without notes still sends notes: undefined', async () => {
    let bodySent: any = 'not-set';
    mock.onPost(ENDPOINTS.PERMITS.APPROVE('p-1')).reply((config) => {
      bodySent = JSON.parse(config.data ?? '{}');
      return [200, { success: true, data: null }];
    });

    await permitService.approvePermit('p-1');
    expect(bodySent).toEqual({ notes: undefined });
  });

  it('rejectPermit(id) POSTs reason to /supervisor/permits/:id/reject', async () => {
    let urlHit = '';
    let bodySent: any = null;
    mock.onPost(ENDPOINTS.PERMITS.REJECT('p-1')).reply((config) => {
      urlHit = config.url ?? '';
      bodySent = JSON.parse(config.data ?? '{}');
      return [200, { success: true, data: null }];
    });

    await permitService.rejectPermit('p-1', 'no PPE');
    expect(urlHit).toBe(ENDPOINTS.PERMITS.REJECT('p-1'));
    expect(bodySent).toEqual({ reason: 'no PPE' });
  });

  it('acknowledgePermit(id, checklist) POSTs checklist to /supervisor/permits/:id/acknowledge', async () => {
    let urlHit = '';
    let bodySent: any = null;
    mock.onPost(ENDPOINTS.PERMITS.ACKNOWLEDGE('p-1')).reply((config) => {
      urlHit = config.url ?? '';
      bodySent = JSON.parse(config.data ?? '{}');
      return [200, { success: true, data: null }];
    });

    const checklist = { helmet: true, harness: true, gas_test: false };
    await permitService.acknowledgePermit('p-1', checklist);
    expect(urlHit).toBe(ENDPOINTS.PERMITS.ACKNOWLEDGE('p-1'));
    expect(bodySent).toEqual({ checklist });
  });
});
