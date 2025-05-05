import config from '../../config';

/**
 * Deletes a flow from LangFlow
 *
 * @param {string} flowId - ID of the flow to delete
 * @returns {Promise<Object>} - Result of the deletion operation
 * @throws {Error} - If deletion fails
 */
const deleteFlow = async (flowId) => {
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
      return { success: true, flowId };
    }

  } catch (error) {
    console.error('Error deleting flow:', error);
    throw error;
  }
};

export default deleteFlow;