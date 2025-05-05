import React, { useState, useRef } from 'react';

const UploadFlowComponent = ({ onUpload, onClose, isUploading, uploadError }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [flowName, setFlowName] = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        setSelectedFile(file);
        // Auto-fill name from file name
        const nameFromFile = file.name.replace('.json', '');
        setFlowName(nameFromFile);
      } else {
        // Let parent component handle this error
        onUpload(null, null, null, 'Please upload a JSON file');
      }
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        setSelectedFile(file);
        // Auto-fill name from file name
        const nameFromFile = file.name.replace('.json', '');
        setFlowName(nameFromFile);
      } else {
        // Let parent component handle this error
        onUpload(null, null, null, 'Please upload a JSON file');
      }
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      onUpload(null, null, null, 'Please select a file');
      return;
    }

    if (!flowName.trim()) {
      onUpload(null, null, null, 'Please enter a flow name');
      return;
    }

    // Just pass the file, name, and description to the parent component
    onUpload(selectedFile, flowName, flowDescription);
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-white">Upload Flow</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center mb-4 transition-colors
          ${isDragging 
            ? 'border-blue-500 bg-blue-500/10' 
            : selectedFile 
              ? 'border-green-500 bg-green-500/10' 
              : 'border-slate-600 hover:border-slate-500'
          }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {selectedFile ? (
          <div className="py-2">
            <div className="flex items-center justify-center mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-white font-medium">{selectedFile.name}</div>
            <div className="text-slate-400 text-sm mt-1">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </div>
            <button
              className="mt-2 text-red-400 hover:text-red-300 text-sm"
              onClick={() => setSelectedFile(null)}
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="py-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-slate-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-white mb-1">Drop your flow JSON file here</p>
            <p className="text-slate-400 text-sm mb-3">or</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
            >
              Select File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".json,application/json"
              onChange={handleFileInputChange}
            />
          </div>
        )}
      </div>

      {/* Flow details form */}
      <div className="space-y-4">
        <div>
          <label htmlFor="flowName" className="block text-sm font-medium text-slate-300 mb-1">
            Flow Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="flowName"
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter flow name"
          />
        </div>

        <div>
          <label htmlFor="flowDescription" className="block text-sm font-medium text-slate-300 mb-1">
            Description
          </label>
          <textarea
            id="flowDescription"
            value={flowDescription}
            onChange={(e) => setFlowDescription(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                      min-h-[80px]"
            placeholder="Enter flow description (optional)"
          />
        </div>
      </div>

      {/* Error message */}
      {uploadError && (
        <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-md text-red-200 text-sm">
          {uploadError}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 flex justify-end space-x-3">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
          >
            Cancel
          </button>
        )}

        <button
          type="button"
          onClick={handleUpload}
          disabled={isUploading || !selectedFile}
          className={`px-4 py-2 rounded-md transition-colors flex items-center
            ${isUploading || !selectedFile
              ? 'bg-blue-700/50 text-blue-300/70 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
        >
          {isUploading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Uploading...
            </>
          ) : (
            'Upload Flow'
          )}
        </button>
      </div>
    </div>
  );
};

export default UploadFlowComponent;