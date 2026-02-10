
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
  showScoreboard?: boolean; // Now treated as generic or ignored in favor of specific
  showMiniScore?: boolean;
  isCloudConnected?: boolean;
}

// Simple VNL Style Logo Placeholder
const VNLLogo = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="45" fill="#00205b" stroke="#b4a968" strokeWidth="3"/>
        <path d="M50 10 L50 90 M20 30 L80 30 M20 70 L80 70" stroke="#b4a968" strokeWidth="2" fill="none" opacity="0.3"/>
        <text x="50" y="55" fontSize="30" fontWeight="900" fill="white" textAnchor="middle" fontStyle="italic">VNL</text>
    </svg>
);

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
  showScoreboard = true, // Fallback, usually we use showMiniScore/showFullScore now
  showMiniScore = true,
  isCloudConnected = true
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isViewer = currentUser?.role === 'VIEWER';
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role?.includes('COACH');

  // New States
  const [showRotationTeamA, setShowRotationTeamA] = useState(false);
  const [showRotationTeamB, setShowRotationTeamB] = useState(false);
  const [showPlayerSelector, setShowPlayerSelector] = useState(false); 
  const [selectedPlayerStats, setSelectedPlayerStats] = useState<any | null>(null); 
  const [showPlayerStats, setShowPlayerStats] = useState(false);
  const [showMatchSummary, setShowMatchSummary] = useState(true);
  const [showControls, setShowControls] = useState(true);

  // Camera Selection State
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const isPreMatch = match.status === 'warmup';
  const isSetFinished = match.status === 'finished_set';

  // Effect to reset summary visibility when status changes
  useEffect(() => {
      if (match.status === 'finished_set' || match.status === 'finished') {
          setShowMatchSummary(true);
      }
  }, [match.status]);

  // --- CAMERA LOGIC (Condensed for brevity) ---
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

  // --- HELPERS FOR FILTERING ACTIVE PLAYERS ---
  const activePlayers = [...match.rotationA, ...match.rotationB];
  const activePlayerStats = (tournamentStats || []).filter(stat => {
      // Find matching player in active list
      return activePlayers.some(p => p.name === stat.name); // Simple match by name for this example
  });

  // --- SUB COMPONENTS ---

  const Court3D = ({ players, teamName, isLeft }: { players: Player[], teamName: string, isLeft: boolean }) => {
      // 3D Perspective Court
      return (
          <div className="perspective-container" style={{ perspective: '800px' }}>
              <div 
                className="relative bg-[#f58220] border-[4px] border-white w-64 h-48 shadow-2xl transition-transform transform-gpu"
                style={{ transform: `rotateX(45deg) rotateZ(${isLeft ? '2deg' : '-2deg'})`, transformStyle: 'preserve-3d' }}
              >
                  {/* Court Markings */}
                  <div className="absolute top-1/3 left-0 w-full h-1 bg-white/60"></div>
                  
                  {/* Players positioned in 3D */}
                  <div className="grid grid-cols-3 grid-rows-2 h-full w-full absolute inset-0">
                      {POSITIONS_LAYOUT.map(layout => {
                          const p = players[layout.pos - 1];
                          return (
                              <div key={layout.pos} className={`${layout.grid} flex items-center justify-center relative`} style={{ transformStyle: 'preserve-3d' }}>
                                  {p && (
                                      <div 
                                        className="flex flex-col items-center absolute bottom-2 transition-all duration-500"
                                        style={{ transform: 'rotateX(-45deg) translateY(-20px)' }} // Counter-rotate to stand up
                                      >
                                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-lg ${p.name === 'Libero' ? 'bg-[#ffca05] text-black' : 'bg-[#002a5c] text-white'}`}>
                                              {p.number}
                                          </div>
                                          <div className="bg-black/60 text-white text-[8px] px-1 rounded mt-1 whitespace-nowrap backdrop-blur-sm">{p.name.split(' ')[0]}</div>
                                          {/* Shadow on floor */}
                                          <div className="w-6 h-2 bg-black/30 rounded-full blur-sm mt-1 transform rotateX(45deg)"></div>
                                      </div>
                                  )}
                              </div>
                          )
                      })}
                  </div>
              </div>
              <div className={`mt-[-40px] text-center transform-gpu`} style={{ transform: 'translateZ(20px)' }}>
                  <span className="bg-[#002a5c] text-white text-xs px-4 py-1 font-black uppercase tracking-widest border-t-2 border-[#b4a968] shadow-lg">{teamName}</span>
              </div>
          </div>
      );
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end pb-0 font-sans bg-transparent overflow-hidden transition-all duration-300">
      
      {/* Background Layer */}
      {!isViewer && !cameraError ? (
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" style={{ zIndex: -1 }} />
      ) : (
        <div className="absolute inset-0 bg-[#00205b] w-full h-full" style={{ zIndex: -1 }}>
            <div className="absolute inset-0 bg-gradient-to-br from-[#00205b] to-[#000d26]"></div>
            {!isViewer && cameraError && (
                <div className="absolute top-20 right-6 flex items-center gap-2 bg-red-900/80 text-white px-3 py-1 rounded border border-red-500/50 backdrop-blur-sm pointer-events-none">
                    <span className="text-xs font-bold uppercase">NO CAMERA SIGNAL</span>
                </div>
            )}
        </div>
      )}
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" style={{ zIndex: 0 }}></div>

      {/* --- SCORE BUG (TOP LEFT) - Controlled by showMiniScore --- */}
      {showMiniScore && !isPreMatch && (
          <div className="absolute top-8 left-8 z-40 flex items-start animate-in slide-in-from-left-4">
              {/* Logo Box */}
              <div className="bg-[#002a5c] h-12 w-12 flex items-center justify-center border-r border-[#ffffff20]">
                  {tournament?.logoUrl ? <img src={tournament.logoUrl} className="h-8 w-8 object-contain" /> : <VNLLogo className="h-8 w-8" />}
              </div>
              {/* Score Box */}
              <div className="flex bg-[#041e42]/95 backdrop-blur text-white h-12 shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
                  <div className="px-4 flex items-center gap-3 border-r border-white/10">
                      <span className="text-sm font-black uppercase tracking-wider">{teamA.name.substring(0,3)}</span>
                      <div className="flex gap-1">
                          {Array.from({length: winsA}).map((_,i) => <div key={i} className="w-2 h-2 bg-[#b4a968] rounded-full"></div>)}
                      </div>
                      <span className={`text-2xl font-black ${match.servingTeamId === teamA.id ? 'text-[#ffca05]' : 'text-white'}`}>{match.scoreA}</span>
                  </div>
                  <div className="px-3 flex items-center justify-center bg-[#000d26]">
                      <span className="text-[10px] font-bold text-[#b4a968]">SET {match.currentSet}</span>
                  </div>
                  <div className="px-4 flex items-center gap-3 border-l border-white/10 flex-row-reverse">
                      <span className="text-sm font-black uppercase tracking-wider">{teamB.name.substring(0,3)}</span>
                      <div className="flex gap-1">
                          {Array.from({length: winsB}).map((_,i) => <div key={i} className="w-2 h-2 bg-[#b4a968] rounded-full"></div>)}
                      </div>
                      <span className={`text-2xl font-black ${match.servingTeamId === teamB.id ? 'text-[#ffca05]' : 'text-white'}`}>{match.scoreB}</span>
                  </div>
              </div>
          </div>
      )}

      {/* --- BOTTOM CENTER SCOREBOARD - Controlled by showScoreboard (Full) --- */}
      {showScoreboard && !isPreMatch && !matchEnded && (
          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-4xl animate-in slide-in-from-bottom-6 duration-700">
              <div className="flex h-14 bg-[#002a5c] border-b-4 border-[#b4a968] shadow-2xl relative overflow-hidden">
                  
                  {/* Left Team */}
                  <div className="flex-1 flex items-center justify-between px-6 bg-gradient-to-r from-[#001836] to-[#002a5c]">
                      <div className="flex items-center gap-3">
                          {teamA.logoUrl && <img src={teamA.logoUrl} className="h-8 w-8 object-contain bg-white rounded p-0.5" />}
                          <span className="text-xl font-black text-white uppercase tracking-tighter italic">{teamA.name}</span>
                      </div>
                      <div className="flex gap-1">
                          {Array.from({length: 3}).map((_, i) => (
                              <div key={i} className={`w-3 h-3 rounded-full border border-white/30 ${i < winsA ? 'bg-[#b4a968] shadow-[0_0_5px_#b4a968]' : 'bg-transparent'}`}></div>
                          ))}
                      </div>
                  </div>

                  {/* Center Score */}
                  <div className="w-32 flex items-center justify-center bg-black relative transform skew-x-[-10deg] mx-2 border-x border-[#ffffff20]">
                      <div className="flex items-center gap-3 transform skew-x-[10deg]">
                          <span className={`text-3xl font-black ${match.servingTeamId === teamA.id ? 'text-[#ffca05]' : 'text-white'}`}>{match.scoreA}</span>
                          <span className="text-xs font-bold text-slate-500">-</span>
                          <span className={`text-3xl font-black ${match.servingTeamId === teamB.id ? 'text-[#ffca05]' : 'text-white'}`}>{match.scoreB}</span>
                      </div>
                  </div>

                  {/* Right Team */}
                  <div className="flex-1 flex items-center justify-between px-6 bg-gradient-to-l from-[#001836] to-[#002a5c] flex-row-reverse">
                      <div className="flex items-center gap-3 flex-row-reverse">
                          {teamB.logoUrl && <img src={teamB.logoUrl} className="h-8 w-8 object-contain bg-white rounded p-0.5" />}
                          <span className="text-xl font-black text-white uppercase tracking-tighter italic">{teamB.name}</span>
                      </div>
                      <div className="flex gap-1">
                          {Array.from({length: 3}).map((_, i) => (
                              <div key={i} className={`w-3 h-3 rounded-full border border-white/30 ${i < winsB ? 'bg-[#b4a968] shadow-[0_0_5px_#b4a968]' : 'bg-transparent'}`}></div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- CONTROL DOCK (BOTTOM) --- */}
      {showControls && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-2 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl animate-in slide-in-from-bottom-10">
            {!isViewer && (
                <>
                    {/* Team A Rotation Button */}
                    <button 
                        onClick={() => { setShowRotationTeamA(!showRotationTeamA); setShowRotationTeamB(false); }}
                        className={`text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition hover:bg-white/10 flex flex-col items-center gap-1 ${showRotationTeamA ? 'text-[#ffca05] bg-white/5' : 'text-slate-300'}`}
                    >
                        <span>🔄</span> {teamA.name.substring(0,3)}
                    </button>
                    
                    {/* Team B Rotation Button */}
                    <button 
                        onClick={() => { setShowRotationTeamB(!showRotationTeamB); setShowRotationTeamA(false); }}
                        className={`text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition hover:bg-white/10 flex flex-col items-center gap-1 ${showRotationTeamB ? 'text-[#ffca05] bg-white/5' : 'text-slate-300'}`}
                    >
                        <span>🔄</span> {teamB.name.substring(0,3)}
                    </button>

                    <div className="w-px bg-white/20 h-8 self-center mx-1"></div>
                    
                    <button 
                        onClick={() => { setShowPlayerSelector(!showPlayerSelector); setSelectedPlayerStats(null); }}
                        className={`text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition hover:bg-white/10 flex flex-col items-center gap-1 ${showPlayerStats || showPlayerSelector ? 'text-[#00ffff]' : 'text-slate-300'}`}
                    >
                        <span>⭐</span> MVP
                    </button>
                    
                    <div className="w-px bg-white/20 h-8 self-center mx-1"></div>
                    
                    <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition hover:bg-white/10 flex flex-col items-center gap-1 ${cameraError ? 'text-red-500' : 'text-slate-300'}`}
                    >
                        <span>📷</span> Cam
                    </button>

                    <div className="w-px bg-white/20 h-8 self-center mx-1"></div>

                    {/* Finalize Button - Only if Admin and onEndMatch provided */}
                    {isAdmin && onEndMatch && (
                        <button 
                            onClick={() => { if(confirm("¿Estás seguro de finalizar el partido y guardar resultados?")) onEndMatch(); }}
                            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest shadow transition flex flex-col items-center gap-1 border border-red-400"
                        >
                            <span>🏁</span> Finalizar
                        </button>
                    )}
                </>
            )}
            
            <button 
                onClick={onExit}
                className="hover:bg-white/10 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition flex flex-col items-center gap-1"
            >
                <span>✕</span> Salir
            </button>

            {/* Hidden / Popups anchored to this dock */}
            
            {/* Camera Settings Dropdown */}
            {showSettings && !isViewer && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#002a5c] p-2 rounded border border-[#b4a968] shadow-xl w-48">
                    <select 
                        value={selectedDeviceId}
                        onChange={(e) => { setSelectedDeviceId(e.target.value); setCameraError(null); }}
                        className="w-full bg-[#001836] text-white text-[10px] p-2 rounded outline-none font-bold uppercase"
                    >
                        {videoDevices.length === 0 && <option value="">Detectando...</option>}
                        {videoDevices.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>
                                {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Player Selector List (Active Rotation Only) */}
            {showPlayerSelector && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#002a5c]/95 backdrop-blur border border-white/20 rounded shadow-2xl animate-in slide-in-from-bottom-2 w-48 max-h-64 overflow-y-auto">
                    <div className="p-2 border-b border-white/10 text-[10px] font-black text-[#b4a968] uppercase text-center tracking-widest">
                        Jugadores en Cancha
                    </div>
                    {activePlayerStats.length > 0 ? activePlayerStats.map((stat, idx) => (
                        <button 
                            key={idx}
                            onClick={() => { setSelectedPlayerStats(stat); setShowPlayerStats(true); setShowPlayerSelector(false); }}
                            className="w-full text-left px-3 py-2 text-xs font-bold text-white hover:bg-[#004080] border-b border-white/5 last:border-0 flex justify-between"
                        >
                            <span className="truncate">{stat.name}</span>
                            <span className="text-[#ffca05]">{stat.points} pts</span>
                        </button>
                    )) : (
                        <div className="p-3 text-[10px] text-slate-400 text-center">Sin datos de rotación</div>
                    )}
                </div>
            )}
        </div>
      )}

      {/* Toggle Controls Visibility (Optional, keeps UI clean) */}
      <button 
        onClick={() => setShowControls(!showControls)}
        className="absolute bottom-4 right-4 z-50 bg-black/40 hover:bg-black/60 text-white/50 hover:text-white p-2 rounded-full transition"
        title={showControls ? "Ocultar Controles" : "Mostrar Controles"}
      >
        {showControls ? '▼' : '▲'}
      </button>

      {/* --- 3D ROTATION OVERLAY --- */}
      {showRotationTeamA && (
          <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 z-40 animate-in slide-in-from-bottom-8 pointer-events-none">
              <Court3D players={match.rotationA} teamName={teamA.name} isLeft={true} />
          </div>
      )}
      {showRotationTeamB && (
          <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 z-40 animate-in slide-in-from-bottom-8 pointer-events-none">
              <Court3D players={match.rotationB} teamName={teamB.name} isLeft={false} />
          </div>
      )}

      {/* --- INDIVIDUAL PLAYER STATS CARD (BOTTOM RIGHT) --- */}
      {showPlayerStats && selectedPlayerStats && (
          <div className="absolute bottom-20 right-8 z-40 w-72 animate-in slide-in-from-right-10 duration-500">
              <div className="relative bg-gradient-to-br from-[#002a5c] to-[#001026] text-white overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] border-t-4 border-[#b4a968]">
                  {/* Close Button */}
                  <button onClick={() => setShowPlayerStats(false)} className="absolute top-1 right-1 z-20 text-white/50 hover:text-white p-1">✕</button>
                  
                  {/* Background graphic */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#ffca05]/10 rounded-full blur-2xl -mr-10 -mt-10"></div>

                  <div className="flex relative z-10">
                      {/* Photo Area */}
                      <div className="w-24 h-32 bg-black/30 flex items-end justify-center relative overflow-hidden">
                          {/* We don't have real photos in mock data, use generic */}
                          <div className="text-6xl grayscale opacity-50">👤</div>
                          <div className="absolute bottom-0 w-full bg-black/60 text-center text-[9px] font-black py-0.5 text-[#b4a968]">#{selectedPlayerStats.number || '?'}</div>
                      </div>
                      
                      {/* Info Area */}
                      <div className="flex-1 p-3 flex flex-col justify-center">
                          <h3 className="text-xl font-black uppercase italic tracking-tighter leading-none mb-1">{selectedPlayerStats.name}</h3>
                          <div className="text-[10px] font-bold text-[#b4a968] uppercase tracking-widest mb-3">{selectedPlayerStats.team}</div>
                          
                          <div className="grid grid-cols-2 gap-2">
                              <div className="bg-white/10 p-1 rounded border border-white/5 text-center">
                                  <div className="text-xl font-black text-white leading-none">{selectedPlayerStats.points}</div>
                                  <div className="text-[8px] text-slate-400 uppercase font-bold">PTS</div>
                              </div>
                              <div className="bg-white/10 p-1 rounded border border-white/5 text-center">
                                  <div className="text-xl font-black text-[#ffca05] leading-none">{selectedPlayerStats.aces}</div>
                                  <div className="text-[8px] text-slate-400 uppercase font-bold">ACES</div>
                              </div>
                              <div className="col-span-2 bg-white/10 p-1 rounded border border-white/5 text-center flex justify-between px-3 items-center">
                                  <span className="text-[9px] text-slate-400 uppercase font-bold">Blocks</span>
                                  <span className="text-lg font-black text-[#00ffff] leading-none">{selectedPlayerStats.blocks}</span>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- PRE-MATCH BANNER --- */}
      {isPreMatch && !matchEnded && (
          <div className="absolute bottom-28 left-1/2 transform -translate-x-1/2 w-[90%] max-w-2xl z-30 animate-in slide-in-from-bottom-10 duration-700">
            <div className="bg-[#002a5c] border-y-4 border-[#b4a968] shadow-2xl flex items-stretch h-20 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                <div className="flex-1 flex items-center justify-center bg-black/20 text-white font-black italic text-2xl uppercase tracking-tighter z-10">
                    {teamA.name}
                </div>
                <div className="w-20 bg-[#b4a968] flex items-center justify-center transform skew-x-[-15deg] z-10 border-x-2 border-white">
                    <div className="transform skew-x-[15deg] font-black text-[#002a5c] text-3xl">VS</div>
                </div>
                <div className="flex-1 flex items-center justify-center bg-black/20 text-white font-black italic text-2xl uppercase tracking-tighter z-10">
                    {teamB.name}
                </div>
            </div>
          </div>
      )}

      {/* --- MATCH FINISHED / SET FINISHED SUMMARY --- */}
      {(matchEnded || isSetFinished) && showMatchSummary && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-[95%] max-w-md mx-auto animate-in zoom-in duration-300">
             <div className="bg-[#002a5c] text-white overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] border-2 border-[#b4a968] relative">
                 <div className="bg-gradient-to-r from-[#001836] to-[#004080] p-4 text-center border-b border-[#ffffff20]">
                     <h2 className="text-2xl font-black uppercase tracking-widest italic text-white drop-shadow-md">
                         {matchEnded ? 'RESULTADO FINAL' : `SET ${match.currentSet} FINALIZADO`}
                     </h2>
                 </div>
                 
                 <div className="p-8 flex flex-col items-center">
                     {matchEnded && winner ? (
                         <>
                            <div className="text-xs font-black text-[#b4a968] uppercase tracking-[0.2em] mb-4 border-b border-[#b4a968] pb-1">Victoria Para</div>
                            <div className="text-4xl font-black text-white italic drop-shadow-lg uppercase text-center leading-tight mb-6">{winner.name}</div>
                         </>
                     ) : (
                         <div className="text-5xl font-mono font-black text-white mb-6 tracking-widest">
                             {match.scoreA} - {match.scoreB}
                         </div>
                     )}
                     
                     <div className="flex gap-2 mb-8">
                         {sets.map((s, i) => (
                             (s.scoreA > 0 || s.scoreB > 0) && (
                                 <div key={i} className={`flex flex-col items-center px-4 py-2 border ${i+1 === match.currentSet && isSetFinished ? 'bg-[#ffca05] text-[#002a5c] border-[#ffca05]' : 'bg-black/40 border-white/10 text-white'}`}>
                                     <div className="text-[9px] font-black uppercase mb-1 opacity-70">Set {i+1}</div>
                                     <div className="text-xl font-bold font-mono">
                                         {s.scoreA}-{s.scoreB}
                                     </div>
                                 </div>
                             )
                         ))}
                     </div>
                     
                     <div className="flex flex-col gap-3 w-full">
                         {isAdmin && isSetFinished && !matchEnded && onNextSet && (
                            <button 
                                onClick={onNextSet}
                                className="w-full bg-[#00ffff] hover:bg-[#00cccc] text-[#002a5c] px-4 py-4 font-black text-sm uppercase shadow-lg transition tracking-widest clip-path-polygon"
                            >
                                INICIAR SIGUIENTE SET {nextSetCountdown ? `(${nextSetCountdown})` : ''}
                            </button>
                         )}
                         <button 
                            onClick={() => setShowMatchSummary(false)}
                            className="w-full bg-white/10 hover:bg-white/20 text-white px-4 py-3 font-bold text-xs uppercase shadow-lg transition border border-white/20 tracking-wider"
                         >
                            Cerrar Ventana (Continuar Live)
                         </button>
                     </div>
                 </div>
             </div>
          </div>
      )}
    </div>
  );
};
