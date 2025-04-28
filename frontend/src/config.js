const config = {
  defaultFlowId: '',

  api: {
    baseUrl: 'http://localhost:7860',

    version: 'v1',
    // Endpoints
    endpoints: {
      run: 'run',
      flows: 'flows',
      importFlow: 'flows/import'
    },

    getRunUrl: function(flowId) {
      return `${this.baseUrl}/api/${this.version}/${this.endpoints.run}/${flowId}`;
    },

    getImportUrl: function() {
      return `${this.baseUrl}/api/${this.version}/${this.endpoints.importFlow}`;
    },

    // New method for creating flows
    getFlowsUrl: function() {
      return `${this.baseUrl}/api/${this.version}/${this.endpoints.flows}`;
    }
  }
};

export default config;