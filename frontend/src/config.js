const LANGFLOW_API = process.env.REACT_APP_LANGFLOW_API || 'http://localhost:7860';
const BACKEND_API = process.env.REACT_APP_BACKEND_API || 'http://localhost:8000';
const APP_VERSION = process.env.REACT_APP_VERSION || '1.0.0';

const HEALTH_BASE_ENDPOINT = process.env.REACT_APP_HEALTH_BASE_ENDPOINT || '/health';

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

const COLLECTIONS_BASE_ENDPOINT = process.env.REACT_APP_COLLECTIONS_BASE_ENDPOINT || '/api/collections';
const COLLECTIONS_FILES_ENDPOINT = process.env.REACT_APP_COLLECTIONS_FILES_ENDPOINT || '/files';
const COLLECTIONS_UPLOAD_ENDPOINT = process.env.REACT_APP_COLLECTIONS_UPLOAD_ENDPOINT || '/files/upload';
const COLLECTIONS_PROCESSING_ENDPOINT = process.env.COLLECTIONS_PROCESSING_ENDPOINT || '/processing';

const ACCESS_COOKIE_NAME = process.env.REACT_APP_ACCESS_COOKIE_NAME || 'dashboard_access_token';
const REFRESH_COOKIE_NAME = process.env.REACT_APP_REFRESH_COOKIE_NAME || 'dashboard_refresh_token';
const USERNAME_COOKIE_NAME = process.env.REACT_APP_USERNAME_COOKIE_NAME || 'dashboard_username';


const config = {
  cookies: {
    accessToken: ACCESS_COOKIE_NAME,
    refreshToken: REFRESH_COOKIE_NAME,
    username: USERNAME_COOKIE_NAME,
  },

  routes: {
   login: USERS_LOGIN_ENDPOINT,
  },

  api: {
   langflowUrl: LANGFLOW_API,
   backendUrl: BACKEND_API,

   getUserDeleteUrl: (userId) => `${BACKEND_API}${USERS_BASE_ENDPOINT}/${userId}`,

   getHealthUrl: () => `${BACKEND_API}${HEALTH_BASE_ENDPOINT}`,

   getUsersBaseUrl: () => `${BACKEND_API}${USERS_BASE_ENDPOINT}`,
   getUsersLoginUrl: () => `${BACKEND_API}${USERS_BASE_ENDPOINT}${USERS_LOGIN_ENDPOINT}`,
   getUsersRefreshTokenUrl: () => `${BACKEND_API}${USERS_BASE_ENDPOINT}${USERS_REFRESH_TOKEN_ENDPOINT}`,
   getUsersLogoutUrl: () => `${BACKEND_API}${USERS_BASE_ENDPOINT}${USERS_LOGOUT_ENDPOINT}`,
   getUsersVerifyAuthUrl: () => `${BACKEND_API}${USERS_BASE_ENDPOINT}${USERS_VERIFY_AUTH_ENDPOINT}`,
   getUsersAuthStatusUrl: () => `${BACKEND_API}${USERS_BASE_ENDPOINT}${USERS_AUTH_STATUS_ENDPOINT}`,

   getFlowsBaseUrl: () => `${BACKEND_API}${FLOWS_BASE_ENDPOINT}`,
   getFlowsUploadUrl: () => `${BACKEND_API}${FLOWS_BASE_ENDPOINT}${FLOWS_UPLOAD_ENDPOINT}`,
   getFlowDeleteUrl: (flowId) => `${BACKEND_API}${FLOWS_BASE_ENDPOINT}/${flowId}`,

   getMessagesSendUrl: () => `${BACKEND_API}${MESSAGES_BASE_ENDPOINT}${MESSAGES_SEND_ENDPOINT}`,
   getMessagesSessionUrl: (sessionId) => `${BACKEND_API}${MESSAGES_BASE_ENDPOINT}/session/${sessionId}`,

   getRedirectLangflowUrl: () => `${BACKEND_API}${REDIRECT_BASE_ENDPOINT}${REDIRECT_LANGFLOW_ENDPOINT}`,

   getCollectionsBaseUrl: () => `${BACKEND_API}${COLLECTIONS_BASE_ENDPOINT}`,

   getCollectionCreateUrl: (flowId) => `${BACKEND_API}${COLLECTIONS_BASE_ENDPOINT}/${flowId}`,
   getCollectionDeleteUrl: (flowId) => `${BACKEND_API}${COLLECTIONS_BASE_ENDPOINT}/${flowId}`,

   getCollectionFilesUrl: (flowId) => `${BACKEND_API}${COLLECTIONS_BASE_ENDPOINT}/${flowId}${COLLECTIONS_FILES_ENDPOINT}`,
   getCollectionProcessingUrl: (flowId) => `${BACKEND_API}${COLLECTIONS_BASE_ENDPOINT}/${flowId}${COLLECTIONS_PROCESSING_ENDPOINT}`,
   getCollectionUploadUrl: (flowId) => `${BACKEND_API}${COLLECTIONS_BASE_ENDPOINT}/${flowId}${COLLECTIONS_UPLOAD_ENDPOINT}`,
   getCollectionFileDeleteUrl: (flowId) => `${BACKEND_API}${COLLECTIONS_BASE_ENDPOINT}/${flowId}${COLLECTIONS_FILES_ENDPOINT}`,
  },

 version: APP_VERSION,
};

export default config;