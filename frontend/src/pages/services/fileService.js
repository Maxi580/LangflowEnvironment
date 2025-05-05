import config from '../../config';

/**
 * Fetches all files from the backend, optionally filtered by flow ID
 * @param {string} flowId - Optional flow ID to filter files
 * @returns {Promise<Array>} - Promise resolving to an array of file objects
 */
export const fetchFiles = async (flowId) => {
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
};

/**
 * Uploads files to the backend
 * @param {FileList} files - Files to upload
 * @param {string} flowId - Flow ID to associate files with
 * @returns {Promise<Object>} - Result of the upload operation
 */
export const uploadFiles = async (files, flowId) => {
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
};

/**
 * Deletes a file from the backend and Qdrant storage
 * @param {string} filePath - Path to the file to delete
 * @param {string} flowId - ID of the flow associated with the file
 * @returns {Promise<Object>} - Result of the deletion operation
 */
export const deleteFile = async (filePath, flowId) => {
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
};

/**
 * Formats file size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size string
 */
export const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' bytes';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  else return (bytes / 1048576).toFixed(1) + ' MB';
};