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
   * Check if a cookie exists
   * @param {string} name - Cookie name
   * @param {Object} options - Options
   * @returns {boolean} - True if cookie exists
   */
  static hasCookie(name, options = {}) {
    return this.getCookie(name, options) !== null;
  }

  /**
   * Clear all non-sensitive cookies (current port only)
   * Note: This cannot clear httpOnly cookies - those are handled by backend
   */
  static clearAll() {
    const port = this.getCurrentPort();
    const prefix = `p${port}_`;
    const cookies = document.cookie.split(';');

    for (let cookie of cookies) {
      const [name] = cookie.trim().split('=');
      if (name && decodeURIComponent(name).startsWith(prefix)) {
        // Remove port prefix to get original name
        const originalName = decodeURIComponent(name).substring(prefix.length);
        this.deleteCookie(originalName);
        this.deleteCookie(originalName, { path: '/' });
      }
    }
  }

  /**
   * Set user preference cookie
   * @param {string} key - Preference key
   * @param {string|boolean|number} value - Preference value
   */
  static setPreference(key, value) {
    this.setCookie(`pref_${key}`, String(value), {
      maxAge: 365 * 24 * 60 * 60, // 1 year
      secure: true,
      sameSite: 'Strict'
    });
  }

  /**
   * Get user preference cookie
   * @param {string} key - Preference key
   * @param {any} defaultValue - Default value if not found
   * @returns {string} - Preference value
   */
  static getPreference(key, defaultValue = null) {
    const value = this.getCookie(`pref_${key}`);
    return value !== null ? value : defaultValue;
  }

  /**
   * Get boolean preference
   * @param {string} key - Preference key
   * @param {boolean} defaultValue - Default boolean value
   * @returns {boolean} - Boolean preference value
   */
  static getBooleanPreference(key, defaultValue = false) {
    const value = this.getPreference(key);
    if (value === null) return defaultValue;
    return value === 'true';
  }

  /**
   * Set temporary cookie (session only)
   * @param {string} name - Cookie name
   * @param {string} value - Cookie value
   */
  static setTemporary(name, value) {
    this.setCookie(name, value, {
      // No expires/maxAge = session cookie
      secure: true,
      sameSite: 'Strict'
    });
  }

  /**
   * For debugging: show all non-httpOnly cookies for current port
   */
  static debugCookies() {
    const port = this.getCurrentPort();
    const prefix = `p${port}_`;
    const cookies = document.cookie.split(';');

    console.log(`🍪 Non-sensitive cookies for port ${port}:`);

    cookies.forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && decodeURIComponent(name).startsWith(prefix)) {
        const originalName = decodeURIComponent(name).substring(prefix.length);
        console.log(`  ${originalName}: ${decodeURIComponent(value || '')}`);
      }
    });
  }
}

export default CookieHelper;
