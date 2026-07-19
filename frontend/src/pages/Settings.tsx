import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  useHouseholdDetails, 
  useDashboardStats, 
  useChangeMemberRole, 
  useRemoveMember, 
  useDeleteHousehold 
} from '../utils/queryHooks';
import api from '../utils/api';
import { getAvatarDetails, formatDate } from '../utils/format';
import { 
  User, 
  Lock, 
  Home, 
  Users, 
  ShieldAlert, 
  Trash2, 
  Crown, 
  Copy,
  Check,
  ClipboardList,
  Loader2,
  Palette
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import type { AccentTheme } from '../context/ThemeContext';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser, householdId, selectHousehold } = useAuth();
  const { showToast } = useToast();
  const { accentTheme, setAccentTheme } = useTheme();

  // Queries
  const { data: hhData, isLoading: isHhLoading } = useHouseholdDetails(householdId);
  const { data: statsData } = useDashboardStats(householdId);
  
  const changeRoleMutation = useChangeMemberRole(householdId || 0);
  const removeMemberMutation = useRemoveMember(householdId || 0);
  const deleteHouseholdMutation = useDeleteHousehold();

  // Profile States
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileAvatar, setProfileAvatar] = useState(user?.avatar || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Password States
  const [passwordOld, setPasswordOld] = useState('');
  const [passwordNew, setPasswordNew] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Invite states
  const [copiedCode, setCopiedCode] = useState(false);

  const members = hhData?.members || [];
  const currentMember = members.find(m => m.userId === user?.id);
  const isOwner = currentMember?.role === 'OWNER';
  const inviteCode = hhData?.inviteCode || '';

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) return;

    setIsUpdatingProfile(true);
    try {
      const res = await api.put('/auth/profile', {
        name: profileName,
        avatar: profileAvatar || null
      });
      updateUser(res.data.data);
      showToast('Profile updated successfully!', 'success');
    } catch (err: any) {
      showToast('Failed to update profile info', 'error');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordOld || !passwordNew || !passwordConfirm) {
      showToast('Please fill in all password fields', 'warning');
      return;
    }

    if (passwordNew !== passwordConfirm) {
      showToast('New passwords do not match', 'error');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await api.put('/auth/profile', {
        passwordOld,
        passwordNew
      });
      showToast('Password changed successfully!', 'success');
      setPasswordOld('');
      setPasswordNew('');
      setPasswordConfirm('');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to change password';
      showToast(msg, 'error');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const copyInviteCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopiedCode(true);
    showToast('Invite code copied to clipboard!', 'success');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleTransferOwnership = (targetUserId: number, targetName: string) => {
    if (!window.confirm(`Are you sure you want to transfer household ownership to ${targetName}? This action will demote your account to a standard member.`)) return;

    changeRoleMutation.mutate(
      { userId: targetUserId, role: 'OWNER' },
      {
        onSuccess: () => showToast(`Ownership transferred to ${targetName}!`, 'success'),
        onError: () => showToast('Failed to transfer ownership', 'error')
      }
    );
  };

  const handleRemoveMember = (targetUserId: number, targetName: string) => {
    if (!window.confirm(`Remove ${targetName} from the household?`)) return;

    removeMemberMutation.mutate(targetUserId, {
      onSuccess: () => showToast(`${targetName} removed from household`, 'success'),
      onError: () => showToast('Failed to remove member', 'error')
    });
  };

  const handleDeleteHousehold = () => {
    if (!window.confirm('CRITICAL WARNING: This will permanently delete the household, all recorded expenses, settlements, and member logs. This action CANNOT be undone. Are you absolutely sure?')) return;

    if (!householdId) return;

    deleteHouseholdMutation.mutate(householdId, {
      onSuccess: () => {
        showToast('Household deleted successfully.', 'success');
        selectHousehold(null);
        navigate('/households');
      },
      onError: () => showToast('Failed to delete household', 'error')
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* LEFT COLUMN: Profile & Security */}
      <div className="lg:col-span-1 space-y-6">
        
        {/* Profile Card */}
        <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" />
            User Profile
          </h3>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Registered Email</label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800/40 border border-gray-150 dark:border-gray-800 rounded-lg text-gray-400 cursor-not-allowed"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Display Name</label>
              <input
                type="text"
                required
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Avatar Image URL</label>
              <input
                type="text"
                placeholder="https://..."
                value={profileAvatar}
                onChange={(e) => setProfileAvatar(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={isUpdatingProfile}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/70 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer transition-colors"
            >
              {isUpdatingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Flat Layout Theme Selector */}
        <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Palette className="w-4 h-4 text-blue-600" />
            Interface Theme
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Accent Color Theme</label>
              <select
                value={accentTheme}
                onChange={(e) => setAccentTheme(e.target.value as AccentTheme)}
                className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-950 dark:text-white focus:outline-hidden"
              >
                <option value="blue">Classic Slate (Default)</option>
                <option value="emerald">Emerald Green</option>
                <option value="indigo">Indigo Studio</option>
                <option value="crimson">Crimson Bold</option>
              </select>
            </div>

            {/* Swatch Preview */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg">
              <div className={`w-8 h-8 rounded-full bg-blue-600 shadow-sm border border-white/20 shrink-0 transition-all duration-300`} />
              <div className="min-w-0">
                <span className="text-xs font-bold text-gray-800 dark:text-white block">
                  {accentTheme === 'blue' && 'Classic Slate'}
                  {accentTheme === 'emerald' && 'Emerald Green'}
                  {accentTheme === 'indigo' && 'Indigo Studio'}
                  {accentTheme === 'crimson' && 'Crimson Bold'}
                </span>
                <span className="text-[10px] text-gray-400 block leading-tight">
                  {accentTheme === 'blue' && 'Clean blue accents for a modern look.'}
                  {accentTheme === 'emerald' && 'Fresh green palette with a money-ledger feel.'}
                  {accentTheme === 'indigo' && 'Deep indigo tones for a focused workspace.'}
                  {accentTheme === 'crimson' && 'Bold crimson style with a warm, energetic character.'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-600" />
            Update Password
          </h3>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Current Password</label>
              <input
                type="password"
                required
                placeholder="Enter current password"
                value={passwordOld}
                onChange={(e) => setPasswordOld(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">New Password</label>
              <input
                type="password"
                required
                placeholder="Enter new password (min. 6 characters)"
                value={passwordNew}
                onChange={(e) => setPasswordNew(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                placeholder="Confirm new password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={isUpdatingPassword}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/70 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer transition-colors"
            >
              {isUpdatingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Change Password'}
            </button>
          </form>
        </div>

      </div>

      {/* RIGHT AREA: Household Members & Owner Management */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Household settings list */}
        {householdId ? (
          <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-xs space-y-6">
            
            {/* Invite code banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
              <div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <Home className="w-4 h-4 text-blue-600" />
                  Flat Space Overview
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Share this invitation code to bring new members into this ledger.</p>
              </div>

              {inviteCode && (
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 px-3.5 py-2 rounded-lg w-full sm:w-auto justify-between">
                  <span className="font-mono text-sm font-black tracking-wider text-gray-700 dark:text-gray-300">
                    {inviteCode}
                  </span>
                  <button
                    onClick={copyInviteCode}
                    className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </div>

            {/* Roommate list */}
            <div>
              <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                Active Members
              </h4>

              {isHhLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(n => (
                    <div key={n} className="h-12 bg-gray-50 dark:bg-gray-800 rounded-lg animate-skeleton" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {members.map((m) => {
                    const isTargetSelf = m.userId === user?.id;
                    const isTargetOwner = m.role === 'OWNER';
                    const avatar = getAvatarDetails(m.user.name);

                    return (
                      <div key={m.id} className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-[#15181e] border border-gray-100 dark:border-gray-800/40 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full ${avatar.colorClass} flex items-center justify-center font-bold text-xs uppercase`}>
                            {avatar.initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{m.user.name}</p>
                              {isTargetOwner && (
                                <span title="Household Owner">
                                  <Crown className="w-3.5 h-3.5 text-amber-500" />
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400">{m.user.email}</span>
                          </div>
                        </div>

                        {/* Owner options */}
                        {isOwner && !isTargetSelf && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleTransferOwnership(m.userId, m.user.name)}
                              className="text-[10px] flex items-center gap-1 px-2.5 py-1 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-950/30 transition-colors font-semibold cursor-pointer"
                              title="Assign Admin"
                            >
                              <Crown className="w-3 h-3" />
                              Assign Admin
                            </button>
                            
                            <button
                              onClick={() => handleRemoveMember(m.userId, m.user.name)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition-colors cursor-pointer"
                              title="Remove member"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Audit Logs list */}
            {statsData && statsData.activityLogs && (
              <div className="pt-5 border-t border-gray-100 dark:border-gray-800">
                <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-gray-400" />
                  System Activity Log
                </h4>
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1.5 scrollbar-thin">
                  {statsData.activityLogs.map((log: any) => (
                    <div key={log.id} className="text-xs p-3 bg-gray-50/50 dark:bg-gray-850/40 rounded-lg border border-gray-100 dark:border-gray-800/40 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-gray-800 dark:text-gray-300 leading-normal">{log.details}</p>
                        <span className="text-[9px] text-gray-400 block mt-1">Logged by: {log.user.name}</span>
                      </div>
                      <span className="text-[9px] text-gray-400 shrink-0">
                        {formatDate(log.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Danger Zone */}
            {isOwner && (
              <div className="pt-6 border-t border-red-100 dark:border-red-950/20">
                <h4 className="font-bold text-xs text-red-600 dark:text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  Danger Zone
                </h4>
                <div className="p-4 bg-red-50/40 dark:bg-red-950/10 border border-red-200 dark:border-red-950/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="text-xs text-red-800 dark:text-red-300">
                    <p className="font-bold">Terminate Household Ledger</p>
                    <p className="mt-1 leading-normal">
                      Warning: This action is irreversible. It permanently deletes all expense data, active balances, splits, and receipt tracking history.
                    </p>
                  </div>
                  <button
                    onClick={handleDeleteHousehold}
                    className="w-full sm:w-auto bg-red-600 hover:bg-red-750 text-white text-xs font-semibold px-4.5 py-2 rounded-lg cursor-pointer shadow-sm hover:shadow-md transition-colors"
                  >
                    Delete Household
                  </button>
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center text-xs text-gray-400">
            No active household selected. Join or create a household in settings.
          </div>
        )}
      </div>

    </div>
  );
};

export default Settings;
