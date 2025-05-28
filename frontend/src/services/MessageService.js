import config from '../config';
import TokenRefreshService from './TokenRefreshService';


class MessageService {
  constructor() {
    this.BACKEND_BASE_URL = config.api.backendUrl;
    this.currentSessionId = null;
  }

  /**
   * Sends a message to LangFlow via the backend
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
      // Create file references if files are provided
      const fileReferences = files.length > 0
          ? files.map(file => `${file.file_name} (${file.file_type})`).join(", ")
          : "";

      // Format message with file references
      const formattedMessage = fileReferences
          ? `${message}\n\nAvailable files: ${fileReferences}`
          : message;

      // Prepare payload with session_id using getter
      const payload = {
        message: formattedMessage,
        flow_id: flowId,
        session_id: this.getCurrentSessionId() // Use getter method
      };

      const messageUrl = `${this.BACKEND_BASE_URL}/api/messages/send`;

      console.log("Sending message to backend:", payload);

      // Make authenticated request to backend
      const response = await TokenRefreshService.authenticatedFetch(messageUrl, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || `Request failed: ${response.status}`;
        } catch (parseError) {
          errorMessage = `Request failed: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("Backend response:", data);

      if (!data.success) {
        throw new Error(data.error || "Failed to get response from LangFlow");
      }

      // Update current session ID from response using setter
      if (data.session_id) {
        this.setCurrentSessionId(data.session_id);
      }

      // Return formatted message object
      return {
        id: Date.now(),
        text: data.response,
        sender: 'bot',
        timestamp: new Date(),
        sessionId: data.session_id, // Include session ID in response
        rawResponse: data.raw_response
      };

    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Creates a user message object
   * @param {string} text - User message text
   * @returns {Object} - User message object
   */
  createUserMessage(text) {
    return {
      id: Date.now(),
      text,
      sender: 'user',
      timestamp: new Date()
    };
  }

  /**
   * Creates a system message object
   * @param {string} text - System message text
   * @returns {Object} - System message object
   */
  createSystemMessage(text) {
    return {
      id: Date.now(),
      text,
      sender: 'system',
      timestamp: new Date()
    };
  }

  /**
   * Creates an error message object
   * @param {string} text - Error message text
   * @returns {Object} - Error message object
   */
  createErrorMessage(text) {
    return {
      id: Date.now(),
      text,
      sender: 'error',
      timestamp: new Date()
    };
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

  /**
   * Clears the current session (starts a new conversation)
   */
  clearSession() {
    this.currentSessionId = null;
    console.log("Session cleared - new conversation will start");
  }
}

const messageService = new MessageService();
export default messageService;