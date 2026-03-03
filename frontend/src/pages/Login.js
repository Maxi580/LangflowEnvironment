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

  const textGlowStyle = {
    textShadow: '0 0 6px rgba(61, 199, 255, 0.4)'
  };

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
      const timer = setTimeout(clearMessage, 100);
      return () => clearTimeout(timer);
    }
  }, [username, password, message.text]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoading && username && password) {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col" style={{backgroundColor: '#00005C'}}>
      {/* Logo top-left */}
      <div className="px-8 pt-6">
        <img src="/logo.png" alt="Logo" className="h-14 w-auto" />
      </div>

      {/* Centered content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md px-8 pb-24 flex flex-col items-center">
          <div className="mb-10">
            <div className="max-w-full pb-2">
              <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight flex justify-center">
                <div className="flex whitespace-nowrap">
                  <span>Agents that&nbsp;</span>
                  <span
                    className="italic"
                    style={{...textGlowStyle, color: '#3DC7FF'}}
                  >
                    {currentPhrase}
                    <span className="animate-blink">|</span>
                  </span>
                </div>
              </h1>
            </div>
          </div>

          <div className="w-full mb-8">
            <div className="mb-4">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Username"
                className="w-full px-4 py-3 rounded-full text-white
                          placeholder-gray-400 focus:outline-none transition-all"
                style={{backgroundColor: '#001070', border: '2px solid #0073E6'}}
                onFocus={e => { e.target.style.borderColor = '#3DC7FF'; e.target.style.boxShadow = '0 0 0 3px rgba(61,199,255,0.25)'; }}
                onBlur={e => { e.target.style.borderColor = '#0073E6'; e.target.style.boxShadow = 'none'; }}
                disabled={isLoading}
                autoComplete="username"
              />
            </div>

            <div className="mb-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Password"
                className="w-full px-4 py-3 rounded-full text-white
                          placeholder-gray-400 focus:outline-none transition-all"
                style={{backgroundColor: '#001070', border: '2px solid #0073E6'}}
                onFocus={e => { e.target.style.borderColor = '#3DC7FF'; e.target.style.boxShadow = '0 0 0 3px rgba(61,199,255,0.25)'; }}
                onBlur={e => { e.target.style.borderColor = '#0073E6'; e.target.style.boxShadow = 'none'; }}
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            {message.text && (
              <div className={`mb-4 px-4 py-3 rounded-lg text-sm transition-all duration-300 ${
                message.type === 'error'
                  ? 'bg-red-900/50 border border-red-700 text-red-200'
                  : 'bg-green-900/50 border border-green-700 text-green-200'
              }`}>
                {message.text}
              </div>
            )}

            <div className="flex flex-col space-y-3 mt-6">
              <button
                onClick={handleLogin}
                disabled={isLoading || !username || !password}
                className="w-full px-4 py-3 text-white rounded-full font-medium
                          transition-colors focus:outline-none focus:ring-2
                          disabled:opacity-50 disabled:cursor-not-allowed"
                style={{backgroundColor: '#0073E6'}}
                onMouseEnter={e => { if (!isLoading) e.currentTarget.style.backgroundColor = '#005bb5'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#0073E6'; }}
              >
                {isLoading ? 'Logging in...' : 'Login'}
              </button>

              <button
                onClick={handleRegister}
                disabled={isLoading || !username || !password}
                className="w-full px-4 py-3 text-white rounded-full font-medium
                          transition-colors focus:outline-none focus:ring-2
                          disabled:opacity-50 disabled:cursor-not-allowed"
                style={{backgroundColor: '#001070', border: '2px solid #0073E6'}}
                onMouseEnter={e => { if (!isLoading) e.currentTarget.style.backgroundColor = '#001a8a'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#001070'; }}
              >
                {isLoading ? 'Creating Account...' : 'Register'}
              </button>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400">
                Enter your credentials to login or create a new account
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;