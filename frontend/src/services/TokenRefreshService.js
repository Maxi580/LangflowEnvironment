import config from '../config';

/**
 * Minimal Token Refresh Service
 * Just handles token refresh when backend returns 401
 */
class TokenRefreshService {
  constructor() {
    this.isRefreshing = false;
    this.refreshPromise = null;
  }

  /**
   * Refresh tokens via backend
   * @returns {Promise<boolean>} - True if successful
   */
  async performRefresh() {
    if (this.isRefreshing) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.executeRefresh();

    try {
      return await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Execute the refresh request
   * @returns {Promise<boolean>} - True if successful
   */
  async executeRefresh() {
    try {
      const response = await fetch(config.api.getUsersRefreshTokenUrl(), {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        return result.success || false;
      }

      return false;

    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  /**
 * Make authenticated request with auto-retry on 401
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} - Fetch response
 */
async authenticatedFetch(url, options = {}) {
  // Check if we're sending FormData (for file uploads)
  const isFormData = options.body instanceof FormData;

  // Prepare headers - don't set Content-Type for FormData
  const defaultHeaders = {};
  if (!isFormData) {
    defaultHeaders['Content-Type'] = 'application/json';
  }
  defaultHeaders['Accept'] = 'application/json';

  let response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  });

  if (response.status === 401) {
    const refreshSuccess = await this.performRefresh();

    if (refreshSuccess) {
      response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          ...defaultHeaders,
          ...options.headers
        }
      });
    }
  }

  return response;
  }
}

const tokenRefreshService = new TokenRefreshService();
export default tokenRefreshService;