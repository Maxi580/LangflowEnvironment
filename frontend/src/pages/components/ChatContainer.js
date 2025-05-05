import React from 'react';
import MessageList from './MessageList';
import ChatInput from './ChatInput';

const ChatContainer = ({
  messages,
  userInput,
  setUserInput,
  handleSend,
  isLoading,
  flowId,
  inputRef,
  messagesEndRef,
  setShowFlowSelector
}) => {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden flex flex-col h-[600px]">
      {/* Messages display */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          messagesEndRef={messagesEndRef}
        />

        {/* Empty state with flow selector prompt */}
        {messages.length === 0 && !flowId && (
          <button
            onClick={() => setShowFlowSelector(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
          >
            Select a Flow to Begin
          </button>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-slate-700 p-4 bg-slate-800">
        <ChatInput
          userInput={userInput}
          setUserInput={setUserInput}
          handleSend={handleSend}
          isLoading={isLoading}
          flowId={flowId}
          inputRef={inputRef}
        />
      </div>
    </div>
  );
};

export default ChatContainer;