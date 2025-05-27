import config from '../config';
import TokenRefreshService from './TokenRefreshService';

/**
 * Enhanced service for managing LangFlow flows with authentication
 */
class FlowService {
  constructor() {
    this.BACKEND_BASE_URL = config.api.backendUrl;
  }

  /**
   * Fetches all available flows from the LangFlow API with authentication
   * @param {Object} params - Query parameters
   * @param {boolean} params.removeExampleFlows - Whether to exclude example flows from results
   * @param {boolean} params.componentsOnly - Whether to return only components
   * @param {boolean} params.headerFlows - Whether to return only flow headers
   * @param {string} params.folderId - Optional folder ID to filter by
   * @returns {Promise<Array>} - Promise resolving to an array of flow objects
   */
  async getFlows({
    removeExampleFlows = true,
    componentsOnly = false,
    headerFlows = false,
    folderId = null
  } = {}) {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams({
        get_all: 'true', // Required for backward compatibility
        remove_example_flows: removeExampleFlows.toString(),
        components_only: componentsOnly.toString(),
        header_flows: headerFlows.toString()
      });

      if (folderId) {
        queryParams.append('folder_id', folderId);
      }

      const flowsUrl = `${this.BACKEND_BASE_URL}/api/langflow/flows?${queryParams.toString()}`;

      const response = await TokenRefreshService.authenticatedFetch(flowsUrl, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Error fetching flows: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        return data;
      } else {
        console.error("Unexpected flows response format:", data);
        return [];
      }
    } catch (error) {
      console.error("Failed to fetch flows:", error);
      throw error;
    }
  }

  /**
   * Uploads a flow file to LangFlow via backend
   * @param {File} file - Flow file to upload
   * @param {Object} options - Upload options
   * @param {string} options.folderId - Optional folder ID
   * @returns {Promise<Object>} - Uploaded flow details
   * @throws {Error} - If upload fails
   */
  async uploadFlowFile(file, { folderId = null } = {}) {
    if (!file) {
      throw new Error("File is required");
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      if (folderId) {
        formData.append('folder_id', folderId);
      }

      const uploadUrl = `${this.BACKEND_BASE_URL}/api/langflow/flows/upload`;

      const response = await TokenRefreshService.authenticatedFetch(uploadUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
          // Don't set Content-Type for multipart, browser handles it
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed with status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error uploading flow file:', error);
      throw error;
    }
  }

  /**
   * Deletes a flow from LangFlow
   * @param {string} flowId - ID of the flow to delete
   * @returns {Promise<Object>} - Result of the deletion operation
   * @throws {Error} - If deletion fails
   */
  async deleteFlow(flowId) {
    if (!flowId) {
      throw new Error("Flow ID is required");
    }

    try {
      const deleteUrl = `${this.BACKEND_BASE_URL}/api/langflow/flows/${flowId}`;

      const response = await TokenRefreshService.authenticatedFetch(deleteUrl, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Delete failed with status: ${response.status}`);
      }

      try {
        const result = await response.json();
        return result;
      } catch (e) {
        // Some APIs return empty response on successful deletion
        return { success: true, flowId, message: 'Flow deleted successfully' };
      }
    } catch (error) {
      console.error('Error deleting flow:', error);
      throw error;
    }
  }

  /**
   * Deletes multiple flows
   * @param {Array<string>} flowIds - Array of flow IDs to delete
   * @returns {Promise<Object>} - Result of the deletion operation
   */
  async deleteMultipleFlows(flowIds) {
    if (!flowIds || !Array.isArray(flowIds) || flowIds.length === 0) {
      throw new Error("Flow IDs array is required");
    }

    try {
      const deleteUrl = `${this.BACKEND_BASE_URL}/api/langflow/flows`;

      const response = await TokenRefreshService.authenticatedFetch(deleteUrl, {
        method: 'DELETE',
        body: JSON.stringify(flowIds)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Batch delete failed with status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting multiple flows:', error);
      throw error;
    }
  }

  /**
   * Gets a specific flow by ID
   * @param {string} flowId - ID of the flow to retrieve
   * @returns {Promise<Object>} - Flow details
   * @throws {Error} - If retrieval fails
   */
  async getFlowById(flowId) {
    if (!flowId) {
      throw new Error("Flow ID is required");
    }

    try {
      const url = `${this.BACKEND_BASE_URL}/api/langflow/flows/${flowId}`;

      const response = await TokenRefreshService.authenticatedFetch(url, {
        method: 'GET'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to get flow with status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting flow:', error);
      throw error;
    }
  }

  /**
   * Updates an existing flow
   * @param {string} flowId - ID of the flow to update
   * @param {Object} flowData - Updated flow data
   * @returns {Promise<Object>} - Updated flow details
   * @throws {Error} - If update fails
   */
  async updateFlow(flowId, flowData) {
    if (!flowId) {
      throw new Error("Flow ID is required");
    }

    if (!flowData) {
      throw new Error("Flow data is required");
    }

    try {
      const url = `${this.BACKEND_BASE_URL}/api/langflow/flows/${flowId}`;

      const response = await TokenRefreshService.authenticatedFetch(url, {
        method: 'PATCH',
        body: JSON.stringify(flowData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Update failed with status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating flow:', error);
      throw error;
    }
  }

  /**
   * Downloads multiple flows as a zip file
   * @param {Array<string>} flowIds - Array of flow IDs to download
   * @returns {Promise<Blob>} - ZIP file blob
   */
  async downloadFlows(flowIds) {
    if (!flowIds || !Array.isArray(flowIds) || flowIds.length === 0) {
      throw new Error("Flow IDs array is required");
    }

    try {
      const downloadUrl = `${this.BACKEND_BASE_URL}/api/langflow/flows/download`;

      const response = await TokenRefreshService.authenticatedFetch(downloadUrl, {
        method: 'POST',
        body: JSON.stringify(flowIds)
      });

      if (!response.ok) {
        throw new Error(`Download failed with status: ${response.status}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Error downloading flows:', error);
      throw error;
    }
  }

  /**
   * Gets basic example flows
   * @returns {Promise<Array>} - Array of example flows
   */
  async getBasicExamples() {
    try {
      const url = `${this.BACKEND_BASE_URL}/api/langflow/flows/basic_examples`;

      const response = await TokenRefreshService.authenticatedFetch(url, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Failed to get examples with status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting basic examples:', error);
      throw error;
    }
  }

  /**
   * Reads a flow file and returns the parsed JSON
   * @param {File} file - Flow file to read
   * @returns {Promise<Object>} - Parsed flow data
   * @throws {Error} - If file reading or parsing fails
   */
  readFlowFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const flowData = JSON.parse(e.target.result);
          resolve(flowData);
        } catch (err) {
          reject(new Error('Invalid JSON file'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Utility method to check if user is authenticated before making requests
   * @returns {Promise<boolean>} - Authentication status
   */
  async checkAuthentication() {
    try {
      // Use your existing UserService to check auth
      const userService = await import('./UserService');
      return await userService.default.isAuthenticated();
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  }
}

const flowService = new FlowService();
export default flowService;