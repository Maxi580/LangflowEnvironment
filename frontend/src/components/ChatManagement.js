import React, { useState, useRef, useEffect } from 'react';
import messageService from '../services/MessageService';

/**
 * ChatManagement component that handles all chat-related functionality
 * including message display, input handling, and API communication
 */
const ChatManagement = ({ selectedFlow, files = [] }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

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
      // Clear session when switching flows
      messageService.clearSession();

      const welcomeMessage = messageService.createSystemMessage(
        `Flow "${selectedFlow.name}" selected. New conversation started!`
      );
      setMessages([welcomeMessage]);
    } else {
      setMessages([]);
    }
  }, [selectedFlow]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    if (!selectedFlow) {
      const errorMessage = messageService.createErrorMessage(
        "Please select a flow first to start chatting."
      );
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    try {
      setIsSending(true);

      // Add user message to chat
      const userMessage = messageService.createUserMessage(inputMessage);
      setMessages(prev => [...prev, userMessage]);

      // Clear input immediately
      const currentMessage = inputMessage;
      setInputMessage('');

      // Send to backend via MessageService
      const botResponse = await messageService.sendMessage(
        currentMessage,
        selectedFlow.id,
        files
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
      // Focus back on input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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

    return (
      <div
        key={message.id}
        className={`flex ${isUser ? 'justify-end' : isSystem || isError ? 'justify-center' : 'justify-start'}`}
      >
        <div
          className={`max-w-3xl rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-blue-600 text-white'
              : isSystem
              ? 'bg-green-700 text-green-100'
              : isError
              ? 'bg-red-700 text-red-100'
              : 'bg-slate-700 text-slate-200'
          }`}
        >
          <div className="whitespace-pre-wrap">{message.text}</div>
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
          ? `Selected flow: "${selectedFlow.name}". Start typing to begin your conversation.`
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
    <div className="max-w-4xl mx-auto bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden">
      {/* Chat Header */}
      <div className="bg-slate-700 px-4 py-3 border-b border-slate-600">
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
      <div className="h-96 overflow-y-auto p-4 space-y-4 bg-slate-900">
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

      {/* Input Area */}
      <div className="border-t border-slate-700 p-4 bg-slate-800">
        <div className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={selectedFlow ? "Type your message..." : "Select a flow first..."}
            className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg
                     text-white placeholder-slate-400 focus:outline-none
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isSending || !selectedFlow}
          />

          <button
            onClick={handleSendMessage}
            disabled={isSending || !inputMessage.trim() || !selectedFlow}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                     disabled:cursor-not-allowed text-white rounded-lg transition-colors
                     flex items-center space-x-2"
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
            <span>Press Enter to send • Shift+Enter for new line</span>
            {files.length > 0 && (
              <span>{files.length} file{files.length > 1 ? 's' : ''} available</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatManagement;