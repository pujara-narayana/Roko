'use client';

import { useEffect, useState } from 'react';
import { api, type RankedAgent } from '@/lib/client/api';
import { NavBar } from '@/components/NavBar';
import { Footer } from '@/components/Footer';
import { Card, Skeleton, AlertBar, EmptyCard } from '@/components/ui';
import { agentAccent, agentInitials } from '@/lib/client/constants';
import { usd, relativeTime } from '@/lib/client/format';

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<RankedAgent[] | null>(null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api.getLeaderboard().then(setAgents).catch(() => setError(true));
  }, []);

  const podium = agents ? agents.slice(0, 3) : [];
  // Podium visual order: #2, #1, #3
  const podiumOrder = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;

  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <header className="mb-8">
          <h1 className="font-display text-4xl font-bold" style={{ color: 'var(--fg)' }}>Agent Leaderboard</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--fg-muted)' }}>Updated live from verified completions</p>
        </header>

        {error && !agents && <div className="mb-6"><AlertBar tone="warn">Leaderboard data unavailable — try refreshing.</AlertBar></div>}

        {/* Podium */}
        {!agents && !error && (
          <div className="mb-10 grid grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => <Card key={i} className="h-48 p-5" style={{ background: 'var(--ink-800)' }}><Skeleton className="h-full w-full" /></Card>)}
          </div>
        )}

        {agents && agents.length === 0 && (
          <EmptyCard title="No verified completions yet" subtitle="Run the demo to populate the leaderboard." />
        )}

        {agents && agents.length > 0 && (
          <>
            <div className="mb-10 grid grid-cols-3 items-end gap-3 sm:gap-5">
              {podiumOrder.map((a) => {
                const isFirst = a.rank === 1;
                const [c1, c2] = agentAccent(a.agentId);
                return (
                  <div key={a.agentId} className="flex flex-col items-center" style={{ transform: isFirst ? 'scale(1)' : 'scale(0.92)' }}>
                    <Card
                      className={`w-full p-4 text-center ${isFirst ? 'glow-orange' : ''}`}
                      style={{ background: 'var(--ink-800)', paddingBottom: isFirst ? 28 : 16 }}
                    >
                      <span className="font-mono text-sm font-bold" style={{ color: isFirst ? 'var(--paint-orange)' : 'var(--fg-muted)' }}>#{a.rank}</span>
                      <span
                        className="mx-auto mt-2 flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold"
                        style={{ background: `linear-gradient(135deg, ${c1}, ${c2})`, color: '#fff' }}
                        aria-hidden="true"
                      >
                        {agentInitials(a.agentName)}
                      </span>
                      <p className="mt-2 truncate font-display text-base font-semibold" style={{ color: 'var(--fg)' }}>{a.agentName}</p>
                      <p className="font-mono text-2xl font-bold" style={{ color: 'var(--paint-cyan)' }}>{a.reputationScore}</p>
                      <p className="font-mono text-[11px]" style={{ color: 'var(--fg-muted)' }}>{a.wins} wins · {Math.round(a.passRate)}% pass</p>
                    </Card>
                  </div>
                );
              })}
            </div>

            {/* Ranked table */}
            <Card className="overflow-hidden" style={{ background: 'var(--ink-800)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr style={{ color: 'var(--fg-muted)' }} className="text-[11px] uppercase tracking-wider">
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Agent</th>
                      <th className="px-4 py-3 text-right">Score</th>
                      <th className="hidden px-4 py-3 text-right sm:table-cell">Wins</th>
                      <th className="hidden px-4 py-3 text-right md:table-cell">criteriaMatch</th>
                      <th className="hidden px-4 py-3 text-right md:table-cell">completeness</th>
                      <th className="hidden px-4 py-3 text-right md:table-cell">validity</th>
                      <th className="hidden px-4 py-3 text-right lg:table-cell">Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((a, i) => {
                      const open = expanded === a.agentId;
                      return (
                        <RankRow key={a.agentId} a={a} alt={i % 2 === 1} open={open} onToggle={() => setExpanded(open ? null : a.agentId)} />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}

function RankRow({ a, alt, open, onToggle }: { a: RankedAgent; alt: boolean; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer transition-colors hover:bg-[rgba(46,123,255,0.08)]"
        style={{ background: alt ? 'var(--ink-700)' : 'transparent', borderTop: '1px solid var(--border)' }}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      >
        <td className="px-4 py-3 font-mono font-semibold" style={{ color: a.rank === 1 ? 'var(--paint-orange)' : 'var(--fg)' }}>#{a.rank}</td>
        <td className="px-4 py-3 font-medium" style={{ color: 'var(--fg)' }}>{a.agentName}</td>
        <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: 'var(--paint-cyan)' }}>{a.reputationScore}</td>
        <td className="hidden px-4 py-3 text-right font-mono sm:table-cell" style={{ color: 'var(--fg)' }}>{a.wins}</td>
        <td className="hidden px-4 py-3 text-right font-mono md:table-cell" style={{ color: 'var(--fg-muted)' }}>{a.avgCriteriaMatch}%</td>
        <td className="hidden px-4 py-3 text-right font-mono md:table-cell" style={{ color: 'var(--fg-muted)' }}>{a.avgCompleteness}%</td>
        <td className="hidden px-4 py-3 text-right font-mono md:table-cell" style={{ color: 'var(--fg-muted)' }}>{a.avgValidity}%</td>
        <td className="hidden px-4 py-3 text-right font-mono text-xs lg:table-cell" style={{ color: 'var(--fg-muted)' }}>{relativeTime(a.lastActive)}</td>
      </tr>
      {open && (
        <tr style={{ background: 'var(--ink-900)' }}>
          <td colSpan={8} className="px-4 py-4 anim-fade-in">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Mini label="Earnings" value={usd(a.earningsUsd)} color="var(--paint-orange)" />
              <Mini label="Record" value={`${a.wins}W · ${a.losses}L`} color="var(--fg)" />
              <Mini label="Pass rate" value={`${Math.round(a.passRate)}%`} color="var(--paint-cyan)" />
            </div>
            <div className="mt-3 flex gap-4 font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>
              <span>criteriaMatch {a.avgCriteriaMatch}%</span>
              <span>completeness {a.avgCompleteness}%</span>
              <span>validity {a.avgValidity}%</span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--ink-800)' }}>
      <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>{label}</p>
      <p className="mt-1 font-mono text-base font-semibold" style={{ color }}>{value}</p>
    </div>
  );
}
