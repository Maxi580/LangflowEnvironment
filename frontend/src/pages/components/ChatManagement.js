import React, { useRef, useEffect } from 'react';
import messageService from '../services/MessageService';

/**
 * ChatManagement component that handles all chat-related functionality
 * including message display, input handling, and API communication
 */
const ChatManagement = ({
  flowId,
  messages,
  setMessages,
  setShowFlowSelector,
  files = []
}) => {
  // State for user input
  const [userInput, setUserInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  // Refs
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Focus input when component loads or flowId changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [flowId]);

  // Scroll to bottom of chat when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Sends a message to the LangFlow API
   * @param {Event} e - Form submission event
   */
  const handleSend = async (e) => {
    e.preventDefault();

    // Allow sending if there's text input
    if (!userInput.trim()) return;

    if (!flowId) {
      // Add error message
      const errorMessage = messageService.createErrorMessage(
        "No Flow ID set. Please select a flow first."
      );
      setMessages(prev => [...prev, errorMessage]);

      // Show flow selector
      if (setShowFlowSelector) {
        setShowFlowSelector(true);
      }
      return;
    }

    const messageText = userInput.trim();
    setUserInput('');

    // Add user message to chat
    const userMessage = messageService.createUserMessage(messageText);
    setMessages(prev => [...prev, userMessage]);

    setIsLoading(true);

    try {
      // Send message to LangFlow
      const botMessage = await messageService.sendMessage(messageText, flowId, files);
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      console.error('Error calling LangFlow API:', err);

      // Add error message to chat
      const errorMessage = messageService.createErrorMessage(
        `Error: ${err.message}. Please check your Flow ID and ensure LangFlow is running.`
      );
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // Focus back on input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  /**
   * Renders the message list component
   */
  const renderMessageList = () => {
    if (messages.length === 0) {
      // Empty state
      return (
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

          {/* Flow selector button (only show if no flowId) */}
          {!flowId && setShowFlowSelector && (
            <button
              onClick={() => setShowFlowSelector(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
            >
              Select a Flow to Begin
            </button>
          )}
        </div>
      );
    }

    // Message list
    return (
      <>
        {messages.map((message) => (
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
        ))}

        {/* Loading indicator */}
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

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </>
    );
  };

  /**
   * Renders the chat input component
   */
  const renderChatInput = () => {
    return (
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
    );
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden flex flex-col h-[600px]">
      {/* Messages display */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {renderMessageList()}
      </div>

      {/* Input area */}
      <div className="border-t border-slate-700 p-4 bg-slate-800">
        {renderChatInput()}
      </div>
    </div>
  );
};

export default ChatManagement;