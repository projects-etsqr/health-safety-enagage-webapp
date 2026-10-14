import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { STORAGE_KEYS } from '../constants/config';
import { User } from '../types';

// Tokens are session credentials — U-015 moved them out of AsyncStorage (plain
// text on disk, readable on a rooted device or in an unencrypted backup) into
// the OS keychain/keystore. Everything else here (the cached user object)
// is not a credential and stays in AsyncStorage.
const KEYCHAIN_SERVICE = 'hseiq_worker_tokens';

export const TokenStorage = {
  async setTokens(accessToken: string, refreshToken: string) {
    await Keychain.setGenericPassword('tokens', JSON.stringify({ access: accessToken, refresh: refreshToken }), {
      service: KEYCHAIN_SERVICE,
    });
  },

  async getAccessToken(): Promise<string | null> {
    const creds = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
    if (!creds) return null;
    try {
      return JSON.parse(creds.password).access ?? null;
    } catch {
      return null;
    }
  },

  async getRefreshToken(): Promise<string | null> {
    const creds = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
    if (!creds) return null;
    try {
      return JSON.parse(creds.password).refresh ?? null;
    } catch {
      return null;
    }
  },

  async clearTokens() {
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
  },

  async setUser(user: User) {
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  async getUser(): Promise<User | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  },

  async clearUser() {
    await AsyncStorage.removeItem(STORAGE_KEYS.USER);
  },

  async clearAll() {
    await this.clearTokens();
    await this.clearUser();
  },
};
