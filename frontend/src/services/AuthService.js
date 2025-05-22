import config from '../config';

/**
 * LangFlow-Compatible Authentication service with Proactive Silent Refresh
 * Handles LangFlow's actual authentication patterns
 */
class AuthService {
  constructor() {
    this.tokenKey = 'langflow_access_token';
    this.refreshTokenKey = 'langflow_refresh_token';
    this.apiKeyKey = 'langflow_api_key';

    this.refreshTimer = null;
    this.isRefreshing = false;
    this.refreshPromise = null;
    this.REFRESH_BUFFER = 5 * 60 * 1000;

    this.authEventListeners = new Set();

    this._initializeSilentRefresh();
  }

  /**
   * Initialize silent refresh on service creation
   * @private
   */
  _initializeSilentRefresh() {
      const token = localStorage.getItem(this.tokenKey);
      if (token && this._isValidJWTFormat(token) && !this._isTokenExpired(token)) {
        this._scheduleNextRefresh(token);
    }
  }

  /**
   * Checks if a JWT token has the correct format
   * @param {string} token - JWT token to validate
   * @returns {boolean} - True if token format is valid
   * @private
   */
  _isValidJWTFormat(token) {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    try {
      const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return header && payload;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets token expiration time in milliseconds
   * @param {string} token - JWT token
   * @returns {number|null} - Expiration timestamp or null
   * @private
   */
  _getTokenExpiration(token) {
    try {
      const parts = token.split('.');
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.exp ? payload.exp * 1000 : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Checks if the JWT token is expired
   * @param {string} token - JWT token to check
   * @returns {boolean} - True if token is expired
   * @private
   */
  _isTokenExpired(token) {
    const expiration = this._getTokenExpiration(token);
    if (!expiration) return false;
    return Date.now() >= expiration;
  }

  /**
   * Schedules the next automatic token refresh
   * @param {string} token - Current JWT token
   * @private
   */
  _scheduleNextRefresh(token) {
    this._clearRefreshTimer();

    const expiration = this._getTokenExpiration(token);
    if (!expiration) return;

    const refreshTime = Math.max(0, expiration - this.REFRESH_BUFFER - Date.now());

    if (refreshTime <= 0) {
      console.log('🔄 Token expires soon, attempting refresh...');
      this._performSilentRefresh();
      return;
    }

    console.log(`🕐 Token refresh scheduled in ${Math.round(refreshTime / 1000 / 60)} minutes`);

    this.refreshTimer = setTimeout(() => {
      console.log('🔄 Performing scheduled token refresh...');
      this._performSilentRefresh();
    }, refreshTime);
  }

  /**
   * Clears the refresh timer
   * @private
   */
  _clearRefreshTimer() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
 * Tries to refresh token using refresh token
 *  @returns {Promise<{ accessToken: string, refreshToken: string } | null>} - New tokens or null if refresh failed * @private
 */
async _requestTokenRefresh() {
  const refreshToken = localStorage.getItem(this.refreshTokenKey);
  if (!refreshToken) {
    console.warn('No refresh token available');
    return null;
  }

  try {
    const response = await fetch(`${config.api.langflowUrl}/api/v1/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token
      };

    } else {
      console.warn('Refresh request failed:', await response.text());
    }

    return null;
  } catch (error) {
    console.error('Error during token refresh:', error);
    return null;
  }
}


  /**
   * Performs the actual token refresh - LangFlow compatible
   * @returns {Promise<string|null>} - New token or null if failed
   * @private
   */
  async _performSilentRefresh() {
    if (this.isRefreshing) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;

    this.refreshPromise = (async () => {
      try {
        const currentToken = localStorage.getItem(this.tokenKey);
        if (!currentToken) {
          throw new Error('No token to refresh');
        }

        console.log('🔄 Attempting silent token refresh...');

        const refreshed = await this._requestTokenRefresh();
        if (!refreshed) {
          console.error("Silent refresh failed");
          return;
        }
        const { accessToken, refreshToken } = refreshed;

        this._updateToken(accessToken, refreshToken);

        console.log('✅ Token refreshed successfully');

        this._scheduleNextRefresh(accessToken);

        this._notifyAuthEvent({ type: 'TOKEN_UPDATED', token: accessToken });

        return accessToken;

      } catch (error) {
        console.error('❌ Silent refresh failed:', error);
        this._handleRefreshFailure();
        return null;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Validates token with LangFlow
   * @param {string} token - JWT token to validate
   * @returns {Promise<boolean>} - True if token is valid
   * @private
   */
  async _validateTokenWithLangFlow(token) {
    try {
      const endpoint = `${config.api.langflowUrl}/api/v1/users/whoami`;

      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (response.ok) {
          return true;
        }
      } catch (err) {
      }


      return false;
    } catch (error) {
      return false;
    }
  }


  /**
   * Updates the stored token
   * @param {string} newToken - New JWT token
   * @param {string} refreshToken - New Refresh JWT token
   * @private
   */
  _updateToken(newToken, refreshToken) {
    localStorage.setItem(this.tokenKey, newToken);
    localStorage.setItem(this.refreshTokenKey, refreshToken);
  }

  /**
   * Handles refresh failure
   * @private
   */
  _handleRefreshFailure() {
    console.log('🚪 Token refresh failed, user needs to re-authenticate');
    this._clearAuthData();

    // Notify listeners of authentication failure
    this._notifyAuthEvent({ type: 'AUTH_FAILED' });
  }

  /**
   * Clears all authentication data
   * @private
   */
  _clearAuthData() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.apiKeyKey);
    this._clearRefreshTimer();
  }

  /**
   * Notifies all listeners of auth events
   * @param {Object} event - Event object
   * @private
   */
  _notifyAuthEvent(event) {
    this.authEventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in auth event listener:', error);
      }
    });
  }

  // ===== PUBLIC METHODS =====

  /**
   * Main authentication check with automatic refresh
   * @returns {Promise<boolean>} - True if user is authenticated
   */
  async isAuthenticated() {
    try {
      const token = localStorage.getItem(this.tokenKey);
      if (!token) return false;

      if (!this._isValidJWTFormat(token)) {
        this._clearAuthData();
        return false;
      }

      // If token is expired, try silent refresh
      if (this._isTokenExpired(token)) {
        console.log('🔄 Token expired, attempting silent refresh...');
        const newToken = await this._performSilentRefresh();
        return newToken !== null;
      }

      // Validate with server
      const isValid = await this._validateTokenWithLangFlow(token);
      if (!isValid) {
        console.log('🔄 Token invalid with server, attempting refresh...');
        const newToken = await this._performSilentRefresh();
        return newToken !== null;
      }

      // Ensure refresh is scheduled
      if (!this.refreshTimer) {
        this._scheduleNextRefresh(token);
      }

      return true;
    } catch (error) {
      console.error('Authentication check failed:', error);
      this._clearAuthData();
      return false;
    }
  }

  /**
   * Sets a new JWT token and starts silent refresh
   * @param {string} token - JWT token to set
   * @param {string} refreshToken - Optional refresh token
   */
  setToken(token, refreshToken = null) {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token provided');
    }

    console.log('🔑 Setting new JWT token and starting silent refresh');
    this._updateToken(token);

    if (refreshToken) {
      localStorage.setItem(this.refreshTokenKey, refreshToken);
    }

    this._scheduleNextRefresh(token);

    this._notifyAuthEvent({ type: 'TOKEN_UPDATED', token });
  }


  /**
   * Clears all authentication data
   */
  clearToken() {
    console.log('🚪 Clearing all authentication data');
    this._clearAuthData();
  }

  /**
   * Enhanced fetch with automatic authentication headers
   * @param {string} url - Request URL
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} - Fetch response
   */
  async authenticatedFetch(url, options = {}) {
    // Ensure we have valid auth first
    const isAuth = await this.isAuthenticated();
    if (!isAuth) {
      throw new Error('Authentication required');
    }

    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = localStorage.getItem(this.tokenKey);
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });
  }

  /**
   * Adds a listener for authentication events
   * @param {Function} listener - Function to call on auth events
   */
  addTokenUpdateListener(listener) {
    this.authEventListeners.add(listener);
  }

  /**
   * Removes an authentication event listener
   * @param {Function} listener - Listener function to remove
   */
  removeTokenUpdateListener(listener) {
    this.authEventListeners.delete(listener);
  }

  /**
   * Gets time until token expires (JWT only)
   * @returns {number|null} - Milliseconds until expiry or null
   */
  getTimeUntilExpiry() {
    const token = localStorage.getItem(this.tokenKey);
    if (!token) return null;

    const expiration = this._getTokenExpiration(token);
    if (!expiration) return null;

    return Math.max(0, expiration - Date.now());
  }

  /**
   * Gets time until next scheduled refresh (JWT only)
   * @returns {number|null} - Milliseconds until next refresh or null
   */
  getTimeUntilNextRefresh() {
    const token = localStorage.getItem(this.tokenKey);
    if (!token) return null;

    const expiration = this._getTokenExpiration(token);
    if (!expiration) return null;

    const nextRefresh = expiration - this.REFRESH_BUFFER;
    return Math.max(0, nextRefresh - Date.now());
  }

  /**
   * Checks if a refresh is currently in progress
   * @returns {boolean} - True if refreshing
   */
  isCurrentlyRefreshing() {
    return this.isRefreshing;
  }

  /**
   * Cleanup method - call when service is no longer needed
   */
  destroy() {
    console.log('🧹 Cleaning up AuthService');
    this._clearRefreshTimer();
    this.authEventListeners.clear();
  }
}

const authService = new AuthService();
export default authService;