import config from '../config';
import CookieHelper from '../utils/CookieHelper';
import TokenRefreshService from "./TokenRefreshService";


class UserService {
  constructor() {
    this.USERNAME_COOKIE = 'username';
    this.USER_ID_COOKIE = 'user_id';
  }

  /**
   * Login user with secure backend endpoint
   * @param {Object} credentials - Username and password
   * @returns {Promise<Object>} - Login result
   */
  async login(credentials) {
    this.validateCredentials(credentials);

    try {
      const response = await fetch(`${config.api.getBackendUrl()}/api/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.detail || `Login failed: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();

      if (!responseData.success) {
        throw new Error(responseData.message || 'Login failed');
      }

      // Store user data in client-side cookies for quick access
      this.storeUserData(responseData.user.username, responseData.user.userId);

      return {
        success: true,
        user: {
          username: responseData.user.username,
          userId: responseData.user.userId,
          tokenExpiry: responseData.user.tokenExpiry
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

      const responseData = await response.json();

      if (!response.ok || responseData.success === false) {
        let errorMessage = 'Registration failed';
        if (responseData.message) {
          try {
            // Handle nested error messages from backend
            const nestedError = JSON.parse(responseData.message.replace('Failed to create user: ', ''));
            errorMessage = nestedError.detail || responseData.message;
          } catch {
            errorMessage = responseData.message;
          }
        } else if (responseData.detail) {
          errorMessage = responseData.detail;
        }
        throw new Error(errorMessage);
      }

      return responseData;

    } catch (error) {
      if (error.message && !error.message.includes('fetch')) {
        throw error;
      }
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  /**
   * Delete user account with automatic token refresh
   * @param {string} userId - User ID to delete
   * @returns {Promise<Object>} - Delete result
   */
  async deleteUser(userId) {
    if (!userId) {
      throw new Error("User ID is required");
    }

    try {
      const response = await TokenRefreshService.authenticatedFetch(
        `${config.api.getBackendUrl()}/api/users/${userId}`,
        {
          method: 'DELETE'
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          throw new Error('Authentication failed - please log in again');
        }

        if (response.status === 403) {
          throw new Error('Not authorized to delete this user');
        }

        if (response.status === 404) {
          throw new Error('User not found');
        }

        throw new Error(errorData.message || errorData.detail || `User deletion failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: result.message || 'User deleted successfully',
        userId: result.user_id || userId
      };

    } catch (error) {
      return {
        success: false,
        message: error.message || 'An error occurred while deleting the user'
      };
    }
  }

  /**
   * Logout user - Backend handles everything (Langflow logout + ALL cookie clearing)
   * @returns {Promise<Object>} - Logout result
   */
  async logout() {
    try {
      const response = await fetch(`${config.api.getBackendUrl()}/api/users/logout`, {
        method: 'POST',
        credentials: 'include'
      });

      const result = await response.json().catch(() => ({ success: true }));

      return {
        success: true,
        message: result.message || 'Logged out successfully',
        cookies_cleared: result.cookies_cleared || 0
      };

    } catch (error) {
      console.warn('Backend logout failed:', error);

      // Fallback: try to clear what we can on frontend
      const clearedCookies = CookieHelper.clearAllCookies();

      return {
        success: true,
        message: 'Logged out (backend failed, frontend cleanup only)',
        cookies_cleared: clearedCookies.length
      };
    }
  }

  /**
   * Get current user information from local cookies
   * @returns {Object|null} - User data or null
   */
  getCurrentUser() {
    const username = CookieHelper.getCookie(this.USERNAME_COOKIE);
    const userId = CookieHelper.getCookie(this.USER_ID_COOKIE);

    if (!username) {
      return null;
    }

    return {
      username,
      userId,
      isAuthenticated: true
    };
  }

  /**
   * Check if user is authenticated via backend verification
   * @returns {Promise<boolean>} - Authentication status
   */
  async isAuthenticated() {
    try {
      const response = await fetch(`${config.api.getBackendUrl()}/api/users/verify-auth`, {
        credentials: 'include'
      });

      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      return result.authenticated || false;

    } catch (error) {
      console.warn('Auth check failed:', error);
      return false;
    }
  }

  /**
   * Get detailed authentication status from backend
   * @returns {Promise<Object>} - Detailed auth status
   */
  async getAuthStatus() {
    try {
      const response = await fetch(`${config.api.getBackendUrl()}/api/users/auth-status`, {
        credentials: 'include'
      });

      if (!response.ok) {
        return {
          isAuthenticated: false,
          user: null,
          tokens: null
        };
      }

      const result = await response.json();
      const localUser = this.getCurrentUser();

      return {
        isAuthenticated: result.authenticated,
        user: result.authenticated ? {
          ...result.user,
          ...localUser // Merge backend user data with local data
        } : null,
        tokens: result.tokens || null,
        message: result.message
      };

    } catch (error) {
      console.warn('Auth status check failed:', error);
      return {
        isAuthenticated: false,
        user: null,
        tokens: null
      };
    }
  }

  /**
   * Validate user credentials
   * @param {Object} credentials - Username and password
   * @throws {Error} - If credentials are invalid
   */
  validateCredentials(credentials) {
    if (!credentials.username || !credentials.password) {
      throw new Error("Username and password are required");
    }
  }

  /**
   * Store user data in client-side cookies
   * @param {string} username - Username
   * @param {string} userId - User ID
   */
  storeUserData(username, userId) {
    CookieHelper.setCookie(this.USERNAME_COOKIE, username, {
      secure: window.location.protocol === 'https:',
      sameSite: 'Strict'
    });

    if (userId) {
      CookieHelper.setCookie(this.USER_ID_COOKIE, userId, {
        secure: window.location.protocol === 'https:',
        sameSite: 'Strict'
      });
    }
  }

  /**
   * Clear user data from client-side cookies
   */
  clearUserData() {
    CookieHelper.deleteCookie(this.USERNAME_COOKIE);
    CookieHelper.deleteCookie(this.USER_ID_COOKIE);
  }
}

const userService = new UserService();
export default userService;