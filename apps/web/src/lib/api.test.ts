/**
 * @jest-environment jsdom
 */

import { apiClient } from './api';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
});

describe('apiClient', () => {
  it('returns parsed JSON on successful response', async () => {
    const data = [{ id: '1', name: 'Test' }];
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-length': '50' }),
      json: () => Promise.resolve(data),
    });

    const result = await apiClient<{ id: string; name: string }[]>('/test');
    expect(result).toEqual(data);
  });

  it('returns empty array for 204 No Content (not undefined)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
    });

    const result = await apiClient<string[]>('/test');
    expect(result).toEqual([]);
    expect(result).not.toBeUndefined();
  });

  it('returns empty array for zero content-length', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-length': '0' }),
    });

    const result = await apiClient<string[]>('/test');
    expect(result).toEqual([]);
  });

  it('returns empty array when JSON body is null', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-length': '4' }),
      json: () => Promise.resolve(null),
    });

    const result = await apiClient<string[]>('/test');
    expect(result).toEqual([]);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers(),
      json: () => Promise.resolve({ message: 'Bad Request' }),
    });

    await expect(apiClient('/test')).rejects.toThrow('Bad Request');
  });

  it('handles array error messages', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      headers: new Headers(),
      json: () => Promise.resolve({ message: ['Field required', 'Invalid format'] }),
    });

    await expect(apiClient('/test')).rejects.toThrow('Field required\nInvalid format');
  });

  it('attaches Authorization header from localStorage', async () => {
    localStorageMock.setItem('token', 'test-jwt-token');
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-length': '2' }),
      json: () => Promise.resolve([]),
    });

    await apiClient('/test');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-jwt-token',
        }),
      }),
    );
  });

  it('safe to call .map() on 204 response (empty array)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
    });

    const result = await apiClient<{ id: string }[]>('/test');
    // This should NOT throw — the key assertion
    const mapped = result.map((item) => item.id);
    expect(mapped).toEqual([]);
  });
});
