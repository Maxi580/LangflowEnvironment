import config from '../config';
import CookieHelper from '../utils/CookieHelper';
import JWTHelper from '../utils/JWTHelper'

/**
 * Handles automatic token refresh and validation
 */
class TokenRefreshService {
  constructor() {
    this.REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
    this.ACCESS_TOKEN_COOKIE = 'access_token_lf';
    this.REFRESH_TOKEN_COOKIE = 'refresh_token_lf';

    this.refreshTimer = null;
    this.isRefreshing = false;
    this.refreshPromise = null;
    this.eventListeners = new Set();

    this.initializeAutoRefresh();
  }

  /**
   * Initialize automatic refresh if valid token exists
   */
  initializeAutoRefresh() {
    const accessToken = this.getAccessToken();
    if (accessToken && JWTHelper.isValidFormat(accessToken) && !JWTHelper.isExpired(accessToken)) {
      this.scheduleRefresh(accessToken);
    }
  }

  /**
   * Get access token from cookie
   * @returns {string|null} - Access token or null
   */
  getAccessToken() {
    return CookieHelper.getCookie(this.ACCESS_TOKEN_COOKIE);
  }

  /**
   * Get refresh token from cookie
   * @returns {string|null} - Refresh token or null
   */
  getRefreshToken() {
    return CookieHelper.getCookie(this.REFRESH_TOKEN_COOKIE);
  }

  /**
   * Store tokens in cookies
   * @param {string} accessToken - JWT access token
   * @param {string} refreshToken - JWT refresh token
   */
  storeTokens(accessToken, refreshToken) {
    const expiration = JWTHelper.getExpiration(accessToken);
    const expiryDate = expiration ? new Date(expiration) : null;

    CookieHelper.setCookie(this.ACCESS_TOKEN_COOKIE, accessToken, {
      expires: expiryDate,
      secure: true,
      sameSite: 'Strict'
    });

    CookieHelper.setCookie(this.REFRESH_TOKEN_COOKIE, refreshToken, {
      secure: true,
      sameSite: 'Strict'
    });

    this.scheduleRefresh(accessToken);
    this.notifyListeners({ type: 'tokens_updated', accessToken });
  }

  /**
   * Clear all tokens
   */
  clearTokens() {
    CookieHelper.deleteCookie(this.ACCESS_TOKEN_COOKIE);
    CookieHelper.deleteCookie(this.REFRESH_TOKEN_COOKIE);
    this.clearRefreshTimer();
    this.notifyListeners({ type: 'tokens_cleared' });
  }

  /**
   * Schedule next token refresh
   * @param {string} accessToken - Current access token
   */
  scheduleRefresh(accessToken) {
    this.clearRefreshTimer();

    const expiration = JWTHelper.getExpiration(accessToken);
    if (!expiration) return;

    const refreshTime = Math.max(0, expiration - this.REFRESH_BUFFER_MS - Date.now());

    if (refreshTime <= 0) {
      this.performRefresh();
      return;
    }

    this.refreshTimer = setTimeout(() => {
      this.performRefresh();
    }, refreshTime);
  }

  /**
   * Clear refresh timer
   */
  clearRefreshTimer() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Perform token refresh
   * @returns {Promise<boolean>} - True if refresh successful
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
   * Execute the actual refresh request
   * @returns {Promise<boolean>} - True if successful
   */
  async executeRefresh() {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${config.api.langflowUrl}/api/v1/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.access_token || !data.refresh_token) {
        throw new Error('Invalid refresh response');
      }

      this.storeTokens(data.access_token, data.refresh_token);
      return true;

    } catch (error) {
      this.handleRefreshFailure();
      return false;
    }
  }

  /**
   * Handle refresh failure
   */
  handleRefreshFailure() {
    this.clearTokens();
    this.notifyListeners({ type: 'refresh_failed' });
  }

  /**
   * Validate token with server
   * @param {string} token - Token to validate
   * @returns {Promise<boolean>} - True if valid
   */
  async validateToken(token) {
    try {
      const response = await fetch(`${config.api.langflowUrl}/api/v1/users/whoami`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user has valid authentication
   * @returns {Promise<boolean>} - True if authenticated
   */
  async isAuthenticated() {
    try {
      const accessToken = this.getAccessToken();
      if (!accessToken || !JWTHelper.isValidFormat(accessToken)) {
        return false;
      }

      // If token is expired, try refresh
      if (JWTHelper.isExpired(accessToken)) {
        return await this.performRefresh();
      }

      // Validate with server
      const isValid = await this.validateToken(accessToken);
      if (!isValid) {
        return await this.performRefresh();
      }

      // Ensure refresh is scheduled
      if (!this.refreshTimer) {
        this.scheduleRefresh(accessToken);
      }

      return true;
    } catch (error) {
      this.clearTokens();
      return false;
    }
  }

  /**
   * Make authenticated HTTP request
   * @param {string} url - Request URL
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} - Fetch response
   */
  async authenticatedFetch(url, options = {}) {
    const isAuth = await this.isAuthenticated();
    if (!isAuth) {
      throw new Error('Authentication required');
    }

    const accessToken = this.getAccessToken();
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`
    };

    return fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });
  }

  /**
   * Add event listener
   * @param {Function} listener - Event listener function
   */
  addEventListener(listener) {
    this.eventListeners.add(listener);
  }

  /**
   * Remove event listener
   * @param {Function} listener - Event listener function
   */
  removeEventListener(listener) {
    this.eventListeners.delete(listener);
  }

  /**
   * Notify all listeners of events
   * @param {Object} event - Event object
   */
  notifyListeners(event) {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        // Silently handle listener errors
      }
    });
  }

  /**
   * Get time until token expires
   * @returns {number|null} - Milliseconds until expiry
   */
  getTimeUntilExpiry() {
    const accessToken = this.getAccessToken();
    return accessToken ? JWTHelper.getTimeUntilExpiry(accessToken) : null;
  }

  /**
   * Get time until next refresh
   * @returns {number|null} - Milliseconds until refresh
   */
  getTimeUntilRefresh() {
    const accessToken = this.getAccessToken();
    if (!accessToken) return null;

    const expiration = JWTHelper.getExpiration(accessToken);
    if (!expiration) return null;

    const nextRefresh = expiration - this.REFRESH_BUFFER_MS;
    return Math.max(0, nextRefresh - Date.now());
  }

  /**
   * Check if currently refreshing
   * @returns {boolean} - True if refreshing
   */
  isCurrentlyRefreshing() {
    return this.isRefreshing;
  }

  /**
   * Cleanup service
   */
  destroy() {
    this.clearRefreshTimer();
    this.eventListeners.clear();
  }
}

const tokenRefreshService = new TokenRefreshService();
export default tokenRefreshService;