import React, { useState, useEffect, useRef, useCallback } from 'react';
import fileService from '../../../requests/FileRequests';
import messageService from '../../../requests/MessageRequests';
import config from '../../../config';

const FileManagement = ({
  flowId,
  setMessages,
  pollingInterval = config.filePollingInterval
}) => {
  const [completedFiles, setCompletedFiles] = useState([]);
  const [processingFiles, setProcessingFiles] = useState([]);
  const [isFilesLoading, setIsFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);

  /**
   * Fetches both completed and processing files separately
   */
  const fetchFiles = useCallback(async () => {
    if (!flowId) return;

    setIsFilesLoading(true);
    setFilesError(null);

    try {
      const [completed, processing] = await Promise.all([
        fileService.fetchUploadedFiles(flowId),
        fileService.getProcessingFiles(flowId)
      ]);

      setCompletedFiles(completed);
      setProcessingFiles(processing);
    } catch (err) {
      console.error("Failed to fetch files:", err);
      setFilesError(err.message);
    } finally {
      setIsFilesLoading(false);
    }
  }, [flowId]);

  // Fetch files when flowId changes
  useEffect(() => {
    if (flowId) {
      fetchFiles();
    } else {
      setCompletedFiles([]);
      setProcessingFiles([]);
    }
  }, [flowId, fetchFiles]);

  // Auto-refresh when there are actively processing files (not failed) using pollingInterval
  useEffect(() => {
    let intervalId;

    // Only poll if there are processing files that are NOT failed
    const activelyProcessingFiles = processingFiles.filter(file => file.status !== 'failed');

    if (activelyProcessingFiles.length > 0 && flowId) {
      // Start polling using the provided pollingInterval
      intervalId = setInterval(() => {
        fetchFiles();
      }, pollingInterval);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [processingFiles, flowId, pollingInterval, fetchFiles]); // Include pollingInterval in dependencies

  /**
   * Enhanced file display with status indicators
   */
  const getStatusBadge = (fileStatus) => {
    switch (fileStatus) {
      case 'processing':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-900/20 text-orange-400">
            <svg className="animate-spin -ml-1 mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-900/20 text-red-400">
            <svg className="-ml-1 mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            Failed
          </span>
        );
      default:
        return null;
    }
  };

  /**
   * Drag and drop event handlers
   */
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!flowId || isUploading) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!flowId || isUploading) return;
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!flowId || isUploading) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      handleFileUpload({ target: { files: droppedFiles } });
    }
  };

  /**
   * Handles file upload
   */
  const handleFileUpload = async (event) => {
    const filesToUpload = event.target.files;
    if (!filesToUpload.length) return;

    if (!flowId) {
      setFilesError("No Flow ID set. Please select a flow before uploading files.");
      return;
    }

    setIsUploading(true);

    try {
      await fileService.uploadFiles(filesToUpload, flowId);
      fetchFiles(); // Refresh to show processing files

      const fileNames = Array.from(filesToUpload).map(f => f.name).join(', ');
      const message = messageService.createSystemMessage(
        `Files uploaded: ${fileNames} (stored in collection: ${flowId})`
      );
      setMessages && setMessages(prev => [...prev, message]);
    } catch (err) {
      console.error('Error uploading files:', err);
      setFilesError(`Failed to upload files: ${err.message}`);

      if (setMessages) {
        const errorMessage = messageService.createErrorMessage(
          `Error uploading files: ${err.message}`
        );
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /**
   * Handles completed file deletion (for files that are already processed and stored)
   */
  const handleDeleteCompletedFile = async (filePath) => {
    if (!flowId) {
      setFilesError("No Flow ID set. Please select a flow before deleting files.");
      return;
    }

    try {
      await fileService.deleteFile(filePath, flowId);
      fetchFiles();

      if (setMessages) {
        const fileName = filePath.split('/').pop().split('-').slice(1).join('-');
        const message = messageService.createSystemMessage(
          `File deleted: ${fileName} (from collection: ${flowId})`
        );
        setMessages(prev => [...prev, message]);
      }
    } catch (err) {
      console.error('Error deleting completed file:', err);
      setFilesError(`Failed to delete file: ${err.message}`);

      if (setMessages) {
        const errorMessage = messageService.createErrorMessage(
          `Error deleting file: ${err.message}`
        );
        setMessages(prev => [...prev, errorMessage]);
      }
    }
  };

  /**
   * Handles processing file deletion (for files that are currently being processed or failed)
   */
  const handleDeleteProcessingFile = async (fileId, fileName) => {
    if (!flowId) {
      setFilesError("No Flow ID set. Please select a flow before deleting files.");
      return;
    }

    try {
      await fileService.deleteProcessingFile(flowId, fileId);
      fetchFiles(); // Refresh the file list

      if (setMessages) {
        const message = messageService.createSystemMessage(
          `Processing file removed: ${fileName}`
        );
        setMessages(prev => [...prev, message]);
      }
    } catch (err) {
      console.error('Error deleting processing file:', err);
      setFilesError(`Failed to delete processing file: ${err.message}`);

      if (setMessages) {
        const errorMessage = messageService.createErrorMessage(
          `Error deleting processing file: ${err.message}`
        );
        setMessages(prev => [...prev, errorMessage]);
      }
    }
  };

  const getFileIcon = (fileType) => {
    if (fileType === 'pdf') {
      return (
        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    } else if (fileType === 'pptx') {
      return (
        <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    } else if (fileType === 'xlsx') {
      return (
        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2-2V5a2 2 0 012-2h6l2 2v8a2 2 0 01-2 2H9zm3-10v4m3-4v4" />
        </svg>
      );
    } else if (fileType === 'image' || fileType === 'jpg' || fileType === 'jpeg' || fileType === 'png' || fileType === 'gif' || fileType === 'bmp' || fileType === 'tiff' || fileType === 'webp') {
      return (
        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  const totalFiles = completedFiles.length + processingFiles.length;

  // Calculate actively processing files (not failed)
  const activelyProcessingFiles = processingFiles.filter(file => file.status !== 'failed');
  const failedFiles = processingFiles.filter(file => file.status === 'failed');

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-600 rounded-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-medium">File Management</h3>
            <p className="text-slate-400 text-sm">Upload and manage your files</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-slate-400 text-sm">
            {totalFiles} files
            {activelyProcessingFiles.length > 0 && (
              <span className="text-orange-400 ml-1">
                ({activelyProcessingFiles.length} processing)
              </span>
            )}
            {failedFiles.length > 0 && (
              <span className="text-red-400 ml-1">
                ({failedFiles.length} failed)
              </span>
            )}
          </span>

          {/* Polling indicator - show when actively polling */}
          {activelyProcessingFiles.length > 0 && (
            <div className="flex items-center text-xs text-orange-400" title={`Polling every ${pollingInterval / 1000}s`}>
              <svg className="w-3 h-3 mr-1 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              {pollingInterval / 1000}s
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={fetchFiles}
            disabled={isFilesLoading || !flowId}
            className={`p-1 rounded transition-colors ${
              isFilesLoading || !flowId
                ? 'cursor-not-allowed text-slate-600'
                : 'hover:bg-slate-600 text-slate-400 hover:text-slate-300'
            }`}
            title="Refresh file list"
          >
            <svg
              className={`w-4 h-4 ${isFilesLoading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-slate-600 rounded transition-colors"
          >
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Upload Section */}
        <div>
          <div
            className={`flex items-center justify-center w-full px-3 py-2 text-sm border-2 border-dashed rounded-lg transition-colors cursor-pointer
              ${!flowId || isUploading
                ? 'border-slate-600 text-slate-500 cursor-not-allowed'
                : isDragging
                  ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                  : 'border-slate-500 text-slate-300 hover:border-blue-500 hover:text-blue-400'
              }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => !isUploading && flowId && fileInputRef.current?.click()}
          >
            {isUploading ? (
              <>
                <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading...
              </>
            ) : isDragging ? (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Drop files here to upload
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Drop files or click to upload
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              accept=".pdf,.txt,.md,.py,.js,.html,.css,.json,.xml,.csv,.pptx,.xlsx,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.webp"
              className="sr-only"
              disabled={isUploading || !flowId}
            />
          </div>
        </div>

        {/* Loading State */}
        {isFilesLoading && (
          <div className="flex items-center justify-center py-4 text-slate-400 text-sm">
            <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading files...
          </div>
        )}

        {/* Error State */}
        {filesError && (
          <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg">
            <div className="text-red-400 text-sm">{filesError}</div>
            <button
              onClick={fetchFiles}
              className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Files List */}
        {!isFilesLoading && !filesError && totalFiles > 0 && (
          <div className="space-y-2">
            {/* Completed Files Section - Using handleDeleteCompletedFile */}
            {completedFiles.length > 0 && (
              <div className="space-y-2">
                {(isExpanded ? completedFiles : completedFiles.slice(0, 3)).map((file) => (
                  <div
                    key={file.file_id}
                    className="flex items-center justify-between p-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors group"
                  >
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        {getFileIcon(file.file_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{file.file_name}</div>
                        <div className="text-xs text-slate-400">
                          {fileService.formatFileSize(file.file_size)} • {file.file_type.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteCompletedFile(file.file_path)}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-600 rounded transition-all"
                      title="Delete file"
                    >
                      <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}

                {/* Show more indicator for completed files */}
                {!isExpanded && completedFiles.length > 3 && (
                  <button
                    onClick={() => setIsExpanded(true)}
                    className="w-full text-center py-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    +{completedFiles.length - 3} more files
                  </button>
                )}
              </div>
            )}

            {/* Processing Files Section - Using handleDeleteProcessingFile */}
            {processingFiles.length > 0 && (
              <div className="space-y-2">
                {completedFiles.length > 0 && <div className="mt-4"></div>}

                {/* Actively Processing Files */}
                {activelyProcessingFiles.length > 0 && (
                  <>
                    <div className="text-xs text-orange-400 font-medium uppercase tracking-wide">
                      Processing ({activelyProcessingFiles.length})
                    </div>
                    {activelyProcessingFiles.map((file) => (
                      <div
                        key={file.file_id}
                        className="flex items-center justify-between p-2 bg-orange-900/20 border border-orange-700/50 rounded-lg transition-colors group"
                      >
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <div className="flex-shrink-0">
                            {getFileIcon(file.file_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <div className="text-sm text-white truncate">{file.file_name}</div>
                              {getStatusBadge(file.status)}
                            </div>
                            <div className="text-xs text-slate-400">
                              {fileService.formatFileSize(file.file_size)}
                            </div>
                          </div>
                        </div>

                        {/* Allow cancellation of actively processing files */}
                        <button
                          onClick={() => handleDeleteProcessingFile(file.file_id, file.file_name)}
                          className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-600 rounded transition-all"
                          title="Cancel processing"
                        >
                          <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </>
                )}

                {/* Failed Files */}
                {failedFiles.length > 0 && (
                  <>
                    {activelyProcessingFiles.length > 0 && <div className="mt-2"></div>}
                    <div className="text-xs text-red-400 font-medium uppercase tracking-wide">
                      Failed ({failedFiles.length})
                    </div>
                    {failedFiles.map((file) => (
                      <div
                        key={file.file_id}
                        className="flex items-center justify-between p-2 bg-red-900/20 border border-red-700/50 rounded-lg transition-colors group"
                      >
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <div className="flex-shrink-0">
                            {getFileIcon(file.file_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <div className="text-sm text-white truncate">{file.file_name}</div>
                              {getStatusBadge(file.status)}
                            </div>
                            <div className="text-xs text-slate-400">
                              {fileService.formatFileSize(file.file_size)}
                              {file.error && (
                                <span className="text-red-400 ml-2">• {file.error}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteProcessingFile(file.file_id, file.file_name)}
                          className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-600 rounded transition-all"
                          title="Remove failed file"
                        >
                          <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* No Files State */}
        {!isFilesLoading && !filesError && totalFiles === 0 && (
          <div className="text-center py-6">
            <svg className="w-8 h-8 mx-auto mb-2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-slate-400 text-sm">No files uploaded</p>
            <p className="text-slate-500 text-xs mt-1">Drag & drop files or click to upload</p>
          </div>
        )}

        {/* Collection Info */}
        {isExpanded && flowId && (
          <div className="pt-3 border-t border-slate-700">
            <div className="text-xs text-slate-400 mb-2">Collection ID:</div>
            <div className="bg-slate-700 text-xs text-slate-300 px-2 py-1 rounded font-mono truncate">
              {flowId}
            </div>
            {pollingInterval && (
              <div className="mt-2">
                <div className="text-xs text-slate-400 mb-1">Polling Interval:</div>
                <div className="bg-slate-700 text-xs text-slate-300 px-2 py-1 rounded">
                  {pollingInterval / 1000} seconds
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileManagement;