/**
 * Offline queue behaviour.
 *
 * The distinction that matters most here is "no signal" versus "the server said
 * no". Queueing a rejected payload would hide a real error and retry it
 * forever, so a 4xx must propagate and a network failure must not.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  registerClient,
  submitOrQueue,
  flush,
  readQueue,
  clearQueue,
  pendingCount,
  isOfflineError,
} from '../../src/services/offlineQueue';

const networkError = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });
const serverError = (status: number, detail = 'bad payload') =>
  Object.assign(new Error(`Request failed with status ${status}`), {
    response: { status, data: { detail } },
  });

function makeClient() {
  const calls: Array<{ url: string; body: any }> = [];
  let mode: 'ok' | 'offline' | 'reject' = 'ok';
  const client: any = {
    post: jest.fn(async (url: string, body: any) => {
      calls.push({ url, body });
      if (mode === 'offline') throw networkError();
      if (mode === 'reject') throw serverError(422);
      return { data: { id: 1, url } };
    }),
  };
  return {
    client,
    calls,
    setMode: (m: typeof mode) => {
      mode = m;
    },
  };
}

describe('offlineQueue', () => {
  let harness: ReturnType<typeof makeClient>;

  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearQueue();
    harness = makeClient();
    registerClient('default', harness.client);
    jest.clearAllMocks();
  });

  it('classifies network failures as offline and server answers as not', () => {
    expect(isOfflineError(networkError())).toBe(true);
    expect(isOfflineError(serverError(422))).toBe(false);
    expect(isOfflineError(serverError(500))).toBe(false);
  });

  it('submits directly when online and queues nothing', async () => {
    const res = await submitOrQueue('/near-miss-workflow/report', { description: 'x' }, {
      label: 'Near miss report',
    });

    expect(res.queued).toBe(false);
    expect(res.data).toEqual({ id: 1, url: '/near-miss-workflow/report' });
    expect(await pendingCount()).toBe(0);
  });

  it('queues the report when there is no signal', async () => {
    harness.setMode('offline');

    const res = await submitOrQueue('/near-miss-workflow/report', { description: 'x' }, {
      label: 'Near miss report',
    });

    expect(res.queued).toBe(true);
    expect(res.data).toBeUndefined();

    const queue = await readQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].label).toBe('Near miss report');
    expect(queue[0].body).toEqual({ description: 'x' });
  });

  it('rethrows a server rejection instead of queueing it', async () => {
    harness.setMode('reject');

    await expect(
      submitOrQueue('/near-miss-workflow/report', { description: '' }, { label: 'Near miss report' }),
    ).rejects.toMatchObject({ response: { status: 422 } });

    // A payload the server already refused must not be replayed forever.
    expect(await pendingCount()).toBe(0);
  });

  it('replays queued reports on flush, oldest first, then empties', async () => {
    harness.setMode('offline');
    await submitOrQueue('/a', { n: 1 }, { label: 'first' });
    await submitOrQueue('/b', { n: 2 }, { label: 'second' });
    expect(await pendingCount()).toBe(2);

    harness.setMode('ok');
    const result = await flush();

    expect(result).toEqual({ sent: 2, failed: 0, remaining: 0 });
    expect(harness.calls.map(c => c.url)).toEqual(['/a', '/b', '/a', '/b']);
    expect(await pendingCount()).toBe(0);
  });

  it('stops at the first offline failure so ordering is preserved', async () => {
    harness.setMode('offline');
    await submitOrQueue('/a', { n: 1 }, { label: 'first' });
    await submitOrQueue('/b', { n: 2 }, { label: 'second' });

    // Still offline at flush time — nothing should drain, and nothing reorder.
    const result = await flush();

    expect(result.sent).toBe(0);
    expect(result.remaining).toBe(2);
    const queue = await readQueue();
    expect(queue.map(q => q.label)).toEqual(['first', 'second']);
  });

  it('drops a persistently rejected item after the retry limit', async () => {
    harness.setMode('offline');
    await submitOrQueue('/bad', { n: 1 }, { label: 'doomed' });

    harness.setMode('reject');
    for (let i = 0; i < 5; i += 1) await flush();

    expect(await pendingCount()).toBe(0);
  });

  it('keeps photo references so a multipart report can be rebuilt later', async () => {
    harness.setMode('offline');
    await submitOrQueue(
      '/incident-workflow/report',
      { description: 'spill' },
      {
        kind: 'multipart',
        photos: [{ uri: 'file:///tmp/a.jpg', name: 'a.jpg', type: 'image/jpeg' }],
        label: 'Incident report',
      },
    );

    const [item] = await readQueue();
    expect(item.kind).toBe('multipart');
    expect(item.photos).toEqual([{ uri: 'file:///tmp/a.jpg', name: 'a.jpg', type: 'image/jpeg' }]);
  });
});
