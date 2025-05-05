import config from '../../config';

/**
 * Uploads a flow to LangFlow
 *
 * @param {Object} flowData - Flow data object to upload
 * @returns {Promise<Object>} - Uploaded flow details
 * @throws {Error} - If upload fails
 */
const uploadFlow = async (flowData) => {
  if (!flowData) {
    throw new Error("Flow data is required");
  }

  try {
    const uploadUrl = config.api.getFlowsUrl();

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(flowData)
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error uploading flow:', error);
    throw error;
  }
};

export default uploadFlow;