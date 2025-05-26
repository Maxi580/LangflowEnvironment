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
    // Prevent multiple simultaneous refresh attempts
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
      const response = await fetch(`${config.api.getBackendUrl()}/api/users/refresh-token`, {
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
    // First attempt
    let response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
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
            'Content-Type': 'application/json',
            'Accept': 'application/json',
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