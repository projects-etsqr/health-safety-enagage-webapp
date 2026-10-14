import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { STORAGE_KEYS as KEYS } from '../constants/config';

// Tokens are session credentials — U-015 moved them out of AsyncStorage (plain
// text on disk, readable on a rooted device or in an unencrypted backup) into
// the OS keychain/keystore. Everything else here (the cached user object,
// the selected role) is not a credential and stays in AsyncStorage.
const KEYCHAIN_SERVICE = 'hseiq_main_tokens';

export const TokenStorage = {
  async setTokens(access: string, refresh: string) {
    await Keychain.setGenericPassword('tokens', JSON.stringify({ access, refresh }), {
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
  async clearAll() {
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
    await AsyncStorage.multiRemove([KEYS.USER, 'selected_role']);
  },
  async setUser(user: object) {
    await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
  },
  async getUser<T>(): Promise<T | null> {
    const raw = await AsyncStorage.getItem(KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  },
  async setSelectedRole(role: string | null) {
    if (role) {
      await AsyncStorage.setItem('selected_role', role);
    } else {
      await AsyncStorage.removeItem('selected_role');
    }
  },
  async getSelectedRole(): Promise<string | null> {
    return AsyncStorage.getItem('selected_role');
  },
};
