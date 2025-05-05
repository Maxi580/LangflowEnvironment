import React, { useState, useRef, useEffect } from 'react';
import flowService from '../services/FlowService';
import messageService from '../services/MessageService';
import config from '../../config';
import UploadFlowForm from './UploadFlowForm';

/**
 * FlowManagement component that handles all flow-related functionality
 * including selecting, uploading, and deleting flows
 */
const FlowManagement = ({
  flowId,
  setFlowId,
  setMessages,
  children
}) => {
  const [showFlowSelector, setShowFlowSelector] = useState(false);
  const [showUploadFlow, setShowUploadFlow] = useState(false);
  const [isUploadingFlow, setIsUploadingFlow] = useState(false);
  const [uploadFlowError, setUploadFlowError] = useState(null);
  const [flows, setFlows] = useState([]);
  const [flowsLoading, setFlowsLoading] = useState(false);
  const [flowsError, setFlowsError] = useState(null);

  const flowFileInputRef = useRef(null);

  useEffect(() => {
    if (showFlowSelector) {
      handleFetchFlows();
    }
  }, [showFlowSelector]);

  useEffect(() => {
    if (flowId) {
      localStorage.setItem('langflow_flowId', flowId);
    } else {
      localStorage.removeItem('langflow_flowId');
    }
  }, [flowId]);

  /**
   * Fetches all available flows
   */
  const handleFetchFlows = async () => {
    setFlowsLoading(true);
    setFlowsError(null);

    try {
      const data = await flowService.getFlows(true); // true to remove example flows
      setFlows(data);
    } catch (err) {
      console.error("Failed to fetch flows:", err);
      setFlowsError(err.message);
    } finally {
      setFlowsLoading(false);
    }
  };

  /**
   * Handles selecting a flow
   * @param {Object} selectedFlow - The flow to select
   */
  const handleSelectFlow = (selectedFlow) => {
    setFlowId(selectedFlow.id);
    setShowFlowSelector(false);

    // Add a system message to indicate flow change
    const message = messageService.createSystemMessage(
      `Flow changed to: ${selectedFlow.name}`
    );
    setMessages(prev => [...prev, message]);
  };

  /**
   * Handles deleting a flow
   * @param {Object} flowToDelete - The flow to delete
   */
  const handleDeleteFlow = async (flowToDelete) => {
    // Confirm before deleting
    if (!window.confirm(`Are you sure you want to delete the flow "${flowToDelete.name}"?`)) {
      return;
    }

    try {
      await flowService.deleteFlow(flowToDelete.id);

      handleFetchFlows();

      if (flowToDelete.id === flowId) {
        setFlowId('');

        const message = messageService.createSystemMessage(
          `Current flow "${flowToDelete.name}" was deleted. Please select a new flow.`
        );
        setMessages(prev => [...prev, message]);
      } else {
        const message = messageService.createSystemMessage(
          `Flow "${flowToDelete.name}" was deleted.`
        );
        setMessages(prev => [...prev, message]);
      }
    } catch (err) {
      console.error('Error deleting flow:', err);

      const errorMessage = messageService.createErrorMessage(
        `Error deleting flow: ${err.message}`
      );
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  /**
   * Handles flow file upload
   * @param {File} file - The flow file
   * @param {string} flowName - Name for the flow
   * @param {string} flowDescription - Description for the flow
   * @param {string} error - Error message if validation failed
   */
  const handleFlowUpload = async (file, flowName, flowDescription, error = null) => {
    if (error) {
      setUploadFlowError(error);
      return;
    }

    if (!file) {
      setUploadFlowError("File is required");
      return;
    }

    setIsUploadingFlow(true);
    setUploadFlowError(null);

    try {
      const flowData = await flowService.readFlowFile(file);

      if (flowName && flowName.trim()) {
        flowData.name = flowName;
      }

      if (flowDescription && flowDescription.trim()) {
        flowData.description = flowDescription;
      } else if (!flowData.description) {
        flowData.description = '';
      }

      const result = await flowService.uploadFlow(flowData);

      setFlows(prevFlows => {
        if (prevFlows.some(flow => flow.id === result.id)) {
          return prevFlows.map(flow =>
            flow.id === result.id ? result : flow
          );
        } else {
          return [...prevFlows, result];
        }
      });

      const message = messageService.createSystemMessage(
        `Flow "${result.name}" was successfully uploaded.`
      );
      setMessages(prev => [...prev, message]);

      setShowUploadFlow(false);
    } catch (err) {
      console.error('Error uploading flow:', err);
      setUploadFlowError(err.message || 'Failed to upload flow');
    } finally {
      setIsUploadingFlow(false);
    }
  };

  /**
   * Trigger file input click for flow upload
   */
  const handleFlowUploadClick = () => {
    flowFileInputRef.current?.click();
  };

  /**
   * Handles direct file input change for flow upload
   */
  const handleFileInputChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingFlow(true);
    setUploadFlowError(null);

    try {
      // Read and parse the flow file
      const flowData = await flowService.readFlowFile(file);

      // Use the filename as the flow name (without .json extension)
      const flowName = file.name.replace(/\.json$/, '');
      flowData.name = flowName;

      // Upload the flow
      const result = await flowService.uploadFlow(flowData);

      // Refresh flows list
      await handleFetchFlows();

      // Set the newly uploaded flow as current
      setFlowId(result.id);

      // Add a system message
      const message = messageService.createSystemMessage(
        `Flow "${result.name}" uploaded and selected.`
      );
      setMessages(prev => [...prev, message]);
    } catch (err) {
      console.error('Error uploading flow file:', err);

      const errorMessage = messageService.createErrorMessage(
        `Error uploading flow: ${err.message}`
      );
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsUploadingFlow(false);
      // Reset file input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  /**
   * Opens LangFlow in a new window
   */
  const handleOpenLangFlow = () => {
    const langFlowUrl = `${config.api.langflowUrl}/flows`;
    window.open(langFlowUrl, '_blank', 'noopener,noreferrer');
  };

  /**
   * Flow Selector component
   */
  const renderFlowSelector = () => {
    if (!showFlowSelector) return null;

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
              onClick={handleFetchFlows}
              className="ml-2 text-blue-400 hover:text-blue-300 underline"
            >
              Retry
            </button>
          </div>
        )}

        {!flowsLoading && !flowsError && flows.length === 0 && (
          <div className="py-3 text-slate-300 text-sm">
            No flows found. Create a flow in LangFlow first or upload one.
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
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFlow(flow);
                    }}
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

        <div className="mt-4 flex justify-between">
          <div>
            <button
              onClick={handleFlowUploadClick}
              disabled={isUploadingFlow}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isUploadingFlow ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </div>
              ) : (
                <>
                  <span className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    Upload Flow
                  </span>
                </>
              )}
            </button>
            {/* Hidden file input for flow upload */}
            <input
              type="file"
              ref={flowFileInputRef}
              onChange={handleFileInputChange}
              accept=".json,.yaml,.yml"
              className="hidden"
            />
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowFlowSelector(false)}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleFetchFlows}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Upload Flow Panel
   */
  const renderUploadFlow = () => {
    if (!showUploadFlow) return null;

    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-white">Upload Flow</h3>
          <button
            onClick={() => setShowUploadFlow(false)}
            className="text-slate-400 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Upload Flow Form Content */}
        <UploadFlowForm
          onUpload={handleFlowUpload}
          onClose={() => setShowUploadFlow(false)}
          isUploading={isUploadingFlow}
          uploadError={uploadFlowError}
        />
      </div>
    );
  };

  /**
   * Current Flow Display
   */
  const renderCurrentFlow = () => {
    const currentFlow = flows.find(f => f.id === flowId);

    if (!flowId || !currentFlow) return null;

    return (
      <div className="mb-4 bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-700">
        <div className="text-xs text-slate-400">Current Flow:</div>
        <div className="text-sm text-slate-200 font-medium">
          {currentFlow?.name || 'Unknown Flow'}
        </div>
        <div className="text-xs text-slate-400 font-mono truncate">{flowId}</div>
      </div>
    );
  };

  return (
    <div>
      {/* Flow Management Controls */}
      <div className="flex justify-end mb-4 space-x-2">
        {/* LangFlow Redirect Button */}
        <button
          onClick={handleOpenLangFlow}
          className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700
                   text-white rounded-lg text-sm transition-colors"
          title="Open LangFlow UI"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
          </svg>
          Open LangFlow
        </button>

        {/* Upload Flow Button */}
        <button
          onClick={() => setShowUploadFlow(!showUploadFlow)}
          className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700
                   text-white rounded-lg text-sm transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          {showUploadFlow ? 'Close Upload' : 'Upload Flow'}
        </button>

        {/* Flow Selector Button */}
        <button
          onClick={() => setShowFlowSelector(!showFlowSelector)}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700
                   text-white rounded-lg text-sm transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
          </svg>
          {showFlowSelector ? 'Close Flows' : 'Flows'}
        </button>
      </div>

      {/* Flow Selector Panel */}
      {renderFlowSelector()}

      {/* Upload Flow Panel */}
      {renderUploadFlow()}

      {/* Current Flow Display */}
      {renderCurrentFlow()}

      {/* Children content (if any) */}
      {children}
    </div>
  );
};

export default FlowManagement;