import React, { useState, useRef, useEffect } from 'react';
import flowService from '../../../requests/FlowRequests';
import fileService from '../../../requests/FileRequests';

const FlowManagement = ({ onFlowSelect, selectedFlowId }) => {
  const [flows, setFlows] = useState([]);
  const [publicFlows, setPublicFlows] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPublic, setIsLoadingPublic] = useState(false);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPublicFlows, setShowPublicFlows] = useState(true);

  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchFlows();
    if (showPublicFlows) {
      fetchPublicFlows();
    }
  }, [showPublicFlows]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchFlows = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await flowService.getFlows({
        removeExampleFlows: true,
        headerFlows: true
      });
      setFlows(data);
    } catch (err) {
      console.error('Error fetching user flows:', err);
      setError(`Failed to load user flows: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPublicFlows = async () => {
    setIsLoadingPublic(true);

    try {
      const data = await flowService.getPublicFlows();
      setPublicFlows(data);
    } catch (err) {
      console.error('Error fetching public flows:', err);
      console.warn(`Public flows unavailable: ${err.message}`);
    } finally {
      setIsLoadingPublic(false);
    }
  };

  const refreshAllFlows = async () => {
    await Promise.all([
      fetchFlows(),
      showPublicFlows ? fetchPublicFlows() : Promise.resolve()
    ]);
  };

  const handleFlowSelect = (flow) => {
    onFlowSelect(flow);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const result = await flowService.uploadFlowFile(file, {
        flowName: file.name.replace(/\.json$/, ''),
        accessType: 'PRIVATE'
      });

      setFlows(prevFlows => [result, ...prevFlows]);
      handleFlowSelect(result);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Error uploading flow:', err);
      setError(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFlow = async (flowId, flowName, event) => {
    event.stopPropagation();

    try {
      console.log(`Deleting flow: ${flowName} (${flowId})`);

      try {
        console.log(`Attempting to delete collection: ${flowId}`);
        await fileService.deleteCollection(flowId);
        console.log(`Collection deleted successfully: ${flowId}`);
      } catch (collectionError) {
        console.warn(`Failed to delete collection ${flowId}:`, collectionError);
      }

      await flowService.deleteFlow(flowId);
      console.log(`Flow deleted successfully: ${flowId}`);

      setFlows(prevFlows => prevFlows.filter(flow => flow.id !== flowId));

      if (selectedFlowId === flowId) {
        onFlowSelect(null);
      }

      console.log(`Complete deletion successful for flow: ${flowName}`);

    } catch (err) {
      console.error('Error deleting flow:', err);
      setError(`Failed to delete flow "${flowName}": ${err.message}`);
    }
  };

  const getFlowType = (flow) => {
    const isUserFlow = flows.some(f => f.id === flow.id);
    const isPublicFlow = publicFlows.some(f => f.id === flow.id);

    if (isUserFlow && isPublicFlow) {
      return 'both';
    } else if (isPublicFlow) {
      return 'public';
    } else {
      return 'private';
    }
  };

  const canDeleteFlow = (flow) => {
    return flows.some(f => f.id === flow.id);
  };

  const getAllFlows = () => {
    const flowMap = new Map();

    flows.forEach(flow => {
      flowMap.set(flow.id, flow);
    });

    if (showPublicFlows) {
      publicFlows.forEach(flow => {
        if (!flowMap.has(flow.id)) {
          flowMap.set(flow.id, flow);
        }
      });
    }

    return Array.from(flowMap.values());
  };

  const filteredFlows = getAllFlows().filter(flow =>
    flow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    flow.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedFlow = getAllFlows().find(flow => flow.id === selectedFlowId);

  const totalFlowsCount = getAllFlows().length;
  const privateFlowsCount = flows.length;
  const publicFlowsCount = showPublicFlows ? publicFlows.length : 0;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-red-400 hover:text-red-600 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 border-2 rounded-xl
                   hover:border-[#0073E6] focus:outline-none focus:ring-2
                   transition-all flex items-center justify-between text-left"
        style={{background:'#0073E6', borderColor:'#0073E6', boxShadow:'0 2px 8px rgba(0,0,92,0.12)'}}
        onFocus={e => e.currentTarget.style.boxShadow='0 0 0 3px rgba(0,115,230,0.1)'}
        onBlur={e => e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,92,0.06)'}
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg" style={{background:'#3DC7FF'}}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="text-white font-semibold">
              {selectedFlow ? selectedFlow.name : 'Select a Flow'}
            </div>
            <div className="text-sm" style={{color:'rgba(255,255,255,0.7)'}}>
              {selectedFlow ? (
                <div className="flex items-center space-x-2">
                  <span>ID: {selectedFlow.id}</span>
                  {getFlowType(selectedFlow) === 'both' && (
                    <span className="px-1.5 py-0.5 text-white text-xs rounded" style={{background:'#0073E6'}}>
                      PUBLIC & PRIVATE
                    </span>
                  )}
                  {getFlowType(selectedFlow) === 'public' && (
                    <span className="px-1.5 py-0.5 text-white text-xs rounded" style={{background:'#0073E6'}}>
                      PUBLIC
                    </span>
                  )}
                  {getFlowType(selectedFlow) === 'private' && (
                    <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-xs rounded">
                      PRIVATE
                    </span>
                  )}
                </div>
              ) : (
                `${totalFlowsCount} flows available (${privateFlowsCount} private${showPublicFlows ? `, ${publicFlowsCount} public` : ''})`
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {(isLoading || isLoadingPublic) && (
            <svg className="animate-spin h-4 w-4" style={{color:'rgba(255,255,255,0.7)'}} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          <svg
            className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            style={{color:'rgba(255,255,255,0.7)'}}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200
                        rounded-xl shadow-xl z-50 flex flex-col overflow-hidden"
             style={{ maxHeight: '28rem', boxShadow:'0 8px 32px rgba(0,0,92,0.12)' }}>

          {/* Header */}
          <div className="border-b border-slate-100 px-4 py-3 flex-shrink-0"
               style={{background:'#0073E6'}}>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">All Flows</h3>
              <div className="flex items-center space-x-3 text-xs" style={{color:'rgba(255,255,255,0.7)'}}>
                <span className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-white/30 rounded"></div>
                  <span>{privateFlowsCount} Private</span>
                </span>
                {showPublicFlows && (
                  <span className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded" style={{background:'#3DC7FF'}}></div>
                    <span>{publicFlowsCount} Public</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Search and Actions */}
          <div className="p-3 border-b border-slate-100 flex-shrink-0" style={{background:'#f7f9fc'}}>
            <div className="flex items-center space-x-2 mb-3">
              {/* Search Input */}
              <div className="flex-1 relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400"
                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search flows..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg
                           text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 text-sm"
                  style={{'--tw-ring-color':'rgba(0,115,230,0.2)'}}
                  onFocus={e => { e.target.style.borderColor='#0073E6'; e.target.style.boxShadow='0 0 0 3px rgba(0,115,230,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor=''; e.target.style.boxShadow=''; }}
                />
              </div>

              {/* Refresh Button */}
              <button
                onClick={refreshAllFlows}
                disabled={isLoading || isLoadingPublic}
                className="p-2 text-white rounded-lg transition-colors disabled:opacity-50"
                style={{background:'#0073E6'}}
                onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background='#00005C')}
                onMouseLeave={e => e.currentTarget.style.background='#0073E6'}
                title="Refresh all flows"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex-1 px-3 py-2 text-white rounded-lg transition-colors disabled:opacity-50
                         flex items-center justify-center space-x-2 text-sm font-medium"
                style={{background:'#0073E6'}}
                onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background='#00005C')}
                onMouseLeave={e => e.currentTarget.style.background='#0073E6'}
              >
                {isUploading ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                )}
                <span>{isUploading ? 'Uploading...' : 'Upload Flow'}</span>
              </button>

              {selectedFlow && (
                <button
                  onClick={() => handleFlowSelect(null)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                  title="Clear selection"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}

              {/* Toggle Public Flows */}
              <button
                onClick={() => setShowPublicFlows(!showPublicFlows)}
                className={`px-3 py-2 rounded-lg transition-colors text-sm font-medium`}
                style={showPublicFlows
                  ? {background:'#0073E6', color:'white'}
                  : {background:'#e2e8f0', color:'#64748b'}
                }
                onMouseEnter={e => {
                  if (showPublicFlows) e.currentTarget.style.background='#00005C';
                  else e.currentTarget.style.background='#cbd5e1';
                }}
                onMouseLeave={e => {
                  if (showPublicFlows) e.currentTarget.style.background='#0073E6';
                  else e.currentTarget.style.background='#e2e8f0';
                }}
                title={showPublicFlows ? 'Hide public flows' : 'Show public flows'}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m-9 9a9 9 0 919-9" />
                </svg>
              </button>
            </div>
          </div>

          {/* Flows List */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-white">
            {(isLoading || isLoadingPublic) ? (
              <div className="p-8 text-center">
                <div className="flex items-center justify-center mb-3">
                  <svg className="animate-spin h-6 w-6" style={{color:'#0073E6'}} fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <p className="text-slate-400 text-sm">Loading flows...</p>
              </div>
            ) : filteredFlows.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="mx-auto h-10 w-10 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                        d="M34 40h10v-4a6 6 0 00-10.712-3.714M34 40H14m20 0v-4a9.971 9.971 0 00-.712-3.714M14 40H4v-4a6 6 0 0110.713-3.714M14 40v-4c0-1.313.253-2.566.713-3.714m0 0A9.971 9.971 0 0124 24c4.21 0 7.813 2.602 9.288 6.286" />
                </svg>
                <p className="text-slate-500 text-sm">
                  {searchQuery ? 'No flows match your search' : 'No flows found'}
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  {searchQuery ? 'Try a different search term' : 'Upload a flow file to get started'}
                </p>
              </div>
            ) : (
              filteredFlows.map((flow) => {
                const flowType = getFlowType(flow);
                const canDelete = canDeleteFlow(flow);
                const isSelected = selectedFlowId === flow.id;

                return (
                  <div
                    key={flow.id}
                    className={`px-4 py-3 border-b border-slate-100 last:border-b-0 
                               cursor-pointer transition-all
                               ${isSelected
                                 ? 'bg-blue-50 border-l-2'
                                 : 'hover:bg-slate-50 border-l-2 border-l-transparent'
                               }`}
                    style={isSelected ? {borderLeftColor:'#0073E6'} : {}}
                    onClick={() => handleFlowSelect(flow)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-semibold text-slate-800 truncate text-sm">{flow.name}</h3>

                          {flowType === 'both' && (
                            <div className="flex items-center space-x-1">
                              <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-xs rounded flex items-center space-x-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                <span>PRIVATE</span>
                              </span>
                              <span className="px-1.5 py-0.5 text-white text-xs rounded flex items-center space-x-1 font-medium"
                                    style={{background:'#0073E6'}}>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m-9 9a9 9 0 919-9" />
                                </svg>
                                <span>PUBLIC</span>
                              </span>
                            </div>
                          )}

                          {flowType === 'public' && (
                            <span className="px-1.5 py-0.5 text-white text-xs rounded flex items-center space-x-1 font-medium"
                                  style={{background:'#0073E6'}}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m-9 9a9 9 0 919-9" />
                              </svg>
                              <span>PUBLIC</span>
                            </span>
                          )}

                          {flowType === 'private' && (
                            <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-xs rounded flex items-center space-x-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              <span>PRIVATE</span>
                            </span>
                          )}

                          {isSelected && (
                            <svg className="w-4 h-4 flex-shrink-0" style={{color:'#0073E6'}} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">
                          {flow.description || 'No description'}
                        </p>
                        <p className="text-xs text-slate-300 font-mono mt-0.5">
                          {flow.id}
                        </p>
                      </div>

                      {canDelete && (
                        <button
                          onClick={(e) => handleDeleteFlow(flow.id, flow.name, e)}
                          className="ml-2 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50
                                   rounded-lg transition-all flex-shrink-0"
                          title="Delete flow and associated collection"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-slate-100 flex-shrink-0" style={{background:'#f7f9fc'}}>
            <p className="text-xs text-slate-400">
              {filteredFlows.length} of {totalFlowsCount} flows
              {selectedFlow && (
                <span style={{color:'#0073E6'}}> • {selectedFlow.name}</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".json"
        className="hidden"
      />
    </div>
  );
};

export default FlowManagement;