import config from '../config';
import TokenRefreshService from './TokenRefreshRequests';

// Helper functions
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

const validateFiles = (files) => {
  const maxFileSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = [
    'text/plain',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/json',
    'text/csv',
    'text/markdown',
    'text/html',
    'text/css',
    'text/javascript',
    'application/javascript',
    'text/xml',
    'application/xml',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'image/webp'
  ];

  for (let file of files) {
    // Check file size
    if (file.size > maxFileSize) {
      throw new Error(`File "${file.name}" exceeds maximum size of 10MB`);
    }

    // Check file type (if specified)
    if (file.type && !allowedTypes.includes(file.type)) {
      // Also check by extension for files without proper MIME types
      const extension = file.name.split('.').pop()?.toLowerCase();
      const extensionMap = {
        'txt': 'text/plain',
        'pdf': 'application/pdf',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'json': 'application/json',
        'csv': 'text/csv',
        'md': 'text/markdown',
        'html': 'text/html',
        'css': 'text/css',
        'js': 'text/javascript',
        'py': 'text/plain',
        'xml': 'text/xml',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'bmp': 'image/bmp',
        'tiff': 'image/tiff',
        'webp': 'image/webp'
      };

      if (!extensionMap[extension]) {
        throw new Error(`File type not supported: "${file.name}"`);
      }
    }
  }
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
   * @param {Array} persistentFiles - Array of persistent collection files (optional)
   * @returns {Promise<Object>} - The bot response object
   */
  async sendMessage(message, flowId, persistentFiles = []) {
    return this.sendMessageWithFiles(message, flowId, persistentFiles, []);
  }

  /**
   * Sends a message with attached files via backend
   * @param {string} message - The user message to send
   * @param {string} flowId - The ID of the flow to use
   * @param {Array} persistentFiles - Array of persistent collection files (optional)
   * @param {Array} attachedFiles - Array of File objects to attach to this message
   * @returns {Promise<Object>} - The bot response object
   */
  async sendMessageWithFiles(message, flowId, persistentFiles = [], attachedFiles = []) {
    if (!message.trim() && attachedFiles.length === 0) {
      throw new Error("Message cannot be empty and no files attached");
    }

    if (!flowId) {
      throw new Error("Flow ID is required");
    }

    // Validate attached files
    if (attachedFiles.length > 0) {
      validateFiles(attachedFiles);
    }

    try {
      // Generate session ID if not set
      const sessionId = this.getCurrentSessionId() || generateSessionId();

      // Create FormData for multipart upload
      const formData = new FormData();

      // Add basic message data
      formData.append('message', message.trim() || '');
      formData.append('flow_id', flowId);
      formData.append('session_id', sessionId);

      // Add persistent file references if available
      if (persistentFiles.length > 0) {
        const persistentFileReferences = formatFileReferences(persistentFiles);
        formData.append('persistent_files_info', persistentFileReferences);
      }

      // Add attached files
      attachedFiles.forEach((file, index) => {
        formData.append(`attached_files`, file);
      });

      console.log("Sending message with files via backend:", {
        flowId,
        sessionId,
        messageLength: message.length,
        attachedFilesCount: attachedFiles.length,
        persistentFilesCount: persistentFiles.length
      });

      // Send to backend
      const response = await TokenRefreshService.authenticatedFetch(
        config.api.getMessagesSendUrl(),
        {
          method: 'POST',
          credentials: 'include',
          body: formData // Don't set Content-Type header, let browser set it with boundary
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

      // Return formatted message object
      return createMessage(responseData.response, 'bot', {
        sessionId: responseData.session_id,
        rawResponse: responseData.raw_response,
        flowId,
        processedFiles: responseData.processed_files || []
      });

    } catch (error) {
      console.error('Error sending message with files:', error);
      throw error;
    }
  }

  /**
   * Upload files directly to a message endpoint (alternative approach)
   * @param {string} message - The user message
   * @param {string} flowId - The ID of the flow to use
   * @param {Array} files - Array of File objects
   * @returns {Promise<Object>} - The response from the upload
   */
  async sendMessageWithDirectUpload(message, flowId, files = []) {
    if (!flowId) {
      throw new Error("Flow ID is required");
    }

    if (files.length === 0 && !message.trim()) {
      throw new Error("Either message or files must be provided");
    }

    // Validate files
    if (files.length > 0) {
      validateFiles(files);
    }

    try {
      const sessionId = this.getCurrentSessionId() || generateSessionId();

      // Create FormData
      const formData = new FormData();
      formData.append('message', message || '');
      formData.append('flow_id', flowId);
      formData.append('session_id', sessionId);

      // Add processing options
      formData.append('chunk_size', '1000');
      formData.append('chunk_overlap', '200');
      formData.append('include_images', 'true');

      // Add files
      files.forEach((file) => {
        formData.append('files', file);
      });

      console.log("Sending direct upload message:", {
        flowId,
        sessionId,
        filesCount: files.length
      });

      // Send to a dedicated endpoint for direct file processing
      const response = await TokenRefreshService.authenticatedFetch(
        `${this.BACKEND_BASE_URL}/api/messages/send-with-upload`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData
        }
      );

      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || `Upload failed: ${response.status}`;
        } catch (parseError) {
          errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      this.setCurrentSessionId(responseData.session_id);

      return createMessage(responseData.response, 'bot', {
        sessionId: responseData.session_id,
        rawResponse: responseData.raw_response,
        flowId,
        uploadedFiles: responseData.uploaded_files || []
      });

    } catch (error) {
      console.error('Error in direct upload:', error);
      throw error;
    }
  }

  /**
   * Clear the current session
   * @returns {Promise<string>} - New session ID
   */
  async clearSession() {
    try {
      const newSessionId = generateSessionId();
      this.setCurrentSessionId(newSessionId);
      console.log("Session cleared - new session:", newSessionId);
      return newSessionId;
    } catch (error) {
      console.warn('Error during session clear:', error);
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
   * Cleanup any persistent API keys
   * @returns {Promise<boolean>} - Success status
   */
  async cleanup() {
    try {
      console.log("Cleaning up any persistent API keys...");

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
        this.currentSessionId = null;
        return false;
      }

    } catch (error) {
      console.error('Error during cleanup:', error);
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
   * Creates a user message object
   * @param {string} text - User message text
   * @param {Object} metadata - Additional metadata (e.g., attached files info)
   * @returns {Object} - User message object
   */
  createUserMessage(text, metadata = {}) {
    return createMessage(text, 'user', metadata);
  }

  /**
   * Creates a system message object
   * @param {string} text - System message text
   * @returns {Object} - System message object
   */
  createSystemMessage(text) {
    return createMessage(text, 'system');
  }

  /**
   * Creates an error message object
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

  /**
   * Utility method to get file info for display
   * @param {File} file - File object
   * @returns {Object} - File information object
   */
  getFileInfo(file) {
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      formattedSize: this.formatFileSize(file.size)
    };
  }

  /**
   * Format file size in human readable format
   * @param {number} bytes - File size in bytes
   * @returns {string} - Formatted file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Check if file type is supported
   * @param {File} file - File to check
   * @returns {boolean} - True if supported
   */
  isFileTypeSupported(file) {
    try {
      validateFiles([file]);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get supported file extensions
   * @returns {Array} - Array of supported extensions
   */
  getSupportedExtensions() {
    return [
      '.txt', '.pdf', '.docx', '.xlsx', '.pptx',
      '.md', '.json', '.csv', '.py', '.js',
      '.html', '.css', '.xml', '.jpg', '.jpeg',
      '.png', '.gif', '.bmp', '.tiff', '.webp'
    ];
  }
}

const messageService = new MessageService();
export default messageService;