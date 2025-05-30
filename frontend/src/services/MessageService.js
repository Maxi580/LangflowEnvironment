import config from '../config';
import TokenRefreshService from './TokenRefreshService';

// Helper functions (moved from MessageParser since we only need these)
const generateSessionId = () => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  return `session_${timestamp}_${randomString}`;
};

const formatFileReferences = (files) => {
  if (!files || files.length === 0) return null;

  return files.map(file => {
    const name = file.name || file.filename || 'Unknown';
    const type = file.type || file.file_type || 'Unknown';
    return `${name} (${type})`;
  }).join(', ');
};

const createMessage = (text, sender, metadata = {}) => {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    text: text,
    sender: sender, // 'user', 'bot', 'system', 'error'
    timestamp: new Date().toISOString(),
    metadata: metadata
  };
};

class MessageService {
  constructor() {
    this.BACKEND_BASE_URL = config.api.backendUrl;
    this.currentSessionId = null;
  }

  /**
   * Sends a message via backend (server handles all API key management)
   * @param {string} message - The user message to send
   * @param {string} flowId - The ID of the flow to use
   * @param {Array} files - Array of available files (optional)
   * @returns {Promise<Object>} - The bot response object
   */
  async sendMessage(message, flowId, files = []) {
    if (!message.trim()) {
      throw new Error("Message cannot be empty");
    }

    if (!flowId) {
      throw new Error("Flow ID is required");
    }

    try {
      // Format message with file references if provided
      const fileReferences = formatFileReferences(files);
      const formattedMessage = fileReferences
        ? `${message}\n\nAvailable files: ${fileReferences}`
        : message;

      // Generate session ID if not set
      const sessionId = this.getCurrentSessionId() || generateSessionId();

      // Prepare payload for backend
      const payload = {
        message: formattedMessage,
        flow_id: flowId,
        session_id: sessionId
      };

      console.log("Sending message via backend:", {
        flowId,
        sessionId,
        hasFiles: files.length > 0
      });

      // Send to backend (which handles all API key management)
      const response = await TokenRefreshService.authenticatedFetch(
        config.api.getMessagesSendUrl(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || `Request failed: ${response.status}`;
        } catch (parseError) {
          errorMessage = `Request failed: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      console.log("Backend response received:", responseData.success);

      // Update session ID from response
      this.setCurrentSessionId(responseData.session_id);

      // Return formatted message object using helper
      return createMessage(responseData.response, 'bot', {
        sessionId: responseData.session_id,
        rawResponse: responseData.raw_response,
        flowId
      });

    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Clear the current session
   * @returns {Promise<string>} - New session ID
   */
  async clearSession() {
    try {
      // Generate new session ID
      const newSessionId = generateSessionId();
      this.setCurrentSessionId(newSessionId);

      console.log("Session cleared - new session:", newSessionId);
      return newSessionId;

    } catch (error) {
      console.warn('Error during session clear:', error);
      // Fallback to local clear
      this.currentSessionId = null;
      console.log("Session cleared locally");
      return null;
    }
  }

  /**
   * Get session info from backend
   * @param {string} sessionId - Session ID to check
   * @returns {Promise<Object>} - Session information
   */
  async getSessionInfo(sessionId) {
    try {
      const response = await TokenRefreshService.authenticatedFetch(
        config.api.getMessagesSessionUrl(sessionId),
        { credentials: 'include' }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Session info retrieved:", data);
        return data;
      } else {
        console.warn("Failed to get session info:", response.status);
        return null;
      }
    } catch (error) {
      console.error('Error getting session info:', error);
      return null;
    }
  }

  /**
   * Cleanup any persistent API keys (if using the API key endpoints)
   * @returns {Promise<boolean>} - Success status
   */
  async cleanup() {
    try {
      console.log("Cleaning up any persistent API keys...");

      // Use the API key cleanup endpoint to remove any persistent keys
      const response = await TokenRefreshService.authenticatedFetch(
        `${this.BACKEND_BASE_URL}/api/api-keys`,
        {
          method: 'DELETE',
          credentials: 'include'
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Cleanup completed:", data.message);
        console.log(`Deleted ${data.deleted_count} API key(s)`);
        this.currentSessionId = null;
        return true;
      } else {
        console.warn("Cleanup request failed:", response.status);
        // Still clear local state on failure
        this.currentSessionId = null;
        return false;
      }

    } catch (error) {
      console.error('Error during cleanup:', error);
      // Still clear local state
      this.currentSessionId = null;
      return false;
    }
  }

  /**
   * Test backend message service connectivity
   * @returns {Promise<boolean>} - True if backend is reachable
   */
  async testConnection() {
    try {
      const response = await TokenRefreshService.authenticatedFetch(
        config.api.getMessagesSessionUrl('test'),
        { credentials: 'include' }
      );

      const isConnected = response.ok;
      console.log(`Backend message service: ${isConnected ? 'Connected' : 'Disconnected'}`);
      return isConnected;

    } catch (error) {
      console.error('Error testing backend connection:', error);
      return false;
    }
  }

  /**
   * Creates a user message object using helper
   * @param {string} text - User message text
   * @returns {Object} - User message object
   */
  createUserMessage(text) {
    return createMessage(text, 'user');
  }

  /**
   * Creates a system message object using helper
   * @param {string} text - System message text
   * @returns {Object} - System message object
   */
  createSystemMessage(text) {
    return createMessage(text, 'system');
  }

  /**
   * Creates an error message object using helper
   * @param {string} text - Error message text
   * @returns {Object} - Error message object
   */
  createErrorMessage(text) {
    return createMessage(text, 'error');
  }

  /**
   * Gets the current session ID
   * @returns {string|null} - Current session ID or null
   */
  getCurrentSessionId() {
    return this.currentSessionId;
  }

  /**
   * Sets the current session ID
   * @param {string} sessionId - Session ID to set
   */
  setCurrentSessionId(sessionId) {
    this.currentSessionId = sessionId;
    console.log("Session ID set to:", sessionId);
  }
}

const messageService = new MessageService();
export default messageService;