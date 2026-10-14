import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../src/api/client';
import { TokenStorage } from '../../src/utils/storage';
import { STORAGE_KEYS } from '../../src/constants/config';

const mock = new MockAdapter(apiClient);

describe('api/client', () => {
  afterEach(() => {
    mock.reset();
    jest.clearAllMocks();
  });

  describe('envelope unwrapping', () => {
    it('unwraps { success, message, data } envelope so res.data === data', async () => {
      const inner = { access_token: 'a', refresh_token: 'b', user: { id: '1' } };
      mock.onGet('/test').reply(200, {
        success: true,
        message: 'ok',
        data: inner,
      });

      const res = await apiClient.get('/test');
      expect(res.data).toEqual(inner);
    });

    it('leaves a non-enveloped body untouched', async () => {
      const body = { foo: 'bar' };
      mock.onGet('/plain').reply(200, body);

      const res = await apiClient.get('/plain');
      expect(res.data).toEqual(body);
    });

    it('leaves an array body untouched (not an envelope)', async () => {
      const arr = [{ id: 1 }, { id: 2 }];
      mock.onGet('/list').reply(200, arr);

      const res = await apiClient.get('/list');
      expect(res.data).toEqual(arr);
    });
  });

  describe('Authorization header', () => {
    it('attaches Bearer <token> when an access token is in storage', async () => {
      const spy = jest
        .spyOn(TokenStorage, 'getAccessToken')
        .mockResolvedValue('fake-token-123');

      let captured: any = null;
      mock.onGet('/protected').reply((config) => {
        captured = config.headers;
        return [200, { ok: true }];
      });

      await apiClient.get('/protected');
      expect(captured.Authorization).toBe('Bearer fake-token-123');
      spy.mockRestore();
    });

    it('omits the header when no token is stored', async () => {
      const spy = jest
        .spyOn(TokenStorage, 'getAccessToken')
        .mockResolvedValue(null);

      let captured: any = null;
      mock.onGet('/public').reply((config) => {
        captured = config.headers;
        return [200, { ok: true }];
      });

      await apiClient.get('/public');
      expect(captured.Authorization).toBeUndefined();
      spy.mockRestore();
    });
  });

  describe('401 handling', () => {
    it('clears all tokens on a 401 response', async () => {
      const clearSpy = jest
        .spyOn(TokenStorage, 'clearAll')
        .mockResolvedValue(undefined);

      mock.onGet('/forbidden').reply(401, { detail: 'expired' });

      await expect(apiClient.get('/forbidden')).rejects.toBeDefined();
      expect(clearSpy).toHaveBeenCalledTimes(1);
      clearSpy.mockRestore();
    });
  });

  describe('storage keys exist', () => {
    it('exposes the supervisor-prefixed keys', () => {
      expect(STORAGE_KEYS.ACCESS_TOKEN).toBe('sup_access_token');
      expect(STORAGE_KEYS.REFRESH_TOKEN).toBe('sup_refresh_token');
      expect(STORAGE_KEYS.USER).toBe('sup_user');
    });
  });
});
