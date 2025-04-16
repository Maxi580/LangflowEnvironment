import React, { useState, useRef, useEffect } from 'react';
import config from '../config';

function Prompt() {
  const [flowId, setFlowId] = useState(() => {
    // Try to get flowId from localStorage, or use default from config
    return localStorage.getItem('langflow_flowId') || config.defaultFlowId;
  });

  const [userInput, setUserInput] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Save flowId to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('langflow_flowId', flowId);
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
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();

    if (!userInput.trim()) return;

    const messageText = userInput.trim();
    setUserInput('');

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
      // Use the full URL instead of relying on the proxy
      const apiUrl = `http://localhost:7860/api/v1/run/${flowId}`;

      const payload = {
        input_value: messageText,
        output_type: 'chat',
        input_type: 'chat',
        // Optional: Generate a unique session ID for conversation history
        session_id: localStorage.getItem('langflow_session_id') || `session_${Date.now()}`
      };

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      };

      // Debug information
      console.log('API URL:', apiUrl);
      console.log('Payload:', payload);

      // Make API call to LangFlow
      const response = await fetch(apiUrl, options);

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();

      // Extract response based on LangFlow's output format
      let botResponse;
      if (data.result) {
        botResponse = data.result;
      } else if (data.output) {
        botResponse = data.output;
      } else {
        botResponse = JSON.stringify(data);
      }

      // Add bot message to chat
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

  // Save the updated flowId
  const handleSaveFlowId = (e) => {
    e.preventDefault();
    setShowConfig(false);
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto">
      {/* Settings button */}
      <div className="flex justify-end mb-4">
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

      {/* Configuration panel */}
      {showConfig && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-6 shadow-lg">
          <form onSubmit={handleSaveFlowId} className="space-y-4">
            <div>
              <label htmlFor="flowId" className="block text-sm font-medium text-slate-300 mb-1">
                LangFlow Flow ID
              </label>
              <div className="text-xs text-slate-400 mb-2">
                Enter the ID of your LangFlow agent. You can find this in the URL when editing your flow.
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
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md mr-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
              >
                Save
              </button>
            </div>
          </form>
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
            <button
              type="submit"
              disabled={isLoading || !userInput.trim()}
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
  );
}

export default Prompt;