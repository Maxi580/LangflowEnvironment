import React from 'react';

const MessageList = ({ messages, isLoading, messagesEndRef }) => {
  if (messages.length === 0) {
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
      </div>
    );
  }

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
    </>
  );
};

export default MessageList;