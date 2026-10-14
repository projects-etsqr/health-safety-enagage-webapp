/* eslint-env jest */
// Lightweight AsyncStorage shim for Jest.
// Mirrors the public surface used by src/utils/storage.ts.

type Store = Record<string, string>;
const store: Store = {};

const asyncStorageMock = {
  getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    store[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete store[key];
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    return Promise.resolve();
  }),
  multiGet: jest.fn((keys: string[]) =>
    Promise.resolve(keys.map((k) => [k, store[k] ?? null] as [string, string | null])),
  ),
  multiSet: jest.fn((pairs: [string, string][]) => {
    pairs.forEach(([k, v]) => (store[k] = v));
    return Promise.resolve();
  }),
  multiRemove: jest.fn((keys: string[]) => {
    keys.forEach((k) => delete store[k]);
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Object.keys(store))),
};

module.exports = asyncStorageMock;
module.exports.default = asyncStorageMock;
