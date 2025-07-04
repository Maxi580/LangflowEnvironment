import config from '../config';
import TokenRefreshService from './TokenRefreshRequests';

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
    sender: sender,
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
    this.currentSessionId = null;
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
      const sessionId = this.getCurrentSessionId() || generateSessionId();

      const formData = new FormData();

      formData.append('message', message.trim() || '');
      formData.append('flow_id', flowId);
      formData.append('session_id', sessionId);

      if (persistentFiles.length > 0) {
        const persistentFileReferences = formatFileReferences(persistentFiles);
        formData.append('persistent_files_info', persistentFileReferences);
      }

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

      const response = await TokenRefreshService.authenticatedFetch(
        config.api.getMessagesSendUrl(),
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
          errorMessage = errorData.detail || `Request failed: ${response.status}`;
        } catch (parseError) {
          errorMessage = `Request failed: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const responseData = await response.json();

      this.setCurrentSessionId(responseData.session_id);

     let generatedFiles = [];
    if (responseData.generated_files && Array.isArray(responseData.generated_files)) {
        generatedFiles = responseData.generated_files.map(file => ({
        filename: file.filename,
        content_type: file.content_type,
        size: file.size,
        base64_data: file.base64_data
        }));
        console.log(`${generatedFiles.length} generated file(s) received:`,
                 generatedFiles.map(f => f.filename));
    }

    return createMessage(responseData.response, 'bot', {
        sessionId: responseData.session_id,
        flowId,
        processedFiles: responseData.processed_files || [],
        generatedFiles: generatedFiles
    });

    } catch (error) {
      console.error('Error sending message with files:', error);
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
}

const messageService = new MessageService();
export default messageService;