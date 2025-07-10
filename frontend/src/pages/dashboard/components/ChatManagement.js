import React, { useState, useRef, useEffect } from 'react';
import messageService from '../../../requests/MessageRequests';

const ChatManagement = ({ selectedFlow, files = [], messages, setMessages }) => {
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Focus input when component loads or flow changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [selectedFlow]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add welcome message when flow is selected
  useEffect(() => {
    if (selectedFlow) {
      messageService.clearSession();
      const welcomeMessage = messageService.createSystemMessage(
        `Flow "${selectedFlow.name}" selected. New conversation started!`
      );
      setMessages([welcomeMessage]);
    } else {
      setMessages([]);
    }
  }, [selectedFlow, setMessages]);

  const handleFileSelect = (event) => {
    const selectedFiles = Array.from(event.target.files);
    addFilesToAttachment(selectedFiles);
    // Clear the input so the same file can be selected again
    event.target.value = '';
  };

  const addFilesToAttachment = (newFiles) => {
    const validFiles = newFiles.filter(file => {
      // File size limit (25MB)
      if (file.size > 25 * 1024 * 1024) {
        const errorMessage = messageService.createErrorMessage(
          `File "${file.name}" is too large. Maximum size is 25MB.`
        );
        setMessages(prev => [...prev, errorMessage]);
        return false;
      }

      // Check for duplicates
      const isDuplicate = attachedFiles.some(existing =>
        existing.name === file.name && existing.size === file.size
      );
      if (isDuplicate) {
        const errorMessage = messageService.createErrorMessage(
          `File "${file.name}" is already attached.`
        );
        setMessages(prev => [...prev, errorMessage]);
        return false;
      }

      return true;
    });

    if (validFiles.length > 0) {
      setAttachedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeAttachedFile = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllAttachments = () => {
    setAttachedFiles([]);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    // Only set dragging to false if we're leaving the chat container entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      addFilesToAttachment(droppedFiles);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file) => {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();

    if (type.startsWith('image/')) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    } else if (type.includes('pdf') || name.endsWith('.pdf')) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    } else if (type.includes('text') || name.endsWith('.txt')) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    }

    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.586-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
    );
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() && attachedFiles.length === 0) return;

    if (!selectedFlow) {
      const errorMessage = messageService.createErrorMessage(
        "Please select a flow first to start chatting."
      );
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    try {
      setIsSending(true);

      // Create user message with file info
      const userMessageText = inputMessage.trim() || "(Files attached)";
      const userMessage = messageService.createUserMessage(userMessageText, {
        attachedFiles: attachedFiles.map(f => ({ name: f.name, size: f.size, type: f.type }))
      });
      setMessages(prev => [...prev, userMessage]);

      // Clear input and attachments immediately
      const currentMessage = inputMessage;
      const currentFiles = [...attachedFiles];
      setInputMessage('');
      setAttachedFiles([]);

      // Send to backend via MessageService with files
      const botResponse = await messageService.sendMessageWithFiles(
        currentMessage,
        selectedFlow.id,
        files,
        currentFiles
      );

      // Add bot response to chat
      setMessages(prev => [...prev, botResponse]);

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = messageService.createErrorMessage(
        `Failed to send message: ${error.message}`
      );
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        return;
      } else {
        e.preventDefault();
        handleSendMessage();
      }
    }
  };

  const clearChat = () => {
    if (selectedFlow) {
      messageService.clearSession();
      const welcomeMessage = messageService.createSystemMessage(
        `Chat cleared. New conversation started with "${selectedFlow.name}".`
      );
      setMessages([welcomeMessage]);
    } else {
      setMessages([]);
    }
    setAttachedFiles([]);
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderMessage = (message) => {
    const isUser = message.sender === 'user';
    const isSystem = message.sender === 'system';
    const isError = message.sender === 'error';
    const hasAttachments = message.metadata?.attachedFiles?.length > 0;
    const hasGeneratedFiles = message.metadata?.generatedFiles?.length > 0;

    const createDownloadUrl = (generatedFile) => {
      try {
        const byteCharacters = atob(generatedFile.base64_data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: generatedFile.content_type });
        return URL.createObjectURL(blob);
      } catch (error) {
        console.error('Error creating download URL:', error);
        return null;
      }
    };

    const handleDownload = (generatedFile) => {
      const downloadUrl = createDownloadUrl(generatedFile);
      if (downloadUrl) {
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = generatedFile.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      }
    };

    const getFileTypeIcon = (filename, contentType) => {
      const ext = filename.split('.').pop()?.toLowerCase();

      if (contentType?.includes('presentation') || ext === 'pptx') {
        return (
          <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      } else if (contentType?.includes('pdf') || ext === 'pdf') {
        return (
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      } else if (contentType?.includes('spreadsheet') || ext === 'xlsx') {
        return (
          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17V7m0 10a2 2 0 01-2-2V5a2 2 0 012-2h6l2 2v8a2 2 0 01-2 2H9zm3-10v4m3-4v4" />
          </svg>
        );
      } else if (contentType?.includes('image/')) {
        return (
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      }

      return (
        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    };

    return (
      <div
        key={message.id}
        className={`flex ${isUser ? 'justify-end' : isSystem || isError ? 'justify-center' : 'justify-start'}`}
      >
        <div
          className={`max-w-3xl rounded-2xl px-4 py-3 break-words ${
            isUser
              ? 'bg-blue-600 text-white'
              : isSystem
              ? 'bg-green-700 text-green-100'
              : isError
              ? 'bg-red-700 text-red-100'
              : 'bg-slate-700 text-slate-200'
          }`}
        >
          <div
            className="whitespace-pre-wrap break-words overflow-wrap-anywhere"
            style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
          >
            {message.text}
          </div>

          {/* User attached files */}
          {hasAttachments && (
            <div className="mt-2 pt-2 border-t border-blue-500 opacity-75">
              <div className="text-xs mb-1">📎 Attached files:</div>
              {message.metadata.attachedFiles.map((file, idx) => (
                <div key={idx} className="text-xs flex items-center space-x-1">
                  {getFileIcon(file)}
                  <span>{file.name} ({formatFileSize(file.size)})</span>
                </div>
              ))}
            </div>
          )}

          {/* Generated files from bot */}
          {hasGeneratedFiles && (
          <div className="mt-3 pt-2 border-t border-slate-500">
            <div className="text-xs mb-2 text-slate-300">
              📄 Generated file{message.metadata.generatedFiles.length > 1 ? 's' : ''}:
            </div>
            {message.metadata.generatedFiles.map((generatedFile, index) => (
              <div key={index} className="bg-slate-600 rounded-lg p-3 hover:bg-slate-550 transition-colors mb-2 last:mb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getFileTypeIcon(generatedFile.filename, generatedFile.content_type)}
                    <div>
                      <div className="text-sm font-medium text-white">
                        {generatedFile.filename}
                      </div>
                      <div className="text-xs text-slate-400">
                        {formatFileSize(generatedFile.size)} • {generatedFile.content_type.split('/').pop().toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownload(generatedFile)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs
                             transition-colors flex items-center space-x-1"
                    title="Download file"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Download</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

          <div className={`text-xs mt-1 opacity-70 ${isUser ? 'text-right' : 'text-left'}`}>
            {formatTimestamp(message.timestamp)}
          </div>
        </div>
      </div>
    );
  };

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-r from-purple-500 to-blue-600 flex items-center justify-center">
        <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-white mb-2">Ready to Chat</h3>
      <p className="text-slate-400 max-w-md mb-4">
        {selectedFlow
          ? `Selected flow: "${selectedFlow.name}". Start typing or drag files to begin your conversation.`
          : 'Please select a flow from the dropdown above to start chatting with your AI agent.'
        }
      </p>
    </div>
  );

  const renderLoadingIndicator = () => (
    <div className="flex justify-start">
      <div className="bg-slate-700 text-slate-200 rounded-2xl px-4 py-3">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"></div>
            <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          </div>
          <span className="text-sm">Thinking...</span>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`w-full h-full bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden flex flex-col relative ${
        isDragging ? 'border-blue-500 border-2' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-600 bg-opacity-20 z-10 flex items-center justify-center">
          <div className="bg-slate-800 rounded-lg p-6 border-2 border-dashed border-blue-400">
            <div className="text-center">
              <svg className="w-12 h-12 text-blue-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-blue-400 font-medium">Drop files here to attach</p>
              <p className="text-slate-400 text-sm">Max 10MB per file</p>
            </div>
          </div>
        </div>
      )}

      {/* Chat Header */}
      <div className="bg-slate-700 px-4 py-3 border-b border-slate-600 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-medium">Chat Interface</h3>
              <p className="text-slate-400 text-sm">
                {selectedFlow ? `Using: ${selectedFlow.name}` : 'No flow selected'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded transition-colors text-sm"
                title="Clear chat"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <div className="text-slate-400 text-sm">
              {messages.length} messages
            </div>
          </div>
        </div>
      </div>

      {/* Messages Display */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900 min-h-0">
        {messages.length === 0 ? (
          renderEmptyState()
        ) : (
          <>
            {messages.map(renderMessage)}
            {isSending && renderLoadingIndicator()}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Attached Files Preview */}
      {attachedFiles.length > 0 && (
        <div className="px-4 py-2 bg-slate-750 border-t border-slate-600">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-300">
              {attachedFiles.length} file{attachedFiles.length > 1 ? 's' : ''} attached
            </span>
            <button
              onClick={clearAllAttachments}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
            {attachedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 bg-slate-600 rounded px-2 py-1 text-sm"
              >
                {getFileIcon(file)}
                <span className="text-slate-200 truncate max-w-32">{file.name}</span>
                <span className="text-slate-400 text-xs">({formatFileSize(file.size)})</span>
                <button
                  onClick={() => removeAttachedFile(index)}
                  className="text-red-400 hover:text-red-300 ml-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-slate-700 p-4 bg-slate-800 flex-shrink-0">
        <div className="flex space-x-2">
          {/* File upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending || !selectedFlow}
            className="px-3 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-50
                     disabled:cursor-not-allowed text-slate-200 rounded-lg transition-colors
                     self-end"
            title="Attach files"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.586-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={selectedFlow ? "Type your message or attach files... (Shift+Enter for new line)" : "Select a flow first..."}
            className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg
                     text-white placeholder-slate-400 focus:outline-none
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     resize-none min-h-[40px] max-h-32 overflow-y-auto"
            disabled={isSending || !selectedFlow}
            rows={1}
            style={{
              height: 'auto',
              minHeight: '40px'
            }}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
            }}
          />

          <button
            onClick={handleSendMessage}
            disabled={isSending || (!inputMessage.trim() && attachedFiles.length === 0) || !selectedFlow}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                     disabled:cursor-not-allowed text-white rounded-lg transition-colors
                     flex items-center space-x-2 self-end"
          >
            {isSending ? (
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
            <span className="hidden sm:inline">
              {isSending ? 'Sending...' : 'Send'}
            </span>
          </button>
        </div>

        {/* Info Bar */}
        {selectedFlow && (
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
            <span>Enter to send • Shift+Enter for new line • Drag & drop files</span>
            <div className="flex items-center space-x-4">
              {files.length > 0 && (
                <span>{files.length} collection file{files.length > 1 ? 's' : ''}</span>
              )}
              {attachedFiles.length > 0 && (
                <span className="text-blue-400">{attachedFiles.length} attached</span>
              )}
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".txt,.pdf,.docx,.xlsx,.pptx,.md,.json,.csv,.py,.js,.html,.css,.xml,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.webp"
        />
      </div>
    </div>
  );
};

export default ChatManagement;