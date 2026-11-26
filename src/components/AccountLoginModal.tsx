import React, { useEffect, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  X,
  LogIn,
  User,
  Lock,
  Database,
  CloudUpload,
  Loader2,
  Award,
  UserPlus,
  ChevronRight,
} from 'lucide-react';
import type { UserAccount } from '../types';
import {
  getRankFromStats,
  listSavedAccounts,
  loginAccount,
} from '../utils/authStorage';
import { TacticalAvatarCrest } from './AuthScreen';
import ResetPasswordPanel from './ResetPasswordPanel';
import { playPowerUp, playUiClick } from '../utils/audio';
import { formatCloudErrorMessage } from '../services/operativeCloudDb';

interface AccountLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUsername: string;
  onAuthenticated: (account: UserAccount) => void;
  onSwitchToCreateAccount: () => void;
  cloudUser: FirebaseUser | null;
  cloudProfile: UserAccount | null;
  cloudBusy: boolean;
  cloudError: string | null;
  onConnectCloudDb: () => Promise<void>;
  onDeployCloudProfile: () => void;
  onSyncAccountToCloud: (account: UserAccount) => Promise<void>;
}

export default function AccountLoginModal({
  isOpen,
  onClose,
  currentUsername,
  onAuthenticated,
  onSwitchToCreateAccount,
  cloudUser,
  cloudProfile,
  cloudBusy,
  cloudError,
  onConnectCloudDb,
  onDeployCloudProfile,
  onSyncAccountToCloud,
}: AccountLoginModalProps) {
  const savedAccounts = isOpen ? listSavedAccounts() : [];
  const [username, setUsername] = useState(currentUsername);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const accounts = listSavedAccounts();
    const other =
      accounts.find(
        (a) => a.username.toLowerCase() !== currentUsername.toLowerCase()
      )?.username || currentUsername;
    setUsername(other);
    setPassword('');
    setError(null);
    setSubmitting(false);
    setShowResetPassword(false);
  }, [isOpen, currentUsername]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playUiClick();
    setError(null);

    const res = loginAccount({ username, password });
    if (res.ok === false) {
      setError(res.error);
      return;
    }

    if (cloudUser) {
      setSubmitting(true);
      try {
        await onSyncAccountToCloud(res.account);
      } catch (err) {
        setError(
          `Failed to sync account to Cloud Storage Database: ${formatCloudErrorMessage(
            err,
            'Permission or network error.'
          )}`
        );
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
    }

    playPowerUp();
    setPassword('');
    onAuthenticated(res.account);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 md:p-5">
      <div className="relative w-full max-w-2xl max-h-[92vh] tac-gunmetal tac-glass border border-amber-500/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="absolute inset-0 tac-scanlines pointer-events-none opacity-40" />

        <header className="relative z-10 px-5 py-3.5 border-b border-zinc-800/90 bg-zinc-950/60 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-white tracking-wider uppercase flex items-center gap-2">
              <LogIn className="w-4 h-4 text-amber-400" />
              <span>Login to Existing Account</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Select a previously created operative callsign or restore your saved Cloud account.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              playUiClick();
              onClose();
            }}
            aria-label="Close Existing Account Login"
            className="tac-bevel-btn p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Left: Existing Local Accounts */}
          <div className="md:col-span-6 flex flex-col gap-3">
            <div className="text-xs font-display font-bold uppercase tracking-wider text-zinc-300">
              Already Made Accounts ({savedAccounts.length})
            </div>

            {savedAccounts.length === 0 ? (
              <div className="tac-panel border border-zinc-800 rounded-xl p-4 text-xs text-zinc-400">
                No local accounts saved on this browser yet. Enter an account below or sign in with your Cloud account.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                {savedAccounts.map((acct) => {
                  const rank = getRankFromStats(acct.stats);
                  const selected =
                    acct.username.toLowerCase() === username.trim().toLowerCase();
                  const isCurrent =
                    acct.username.toLowerCase() === currentUsername.toLowerCase();
                  return (
                    <button
                      key={acct.username}
                      type="button"
                      onClick={() => {
                        playUiClick();
                        setUsername(acct.username);
                        setError(null);
                      }}
                      className={`tac-panel tac-bevel-btn p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                        selected
                          ? 'border-amber-400 bg-amber-950/25'
                          : 'border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <TacticalAvatarCrest avatarId={acct.avatarId} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-display font-bold text-white truncate">
                            {acct.username}
                          </span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-[9px] font-mono text-emerald-300 uppercase">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400 mt-0.5">
                          <span className="inline-flex items-center gap-0.5" style={{ color: rank.accentHex }}>
                            <Award className="w-2.5 h-2.5" />
                            {rank.tier}
                          </span>
                          <span>·</span>
                          <span>{acct.stats.highestDistance}m Best</span>
                          <span>·</span>
                          <span>{acct.wallet.coins} Coins</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Existing Cloud Account Restore */}
            <div className="rounded-xl bg-zinc-950/85 border border-cyan-500/30 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] font-display font-bold uppercase tracking-wider text-cyan-300">
                <span className="inline-flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                  Cloud Account Restore
                </span>
                {cloudUser && (
                  <span className="text-[10px] font-mono text-emerald-300">Connected</span>
                )}
              </div>

              {!cloudUser ? (
                <button
                  type="button"
                  disabled={cloudBusy}
                  onClick={() => {
                    playUiClick();
                    void onConnectCloudDb();
                  }}
                  className="tac-bevel-btn w-full py-2 px-3 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/50 text-xs font-display font-bold uppercase tracking-wider text-cyan-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {cloudBusy ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <CloudUpload className="w-3.5 h-3.5" />
                      <span>Login with Google Cloud Save</span>
                    </>
                  )}
                </button>
              ) : cloudProfile ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">
                      {cloudProfile.username}
                    </div>
                    <div className="text-[10px] font-mono text-cyan-300">
                      {cloudProfile.wallet.coins} Coins · {cloudProfile.stats.highestDistance}m Best
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playPowerUp();
                      onDeployCloudProfile();
                      onClose();
                    }}
                    className="tac-bevel-btn px-2.5 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-display font-bold uppercase text-[10px] tracking-wider cursor-pointer shrink-0"
                  >
                    Load Account
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-zinc-400">
                  Signed in as {cloudUser.email}. No cloud operative saved yet—log in on the right to sync one.
                </p>
              )}

              {cloudError && (
                <div className="px-2 py-1 rounded bg-rose-950/70 border border-rose-500/50 text-[10px] text-rose-200">
                  {cloudError}
                </div>
              )}
            </div>
          </div>

          {/* Right: Callsign + Passcode Login Form OR Firebase Reset Password Flow */}
          {showResetPassword ? (
            <div className="md:col-span-6">
              <ResetPasswordPanel
                compact
                defaultEmail={cloudUser?.email}
                onBackToLogin={() => setShowResetPassword(false)}
              />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="md:col-span-6 tac-panel border border-zinc-800 rounded-xl p-4 flex flex-col justify-between gap-3.5">
              <div className="flex flex-col gap-3">
                <div>
                  <label htmlFor="modal-login-username" className="block text-xs font-display uppercase tracking-wider text-zinc-300 mb-1.5">
                    Callsign (Username)
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="modal-login-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      maxLength={18}
                      placeholder="Enter existing callsign"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-950/90 border border-zinc-700/80 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="modal-login-password" className="block text-xs font-display uppercase tracking-wider text-zinc-300">
                      Access Passcode
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        playUiClick();
                        setError(null);
                        setShowResetPassword(true);
                      }}
                      className="text-[11px] font-mono text-cyan-300 hover:text-cyan-200 cursor-pointer transition-colors"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="modal-login-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your passcode"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-950/90 border border-zinc-700/80 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {error && (
                  <div className="px-3 py-2 rounded-lg bg-rose-950/70 border border-rose-500/60 text-xs text-rose-200">
                    {error}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="tac-bevel-btn w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-zinc-950 font-display font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Login & Switch Account</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playUiClick();
                    onClose();
                    onSwitchToCreateAccount();
                  }}
                  className="tac-bevel-btn w-full py-2 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white font-display font-semibold uppercase tracking-wider text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Create New Account Instead</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
