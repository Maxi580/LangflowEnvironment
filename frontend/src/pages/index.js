import React, { useState, useRef, useEffect } from 'react';
import config from '../config';
import deleteFlow from './services/deleteFlow';
import getFlows from './services/getFlows';
import uploadFlow from './services/uploadFlow';
import { fetchFiles, uploadFiles, deleteFile, formatFileSize } from './services/fileService';

// Component imports
import FlowSelector from './components/FlowSelector';
import FileManagementPanel from './components/FileManagementPanel';
import ChatContainer from './components/ChatContainer';
import UploadFlowComponent from './components/UploadFlowComponent';

function Prompt() {
  const [flowId, setFlowId] = useState(() => {
    // Try to get flowId from localStorage, or use default from config
    return localStorage.getItem('langflow_flowId') || config.defaultFlowId;
  });

  const [userInput, setUserInput] = useState('');
  const [showFlowSelector, setShowFlowSelector] = useState(false);
  const [showUploadFlow, setShowUploadFlow] = useState(false);
  const [isUploadingFlow, setIsUploadingFlow] = useState(false);
  const [uploadFlowError, setUploadFlowError] = useState(null);
  const [flows, setFlows] = useState([]);
  const [flowsLoading, setFlowsLoading] = useState(false);
  const [flowsError, setFlowsError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // File management states
  const [files, setFiles] = useState([]);
  const [isFilesLoading, setIsFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [models, setModels] = useState([]);
  const [serverStatus, setServerStatus] = useState({
    ollama_connected: false,
    qdrant_connected: false
  });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

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

  // Fetch files when flow ID changes
  useEffect(() => {
    if (flowId) {
      handleFetchFiles();
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
    handleFetchFiles();

    // Check server status and get available models
    fetchServerStatus();
    fetchModels();
  }, []);

  // Fetch flows when flow selector is opened
  useEffect(() => {
    if (showFlowSelector) {
      handleFetchFlows();
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
  const handleFetchFlows = async () => {
    setFlowsLoading(true);
    setFlowsError(null);

    try {
      const data = await getFlows(true); // true to remove example flows
      setFlows(data);
    } catch (err) {
      console.error("Failed to fetch flows:", err);
      setFlowsError(err.message);
    } finally {
      setFlowsLoading(false);
    }
  };

  // Function to handle flow upload
  // Function to handle flow upload
  const handleFlowUpload = async (file, flowName, flowDescription, error = null) => {
    // Handle validation errors from the component
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
      // Read the file content
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          // Parse the JSON content
          const flowData = JSON.parse(e.target.result);

          // Only add name and description if provided by the user
          // Otherwise, keep the original values from the JSON file
          if (flowName && flowName.trim()) {
            flowData.name = flowName;
          }

          if (flowDescription && flowDescription.trim()) {
            flowData.description = flowDescription;
          } else if (!flowData.description) {
            // Set an empty description if none exists
            flowData.description = '';
          }

          // Upload the flow
          const result = await uploadFlow(flowData);

          // Add newly uploaded flow to flows list if not already there
          setFlows(prevFlows => {
            if (prevFlows.some(flow => flow.id === result.id)) {
              return prevFlows.map(flow =>
                flow.id === result.id ? result : flow
              );
            } else {
              return [...prevFlows, result];
            }
          });

          // Show confirmation message
          setMessages(prev => [...prev, {
            id: Date.now(),
            text: `Flow "${result.name}" was successfully uploaded.`,
            sender: 'system',
            timestamp: new Date()
          }]);

          // Close the upload dialog
          setShowUploadFlow(false);

        } catch (err) {
          console.error('Error parsing JSON:', err);
          setUploadFlowError('Invalid JSON file');
        } finally {
          setIsUploadingFlow(false);
        }
      };

      reader.onerror = () => {
        setUploadFlowError('Error reading file');
        setIsUploadingFlow(false);
      };

      reader.readAsText(file);

    } catch (err) {
      console.error('Error uploading flow:', err);
      setUploadFlowError(err.message || 'Failed to upload flow');
      setIsUploadingFlow(false);
    }
  };

  // Function to fetch all files
  const handleFetchFiles = async () => {
    if (!flowId) return;

    setIsFilesLoading(true);
    setFilesError(null);

    try {
      const files = await fetchFiles(flowId);
      setFiles(files);
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
      const result = await uploadFiles(filesToUpload, flowId);

      // Refresh file list after upload
      handleFetchFiles();

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
      await deleteFile(filePath, flowId);

      // Refresh file list after deletion
      handleFetchFiles();

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

      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `Error deleting file: ${err.message}`,
        sender: 'error',
        timestamp: new Date()
      }]);
    }
  };

  // Function to handle flow deletion
  const handleDeleteFlow = async (flowToDelete) => {
    try {
      await deleteFlow(flowToDelete.id);

      // Refresh flows list
      handleFetchFlows();

      // If the deleted flow was the current one, reset flowId
      if (flowToDelete.id === flowId) {
        setFlowId('');
        localStorage.removeItem('langflow_flowId'); // Clear from localStorage

        setMessages(prev => [...prev, {
          id: Date.now(),
          text: `Current flow "${flowToDelete.name}" was deleted. Please select a new flow.`,
          sender: 'system',
          timestamp: new Date()
        }]);

        // Clear files list since the flow is deleted
        setFiles([]);
      } else {
        // Just notify about deletion
        setMessages(prev => [...prev, {
          id: Date.now(),
          text: `Flow "${flowToDelete.name}" was deleted.`,
          sender: 'system',
          timestamp: new Date()
        }]);
      }
    } catch (err) {
      console.error('Error deleting flow:', err);
      setError(`Failed to delete flow: ${err.message}`);

      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `Error deleting flow: ${err.message}`,
        sender: 'error',
        timestamp: new Date()
      }]);
    }
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

  return (
    <div className="flex w-full max-w-7xl mx-auto gap-6">
      {/* Chat column */}
      <div className="flex-1 flex flex-col">
        {/* Flow Selector and Upload Flow buttons */}
        <div className="flex justify-end mb-4 space-x-2">
          <button
            onClick={() => setShowUploadFlow(true)}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700
                     text-white rounded-lg text-sm transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            Upload Flow
          </button>
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
        </div>

        {/* Flow selector */}
        {showFlowSelector && (
          <FlowSelector
            flows={flows}
            flowId={flowId}
            flowsLoading={flowsLoading}
            flowsError={flowsError}
            fetchFlows={handleFetchFlows}
            handleSelectFlow={handleSelectFlow}
            handleDeleteFlow={handleDeleteFlow}
            setShowFlowSelector={setShowFlowSelector}
          />
        )}

        {/* Upload Flow component */}
        {showUploadFlow && (
          <UploadFlowComponent
            onUpload={handleFlowUpload}
            onClose={() => setShowUploadFlow(false)}
            isUploading={isUploadingFlow}
            uploadError={uploadFlowError}
          />
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
        <ChatContainer
          messages={messages}
          userInput={userInput}
          setUserInput={setUserInput}
          handleSend={handleSend}
          isLoading={isLoading}
          flowId={flowId}
          inputRef={inputRef}
          messagesEndRef={messagesEndRef}
          setShowFlowSelector={setShowFlowSelector}
        />
      </div>

      {/* Files column */}
      <div className="w-80 flex-shrink-0">
        <FileManagementPanel
          serverStatus={serverStatus}
          flowId={flowId}
          files={files}
          isFilesLoading={isFilesLoading}
          filesError={filesError}
          isUploading={isUploading}
          models={models}
          fileInputRef={fileInputRef}
          handleFileUpload={handleFileUpload}
          fetchFiles={handleFetchFiles}
          handleDeleteFile={handleDeleteFile}
          formatFileSize={formatFileSize}
        />
      </div>
    </div>
  );
}

export default Prompt;