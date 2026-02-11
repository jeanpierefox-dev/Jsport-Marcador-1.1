
import React, { useEffect, useRef, useState } from 'react';
import { LiveMatchState, Team, Tournament, User, Player } from '../types';
import { POSITIONS_LAYOUT } from '../constants';

interface TVOverlayProps {
  match: LiveMatchState;
  teamA: Team;
  teamB: Team;
  tournament?: Tournament | null;
  currentUser?: User | null;
  onExit: () => void;
  onLogout?: () => void;
  onNextSet?: () => void;
  onEndMatch?: () => void; 
  nextSetCountdown?: number | null;
  tournamentStats?: any[];
  showStatsOverlay?: boolean;
  showScoreboard?: boolean;
  showMiniScore?: boolean;
  isCloudConnected?: boolean;
}

// Simplified VNL Style Logo
const VNLLogo = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="45" fill="#001b3d" stroke="#b4a968" strokeWidth="2"/>
        <path d="M50 10 L50 90 M20 30 L80 30 M20 70 L80 70" stroke="#b4a968" strokeWidth="1" fill="none" opacity="0.3"/>
        <text x="50" y="55" fontSize="28" fontWeight="900" fill="white" textAnchor="middle" fontStyle="italic" letterSpacing="-1">VNL</text>
    </svg>
);

