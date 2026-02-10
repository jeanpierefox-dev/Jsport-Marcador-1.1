
import React from 'react';
import { Tournament, Team } from '../types';

interface StandingsTableProps {
  tournament: Tournament;
}

interface TeamStats {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
}

export const StandingsTable: React.FC<StandingsTableProps> = ({ tournament }) => {
  const stats: Record<string, TeamStats> = {};

  // 1. Initialize stats for all teams to 0
  tournament.teams.forEach(t => {
    stats[t.id] = {
      teamId: t.id, played: 0, won: 0, lost: 0, points: 0,
      setsWon: 0, setsLost: 0, pointsWon: 0, pointsLost: 0
    };
  });

  // 2. Calculate based on FINISHED fixtures
  tournament.fixtures.forEach(fix => {
    if (fix.status === 'finished' && fix.resultString) {
      const parts = fix.resultString.split('-');
      // Ensure we have a valid score format "X-Y"
      if (parts.length !== 2) return;

      const setsA = parseInt(parts[0]);
      const setsB = parseInt(parts[1]);
      
      const statsA = stats[fix.teamAId];
      const statsB = stats[fix.teamBId];

      if (statsA && statsB) {
        // Matches Played
        statsA.played++;
        statsB.played++;
        
        // Sets Won/Lost
        statsA.setsWon += setsA;
        statsA.setsLost += setsB;
        statsB.setsWon += setsB;
        statsB.setsLost += setsA;

        // Determine Match Winner & Assign Points (FIVB Rules)
        if (setsA > setsB) {
          statsA.won++;
          statsB.lost++;
          
          if (setsB === 2) {
            // 3-2 Result: Winner 2pts, Loser 1pt
            statsA.points += 2;
            statsB.points += 1;
          } else {
            // 3-0 or 3-1 Result: Winner 3pts, Loser 0pts
            statsA.points += 3;
            statsB.points += 0;
          }
        } else {
          statsB.won++;
          statsA.lost++;

          if (setsA === 2) {
            // 2-3 Result: Winner 2pts, Loser 1pt
            statsB.points += 2;
            statsA.points += 1;
          } else {
            // 0-3 or 1-3 Result: Winner 3pts, Loser 0pts
            statsB.points += 3;
            statsA.points += 0;
          }
        }
      }
    }
  });

  // 3. Sort Logic (FIVB Standard)
  // Priority: Points > Matches Won > Set Ratio > Point Ratio
  const sortedStats = Object.values(stats).sort((a, b) => {
    // 1. Points
    if (b.points !== a.points) return b.points - a.points;
    
    // 2. Matches Won
    if (b.won !== a.won) return b.won - a.won;

    // 3. Set Ratio (Quotient)
    const ratioSetA = a.setsLost === 0 ? (a.setsWon > 0 ? 1000 : 0) : a.setsWon / a.setsLost;
    const ratioSetB = b.setsLost === 0 ? (b.setsWon > 0 ? 1000 : 0) : b.setsWon / b.setsLost;
    if (ratioSetB !== ratioSetA) return ratioSetB - ratioSetA;

    // 4. Fallback (Alphabetical or Random if Point Data missing, usually Point Ratio goes here)
    return 0; 
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 shadow-xl bg-corp-panel">
      <table className="w-full text-sm text-left">
        <thead className="bg-black/40 text-slate-400 uppercase font-bold text-[10px] tracking-widest border-b border-white/10">
          <tr>
            <th className="px-4 py-3 text-center">#</th>
            <th className="px-4 py-3">Equipo</th>
            <th className="px-4 py-3 text-center text-white bg-white/5">PTS</th>
            <th className="px-4 py-3 text-center">PJ</th>
            <th className="px-4 py-3 text-center text-green-400">PG</th>
            <th className="px-4 py-3 text-center text-red-400">PP</th>
            <th className="px-4 py-3 text-center">Sets</th>
            <th className="px-4 py-3 text-center" title="Set Ratio">Coef</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {sortedStats.map((row, index) => {
            const team = tournament.teams.find(t => t.id === row.teamId);
            if (!team) return null;
            
            const setRatio = row.setsLost === 0 
                ? (row.setsWon > 0 ? 'MAX' : '0.00') 
                : (row.setsWon / row.setsLost).toFixed(3);

            return (
              <tr key={row.teamId} className="hover:bg-white/5 transition">
                <td className="px-4 py-3 text-center font-bold text-slate-500">{index + 1}</td>
                <td className="px-4 py-3 font-bold text-white flex items-center gap-3">
                  {team.logoUrl ? <img src={team.logoUrl} className="w-6 h-6 object-contain" /> : <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-[10px]">{team.name[0]}</div>}
                  {team.name}
                </td>
                <td className="px-4 py-3 text-center font-black text-corp-accent text-lg bg-white/5 border-x border-white/5 shadow-inner">{row.points}</td>
                <td className="px-4 py-3 text-center font-mono text-slate-300">{row.played}</td>
                <td className="px-4 py-3 text-center font-mono text-green-500 font-bold">{row.won}</td>
                <td className="px-4 py-3 text-center font-mono text-red-500">{row.lost}</td>
                <td className="px-4 py-3 text-center font-mono text-xs whitespace-nowrap">
                    <span className="text-green-400">{row.setsWon}</span> - <span className="text-red-400">{row.setsLost}</span>
                </td>
                <td className="px-4 py-3 text-center font-mono text-xs text-slate-400">{setRatio}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="p-3 text-[10px] text-slate-500 font-mono text-right bg-black/20">
          * Reglas FIVB: 3-0/3-1 (3pts), 3-2 (2pts/1pt). Desempate: Puntos > Victorias > Coef Sets.
      </div>
    </div>
  );
};
