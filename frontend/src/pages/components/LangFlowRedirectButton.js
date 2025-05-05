import React from 'react';
import config from '../../config';

const LangFlowRedirectButton = () => {
  // Construct the LangFlow flows URL from the config
  const langFlowUrl = `${config.api.baseUrl}/flows`;

  // Handle redirect to LangFlow
  const handleRedirect = () => {
    window.open(langFlowUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      onClick={handleRedirect}
      className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700
                 text-white rounded-lg text-sm transition-colors"
      title="Open LangFlow UI"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
      </svg>
      Open LangFlow
    </button>
  );
};

export default LangFlowRedirectButton;