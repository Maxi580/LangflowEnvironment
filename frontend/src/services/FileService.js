import config from '../config';
import TokenRefreshService from './TokenRefreshService';

/**
 * Service for managing files and collections in the application
 * Updated to use automatic backend model selection
 */
class FileService {
  /**
   * Lists all collections
   * @returns {Promise<Array>} - Array of collection objects
   */
  async listCollections() {
    try {
      const response = await TokenRefreshService.authenticatedFetch(
        config.api.getCollectionsBaseUrl(),
        {
          method: 'GET'
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to list collections: ${response.status}`);
      }

      const data = await response.json();
      return data.collections || [];
    } catch (error) {
      console.error('Error listing collections:', error);
      throw error;
    }
  }

  /**
   * Creates a new collection using flow_id
   * @param {string} flowId - Flow ID to use as collection identifier
   * @returns {Promise<Object>} - Result of the creation operation
   */
  async createCollection(flowId) {
    if (!flowId) {
      throw new Error("Flow ID is required");
    }

    try {
      // URL: POST /api/collections/{flow_id}
      const response = await TokenRefreshService.authenticatedFetch(
        config.api.getCollectionCreateUrl(flowId),
        {
          method: 'POST'
          // Backend uses automatic model selection - no body needed
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to create collection: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating collection:', error);
      throw error;
    }
  }

  /**
   * Deletes a collection by flow_id
   * @param {string} flowId - Flow ID of the collection to delete
   * @returns {Promise<Object>} - Result of the deletion operation
   */
  async deleteCollection(flowId) {
    if (!flowId) {
      throw new Error("Flow ID is required");
    }

    try {
      // URL: DELETE /api/collections/{flow_id}
      const response = await TokenRefreshService.authenticatedFetch(
        config.api.getCollectionDeleteUrl(flowId),
        {
          method: 'DELETE'
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to delete collection: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting collection:', error);
      throw error;
    }
  }

  /**
   * Fetches all files from a specific collection
   * @param {string} flowId - Flow ID (collection identifier)
   * @returns {Promise<Array>} - Promise resolving to an array of file objects
   */
  async fetchFiles(flowId) {
    if (!flowId) {
      return [];
    }

    try {
      // URL: GET /api/collections/{flow_id}/files
      const response = await TokenRefreshService.authenticatedFetch(
        config.api.getCollectionFilesUrl(flowId),
        {
          method: 'GET'
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          // Collection doesn't exist, try to create it first
          console.log(`Collection for flow '${flowId}' not found, creating it...`);
          await this.createCollection(flowId);
          // Return empty array for new collection
          return [];
        }
        throw new Error(`Error fetching files: ${response.status}`);
      }

      const data = await response.json();
      return data.files || [];
    } catch (err) {
      console.error("Failed to fetch files:", err);
      throw err;
    }
  }

  /**
   * Uploads files to a specific collection
   * @param {FileList|File[]} files - Files to upload
   * @param {string} flowId - Flow ID (collection identifier)
   * @param {Object} options - Upload options
   * @param {number} options.chunkSize - Chunk size for text splitting
   * @param {number} options.chunkOverlap - Chunk overlap for text splitting
   * @returns {Promise<Object>} - Result of the upload operation
   */
  async uploadFiles(files, flowId, options = {}) {
    if (!files || !files.length) {
      throw new Error("No files provided");
    }

    if (!flowId) {
      throw new Error("Flow ID is required");
    }

    const {
      chunkSize = 1000,
      chunkOverlap = 200
    } = options;

    try {
      // Ensure collection exists first
      try {
        await this.createCollection(flowId);
      } catch (error) {
        // If collection already exists, that's fine
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }

      const uploadResults = [];

      // Upload files one by one to better handle errors
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('chunk_size', chunkSize.toString());
        formData.append('chunk_overlap', chunkOverlap.toString());

        try {
          // URL: POST /api/collections/{flow_id}/files/upload
          const response = await TokenRefreshService.authenticatedFetch(
            config.api.getCollectionUploadUrl(flowId),
            {
              method: 'POST',
              body: formData
            }
          );

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to upload ${file.name}: ${response.status}`);
          }

          const result = await response.json();
          uploadResults.push(result);
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error);
          // Continue with other files but track the error
          uploadResults.push({
            success: false,
            error: error.message,
            filename: file.name
          });
        }
      }

      // Return summary of all uploads
      const successCount = uploadResults.filter(r => r.success).length;
      const errorCount = uploadResults.length - successCount;

      return {
        success: errorCount === 0,
        message: errorCount === 0
          ? `Successfully uploaded ${successCount} file(s)`
          : `Uploaded ${successCount} file(s), ${errorCount} failed`,
        results: uploadResults,
        collection_name: flowId
      };

    } catch (err) {
      console.error('Error uploading files:', err);
      throw err;
    }
  }

  /**
   * Deletes a file from a collection
   * @param {string} filePath - Path to the file to delete
   * @param {string} flowId - Flow ID (collection identifier)
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
      // URL: DELETE /api/collections/{flow_id}/files?file_path=...
      const url = new URL(config.api.getCollectionFileDeleteUrl(flowId));
      url.searchParams.append('file_path', filePath);

      const response = await TokenRefreshService.authenticatedFetch(
        url.toString(),
        {
          method: 'DELETE'
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Delete failed with status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting file:', error);
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
      // Check overall health
      const healthResponse = await fetch(config.api.getHealthUrl());

      if (!healthResponse.ok) {
        throw new Error(`Health check failed: ${healthResponse.status}`);
      }

      const healthData = await healthResponse.json();

      // If flowId is provided, check if collection exists
      if (flowId) {
        try {
          const collections = await this.listCollections();
          const collectionExists = collections.some(c => c.flow_id === flowId || c.name === flowId);

          return {
            ...healthData,
            collection_exists: collectionExists,
            collection_name: flowId
          };
        } catch (error) {
          return {
            ...healthData,
            collection_exists: false,
            collection_error: error.message
          };
        }
      }

      return healthData;
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
      // Get all files and find the one with matching ID
      const files = await this.fetchFiles(flowId);
      const file = files.find(f => f.file_id === fileId);

      if (!file) {
        throw new Error(`File with ID ${fileId} not found in collection ${flowId}`);
      }

      return file;
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

  /**
   * Check if a collection exists by flow_id
   * @param {string} flowId - Flow ID to check
   * @returns {Promise<boolean>} - True if collection exists
   */
  async collectionExists(flowId) {
    try {
      const collections = await this.listCollections();
      return collections.some(c => c.flow_id === flowId || c.name === flowId);
    } catch (error) {
      console.error('Error checking collection existence:', error);
      return false;
    }
  }

  /**
   * Get collection info by flow_id
   * @param {string} flowId - Flow ID to get info for
   * @returns {Promise<Object>} - Collection information
   */
  async getCollectionInfo(flowId) {
    try {
      const collections = await this.listCollections();
      const collection = collections.find(c => c.flow_id === flowId || c.name === flowId);

      if (!collection) {
        throw new Error(`Collection for flow '${flowId}' not found`);
      }

      return collection;
    } catch (error) {
      console.error('Error getting collection info:', error);
      throw error;
    }
  }
}

const fileService = new FileService();
export default fileService;