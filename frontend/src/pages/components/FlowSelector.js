import React from 'react';

const FlowSelector = ({
  flows,
  flowId,
  flowsLoading,
  flowsError,
  fetchFlows,
  handleSelectFlow,
  handleDeleteFlow,
  setShowFlowSelector
}) => {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-6 shadow-lg">
      <h3 className="text-lg font-medium text-white mb-3">Available Flows</h3>

      {flowsLoading && (
        <div className="py-3 text-slate-300 text-sm">
          <div className="flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading available flows...
          </div>
        </div>
      )}

      {flowsError && (
        <div className="py-3 text-red-400 text-sm">
          Error loading flows: {flowsError}
          <button
            onClick={fetchFlows}
            className="ml-2 text-blue-400 hover:text-blue-300 underline"
          >
            Retry
          </button>
        </div>
      )}

      {!flowsLoading && !flowsError && flows.length === 0 && (
        <div className="py-3 text-slate-300 text-sm">
          No flows found. Create a flow in LangFlow first.
        </div>
      )}

      {!flowsLoading && !flowsError && flows.length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
          {flows.map(flow => (
            <div
              key={flow.id}
              className={`flex justify-between items-center p-3 ${
                flow.id === flowId 
                  ? 'bg-blue-700 hover:bg-blue-600' 
                  : 'bg-slate-700 hover:bg-slate-600'
              } rounded-lg transition-colors`}
            >
              <div
                className="flex-1 cursor-pointer"
                onClick={() => handleSelectFlow(flow)}
              >
                <div className="text-white font-medium truncate">{flow.name}</div>
                <div className="text-slate-400 text-xs truncate">{flow.id}</div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDeleteFlow(flow)}
                  className="p-1.5 bg-slate-800 hover:bg-red-600 rounded-full transition-colors"
                  title="Delete flow"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          onClick={() => setShowFlowSelector(false)}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-md mr-2"
        >
          Cancel
        </button>
        <button
          onClick={fetchFlows}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"
        >
          Refresh Flows
        </button>
      </div>
    </div>
  );
};

export default FlowSelector;