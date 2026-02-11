
import React, { useState, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { Court } from './components/Court';
import { ScoreControl } from './components/ScoreControl';
import { Login } from './components/Login';
import { TVOverlay } from './components/TVOverlay';
import { UserManagement } from './components/UserManagement';
import { ProfileEditor } from './components/ProfileEditor';
import { SetStatsModal } from './components/SetStatsModal';
import { CloudConfig } from './components/CloudConfig';
import { StandingsTable } from './components/StandingsTable'; 
import { TopPlayers } from './components/TopPlayers'; 
import { 
  Tournament, Team, MatchFixture, LiveMatchState, 
  Player, PlayerRole, MatchSet, RequestItem, User, PointLog, MatchConfig
} from './types';
import { generateSmartFixture, generateBasicFixture } from './services/geminiService';
import { initCloud, syncData, pushData, loadConfig, checkForSyncLink, resetCloudData } from './services/cloud';

// --- HELPERS ---
const createEmptyPlayer = (id: string, number: number, role: PlayerRole = PlayerRole.OutsideHitter): Player => ({
  id,
  name: `Jugador ${number}`,
  number,
  role,
  isCaptain: false,
  stats: { points: 0, aces: 0, blocks: 0, errors: 0, matchesPlayed: 0, mvps: 0, yellowCards: 0, redCards: 0 },
  profile: {
    bio: "",
    height: 180,
    weight: 75,
    achievements: [],
    photoUrl: ""
  }
});

// Initial Admin User
const DEFAULT_ADMIN: User = { id: 'admin', username: 'admin', password: '1234', role: 'ADMIN' };

const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export const App: React.FC = () => {
  // --- STATE ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const isAdmin = currentUser?.role === 'ADMIN';
  
  // Navigation
  const [currentView, setCurrentView] = useState('home'); 
  
  // App Data State
  const [users, setUsers] = useState<User[]>([DEFAULT_ADMIN]);
  const [registeredTeams, setRegisteredTeams] = useState<Team[]>([]);
  
  // Tournament State
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeTournamentId, setActiveTournamentId] = useState<string | null>(null);
  
  const activeTournament = tournaments.find(t => t.id === activeTournamentId) || null;

  const [liveMatch, setLiveMatch] = useState<LiveMatchState | null>(null);
  
  // UI States
  const [tvMode, setTvMode] = useState(false);
  const [showStatsOnTV, setShowStatsOnTV] = useState(false); 
  const [showScoreboardOnTV, setShowScoreboardOnTV] = useState(true); 
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingTourneyName, setEditingTourneyName] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [sharingFixture, setSharingFixture] = useState<MatchFixture | null>(null); 
  const [viewingSetStats, setViewingSetStats] = useState<{setNum: number, data: MatchSet} | null>(null);
  
  // Match Config Modal
  const [showMatchConfigModal, setShowMatchConfigModal] = useState<string | null>(null); // holds fixtureId or 'LIVE_EDIT'
  const [matchConfig, setMatchConfig] = useState<MatchConfig>({ maxSets: 3, pointsPerSet: 25, tieBreakPoints: 15 });
  const [matchConfigMode, setMatchConfigMode] = useState<'control' | 'preview'>('control');
  const [isEditingRules, setIsEditingRules] = useState(false);

  // Create Tournament Modal State
  const [showCreateTourneyModal, setShowCreateTourneyModal] = useState(false);
  const [newTourneyData, setNewTourneyData] = useState({
      name: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
      logoUrl: '',
      matchDays: [] as string[]
  });
  
  // Modals
  const [showSubModal, setShowSubModal] = useState<{teamId: string} | null>(null);
  const [showRotationModal, setShowRotationModal] = useState<{teamId: string} | null>(null);
  const [showCloudConfig, setShowCloudConfig] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState(false);

  const [subPlayerOutNum, setSubPlayerOutNum] = useState('');
  const [subPlayerInNum, setSubPlayerInNum] = useState('');
  const [rotationInput, setRotationInput] = useState<string[]>(Array(6).fill('')); 

  // New Team Form State
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCoach, setNewTeamCoach] = useState('');
  const [newTeamLogo, setNewTeamLogo] = useState('');

  // Auto-Start Countdown State
  const [nextSetCountdown, setNextSetCountdown] = useState<number | null>(null);

  // Refs to track previous state for auto-opening modal
  const prevMatchStatus = useRef<string | undefined>(undefined);

  // --- CLOUD SYNC INITIALIZATION ---
  useEffect(() => {
      const linkData = checkForSyncLink();
      let configToUse = null;
      let orgToUse = null;
      if (linkData) {
          configToUse = linkData.config;
          orgToUse = linkData.organizationId;
      } else {
          const saved = loadConfig();
          if (saved) {
              configToUse = saved.config;
              orgToUse = saved.organizationId;
          }
      }
      if (configToUse && orgToUse) {
          const success = initCloud(configToUse, orgToUse);
          if (success) {
              setIsCloudConnected(true);
          }
      }
  }, []);

  // --- CLOUD SYNC LISTENERS ---
  useEffect(() => {
      if (!isCloudConnected) return;
      const normalizeArray = <T,>(val: any): T[] => {
          if (!val) return [];
          if (Array.isArray(val)) return val.filter(i => !!i); 
          if (typeof val === 'object') return Object.values(val);
          return [];
      };
      const unsubUsers = syncData<any>('users', (val) => {
          const loadedUsers = normalizeArray<User>(val);
          if (loadedUsers.length > 0) {
              setUsers(loadedUsers);
          } else {
              setUsers([DEFAULT_ADMIN]);
              pushData('users', [DEFAULT_ADMIN]);
          }
      });
      const unsubTeams = syncData<any>('teams', (val) => setRegisteredTeams(normalizeArray<Team>(val)));
      const unsubTourneys = syncData<any>('tournaments', (val) => setTournaments(normalizeArray<Tournament>(val)));
      const unsubLive = syncData<LiveMatchState | null>('liveMatch', (val) => setLiveMatch(val));
      return () => { unsubUsers(); unsubTeams(); unsubTourneys(); unsubLive(); };
  }, [isCloudConnected]);

  // --- VIEWER AUTO-SYNC LOGIC ---
  useEffect(() => {
      if (currentUser?.role === 'VIEWER' && liveMatch && tournaments.length > 0) {
          if (!activeTournamentId || activeTournamentId !== tournaments.find(t => t.fixtures?.some(f => f.id === liveMatch.matchId))?.id) {
               const foundT = tournaments.find(t => t.fixtures?.some(f => f.id === liveMatch.matchId));
               if (foundT) {
                   setActiveTournamentId(foundT.id);
               }
          }
          if (currentView !== 'match') setCurrentView('match');
          if (!tvMode) setTvMode(true);
      }
  }, [liveMatch, currentUser, tournaments, activeTournamentId, currentView, tvMode]);

  // --- AUTOMATIC SET TRANSITION EFFECT & AUTO-OPEN MODAL ---
  useEffect(() => {
    // Auto-open stats modal when set finishes
    if (liveMatch?.status === 'finished_set' && prevMatchStatus.current !== 'finished_set') {
        const setIndex = liveMatch.currentSet - 1;
        if (liveMatch.sets[setIndex]) {
            setViewingSetStats({ setNum: liveMatch.currentSet, data: liveMatch.sets[setIndex] });
        }
    }
    prevMatchStatus.current = liveMatch?.status;

    let timer: any;
    // Only run auto-countdown if the modal is NOT open, to avoid conflict
    if (liveMatch?.status === 'finished_set' && currentUser?.role === 'ADMIN' && !viewingSetStats) {
        setNextSetCountdown(10); 
        timer = setInterval(() => {
            setNextSetCountdown(prev => {
                if (prev !== null && prev <= 1) {
                    clearInterval(timer);
                    handleStartNextSet(); 
                    return null;
                }
                return prev !== null ? prev - 1 : null;
            });
        }, 1000);
    } else {
        setNextSetCountdown(null);
    }
    return () => clearInterval(timer);
  }, [liveMatch?.status, viewingSetStats, currentUser?.role]);


  // --- SYNC HELPERS ---
  const updateUsers = (newUsers: User[]) => { setUsers(newUsers); if (isCloudConnected) pushData('users', newUsers); };
  const updateTeams = (newTeams: Team[]) => { setRegisteredTeams(newTeams); if (isCloudConnected) pushData('teams', newTeams); };
  const updateTournaments = (newTourneys: Tournament[]) => { setTournaments(newTourneys); if (isCloudConnected) pushData('tournaments', newTourneys); };
  const updateLiveMatch = (update: LiveMatchState | null | ((prev: LiveMatchState | null) => LiveMatchState | null)) => {
      setLiveMatch(prev => {
          const newVal = update instanceof Function ? update(prev) : update;
          if (isCloudConnected) pushData('liveMatch', newVal);
          return newVal;
      });
  };

  // --- TOGGLE TV GRAPHICS REMOTELY ---
  const toggleDisplayMode = (key: keyof NonNullable<LiveMatchState['displayMode']>) => {
      updateLiveMatch(prev => {
          if (!prev) return null;
          // Set defaults if displayMode is undefined
          const currentMode = prev.displayMode || { 
              showFullScoreboard: true, 
              showCourtA: false, 
              showCourtB: false,
              showMvp: false, 
              showTeamStats: false, 
              showMiniScore: true
          };
          
          const newState = { ...currentMode, [key]: !currentMode[key] };

          // Logic to ensure clean screen
          if (key === 'showCourtA' && newState.showCourtA) newState.showCourtB = false;
          if (key === 'showCourtB' && newState.showCourtB) newState.showCourtA = false;

          return {
              ...prev,
              displayMode: newState
          };
      });
  };
  
  // ... (Team, User, Tournament Handlers - Kept same)
  const handleAddTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    const newTeamId = `t-${Date.now()}`;
    const newTeam: Team = {
      id: newTeamId,
      name: newTeamName,
      color: '#1e3a8a',
      coachName: newTeamCoach || 'Sin entrenador',
      logoUrl: newTeamLogo,
      players: Array.from({ length: 12 }, (_, i) => createEmptyPlayer(`${newTeamId}-p${i+1}`, i + 1))
    };
    updateTeams([...registeredTeams, newTeam]);
    setNewTeamName(''); setNewTeamCoach(''); setNewTeamLogo('');
  };

  const handleDeleteTeam = (teamId: string) => {
      if (!isAdmin) return;
      if (!confirm("¿Estás seguro de eliminar este equipo?")) return;
      const updated = registeredTeams.filter(t => t.id !== teamId);
      updateTeams(updated);
  };

  const handleUpdateFixtureDate = (fixId: string, newDate: string) => {
      if(!activeTournament) return;
      const updatedFixtures = activeTournament.fixtures?.map(f => f.id === fixId ? {...f, date: newDate} : f);
      updateActiveTournament({ fixtures: updatedFixtures });
  };

  const handleSystemReset = async () => {
      if (currentUser?.role !== 'ADMIN') return;
      if (!confirm("⚠️ RESET TOTAL: ¿Borrar todo el sistema?")) return;
      if (isCloudConnected) await resetCloudData([DEFAULT_ADMIN]);
      setUsers([DEFAULT_ADMIN]);
      setRegisteredTeams([]);
      setTournaments([]);
      setLiveMatch(null);
      setActiveTournamentId(null);
      setCurrentView('home');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => setter(reader.result as string);
          reader.readAsDataURL(file);
      }
  };

  const handleAddUser = (user: User) => updateUsers([...users, user]);
  const handleDeleteUser = (userId: string) => updateUsers(users.filter(u => u.id !== userId));
  const handleUpdateUser = (updatedUser: User) => { updateUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u)); };

  const handleUpdatePlayerInTeam = (updatedPlayer: Player) => {
      const updatedTeams = registeredTeams.map(t => ({
          ...t,
          players: t.players?.map(p => p.id === updatedPlayer.id ? updatedPlayer : p)
      }));
      updateTeams(updatedTeams);
      setEditingPlayer(null);
  };
  
  const handleUpdateTeam = (updatedTeam: Team) => {
      const updatedTeams = registeredTeams.map(t => t.id === updatedTeam.id ? updatedTeam : t);
      updateTeams(updatedTeams);
      setEditingTeam(null);
  }

  const handleCreateTournament = async () => {
    if (!currentUser) return;
    if (registeredTeams.length < 2) { alert("Mínimo 2 equipos para crear un torneo."); return; }
    
    if (!newTourneyData.name.trim()) { alert("Ingresa un nombre para el torneo"); return; }

    setLoading(true);
    let fixtureData: { groups: any, fixtures: any[] } = { groups: {}, fixtures: [] };

    try {
        const smartData = await generateSmartFixture(
            registeredTeams, 
            newTourneyData.startDate, 
            newTourneyData.endDate,
            newTourneyData.matchDays
        );
        
        if (smartData && smartData.fixtures && smartData.fixtures.length > 0) {
            fixtureData = smartData;
        } else {
            throw new Error("Fixture vacío o inválido");
        }
    } catch (e) {
        console.error("Generación inteligente falló, usando básico:", e);
        fixtureData = generateBasicFixture(
            registeredTeams, 
            newTourneyData.startDate, 
            newTourneyData.endDate,
            newTourneyData.matchDays
        );
        alert("Aviso: Se generó un fixture básico debido a un problema de conexión con la IA o datos insuficientes.");
    } finally {
        // Ultimate Fallback check
        if (!fixtureData || !fixtureData.fixtures || fixtureData.fixtures.length === 0) {
             console.warn("Fallback failed too, forcing hard fallback");
             fixtureData = generateBasicFixture(registeredTeams, newTourneyData.startDate, newTourneyData.endDate, []);
        }

        const { groups, fixtures } = fixtureData;
        
        const newTournament: Tournament = {
          id: `tourney-${Date.now()}`,
          ownerId: currentUser.id, 
          name: newTourneyData.name,
          logoUrl: newTourneyData.logoUrl,
          startDate: newTourneyData.startDate,
          endDate: newTourneyData.endDate,
          teams: registeredTeams,
          groups,
          fixtures: fixtures.map((f: any, i: number) => ({ ...f, id: `fix-${i}-${Date.now()}`, status: 'scheduled' }))
        };
        updateTournaments([...tournaments, newTournament]);
        setActiveTournamentId(newTournament.id);
        
        setShowCreateTourneyModal(false);
        setCurrentView('dashboard');
        
        setNewTourneyData({
            name: '',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
            logoUrl: '',
            matchDays: []
        });
        setLoading(false);
    }
  };

  const toggleDaySelection = (day: string) => {
      setNewTourneyData(prev => {
          const exists = prev.matchDays.includes(day);
          return {
              ...prev,
              matchDays: exists ? prev.matchDays.filter(d => d !== day) : [...prev.matchDays, day]
          };
      });
  };

  const handleDeleteTournament = async () => {
      if (!activeTournamentId || currentUser?.role !== 'ADMIN') return;
      if (!confirm("⚠️ ¿Borrar Torneo?")) return;
      const updatedList = tournaments.filter(t => t.id !== activeTournamentId);
      setActiveTournamentId(null);
      setCurrentView('lobby');
      setTournaments(updatedList);
      if (isCloudConnected) await pushData('tournaments', updatedList);
  };

  const updateActiveTournament = (updates: Partial<Tournament>) => {
      if (!activeTournamentId) return;
      updateTournaments(tournaments.map(t => t.id === activeTournamentId ? { ...t, ...updates } : t));
  };

  // --- MATCH CONTROL HANDLERS ---

  const handleInitiateMatch = (fixtureId: string, mode: 'control' | 'preview') => {
      // Check if match is live
      if (liveMatch && liveMatch.matchId === fixtureId) {
          if (mode === 'preview') setTvMode(true);
          setCurrentView('match'); 
          return; 
      }

      // Check if match is finished - View Results Mode
      const fixture = activeTournament?.fixtures?.find(f => f.id === fixtureId);
      if (fixture?.status === 'finished') {
          const teamA = activeTournament?.teams?.find(t => t.id === fixture.teamAId);
          const teamB = activeTournament?.teams?.find(t => t.id === fixture.teamBId);
          
          if (!teamA || !teamB) return;

          // Reconstruct a read-only live state
          const savedSets = fixture.savedSets || [];
          const winsA = savedSets.filter(s => s.scoreA > s.scoreB).length;
          const winsB = savedSets.filter(s => s.scoreB > s.scoreA).length;

          // Create dummy players if missing to prevent crash
          const rotationA = teamA.players.slice(0, 6);
          const rotationB = teamB.players.slice(0, 6);

          const readOnlyState: LiveMatchState = {
              matchId: fixtureId,
              config: { maxSets: 5, pointsPerSet: 25, tieBreakPoints: 15 }, // Defaults
              status: 'finished',
              currentSet: savedSets.length,
              sets: savedSets,
              rotationA, rotationB,
              benchA: [], benchB: [],
              servingTeamId: '',
              scoreA: winsA, 
              scoreB: winsB,
              timeoutsA: 0, timeoutsB: 0,
              substitutionsA: 0, substitutionsB: 0,
              requests: []
          };
          setLiveMatch(readOnlyState);
          setCurrentView('match');
          return;
      }

      if (currentUser?.role === 'ADMIN' || currentUser?.role.includes('COACH')) {
          setShowMatchConfigModal(fixtureId);
          setMatchConfigMode(mode);
          setIsEditingRules(false);
          setMatchConfig({ maxSets: 3, pointsPerSet: 25, tieBreakPoints: 15 });
      } else {
          setCurrentView('match');
      }
  };

  const openEditRules = () => {
      if (!liveMatch) return;
      setMatchConfig(liveMatch.config);
      setIsEditingRules(true);
      setShowMatchConfigModal('LIVE_EDIT');
  };

  const handleSaveConfig = () => {
      if (isEditingRules) {
          updateLiveMatch(prev => prev ? {...prev, config: matchConfig} : null);
          setShowMatchConfigModal(null);
          setIsEditingRules(false);
      } else {
          confirmStartMatch();
      }
  };

  const confirmStartMatch = () => {
    if (!activeTournament || !showMatchConfigModal || showMatchConfigModal === 'LIVE_EDIT') return;
    const fixtureId = showMatchConfigModal;

    const fixture = activeTournament.fixtures?.find(f => f.id === fixtureId);
    if (!fixture) return;

    const updatedFixtures = activeTournament.fixtures?.map(f => f.id === fixtureId ? {...f, status: 'live' as const} : f);
    updateActiveTournament({ fixtures: updatedFixtures });

    const teamA = activeTournament.teams?.find(t => t.id === fixture.teamAId)!;
    const teamB = activeTournament.teams?.find(t => t.id === fixture.teamBId)!;
    const initialSet: MatchSet = { scoreA: 0, scoreB: 0, history: [], durationMinutes: 0 };
    const rotationA = teamA.players.slice(0, 6);
    const rotationB = teamB.players.slice(0, 6);
    
    updateLiveMatch({
      matchId: fixtureId, 
      config: matchConfig,
      status: 'warmup', // Initialize in Warmup mode
      currentSet: 1, 
      sets: [initialSet],
      rotationA, rotationB, 
      benchA: teamA.players.filter(p => !rotationA.find(r => r.id === p.id)), 
      benchB: teamB.players.filter(p => !rotationB.find(r => r.id === p.id)),
      servingTeamId: teamA.id, 
      scoreA: 0, scoreB: 0, 
      timeoutsA: 0, timeoutsB: 0, 
      substitutionsA: 0, substitutionsB: 0, 
      requests: []
    });
    
    setShowMatchConfigModal(null);
    setCurrentView('match');
    
    if (matchConfigMode === 'preview') {
        setTvMode(true);
    }
  };

  const handleStartGame = () => {
      updateLiveMatch(prev => prev ? { ...prev, status: 'playing' } : null);
  };

  const handleSetServe = (teamId: string) => {
      if (!liveMatch) return;
      updateLiveMatch({ ...liveMatch, servingTeamId: teamId });
  };

  // --- NEW SET MANAGEMENT SYSTEM ---
  
  const handleSetOperation = (action: 'START' | 'FINISH' | 'REOPEN', setIndex: number) => {
      if (!activeTournament || !liveMatch) return;

      updateLiveMatch(prev => {
          if (!prev) return null;
          
          let updatedSets = [...prev.sets];
          let updatedStatus = prev.status;
          let updatedCurrentSet = prev.currentSet;
          let updatedScoreA = prev.scoreA;
          let updatedScoreB = prev.scoreB;
          let updatedServingTeam = prev.servingTeamId;

          while (updatedSets.length <= setIndex) {
              updatedSets.push({ scoreA: 0, scoreB: 0, history: [], durationMinutes: 0 });
          }

          if (action === 'START') {
              updatedCurrentSet = setIndex + 1;
              updatedStatus = 'playing';
              updatedScoreA = updatedSets[setIndex].scoreA;
              updatedScoreB = updatedSets[setIndex].scoreB;

              const fixture = activeTournament.fixtures?.find(f => f.id === prev.matchId);
              if (fixture) {
                  updatedServingTeam = ((setIndex + 1) % 2 !== 0) ? fixture.teamAId : fixture.teamBId;
              }
              
              return {
                  ...prev,
                  status: updatedStatus,
                  currentSet: updatedCurrentSet,
                  scoreA: updatedScoreA,
                  scoreB: updatedScoreB,
                  sets: updatedSets,
                  servingTeamId: updatedServingTeam,
                  timeoutsA: 0,
                  timeoutsB: 0,
                  substitutionsA: 0,
                  substitutionsB: 0
              };
          } 
          
          if (action === 'FINISH') {
             const winsA = updatedSets.filter(s => s.scoreA > s.scoreB).length;
             const winsB = updatedSets.filter(s => s.scoreB > s.scoreA).length;
             const requiredWins = Math.ceil(prev.config.maxSets / 2);

             if (winsA >= requiredWins || winsB >= requiredWins) {
                 return { ...prev, status: 'finished', sets: updatedSets };
             }

             // Auto-increment set number if we are finishing the current set
             if (prev.currentSet === setIndex + 1) {
                 const nextSetNum = prev.currentSet + 1;
                 
                 if (updatedSets.length < nextSetNum) {
                     updatedSets.push({ scoreA: 0, scoreB: 0, history: [], durationMinutes: 0 });
                 }
                 
                 const fixture = activeTournament.fixtures?.find(f => f.id === prev.matchId);
                 // Determine next server: Odd sets Team A, Even sets Team B (simplified rule)
                 const nextServingTeam = fixture ? ((nextSetNum % 2 !== 0) ? fixture.teamAId : fixture.teamBId) : prev.servingTeamId;

                 return {
                     ...prev,
                     status: 'playing', // Set to playing to start next set
                     currentSet: nextSetNum,
                     scoreA: 0,
                     scoreB: 0,
                     sets: updatedSets,
                     servingTeamId: nextServingTeam,
                     timeoutsA: 0,
                     timeoutsB: 0,
                     substitutionsA: 0,
                     substitutionsB: 0
                 };
             }
             return { ...prev, sets: updatedSets };
          }

          if (action === 'REOPEN') {
              updatedCurrentSet = setIndex + 1;
              updatedStatus = 'paused'; 
              updatedScoreA = updatedSets[setIndex].scoreA;
              updatedScoreB = updatedSets[setIndex].scoreB;
              
              return {
                  ...prev,
                  status: updatedStatus,
                  currentSet: updatedCurrentSet,
                  scoreA: updatedScoreA,
                  scoreB: updatedScoreB,
                  sets: updatedSets
              };
          }

          return prev;
      });
  };

  const handleStartNextSet = () => {
      if (!liveMatch) return;
      handleSetOperation('FINISH', liveMatch.currentSet - 1); 
  };

  // ... (ResetMatch, EndBroadcast, etc.)
  const handleResetMatch = (fixtureId: string) => {
      if (!activeTournament || currentUser?.role !== 'ADMIN') return;
      if (!confirm("⚠️ ¿REINICIAR PARTIDO?\n\nSe borrará el resultado y el estado volverá a 'Programado'. Si hay un partido en vivo con este ID, se detendrá.")) return;

      const updatedFixtures = activeTournament.fixtures?.map(f => 
          f.id === fixtureId ? { ...f, status: 'scheduled' as const, winnerId: undefined, resultString: undefined, savedSets: undefined } : f
      );
      updateActiveTournament({ fixtures: updatedFixtures });

      if (liveMatch && liveMatch.matchId === fixtureId) {
          updateLiveMatch(null);
      }
  };

  const handleEndBroadcast = async () => {
      if (!liveMatch || !activeTournament || currentUser?.role !== 'ADMIN') return;
      if (!confirm("¿Confirmar y Guardar Resultado Final?")) return;
      
      const sets = liveMatch.sets || [];
      const winsA = sets.filter(s => s.scoreA > s.scoreB).length;
      const winsB = sets.filter(s => s.scoreB > s.scoreA).length;
      const fixture = activeTournament.fixtures?.find(f => f.id === liveMatch.matchId);
      
      if (fixture) {
          const winnerId = winsA > winsB ? fixture.teamAId : (winsB > winsA ? fixture.teamBId : undefined);
          const updatedFixtures = activeTournament.fixtures?.map(f => f.id === liveMatch.matchId ? { 
              ...f, 
              status: 'finished' as const, 
              winnerId, 
              resultString: `${winsA}-${winsB}`,
              savedSets: sets // Save full history
          } : f);
          updateActiveTournament({ fixtures: updatedFixtures });
      }

      const allHistory = sets.flatMap(s => s.history || []);
      const updatedTeams = registeredTeams.map(team => {
          const updatedPlayers = team.players.map(player => {
              const playerActions = allHistory.filter(h => h.playerId === player.id);
              const points = playerActions.filter(h => h.type === 'attack' || h.type === 'block' || h.type === 'ace').length;
              const aces = playerActions.filter(h => h.type === 'ace').length;
              const blocks = playerActions.filter(h => h.type === 'block').length;
              const yellowCards = playerActions.filter(h => h.type === 'yellow_card').length;
              const redCards = playerActions.filter(h => h.type === 'red_card').length;
              
              if (points > 0 || playerActions.length > 0) {
                  return {
                      ...player,
                      stats: {
                          ...player.stats,
                          matchesPlayed: player.stats.matchesPlayed + 1,
                          points: player.stats.points + points,
                          aces: player.stats.aces + aces,
                          blocks: player.stats.blocks + blocks,
                          yellowCards: (player.stats.yellowCards || 0) + yellowCards,
                          redCards: (player.stats.redCards || 0) + redCards
                      }
                  };
              }
              return player;
          });
          return { ...team, players: updatedPlayers };
      });
      
      updateTeams(updatedTeams);
      updateActiveTournament({ teams: updatedTeams });

      updateLiveMatch(null);
      setTvMode(false);
      setCurrentView('fixture'); // Redirect to fixture calendar
  };

  const handleQuickFinish = (fixtureId: string) => {
    if (!activeTournament || currentUser?.role !== 'ADMIN') return;
    
    // If it's the active live match, go through standard finish procedure to save detailed stats if possible
    if (liveMatch && liveMatch.matchId === fixtureId) {
        handleEndBroadcast();
        return;
    }

    // Force finish from list
    if (confirm("⚠️ Finalizar desde lista: Se marcará como terminado sin guardar estadísticas detalladas. ¿Continuar?")) {
        const updatedFixtures = activeTournament.fixtures?.map(f => 
            f.id === fixtureId ? { ...f, status: 'finished' as const } : f
        );
        updateActiveTournament({ fixtures: updatedFixtures });
    }
  };

  // ... (handlePoint, handleSubtractPoint, etc. - kept same)
  // ... (Other functions omitted for brevity as they are unchanged)
  
  const rotateTeam = (players: Player[]) => {
    const newRotation = [...players];
    const first = newRotation.shift();
    if (first) newRotation.push(first);
    return newRotation;
  };

  const handlePoint = (teamId: string, type: 'attack' | 'block' | 'ace' | 'opponent_error' | 'yellow_card' | 'red_card', playerId?: string) => {
    if (!liveMatch || !activeTournament) return;
    const fixture = activeTournament.fixtures?.find(f => f.id === liveMatch.matchId)!;
    const teamAId = fixture.teamAId;
    const isTeamAScoring = teamId === teamAId;

    updateLiveMatch(prev => {
      if (!prev) return null;
      if (prev.status === 'finished') return prev;

      let newScoreA = prev.scoreA;
      let newScoreB = prev.scoreB;
      let newRotationA = [...prev.rotationA];
      let newRotationB = [...prev.rotationB];
      let newServingTeam = prev.servingTeamId;
      let newStatus = prev.status;

      if (newStatus === 'warmup' || newStatus === 'paused') {
          newStatus = 'playing';
      }

      let pointAwarded = true;

      if (type === 'yellow_card') {
          pointAwarded = false;
      } else if (type === 'red_card') {
          if (teamId === teamAId) {
              newScoreB++;
              if (prev.servingTeamId !== fixture.teamBId) {
                  newRotationB = rotateTeam(prev.rotationB);
                  newServingTeam = fixture.teamBId;
              }
          } else {
              newScoreA++;
              if (prev.servingTeamId !== teamAId) {
                  newRotationA = rotateTeam(prev.rotationA);
                  newServingTeam = teamAId;
              }
          }
          pointAwarded = true; 
      } else {
          if (isTeamAScoring) {
            newScoreA++;
            if (prev.servingTeamId !== teamAId) {
              newRotationA = rotateTeam(prev.rotationA);
              newServingTeam = teamAId;
            }
          } else {
            newScoreB++;
            if (prev.servingTeamId !== fixture.teamBId) {
                newRotationB = rotateTeam(prev.rotationB);
                newServingTeam = fixture.teamBId;
            }
          }
      }

      const isTieBreak = prev.currentSet === prev.config.maxSets;
      const pointsToWin = isTieBreak ? prev.config.tieBreakPoints : prev.config.pointsPerSet;
      
      const setFinished = (newScoreA >= pointsToWin || newScoreB >= pointsToWin) && Math.abs(newScoreA - newScoreB) >= 2;
      
      let finishedSets = [...prev.sets];
      
      const setIndex = prev.currentSet - 1;
      const currentSetData = finishedSets[setIndex] || { scoreA: 0, scoreB: 0, history: [], durationMinutes: 0 };
      const currentHistory = currentSetData.history || [];

      finishedSets[setIndex] = {
          ...currentSetData, 
          scoreA: newScoreA, 
          scoreB: newScoreB,
          history: [...currentHistory, { teamId, playerId, type, scoreSnapshot: `${newScoreA}-${newScoreB}` }]
      };

      if (setFinished && pointAwarded) {
          const winsA = finishedSets.filter(s => s.scoreA > s.scoreB).length;
          const winsB = finishedSets.filter(s => s.scoreB > s.scoreA).length;
          const requiredWins = Math.ceil(prev.config.maxSets / 2);

          if (winsA === requiredWins || winsB === requiredWins) {
               return { 
                   ...prev, 
                   status: 'finished', 
                   scoreA: newScoreA, 
                   scoreB: newScoreB, 
                   sets: finishedSets, 
                   servingTeamId: newServingTeam, 
                   rotationA: newRotationA, 
                   rotationB: newRotationB 
                };
          } else {
            return {
                ...prev, 
                status: 'finished_set', 
                scoreA: newScoreA, 
                scoreB: newScoreB, 
                sets: finishedSets, 
                servingTeamId: newServingTeam, 
                rotationA: newRotationA, 
                rotationB: newRotationB, 
            };
          }
      }
      return { ...prev, status: newStatus, scoreA: newScoreA, scoreB: newScoreB, sets: finishedSets, servingTeamId: newServingTeam, rotationA: newRotationA, rotationB: newRotationB };
    });
  };

  const handleSubtractPoint = (teamId: string) => {
    if (!liveMatch || !activeTournament || !isAdmin) return;
    const fixture = activeTournament.fixtures?.find(f => f.id === liveMatch.matchId)!;
    const isTeamA = teamId === fixture.teamAId;

    updateLiveMatch(prev => {
        if (!prev) return null;
        let newScoreA = prev.scoreA;
        let newScoreB = prev.scoreB;
        
        if (isTeamA && newScoreA > 0) newScoreA--;
        else if (!isTeamA && newScoreB > 0) newScoreB--;
        else return prev; 

        let finishedSets = [...prev.sets];
        const setIndex = prev.currentSet - 1;
        const currentSetData = finishedSets[setIndex] || { scoreA: 0, scoreB: 0, history: [], durationMinutes: 0 };
        const currentHistory = [...(currentSetData.history || [])];

        if (currentHistory.length > 0) {
            currentHistory.pop();
        }

        finishedSets[setIndex] = {
            ...currentSetData, 
            scoreA: newScoreA, 
            scoreB: newScoreB,
            history: currentHistory
        };

        return { ...prev, status: 'playing', scoreA: newScoreA, scoreB: newScoreB, sets: finishedSets };
    });
  };

  const handleRequestTimeout = (teamId: string) => {
    if (!liveMatch) return;
    if (currentUser?.role === 'ADMIN') {
       updateLiveMatch(prev => {
           if (!prev) return null;
           const fixture = activeTournament?.fixtures?.find(f => f.id === prev.matchId);
           const isTeamA = teamId === fixture?.teamAId;
           return { ...prev, timeoutsA: isTeamA ? prev.timeoutsA + 1 : prev.timeoutsA, timeoutsB: !isTeamA ? prev.timeoutsB + 1 : prev.timeoutsB }
       });
       return;
    }
    const newReq: RequestItem = { id: Date.now().toString(), teamId, type: 'timeout', status: 'pending' };
    updateLiveMatch(prev => prev ? { ...prev, requests: [...prev.requests, newReq] } : null);
  };

  const initiateSubRequest = (teamId: string) => { setSubPlayerInNum(''); setSubPlayerOutNum(''); setShowSubModal({ teamId }); };
  
  const confirmSub = () => {
    if (!liveMatch || !showSubModal || !subPlayerOutNum || !subPlayerInNum || !activeTournament) return;
    const team = activeTournament.teams?.find(t => t.id === showSubModal.teamId);
    if (!team) return;
    const pOut = team.players.find(p => p.number === parseInt(subPlayerOutNum));
    const pIn = team.players.find(p => p.number === parseInt(subPlayerInNum));
    if (!pOut || !pIn) { alert("Jugadores no encontrados."); return; }
    
    if (currentUser?.role === 'ADMIN') { applySubstitution(showSubModal.teamId, pOut.id, pIn.id); setShowSubModal(null); return; }
    
    const newReq: RequestItem = { id: Date.now().toString(), teamId: showSubModal.teamId, type: 'substitution', status: 'pending', subDetails: { playerOutId: pOut.id, playerInId: pIn.id } };
    updateLiveMatch(prev => prev ? { ...prev, requests: [...prev.requests, newReq] } : null);
    setShowSubModal(null);
  };

  const applySubstitution = (teamId: string, pOutId: string, pInId: string) => {
      updateLiveMatch(prev => {
          if (!prev) return null;
          const fixture = activeTournament?.fixtures?.find(f => f.id === prev.matchId);
          const isTeamA = teamId === fixture?.teamAId;
          
          let rotation = isTeamA ? [...prev.rotationA] : [...prev.rotationB];
          let bench = isTeamA ? [...prev.benchA] : [...prev.benchB];
          
          const outIndex = rotation.findIndex(p => p.id === pOutId);
          const inIndex = bench.findIndex(p => p.id === pInId);
          
          const fullTeam = activeTournament?.teams?.find(t => t.id === teamId);
          const playerIn = inIndex !== -1 ? bench[inIndex] : fullTeam?.players.find(p => p.id === pInId);
          const playerOut = rotation[outIndex];

          if (outIndex === -1 || !playerIn) return prev; 
          
          rotation[outIndex] = playerIn;
          
          if (inIndex !== -1) {
              bench[inIndex] = playerOut; 
          } else {
              bench.push(playerOut);
          }

          return { 
              ...prev, 
              rotationA: isTeamA ? rotation : prev.rotationA, 
              rotationB: !isTeamA ? rotation : prev.rotationB, 
              benchA: isTeamA ? bench : prev.benchA, 
              benchB: !isTeamA ? bench : prev.benchB, 
              substitutionsA: isTeamA ? prev.substitutionsA + 1 : prev.substitutionsA, 
              substitutionsB: !isTeamA ? prev.substitutionsB + 1 : prev.substitutionsB 
          };
      });
  };

  const processRequest = (reqId: string, action: 'approve' | 'reject') => {
      updateLiveMatch(prev => {
          if (!prev) return null;
          const req = prev.requests.find(r => r.id === reqId);
          if (!req) return prev;
          if (action === 'approve') {
             if (req.type === 'timeout') {
                 const fixture = activeTournament?.fixtures?.find(f => f.id === prev.matchId);
                 const isTeamA = req.teamId === fixture?.teamAId;
                 return { ...prev, timeoutsA: isTeamA ? prev.timeoutsA + 1 : prev.timeoutsA, timeoutsB: !isTeamA ? prev.timeoutsB + 1 : prev.timeoutsB, requests: prev.requests.filter(r => r.id !== reqId) };
             } else if (req.type === 'substitution' && req.subDetails) { applySubstitution(req.teamId, req.subDetails.playerOutId, req.subDetails.playerInId); }
          }
          return { ...prev, requests: prev.requests.filter(r => r.id !== reqId) };
      });
  };

  const handleModifyRotation = (teamId: string) => {
      if(!liveMatch || !activeTournament) return;
      const fixture = activeTournament.fixtures?.find(f => f.id === liveMatch.matchId);
      const isTeamA = fixture?.teamAId === teamId;
      const rotation = isTeamA ? liveMatch.rotationA : liveMatch.rotationB;
      setRotationInput(rotation.map(p => p.number.toString()));
      setShowRotationModal({ teamId });
  };

  const confirmRotation = () => {
      if(!liveMatch || !showRotationModal || !activeTournament) return;
      const team = activeTournament.teams?.find(t => t.id === showRotationModal.teamId);
      if (!team) return;
      const newRotation: Player[] = [];
      const newBench: Player[] = [];
      rotationInput.forEach(numStr => {
          const num = parseInt(numStr);
          const player = team.players.find(p => p.number === num);
          if (player) newRotation.push(player); else newRotation.push(createEmptyPlayer(`${team.id}-temp-${num}`, num));
      });
      if (newRotation.length !== 6) { alert("Debes ingresar 6 números."); return; }
      team.players.forEach(p => { if (!newRotation.find(nr => nr.id === p.id)) newBench.push(p); });
      updateLiveMatch(prev => {
          if (!prev) return null;
          const fixture = activeTournament.fixtures?.find(f => f.id === prev.matchId);
          const isTeamA = fixture?.teamAId === showRotationModal.teamId;
          return { ...prev, rotationA: isTeamA ? newRotation : prev.rotationA, rotationB: !isTeamA ? newRotation : prev.rotationB, benchA: isTeamA ? newBench : prev.benchA, benchB: !isTeamA ? newBench : prev.benchB };
      });
      setShowRotationModal(null);
  };

  const getMatchStats = () => {
    if (!liveMatch || !activeTournament) return [];
    const allHistory = liveMatch.sets?.flatMap(s => s.history || []) || [];
    const statsMap: Record<string, {name: string, team: string, points: number, aces: number, blocks: number}> = {};
    allHistory.forEach(h => {
        if (h.playerId) {
            if (!statsMap[h.playerId]) {
                 let player: Player | undefined; let teamName = "Unknown";
                 activeTournament.teams?.forEach(t => { const f = t.players.find(p => p.id === h.playerId); if(f) { player = f; teamName = t.name; } });
                 if (player) statsMap[h.playerId] = { name: player.name, team: teamName, points: 0, aces: 0, blocks: 0 };
            }
            if (statsMap[h.playerId]) {
                if (h.type === 'attack') statsMap[h.playerId].points++;
                if (h.type === 'ace') { statsMap[h.playerId].points++; statsMap[h.playerId].aces++; }
                if (h.type === 'block') { statsMap[h.playerId].points++; statsMap[h.playerId].blocks++; }
            }
        }
    });
    return Object.values(statsMap).sort((a,b) => b.points - a.points);
  };

  // ... (MenuButton, HomeIcons, Logout - Kept same)
  const MenuButton = ({ title, icon, onClick, subtext }: { title: string, icon: React.ReactNode, onClick: () => void, subtext: string }) => (
      <button 
        onClick={onClick}
        className="relative group overflow-hidden bg-corp-panel border border-white/5 rounded-2xl p-6 hover:border-corp-accent/50 transition-all duration-300 hover:shadow-lg hover:shadow-corp-accent/10 flex flex-col items-start text-left h-full"
      >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500 text-5xl grayscale">
              {icon}
          </div>
          <div className="mb-4 p-3 bg-corp-bg rounded-lg text-corp-accent group-hover:bg-corp-accent group-hover:text-white transition-colors">
              {icon}
          </div>
          <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
          <p className="text-xs text-slate-400 font-medium">{subtext}</p>
      </button>
  );

  const HomeIcons = {
      Trophy: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
      Users: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
      Play: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
      Settings: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43.25a2 2 0 0 1-1 1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
      Chart: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
  };

  const handleLogout = () => {
    setLiveMatch(null);
    setCurrentUser(null);
    setTvMode(false);
  };

  // --- VIEWS ---

  if (!currentUser) {
      return (
          <>
            <Login 
                onLogin={setCurrentUser} 
                users={users} 
                isCloudConnected={isCloudConnected} 
                onOpenCloudConfig={() => setShowCloudConfig(true)}
            />
            {showCloudConfig && <CloudConfig onClose={() => setShowCloudConfig(false)} onConnected={() => setIsCloudConnected(true)} currentUser={currentUser} />}
          </>
      );
  }

  if (tvMode && liveMatch && activeTournament) {
      const fixture = activeTournament.fixtures?.find(f => f.id === liveMatch.matchId);
      const teamA = activeTournament.teams?.find(t => t.id === fixture?.teamAId);
      const teamB = activeTournament.teams?.find(t => t.id === fixture?.teamBId);
      
      // Ensure teams exist before rendering to avoid undefined errors
      if (teamA && teamB) {
          return <TVOverlay 
                    match={liveMatch} 
                    teamA={teamA} 
                    teamB={teamB} 
                    tournament={activeTournament} 
                    currentUser={currentUser} 
                    onExit={() => { setTvMode(false); setCurrentView('fixture'); }} 
                    onLogout={handleLogout}
                    onNextSet={handleStartNextSet} 
                    nextSetCountdown={nextSetCountdown} 
                    tournamentStats={getMatchStats()} 
                    isCloudConnected={isCloudConnected} 
                    onEndMatch={handleEndBroadcast}
                  />;
      }
      return <div className="fixed inset-0 bg-black text-white flex items-center justify-center">Error: Datos de equipo no encontrados.</div>;
  }

  return (
    <Layout 
        currentUser={currentUser} 
        onLogout={handleLogout} 
        onNavigate={setCurrentView} 
        currentView={currentView} 
        isCloudConnected={isCloudConnected} 
        onOpenCloudConfig={() => setShowCloudConfig(true)}
    >
      {showCloudConfig && <CloudConfig onClose={() => setShowCloudConfig(false)} onConnected={() => setIsCloudConnected(true)} currentUser={currentUser} />}

      {/* ... (Home, Lobby, Dashboard, Stats, Teams, Users views remain unchanged) ... */}
      {currentView === 'home' && (
          <div className="max-w-4xl mx-auto py-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="mb-8">
                  <h1 className="text-3xl font-bold text-white mb-2">Hola, {currentUser.username}</h1>
                  <p className="text-slate-400 text-sm">Bienvenido al panel de control.</p>
              </div>

              {activeTournament && (
                  <div className="mb-8 bg-gradient-to-r from-blue-900 to-corp-panel rounded-2xl p-6 border border-white/5 relative overflow-hidden shadow-2xl">
                      <div className="relative z-10">
                          <span className="text-xs font-bold text-blue-300 uppercase tracking-widest bg-blue-900/50 px-2 py-1 rounded">Torneo Activo</span>
                          <h2 className="text-2xl font-bold text-white mt-2 mb-4">{activeTournament.name}</h2>
                          <div className="flex gap-3">
                              <button onClick={() => setCurrentView('dashboard')} className="bg-white text-blue-900 px-5 py-2 rounded-lg font-bold text-sm hover:bg-blue-50 transition">Ver Dashboard</button>
                              {liveMatch && liveMatch.matchId && activeTournament.fixtures?.find(f => f.id === liveMatch.matchId) && (
                                 <button onClick={() => setCurrentView('match')} className="bg-red-500 text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-red-600 transition animate-pulse">🔴 Ir al Partido</button>
                              )}
                          </div>
                      </div>
                  </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <MenuButton title="Torneos" icon={HomeIcons.Trophy} subtext="Gestionar campeonatos y fixtures" onClick={() => setCurrentView('lobby')} />
                  <MenuButton title="Equipos" icon={HomeIcons.Users} subtext="Administrar planteles y jugadores" onClick={() => setCurrentView('teams')} />
                  {activeTournament && <MenuButton title="Fixture" icon={HomeIcons.Play} subtext="Calendario de partidos" onClick={() => setCurrentView('fixture')} />}
                  {activeTournament && <MenuButton title="Estadísticas" icon={HomeIcons.Chart} subtext="Tablas y Mejores Jugadores" onClick={() => setCurrentView('stats')} />}
                  {(currentUser.role === 'ADMIN' || currentUser.role.includes('COACH')) && <MenuButton title={currentUser.role === 'ADMIN' ? "Admin" : "Usuarios"} icon={HomeIcons.Settings} subtext="Gestión de usuarios y accesos" onClick={() => setCurrentView('users')} />}
              </div>
          </div>
      )}

      {/* ... Other Views ... */}
      {currentView === 'lobby' && (
         <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex justify-between items-center pb-4 border-b border-white/5">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Mis Torneos</h1>
                    <p className="text-slate-400 text-sm mt-1">Selecciona una competencia para gestionar</p>
                </div>
                {(currentUser.role === 'ADMIN') && (
                    <button onClick={() => setShowCreateTourneyModal(true)} className="bg-corp-accent hover:bg-corp-accent-hover text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg transition">+ Nuevo Torneo</button>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {tournaments.map(t => (
                   <div key={t.id} onClick={() => { setActiveTournamentId(t.id); setCurrentView('dashboard'); }} className="group relative bg-corp-panel border border-white/5 rounded-xl overflow-hidden cursor-pointer hover:border-corp-accent/50 hover:shadow-xl hover:shadow-corp-accent/10 transition-all duration-300">
                      <div className="h-32 bg-gradient-to-br from-slate-800 to-black flex items-center justify-center p-6 relative">
                          {t.logoUrl ? <img src={t.logoUrl} className="h-full object-contain filter drop-shadow-2xl" /> : <div className="text-5xl text-white/10">🏆</div>}
                      </div>
                      <div className="p-5">
                          <h3 className="font-bold text-lg text-white mb-2 group-hover:text-corp-accent transition-colors">{t.name}</h3>
                          <div className="flex justify-between items-center text-sm text-slate-400">
                              <span>{t.teams?.length || 0} Equipos</span>
                              <span className="bg-green-500/10 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Activo</span>
                          </div>
                      </div>
                   </div>
               ))}
               {tournaments.length === 0 && (
                   <div className="col-span-full text-center py-16 bg-corp-panel/50 border border-dashed border-slate-700 rounded-xl">
                       <p className="text-slate-500 font-medium">No hay torneos disponibles</p>
                   </div>
               )}
            </div>
         </div>
      )}

      {/* ... Dashboard, Stats, Teams, Users, Fixture views omitted for brevity (no changes there) ... */}
      
      {/* ... (Include previous View Implementations for dashboard, stats, teams, users, fixture here unchanged) ... */}
      {currentView === 'dashboard' && activeTournament && (
         <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
             <div className="bg-corp-panel border border-white/5 p-8 rounded-2xl shadow-xl relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    {activeTournament.logoUrl ? <img src={activeTournament.logoUrl} alt="Logo" className="h-32 w-32 object-contain drop-shadow-md bg-white/5 rounded-xl p-2