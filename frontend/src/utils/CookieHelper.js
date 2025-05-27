/**
 * Simplified Cookie Helper for non-sensitive data only
 * Tokens are now handled by backend via httpOnly cookies
 */
class CookieHelper {
  /**
   * Get current port for cookie isolation (optional - for consistency)
   * @returns {string} - Current port number
   */
  static getCurrentPort() {
    return window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
  }

  /**
   * Create port-specific cookie name (optional - for isolation)
   * @param {string} name - Original cookie name
   * @returns {string} - Port-prefixed cookie name
   */
  static getPortSpecificName(name) {
    const port = this.getCurrentPort();
    return `p${port}_${name}`;
  }

  /**
   * Set a non-sensitive cookie
   * ⚠️ Only use for public data (user preferences, UI state, etc.)
   * @param {string} name - Cookie name
   * @param {string} value - Cookie value
   * @param {Object} options - Cookie options
   */
  static setCookie(name, value, options = {}) {
    const defaults = {
      path: '/',
      secure: window.location.protocol === 'https:',
      sameSite: 'Strict'
    };

    const cookieOptions = { ...defaults, ...options };

    // Use port-specific naming for consistency (optional)
    const cookieName = cookieOptions.usePortIsolation !== false ?
      this.getPortSpecificName(name) : name;

    let cookieString = `${encodeURIComponent(cookieName)}=${encodeURIComponent(value)}`;

    if (cookieOptions.expires) {
      cookieString += `; expires=${cookieOptions.expires.toUTCString()}`;
    }

    if (cookieOptions.maxAge) {
      cookieString += `; max-age=${cookieOptions.maxAge}`;
    }

    if (cookieOptions.path) {
      cookieString += `; path=${cookieOptions.path}`;
    }

    if (cookieOptions.domain) {
      cookieString += `; domain=${cookieOptions.domain}`;
    }

    if (cookieOptions.secure) {
      cookieString += '; secure';
    }

    if (cookieOptions.sameSite) {
      cookieString += `; samesite=${cookieOptions.sameSite}`;
    }

    document.cookie = cookieString;
  }

  /**
   * Get a cookie value by name
   * @param {string} name - Cookie name
   * @param {Object} options - Options
   * @returns {string|null} - Cookie value or null if not found
   */
  static getCookie(name, options = {}) {
    const cookieName = options.usePortIsolation !== false ?
      this.getPortSpecificName(name) : name;

    const encodedName = encodeURIComponent(cookieName);
    const cookies = document.cookie.split(';');

    for (let cookie of cookies) {
      const [cookieKey, cookieValue] = cookie.trim().split('=');
      if (cookieKey === encodedName) {
        return decodeURIComponent(cookieValue || '');
      }
    }

    return null;
  }

  /**
   * Delete a cookie by name
   * @param {string} name - Cookie name
   * @param {Object} options - Cookie options (path, domain)
   */
  static deleteCookie(name, options = {}) {
    const deleteOptions = {
      ...options,
      expires: new Date(0),
      maxAge: 0
    };

    this.setCookie(name, '', deleteOptions);
  }

  /**
   * Clear ALL cookies on this domain - Nuclear option
   * This method doesn't hardcode any paths and clears everything
   * @returns {Array} - List of cleared cookie names
   */
  static clearAllCookies() {
    const cookies = document.cookie.split(";");
    const clearedCookies = [];

    for (let cookie of cookies) {
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();

      if (name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;

        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;

        const hostname = window.location.hostname;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${hostname};`;

        if (hostname.includes('.')) {
          const parentDomain = '.' + hostname.split('.').slice(-2).join('.');
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${parentDomain};`;
        }

        clearedCookies.push(name);
      }
    }

    console.log(`Nuclear logout: cleared ${clearedCookies.length} cookies:`, clearedCookies);
    return clearedCookies;
  }

}

export default CookieHelper;
