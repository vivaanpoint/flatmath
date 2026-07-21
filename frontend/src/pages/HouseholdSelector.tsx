import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  useHouseholds,
  useCreateHousehold,
  useJoinHousehold
} from '../utils/queryHooks';
import {
  Home,
  Plus,
  UserPlus,
  ArrowRight,
  Loader2,
  Users,
  LogOut
} from 'lucide-react';

export const HouseholdSelector: React.FC = () => {
  const navigate = useNavigate();
  const { logout, selectHousehold } = useAuth();
  const { showToast } = useToast();

  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  // Queries
  const { data: households = [], isLoading: isFetching } = useHouseholds();
  const createMutation = useCreateHousehold();
  const joinMutation = useJoinHousehold();

  const handleSelect = (id: number) => {
    selectHousehold(id);
    showToast('Switched to active household', 'success');
    navigate('/dashboard');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    createMutation.mutate(
      { name: newName },
      {
        onSuccess: (newHh) => {
          showToast(`Household '${newHh.name}' created successfully!`, 'success');
          selectHousehold(newHh.id);
          navigate('/dashboard');
        },
        onError: (err: any) => {
          const msg = err.response?.data?.message || 'Failed to create household';
          showToast(msg, 'error');
        }
      }
    );
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    joinMutation.mutate(
      { code: joinCode },
      {
        onSuccess: (hh) => {
          showToast(`Joined household '${hh.name}'!`, 'success');
          selectHousehold(hh.id);
          navigate('/dashboard');
        },
        onError: (err: any) => {
          const msg = err.response?.data?.message || 'Invalid or expired invite code';
          showToast(msg, 'error');
        }
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0c10] p-6 transition-colors duration-200">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* LEFT COLUMN: List households */}
        <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg p-8 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <Home className="w-5 h-5 text-blue-600" />
              Your Households
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Select a household to view splits and balances</p>

            {isFetching ? (
              <div className="space-y-3">
                {[1, 2].map((n) => (
                  <div key={n} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-skeleton" />
                ))}
              </div>
            ) : households.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg flex flex-col items-center gap-2">
                <Users className="w-10 h-10 text-gray-400" />
                <p className="text-sm font-semibold text-gray-500">Not part of any household</p>
                <p className="text-xs text-gray-400">Create one or enter an invite code to join.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto">
                {households.map((hh) => (
                  <button
                    key={hh.id}
                    onClick={() => handleSelect(hh.id)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-[#15181e] hover:bg-blue-50/40 dark:hover:bg-blue-950/20 border border-gray-100 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-900/60 rounded-xl text-left transition-all cursor-pointer group"
                  >
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {hh.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {hh._count?.members || 1} {hh._count?.members === 1 ? 'member' : 'members'}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors transform group-hover:translate-x-1" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={logout}
            className="mt-8 flex items-center justify-center gap-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 py-2 px-4 rounded-lg transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-950/50 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

        {/* RIGHT COLUMN: Create / Join Actions */}
        <div className="space-y-6">

          {/* Action 1: Create */}
          <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Create a Household
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Start a new shared group and invite your roommates</p>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Room 302, Family, etc."
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
              />
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/70 text-white py-2 rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Create Household'}
              </button>
            </form>
          </div>

          {/* Action 2: Join */}
          <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              Join a Household
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Enter an 8-character invite code (e.g., INV-XXXX or XXXX)</p>
            <form onSubmit={handleJoin} className="space-y-3">
              <input
                type="text"
                required
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Invite Code"
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
              />
              <button
                type="submit"
                disabled={joinMutation.isPending}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/70 text-white py-2 rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                {joinMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Join Group'}
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
};

export default HouseholdSelector;
