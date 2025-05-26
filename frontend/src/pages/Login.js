import React, { useState, useEffect, useRef } from 'react';
import userService from '../services/UserService';

const LoginPage = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [currentPhrase, setCurrentPhrase] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);

  const phrases = [
    'empower your workflow',
    'simplify complex tasks',
    'enhance productivity',
    'transform information',
    'unlock knowledge'
  ];

  const textGlowStyle = {
    textShadow: '0 0 3px rgba(130, 220, 255, 0.2)'
  };

  const typingDelay = 100;
  const deletingDelay = 50;
  const pauseDelay = 1000;

  const timerRef = useRef(null);

  useEffect(() => {
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
  }, [currentPhrase, isDeleting, phraseIndex, phrases]);

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

        // Notify parent component of successful login
        if (onLoginSuccess) {
          onLoginSuccess(result.user);
        }
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

            setTimeout(() => {
              if (onLoginSuccess) {
                onLoginSuccess(loginResult.user);
              }
            }, 1500);
          } else {
            setPassword('');
            setMessage({
              type: 'success',
              text: 'Registration successful! Please login with your credentials.'
            });
          }
        } catch (loginError) {
          setPassword('');
          setMessage({
            type: 'success',
            text: 'Registration successful! Please login with your credentials.'
          });
        }
      } else {
        const messageText = result.message || 'Registration failed';
        setMessage({
          type: 'error',
          text: messageText
        });
      }

    } catch (error) {
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

  // Clear message when user starts typing
  useEffect(() => {
    if (message.text) {
      clearMessage();
    }
  }, [username, password]);

  return (
    <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center">
      <div className="w-full max-w-md px-8 py-12 flex flex-col items-center">
        <div className="mb-10">
          <div className="max-w-full pb-2">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-200 tracking-tight flex justify-center">
              <div className="flex whitespace-nowrap">
                <span>Agents that&nbsp;</span>
                <span
                  className="italic text-sky-300"
                  style={textGlowStyle}
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
              placeholder="Username"
              className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-600 rounded-full text-slate-200
                        placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400
                        transition-colors"
              disabled={isLoading}
              autoComplete="username"
            />
          </div>

          <div className="mb-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-600 rounded-full text-slate-200
                        placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400
                        transition-colors"
              disabled={isLoading}
              autoComplete="current-password"
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
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
              className="w-full px-4 py-3 bg-sky-500 text-white rounded-full font-medium
                        hover:bg-sky-600 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-300
                        disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>

            <button
              onClick={handleRegister}
              disabled={isLoading || !username || !password}
              className="w-full px-4 py-3 bg-slate-800 text-slate-200 border-2 border-slate-600 rounded-full font-medium
                        hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500
                        disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating Account...' : 'Register'}
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-400">
              Enter your credentials to login or create a new account
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;