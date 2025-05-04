import React, { useState, useRef, useEffect } from 'react';
import config from '../config';

function Prompt() {
  const [flowId, setFlowId] = useState(() => {
    // Try to get flowId from localStorage, or use default from config
    return localStorage.getItem('langflow_flowId') || config.defaultFlowId;
  });

  const [userInput, setUserInput] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [showFlowSelector, setShowFlowSelector] = useState(false);
  const [flows, setFlows] = useState([]);
  const [flowsLoading, setFlowsLoading] = useState(false);
  const [flowsError, setFlowsError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // New states for file management
  const [files, setFiles] = useState([]);
  const [isFilesLoading, setIsFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [models, setModels] = useState([]);
  const [serverStatus, setServerStatus] = useState({
    ollama_connected: false,
    qdrant_connected: false
  });

  // Flow management states
  const [isUploadingFlow, setIsUploadingFlow] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingFlowId, setDeletingFlowId] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const flowFileInputRef = useRef(null);

  // Save flowId to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('langflow_flowId', flowId);
  }, [flowId]);

  // Re-check server status when flow ID changes to ensure collection exists
  useEffect(() => {
    if (flowId) {
      fetchServerStatus();
    }
  }, [flowId]);

  // Refresh files when flow ID changes
  useEffect(() => {
    if (flowId) {
      fetchFiles();
    } else {
      // If no flow ID, clear the files list
      setFiles([]);
    }
  }, [flowId]);

  // Scroll to bottom of chat when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when component loads and create session ID if it doesn't exist
  useEffect(() => {
    inputRef.current?.focus();

    // Generate and store a session ID if it doesn't exist yet
    if (!localStorage.getItem('langflow_session_id')) {
      localStorage.setItem('langflow_session_id', `session_${Date.now()}`);
    }

    // Load files on component mount
    fetchFiles();

    // Check server status and get available models
    fetchServerStatus();
    fetchModels();
  }, []);

  // Fetch flows when flow selector is opened
  useEffect(() => {
    if (showFlowSelector) {
      fetchFlows();
    }
  }, [showFlowSelector]);

  // Function to fetch server status
  const fetchServerStatus = async () => {
    try {
      // Pass the current flow ID as a query parameter if available
      const url = flowId
        ? `${config.api.getStatusUrl()}?flow_id=${encodeURIComponent(flowId)}`
        : config.api.getStatusUrl();

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setServerStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch server status:", err);
    }
  };

  // Function to fetch available models
  const fetchModels = async () => {
    try {
      const response = await fetch(config.api.getModelsUrl());
      if (response.ok) {
        const data = await response.json();
        setModels(data.models || []);
      }
    } catch (err) {
      console.error("Failed to fetch models:", err);
    }
  };

  // Function to fetch all available flows
  const fetchFlows = async () => {
    setFlowsLoading(true);
    setFlowsError(null);

    try {
      const flowsUrl = `${config.api.getFlowsUrl()}?remove_example_flows=true`;

      const response = await fetch(flowsUrl, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error fetching flows: ${response.status}`);
      }

      const data = await response.json();
      console.log("Flows response:", data);

      if (Array.isArray(data)) {
        setFlows(data);
      } else {
        console.error("Unexpected flows response format:", data);
        setFlows([]);
      }
    } catch (err) {
      console.error("Failed to fetch flows:", err);
      setFlowsError(err.message);
    } finally {
      setFlowsLoading(false);
    }
  };

  // Function to fetch all files
  const fetchFiles = async () => {
    setIsFilesLoading(true);
    setFilesError(null);

    try {
      // Add flow_id parameter if it's available to filter files by current flow
      const url = flowId
        ? `${config.api.getFilesUrl()}?flow_id=${encodeURIComponent(flowId)}`
        : config.api.getFilesUrl();

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Error fetching files: ${response.status}`);
      }

      const data = await response.json();
      console.log("Files response:", data);

      if (data.files) {
        setFiles(data.files);
      } else {
        console.error("Unexpected files response format:", data);
        setFiles([]);
      }
    } catch (err) {
      console.error("Failed to fetch files:", err);
      setFilesError(err.message);
    } finally {
      setIsFilesLoading(false);
    }
  };

  // Function to upload files
  const handleFileUpload = async (event) => {
    const filesToUpload = event.target.files;
    if (!filesToUpload.length) {
      return;
    }

    // Check if flow ID is available
    if (!flowId) {
      setError("No Flow ID set. Please select a flow before uploading files.");
      setShowFlowSelector(true);
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();

      // Append all selected files to FormData
      for (let i = 0; i < filesToUpload.length; i++) {
        formData.append('file', filesToUpload[i]);
      }

      // Use the upload URL with the flow_id parameter
      const uploadUrl = `${config.api.getUploadUrl()}?flow_id=${encodeURIComponent(flowId)}`;

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Failed to upload files: ${response.status}`);
      }

      const result = await response.json();
      console.log("Upload response:", result);

      // Refresh file list after upload
      fetchFiles();

      // Add a system message about uploaded files
      const fileNames = Array.from(filesToUpload).map(f => f.name).join(', ');
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `Files uploaded: ${fileNames} (stored in collection: ${flowId})`,
        sender: 'system',
        timestamp: new Date()
      }]);

    } catch (err) {
      console.error('Error uploading files:', err);
      setError(`Failed to upload files: ${err.message}`);

      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `Error uploading files: ${err.message}`,
        sender: 'error',
        timestamp: new Date()
      }]);
    } finally {
      setIsUploading(false);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Function to delete a file
  const handleDeleteFile = async (filePath) => {
    // Check if flow ID is available
    if (!flowId) {
      setError("No Flow ID set. Please select a flow before deleting files.");
      setShowFlowSelector(true);
      return;
    }

    try {
      const response = await fetch(config.api.getFilesUrl(), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file_path: filePath,
          flow_id: flowId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to delete file: ${response.status}`);
      }

      // Refresh file list after deletion
      fetchFiles();

      // Add a system message about deleted file
      const fileName = filePath.split('/').pop().split('-').slice(1).join('-');
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `File deleted: ${fileName} (from collection: ${flowId})`,
        sender: 'system',
        timestamp: new Date()
      }]);

    } catch (err) {
      console.error('Error deleting file:', err);
      setError(`Failed to delete file: ${err.message}`);
    }
  };

  // Function to handle flow file upload
  const handleFlowFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploadingFlow(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(config.api.getFlowUploadUrl(), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Flow upload response:", data);

      // Refresh flows list after upload
      await fetchFlows();

      // If we got back flow data, select the first one
      if (Array.isArray(data) && data.length > 0) {
        setFlowId(data[0].id);

        // Add a system message to indicate flow change
        setMessages(prev => [...prev, {
          id: Date.now(),
          text: `Flow uploaded and selected: ${data[0].name}`,
          sender: 'system',
          timestamp: new Date()
        }]);
      } else {
        // Generic success message if no specific flow data returned
        setMessages(prev => [...prev, {
          id: Date.now(),
          text: `Flow "${file.name}" uploaded successfully.`,
          sender: 'system',
          timestamp: new Date()
        }]);
      }
    } catch (err) {
      console.error("Error uploading flow:", err);
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `Error uploading flow: ${err.message}`,
        sender: 'error',
        timestamp: new Date()
      }]);
    } finally {
      setIsUploadingFlow(false);
      // Reset file input
      if (flowFileInputRef.current) {
        flowFileInputRef.current.value = '';
      }
    }
  };

  // Handle flow deletion
  const handleDeleteFlow = async (flowToDelete, e) => {
    // Stop event propagation to prevent selecting the flow when clicking delete
    if (e) {
      e.stopPropagation();
    }

    // Confirm before deleting
    if (!window.confirm(`Are you sure you want to delete the flow "${flowToDelete.name}"?`)) {
      return;
    }

    setIsDeleting(true);
    setDeletingFlowId(flowToDelete.id);

    try {
      const deleteUrl = config.api.getFlowDeleteUrl(flowToDelete.id);

      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Delete failed with status: ${response.status}`);
      }

      console.log(`Flow deleted: ${flowToDelete.id}`);

      // If the deleted flow was selected, clear the selection
      if (flowId === flowToDelete.id) {
        setFlowId('');
        // Add a system message to indicate flow removal
        setMessages(prev => [...prev, {
          id: Date.now(),
          text: `Current flow "${flowToDelete.name}" was deleted.`,
          sender: 'system',
          timestamp: new Date()
        }]);
      } else {
        // Just add a notification
        setMessages(prev => [...prev, {
          id: Date.now(),
          text: `Flow "${flowToDelete.name}" was deleted.`,
          sender: 'system',
          timestamp: new Date()
        }]);
      }

      // Refresh the flows list
      await fetchFlows();

    } catch (err) {
      console.error("Error deleting flow:", err);
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `Error deleting flow: ${err.message}`,
        sender: 'error',
        timestamp: new Date()
      }]);
    } finally {
      setIsDeleting(false);
      setDeletingFlowId(null);
    }
  };

  // Trigger file input click
  const handleFlowUploadClick = () => {
    flowFileInputRef.current?.click();
  };

  // Extract the actual text message from LangFlow's complex response structure
  const extractBotResponse = (data) => {
    try {
      // Check for empty outputs array
      if (data.outputs && data.outputs.length > 0) {
        const firstOutput = data.outputs[0];

        // Check if outputs is empty array
        if (firstOutput.outputs && firstOutput.outputs.length === 0) {
          return "No response received from LangFlow. The agent may not have generated any output.";
        }

        if (firstOutput.outputs && firstOutput.outputs.length > 0) {
          const messageOutput = firstOutput.outputs[0];

          // Try to get from messages array first
          if (messageOutput.messages && messageOutput.messages.length > 0) {
            return messageOutput.messages[0].message;
          }

          // Try results.message.text if messages isn't available
          if (messageOutput.results?.message?.text) {
            return messageOutput.results.message.text;
          }

          // Try direct message property
          if (messageOutput.message?.message) {
            return messageOutput.message.message;
          }
        }
      }

      // Fallbacks for different response structures
      if (data.result) {
        return data.result;
      }

      if (data.output) {
        return data.output;
      }

      if (typeof data === 'string') {
        return data;
      }

      // Check if we have outputs array but with empty outputs
      if (data.outputs && data.outputs.length > 0 &&
          data.outputs[0].outputs && data.outputs[0].outputs.length === 0) {
        return "No response received from LangFlow. The agent may not have generated any output.";
      }

      // Last resort: stringify the response but warn the user
      return `Response format unexpected. Please check your LangFlow configuration. Raw response: ${JSON.stringify(data).slice(0, 100)}...`;
    } catch (err) {
      console.error("Error extracting bot response:", err);
      return "Failed to parse response. Please check your LangFlow configuration.";
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();

    // Allow sending if there's text input
    if (!userInput.trim()) return;

    if (!flowId) {
      setError("No Flow ID set. Please select a flow from the Flow Selector.");
      setShowFlowSelector(true);
      return;
    }

    const messageText = userInput.trim();
    setUserInput('');

    // Create a list of file references
    const fileReferences = files.map(file => `${file.file_name} (${file.file_type})`).join(", ");

    // Add user message to chat
    setMessages(prev => [...prev, {
      id: Date.now(),
      text: messageText,
      sender: 'user',
      timestamp: new Date()
    }]);

    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = config.api.getRunUrl(flowId);

      // Create a formatted input string with mention of available files
      const message = files.length > 0
        ? `${messageText}\n\nAvailable files: ${fileReferences}`
        : messageText;

      const payload = {
        input_value: message,
        output_type: 'chat',
        input_type: 'chat',
        session_id: localStorage.getItem('langflow_session_id') || `session_${Date.now()}`
      };

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      };

      // Make API call to LangFlow
      const response = await fetch(apiUrl, options);

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      console.log("LangFlow response:", data);

      // Extract the actual text response
      const botResponse = extractBotResponse(data);

      setMessages(prev => [...prev, {
        id: Date.now(),
        text: botResponse,
        sender: 'bot',
        timestamp: new Date()
      }]);

    } catch (err) {
      console.error('Error calling LangFlow API:', err);
      setError(`Failed to get response: ${err.message}`);

      // Add error message to chat
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `Error: ${err.message}. Please check your Flow ID and ensure LangFlow is running.`,
        sender: 'error',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
      // Focus back on input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  // Format file size for display
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  // Handle flow selection
  const handleSelectFlow = (selectedFlow) => {
    setFlowId(selectedFlow.id);
    setShowFlowSelector(false);

    // Add a system message to indicate flow change
    setMessages(prev => [...prev, {
      id: Date.now(),
      text: `Flow changed to: ${selectedFlow.name}`,
      sender: 'system',
      timestamp: new Date()
    }]);
  };

  // Flow Selector Component
  const FlowSelector = () => {
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
                } rounded-lg cursor-pointer transition-colors`}
              >
                <div className="flex-grow" onClick={() => handleSelectFlow(flow)}>
                  <div className="text-white font-medium truncate">{flow.name}</div>
                  <div className="text-slate-400 text-xs truncate">{flow.id}</div>
                </div>
                <div className="flex items-center">
                  <button
                    onClick={(e) => handleDeleteFlow(flow, e)}
                    disabled={isDeleting && deletingFlowId === flow.id}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded-full transition-colors"
                    title="Delete flow"
                  >
                    {isDeleting && deletingFlowId === flow.id ? (
                      <svg className="animate-spin h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                  <div
                    onClick={() => handleSelectFlow(flow)}
                    className="ml-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
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
              onChange={handleFlowFileUpload}
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
              onClick={fetchFlows}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    );
  };

  // File Management Panel Component
  const FileManagementPanel = () => {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-lg mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-white">Files</h3>
          <div className="flex space-x-2">
            {/* Server Status Indicators */}
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-1 ${serverStatus.ollama_connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-xs text-slate-300">Ollama</span>
            </div>
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-1 ${serverStatus.qdrant_connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-xs text-slate-300">Qdrant</span>
            </div>
          </div>
        </div>

        {/* Upload button */}
        <div className="mb-4">
          <label className="flex items-center justify-center w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>Upload Files</span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              className="sr-only"
              disabled={isUploading || !flowId}
            /></label>
          {isUploading && (
            <div className="mt-2 text-sm text-slate-300 flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Uploading files...
            </div>
          )}
        </div>

        {/* Files loading state */}
        {isFilesLoading && (
          <div className="py-3 text-slate-300 text-sm">
            <div className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading files...
            </div>
          </div>
        )}

        {/* Files error state */}
        {filesError && (
          <div className="py-3 text-red-400 text-sm">
            Error loading files: {filesError}
            <button
              onClick={fetchFiles}
              className="ml-2 text-blue-400 hover:text-blue-300 underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* No files state */}
        {!isFilesLoading && !filesError && files.length === 0 && (
          <div className="py-6 text-center text-slate-400 border border-dashed border-slate-700 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>No files uploaded yet</p>
            <p className="text-xs mt-1">Upload files to use them in your conversations</p>
          </div>
        )}

        {/* Files list */}
        {!isFilesLoading && !filesError && files.length > 0 && (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={file.file_id}
                className="relative bg-slate-700 rounded-lg p-3 hover:bg-slate-600 transition-colors"
              >
                {/* Delete button */}
                <button
                  onClick={() => handleDeleteFile(file.file_path)}
                  className="absolute top-2 right-2 p-1 bg-slate-800 hover:bg-red-600 rounded-full transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* File icon based on type */}
                <div className="flex items-start">
                  <div className="bg-slate-800 p-2 rounded mr-3 flex-shrink-0">
                    {file.file_type === 'pdf' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{file.file_name}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {formatFileSize(file.file_size)} • {file.file_type.toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Flow ID Info */}
        {flowId && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="text-xs text-slate-400 mb-1">Current collection:</div>
            <div className="bg-slate-700 text-xs text-slate-300 px-2 py-1 rounded truncate font-mono">
              {flowId}
            </div>
          </div>
        )}

        {/* Embedding model info */}
        {models.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="text-xs text-slate-400 mb-1">Available embedding models:</div>
            <div className="flex flex-wrap gap-2">
              {models.map((model, idx) => (
                <div key={idx} className="bg-slate-700 text-xs text-slate-300 px-2 py-1 rounded">
                  {model}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex w-full max-w-7xl mx-auto gap-6">
      {/* Chat column */}
      <div className="flex-1 flex flex-col">
        {/* Settings and Flow Selector buttons */}
        <div className="flex justify-end mb-4 space-x-2">
          <button
            onClick={handleFlowUploadClick}
            disabled={isUploadingFlow}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700
                     text-white rounded-lg text-sm transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            Upload Flow
          </button>
          <input
            type="file"
            ref={flowFileInputRef}
            onChange={handleFlowFileUpload}
            accept=".json,.yaml,.yml"
            className="hidden"
          />

          <button
            onClick={() => setShowFlowSelector(!showFlowSelector)}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700
                     text-white rounded-lg text-sm transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
            </svg>
            Flows
          </button>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600
                     text-slate-200 rounded-lg text-sm transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            Settings
          </button>
        </div>

        {/* Flow selector */}
        {showFlowSelector && <FlowSelector />}

        {/* Configuration panel */}
        {showConfig && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-6 shadow-lg">
            <div className="space-y-4">
              <div>
                <label htmlFor="flowId" className="block text-sm font-medium text-slate-300 mb-1">
                  Current LangFlow Flow ID
                </label>
                <div className="text-xs text-slate-400 mb-2">
                  {flowId ?
                    "Current Flow ID is set. You can also select a flow using the Flows button." :
                    "No Flow ID set. Please select a flow using the Flows button or enter an ID manually."
                  }
                </div>
                <input
                  type="text"
                  id="flowId"
                  value={flowId}
                  onChange={(e) => setFlowId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 0f1d57c2-98b1-45c3-b7cc-6c0a38065d46"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowConfig(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Display current flow name if available */}
        {flowId && flows.length > 0 && (
          <div className="mb-4 bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-700">
            <div className="text-xs text-slate-400">Current Flow:</div>
            <div className="text-sm text-slate-200 font-medium">
              {flows.find(f => f.id === flowId)?.name || 'Unknown Flow'}
            </div>
            <div className="text-xs text-slate-400 font-mono truncate">{flowId}</div>
          </div>
        )}

        {/* Chat container */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden flex flex-col h-[600px]">
          {/* Messages display */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 mb-5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Start a conversation</h3>
                <p className="text-slate-400 max-w-md mb-6">
                  Ask me anything and I'll respond using your LangFlow agent.
                </p>
                {!flowId && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowFlowSelector(true)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                    >
                      Select a Flow
                    </button>
                    <button
                      onClick={handleFlowUploadClick}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                    >
                      Upload a Flow
                    </button>
                  </div>
                )}
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-3/4 rounded-2xl px-4 py-3 ${
                      message.sender === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : message.sender === 'error'
                          ? 'bg-red-600 text-white'
                          : message.sender === 'system'
                            ? 'bg-indigo-500 text-white'
                            : 'bg-slate-700 text-white'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.text}</p>
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-700 text-white rounded-2xl px-4 py-3">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-slate-700 p-4 bg-slate-800">
            <form onSubmit={handleSend} className="flex space-x-2">
              {/* Text input */}
              <input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg
                         text-white placeholder-slate-400 focus:outline-none
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              />

              {/* Send button */}
              <button
                type="submit"
                disabled={isLoading || !userInput.trim() || !flowId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                         focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Files column */}
      <div className="w-80 flex-shrink-0">
        <FileManagementPanel />
      </div>
    </div>
  );
}

export default Prompt;