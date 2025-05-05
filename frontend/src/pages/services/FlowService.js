import config from '../../config';

/**
 * Service for managing LangFlow flows
 */
class FlowService {
  /**
   * Fetches all available flows from the LangFlow API
   * @param {boolean} removeExampleFlows - Whether to exclude example flows from results
   * @returns {Promise<Array>} - Promise resolving to an array of flow objects
   */
  async getFlows(removeExampleFlows = true) {
    try {
      const flowsUrl = removeExampleFlows
        ? `${config.api.getFlowsUrl()}?remove_example_flows=true`
        : config.api.getFlowsUrl();

      const response = await fetch(flowsUrl, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error fetching flows: ${response.status}`);
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
   * Uploads a flow to LangFlow
   * @param {Object} flowData - Flow data object to upload
   * @returns {Promise<Object>} - Uploaded flow details
   * @throws {Error} - If upload fails
   */
  async uploadFlow(flowData) {
    if (!flowData) {
      throw new Error("Flow data is required");
    }

    try {
      const uploadUrl = config.api.getFlowUploadUrl();

      // Convert flow data to JSON string
      const flowJson = JSON.stringify(flowData);

      // Create a Blob from the JSON string
      const blob = new Blob([flowJson], { type: 'application/json' });

      // Create a File object from the Blob
      const file = new File([blob], `flow_${Date.now()}.json`, { type: 'application/json' });

      // Create FormData and append the file
      const formData = new FormData();
      formData.append('file', file);

      // Add name and description if available
      if (flowData.name) {
        formData.append('name', flowData.name);
      }

      if (flowData.description) {
        formData.append('description', flowData.description);
      }

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error uploading flow:', error);
      throw error;
    }
  }

  /**
   * Uploads a flow file to LangFlow
   * @param {File} file - Flow file to upload
   * @param {string} flowName - Name for the flow
   * @param {string} [flowDescription] - Optional description for the flow
   * @returns {Promise<Object>} - Uploaded flow details
   * @throws {Error} - If upload fails
   */
  async uploadFlowFile(file, flowName, flowDescription = '') {
    if (!file) {
      throw new Error("File is required");
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Add optional metadata if provided
      if (flowName) {
        formData.append('name', flowName);
      }

      if (flowDescription) {
        formData.append('description', flowDescription);
      }

      const uploadUrl = config.api.getFlowUploadUrl();

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error uploading flow file:', error);
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

      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Delete failed with status: ${response.status}`);
      }

      try {
        const result = await response.json();
        return result;
      } catch (e) {
        // Some APIs return empty response on successful deletion
        return { success: true, flowId };
      }
    } catch (error) {
      console.error('Error deleting flow:', error);
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
      const url = `${config.api.getFlowsUrl()}${flowId}`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get flow with status: ${response.status}`);
      }

      const result = await response.json();
      return result;
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
      const url = `${config.api.getFlowsUrl()}${flowId}`;

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(flowData)
      });

      if (!response.ok) {
        throw new Error(`Update failed with status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error updating flow:', error);
      throw error;
    }
  }
}

const flowService = new FlowService();
export default flowService;