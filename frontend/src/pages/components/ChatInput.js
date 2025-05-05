import React from 'react';

const ChatInput = ({
  userInput,
  setUserInput,
  handleSend,
  isLoading,
  flowId,
  inputRef
}) => {
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

export default ChatInput;