import config from '../config';

/**
 * Service for handling message-related functionality with LangFlow
 */
class MessageService {
  /**
   * Extracts the actual text message from LangFlow's complex response structure
   * @param {Object} data - The response data from LangFlow
   * @returns {string} - The extracted text message
   */
  extractBotResponse(data) {
    try {
      // Check for empty outputs array
      if (data.outputs && data.outputs.length > 0) {
        const firstOutput = data.outputs[0];

        // Check if outputs is empty array
        if (firstOutput.outputs && firstOutput.outputs.length === 0) {
          return "No response received from LangFlow. The agent may not have generated any output.";
        }

        if (firstOutput.outputs && firstOutput.outputs.length > 0) {
          const messageOutput = firstOutput.outputs[0];

          // Try to get from messages array first
          if (messageOutput.messages && messageOutput.messages.length > 0) {
            return messageOutput.messages[0].message;
          }

          // Try results.message.text if messages isn't available
          if (messageOutput.results?.message?.text) {
            return messageOutput.results.message.text;
          }

          // Try direct message property
          if (messageOutput.message?.message) {
            return messageOutput.message.message;
          }
        }
      }

      // Fallbacks for different response structures
      if (data.result) {
        return data.result;
      }

      if (data.output) {
        return data.output;
      }

      if (typeof data === 'string') {
        return data;
      }

      // Check if we have outputs array but with empty outputs
      if (data.outputs && data.outputs.length > 0 &&
          data.outputs[0].outputs && data.outputs[0].outputs.length === 0) {
        return "No response received from LangFlow. The agent may not have generated any output.";
      }

      // Last resort: stringify the response but warn the user
      return `Response format unexpected. Please check your LangFlow configuration. Raw response: ${JSON.stringify(data).slice(0, 100)}...`;
    } catch (err) {
      console.error("Error extracting bot response:", err);
      return "Failed to parse response. Please check your LangFlow configuration.";
    }
  }

  /**
   * Sends a message to LangFlow and processes the response
   * @param {string} message - The user message to send
   * @param {string} flowId - The ID of the flow to use
   * @param {Array} files - Array of available files
   * @returns {Promise<Object>} - The processed response
   */
  async sendMessage(message, flowId, files = []) {
    if (!message.trim()) {
      throw new Error("Message cannot be empty");
    }

    if (!flowId) {
      throw new Error("No Flow ID set. Please select a flow first.");
    }

    try {
      const apiUrl = config.api.getRunUrl(flowId);

      // Create a list of file references if files are provided
      const fileReferences = files.length > 0
        ? files.map(file => `${file.file_name} (${file.file_type})`).join(", ")
        : "";

      // Create a formatted input string with mention of available files
      const formattedMessage = fileReferences
        ? `${message}\n\nAvailable files: ${fileReferences}`
        : message;

      // Get or create a session ID for conversation continuity
      const sessionId = localStorage.getItem('langflow_session_id') || `session_${Date.now()}`;

      // Store the session ID if it doesn't exist yet
      if (!localStorage.getItem('langflow_session_id')) {
        localStorage.setItem('langflow_session_id', sessionId);
      }

      const payload = {
        input_value: formattedMessage,
        output_type: 'chat',
        input_type: 'chat',
        session_id: sessionId
      };

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      };

      // Make API call to LangFlow
      const response = await fetch(apiUrl, options);

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      console.log("LangFlow response:", data);

      // Extract the actual text response
      const botResponse = this.extractBotResponse(data);

      return {
        id: Date.now(),
        text: botResponse,
        sender: 'bot',
        timestamp: new Date(),
        rawResponse: data // Include the raw response for debugging if needed
      };
    } catch (err) {
      console.error('Error calling LangFlow API:', err);
      throw err;
    }
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
   * Generates a unique session ID
   * @returns {string} - New session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Gets the current session ID or creates a new one
   * @returns {string} - Session ID
   */
  getSessionId() {
    const sessionId = localStorage.getItem('langflow_session_id');

    if (!sessionId) {
      const newSessionId = this.generateSessionId();
      localStorage.setItem('langflow_session_id', newSessionId);
      return newSessionId;
    }

    return sessionId;
  }
}

const messageService = new MessageService();
export default messageService;