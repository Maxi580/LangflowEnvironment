const LANGFLOW_API = process.env.REACT_APP_LANGFLOW_API || 'http://localhost:7860';
const BACKEND_API = process.env.REACT_APP_BACKEND_API || 'http://localhost:8000';
const APP_VERSION = process.env.REACT_APP_VERSION || '1.0.0';

const HEALTH_BASE_ENDPOINT = process.env.REACT_APP_HEALTH_BASE_ENDPOINT || '/health';
const HEALTH_OLLAMA_ENDPOINT = process.env.REACT_APP_HEALTH_OLLAMA_ENDPOINT || '/health/ollama';
const HEALTH_QDRANT_ENDPOINT = process.env.REACT_APP_HEALTH_QDRANT_ENDPOINT || '/health/qdrant';
const HEALTH_LANGFLOW_ENDPOINT = process.env.REACT_APP_HEALTH_LANGFLOW_ENDPOINT || '/health/langflow';

const USERS_BASE_ENDPOINT = process.env.REACT_APP_USERS_BASE_ENDPOINT || '/api/users';
const USERS_LOGIN_ENDPOINT = process.env.REACT_APP_USERS_LOGIN_ENDPOINT || '/login';
const USERS_REFRESH_TOKEN_ENDPOINT = process.env.REACT_APP_USERS_REFRESH_TOKEN_ENDPOINT || '/refresh-token';
const USERS_LOGOUT_ENDPOINT = process.env.REACT_APP_USERS_LOGOUT_ENDPOINT || '/logout';
const USERS_VERIFY_AUTH_ENDPOINT = process.env.REACT_APP_USERS_VERIFY_AUTH_ENDPOINT || '/verify-auth';
const USERS_AUTH_STATUS_ENDPOINT = process.env.REACT_APP_USERS_AUTH_STATUS_ENDPOINT || '/auth-status';

const FLOWS_BASE_ENDPOINT = process.env.REACT_APP_FLOWS_BASE_ENDPOINT || '/api/flows';
const FLOWS_UPLOAD_ENDPOINT = process.env.REACT_APP_FLOWS_UPLOAD_ENDPOINT || '/upload';

const MESSAGES_BASE_ENDPOINT = process.env.REACT_APP_MESSAGES_BASE_ENDPOINT || '/api/messages';
const MESSAGES_SEND_ENDPOINT = process.env.REACT_APP_MESSAGES_SEND_ENDPOINT || '/send';

const REDIRECT_BASE_ENDPOINT = process.env.REACT_APP_REDIRECT_BASE_ENDPOINT || '/api/redirect';
const REDIRECT_LANGFLOW_ENDPOINT = process.env.REACT_APP_REDIRECT_LANGFLOW_ENDPOINT || '/redirect-langflow';

const config = {
 api: {
   langflowUrl: LANGFLOW_API,
   backendUrl: BACKEND_API,

   getBackendUrl: () => BACKEND_API,
   getFilesUrl: () => `${BACKEND_API}/api/files`,
   getUploadUrl: () => `${BACKEND_API}/api/files/upload`,
   getModelsUrl: () => `${BACKEND_API}/api/models`,
   getStatusUrl: () => `${BACKEND_API}${HEALTH_BASE_ENDPOINT}`,
   getUsersUrl: () => `${BACKEND_API}${USERS_BASE_ENDPOINT}`,
   getUserDeleteUrl: (userId) => `${BACKEND_API}${USERS_BASE_ENDPOINT}/${userId}`,

   // Health endpoints
   getHealthUrl: () => `${BACKEND_API}${HEALTH_BASE_ENDPOINT}`,
   getHealthOllamaUrl: () => `${BACKEND_API}${HEALTH_BASE_ENDPOINT}${HEALTH_OLLAMA_ENDPOINT}`,
   getHealthQdrantUrl: () => `${BACKEND_API}${HEALTH_BASE_ENDPOINT}${HEALTH_QDRANT_ENDPOINT}`,
   getHealthLangflowUrl: () => `${BACKEND_API}${HEALTH_BASE_ENDPOINT}${HEALTH_LANGFLOW_ENDPOINT}`,

   // User endpoints
   getUsersBaseUrl: () => `${BACKEND_API}${USERS_BASE_ENDPOINT}`,
   getUsersLoginUrl: () => `${BACKEND_API}${USERS_BASE_ENDPOINT}${USERS_LOGIN_ENDPOINT}`,
   getUsersRefreshTokenUrl: () => `${BACKEND_API}${USERS_BASE_ENDPOINT}${USERS_REFRESH_TOKEN_ENDPOINT}`,
   getUsersLogoutUrl: () => `${BACKEND_API}${USERS_BASE_ENDPOINT}${USERS_LOGOUT_ENDPOINT}`,
   getUsersVerifyAuthUrl: () => `${BACKEND_API}${USERS_BASE_ENDPOINT}${USERS_VERIFY_AUTH_ENDPOINT}`,
   getUsersAuthStatusUrl: () => `${BACKEND_API}${USERS_BASE_ENDPOINT}${USERS_AUTH_STATUS_ENDPOINT}`,

   // Flow endpoints
   getFlowsBaseUrl: () => `${BACKEND_API}${FLOWS_BASE_ENDPOINT}`,
   getFlowsUploadUrl: () => `${BACKEND_API}${FLOWS_BASE_ENDPOINT}${FLOWS_UPLOAD_ENDPOINT}`,
   getFlowDeleteUrl: (flowId) => `${BACKEND_API}${FLOWS_BASE_ENDPOINT}/${flowId}`,

   // Message endpoints
   getMessagesBaseUrl: () => `${BACKEND_API}${MESSAGES_BASE_ENDPOINT}`,
   getMessagesSendUrl: () => `${BACKEND_API}${MESSAGES_BASE_ENDPOINT}${MESSAGES_SEND_ENDPOINT}`,
   getMessagesSessionUrl: (sessionId) => `${BACKEND_API}${MESSAGES_BASE_ENDPOINT}/session/${sessionId}`,

   // Redirect endpoints
   getRedirectBaseUrl: () => `${BACKEND_API}${REDIRECT_BASE_ENDPOINT}`,
   getRedirectLangflowUrl: () => `${BACKEND_API}${REDIRECT_BASE_ENDPOINT}${REDIRECT_LANGFLOW_ENDPOINT}`,
 },

 version: APP_VERSION,
};

export default config;