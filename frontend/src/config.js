const LANGFLOW_API = process.env.REACT_APP_LANGFLOW_API || 'http://localhost:7860';
const BACKEND_API = process.env.REACT_APP_BACKEND_API || 'http://localhost:8000';
const APP_VERSION = process.env.REACT_APP_VERSION || '1.0.0';

// Routes
const LOGIN_ROUTE = process.env.LOGIN_ROUTE || '/login';
const DASHBOARD_ROUTE = process.env.DASHBOARD_ROUTE || '/dashboard';

// Health endpoints
const HEALTH_BASE_ENDPOINT = process.env.REACT_APP_HEALTH_BASE_ENDPOINT || '/health';
const HEALTH_CHECK_ENDPOINT = process.env.REACT_APP_HEALTH_CHECK_ENDPOINT || '';

// User management endpoints
const USERS_BASE_ENDPOINT = process.env.REACT_APP_USERS_BASE_ENDPOINT || '/api/users';
const USERS_CREATE_ENDPOINT = process.env.REACT_APP_USERS_CREATE_ENDPOINT || '';
const USERS_DELETE_ENDPOINT = process.env.REACT_APP_USERS_DELETE_ENDPOINT || '/{user_id}';
const USERS_LOGIN_ENDPOINT = process.env.REACT_APP_USERS_LOGIN_ENDPOINT || '/login';
const USERS_REFRESH_TOKEN_ENDPOINT = process.env.REACT_APP_USERS_REFRESH_TOKEN_ENDPOINT || '/refresh-token';
const USERS_LOGOUT_ENDPOINT = process.env.REACT_APP_USERS_LOGOUT_ENDPOINT || '/logout';
const USERS_VERIFY_AUTH_ENDPOINT = process.env.REACT_APP_USERS_VERIFY_AUTH_ENDPOINT || '/verify-auth';
const USERS_AUTH_STATUS_ENDPOINT = process.env.REACT_APP_USERS_AUTH_STATUS_ENDPOINT || '/auth-status';

// Flow management endpoints
const FLOWS_BASE_ENDPOINT = process.env.REACT_APP_FLOWS_BASE_ENDPOINT || '/api/flows';
const FLOWS_UPLOAD_ENDPOINT = process.env.REACT_APP_FLOWS_UPLOAD_ENDPOINT || '/upload';
const FLOWS_GET_BY_ID_ENDPOINT = process.env.REACT_APP_FLOWS_GET_BY_ID_ENDPOINT || '/{flow_id}';
const FLOWS_COMPONENT_IDS_ENDPOINT = process.env.REACT_APP_FLOWS_COMPONENT_IDS_ENDPOINT || '/{flow_id}/component-ids';
const FLOWS_DELETE_ENDPOINT = process.env.REACT_APP_FLOWS_DELETE_ENDPOINT || '/{flow_id}';
const FLOWS_DELETE_MULTIPLE_ENDPOINT = process.env.REACT_APP_FLOWS_DELETE_MULTIPLE_ENDPOINT || '';
const FLOWS_RUN_ENDPOINT = process.env.REACT_APP_FLOWS_RUN_ENDPOINT || '/{flow_id}/run';
const FLOWS_VALIDATE_ENDPOINT = process.env.REACT_APP_FLOWS_VALIDATE_ENDPOINT || '/{flow_id}/validate';

// Message/Chat endpoints
const MESSAGES_BASE_ENDPOINT = process.env.REACT_APP_MESSAGES_BASE_ENDPOINT || '/api/messages';
const MESSAGES_SEND_ENDPOINT = process.env.REACT_APP_MESSAGES_SEND_ENDPOINT || '/send';
const MESSAGES_SESSION_INFO_ENDPOINT = process.env.REACT_APP_MESSAGES_SESSION_INFO_ENDPOINT || '/session/{session_id}';
const MESSAGES_LIST_SESSIONS_ENDPOINT = process.env.REACT_APP_MESSAGES_LIST_SESSIONS_ENDPOINT || '/sessions';
const MESSAGES_END_SESSION_ENDPOINT = process.env.REACT_APP_MESSAGES_END_SESSION_ENDPOINT || '/session/{session_id}';

// Redirect endpoints
const REDIRECT_BASE_ENDPOINT = process.env.REACT_APP_REDIRECT_BASE_ENDPOINT || '/api/redirect';
const REDIRECT_LANGFLOW_ENDPOINT = process.env.REACT_APP_REDIRECT_LANGFLOW_ENDPOINT || '/redirect-langflow';

