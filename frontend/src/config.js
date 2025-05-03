const config = {
  defaultFlowId: '',

  api: {
    baseUrl: 'http://localhost:7860',
    fileServerUrl: 'http://localhost:8000',

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
      return `${this.baseUrl}/api/${this.version}/${this.endpoints.run}/${flowId}`;
    },

    getFlowsUrl: function() {
      return `${this.baseUrl}/api/${this.version}/${this.endpoints.flows}/`;
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