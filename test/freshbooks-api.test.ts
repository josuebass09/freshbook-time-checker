import { FreshBooksAPI } from '../src/freshbooks-api';

jest.mock('axios');

describe('FreshBooksAPI', () => {
  it('should setAccessToken updates token', () => {
    const accessToken = 'test-token';
    const api = new FreshBooksAPI(accessToken, 'foo');
    api.setAccessToken(accessToken);
    expect(api.accessToken()).toBe(accessToken);
  });

  it('should setRefreshToken updates refresh token', () => {
      const refreshToken = 'test-token';
    const api = new FreshBooksAPI('foo');
    api.setRefreshToken(refreshToken);
    expect(api.refreshToken()).toBe(refreshToken);
  });
});
