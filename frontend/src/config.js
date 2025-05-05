const config = {
  defaultFlowId: process.env.REACT_APP_DEFAULT_FLOW_ID || '',

  api: {
    langflowUrl: process.env.REACT_APP_LANGFLOW_API || 'http://localhost:7860',
    fileServerUrl: process.env.REACT_APP_BACKEND_API || 'http://localhost:8000',

    version: 'v1',

    endpoints: {
      run: 'run',
      flows: 'flows',
      importFlow: 'flows/import',
      uploadFlow: 'flows/upload',

      files: 'files',
      uploadFile: 'upload',
      models: 'models',
      status: 'status'
    },

    getRunUrl: function(flowId) {
      return `${this.langflowUrl}/api/${this.version}/${this.endpoints.run}/${flowId}`;
    },

    getFlowsUrl: function() {
      return `${this.langflowUrl}/api/${this.version}/${this.endpoints.flows}/`;
    },

    getFlowUploadUrl: function() {
      return `${this.langflowUrl}/api/${this.version}/${this.endpoints.uploadFlow}/`;
    },

    getFlowDeleteUrl: function(flowId) {
      return `${this.langflowUrl}/api/${this.version}/${this.endpoints.flows}/${flowId}`;
    },

    getFilesUrl: function() {
      return `${this.fileServerUrl}/api/${this.endpoints.files}`;
    },

    getUploadUrl: function() {
      return `${this.fileServerUrl}/api/${this.endpoints.uploadFile}`;
    },

    getModelsUrl: function() {
      return `${this.fileServerUrl}/api/${this.endpoints.models}`;
    },

    getStatusUrl: function() {
      return `${this.fileServerUrl}/api/${this.endpoints.status}`;
    }
  }
};

export default config;