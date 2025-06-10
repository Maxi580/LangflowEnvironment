import config from '../config';
import CookieHelper from '../utils/CookieHelper';
import TokenRefreshService from "./TokenRefreshRequests";

class UserRequests {
  /**
   * Login user with secure backend endpoint
   * @param {Object} credentials - Username and password
   * @returns {Promise<Object>} - Login result
   */
  async login(credentials) {
    this.validateCredentials(credentials);

    try {
      const response = await fetch(config.api.getUsersLoginUrl(), {
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

      return {
        success: true,
        message: responseData.message || 'Login successful'
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
      const response = await fetch(config.api.getUsersBaseUrl(), {
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
        config.api.getUserDeleteUrl(userId),
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
      const response = await fetch(config.api.getUsersLogoutUrl(), {
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

      const clearedCookies = CookieHelper.clearAllCookies();

      return {
        success: true,
        message: 'Logged out (backend failed, frontend cleanup only)',
        cookies_cleared: clearedCookies.length
      };
    }
  }

  /**
   * Check if user is authenticated via backend verification
   * @returns {Promise<boolean>} - Authentication status
   */
  async isAuthenticated() {
    try {
      const response = await fetch(config.api.getUsersVerifyAuthUrl(), {
        credentials: 'include'
      });

      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      return result.authenticated === true;

    } catch (error) {
      console.warn('Auth check failed:', error);
      return false;
    }
  }

  /**
   * Get current user information from cookies and backend
   * @returns {Promise<Object|null>} - User data or null
   */
  async getCurrentUserInfo() {
    try {
      const username = CookieHelper.getUsername();

      if (!username) {
        return null;
      }

      const response = await fetch(config.api.getUsersVerifyAuthUrl(), {
        credentials: 'include'
      });

      if (!response.ok) {
        return null;
      }

      const result = await response.json();

      if (result.authenticated && result.user) {
        return {
          username: username,
          userId: result.user.userId,
          tokenExpiry: result.user.tokenExpiry,
          isAuthenticated: true
        };
      }

      return null;

    } catch (error) {
      console.warn('Get user info failed:', error);
      return null;
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
}

const userService = new UserRequests();
export default userService;