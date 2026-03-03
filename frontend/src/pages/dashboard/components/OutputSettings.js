import React, { useState } from 'react';

const LANGUAGE_SUGGESTIONS = [
  'Deutsch',
  'English',
  'Français',
  'Español',
  'Hindi',
  'Bengali',
  'Tamil',
  'Italiano',
  'Português',
  'Nederlands',
  'Polski',
  '日本語',
  '中文',
  'Korean',
  'Arabic',
  'Russian',
  'Turkish',
];

const OutputSettings = ({ onSettingsChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [languages, setLanguages] = useState([]);
  const [languageInput, setLanguageInput] = useState('');
  const [textLength, setTextLength] = useState(null);
  const [createPptx, setCreatePptx] = useState(true);

  const TEXT_LENGTH_MIN = 100;
  const TEXT_LENGTH_MAX = 5000;
  const TEXT_LENGTH_STEP = 100;

  const notifyChange = (updates) => {
    const newSettings = {
      languages: updates.languages ?? languages,
      textLength: updates.textLength ?? textLength,
      createPptx: updates.createPptx ?? createPptx,
    };
    onSettingsChange && onSettingsChange(newSettings);
  };

  const handleAddLanguage = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (languages.some(l => l.toLowerCase() === trimmed.toLowerCase())) return;
    const updated = [...languages, trimmed];
    setLanguages(updated);
    setLanguageInput('');
    notifyChange({ languages: updated });
  };

  const handleRemoveLanguage = (index) => {
    const updated = languages.filter((_, i) => i !== index);
    setLanguages(updated);
    notifyChange({ languages: updated });
  };

  const handleLanguageKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddLanguage(languageInput);
    }
    if (e.key === 'Backspace' && languageInput === '' && languages.length > 0) {
      handleRemoveLanguage(languages.length - 1);
    }
  };

  const handleTextLengthSlider = (e) => {
    const val = parseInt(e.target.value, 10);
    setTextLength(val);
    notifyChange({ textLength: val });
  };

  const handleTextLengthInput = (e) => {
    const raw = e.target.value;
    if (raw === '') {
      setTextLength(null);
      notifyChange({ textLength: null });
      return;
    }
    let val = parseInt(raw, 10);
    if (isNaN(val)) return;
    val = Math.max(1, val);
    setTextLength(val);
    notifyChange({ textLength: val });
  };

  const handleCreatePptxChange = (e) => {
    const val = e.target.checked;
    setCreatePptx(val);
    notifyChange({ createPptx: val });
  };

  return (
    <div className="bg-[#000847] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#002090] flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[#3DC7FF] rounded-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-medium">Output Settings</h3>
            <p className="text-gray-400 text-sm">Configure response preferences</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-[#001a8a] rounded transition-colors"
          >
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content — only visible when expanded */}
      {isExpanded && (
        <div className="p-4 space-y-5">

          {/* ── Language Selection ── */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                <span>Output Language</span>
              </div>
            </label>
            <div className="w-full bg-[#001070] border border-[#002090] rounded-lg
                           px-3 py-2 focus-within:ring-2 focus-within:ring-[#3DC7FF] focus-within:border-transparent
                           transition-colors hover:border-[#003399]">
              {/* Language tags */}
              <div className="flex flex-wrap gap-1.5">
                {languages.map((lang, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-0.5 rounded bg-[#3DC7FF]/30 text-[#3DC7FF] text-sm"
                  >
                    {lang}
                    <button
                      onClick={() => handleRemoveLanguage(index)}
                      className="ml-1.5 text-[#3DC7FF] hover:text-white transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  list="language-suggestions"
                  value={languageInput}
                  onChange={(e) => setLanguageInput(e.target.value)}
                  onKeyDown={handleLanguageKeyDown}
                  onBlur={() => handleAddLanguage(languageInput)}
                  placeholder={languages.length === 0 ? "Auto (same as input)" : "Add another..."}
                  className="flex-1 min-w-[100px] bg-transparent text-white text-sm outline-none placeholder-gray-500 py-0.5"
                />
              </div>
              <datalist id="language-suggestions">
                {LANGUAGE_SUGGESTIONS.filter(
                  s => !languages.some(l => l.toLowerCase() === s.toLowerCase())
                ).map((lang) => (
                  <option key={lang} value={lang} />
                ))}
              </datalist>
            </div>
            {languages.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">Press Enter to add · Backspace to remove last</p>
            )}
          </div>

          {/* ── Text Length ── */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 6h16M4 12h16m-7 6h7" />
                  </svg>
                  <span>Text Length (words)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={textLength ?? ''}
                    onChange={handleTextLengthInput}
                    min={1}
                    step={TEXT_LENGTH_STEP}
                    placeholder="—"
                    className="w-24 bg-[#001070] border border-[#002090] text-white text-sm text-center rounded-lg
                               px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#3DC7FF] focus:border-transparent
                               transition-colors hover:border-[#003399]
                               [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
            </label>
            <input
              type="range"
              value={Math.min(textLength || TEXT_LENGTH_MIN, TEXT_LENGTH_MAX)}
              onChange={handleTextLengthSlider}
              min={TEXT_LENGTH_MIN}
              max={TEXT_LENGTH_MAX}
              step={TEXT_LENGTH_STEP}
              className="w-full h-2 bg-[#001070] rounded-lg appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#3DC7FF]
                         [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-colors
                         [&::-webkit-slider-thumb]:hover:bg-[#66d4ff]
                         [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
                         [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#3DC7FF]
                         [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{TEXT_LENGTH_MIN}</span>
              <span>{TEXT_LENGTH_MAX}+</span>
            </div>
          </div>

          {/* ── PPTX Options ── */}
          <div>
            <div className="text-sm font-medium text-gray-300 mb-3">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Presentation Output</span>
              </div>
            </div>

            <div className="space-y-3">
              {/* Create PPTX */}
              <label className="flex items-center space-x-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={createPptx}
                    onChange={handleCreatePptxChange}
                    className="sr-only peer"
                  />
                  <div className="w-5 h-5 bg-[#001070] border border-[#002090] rounded
                                  peer-checked:bg-[#3DC7FF] peer-checked:border-[#3DC7FF]
                                  peer-focus:ring-2 peer-focus:ring-[#3DC7FF] peer-focus:ring-offset-2 peer-focus:ring-offset-[#000847]
                                  transition-colors group-hover:border-[#003399]">
                  </div>
                  <svg
                    className={`absolute top-0.5 left-0.5 w-4 h-4 text-white pointer-events-none transition-opacity ${
                      createPptx ? 'opacity-100' : 'opacity-0'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                    Create PPTX file
                  </span>
                  <p className="text-xs text-gray-500">Generate a PowerPoint presentation from the output</p>
                </div>
              </label>
            </div>
          </div>

          {/* ── Info Hint ── */}
          <div className="pt-2 border-t border-[#002090]">
            <p className="text-xs text-gray-500">
              All settings are optional. Defaults will be used for any unset values.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutputSettings;