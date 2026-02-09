
import React from 'react';
import { Player } from '../types';
import { POSITIONS_LAYOUT } from '../constants';

interface CourtProps {
  players: Player[]; // Must be 6 players
  serving: boolean; // Is this side serving?
  teamName: string;
  rotationError?: boolean;
}

export const Court: React.FC<CourtProps> = ({ players, serving, teamName, rotationError }) => {
  return (
    <div className={`
        relative overflow-hidden p-2 md:p-4 rounded shadow-2xl
        ${rotationError ? 'ring-4 ring-red-500' : 'ring-1 ring-white/10'}
        bg-court-out
    `}>
      {/* Team Header inside Court Area */}
      <div className="flex justify-between items-center mb-2 md:mb-3 px-1">
        <span className="font-black text-white uppercase italic tracking-wider text-sm md:text-lg drop-shadow-md truncate max-w-[70%]">{teamName}</span>
        {serving && (
            <div className="flex items-center gap-1 md:gap-2">
                <span className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-yellow-400 animate-ping"></span>
                <span className="bg-yellow-400 text-black px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-lg">Saque</span>
            </div>
        )}
      </div>

      {/* The Actual Court (Orange Area) */}
      <div className="bg-court-main border-2 md:border-4 border-white relative h-56 xs:h-64 sm:h-80 shadow-[inset_0_0_20px_rgba(0,0,0,0.2)]">
        
        {/* Attack Line (3m) */}
        <div className="absolute top-1/3 left-0 right-0 h-1 md:h-2 bg-white/80"></div>
        
        {/* Center Line (Bottom of this half) */}
        <div className="absolute bottom-0 left-0 right-0 h-0 border-b-2 md:border-b-4 border-dashed border-white/50 w-full"></div>

        {/* Players Grid */}
        <div className="grid grid-cols-3 grid-rows-2 h-full">
            {POSITIONS_LAYOUT.map((layout) => {
               const playerByIndex = players[layout.pos - 1]; // Correct mapping based on standard rotation array index 0=P1
               
               return (
                <div 
                  key={layout.pos} 
                  className={`${layout.grid} flex flex-col items-center justify-center relative group`}
                >
                  {/* Position Marker on Floor */}
                  <div className="absolute inset-0 border border-white/10 group-hover:bg-white/5 transition"></div>
                  <span className="absolute top-1 right-1 text-[8px] md:text-[9px] font-black text-black/20">{layout.pos}</span>

                  {playerByIndex ? (
                    <div className="flex flex-col items-center z-10 transform transition group-hover:scale-110">
                      <div className={`
                        w-9 h-9 xs:w-10 xs:h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center 
                        font-black text-base md:text-lg shadow-[0_4px_6px_rgba(0,0,0,0.3)] border-2 border-white
                        ${playerByIndex.name === 'Libero' ? 'bg-yellow-400 text-black' : 'bg-vnl-panel text-white'}
                      `}>
                        {playerByIndex.number}
                      </div>
                      <div className="mt-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded text-white text-[9px] md:text-[10px] font-bold uppercase tracking-wide truncate max-w-[60px] md:max-w-[80px]">
                        {playerByIndex.name.split(' ')[0]}
                      </div>
                    </div>
                  ) : (
                    <span className="text-black/30 font-bold text-[10px] md:text-xs uppercase">Vacío</span>
                  )}
                </div>
               );
            })}
        </div>
      </div>
    </div>
  );
};
