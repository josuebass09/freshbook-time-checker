import { FreshBooksAPI } from '../src/freshbooks-api';

jest.mock('axios');

describe('FreshBooksAPI', () => {
  it('should setAccessToken updates token', () => {
    const api = new FreshBooksAPI();
    api.setAccessToken('test-token');
    expect(api.getAccessToken()).toBe('test-token');
  });

  it('should setRefreshToken updates refresh token', () => {
    const api = new FreshBooksAPI();
    api.setRefreshToken('refresh-token');
    expect(api.getRefreshToken()).toBe('refresh-token');
  });
});
