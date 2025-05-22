import config from '../config';
import authService from './AuthService'; // Import the AuthService

class UserService {
  /**
   * Parses JWT token to extract payload
   * @param {string} token - JWT token
   * @returns {Object} - Parsed token payload
   */
  parseJWT(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      throw new Error('Invalid JWT token');
    }
  }

  /**
   * Logs in a user to LangFlow and starts token management
   * @param {Object} credentials - Username and password
   * @returns {Promise<Object>} - Login result with user info
   */
  async login(credentials) {
    if (!credentials.username || !credentials.password) {
      throw new Error("Username and password are required");
    }

    try {
      console.log('🔐 Attempting login to LangFlow...');
      const loginUrl = `${config.api.langflowUrl}/api/v1/login`;

      const formData = new FormData();
      formData.append('username', credentials.username);
      formData.append('password', credentials.password);
      formData.append('grant_type', 'password');

      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json'
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail ||
          `Login failed: ${response.status} ${response.statusText}`
        );
      }

      const tokenData = await response.json();
      console.log('✅ Login successful, received tokens');

      const userInfo = this.parseJWT(tokenData.access_token);

      if (tokenData.access_token) {
        localStorage.setItem('langflow_access_token', tokenData.access_token);
      }
      if (tokenData.token_type) {
        localStorage.setItem('langflow_token_type', tokenData.token_type);
      }
      if (tokenData.refresh_token) {
        localStorage.setItem('langflow_refresh_token', tokenData.refresh_token);
      }

      localStorage.setItem('current_user', credentials.username);
      localStorage.setItem('user_id', userInfo.sub);

      console.log('🔄 Starting AuthService token management...');
      authService.setToken(tokenData.access_token, tokenData.refresh_token);

      const result = {
        success: true,
        user: {
          username: credentials.username,
          userId: userInfo.sub,
          tokenExpiry: userInfo.exp
        },
        tokens: tokenData
      };

      console.log('🎉 Login complete with token management active');
      return result;
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  }

  /**
   * Logs out user and stops token management
   */
  async logout() {
    try {
      console.log('🚪 Logging out user...');

      authService.clearToken();

      const token = localStorage.getItem('langflow_access_token');
      if (token) {
        try {
          await fetch(`${config.api.langflowUrl}/api/v1/logout`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.log('Server logout notification failed (this is often normal):', error.message);
        }
      }

      localStorage.removeItem('langflow_access_token');
      localStorage.removeItem('langflow_token_type');
      localStorage.removeItem('langflow_refresh_token');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
      localStorage.removeItem('user_id');
      localStorage.removeItem('langflow_flowId');
      localStorage.removeItem('langflow_session_id');

      console.log('✅ Logout complete');
    } catch (error) {
      console.error('Error during logout:', error);
      authService.clearToken();
      localStorage.clear();
    }
  }

  /**
   * Gets current user info
   * @returns {Object|null} - Current user or null
   */
  getCurrentUser() {
    const username = localStorage.getItem('current_user');
    const userId = localStorage.getItem('user_id');
    const token = localStorage.getItem('langflow_access_token');

    if (!username || !token) {
      return null;
    }

    try {
      const tokenPayload = this.parseJWT(token);
      return {
        username,
        userId: userId || tokenPayload.sub,
        tokenExpiry: tokenPayload.exp,
        isAuthenticated: true
      };
    } catch (error) {
      return username ? { username, userId, isAuthenticated: false } : null;
    }
  }

  /**
   * Checks if user is currently authenticated
   * Uses AuthService for accurate token validation
   * @returns {Promise<boolean>} - True if authenticated
   */
  async isAuthenticated() {
    // Use AuthService for accurate authentication check
    return await authService.isAuthenticated();
  }

  /**
   * Gets user authentication status with details
   * @returns {Promise<Object>} - Detailed auth status
   */
  async getAuthStatus() {
    const isAuth = await this.isAuthenticated();
    const user = this.getCurrentUser();

    return {
      isAuthenticated: isAuth,
      user: user,
      tokenExpiry: user?.tokenExpiry,
      timeUntilExpiry: authService.getTimeUntilExpiry(),
      timeUntilRefresh: authService.getTimeUntilNextRefresh(),
      isRefreshing: authService.isCurrentlyRefreshing()
    };
  }

  /**
   * Creates a new user account
   * @param {Object} userData - The user data containing username and password
   * @returns {Promise<Object>} - Result of the user creation operation
   */
  async createUser(userData) {
    if (!userData.username || !userData.password) {
      throw new Error("Username and password are required");
    }

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
        throw new Error(
          errorData.detail ||
          `Failed to create user: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Deletes a user account
   * @param {string} userId - ID of the user to delete
   * @returns {Promise<Object>} - Result of the deletion operation
   */
  async deleteUser(userId) {
    if (!userId) {
      throw new Error("User ID is required");
    }

    try {
      // Use AuthService for authenticated requests
      const response = await authService.authenticatedFetch(
        `${config.api.getBackendUrl()}/api/users/${userId}`,
        {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail ||
          `Failed to delete user: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Registers for AuthService events
   * @param {Function} callback - Callback for auth events
   */
  onAuthEvent(callback) {
    authService.addTokenUpdateListener(callback);
  }

  /**
   * Unregisters from AuthService events
   * @param {Function} callback - Callback to remove
   */
  offAuthEvent(callback) {
    authService.removeTokenUpdateListener(callback);
  }

  /**
   * Force a manual token refresh
   * @returns {Promise<boolean>} - True if refresh successful
   */
  async refreshAuth() {
    return await authService.refreshTokenManually();
  }
}

const userService = new UserService();
export default userService;