// --- NEW VISUAL COURT ROTATION COMPONENT ---
const TVCourtRotation = ({ players, teamName, isLeft }: { players: Player[], teamName: string, isLeft: boolean }) => {
    return (
        <div className={`
          flex flex-col bg-gradient-to-br from-[#001b3d]/90 to-[#000d26]/90 border-l-4 border-[#b4a968]
          w-64 shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-md relative overflow-hidden rounded-xl
          ${isLeft ? 'border-l-4' : 'border-r-4 border-l-0'}
        `}>
            {/* Header */}
            <div className="bg-[#001b3d] p-2 border-b border-[#ffffff15] text-center">
                <h3 className="text-white font-black uppercase italic tracking-tighter text-md leading-none">{teamName}</h3>
                <p className="text-[#b4a968] text-[9px] font-bold uppercase tracking-widest">Rotation Check</p>
            </div>

            {/* Court Graphic */}
            <div className="relative h-40 bg-[#f97316] m-2 border-2 border-white">
                <div className="absolute top-1/3 left-0 right-0 h-0.5 bg-white/50"></div> {/* Attack Line */}
                
                {/* Players Grid */}
                <div className="grid grid-cols-3 grid-rows-2 h-full">
                    {POSITIONS_LAYOUT.map((layout) => {
                        const player = players[layout.pos - 1]; // standard rotation order
                        return (
                            <div key={layout.pos} className={`${layout.grid} flex flex-col items-center justify-center`}>
                                {player ? (
                                    <>
                                        <div className={`
                                            w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shadow-md border border-white
                                            ${player.name === 'Libero' ? 'bg-[#ffca05] text-black' : 'bg-[#001b3d] text-white'}
                                        `}>
                                            {player.number}
                                        </div>
                                        <span className="text-[8px] font-bold text-white bg-black/50 px-1 rounded mt-0.5 truncate max-w-[50px]">
                                            {player.name.split(' ')[0]}
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-[8px] text-black/30 font-bold">{layout.pos}</span>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};

// --- TEAM STATS OVERLAY COMPONENT ---
const TeamStatsOverlay = ({ match, teamA, teamB }: { match: LiveMatchState, teamA: Team, teamB: Team }) => {
    // Calculate stats on the fly
    const calculateStats = (teamId: string) => {
        const sets = match.sets || [];
        const history = sets.flatMap(s => s.history || []);
        
        // Own points
        const ownPoints = history.filter(h => h.teamId === teamId && h.type !== 'opponent_error' && h.type !== 'yellow_card' && h.type !== 'red_card');
        const attack = ownPoints.filter(h => h.type === 'attack').length;
        const block = ownPoints.filter(h => h.type === 'block').length;
        const ace = ownPoints.filter(h => h.type === 'ace').length;
        
        // Opponent errors (points for me)
        const oppErrors = history.filter(h => h.teamId === teamId && h.type === 'opponent_error').length;
        
        return { attack, block, ace, oppErrors };
    };

    const statsA = calculateStats(teamA.id);
    const statsB = calculateStats(teamB.id);

    const StatRow = ({ label, valA, valB, colorClass }: { label: string, valA: number, valB: number, colorClass?: string }) => (
        <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
            <span className={`font-black text-xl w-12 text-center ${valA > valB ? (colorClass || 'text-white') : 'text-slate-400'}`}>{valA}</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{label}</span>
            <span className={`font-black text-xl w-12 text-center ${valB > valA ? (colorClass || 'text-white') : 'text-slate-400'}`}>{valB}</span>
        </div>
    );

    return (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-40 w-96 animate-in slide-in-from-bottom-10 duration-500">
            <div className="bg-[#001b3d] border-t-4 border-[#b4a968] shadow-[0_20px_50px_rgba(0,0,0,0.8)] rounded-xl overflow-hidden">
                <div className="bg-gradient-to-r from-[#001b3d] to-[#041e42] p-3 text-center border-b border-[#ffffff10]">
                    <h3 className="text-white font-black uppercase italic tracking-tighter text-lg">Match Statistics</h3>
                </div>
                <div className="flex justify-between items-center px-6 py-2 bg-black/20">
                    <span className="text-white font-bold uppercase text-xs">{teamA.name.substring(0,3)}</span>
                    <span className="text-white font-bold uppercase text-xs">{teamB.name.substring(0,3)}</span>
                </div>
                <div className="p-4">
                    <StatRow label="Attacks" valA={statsA.attack} valB={statsB.attack} />
                    <StatRow label="Blocks" valA={statsA.block} valB={statsB.block} colorClass="text-blue-400" />
                    <StatRow label="Aces" valA={statsA.ace} valB={statsB.ace} colorClass="text-green-400" />
                    <StatRow label="Opp. Err" valA={statsA.oppErrors} valB={statsB.oppErrors} colorClass="text-red-400" />
                </div>
            </div>
        </div>
    );
};

export const TVOverlay: React.FC<TVOverlayProps> = ({ 
  match, 
  teamA, 
  teamB, 
  tournament,
  currentUser,
  onExit, 
  onLogout,
  onNextSet,
  onEndMatch,
  nextSetCountdown,
  tournamentStats,
  showStatsOverlay = false,
  showScoreboard = true, 
  showMiniScore = true,
  isCloudConnected = true
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isViewer = currentUser?.role === 'VIEWER';
  
  // Safe Default for Display Mode to prevent crash
  const defaultDisplayMode = {
    showMiniScore: true,
    showFullScoreboard: true,
    showRotationA: false,
    showRotationB: false,
    showCourtA: false,
    showCourtB: false,
    showMvp: false,
    showTeamStats: false,
    showStats: false
  };
  const displayMode = match.displayMode || defaultDisplayMode;

  // New States
  const [showMatchSummary, setShowMatchSummary] = useState(true);

  // Camera Selection State
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const isPreMatch = match.status === 'warmup';
  const isSetFinished = match.status === 'finished_set';

  // Effect to reset summary visibility when status changes
  useEffect(() => {
      if (match.status === 'finished_set' || match.status === 'finished') {
          setShowMatchSummary(true);
      }
  }, [match.status]);

  // --- CAMERA LOGIC ---
  useEffect(() => {
      if (isViewer) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const getDevices = async () => {
          try {
              try {
                  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                  stream.getTracks().forEach(track => track.stop());
              } catch (e) {}
              const devices = await navigator.mediaDevices.enumerateDevices();
              const videoInputs = devices.filter(d => d.kind === 'videoinput');
              setVideoDevices(videoInputs);
              if (videoInputs.length > 0 && !selectedDeviceId) {
                  const backCam = videoInputs.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
                  setSelectedDeviceId(backCam ? backCam.deviceId : videoInputs[0].deviceId);
              }
          } catch (e) {}
      };
      getDevices();
  }, [isViewer]);

  useEffect(() => {
    if (isViewer) return; 
    let activeStream: MediaStream | null = null;
    let isMounted = true;
    async function setupCamera() {
      setCameraError(null);
      if (videoRef.current && videoRef.current.srcObject) {
         const oldStream = videoRef.current.srcObject as MediaStream;
         try { oldStream.getTracks().forEach(track => track.stop()); } catch(e) {}
         if (videoRef.current) videoRef.current.srcObject = null;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          if (isMounted) setCameraError("Cámara no soportada.");
          return;
      }
      try {
        const constraints: MediaStreamConstraints = {
            video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : { facingMode: 'environment' }
        };
        // @ts-ignore
        if (!selectedDeviceId) { constraints.video.width = { ideal: 1920 }; constraints.video.height = { ideal: 1080 }; }
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (isMounted && videoRef.current) {
            activeStream = stream;
            videoRef.current.srcObject = activeStream;
            await videoRef.current.play().catch(e => console.warn("Autoplay blocked", e));
        } else { stream.getTracks().forEach(track => track.stop()); }
      } catch (err) {
        try {
            if (!isMounted) return;
            await new Promise(resolve => setTimeout(resolve, 500));
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (isMounted && videoRef.current) {
                activeStream = stream;
                videoRef.current.srcObject = activeStream;
                await videoRef.current.play().catch(e => console.warn("Autoplay blocked", e));
            } else { stream.getTracks().forEach(track => track.stop()); }
        } catch (err2: any) { if (isMounted) setCameraError("Error al iniciar cámara."); }
      }
    }
    setupCamera();
    return () => { isMounted = false; if (activeStream) try { activeStream.getTracks().forEach(track => track.stop()); } catch (e) {} };
  }, [isViewer, selectedDeviceId]);

  // Match State
  const sets = match.sets || [];
  const requiredWins = Math.ceil(match.config.maxSets / 2);
  const winsA = sets.filter(s => s.scoreA > s.scoreB).length;
  const winsB = sets.filter(s => s.scoreB > s.scoreA).length;
  const matchEnded = winsA >= requiredWins || winsB >= requiredWins;
  const winner = winsA >= requiredWins ? teamA : (winsB >= requiredWins ? teamB : null);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end pb-0 font-sans bg-transparent overflow-hidden transition-all duration-300 cursor-none">
      
      {/* Background Layer */}
      {!isViewer && !cameraError ? (
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" style={{ zIndex: -1 }} />
      ) : (
        <div className="absolute inset-0 bg-[#001b3d] w-full h-full" style={{ zIndex: -1 }}>
            <div className="absolute inset-0 bg-gradient-to-br from-[#001b3d] to-[#000d26]"></div>
            {!isViewer && cameraError && (
                <div className="absolute top-20 right-6 flex items-center gap-2 bg-red-900/80 text-white px-3 py-1 rounded border border-red-500/50 backdrop-blur-sm pointer-events-none">
                    <span className="text-xs font-bold uppercase">NO CAMERA SIGNAL</span>
                </div>
            )}
        </div>
      )}
      
      {/* Cinematic Vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" style={{ zIndex: 0 }}></div>

      {/* Emergency Exit Button (Subtle) */}
      <button 
          onClick={onExit}
          className="absolute top-4 right-4 z-50 text-white/20 hover:text-white p-2 text-xl font-bold cursor-pointer transition"
          title="Salir del Modo TV"
      >
          ✕
      </button>

      {/* --- VNL SCORE BUG (TOP LEFT) --- */}
      {displayMode.showMiniScore && !isPreMatch && (
          <div className="absolute top-6 left-6 z-40 flex items-stretch animate-in slide-in-from-left-4 drop-shadow-2xl">
              {/* Tournament/Logo Box */}
              <div className="bg-[#001b3d] w-14 flex items-center justify-center border-r border-[#ffffff20] rounded-l-md">
                  {tournament?.logoUrl ? <img src={tournament.logoUrl} className="h-8 w-8 object-contain" /> : <VNLLogo className="h-10 w-10" />}
              </div>
              
              {/* Main Score Area */}
              <div className="flex bg-[#041e42]/95 backdrop-blur text-white h-14">
                  {/* Team A */}
                  <div className="px-4 flex items-center gap-3 border-r border-white/10 min-w-[120px] justify-between relative overflow-hidden group">
                      {match.servingTeamId === teamA.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ffca05] animate-pulse"></div>}
                      <span className="text-lg font-black uppercase tracking-tighter italic">{teamA.name.substring(0,3)}</span>
                      <div className="flex flex-col items-end">
                          <span className={`text-3xl font-black leading-none ${match.servingTeamId === teamA.id ? 'text-[#ffca05]' : 'text-white'}`}>{match.scoreA}</span>
                          <div className="flex gap-0.5 mt-0.5">
                              {Array.from({length: winsA}).map((_,i) => <div key={i} className="w-1.5 h-1.5 bg-[#ffca05] rounded-full"></div>)}
                          </div>
                      </div>
                  </div>

                  {/* Set Indicator */}
                  <div className="w-16 flex flex-col items-center justify-center bg-[#000d26] border-x border-[#ffffff10]">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">SET</span>
                      <span className="text-xl font-black text-[#00b5e2]">{match.currentSet}</span>
                  </div>

                  {/* Team B */}
                  <div className="px-4 flex items-center gap-3 border-l border-white/10 min-w-[120px] justify-between flex-row-reverse relative overflow-hidden">
                      {match.servingTeamId === teamB.id && <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#ffca05] animate-pulse"></div>}
                      <span className="text-lg font-black uppercase tracking-tighter italic">{teamB.name.substring(0,3)}</span>
                      <div className="flex flex-col items-start">
                          <span className={`text-3xl font-black leading-none ${match.servingTeamId === teamB.id ? 'text-[#ffca05]' : 'text-white'}`}>{match.scoreB}</span>
                          <div className="flex gap-0.5 mt-0.5">
                              {Array.from({length: winsB}).map((_,i) => <div key={i} className="w-1.5 h-1.5 bg-[#ffca05] rounded-full"></div>)}
                          </div>
                      </div>
                  </div>
              </div>
              <div className="w-1 bg-[#b4a968] rounded-r-md"></div>
          </div>
      )}

      {/* --- VNL BOTTOM BAR (Full Scoreboard) --- */}
      {displayMode.showFullScoreboard && !isPreMatch && !matchEnded && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-40 w-full max-w-5xl animate-in slide-in-from-bottom-6 duration-700 px-4">
              <div className="flex h-16 bg-gradient-to-r from-[#001b3d] via-[#041e42] to-[#001b3d] border-t-2 border-[#b4a968] shadow-[0_10px_40px_rgba(0,0,0,0.6)] relative overflow-hidden rounded-b-xl clip-path-polygon">
                  
                  {/* Left Team Panel */}
                  <div className="flex-1 flex items-center justify-between px-8 relative">
                      <div className="flex items-center gap-4 z-10">
                          <div className="w-10 h-10 bg-white rounded p-1 shadow-lg transform -skew-x-12 border border-[#001b3d]">
                              {teamA.logoUrl ? <img src={teamA.logoUrl} className="w-full h-full object-contain skew-x-12" /> : <div className="w-full h-full flex items-center justify-center font-black text-[#001b3d] skew-x-12">{teamA.name[0]}</div>}
                          </div>
                          <div className="flex flex-col">
                              <span className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none filter drop-shadow-md">{teamA.name}</span>
                              <div className="flex gap-1 mt-1">
                                  {Array.from({length: Math.ceil(match.config.maxSets/2)}).map((_, i) => (
                                      <div key={i} className={`w-4 h-1.5 skew-x-[-12deg] ${i < winsA ? 'bg-[#ffca05]' : 'bg-white/20'}`}></div>
                                  ))}
                              </div>
                          </div>
                      </div>
                      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-black/40 to-transparent"></div>
                  </div>

                  {/* Center Score Diamond */}
                  <div className="w-48 flex items-center justify-center bg-black relative transform -skew-x-12 border-x-2 border-[#b4a968] z-20 shadow-2xl">
                      <div className="transform skew-x-12 flex items-center justify-center gap-6">
                          <span className={`text-5xl font-black ${match.servingTeamId === teamA.id ? 'text-[#ffca05] drop-shadow-[0_0_10px_rgba(255,202,5,0.5)]' : 'text-white'}`}>{match.scoreA}</span>
                          <span className="text-lg font-black text-[#00b5e2] opacity-80">SET {match.currentSet}</span>
                          <span className={`text-5xl font-black ${match.servingTeamId === teamB.id ? 'text-[#ffca05] drop-shadow-[0_0_10px_rgba(255,202,5,0.5)]' : 'text-white'}`}>{match.scoreB}</span>
                      </div>
                  </div>

                  {/* Right Team Panel */}
                  <div className="flex-1 flex items-center justify-between px-8 flex-row-reverse relative">
                      <div className="flex items-center gap-4 z-10 flex-row-reverse">
                          <div className="w-10 h-10 bg-white rounded p-1 shadow-lg transform -skew-x-12 border border-[#001b3d]">
                              {teamB.logoUrl ? <img src={teamB.logoUrl} className="w-full h-full object-contain skew-x-12" /> : <div className="w-full h-full flex items-center justify-center font-black text-[#001b3d] skew-x-12">{teamB.name[0]}</div>}
                          </div>
                          <div className="flex flex-col items-end">
                              <span className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none filter drop-shadow-md">{teamB.name}</span>
                              <div className="flex gap-1 mt-1 flex-row-reverse">
                                  {Array.from({length: Math.ceil(match.config.maxSets/2)}).map((_, i) => (
                                      <div key={i} className={`w-4 h-1.5 skew-x-[12deg] ${i < winsB ? 'bg-[#ffca05]' : 'bg-white/20'}`}></div>
                                  ))}
                              </div>
                          </div>
                      </div>
                      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-black/40 to-transparent"></div>
                  </div>
              </div>
          </div>
      )}

      {/* --- NEW VISUAL COURT ROTATION OVERLAYS --- */}
      {displayMode.showCourtA && (
          <div className="absolute bottom-32 left-4 z-40 animate-in slide-in-from-left-10 duration-500">
              <TVCourtRotation players={match.rotationA} teamName={teamA.name} isLeft={true} />
          </div>
      )}
      {displayMode.showCourtB && (
          <div className="absolute bottom-32 right-4 z-40 animate-in slide-in-from-right-10 duration-500">
              <TVCourtRotation players={match.rotationB} teamName={teamB.name} isLeft={false} />
          </div>
      )}

      {/* --- TEAM STATS COMPARISON --- */}
      {displayMode.showTeamStats && (
          <TeamStatsOverlay match={match} teamA={teamA} teamB={teamB} />
      )}

      {/* --- INDIVIDUAL PLAYER STATS CARD (BOTTOM RIGHT) --- */}
      {displayMode.showMvp && (
          <div className="absolute bottom-32 right-8 z-40 w-80 animate-in slide-in-from-right-10 duration-500">
              <div className="relative bg-gradient-to-br from-[#001b3d] to-[#000d26] text-white overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.7)] border-l-4 border-[#ffca05] rounded-r-xl">
                  {/* Background Accents */}
                  <div className="absolute top-[-20%] right-[-20%] w-40 h-40 bg-[#00b5e2]/10 rounded-full blur-3xl"></div>

                  <div className="flex relative z-10">
                      {/* Info Area */}
                      <div className="flex-1 p-4 flex flex-col justify-center">
                          <div className="text-[10px] font-black text-[#b4a968] uppercase tracking-[0.2em] mb-1">Most Valuable Player</div>
                          <h3 className="text-2xl font-black uppercase italic tracking-tighter leading-none mb-1 text-white">MVP</h3>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Match Statistics</div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- PRE-MATCH BANNER --- */}
      {isPreMatch && !matchEnded && (
          <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 w-[90%] max-w-3xl z-30 animate-in slide-in-from-bottom-10 duration-700">
            <div className="bg-[#001b3d] border-2 border-[#b4a968] shadow-2xl flex items-stretch h-24 relative overflow-hidden rounded-xl">
                <div className="flex-1 flex items-center justify-center bg-gradient-to-r from-black/40 to-transparent text-white font-black italic text-3xl uppercase tracking-tighter z-10 px-4 text-center">
                    {teamA.name}
                </div>
                <div className="w-32 bg-[#b4a968] flex flex-col items-center justify-center transform skew-x-[-12deg] z-10 border-x-4 border-[#001b3d] shadow-lg">
                    <div className="transform skew-x-[12deg] font-black text-[#001b3d] text-4xl">VS</div>
                    <div className="transform skew-x-[12deg] text-[10px] font-bold text-[#001b3d] uppercase tracking-widest mt-1">Match Up</div>
                </div>
                <div className="flex-1 flex items-center justify-center bg-gradient-to-l from-black/40 to-transparent text-white font-black italic text-3xl uppercase tracking-tighter z-10 px-4 text-center">
                    {teamB.name}
                </div>
            </div>
          </div>
      )}

      {/* --- MATCH FINISHED / SET FINISHED SUMMARY --- */}
      {(matchEnded || isSetFinished) && showMatchSummary && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-[95%] max-w-md mx-auto animate-in zoom-in duration-300">
             <div className="bg-[#001b3d] text-white overflow-hidden shadow-[0_0_60px_rgba(0,27,61,0.9)] border-2 border-[#b4a968] relative">
                 <div className="bg-gradient-to-r from-[#001b3d] to-[#041e42] p-6 text-center border-b border-[#ffffff10]">
                     <h2 className="text-3xl font-black uppercase tracking-widest italic text-white drop-shadow-md">
                         {matchEnded ? 'FINAL' : `SET ${match.currentSet}`}
                     </h2>
                     <p className="text-[#b4a968] text-xs font-bold uppercase tracking-[0.3em] mt-1">{matchEnded ? 'Match Result' : 'Set Complete'}</p>
                 </div>
                 
                 <div className="p-8 flex flex-col items-center bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
                     {matchEnded && winner ? (
                         <>
                            <div className="text-xs font-black text-[#00b5e2] uppercase tracking-[0.2em] mb-4">Winner</div>
                            <div className="text-5xl font-black text-white italic drop-shadow-lg uppercase text-center leading-tight mb-8 text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">{winner.name}</div>
                         </>
                     ) : (
                         <div className="text-6xl font-mono font-black text-white mb-8 tracking-widest flex gap-4">
                             <span>{match.scoreA}</span><span className="text-[#b4a968]">-</span><span>{match.scoreB}</span>
                         </div>
                     )}
                 </div>
             </div>
          </div>
      )}
    </div>
  );
};
