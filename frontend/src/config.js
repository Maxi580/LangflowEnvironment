const LANGFLOW_API = process.env.REACT_APP_LANGFLOW_API || 'http://localhost:7860';
const BACKEND_API = process.env.REACT_APP_BACKEND_API || 'http://localhost:8000';
const DEFAULT_FLOW_ID = process.env.REACT_APP_DEFAULT_FLOW_ID || '';
const APP_VERSION = process.env.REACT_APP_VERSION || '1.0.0';

const config = {
  // API Base URLs
  api: {
    langflowUrl: LANGFLOW_API,
    backendUrl: BACKEND_API,

    // LangFlow API Endpoints
    getFlowsUrl: () => `${LANGFLOW_API}/api/v1/flows/`,
    getFlowDeleteUrl: (flowId) => `${LANGFLOW_API}/api/v1/flows/${flowId}`,
    getFlowUploadUrl: () => `${LANGFLOW_API}/api/v1/flows/`,
    getRunUrl: (flowId) => `${LANGFLOW_API}/api/v1/run/${flowId}`,
    getLangFlowLoginUrl: () => `${LANGFLOW_API}/api/v1/login`,

    // Backend API Endpoints
    getBackendUrl: () => BACKEND_API,
    getFilesUrl: () => `${BACKEND_API}/api/files`,
    getUploadUrl: () => `${BACKEND_API}/api/files/upload`,
    getModelsUrl: () => `${BACKEND_API}/api/models`,
    getStatusUrl: () => `${BACKEND_API}/api/health`,
    getUsersUrl: () => `${BACKEND_API}/api/users`,
    getUserDeleteUrl: (userId) => `${BACKEND_API}/api/users/${userId}`,
  },

  defaultFlowId: DEFAULT_FLOW_ID,
  version: APP_VERSION,

  auth: {
    tokenStorageKey: 'langflow_auth_token',
    userStorageKey: 'langflow_auth',
    sessionTimeout: 3600 * 24,
  }
};

export default config;