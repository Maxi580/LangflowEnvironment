import config from '../config';
import CookieHelper from '../utils/CookieHelper';
import JWTHelper from '../utils/JWTHelper';
import tokenRefreshService from './TokenRefreshService';

/**
 * User management service
 * Handles login, registration, user data, and authentication state
 */
class UserService {
  constructor() {
    this.USERNAME_COOKIE = 'username';
    this.USER_ID_COOKIE = 'user_id';
  }

  /**
   * Login user with LangFlow
   * @param {Object} credentials - Username and password
   * @returns {Promise<Object>} - Login result
   */
  async login(credentials) {
    this.validateCredentials(credentials);

    try {
      const response = await fetch(`${config.api.langflowUrl}/api/v1/login`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: this.createLoginFormData(credentials)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Login failed: ${response.status} ${response.statusText}`);
      }

      const tokenData = await response.json();
      const userInfo = JWTHelper.getUserInfo(tokenData.access_token);

      if (!userInfo) {
        throw new Error('Invalid token received from server');
      }

      tokenRefreshService.storeTokens(tokenData.access_token, tokenData.refresh_token);

      this.storeUserData(credentials.username, userInfo.userId);

      return {
        success: true,
        user: {
          username: credentials.username,
          userId: userInfo.userId,
          tokenExpiry: userInfo.expiry
        }
      };

    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  /**
   * Register new user with backend
   * @param {Object} userData - Username and password
   * @returns {Promise<Object>} - Registration result
   */
  async register(userData) {
    this.validateCredentials(userData);

    try {
      const response = await fetch(`${config.api.getBackendUrl()}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          username: userData.username,
          password: userData.password
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Registration failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  /**
   * Delete user account
   * @param {string} userId - User ID to delete
   * @returns {Promise<Object>} - Deletion result
   */
  async deleteUser(userId) {
    if (!userId) {
      throw new Error("User ID is required");
    }

    try {
      const response = await tokenRefreshService.authenticatedFetch(
        `${config.api.getBackendUrl()}/api/users/${userId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `User deletion failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      throw new Error(`User deletion failed: ${error.message}`);
    }
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      // Attempt server logout notification (best effort)
      const accessToken = tokenRefreshService.getAccessToken();
      if (accessToken) {
        try {
          await fetch(`${config.api.langflowUrl}/api/v1/logout`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          // Server logout notification failed - continue with local logout
        }
      }
    } finally {
      this.clearUserData();
      tokenRefreshService.clearTokens();
    }
  }

  /**
   * Get current user information
   * @returns {Object|null} - Current user data or null
   */
  getCurrentUser() {
    const username = CookieHelper.getCookie(this.USERNAME_COOKIE);
    const userId = CookieHelper.getCookie(this.USER_ID_COOKIE);
    const accessToken = tokenRefreshService.getAccessToken();

    if (!username || !accessToken) {
      return null;
    }

    const userInfo = JWTHelper.getUserInfo(accessToken);

    return {
      username,
      userId: userId || userInfo?.userId,
      tokenExpiry: userInfo?.expiry,
      isAuthenticated: true
    };
  }

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>} - True if authenticated
   */
  async isAuthenticated() {
    return await tokenRefreshService.isAuthenticated();
  }

  /**
   * Get detailed authentication status
   * @returns {Promise<Object>} - Authentication status details
   */
  async getAuthStatus() {
    const isAuth = await this.isAuthenticated();
    const user = this.getCurrentUser();

    return {
      isAuthenticated: isAuth,
      user: user,
      tokenExpiry: user?.tokenExpiry,
      timeUntilExpiry: tokenRefreshService.getTimeUntilExpiry(),
      timeUntilRefresh: tokenRefreshService.getTimeUntilRefresh(),
      isRefreshing: tokenRefreshService.isCurrentlyRefreshing()
    };
  }

  /**
   * Add authentication event listener
   * @param {Function} callback - Event callback
   */
  onAuthEvent(callback) {
    tokenRefreshService.addEventListener(callback);
  }

  /**
   * Remove authentication event listener
   * @param {Function} callback - Event callback
   */
  offAuthEvent(callback) {
    tokenRefreshService.removeEventListener(callback);
  }

  /**
   * Manual token refresh
   * @returns {Promise<boolean>} - True if successful
   */
  async refreshAuth() {
    return await tokenRefreshService.performRefresh();
  }

  // ===== PRIVATE METHODS =====

  /**
   * Validate login/registration credentials
   * @param {Object} credentials - Username and password
   */
  validateCredentials(credentials) {
    if (!credentials.username || !credentials.password) {
      throw new Error("Username and password are required");
    }
  }

  /**
   * Create form data for login request
   * @param {Object} credentials - Username and password
   * @returns {FormData} - Form data for login
   */
  createLoginFormData(credentials) {
    const formData = new FormData();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);
    formData.append('grant_type', 'password');
    return formData;
  }

  /**
   * Store user data in cookies
   * @param {string} username - Username
   * @param {string} userId - User ID
   */
  storeUserData(username, userId) {
    CookieHelper.setCookie(this.USERNAME_COOKIE, username, {
      secure: true,
      sameSite: 'Strict'
    });

    CookieHelper.setCookie(this.USER_ID_COOKIE, userId, {
      secure: true,
      sameSite: 'Strict'
    });
  }

  /**
   * Clear user data from cookies
   */
  clearUserData() {
    CookieHelper.deleteCookie(this.USERNAME_COOKIE);
    CookieHelper.deleteCookie(this.USER_ID_COOKIE);
  }
}

const userService = new UserService();
export default userService;