import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../utils/api';
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import Logo from '../components/Logo';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleCredentialResponse = async (response: any) => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/google', { credential: response.credential });
      const { user, accessToken } = res.data.data;
      login(user, accessToken);
      showToast('Welcome back, ' + user.name + '!', 'success');
      navigate('/');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Google login failed. Please try again.';
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const google = (window as any).google;
    if (!google) return;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '513420171741-jqk0hv9hh6i2gubura59edndq6dm7f48.apps.googleusercontent.com';

    google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCredentialResponse,
    });

    const container = document.getElementById('google-signin-btn');
    if (container) {
      // Get the actual width of the input fields to render a full-width Google button
      const btnWidth = container.offsetWidth > 0 ? container.offsetWidth : 380;
      google.accounts.id.renderButton(
        container,
        { 
          theme: 'outline', 
          size: 'large', 
          width: btnWidth, 
          text: 'signin_with',
          shape: 'rectangular'
        }
      );
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('Please fill in all fields', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const { user, accessToken } = res.data.data;
      login(user, accessToken);
      showToast('Welcome back, ' + user.name + '!', 'success');
      navigate('/');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Login failed. Please check your credentials.';
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0c10] p-4 transition-colors duration-200">
      <div className="w-full max-w-md bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg p-8">
        
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <Logo size="lg" />
          <h2 className="text-2xl font-bold mt-4 text-gray-900 dark:text-white">Sign in to FlatMath</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Split expenses easily with your roommates</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <Link 
                to="/forgot-password" 
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/70 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer shadow-sm hover:shadow-md"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Sign In
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5 text-gray-400 dark:text-gray-600 text-xs font-semibold">
          <div className="flex-1 h-[1px] bg-gray-200 dark:bg-gray-800"></div>
          <span>OR</span>
          <div className="flex-1 h-[1px] bg-gray-200 dark:bg-gray-800"></div>
        </div>

        {/* Google Sign-in Button */}
        <div className="w-full flex justify-center min-h-[44px]">
          <div id="google-signin-btn" className="w-full"></div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Don't have an account?{' '}
            <Link 
              to="/register" 
              className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              Sign up now
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
};

export default Login;
