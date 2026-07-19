import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import api from '../utils/api';
import { Mail, Lock, Key, Loader2, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import Logo from '../components/Logo';

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [debugResetCode, setDebugResetCode] = useState<string | null>(null);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      showToast('Please enter your email', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      // In development, code is returned directly in the response
      const resetCode = res.data.code;
      if (resetCode) {
        setDebugResetCode(resetCode);
        setCode(resetCode); // auto-fill for frictionless UX
        showToast('Password reset code generated (mocked on screen)', 'success');
      } else {
        showToast('A password reset code has been generated.', 'success');
      }
      setStep(2);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to request reset code.';
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !newPassword || !confirmNewPassword) {
      showToast('Please fill in all fields', 'warning');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email,
        code,
        passwordNew: newPassword,
      });
      showToast('Password reset successful! Logging in...', 'success');
      navigate('/login');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to reset password. Please check your code.';
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0c10] p-4 transition-colors duration-200">
      <div className="w-full max-w-md bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg p-8">
        
        {/* Brand */}
        <div className="flex flex-col items-center mb-6">
          <Logo size="lg" />
          <h2 className="text-2xl font-bold mt-4 text-gray-900 dark:text-white">Reset your password</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {step === 1 ? 'Get a reset code for your account' : 'Configure a new account password'}
          </p>
        </div>

        {/* MOCK CODE INFO CALLOUT */}
        {step === 2 && debugResetCode && (
          <div className="mb-5 p-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs flex items-start gap-2 animate-fade-in">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Mock Mode Reset Code:</p>
              <p className="font-mono mt-1 text-sm bg-white dark:bg-gray-900/60 p-1.5 rounded border border-current select-all w-fit tracking-widest font-black">
                {debugResetCode}
              </p>
              <p className="mt-1 text-gray-500 dark:text-gray-400">The verification code was auto-filled in the form below.</p>
            </div>
          </div>
        )}

        {/* Step 1: Request Code */}
        {step === 1 ? (
          <form onSubmit={handleRequestCode} className="space-y-5">
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
                  placeholder="john@example.com"
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/70 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Generate Reset Code
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Step 2: Reset Form */
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Verification Code
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-white font-mono tracking-widest focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <input
                  type="password"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-2 border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/70 text-white py-2 font-semibold rounded-lg text-sm transition-colors cursor-pointer"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset Password'}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="text-center mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
          <Link 
            to="/login" 
            className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </Link>
        </div>

      </div>
    </div>
  );
};

export default ForgotPassword;
