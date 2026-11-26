import React, { useCallback, useEffect, useState } from 'react';
import { Check, Clock, Copy, Link2, Plus, ShieldAlert, Trash2, X } from 'lucide-react';
import { playUiClick } from '../utils/audio';

interface PrivateLinkRecord {
  id: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  remainingSeconds: number;
  invitePath: string;
}

interface PrivateLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHARED_APP_ORIGIN =
  'https://ais-pre-yltyfwezqgg64pnwidx6ay-502459850485.europe-west1.run.app';

function getShareOrigin(): string {
  if (typeof window === 'undefined') return SHARED_APP_ORIGIN;
  const { origin, hostname } = window.location;
  if (hostname.startsWith('ais-dev-')) {
    return SHARED_APP_ORIGIN;
  }
  return origin;
}

function formatCountdown(totalSec: number): string {
  const clamped = Math.max(0, Math.floor(totalSec));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function PrivateLinkModal({ isOpen, onClose }: PrivateLinkModalProps) {
  const [links, setLinks] = useState<PrivateLinkRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/private-links');
      if (!res.ok) throw new Error('Unable to load active private links.');
      const data = await res.json();
      if (Array.isArray(data.links)) {
        setLinks(data.links);
      }
    } catch {
      setError('Failed to sync active invite links.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchLinks();
  }, [isOpen, fetchLinks]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNowMs(t);
      setLinks((prev) => prev.filter((l) => l.expiresAt > t));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const shareOrigin = getShareOrigin();

  const handleGenerate = async () => {
    playUiClick();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/private-links', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to generate link.');
      const created: PrivateLinkRecord = await res.json();
      setLinks((prev) => [created, ...prev]);
      const fullUrl = `${shareOrigin}${created.invitePath}`;
      try {
        await navigator.clipboard.writeText(fullUrl);
        setCopiedId(created.id);
        setTimeout(() => setCopiedId((cur) => (cur === created.id ? null : cur)), 2200);
      } catch {
        // clipboard may be blocked in some iframes
      }
    } catch {
      setError('Could not mint a 30-minute private link.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (rec: PrivateLinkRecord) => {
    playUiClick();
    const fullUrl = `${shareOrigin}${rec.invitePath}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(rec.id);
      setTimeout(() => setCopiedId((cur) => (cur === rec.id ? null : cur)), 2200);
    } catch {
      setError('Clipboard blocked—select and copy the URL below manually.');
    }
  };

  const handleRevoke = async (id: string) => {
    playUiClick();
    try {
      await fetch(`/api/private-links/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setLinks((prev) => prev.filter((l) => l.id !== id));
    } catch {
      setError('Failed to revoke invite link.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg tac-gunmetal tac-glass border border-cyan-500/45 rounded-2xl p-5 shadow-2xl overflow-hidden">
        <div className="absolute inset-0 tac-scanlines pointer-events-none opacity-35" />

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-400/50 text-cyan-300">
                <Link2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-display text-lg font-extrabold text-white uppercase tracking-wider">
                  30-Minute Private Access Link
                </h2>
                <p className="text-xs text-zinc-400">
                  Generate an expiring guest pass to play without publishing publicly.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                playUiClick();
                onClose();
              }}
              className="tac-bevel-btn p-1.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-cyan-400/60 text-zinc-300 cursor-pointer"
              aria-label="Close Private Link Modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="tac-panel rounded-xl border border-amber-500/35 px-3.5 py-2.5 text-[11px] text-zinc-300 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Links expire automatically after <strong className="text-white">30:00</strong> and
              grant instant Guest Operative entry. Make sure preview sharing is enabled via the{' '}
              <strong className="text-cyan-300">Share</strong> button in AI Studio so your friend
              can reach the preview host while this workspace is active.
            </p>
          </div>

          <button
            type="button"
            disabled={creating}
            onClick={handleGenerate}
            className="tac-bevel-btn w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-zinc-950 font-display text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{creating ? 'Minting Signed Link...' : 'Generate New 30-Min Link'}</span>
          </button>

          {error && (
            <div className="text-xs font-mono text-rose-300 bg-rose-950/60 border border-rose-500/45 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            {loading && links.length === 0 ? (
              <div className="text-xs font-mono text-zinc-500 text-center py-4">
                Checking active passes...
              </div>
            ) : links.length === 0 ? (
              <div className="text-xs font-mono text-zinc-500 text-center py-4 border border-dashed border-zinc-800 rounded-xl">
                No active 30-minute links. Click above to create one.
              </div>
            ) : (
              links.map((rec) => {
                const remSec = Math.max(0, Math.ceil((rec.expiresAt - nowMs) / 1000));
                const fullUrl = `${shareOrigin}${rec.invitePath}`;
                const copied = copiedId === rec.id;
                return (
                  <div
                    key={rec.id}
                    className="tac-panel rounded-xl border border-cyan-500/35 p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                      <span className="inline-flex items-center gap-1.5 text-cyan-300 font-bold">
                        <Clock className="w-3.5 h-3.5" />
                        Expires in {formatCountdown(remSec)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopy(rec)}
                          className="tac-bevel-btn px-2.5 py-1 rounded-lg bg-zinc-900 border border-cyan-500/45 hover:border-cyan-300 text-cyan-200 flex items-center gap-1 text-[10px] font-bold uppercase cursor-pointer"
                        >
                          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copied ? 'Copied' : 'Copy'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevoke(rec.id)}
                          className="tac-bevel-btn p-1.5 rounded-lg bg-zinc-900 border border-rose-500/40 hover:border-rose-400 text-rose-400 cursor-pointer"
                          title="Revoke Private Link Immediately"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      readOnly
                      value={fullUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-full bg-zinc-950/90 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-zinc-300 select-all focus:outline-none focus:border-cyan-400/60"
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
