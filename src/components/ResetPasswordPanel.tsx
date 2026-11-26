import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Mail,
  Send,
  ShieldCheck,
} from 'lucide-react';
import {
  FIREBASE_AUTH_DOMAINS_URL,
  FIREBASE_AUTH_PROVIDERS_URL,
  formatCloudErrorMessage,
  sendOperativePasswordResetEmail,
} from '../services/operativeCloudDb';
import { playPowerUp, playUiClick } from '../utils/audio';

interface ResetPasswordPanelProps {
  defaultEmail?: string | null;
  onBackToLogin: () => void;
  compact?: boolean;
}

export default function ResetPasswordPanel({
  defaultEmail,
  onBackToLogin,
  compact = false,
}: ResetPasswordPanelProps) {
  const [email, setEmail] = useState(defaultEmail || '');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSec, setCooldownSec] = useState(0);

  useEffect(() => {
    if (defaultEmail && !email) {
      setEmail(defaultEmail);
    }
  }, [defaultEmail]);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSec((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSec]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playUiClick();
    setError(null);

    if (cooldownSec > 0) return;

    const clean = email.trim();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError('Enter a valid email address to receive your recovery link.');
      return;
    }

    setSending(true);
    try {
      await sendOperativePasswordResetEmail(clean);
      playPowerUp();
      setSentTo(clean);
      setCooldownSec(30);
    } catch (err) {
      setError(
        formatCloudErrorMessage(
          err,
          'Unable to send password recovery email. Please try again.'
        )
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={
        compact
          ? 'tac-panel border border-cyan-500/35 rounded-xl p-4 flex flex-col justify-between gap-3.5'
          : 'flex flex-col gap-3.5'
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-display font-bold uppercase tracking-wider text-cyan-300">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>Reset Password</span>
          </div>
          <button
            type="button"
            onClick={() => {
              playUiClick();
              onBackToLogin();
            }}
            className="text-[11px] font-mono text-zinc-400 hover:text-white inline-flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Back to Login</span>
          </button>
        </div>

        <div className="px-3 py-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-start gap-2.5 text-[11px] text-zinc-300 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <span>
            Enter the email address linked to your Firebase account. We will send a secure one-time password recovery link via Firebase Auth.
          </span>
        </div>

        <div>
          <label
            htmlFor="reset-password-email"
            className="block text-xs font-display uppercase tracking-wider text-zinc-300 mb-1.5"
          >
            Recovery Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="reset-password-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="operative@example.com"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-950/90 border border-zinc-700/80 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-lg bg-rose-950/70 border border-rose-500/60 text-xs text-rose-200 flex flex-col gap-1.5">
            <span>{error}</span>
            {error.includes('Sign-in method') && (
              <a
                href={FIREBASE_AUTH_PROVIDERS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1 font-mono text-[11px] underline"
              >
                <span>Open Firebase Auth Providers</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {error.includes('Authorized domains') && (
              <a
                href={FIREBASE_AUTH_DOMAINS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1 font-mono text-[11px] underline"
              >
                <span>Open Firebase Authorized Domains</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {sentTo && (
          <div className="px-3 py-2.5 rounded-xl bg-emerald-950/65 border border-emerald-500/50 flex items-start gap-2.5 text-xs text-emerald-100 leading-relaxed">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-display font-bold uppercase tracking-wider text-emerald-300">
                Recovery Email Dispatched
              </div>
              <p className="text-zinc-200 mt-0.5">
                If an account is registered for <span className="font-mono text-white font-semibold">{sentTo}</span>, a Firebase password reset link is on the way. Check your inbox and spam folder.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <button
          type="submit"
          disabled={sending || cooldownSec > 0}
          className="tac-bevel-btn w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-zinc-950 font-display font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          {sending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Sending Recovery Email...</span>
            </>
          ) : cooldownSec > 0 ? (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Resend Available in {cooldownSec}s</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>{sentTo ? 'Resend Recovery Email' : 'Send Recovery Email'}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            playUiClick();
            onBackToLogin();
          }}
          className="tac-bevel-btn w-full py-2 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white font-display font-semibold uppercase tracking-wider text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
          <span>Return to Login</span>
        </button>
      </div>
    </form>
  );
}
