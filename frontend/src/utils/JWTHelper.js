class JWTHelper {
  /**
   * Parse JWT token payload
   * @param {string} token - JWT token
   * @returns {Object|null} - Parsed payload or null if invalid
   */
  static parseToken(token) {
    if (!token || typeof token !== 'string') {
      return null;
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(payload));
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if JWT token is valid format
   * @param {string} token - JWT token
   * @returns {boolean} - True if valid format
   */
  static isValidFormat(token) {
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
      return header && payload && typeof payload.exp === 'number';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get token expiration timestamp
   * @param {string} token - JWT token
   * @returns {number|null} - Expiration timestamp in milliseconds or null
   */
  static getExpiration(token) {
    const payload = this.parseToken(token);
    return payload?.exp ? payload.exp * 1000 : null;
  }

  /**
   * Check if token is expired
   * @param {string} token - JWT token
   * @param {number} bufferMs - Buffer time in milliseconds (default: 0)
   * @returns {boolean} - True if expired
   */
  static isExpired(token, bufferMs = 0) {
    const expiration = this.getExpiration(token);
    if (!expiration) return true;
    return Date.now() >= (expiration - bufferMs);
  }

  /**
   * Get time until token expires
   * @param {string} token - JWT token
   * @returns {number|null} - Milliseconds until expiry or null
   */
  static getTimeUntilExpiry(token) {
    const expiration = this.getExpiration(token);
    if (!expiration) return null;
    return Math.max(0, expiration - Date.now());
  }

  /**
   * Extract user info from token
   * @param {string} token - JWT token
   * @returns {Object|null} - User info or null
   */
  static getUserInfo(token) {
    const payload = this.parseToken(token);
    if (!payload) return null;

    return {
      userId: payload.sub,
      username: payload.username || payload.user_id,
      expiry: payload.exp
    };
  }
}

export default JWTHelper;