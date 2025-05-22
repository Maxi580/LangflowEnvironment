import React, { useState, useEffect, useRef } from 'react';
import fileService from '../services/FileService';
import messageService from '../services/MessageService';

/**
 * FileManagement component that handles all file-related functionality
 * including uploading, listing, and deleting files
 */
const FileManagement = ({
  flowId,
  setMessages
}) => {
  // Component state
  const [serverStatus, setServerStatus] = useState({
    ollama_connected: false,
    qdrant_connected: false
  });
  const [files, setFiles] = useState([]);
  const [isFilesLoading, setIsFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [models, setModels] = useState([]);

  // Refs
  const fileInputRef = useRef(null);

  // Check server status and fetch models on component mount
  useEffect(() => {
    fetchServerStatus();
    fetchModels();
  }, []);

  // Re-check server status and fetch files when flowId changes
  useEffect(() => {
    if (flowId) {
      fetchServerStatus();
      fetchFiles();
    } else {
      // If no flow ID, clear the files list
      setFiles([]);
    }
  }, [flowId]);

  /**
   * Fetches server status
   */
  const fetchServerStatus = async () => {
    try {
      const status = await fileService.checkServerStatus(flowId);
      setServerStatus(status);
    } catch (err) {
      console.error("Failed to fetch server status:", err);
      // Don't set error state here as it's not critical for UI
    }
  };

  /**
   * Fetches available embedding models
   */
  const fetchModels = async () => {
    try {
      const modelsList = await fileService.getEmbeddingModels();
      setModels(modelsList);
    } catch (err) {
      console.error("Failed to fetch models:", err);
      // Don't set error state here as it's not critical for UI
    }
  };

  /**
   * Fetches files for the current flowId
   */
  const fetchFiles = async () => {
    if (!flowId) return;

    setIsFilesLoading(true);
    setFilesError(null);

    try {
      const filesList = await fileService.fetchFiles(flowId);
      setFiles(filesList);
    } catch (err) {
      console.error("Failed to fetch files:", err);
      setFilesError(err.message);
    } finally {
      setIsFilesLoading(false);
    }
  };

  /**
   * Handles file upload
   */
  const handleFileUpload = async (event) => {
    const filesToUpload = event.target.files;
    if (!filesToUpload.length) return;

    // Check if flow ID is available
    if (!flowId) {
      setFilesError("No Flow ID set. Please select a flow before uploading files.");
      return;
    }

    setIsUploading(true);

    try {
      await fileService.uploadFiles(filesToUpload, flowId);

      // Refresh file list after upload
      fetchFiles();

      // Add a system message about uploaded files
      const fileNames = Array.from(filesToUpload).map(f => f.name).join(', ');
      const message = messageService.createSystemMessage(
        `Files uploaded: ${fileNames} (stored in collection: ${flowId})`
      );
      setMessages && setMessages(prev => [...prev, message]);
    } catch (err) {
      console.error('Error uploading files:', err);
      setFilesError(`Failed to upload files: ${err.message}`);

      // Add error message to chat if message service is available
      if (setMessages) {
        const errorMessage = messageService.createErrorMessage(
          `Error uploading files: ${err.message}`
        );
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsUploading(false);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /**
   * Handles file deletion
   */
  const handleDeleteFile = async (filePath) => {
    if (!flowId) {
      setFilesError("No Flow ID set. Please select a flow before deleting files.");
      return;
    }

    try {
      await fileService.deleteFile(filePath, flowId);

      // Refresh file list after deletion
      fetchFiles();

      // Add a system message about deleted file
      if (setMessages) {
        const fileName = filePath.split('/').pop().split('-').slice(1).join('-');
        const message = messageService.createSystemMessage(
          `File deleted: ${fileName} (from collection: ${flowId})`
        );
        setMessages(prev => [...prev, message]);
      }
    } catch (err) {
      console.error('Error deleting file:', err);
      setFilesError(`Failed to delete file: ${err.message}`);

      // Add error message to chat if message service is available
      if (setMessages) {
        const errorMessage = messageService.createErrorMessage(
          `Error deleting file: ${err.message}`
        );
        setMessages(prev => [...prev, errorMessage]);
      }
    }
  };

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
        <label className={`flex items-center justify-center w-full px-4 py-2 bg-blue-600 
          ${!flowId || isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700 cursor-pointer'} 
          text-white rounded-lg transition-colors`}>
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
          />
        </label>
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
          {files.map((file) => (
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
                    {fileService.formatFileSize(file.file_size)} • {file.file_type.toUpperCase()}
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

export default FileManagement;