// Collection endpoints
const COLLECTIONS_BASE_ENDPOINT = process.env.REACT_APP_COLLECTIONS_BASE_ENDPOINT || '/api/collections';
const COLLECTIONS_CREATE_ENDPOINT = process.env.REACT_APP_COLLECTIONS_CREATE_ENDPOINT || '/{flow_id}';
const COLLECTIONS_DELETE_ENDPOINT = process.env.REACT_APP_COLLECTIONS_DELETE_ENDPOINT || '/{flow_id}';
const COLLECTIONS_INFO_ENDPOINT = process.env.REACT_APP_COLLECTIONS_INFO_ENDPOINT || '/{flow_id}/info';
const COLLECTIONS_LIST_FILES_ENDPOINT = process.env.REACT_APP_COLLECTIONS_LIST_FILES_ENDPOINT || '/{flow_id}/files';
const COLLECTIONS_UPLOAD_TO_COLLECTION_ENDPOINT = process.env.REACT_APP_COLLECTIONS_UPLOAD_TO_COLLECTION_ENDPOINT || '/{flow_id}/files/upload';
const COLLECTIONS_DELETE_FROM_COLLECTION_ENDPOINT = process.env.REACT_APP_COLLECTIONS_DELETE_FROM_COLLECTION_ENDPOINT || '/{flow_id}/files';
const COLLECTIONS_PROCESSING_ENDPOINT = process.env.REACT_APP_COLLECTIONS_PROCESSING_ENDPOINT || '/processing';

// Cookie configuration
const ACCESS_COOKIE_NAME = process.env.REACT_APP_ACCESS_COOKIE_NAME || 'dashboard_access_token';
const REFRESH_COOKIE_NAME = process.env.REACT_APP_REFRESH_COOKIE_NAME || 'dashboard_refresh_token';
const USERNAME_COOKIE_NAME = process.env.REACT_APP_USERNAME_COOKIE_NAME || 'dashboard_username';

const replacePlaceholders = (endpoint, params = {}) => {
  let result = endpoint;
  Object.entries(params).forEach(([key, value]) => {
    result = result.replace(`{${key}}`, value);
  });
  return result;
};

