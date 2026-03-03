import React, { useState, useRef, useEffect } from 'react';
import messageService from '../../../requests/MessageRequests';

const ChatManagement = ({ selectedFlow, files = [], messages, setMessages, outputSettings = {} }) => {
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [selectedFlow]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    event.target.value = '';
  };

  const addFilesToAttachment = (newFiles) => {
    const validFiles = newFiles.filter(file => {
      if (file.size > 25 * 1024 * 1024) {
        const errorMessage = messageService.createErrorMessage(
          `File "${file.name}" is too large. Maximum size is 25MB.`
        );
        setMessages(prev => [...prev, errorMessage]);
        return false;
      }
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

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
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
    }
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.586-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
    );
  };

  const buildSettingsPrefix = () => {
    const parts = [];
    const langs = outputSettings.languages || [];
    if (langs.length > 0) {
      parts.push(`The user wants the text to be written in ${langs.join(', ')}.`);
    } else {
      parts.push('The user wants the text to be written in the language that the documents are made of.');
    }
    const length = outputSettings.textLength;
    if (length) {
      parts.push(`The user wants the text to be approximately ${length} words long.`);
    } else {
      parts.push('The user has not specified a desired text length. Use a reasonable default.');
    }
    const pptx = outputSettings.createPptx ?? true;
    parts.push(`{create_pptx: ${pptx}}`);
    return `[Output Settings]\n${parts.join('\n')}\n[End of Output Settings]\n\n`;
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() && attachedFiles.length === 0) return;
    if (!selectedFlow) {
      const errorMessage = messageService.createErrorMessage("Please select a flow first to start chatting.");
      setMessages(prev => [...prev, errorMessage]);
      return;
    }
    try {
      setIsSending(true);
      const userMessageText = inputMessage.trim() || "(Files attached)";
      const userMessage = messageService.createUserMessage(userMessageText, {
        attachedFiles: attachedFiles.map(f => ({ name: f.name, size: f.size, type: f.type }))
      });
      setMessages(prev => [...prev, userMessage]);
      const currentMessage = inputMessage;
      const currentFiles = [...attachedFiles];
      setInputMessage('');
      setAttachedFiles([]);
      const prefixedMessage = buildSettingsPrefix() + currentMessage;
      const botResponse = await messageService.sendMessageWithFiles(
        prefixedMessage, selectedFlow.id, files, currentFiles
      );
      setMessages(prev => [...prev, botResponse]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = messageService.createErrorMessage(`Failed to send message: ${error.message}`);
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) return;
      e.preventDefault();
      handleSendMessage();
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
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
          <svg className="w-5 h-5" style={{color:'#6B3FA0'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      } else if (contentType?.includes('pdf') || ext === 'pdf') {
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      }
      return (
        <svg className="w-5 h-5" style={{color:'#0073E6'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    };

    if (isSystem) {
      return (
        <div key={message.id} className="flex justify-center">
          <div className="px-4 py-1.5 rounded-full text-xs font-medium"
               style={{background:'rgba(0,115,230,0.08)', color:'#0073E6', border:'1px solid rgba(0,115,230,0.2)'}}>
            {message.text}
          </div>
        </div>
      );
    }

    if (isError) {
      return (
        <div key={message.id} className="flex justify-center">
          <div className="px-4 py-2 rounded-lg text-sm"
               style={{background:'rgba(220,38,38,0.06)', color:'#dc2626', border:'1px solid rgba(220,38,38,0.18)'}}>
            {message.text}
          </div>
        </div>
      );
    }

    return (
      <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-2`}>
        {/* Bot avatar */}
        {!isUser && (
          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mb-1"
               style={{background:'#0073E6'}}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
            </svg>
          </div>
        )}

        <div className="max-w-xl">
          <div
            className="rounded-2xl px-4 py-3 break-words"
            style={isUser
              ? {background:'#0073E6', color:'#ffffff', boxShadow:'0 2px 8px rgba(0,115,230,0.25)'}
              : {background:'#ffffff', color:'#1e293b', border:'1px solid #e2e8f0', boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}
            }
          >
            <div className="whitespace-pre-wrap break-words text-sm leading-relaxed"
                 style={{wordBreak:'break-word', overflowWrap:'anywhere'}}>
              {message.text}
            </div>

            {hasAttachments && (
              <div className="mt-2 pt-2 border-t"
                   style={{borderColor: isUser ? 'rgba(255,255,255,0.25)' : '#e2e8f0'}}>
                <div className="text-xs mb-1 opacity-75">📎 Attached files:</div>
                {message.metadata.attachedFiles.map((file, idx) => (
                  <div key={idx} className="text-xs flex items-center gap-1 opacity-80">
                    {getFileIcon(file)}
                    <span>{file.name} ({formatFileSize(file.size)})</span>
                  </div>
                ))}
              </div>
            )}

            {hasGeneratedFiles && (
              <div className="mt-3 pt-2 border-t" style={{borderColor:'#e2e8f0'}}>
                <div className="text-xs mb-2" style={{color:'#64748b'}}>
                  📄 Generated file{message.metadata.generatedFiles.length > 1 ? 's' : ''}:
                </div>
                {message.metadata.generatedFiles.map((generatedFile, index) => (
                  <div key={index} className="rounded-xl p-3 mb-2 last:mb-0"
                       style={{background:'rgba(0,115,230,0.05)', border:'1px solid rgba(0,115,230,0.15)'}}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {getFileTypeIcon(generatedFile.filename, generatedFile.content_type)}
                        <div>
                          <div className="text-sm font-medium" style={{color:'#1e293b'}}>{generatedFile.filename}</div>
                          <div className="text-xs" style={{color:'#64748b'}}>
                            {formatFileSize(generatedFile.size)} • {generatedFile.content_type.split('/').pop().toUpperCase()}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownload(generatedFile)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
                        style={{background:'#0073E6', color:'white'}}
                        onMouseEnter={e => e.currentTarget.style.background='#00005C'}
                        onMouseLeave={e => e.currentTarget.style.background='#0073E6'}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`text-xs mt-1 px-1 ${isUser ? 'text-right' : 'text-left'}`}
               style={{color:'#94a3b8'}}>
            {formatTimestamp(message.timestamp)}
          </div>
        </div>

        {/* User avatar */}
        {isUser && (
          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mb-6"
               style={{background:'#00005C'}}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
      </div>
    );
  };

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      {/* Blue accent bar at top of empty state */}
      <div className="w-14 h-14 mb-4 rounded-2xl flex items-center justify-center"
           style={{background:'#0073E6'}}>
        <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <h3 className="text-base font-semibold mb-2" style={{color:'#0073E6'}}>Ready to Chat</h3>
      <p className="text-sm max-w-xs leading-relaxed" style={{color:'#64748b'}}>
        {selectedFlow
          ? `Flow "${selectedFlow.name}" is active. Start typing or drag files to begin.`
          : 'Select a flow from the dropdown above to start chatting with your AI agent.'
        }
      </p>
    </div>
  );

  const renderLoadingIndicator = () => (
    <div className="flex items-end gap-2">
      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
           style={{background:'#0073E6'}}>
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
        </svg>
      </div>
      <div className="rounded-2xl px-4 py-3"
           style={{background:'#ffffff', border:'1px solid #e2e8f0', boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[0, 0.2, 0.4].map((delay, i) => (
              <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                   style={{background:'#0073E6', animationDelay:`${delay}s`}}></div>
            ))}
          </div>
          <span className="text-sm" style={{color:'#64748b'}}>Thinking…</span>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`w-full h-full flex flex-col overflow-hidden rounded-xl transition-all`}
      style={{
        background:'#ffffff',
        border: isDragging ? '2px solid #0073E6' : '1px solid #e2e8f0',
        boxShadow:'0 2px 12px rgba(0,0,92,0.08)',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl"
             style={{background:'rgba(0,115,230,0.06)'}}>
          <div className="rounded-2xl p-8 text-center"
               style={{background:'white', border:'2px dashed #0073E6', boxShadow:'0 8px 32px rgba(0,115,230,0.12)'}}>
            <svg className="w-10 h-10 mx-auto mb-3" style={{color:'#0073E6'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="font-semibold" style={{color:'#0073E6'}}>Drop files to attach</p>
            <p className="text-sm mt-1" style={{color:'#64748b'}}>Max 25MB per file</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-3 flex-shrink-0 flex items-center justify-between"
           style={{background:'#0073E6', borderRadius:'0.75rem 0.75rem 0 0'}}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
               style={{background:'rgba(0,0,92,0.25)'}}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-sm text-white">Chat Interface</h3>
            <p className="text-xs" style={{color:'rgba(255,255,255,0.55)'}}>
              {selectedFlow ? `Using: ${selectedFlow.name}` : 'No flow selected'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs" style={{color:'rgba(255,255,255,0.45)'}}>{messages.length} messages</span>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
              style={{color:'rgba(255,255,255,0.55)', background:'transparent'}}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='white'; }}
              onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(255,255,255,0.55)'; }}
              title="Clear chat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>


      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
           style={{background:'#f7f9fc'}}>
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

      {/* Attached files preview */}
      {attachedFiles.length > 0 && (
        <div className="px-4 py-2 flex-shrink-0"
             style={{background:'white', borderTop:'1px solid #e2e8f0'}}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium" style={{color:'#475569'}}>
              {attachedFiles.length} file{attachedFiles.length > 1 ? 's' : ''} attached
            </span>
            <button onClick={clearAllAttachments} className="text-xs transition-colors"
                    style={{color:'#ef4444'}}
                    onMouseEnter={e => e.currentTarget.style.color='#dc2626'}
                    onMouseLeave={e => e.currentTarget.style.color='#ef4444'}>
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
            {attachedFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm"
                   style={{background:'rgba(0,115,230,0.07)', border:'1px solid rgba(0,115,230,0.2)', color:'#0073E6'}}>
                {getFileIcon(file)}
                <span className="truncate max-w-28 text-xs font-medium">{file.name}</span>
                <span className="text-xs opacity-60">({formatFileSize(file.size)})</span>
                <button onClick={() => removeAttachedFile(index)}
                        className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 flex-shrink-0"
           style={{background:'white', borderTop:'1px solid #e2e8f0'}}>
        <div className="flex gap-2 items-end">
          {/* Attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending || !selectedFlow}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{background:'rgba(0,115,230,0.07)', color:'#0073E6', border:'1px solid rgba(0,115,230,0.2)'}}
            onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background='rgba(0,115,230,0.14)')}
            onMouseLeave={e => e.currentTarget.style.background='rgba(0,115,230,0.07)'}
            title="Attach files"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.586-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={selectedFlow ? "Type your message… (Shift+Enter for new line)" : "Select a flow first…"}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm resize-none transition-all"
            style={{
              background:'#f7f9fc',
              border:'1px solid #e2e8f0',
              color:'#1e293b',
              minHeight:'40px',
              maxHeight:'128px',
              outline:'none',
            }}
            disabled={isSending || !selectedFlow}
            rows={1}
            onFocus={e => { e.target.style.borderColor='#0073E6'; e.target.style.boxShadow='0 0 0 3px rgba(0,115,230,0.1)'; }}
            onBlur={e => { e.target.style.borderColor='#e2e8f0'; e.target.style.boxShadow='none'; }}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
            }}
          />

          {/* Send button */}
          <button
            onClick={handleSendMessage}
            disabled={isSending || (!inputMessage.trim() && attachedFiles.length === 0) || !selectedFlow}
            className="h-9 px-4 rounded-xl text-white text-sm font-medium flex items-center gap-2 flex-shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{background:'#0073E6'}}
            onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background='#00005C')}
            onMouseLeave={e => e.currentTarget.style.background='#0073E6'}
          >
            {isSending ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
            <span className="hidden sm:inline">{isSending ? 'Sending…' : 'Send'}</span>
          </button>
        </div>

        {selectedFlow && (
          <div className="mt-2 flex items-center justify-between text-xs" style={{color:'#94a3b8'}}>
            <span>Enter to send · Shift+Enter for new line · Drag & drop files</span>
            <div className="flex items-center gap-3">
              {files.length > 0 && <span>{files.length} collection file{files.length > 1 ? 's' : ''}</span>}
              {attachedFiles.length > 0 && <span style={{color:'#0073E6'}}>{attachedFiles.length} attached</span>}
            </div>
          </div>
        )}

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