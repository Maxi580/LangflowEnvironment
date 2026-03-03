import React, { useState, useEffect, useRef } from 'react';
import userService from '../requests/UserRequests';

const LoginPage = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [currentPhrase, setCurrentPhrase] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);

  const typingDelay = 100;
  const deletingDelay = 50;
  const pauseDelay = 1000;

  const timerRef = useRef(null);

  useEffect(() => {
    const phrases = [
      'empower your workflow',
      'simplify complex tasks',
      'enhance productivity',
      'transform information',
      'unlock knowledge'
    ];

    const handleTyping = () => {
      const currentFullPhrase = phrases[phraseIndex];

      if (!isDeleting) {
        setCurrentPhrase(currentFullPhrase.substring(0, currentPhrase.length + 1));

        if (currentPhrase === currentFullPhrase) {
          timerRef.current = setTimeout(() => {
            setIsDeleting(true);
          }, pauseDelay);
        } else {
          timerRef.current = setTimeout(handleTyping, typingDelay);
        }
      } else {
        setCurrentPhrase(currentFullPhrase.substring(0, currentPhrase.length - 1));

        if (currentPhrase === '') {
          setIsDeleting(false);
          setPhraseIndex((prevIndex) => (prevIndex + 1) % phrases.length);
        } else {
          timerRef.current = setTimeout(handleTyping, deletingDelay);
        }
      }
    };

    timerRef.current = setTimeout(handleTyping, isDeleting ? deletingDelay : typingDelay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentPhrase, isDeleting, phraseIndex]);

  const handleLogin = async () => {
    if (!username || !password) {
      setMessage({ type: 'error', text: 'Username and password are required' });
      return;
    }

    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await userService.login({ username, password });

      if (result.success) {
        setMessage({ type: 'success', text: 'Login successful! Redirecting...' });
        setUsername('');
        setPassword('');
        if (onLoginSuccess) {
          onLoginSuccess(result.user);
        }
      } else {
        setMessage({
          type: 'error',
          text: 'Login failed. Please check your credentials and try again.'
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message || 'Login failed. Please check your credentials and try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!username || !password) {
      setMessage({ type: 'error', text: 'Username and password are required' });
      return;
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      return;
    }

    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await userService.register({ username, password });

      if (result.success) {
        setMessage({ type: 'success', text: 'Registration successful! Logging you in...' });

        try {
          const loginResult = await userService.login({ username, password });

          if (loginResult.success) {
            setUsername('');
            setPassword('');
            setMessage({ type: 'success', text: 'Registration and login successful! Redirecting...' });
            if (onLoginSuccess) {
              onLoginSuccess(loginResult.user);
            }
          } else {
            setPassword('');
            setMessage({
              type: 'success',
              text: 'Registration successful! Please login with your credentials.'
            });
          }
        } catch (loginError) {
          console.error('Auto-login after registration failed:', loginError);
          setPassword('');
          setMessage({
            type: 'success',
            text: 'Registration successful! Please login with your credentials.'
          });
        }
      } else {
        setMessage({
          type: 'error',
          text: result.message || 'Registration failed. Please try again.'
        });
      }
    } catch (error) {
      console.error('Registration error:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Registration failed. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessage = () => {
    setMessage({ type: '', text: '' });
  };

  useEffect(() => {
    if (message.text) {
      clearMessage();
    }
  }, [username, password]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoading && username && password) {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col" style={{background:'#00005C'}}>

      {/* Top bar with logo */}
      <div className="flex-shrink-0 px-10 pt-8">
        <img src="/logo_white.png" alt="Logo" className="h-20 w-auto"
             onError={e => { e.target.onerror=null; e.target.src='/logo.png'; }} />
      </div>

      {/* Main layout: left hero + right form */}
      <div className="flex-1 flex items-center justify-center px-8 pb-12">
        <div className="w-full max-w-5xl flex items-center gap-16">

          {/* ── Left: Hero text ── */}
          <div className="flex-1 hidden md:flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-widest mb-4" style={{color:'#3DC7FF'}}>
              AI-Powered Platform
            </p>
            <h1 className="text-5xl font-bold leading-tight mb-6" style={{color:'#ffffff'}}>
              Agents that
            </h1>
            <div className="text-4xl font-bold italic mb-8 h-12 flex items-center" style={{color:'#3DC7FF', textShadow:'0 0 20px rgba(61,199,255,0.3)'}}>
              {currentPhrase}
              <span className="animate-blink ml-0.5 not-italic font-light" style={{color:'#3DC7FF'}}>|</span>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <div className="w-8 h-1 rounded-full" style={{background:'#0073E6'}}></div>
              <div className="w-3 h-1 rounded-full" style={{background:'#0073E6', opacity:0.4}}></div>
              <div className="w-2 h-1 rounded-full" style={{background:'#0073E6', opacity:0.2}}></div>
            </div>
          </div>

          {/* ── Right: Login card ── */}
          <div className="w-full md:w-96 flex-shrink-0">
            <div
              className="rounded-2xl p-8"
              style={{
                background:'#ffffff',
                border:'1px solid rgba(255,255,255,0.1)',
                boxShadow:'0 8px 40px rgba(0,0,0,0.3)'
              }}
            >
              {/* Card header */}
              <div className="mb-8">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                     style={{background:'#0073E6'}}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold" style={{color:'#00005C'}}>Welcome back</h2>
                <p className="text-sm mt-1" style={{color:'#94a3b8'}}>Sign in to your account to continue</p>
              </div>

              {/* Inputs */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{color:'#64748b'}}>
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter your username"
                    className="w-full px-4 py-3 rounded-xl text-slate-700 placeholder-slate-400
                               focus:outline-none transition-all text-sm bg-slate-50 border border-slate-200"
                    onFocus={e => { e.target.style.borderColor='#0073E6'; e.target.style.boxShadow='0 0 0 3px rgba(0,115,230,0.1)'; e.target.style.background='#ffffff'; }}
                    onBlur={e => { e.target.style.borderColor=''; e.target.style.boxShadow=''; e.target.style.background=''; }}
                    disabled={isLoading}
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{color:'#64748b'}}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 rounded-xl text-slate-700 placeholder-slate-400
                               focus:outline-none transition-all text-sm bg-slate-50 border border-slate-200"
                    onFocus={e => { e.target.style.borderColor='#0073E6'; e.target.style.boxShadow='0 0 0 3px rgba(0,115,230,0.1)'; e.target.style.background='#ffffff'; }}
                    onBlur={e => { e.target.style.borderColor=''; e.target.style.boxShadow=''; e.target.style.background=''; }}
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {/* Message */}
              {message.text && (
                <div className={`mb-5 px-4 py-3 rounded-xl text-sm ${
                  message.type === 'error'
                    ? 'bg-red-50 border border-red-200 text-red-600'
                    : 'bg-green-50 border border-green-200 text-green-600'
                }`}>
                  {message.text}
                </div>
              )}

              {/* Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleLogin}
                  disabled={isLoading || !username || !password}
                  className="w-full px-4 py-3 text-white rounded-xl font-semibold text-sm
                             transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{background:'#0073E6', boxShadow:'0 4px 14px rgba(0,115,230,0.3)'}}
                  onMouseEnter={e => { if (!isLoading) { e.currentTarget.style.background='#00005C'; e.currentTarget.style.boxShadow='0 4px 14px rgba(0,0,92,0.3)'; }}}
                  onMouseLeave={e => { e.currentTarget.style.background='#0073E6'; e.currentTarget.style.boxShadow='0 4px 14px rgba(0,115,230,0.3)'; }}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      Logging in...
                    </span>
                  ) : 'Sign In'}
                </button>

                <button
                  onClick={handleRegister}
                  disabled={isLoading || !username || !password}
                  className="w-full px-4 py-3 rounded-xl font-semibold text-sm
                             transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed border-2"
                  style={{color:'#0073E6', borderColor:'#0073E6', background:'transparent'}}
                  onMouseEnter={e => { if (!isLoading) { e.currentTarget.style.background='rgba(0,115,230,0.06)'; e.currentTarget.style.borderColor='#00005C'; e.currentTarget.style.color='#00005C'; }}}
                  onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='#0073E6'; e.currentTarget.style.color='#0073E6'; }}
                >
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>

              {/* Footer hint */}
              <p className="text-xs text-center mt-6" style={{color:'#94a3b8'}}>
                Enter your credentials to sign in or create a new account
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom accent bar */}
      <div className="h-1 w-full flex-shrink-0">
        <div className="h-full w-full" style={{background:'linear-gradient(to right, #00005C, #0073E6, #3DC7FF)'}}></div>
      </div>

    </div>
  );
};

export default LoginPage;