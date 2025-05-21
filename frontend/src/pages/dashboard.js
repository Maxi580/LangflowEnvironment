import React, { useState, useEffect } from 'react';
import config from '../config';
import FlowManagement from './components/FlowManagement';
import ChatManagement from './components/ChatManagement';
import FileManagement from './components/FileManagement';

function Dashboard() {
  const [flowId, setFlowId] = useState(() => {
    // Try to get flowId from localStorage, or use default from config
    return localStorage.getItem('langflow_flowId') || config.defaultFlowId;
  });

  const [messages, setMessages] = useState([]);
  const [showFlowSelector, setShowFlowSelector] = useState(false);
  const [files, setFiles] = useState([]);

  return (
    <div className="flex w-full flex-col md:flex-row gap-6 p-4">
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
          files={files}
        />
      </div>

      {/* Files column */}
      <div className="md:w-80 flex-shrink-0">
        <FileManagement
          flowId={flowId}
          setMessages={setMessages}
        />
      </div>
    </div>
  );
}

export default Dashboard;