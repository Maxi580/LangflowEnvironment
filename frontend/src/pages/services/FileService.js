import config from '../../config';

/**
 * Service for managing files in the application
 */
class FileService {
  /**
   * Fetches all files from the backend, optionally filtered by flow ID
   * @param {string} flowId - Optional flow ID to filter files
   * @returns {Promise<Array>} - Promise resolving to an array of file objects
   */
  async fetchFiles(flowId) {
    try {
      // Add flow_id parameter if it's available to filter files by current flow
      const url = flowId
        ? `${config.api.getFilesUrl()}?flow_id=${encodeURIComponent(flowId)}`
        : config.api.getFilesUrl();

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Error fetching files: ${response.status}`);
      }

      const data = await response.json();

      if (data.files) {
        return data.files;
      } else {
        console.error("Unexpected files response format:", data);
        return [];
      }
    } catch (err) {
      console.error("Failed to fetch files:", err);
      throw err;
    }
  }

  /**
   * Uploads files to the backend
   * @param {FileList|File[]} files - Files to upload
   * @param {string} flowId - Flow ID to associate files with
   * @returns {Promise<Object>} - Result of the upload operation
   */
  async uploadFiles(files, flowId) {
    if (!files || !files.length) {
      throw new Error("No files provided");
    }

    if (!flowId) {
      throw new Error("Flow ID is required");
    }

    try {
      const formData = new FormData();

      // Append all selected files to FormData
      for (let i = 0; i < files.length; i++) {
        formData.append('file', files[i]);
      }

      // Use the upload URL with the flow_id parameter
      const uploadUrl = `${config.api.getUploadUrl()}?flow_id=${encodeURIComponent(flowId)}`;

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Failed to upload files: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error('Error uploading files:', err);
      throw err;
    }
  }

  /**
   * Deletes a file from the backend and Qdrant storage
   * @param {string} filePath - Path to the file to delete
   * @param {string} flowId - ID of the flow associated with the file
   * @returns {Promise<Object>} - Result of the deletion operation
   */
  async deleteFile(filePath, flowId) {
    if (!filePath) {
      throw new Error("File path is required");
    }

    if (!flowId) {
      throw new Error("Flow ID is required");
    }

    try {
      const response = await fetch(config.api.getFilesUrl(), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file_path: filePath,
          flow_id: flowId
        })
      });

      if (!response.ok) {
        throw new Error(`Delete failed with status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Gets available embedding models from the backend
   * @returns {Promise<Array>} - List of available embedding models
   */
  async getEmbeddingModels() {
    try {
      const response = await fetch(config.api.getModelsUrl());

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('Error fetching embedding models:', error);
      throw error;
    }
  }

  /**
   * Checks server status (Ollama and Qdrant connectivity)
   * @param {string} flowId - Optional flow ID to check collection existence
   * @returns {Promise<Object>} - Server status object with connection states
   */
  async checkServerStatus(flowId) {
    try {
      // Pass the current flow ID as a query parameter if available
      const url = flowId
        ? `${config.api.getStatusUrl()}?flow_id=${encodeURIComponent(flowId)}`
        : config.api.getStatusUrl();

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch server status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error checking server status:', error);
      throw error;
    }
  }

  /**
   * Gets file details by ID
   * @param {string} fileId - ID of the file to retrieve
   * @param {string} flowId - Flow ID associated with the file
   * @returns {Promise<Object>} - File details
   */
  async getFileById(fileId, flowId) {
    if (!fileId) {
      throw new Error("File ID is required");
    }

    if (!flowId) {
      throw new Error("Flow ID is required");
    }

    try {
      const url = `${config.api.getFilesUrl()}/${fileId}?flow_id=${encodeURIComponent(flowId)}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to get file: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting file details:', error);
      throw error;
    }
  }

  /**
   * Formats file size for display
   * @param {number} bytes - Size in bytes
   * @returns {string} - Formatted size string
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  }
}

const fileService = new FileService();
export default fileService;