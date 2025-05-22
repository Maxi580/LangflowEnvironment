class CookieHelper {
  /**
   * Set a cookie with security options
   * @param {string} name - Cookie name
   * @param {string} value - Cookie value
   * @param {Object} options - Cookie options
   */
  static setCookie(name, value, options = {}) {
    const defaults = {
      path: '/',
      secure: window.location.protocol === 'https:',
      sameSite: 'Strict',
      httpOnly: false // Can't set httpOnly from client-side
    };

    const cookieOptions = { ...defaults, ...options };

    let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

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
   * @returns {string|null} - Cookie value or null if not found
   */
  static getCookie(name) {
    const encodedName = encodeURIComponent(name);
    const cookies = document.cookie.split(';');

    for (let cookie of cookies) {
      const [cookieName, cookieValue] = cookie.trim().split('=');
      if (cookieName === encodedName) {
        return decodeURIComponent(cookieValue);
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
   * @returns {boolean} - True if cookie exists
   */
  static hasCookie(name) {
    return this.getCookie(name) !== null;
  }

  /**
   * Clear all cookies (best effort - can only clear cookies accessible to JS)
   */
  static clearAll() {
    const cookies = document.cookie.split(';');

    for (let cookie of cookies) {
      const [name] = cookie.trim().split('=');
      if (name) {
        this.deleteCookie(decodeURIComponent(name));
        this.deleteCookie(decodeURIComponent(name), { path: '/' });
      }
    }
  }
}

export default CookieHelper;