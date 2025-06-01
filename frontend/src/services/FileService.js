import config from '../config';
import TokenRefreshService from './TokenRefreshService';

/**
 * Service for managing files and collections in the application
 * Updated to work with the new collection-based backend API
 */
class FileService {
  constructor() {
    this.COLLECTIONS_BASE_URL = `${config.api.backendUrl}/api/files`;
  }

  /**
   * Creates a new collection
   * @param {string} collectionName - Name of the collection to create
   * @param {string} embeddingModel - Embedding model to use (default: 'nomic-embed-text')
   * @returns {Promise<Object>} - Result of the creation operation
   */
  async createCollection(collectionName, embeddingModel = 'nomic-embed-text') {
    if (!collectionName) {
      throw new Error("Collection name is required");
    }

    try {
      const response = await TokenRefreshService.authenticatedFetch(
        this.COLLECTIONS_BASE_URL,
        {
          method: 'POST',
          body: JSON.stringify({
            collection_name: collectionName,
            embedding_model: embeddingModel
          })
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
   * Deletes a collection
   * @param {string} collectionName - Name of the collection to delete
   * @returns {Promise<Object>} - Result of the deletion operation
   */
  async deleteCollection(collectionName) {
    if (!collectionName) {
      throw new Error("Collection name is required");
    }

    try {
      const response = await TokenRefreshService.authenticatedFetch(
        `${this.COLLECTIONS_BASE_URL}/${encodeURIComponent(collectionName)}`,
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
   * Lists all collections
   * @returns {Promise<Array>} - List of collections
   */
  async listCollections() {
    try {
      const response = await TokenRefreshService.authenticatedFetch(
        this.COLLECTIONS_BASE_URL,
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
   * Fetches all files from a specific collection (replaces the old fetchFiles method)
   * @param {string} flowId - Flow ID (collection name) to filter files
   * @returns {Promise<Array>} - Promise resolving to an array of file objects
   */
  async fetchFiles(flowId) {
    if (!flowId) {
      return [];
    }

    try {
      const response = await TokenRefreshService.authenticatedFetch(
        `${this.COLLECTIONS_BASE_URL}/${encodeURIComponent(flowId)}/files`,
        {
          method: 'GET'
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          // Collection doesn't exist, try to create it first
          console.log(`Collection '${flowId}' not found, creating it...`);
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
   * @param {string} flowId - Flow ID (collection name) to associate files with
   * @param {Object} options - Upload options
   * @param {string} options.embeddingModel - Embedding model to use
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
      embeddingModel = 'nomic-embed-text',
      chunkSize = 1000,
      chunkOverlap = 200
    } = options;

    try {
      // Ensure collection exists first
      try {
        await this.createCollection(flowId, embeddingModel);
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
        formData.append('embedding_model', embeddingModel);
        formData.append('chunk_size', chunkSize.toString());
        formData.append('chunk_overlap', chunkOverlap.toString());

        try {
          const response = await TokenRefreshService.authenticatedFetch(
            `${this.COLLECTIONS_BASE_URL}/${encodeURIComponent(flowId)}/files/upload`,
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
   * @param {string} flowId - ID of the flow (collection name) associated with the file
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
      const response = await TokenRefreshService.authenticatedFetch(
        `${this.COLLECTIONS_BASE_URL}/${encodeURIComponent(flowId)}/files`,
        {
          method: 'DELETE',
          body: JSON.stringify({
            file_path: filePath,
            collection_name: flowId
          })
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
   * Gets available embedding models from the backend
   * @returns {Promise<Array>} - List of available embedding models
   */
  async getEmbeddingModels() {
    try {
      // This endpoint might need to be updated based on your backend
      const response = await TokenRefreshService.authenticatedFetch(
        `${config.api.backendUrl}/api/models`,
        {
          method: 'GET'
        }
      );

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
      // Check overall health
      const healthResponse = await fetch(`${config.api.backendUrl}/health`);

      if (!healthResponse.ok) {
        throw new Error(`Health check failed: ${healthResponse.status}`);
      }

      const healthData = await healthResponse.json();

      // If flowId is provided, check if collection exists
      if (flowId) {
        try {
          const collections = await this.listCollections();
          const collectionExists = collections.some(c => c.name === flowId);

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
   * Gets file details by ID (may need backend support)
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
   * Check if a collection exists
   * @param {string} collectionName - Name of the collection to check
   * @returns {Promise<boolean>} - True if collection exists
   */
  async collectionExists(collectionName) {
    try {
      const collections = await this.listCollections();
      return collections.some(c => c.name === collectionName);
    } catch (error) {
      console.error('Error checking collection existence:', error);
      return false;
    }
  }

  /**
   * Get collection info
   * @param {string} collectionName - Name of the collection
   * @returns {Promise<Object>} - Collection information
   */
  async getCollectionInfo(collectionName) {
    try {
      const collections = await this.listCollections();
      const collection = collections.find(c => c.name === collectionName);

      if (!collection) {
        throw new Error(`Collection '${collectionName}' not found`);
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