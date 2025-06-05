import config from '../config';

class CookieHelper {
  /**
   * Get a specific cookie value
   * @param {string} name - Cookie name
   * @returns {string|null} - Cookie value or null if not found
   */
  static getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop().split(';').shift();
    }
    return null;
  }

  /**
   * Get username from cookie using config
   * @returns {string|null} - Username or null if not found
   */
  static getUsername() {
    return this.getCookie(config.cookies.username);
  }

  /**
   * Get access token from cookie using config
   * @returns {string|null} - Access token or null if not found
   */
  static getAccessToken() {
    return this.getCookie(config.cookies.accessToken);
  }

  /**
   * Get refresh token from cookie using config
   * @returns {string|null} - Refresh token or null if not found
   */
  static getRefreshToken() {
    return this.getCookie(config.cookies.refreshToken);
  }

  /**
   * Check if username cookie exists
   * @returns {boolean} - True if username cookie exists
   */
  static hasUsername() {
    return !!this.getUsername();
  }

  /**
   * Check if access token cookie exists
   * @returns {boolean} - True if access token cookie exists
   */
  static hasAccessToken() {
    return !!this.getAccessToken();
  }

  /**
   * Clear all cookies (existing method)
   */
  static clearAllCookies() {
    const cookies = document.cookie.split(";");
    const clearedCookies = [];

    for (let cookie of cookies) {
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      if (name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;`;
        clearedCookies.push(name);
      }
    }

    return clearedCookies;
  }
}

export default CookieHelper;