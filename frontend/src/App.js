import React from 'react';
import './App.css';
import Interface from './pages';

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="py-4 px-6 border-b border-slate-700">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">
              KI <span className="text-blue-400">Agenten</span> Assistent
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        <Interface />
      </main>

      <footer className="py-3 px-6 border-t border-slate-700">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-sm text-slate-400">
            Powered by LangFlow, Qdrant & Ollama
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;