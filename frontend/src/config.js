const config = {
  defaultFlowId: '',

  api: {
    baseUrl: 'http://localhost:7860',

    version: 'v1',

    endpoints: {
      run: 'run',
      flows: 'flows',
      importFlow: 'flows/import',
      uploadFlow: 'flows/upload'
    },

    getRunUrl: function(flowId) {
      return `${this.baseUrl}/api/${this.version}/${this.endpoints.run}/${flowId}`;
    },

    getFlowsUrl: function() {
      return `${this.baseUrl}/api/${this.version}/${this.endpoints.flows}/`;
    },

    getFlowUploadUrl: function() {
      return `${this.baseUrl}/api/${this.version}/${this.endpoints.uploadFlow}/`;
    },

    getFlowDeleteUrl: function(flowId) {
      return `${this.baseUrl}/api/${this.version}/${this.endpoints.flows}/${flowId}`;
    }
  }
};

export default config;