const config = {
  cookies: {
    accessToken: ACCESS_COOKIE_NAME,
    refreshToken: REFRESH_COOKIE_NAME,
    username: USERNAME_COOKIE_NAME,
  },

  routes: {
    login: LOGIN_ROUTE,
    dashboard: DASHBOARD_ROUTE
  },

  api: {
    langflowUrl: LANGFLOW_API,
    backendUrl: BACKEND_API,

    // Health endpoints
    getHealthUrl: () => `${BACKEND_API}${HEALTH_BASE_ENDPOINT}${HEALTH_CHECK_ENDPOINT}`,

    // User management endpoints
    getUsersBaseUrl: () => `${BACKEND_API}${USERS_BASE_ENDPOINT}${USERS_CREATE_ENDPOINT}`,
    getUserDeleteUrl: (userId) => `${BACKEND_API}${USERS_BASE_ENDPOINT}${replacePlaceholders(USERS_DELETE_ENDPOINT, { user_id: userId })}`,
    getUsersLoginUrl: () => `${BACKEND_API}${USERS_BASE_ENDPOINT}${USERS_LOGIN_ENDPOINT}`,
    getUsersRefreshTokenUrl: () => `${BACKEND_API}${USERS_BASE_ENDPOINT}${USERS_REFRESH_TOKEN_ENDPOINT}`,
    getUsersLogoutUrl: () => `${BACKEND_API}${USERS_BASE_ENDPOINT}${USERS_LOGOUT_ENDPOINT}`,
    getUsersVerifyAuthUrl: () => `${BACKEND_API}${USERS_BASE_ENDPOINT}${USERS_VERIFY_AUTH_ENDPOINT}`,
    getUsersAuthStatusUrl: () => `${BACKEND_API}${USERS_BASE_ENDPOINT}${USERS_AUTH_STATUS_ENDPOINT}`,

    // Flow management endpoints
    getFlowsBaseUrl: () => `${BACKEND_API}${FLOWS_BASE_ENDPOINT}${FLOWS_DELETE_MULTIPLE_ENDPOINT}`,
    getFlowsUploadUrl: () => `${BACKEND_API}${FLOWS_BASE_ENDPOINT}${FLOWS_UPLOAD_ENDPOINT}`,
    getFlowByIdUrl: (flowId) => `${BACKEND_API}${FLOWS_BASE_ENDPOINT}${replacePlaceholders(FLOWS_GET_BY_ID_ENDPOINT, { flow_id: flowId })}`,
    getFlowComponentIdsUrl: (flowId) => `${BACKEND_API}${FLOWS_BASE_ENDPOINT}${replacePlaceholders(FLOWS_COMPONENT_IDS_ENDPOINT, { flow_id: flowId })}`,
    getFlowDeleteUrl: (flowId) => `${BACKEND_API}${FLOWS_BASE_ENDPOINT}${replacePlaceholders(FLOWS_DELETE_ENDPOINT, { flow_id: flowId })}`,
    getFlowRunUrl: (flowId) => `${BACKEND_API}${FLOWS_BASE_ENDPOINT}${replacePlaceholders(FLOWS_RUN_ENDPOINT, { flow_id: flowId })}`,
    getFlowValidateUrl: (flowId) => `${BACKEND_API}${FLOWS_BASE_ENDPOINT}${replacePlaceholders(FLOWS_VALIDATE_ENDPOINT, { flow_id: flowId })}`,

    // Message/Chat endpoints
    getMessagesSendUrl: () => `${BACKEND_API}${MESSAGES_BASE_ENDPOINT}${MESSAGES_SEND_ENDPOINT}`,
    getMessagesSessionUrl: (sessionId) => `${BACKEND_API}${MESSAGES_BASE_ENDPOINT}${replacePlaceholders(MESSAGES_SESSION_INFO_ENDPOINT, { session_id: sessionId })}`,
    getMessagesListSessionsUrl: () => `${BACKEND_API}${MESSAGES_BASE_ENDPOINT}${MESSAGES_LIST_SESSIONS_ENDPOINT}`,
    getMessagesEndSessionUrl: (sessionId) => `${BACKEND_API}${MESSAGES_BASE_ENDPOINT}${replacePlaceholders(MESSAGES_END_SESSION_ENDPOINT, { session_id: sessionId })}`,

    // Redirect endpoints
    getRedirectLangflowUrl: () => `${BACKEND_API}${REDIRECT_BASE_ENDPOINT}${REDIRECT_LANGFLOW_ENDPOINT}`,

    // Collection endpoints
    getCollectionsBaseUrl: () => `${BACKEND_API}${COLLECTIONS_BASE_ENDPOINT}`,
    getCollectionCreateUrl: (flowId) => `${BACKEND_API}${COLLECTIONS_BASE_ENDPOINT}${replacePlaceholders(COLLECTIONS_CREATE_ENDPOINT, { flow_id: flowId })}`,
    getCollectionDeleteUrl: (flowId) => `${BACKEND_API}${COLLECTIONS_BASE_ENDPOINT}${replacePlaceholders(COLLECTIONS_DELETE_ENDPOINT, { flow_id: flowId })}`,
    getCollectionInfoUrl: (flowId) => `${BACKEND_API}${COLLECTIONS_BASE_ENDPOINT}${replacePlaceholders(COLLECTIONS_INFO_ENDPOINT, { flow_id: flowId })}`,
    getCollectionListFilesUrl: (flowId) => `${BACKEND_API}${COLLECTIONS_BASE_ENDPOINT}${replacePlaceholders(COLLECTIONS_LIST_FILES_ENDPOINT, { flow_id: flowId })}`,
    getCollectionUploadUrl: (flowId) => `${BACKEND_API}${COLLECTIONS_BASE_ENDPOINT}${replacePlaceholders(COLLECTIONS_UPLOAD_TO_COLLECTION_ENDPOINT, { flow_id: flowId })}`,
    getCollectionFileDeleteUrl: (flowId) => `${BACKEND_API}${COLLECTIONS_BASE_ENDPOINT}${replacePlaceholders(COLLECTIONS_DELETE_FROM_COLLECTION_ENDPOINT, { flow_id: flowId })}`,

    getCollectionFilesUrl: (flowId) => `${BACKEND_API}${COLLECTIONS_BASE_ENDPOINT}${replacePlaceholders(COLLECTIONS_LIST_FILES_ENDPOINT, { flow_id: flowId })}`,
    getCollectionProcessingUrl: (flowId) => `${BACKEND_API}${COLLECTIONS_BASE_ENDPOINT}/${flowId}${COLLECTIONS_PROCESSING_ENDPOINT}`,
  },

  version: APP_VERSION,
};

export default config;