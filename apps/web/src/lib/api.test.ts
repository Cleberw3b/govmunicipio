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

  it('clears auth and throws on 401 response', async () => {
    localStorageMock.setItem('token', 'expired-token');
    localStorageMock.setItem('principal', '{}');
    // Mock window.location
    delete (window as any).location;
    (window as any).location = { href: '' };

    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
    });

    await expect(apiClient('/test')).rejects.toThrow('Unauthorized');
    expect(localStorageMock.getItem('token')).toBeNull();
    expect(localStorageMock.getItem('principal')).toBeNull();
  });

  it('throws on 403 Forbidden', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers(),
      json: () => Promise.resolve({ message: 'Forbidden' }),
    });
    await expect(apiClient('/test')).rejects.toThrow('Forbidden');
  });

  it('throws on 404 Not Found', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
      json: () => Promise.resolve({ message: 'Not Found' }),
    });
    await expect(apiClient('/test')).rejects.toThrow('Not Found');
  });

  it('throws on 500 Server Error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers(),
      json: () => Promise.resolve({ message: 'Internal Server Error' }),
    });
    await expect(apiClient('/test')).rejects.toThrow('Internal Server Error');
  });

  it('handles network failure (fetch throws)', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(apiClient('/test')).rejects.toThrow('Failed to fetch');
  });

  it('handles malformed JSON response gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers(),
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    });
    await expect(apiClient('/test')).rejects.toThrow('Request failed');
  });

  it('handles error with null message field', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      headers: new Headers(),
      json: () => Promise.resolve({ message: null }),
    });
    await expect(apiClient('/test')).rejects.toThrow('HTTP 422');
  });
});
