import React, { useState, useRef, useEffect } from 'react';
import flowService from '../services/FlowService';

/**
 * FlowManagement component for dashboard integration
 * Handles flow listing, uploading, and deletion
 */
const FlowManagement = () => {
  const [flows, setFlows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [selectedFlows, setSelectedFlows] = useState(new Set());
  const [showUploadForm, setShowUploadForm] = useState(false);

  const fileInputRef = useRef(null);

  // Load flows on component mount
  useEffect(() => {
    fetchFlows();
  }, []);

  /**
   * Fetch all user flows
   */
  const fetchFlows = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await flowService.getFlows({
        removeExampleFlows: true,
        headerFlows: true // Get only headers for better performance
      });
      setFlows(data);
    } catch (err) {
      console.error('Error fetching flows:', err);
      setError(`Failed to load flows: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle file upload
   */
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      // Upload as private flow
      const result = await flowService.uploadFlowFile(file, {
        flowName: file.name.replace(/\.json$/, ''),
        accessType: 'PRIVATE'
      });

      // Add the new flow to the list
      setFlows(prevFlows => [result, ...prevFlows]);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Show success message briefly
      setUploadError(null);
    } catch (err) {
      console.error('Error uploading flow:', err);
      setUploadError(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Handle single flow deletion
   */
  const handleDeleteFlow = async (flowId, flowName) => {
    if (!window.confirm(`Are you sure you want to delete "${flowName}"?`)) {
      return;
    }

    try {
      await flowService.deleteFlow(flowId);
      setFlows(prevFlows => prevFlows.filter(flow => flow.id !== flowId));
      setSelectedFlows(prev => {
        const newSet = new Set(prev);
        newSet.delete(flowId);
        return newSet;
      });
    } catch (err) {
      console.error('Error deleting flow:', err);
      setError(`Failed to delete flow: ${err.message}`);
    }
  };

  /**
   * Handle bulk flow deletion
   */
  const handleBulkDelete = async () => {
    if (selectedFlows.size === 0) return;

    const flowNames = Array.from(selectedFlows).map(id =>
      flows.find(f => f.id === id)?.name || 'Unknown'
    ).join(', ');

    if (!window.confirm(`Are you sure you want to delete ${selectedFlows.size} flows: ${flowNames}?`)) {
      return;
    }

    try {
      await flowService.deleteMultipleFlows(Array.from(selectedFlows));
      setFlows(prevFlows => prevFlows.filter(flow => !selectedFlows.has(flow.id)));
      setSelectedFlows(new Set());
    } catch (err) {
      console.error('Error deleting flows:', err);
      setError(`Failed to delete flows: ${err.message}`);
    }
  };

  /**
   * Toggle flow selection
   */
  const toggleFlowSelection = (flowId) => {
    setSelectedFlows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(flowId)) {
        newSet.delete(flowId);
      } else {
        newSet.add(flowId);
      }
      return newSet;
    });
  };

  /**
   * Select all flows
   */
  const selectAllFlows = () => {
    setSelectedFlows(new Set(flows.map(flow => flow.id)));
  };

  /**
   * Clear all selections
   */
  const clearSelection = () => {
    setSelectedFlows(new Set());
  };

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Flow Management</h2>

        <div className="flex items-center space-x-3">
          {/* Bulk Actions */}
          {selectedFlows.size > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-slate-300">
                {selectedFlows.size} selected
              </span>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
              >
                Delete Selected
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded transition-colors"
              >
                Clear
              </button>
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50
                     disabled:cursor-not-allowed text-white rounded transition-colors
                     flex items-center space-x-2"
          >
            {isUploading ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            )}
            <span>{isUploading ? 'Uploading...' : 'Upload Flow'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchFlows}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                     disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".json"
            className="hidden"
          />
        </div>
      </div>

      {/* Error Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
          <p className="text-red-200 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-red-300 hover:text-red-100 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Upload Error */}
      {uploadError && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
          <p className="text-red-200 text-sm">{uploadError}</p>
          <button
            onClick={() => setUploadError(null)}
            className="mt-2 text-red-300 hover:text-red-100 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Flows Table */}
      <div className="bg-slate-700 rounded-lg overflow-hidden">
        {/* Table Header */}
        <div className="px-4 py-3 bg-slate-600 border-b border-slate-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={flows.length > 0 && selectedFlows.size === flows.length}
                  onChange={() => selectedFlows.size === flows.length ? clearSelection() : selectAllFlows()}
                  className="rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-300">Select All</span>
              </label>
              <span className="text-sm text-slate-300">
                {flows.length} flows total
              </span>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="p-8 text-center">
            <div className="flex items-center justify-center">
              <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p className="mt-2 text-slate-400">Loading flows...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && flows.length === 0 && (
          <div className="p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 48 48">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M34 40h10v-4a6 6 0 00-10.712-3.714M34 40H14m20 0v-4a9.971 9.971 0 00-.712-3.714M14 40H4v-4a6 6 0 0110.713-3.714M14 40v-4c0-1.313.253-2.566.713-3.714m0 0A9.971 9.971 0 0124 24c4.21 0 7.813 2.602 9.288 6.286" />
            </svg>
            <p className="mt-2 text-slate-400">No flows found</p>
            <p className="text-sm text-slate-500">Upload a flow file to get started</p>
          </div>
        )}

        {/* Flows List */}
        {!isLoading && flows.length > 0 && (
          <div className="max-h-96 overflow-y-auto">
            {flows.map((flow) => (
              <div
                key={flow.id}
                className={`px-4 py-3 border-b border-slate-600 last:border-b-0 hover:bg-slate-600/50 transition-colors
                           ${selectedFlows.has(flow.id) ? 'bg-blue-900/30' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedFlows.has(flow.id)}
                      onChange={() => toggleFlowSelection(flow.id)}
                      className="rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-white">{flow.name}</h3>
                        <span className="px-2 py-1 bg-green-900 text-green-200 text-xs rounded">
                          PRIVATE
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">
                        {flow.description || 'No description'}
                      </p>
                      <p className="text-xs text-slate-500 font-mono mt-1">
                        ID: {flow.id}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDeleteFlow(flow.id, flow.name)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20
                               rounded transition-colors"
                      title="Delete flow"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {flows.length > 0 && (
        <div className="mt-4 flex justify-between items-center text-sm text-slate-400">
          <span>
            {selectedFlows.size > 0 && `${selectedFlows.size} selected • `}
            {flows.length} total flows
          </span>
          <span>
            All flows are private by default
          </span>
        </div>
      )}
    </div>
  );
};

export default FlowManagement;