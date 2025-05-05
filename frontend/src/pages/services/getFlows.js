import config from '../../config';

/**
 * Fetches all available flows from the LangFlow API
 * @param {boolean} removeExampleFlows - Whether to exclude example flows from results
 * @returns {Promise<Array>} - Promise resolving to an array of flow objects
 */
const getFlows = async (removeExampleFlows = true) => {
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
};

export default getFlows;