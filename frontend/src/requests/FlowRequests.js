import config from '../config';
import TokenRefreshService from './TokenRefreshRequests';

/**
 * Enhanced service for managing LangFlow flows with authentication
 */
class FlowRequests {
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
      const queryParams = new URLSearchParams({
        get_all: 'true',
        remove_example_flows: removeExampleFlows.toString(),
        components_only: componentsOnly.toString(),
        header_flows: headerFlows.toString()
      });

      if (folderId) {
        queryParams.append('folder_id', folderId);
      }

      const flowsUrl = `${config.api.getFlowsBaseUrl()}?${queryParams.toString()}`;

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
   * Fetches all public flows (no authentication required)
   * @returns {Promise<Array>} - Promise resolving to an array of public flow objects
   */
  async getPublicFlows() {
    try {
      const publicFlowsUrl = `${config.api.getFlowsPublicUrl()}`;

      const response = await fetch(publicFlowsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error fetching public flows: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        console.log(`✅ Fetched ${data.length} public flows`);
        return data;
      } else {
        console.error("Unexpected public flows response format:", data);
        return [];
      }
    } catch (error) {
      console.error("Failed to fetch public flows:", error);
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

      const uploadUrl = config.api.getFlowsUploadUrl();

      const response = await TokenRefreshService.authenticatedFetch(uploadUrl, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || `Upload failed with status: ${response.status}`;
        } catch (parseError) {
          const errorText = await response.text();
          errorMessage = `Upload failed with status: ${response.status} - ${errorText || response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      return result;
    } catch (error) {
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
      const deleteUrl = config.api.getFlowDeleteUrl(flowId);

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
      const deleteUrl = config.api.getFlowsBaseUrl();

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
}

const flowService = new FlowRequests();
export default flowService;