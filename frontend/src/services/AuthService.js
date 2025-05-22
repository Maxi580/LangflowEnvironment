import config from '../config';

/**
 * Authentication service focused on JWT token validation
 * Provides a single public method: isAuthenticated()
 */
class AuthService {
  constructor() {
    this.tokenKey = 'langflow_access_token';
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

    // JWT should have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    try {
      // Try to decode the header and payload (don't verify signature here)
      const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

      // Basic checks for required JWT fields
      return header && payload && header.typ === 'JWT';
    } catch (error) {
      return false;
    }
  }

  /**
   * Checks if the JWT token is expired
   * @param {string} token - JWT token to check
   * @returns {boolean} - True if token is expired
   * @private
   */
  _isTokenExpired(token) {
    try {
      const parts = token.split('.');
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

      if (!payload.exp) {
        // If no expiration, consider it valid
        return false;
      }

      // Check if current time is past expiration (exp is in seconds)
      const currentTime = Math.floor(Date.now() / 1000);
      return currentTime >= payload.exp;
    } catch (error) {
      return true; // If we can't parse it, consider it expired
    }
  }

  /**
   * Validates the token with LangFlow by making a test API call
   * @param {string} token - JWT token to validate
   * @returns {Promise<boolean>} - True if token is valid with LangFlow
   * @private
   */
  async _validateTokenWithLangFlow(token) {
    try {
      // Try to fetch user flows - this requires authentication
      const response = await fetch(config.api.getFlowsUrl(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clears invalid authentication data from localStorage
   * @private
   */
  _clearInvalidToken() {
    localStorage.removeItem(this.tokenKey);
  }

  /**
   * Comprehensive authentication check
   * Validates token existence, format, expiration, and server acceptance
   * @returns {Promise<boolean>} - True if user is authenticated
   */
  async isAuthenticated() {
    try {
      // Step 1: Check if token exists
      const token = localStorage.getItem(this.tokenKey);
      if (!token) {
        return false;
      }

      // Step 2: Check if token has correct JWT format
      if (!this._isValidJWTFormat(token)) {
        this._clearInvalidToken();
        return false;
      }

      // Step 3: Check if token is expired
      if (this._isTokenExpired(token)) {
        this._clearInvalidToken();
        return false;
      }

      // Step 4: Validate token with LangFlow
      const isValidWithLangFlow = await this._validateTokenWithLangFlow(token);
      if (!isValidWithLangFlow) {
        this._clearInvalidToken();
        return false;
      }

      return true;
    } catch (error) {
      this._clearInvalidToken();
      return false;
    }
  }
}

const authService = new AuthService();
export default authService;