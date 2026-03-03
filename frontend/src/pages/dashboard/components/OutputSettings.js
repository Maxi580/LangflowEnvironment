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
    <div className="bg-white rounded-xl overflow-hidden border border-slate-200" style={{boxShadow:'0 2px 12px rgba(0,0,92,0.06)'}}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{background:'#0073E6', borderRadius: isExpanded ? '0.75rem 0.75rem 0 0' : '0.75rem'}}>
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg" style={{background:'rgba(0,0,92,0.25)'}}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Output Settings</h3>
            <p className="text-xs" style={{color:'rgba(255,255,255,0.6)'}}>Configure response preferences</p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded transition-colors hover:bg-white/10"
        >
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            style={{color:'rgba(255,255,255,0.7)'}}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Content — only visible when expanded */}
      {isExpanded && (
        <div className="p-4 space-y-5" style={{background:'#f7f9fc'}}>

          {/* ── Language Selection ── */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                <span>Output Language</span>
              </div>
            </label>
            <div
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 transition-colors"
              style={{'--focus-ring':'rgba(0,115,230,0.15)'}}
              onFocus={e => { e.currentTarget.style.borderColor='#0073E6'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(0,115,230,0.1)'; }}
              onBlur={e => { e.currentTarget.style.borderColor=''; e.currentTarget.style.boxShadow=''; }}
            >
              <div className="flex flex-wrap gap-1.5">
                {languages.map((lang, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-0.5 rounded text-sm font-medium"
                    style={{background:'rgba(0,115,230,0.1)', color:'#0073E6'}}
                  >
                    {lang}
                    <button
                      onClick={() => handleRemoveLanguage(index)}
                      className="ml-1.5 transition-colors hover:opacity-70"
                      style={{color:'#0073E6'}}
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
                  className="flex-1 min-w-[100px] bg-transparent text-slate-700 text-sm outline-none placeholder-slate-400 py-0.5"
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
              <p className="text-xs text-slate-400 mt-1">Press Enter to add · Backspace to remove last</p>
            )}
          </div>

          {/* ── Text Length ── */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 6h16M4 12h16m-7 6h7" />
                  </svg>
                  <span>Text Length (words)</span>
                </div>
                <input
                  type="number"
                  value={textLength ?? ''}
                  onChange={handleTextLengthInput}
                  min={1}
                  step={TEXT_LENGTH_STEP}
                  placeholder="—"
                  className="w-24 bg-white border border-slate-200 text-slate-700 text-sm text-center rounded-lg
                             px-2 py-1 focus:outline-none transition-colors
                             [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onFocus={e => { e.target.style.borderColor='#0073E6'; e.target.style.boxShadow='0 0 0 3px rgba(0,115,230,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor=''; e.target.style.boxShadow=''; }}
                />
              </div>
            </label>
            <input
              type="range"
              value={Math.min(textLength || TEXT_LENGTH_MIN, TEXT_LENGTH_MAX)}
              onChange={handleTextLengthSlider}
              min={TEXT_LENGTH_MIN}
              max={TEXT_LENGTH_MAX}
              step={TEXT_LENGTH_STEP}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#0073E6]
                         [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-colors
                         [&::-webkit-slider-thumb]:hover:bg-[#00005C]
                         [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
                         [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#0073E6]
                         [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>{TEXT_LENGTH_MIN}</span>
              <span>{TEXT_LENGTH_MAX}+</span>
            </div>
          </div>

          {/* ── PPTX Options ── */}
          <div>
            <div className="text-sm font-medium text-slate-600 mb-3">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Presentation Output</span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={createPptx}
                    onChange={handleCreatePptxChange}
                    className="sr-only peer"
                  />
                  <div className="w-5 h-5 bg-white border-2 border-slate-300 rounded
                                  peer-checked:border-[#0073E6]
                                  peer-focus:ring-2 peer-focus:ring-[#0073E6]/20
                                  transition-colors group-hover:border-[#0073E6]"
                       style={createPptx ? {background:'#0073E6'} : {}}>
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
                  <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors">
                    Create PPTX file
                  </span>
                  <p className="text-xs text-slate-400">Generate a PowerPoint presentation from the output</p>
                </div>
              </label>
            </div>
          </div>

          {/* ── Info Hint ── */}
          <div className="pt-2 border-t border-slate-200">
            <p className="text-xs text-slate-400">
              All settings are optional. Defaults will be used for any unset values.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutputSettings;