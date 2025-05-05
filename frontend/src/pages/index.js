import React, { useState, useRef, useEffect } from 'react';
import config from '../config';
import FlowManagement from './components/FlowManagement';
import ChatManagement from './components/ChatManagement';

function Interface() {
  // State management
  const [flowId, setFlowId] = useState(() => {
    // Try to get flowId from localStorage, or use default from config
    return localStorage.getItem('langflow_flowId') || config.defaultFlowId;
  });

  const [messages, setMessages] = useState([]);
  const [showFlowSelector, setShowFlowSelector] = useState(false);

  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom of chat when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when component loads
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex w-full flex-col md:flex-row gap-6">
      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Flow Management component */}
        <FlowManagement
          flowId={flowId}
          setFlowId={setFlowId}
          setMessages={setMessages}
        />

        {/* Chat Management component */}
        <ChatManagement
          flowId={flowId}
          messages={messages}
          setMessages={setMessages}
          setShowFlowSelector={setShowFlowSelector}
        />
      </div>
    </div>
  );
}

export default Interface;