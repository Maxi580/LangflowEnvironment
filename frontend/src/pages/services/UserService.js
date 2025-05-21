import config from '../../config';


class UserService {
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
      const response = await fetch(`${config.api.getBackendUrl()}/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json'
        }
      });

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
}

const userService = new UserService();
export default userService;