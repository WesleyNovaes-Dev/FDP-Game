import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { User, Users, Play, Crown, Trophy, Smile, Skull, Zap, MessageSquare, ArrowRight, Gavel, HelpCircle, LogOut, Copy, Shuffle, Database, Plus, Trash2, Edit, Save, X, Lock, Unlock, Eye, EyeOff, BookOpen, Instagram, Share2, ChevronDown, ChevronUp, Mic, AlertTriangle, Settings, Ban, Clock, Power } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set as firebaseSet, onValue, update, push, child, get, remove, onDisconnect, runTransaction, query, orderByChild, endAt } from "firebase/database";
import { getAnalytics } from "firebase/analytics";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyAwuXfyUehKXQ0vD5RigTQnT_q28_kNrEA",
  authDomain: "fdp-app-5e65e.firebaseapp.com",
  databaseURL: "https://fdp-app-5e65e-default-rtdb.firebaseio.com",
  projectId: "fdp-app-5e65e",
  storageBucket: "fdp-app-5e65e.firebasestorage.app",
  messagingSenderId: "229257494838",
  appId: "1:229257494838:web:ac75c677142084ec7ef397",
  measurementId: "G-590VPHT0MC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const analytics = getAnalytics(app);

const LOGO_URL = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRnjdQfi7Q6yhW0ZJW899odwnEOonDr0Qb8nQ&s";

// --- TYPES ---
type Player = {
  id: string;
  name: string;
  score: number;
  avatarId: number;
  isHost: boolean;
  hand?: string[]; // Cards are now stored in DB for persistence
  afkStrikes?: number;
};

type Deck = {
  id: string; 
  name: string;
  description?: string;
  password?: string;
  isSystem?: boolean;
  blackCards?: string[];
  whiteCards?: string[];
  selected?: boolean;
};

type GamePhase = 'LOBBY' | 'SUBMISSION' | 'JUDGING' | 'GUESSING' | 'RESULT' | 'GAME_OVER';

type PlayedCard = {
  id: string;
  playerId: string;
  cardText: string;
  isHidden: boolean;
  isRevealed?: boolean;
};

type GameConfig = {
    roundTimeout: number; // in seconds
    winCondition: 'INFINITE' | 'MAX_SCORE' | 'MAX_ROUNDS';
    winValue: number; // Score or Number of rounds
};

type GameState = {
  roomCode: string;
  originalHostId: string;
  players: Record<string, Player>;
  currentRound: number;
  judgeId: string;
  blackCard: string | null;
  blackCardRevealed?: boolean;
  phase: GamePhase;
  playedCards: Record<string, PlayedCard>;
  shuffledOrder?: string[];
  winningCardId: string | null;
  roundWinnerId: string | null;
  guessedPlayerId: string | null;
  actualPlayerId: string | null;
  selectedDeckIds?: string[];
  lastActive: number;
  maxHandSize: number;
  submissionDeadline?: number | null;
  config: GameConfig;
  gameWinnerId?: string | null;
  
  gameDeck: {
      blackCards: string[];
      whiteCards: string[];
  };
  discardPile: {
      blackCards: string[];
      whiteCards: string[];
  };
};

// --- UTILS ---
const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();
const generatePlayerId = () => 'user_' + Math.random().toString(36).substring(2, 9);
const shuffleArray = (array: any[]) => {
  if (!array) return [];
  // Filter out undefined or null values to prevent Firebase errors
  const newArr = array.filter(item => item !== undefined && item !== null);
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

// --- COMPONENTS ---

const Card = ({ 
  text, 
  type, 
  selected = false, 
  onClick, 
  hidden = false, 
  isWinner = false, 
  small = false
}: { 
  text: string, 
  type: 'BLACK' | 'WHITE', 
  selected?: boolean, 
  onClick?: () => void,
  hidden?: boolean,
  isWinner?: boolean,
  small?: boolean
}) => {
  const isBlack = type === 'BLACK';
  
  return (
    <div 
      onClick={onClick}
      className={`
        relative flex flex-col justify-between p-3 rounded-xl shadow-xl w-full cursor-pointer transition-all duration-300 select-none
        ${small ? 'aspect-auto h-32' : 'aspect-[3/4] max-w-[160px]'}
        ${hidden ? 'bg-gray-800 border-2 border-gray-700' : isBlack ? 'bg-black text-white border-2 border-gray-800' : 'bg-white text-black border-2 border-gray-200'}
        ${selected ? 'ring-4 ring-pink-500 transform -translate-y-4 shadow-2xl z-10' : 'hover:scale-105'}
        ${isWinner ? 'ring-4 ring-yellow-400 shadow-yellow-400/50' : ''}
      `}
    >
      {hidden ? (
        <div className="flex items-center justify-center h-full opacity-20">
          <Skull size={48} />
        </div>
      ) : (
        <>
          <div className={`font-bold leading-tight overflow-y-auto scrollbar-hide ${small ? 'text-sm' : 'text-lg'} ${isBlack ? 'text-white' : 'text-gray-900'}`}>
            {text}
          </div>
          {!small && (
            <div className="flex items-center gap-1 text-xs font-bold opacity-50 uppercase mt-4">
              {isBlack ? <Skull size={12}/> : <Smile size={12}/>}
              FDP
            </div>
          )}
        </>
      )}
    </div>
  );
};

const Avatar = ({ id, size = 'md' }: { id: number, size?: 'sm' | 'md' | 'lg' }) => {
  const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
  const safeId = Math.abs(id) % colors.length;
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'md' ? 'w-10 h-10 text-sm' : 'w-16 h-16 text-xl';
  
  return (
    <div className={`${sizeClass} rounded-full ${colors[safeId]} flex items-center justify-center font-bold text-white shadow-inner border-2 border-white/20 shrink-0`}>
      P{safeId + 1}
    </div>
  );
};

const Button = ({ children, onClick, variant = 'primary', disabled = false, fullWidth = false, className = '' }: any) => {
  const base = "px-6 py-3 rounded-xl font-bold transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-pink-600 hover:bg-pink-500 text-white shadow-pink-900/20",
    secondary: "bg-gray-700 hover:bg-gray-600 text-white shadow-gray-900/20",
    success: "bg-green-600 hover:bg-green-500 text-white shadow-green-900/20",
    danger: "bg-red-600 hover:bg-red-500 text-white",
    ghost: "bg-transparent hover:bg-gray-800 text-gray-300 border border-gray-600",
  };
  
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${base} ${variants[variant as keyof typeof variants]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  );
};

const TargetIcon = ({className, size}: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
);

const RulesModal = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 animate-fadeIn">
    <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 max-w-lg w-full max-h-[90vh] overflow-y-auto relative shadow-2xl">
      <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
        <X size={24} />
      </button>
      
      <div className="text-center mb-6">
        <h2 className="text-2xl font-black text-pink-500 uppercase tracking-wide">Como Jogar FDP</h2>
        <p className="text-xs text-gray-400 mt-1 uppercase">Regras & Pontuação</p>
      </div>

      <div className="space-y-6 text-sm text-gray-300">
        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
          <h3 className="font-bold text-white mb-2 flex items-center gap-2"><TargetIcon className="text-red-500" size={16}/> O Objetivo</h3>
          <p>Complete as frases das Cartas Pretas usando suas Cartas Brancas para criar a combinação mais engraçada, ofensiva ou bizarra possível.</p>
        </div>

        <div>
          <h3 className="font-bold text-white mb-2 border-b border-gray-700 pb-1">1. O Juiz da Rodada</h3>
          <p>A cada rodada, um jogador é o <strong>Juiz</strong>. Ele não joga carta branca, apenas lê a carta preta e julga os outros.</p>
        </div>

        <div>
          <h3 className="font-bold text-white mb-2 border-b border-gray-700 pb-1">2. As Respostas</h3>
          <p>Todos os outros jogadores escolhem uma carta de sua mão. As cartas são embaralhadas e mostradas anonimamente.</p>
        </div>

        <div>
          <h3 className="font-bold text-white mb-2 border-b border-gray-700 pb-1">3. O Julgamento</h3>
          <p>O Juiz escolhe a carta que mais gostou. Essa carta vence a rodada!</p>
        </div>

        <div className="bg-pink-900/20 p-4 rounded-xl border border-pink-500/30">
          <h3 className="font-bold text-pink-400 mb-2 flex items-center gap-2"><Zap size={16}/> A Reviravolta (Pontuação)</h3>
          <p className="mb-2">Após escolher a vencedora, o Juiz deve tentar <strong>adivinhar quem jogou a carta</strong>!</p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold">● Acertou:</span> 
              <span>5 Pontos para o Juiz + 5 Pontos para o Dono da Carta. (Divisão justa!)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 font-bold">● Errou:</span> 
              <span>10 Pontos inteiros para o Dono da Carta. (O Juiz se deu mal!)</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6">
        <Button fullWidth onClick={onClose} variant="primary">Entendi, bora jogar!</Button>
      </div>
    </div>
  </div>
);

// --- MAIN APP COMPONENT ---

const App = () => {
  // Local User State
  const [user, setUser] = useState<{ name: string, id: string, avatarId: number } | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [appMode, setAppMode] = useState<'MENU' | 'DECK_EDITOR'>('MENU');
  
  // Synced Game State
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [availableDecks, setAvailableDecks] = useState<Deck[]>([]);
  // selectedDeckIds is now part of GameState, removed local state
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [resultCountdown, setResultCountdown] = useState<number | null>(null);

  // Deck Editor State
  const [editingDeck, setEditingDeck] = useState<Partial<Deck> | null>(null);
  const [deckPasswordInput, setDeckPasswordInput] = useState("");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState<{deckId: string, action: 'EDIT' | 'DELETE'} | null>(null);
  const [minimizeBlack, setMinimizeBlack] = useState(false);
  const [minimizeWhite, setMinimizeWhite] = useState(false);
  
  // Input Control States
  const [newBlackCardText, setNewBlackCardText] = useState("");
  const [newWhiteCardText, setNewWhiteCardText] = useState("");

  // UI State
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [showScoreBoard, setShowScoreBoard] = useState(false);
  
  // Judge Interaction State
  const [confirmWinnerCandidate, setConfirmWinnerCandidate] = useState<PlayedCard | null>(null);

  // Ref to track auto-selection
  const hasAutoSelectedDecks = useRef(false);

  // --- CLEANUP LOGIC ---
  const cleanupInactiveRooms = async () => {
    try {
        const inactiveThreshold = Date.now() - (30 * 60 * 1000); // 30 minutes
        const roomsRef = ref(db, 'rooms');
        
        // Use fetching all rooms and filtering client-side to avoid "Index not defined" error
        const snapshot = await get(roomsRef);
        
        if (snapshot.exists()) {
            const updates: Record<string, null> = {};
            snapshot.forEach((childSnapshot) => {
                const roomData = childSnapshot.val();
                if (roomData.lastActive && roomData.lastActive < inactiveThreshold) {
                    // This deletes the ROOM. Since Players are children of the Room,
                    // ALL player data (hand, score, session) linked to this room is automatically deleted.
                    updates[childSnapshot.key as string] = null;
                }
            });
            
            if (Object.keys(updates).length > 0) {
                console.log(`Cleaning up ${Object.keys(updates).length} inactive rooms...`);
                await update(roomsRef, updates);
            }
        }
    } catch (err) {
        console.error("Cleanup failed:", err);
    }
  };

  const touchRoom = async (code: string) => {
      if (!code) return;
      update(ref(db, `rooms/${code}`), {
          lastActive: Date.now()
      }).catch(e => console.error("Error touching room", e));
  };

  // Initial Check & Cleanup
  useEffect(() => {
    const initializeAppSession = async () => {
      // 1. Restore User Identity (Local)
      const savedId = localStorage.getItem('fdp_player_id');
      const savedName = localStorage.getItem('fdp_player_name');
      
      if (savedId && savedName) {
        setUser({ 
          id: savedId, 
          name: savedName, 
          avatarId: Math.floor(Math.random() * 10) 
        });
        
        // 2. Restore Session (Auto-Reconnect)
        const savedRoom = localStorage.getItem('fdp_room_code');
        if (savedRoom) {
            console.log("Found saved session for room:", savedRoom);
            // Verify if room still exists in DB
            try {
               const roomSnapshot = await get(ref(db, `rooms/${savedRoom}`));
               if (roomSnapshot.exists()) {
                   setRoomCode(savedRoom);
                   // The onValue listener below will pick up the state
               } else {
                   console.log("Saved room no longer exists. Clearing session.");
                   localStorage.removeItem('fdp_room_code');
                   setRoomCode("");
               }
            } catch (e) {
                console.error("Error verifying session", e);
            }
        }
      }
      
      // 3. Run Global Cleanup (Remove dead rooms/users)
      await cleanupInactiveRooms();
      setInitializing(false);
    };

    initializeAppSession();

    const decksRef = ref(db, 'decks');
    const unsubscribeDecks = onValue(decksRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val() as Record<string, any>;
        const deckList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setAvailableDecks(deckList);
      } else {
          setAvailableDecks([]);
      }
    });

    return () => unsubscribeDecks();
  }, []);

  // Prevent refresh/close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (user || gameState) {
        e.preventDefault();
        e.returnValue = ''; 
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user, gameState]);

  // AUTO SELECT FIRST DECK (PERSISTED)
  useEffect(() => {
    if (availableDecks.length > 0 && !hasAutoSelectedDecks.current && gameState && user && gameState.players[user.id]?.isHost) {
        // Only if DB is empty
        if (!gameState.selectedDeckIds || gameState.selectedDeckIds.length === 0) {
             update(ref(db, `rooms/${gameState.roomCode}`), {
                 selectedDeckIds: [availableDecks[0].id]
             });
        }
        hasAutoSelectedDecks.current = true;
    }
  }, [availableDecks, gameState, user]);

  // --- TIMER EFFECTS ---
  
  // Submission Timer
  useEffect(() => {
      if (gameState && gameState.phase === 'SUBMISSION' && gameState.submissionDeadline) {
          const interval = setInterval(() => {
              const diff = gameState.submissionDeadline! - Date.now();
              if (diff > 0) {
                  setTimeLeft(Math.floor(diff / 1000));
              } else {
                  setTimeLeft(0);
                  // Only HOST triggers the timeout logic to avoid race conditions
                  if (user && gameState.players[user.id]?.isHost) {
                      handleRoundTimeout();
                  }
                  clearInterval(interval);
              }
          }, 1000);
          return () => clearInterval(interval);
      } else {
          setTimeLeft(null);
      }
  }, [gameState?.phase, gameState?.submissionDeadline, user?.id]);

  // Result Auto-Next Round Timer
  useEffect(() => {
    if (gameState && gameState.phase === 'RESULT') {
        // Visual countdown for everyone
        let remaining = 5;
        setResultCountdown(remaining);
        const countdownInterval = setInterval(() => {
            remaining -= 1;
            setResultCountdown(Math.max(0, remaining));
            if (remaining <= 0) clearInterval(countdownInterval);
        }, 1000);

        // Logic triggering (Host only)
        if (user && gameState.players[user.id]?.isHost) {
            const nextRoundTimer = setTimeout(() => {
                 startNewRound(false);
            }, 5000);
            return () => {
                clearTimeout(nextRoundTimer);
                clearInterval(countdownInterval);
            };
        }
        return () => clearInterval(countdownInterval);
    } else {
        setResultCountdown(null);
    }
  }, [gameState?.phase, user?.id]);


  useEffect(() => {
    if (gameState && gameState.phase === 'SUBMISSION' && user && gameState.judgeId === user.id) {
       if (!gameState.blackCardRevealed) {
           const timer = setTimeout(() => {
               if (gameState.roomCode) {
                   update(ref(db, `rooms/${gameState.roomCode}`), { blackCardRevealed: true });
               }
           }, 5000);
           return () => clearTimeout(timer);
       }
    }
  }, [gameState?.phase, gameState?.judgeId, gameState?.blackCardRevealed, gameState?.roomCode, user?.id]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleShareRoom = async () => {
    if (!gameState) return;
    const shareText = `Bora jogar FDP - Kana Sutra!\nCódigo da sala: ${gameState.roomCode}\n`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'FDP - Kana Sutra',
          text: shareText,
        });
      } catch (err) {
        console.log('Compartilhamento cancelado');
      }
    } else {
      navigator.clipboard.writeText(shareText);
      showNotification("Convite copiado para a área de transferência!");
    }
  };

  const handleLogin = (name: string) => {
    if(name) {
       const id = generatePlayerId();
       localStorage.setItem('fdp_player_id', id);
       localStorage.setItem('fdp_player_name', name);
       setUser({ name: name, id, avatarId: Math.floor(Math.random() * 10) });
    }
  };

  // --- GAME LOGIC: DECK MANAGEMENT ---

  // Refill Hand directly to Firebase
  const refillPlayerHand = async (amount: number) => {
      if(!roomCode || !user) return;
      
      const roomRef = ref(db, `rooms/${roomCode}`);
      await runTransaction(roomRef, (room) => {
          if (!room) return room;
          
          if (!room.gameDeck) room.gameDeck = { whiteCards: [], blackCards: [] };
          if (!room.gameDeck.whiteCards) room.gameDeck.whiteCards = [];
          
          if (!room.discardPile) room.discardPile = { whiteCards: [], blackCards: [] };
          if (!room.discardPile.whiteCards) room.discardPile.whiteCards = [];

          let deck = room.gameDeck.whiteCards;
          let discard = room.discardPile.whiteCards;

          // Deck Cycling
          if (deck.length < amount && discard.length > 0) {
              const shuffledDiscard = shuffleArray(discard);
              // CRITICAL FIX: Append shuffled discard to the BEGINNING (bottom) of the deck
              // Since pop() takes from the end, we want to exhaust the current deck first.
              deck = [...shuffledDiscard, ...deck];
              room.discardPile.whiteCards = [];
          }

          const actualAmount = Math.min(amount, deck.length);
          const drawn = [];
          
          // Draw cards safely
          const currentHand = room.players[user.id].hand || [];
          
          for(let i=0; i<actualAmount; i++) {
              const card = deck.pop();
              // Validate to ensure we don't accidentally give a duplicate if sync is off and card is defined
              if (card && !currentHand.includes(card)) {
                  drawn.push(card);
              }
          }
          
          // Persistence: Add to player's hand in DB
          room.players[user.id].hand = [...currentHand, ...drawn];
          
          room.gameDeck.whiteCards = deck; 
          return room;
      });
  };

  useEffect(() => {
    if (!roomCode) return;

    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // --- KICK CHECK (User removed from players list) ---
        if (user && !data.players[user.id]) {
            setGameState(null);
            setRoomCode("");
            localStorage.removeItem('fdp_room_code'); // Clear session
            showNotification("Você foi removido da sala pelo anfitrião.");
            return;
        }
        
        // --- HOST RECOVERY CHECK ---
        if (user && data.originalHostId === user.id && data.players[user.id] && !data.players[user.id].isHost) {
            update(ref(db, `rooms/${roomCode}/players/${user.id}`), { isHost: true });
        }

        setGameState(data);
      } else {
        setGameState(null);
        if (roomCode) {
             // Room was likely deleted by cleanup or host
             localStorage.removeItem('fdp_room_code'); 
             setRoomCode("");
             showNotification("A sala foi encerrada.");
        }
      }
    });

    return () => unsubscribe();
  }, [roomCode, user]);

  useEffect(() => {
      if (gameState && gameState.phase === 'SUBMISSION' && user) {
          const currentHand = gameState.players[user.id]?.hand || [];
          const currentHandSize = currentHand.length;
          const maxHandSize = gameState.maxHandSize || 10;
          const needed = maxHandSize - currentHandSize;
          
          if (needed > 0) {
              const timer = setTimeout(() => {
                 refillPlayerHand(needed);
              }, Math.random() * 1000 + 500); 
              return () => clearTimeout(timer);
          }
      }
  }, [gameState?.phase, gameState?.players?.[user?.id || '']?.hand?.length, gameState?.maxHandSize]);

  // --- ACTIONS ---

  const joinGame = async (code: string) => {
    if (!user || !code) return;
    setLoading(true);
    const codeUpper = code.toUpperCase();
    
    const roomRef = ref(db, `rooms/${codeUpper}`);
    const snapshot = await get(roomRef);

    if (snapshot.exists()) {
      const gameData = snapshot.val();
      
      const existingPlayer = gameData.players && gameData.players[user.id];
      const isOriginalHost = gameData.originalHostId === user.id;

      // Persistence: If reconnecting, preserve existing properties (like hand, score)
      const playerUpdate: Player = existingPlayer ? {
          ...existingPlayer,
          name: user.name, 
          isHost: isOriginalHost,
          // Hand is preserved here
      } : {
        id: user.id,
        name: user.name,
        score: 0,
        avatarId: user.avatarId,
        isHost: isOriginalHost,
        afkStrikes: 0,
        hand: []
      };
      
      await update(roomRef, {
        [`players/${user.id}`]: playerUpdate,
        lastActive: Date.now()
      });

      setRoomCode(codeUpper);
      localStorage.setItem('fdp_room_code', codeUpper); // Persist Session
    } else {
      showNotification("Sala não encontrada!");
    }
    setLoading(false);
  };

  const createGame = async () => {
    if (!user) return;
    setLoading(true);
    const newCode = generateRoomCode();
    
    const initialPlayer: Player = {
      id: user.id,
      name: user.name,
      score: 0,
      avatarId: user.avatarId,
      isHost: true,
      afkStrikes: 0,
      hand: []
    };

    const initialState: GameState = {
      roomCode: newCode,
      originalHostId: user.id, 
      players: { [user.id]: initialPlayer },
      currentRound: 0,
      judgeId: user.id,
      blackCard: null,
      phase: 'LOBBY',
      playedCards: {} as Record<string, PlayedCard>,
      winningCardId: null,
      roundWinnerId: null,
      guessedPlayerId: null,
      actualPlayerId: null,
      selectedDeckIds: [],
      blackCardRevealed: false,
      lastActive: Date.now(), 
      maxHandSize: 10,
      gameDeck: { blackCards: [], whiteCards: [] },
      discardPile: { blackCards: [], whiteCards: [] },
      config: {
          roundTimeout: 60,
          winCondition: 'INFINITE',
          winValue: 10
      }
    };

    await firebaseSet(ref(db, `rooms/${newCode}`), initialState);
    
    setRoomCode(newCode);
    localStorage.setItem('fdp_room_code', newCode); // Persist Session
    setLoading(false);
  };

  const kickPlayer = async (targetId: string) => {
      if (!gameState || !user || !gameState.players[user.id].isHost) return;
      if (targetId === user.id) return; 

      const roomRef = ref(db, `rooms/${gameState.roomCode}`);
      
      await runTransaction(roomRef, (room) => {
          if (!room || !room.players) return room;
          
          delete room.players[targetId];

          if (room.phase !== 'LOBBY') {
              if (room.judgeId === targetId) {
                  const remainingIds = Object.keys(room.players);
                  if (remainingIds.length > 0) {
                      room.judgeId = room.originalHostId && room.players[room.originalHostId] ? room.originalHostId : remainingIds[0];
                  } else {
                      room.phase = 'LOBBY';
                  }
              }
              
              if (room.playedCards) {
                  Object.keys(room.playedCards).forEach(key => {
                      if (room.playedCards[key].playerId === targetId) {
                          delete room.playedCards[key];
                      }
                  });
              }
          }

          room.lastActive = Date.now();
          return room;
      });
      
      showNotification("Jogador removido da sala!");
  };

  const startGame = async () => {
    if (!gameState || !user || !gameState.players[user.id].isHost) return;
    
    const idsToLoad = gameState.selectedDeckIds || [];
    if (idsToLoad.length === 0) {
        showNotification("Selecione pelo menos um baralho!");
        return;
    }
    
    setLoading(true);

    let allBlackCards: string[] = [];
    let allWhiteCards: string[] = [];
    
    for (const deckId of idsToLoad) {
        const deckData = availableDecks.find((d: Deck) => d.id === deckId);
        if (deckData) {
            // Trim text to avoid duplicates like "Batata" and "Batata "
            if(deckData.blackCards) allBlackCards = [...allBlackCards, ...deckData.blackCards.filter((c:any) => c).map((t: string) => t.trim())];
            if(deckData.whiteCards) allWhiteCards = [...allWhiteCards, ...deckData.whiteCards.filter((c:any) => c).map((t: string) => t.trim())];
        }
    }
    
    // DEDUPLICATE CARDS (Ensure unique text)
    const uniqueBlackCards = [...new Set(allBlackCards)].filter(Boolean);
    const uniqueWhiteCards = [...new Set(allWhiteCards)].filter(Boolean);

    const shuffledBlack = shuffleArray(uniqueBlackCards);
    const shuffledWhite = shuffleArray(uniqueWhiteCards);
    
    const updates: any = {
        gameDeck: {
            blackCards: shuffledBlack,
            whiteCards: shuffledWhite
        },
        discardPile: {
            blackCards: [],
            whiteCards: []
        },
        selectedDeckIds: idsToLoad,
        lastActive: Date.now(),
        // Reset scores
        currentRound: 0,
        gameWinnerId: null
    };
    
    // CRITICAL: Clear all players' hands to prevent duplicates from previous games
    Object.keys(gameState.players).forEach(pid => {
        updates[`players/${pid}/hand`] = [];
        updates[`players/${pid}/score`] = 0;
    });

    await update(ref(db, `rooms/${roomCode}`), updates);
    
    setLoading(false);
    startNewRound(true);
  };

  // --- ROUND TIMEOUT & AFK LOGIC ---
  const handleRoundTimeout = async () => {
      if (!gameState || !roomCode) return;
      
      await runTransaction(ref(db, `rooms/${roomCode}`), (room) => {
          if (!room || !room.players) return room;
          
          const players = room.players;
          const playedPlayerIds = new Set(
              room.playedCards ? Object.values(room.playedCards).map((c: any) => c.playerId) : []
          );
          
          // Check AFK
          const playersToRemove: string[] = [];
          Object.keys(players).forEach(pid => {
              if (pid === room.judgeId) return;

              if (!playedPlayerIds.has(pid)) {
                  players[pid].afkStrikes = (players[pid].afkStrikes || 0) + 1;
                  if (players[pid].afkStrikes >= 3) {
                      playersToRemove.push(pid);
                  }
              } else {
                  players[pid].afkStrikes = 0; 
              }
          });

          // Kick AFK Players
          playersToRemove.forEach(pid => {
              const wasHost = players[pid].isHost;
              delete players[pid];
              
              if (wasHost) {
                  const remainingIds = Object.keys(players);
                  if (remainingIds.length > 0) {
                      players[remainingIds[0]].isHost = true;
                      room.originalHostId = remainingIds[0];
                  }
              }
          });

          const playedCount = room.playedCards ? Object.keys(room.playedCards).length : 0;
          
          if (playedCount > 0) {
              const cardIds = Object.keys(room.playedCards || {});
              const shuffled = shuffleArray(cardIds);
              room.phase = 'JUDGING';
              room.shuffledOrder = shuffled;
              room.submissionDeadline = null; 
          } else {
              const playersList = Object.values(room.players || []) as any[];
              if (playersList.length > 0) {
                  const currentJudgeIdx = playersList.findIndex((p:any) => p.id === room.judgeId);
                  const nextJudgeIdx = (currentJudgeIdx + 1) % playersList.length;
                  room.judgeId = playersList[nextJudgeIdx].id;
              }

               if (room.blackCard) {
                  if (!room.discardPile) room.discardPile = {};
                  if (!room.discardPile.blackCards) room.discardPile.blackCards = [];
                  room.discardPile.blackCards.push(room.blackCard);
              }
              
              if (!room.gameDeck) room.gameDeck = { blackCards: [], whiteCards: [] };
              if (!room.gameDeck.blackCards) room.gameDeck.blackCards = [];
              if (room.gameDeck.blackCards.length === 0 && room.discardPile?.blackCards?.length > 0) {
                  const cleanDiscard = room.discardPile.blackCards.filter((c:any) => c);
                  room.gameDeck.blackCards = shuffleArray(cleanDiscard);
                  room.discardPile.blackCards = [];
              }
              
              const nextCard = room.gameDeck.blackCards.length > 0 ? room.gameDeck.blackCards.pop() : null;
              room.blackCard = nextCard || "Sem cartas pretas!";

              room.currentRound = (room.currentRound || 0) + 1;
              room.phase = 'SUBMISSION';
              room.playedCards = {};
              room.winningCardId = null;
              room.roundWinnerId = null;
              room.guessedPlayerId = null;
              room.actualPlayerId = null;
              room.shuffledOrder = null;
              room.blackCardRevealed = false;
              // Use configured timeout
              const timeoutSecs = room.config?.roundTimeout || 60;
              room.submissionDeadline = Date.now() + (timeoutSecs * 1000); 
          }

          room.lastActive = Date.now();
          return room;
      });
  };

  const startNewRound = async (isFirst = false) => {
    if (!gameState || !roomCode) return;

    const playersList = Object.values(gameState.players || {}) as Player[];
    if (playersList.length < 2) {
      showNotification("Precisa de pelo menos 2 jogadores!");
      return;
    }

    // CHECK WIN CONDITION
    if (!isFirst && gameState.config) {
        let gameOver = false;
        let winnerId = null;
        
        // 1. Max Rounds
        if (gameState.config.winCondition === 'MAX_ROUNDS') {
            if (gameState.currentRound >= gameState.config.winValue) {
                // Determine winner by score
                const sorted = [...playersList].sort((a,b) => b.score - a.score);
                winnerId = sorted[0].id;
                gameOver = true;
            }
        }
        // 2. Max Score
        else if (gameState.config.winCondition === 'MAX_SCORE') {
            const winner = playersList.find(p => p.score >= gameState.config.winValue);
            if (winner) {
                winnerId = winner.id;
                gameOver = true;
            }
        }

        if (gameOver) {
            await update(ref(db, `rooms/${roomCode}`), {
                phase: 'GAME_OVER',
                gameWinnerId: winnerId,
                lastActive: Date.now()
            });
            return;
        }
    }

    let nextJudgeId = gameState.judgeId;

    if (!isFirst) {
      const currentJudgeIdx = playersList.findIndex(p => p.id === gameState.judgeId);
      const nextJudgeIdx = (currentJudgeIdx + 1) % playersList.length;
      nextJudgeId = playersList[nextJudgeIdx].id;
    } 

    await runTransaction(ref(db, `rooms/${roomCode}`), (room) => {
        if (!room) return room;
        
        if (!room.gameDeck) room.gameDeck = { blackCards: [], whiteCards: [] };
        if (!room.discardPile) room.discardPile = { blackCards: [], whiteCards: [] };
        if (!room.discardPile.blackCards) room.discardPile.blackCards = [];
        if (!room.discardPile.whiteCards) room.discardPile.whiteCards = [];
        if (!room.gameDeck.blackCards) room.gameDeck.blackCards = [];

        if (room.blackCard) {
            room.discardPile.blackCards.push(room.blackCard);
        }

        if (room.playedCards) {
             const usedWhiteCards = Object.values(room.playedCards).map((c: any) => c.cardText);
             room.discardPile.whiteCards.push(...usedWhiteCards);
        }

        if (room.gameDeck.blackCards.length === 0) {
            if (room.discardPile.blackCards.length > 0) {
                const cleanDiscard = room.discardPile.blackCards.filter((c:any) => c);
                room.gameDeck.blackCards = shuffleArray(cleanDiscard);
                room.discardPile.blackCards = [];
            }
        }
        
        let nextCard = null;
        if (room.gameDeck.blackCards.length > 0) {
            nextCard = room.gameDeck.blackCards.pop();
        }

        room.blackCard = nextCard || null;
        room.blackCardRevealed = false; 
        
        room.currentRound = (room.currentRound || 0) + 1;
        room.judgeId = nextJudgeId;
        room.phase = 'SUBMISSION';
        room.playedCards = {};
        room.winningCardId = null;
        room.roundWinnerId = null;
        room.guessedPlayerId = null;
        room.actualPlayerId = null;
        room.shuffledOrder = null;
        room.lastActive = Date.now(); 
        
        const timeoutSecs = room.config?.roundTimeout || 60;
        room.submissionDeadline = Date.now() + (timeoutSecs * 1000);
        
        return room;
    });
  };

  const playCard = async (cardText: string) => {
    if (!user || !gameState || !roomCode) return;
    
    const hasPlayed = gameState.playedCards && Object.values(gameState.playedCards).some((c: PlayedCard) => c.playerId === user.id);
    if (hasPlayed) {
        showNotification("Você já enviou uma carta nesta rodada!");
        return;
    }

    // UPDATE: Remove card from DB using transaction to avoid race conditions
    await runTransaction(ref(db, `rooms/${roomCode}`), (room) => {
        if (!room || !room.players || !room.players[user.id]) return room;
        
        // Remove from hand
        const hand = room.players[user.id].hand || [];
        const cardIndex = hand.indexOf(cardText);
        if (cardIndex > -1) {
            hand.splice(cardIndex, 1);
            room.players[user.id].hand = hand;
        }

        // Add to played cards
        if (!room.playedCards) room.playedCards = {};
        const cardId = `card_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
        room.playedCards[cardId] = {
            id: cardId,
            playerId: user.id,
            cardText: cardText,
            isHidden: true,
            isRevealed: false
        };

        room.lastActive = Date.now();
        return room;
    });

    setSelectedCardIndex(null);
  };
  
  useEffect(() => {
    if (gameState && gameState.phase === 'SUBMISSION' && user && gameState.judgeId === user.id) {
       const playersCount = Object.keys(gameState.players).length;
       const playedCount = gameState.playedCards ? Object.keys(gameState.playedCards).length : 0;
       
       if (playersCount > 1 && playedCount === playersCount - 1) {
         const cardIds = Object.keys(gameState.playedCards || {});
         const shuffled = shuffleArray(cardIds);
         
         setTimeout(() => {
            update(ref(db, `rooms/${gameState.roomCode}`), { 
                phase: 'JUDGING',
                shuffledOrder: shuffled,
                lastActive: Date.now(),
                submissionDeadline: null 
            });
         }, 1000);
       }
    }
  }, [gameState?.playedCards, gameState?.phase]);

  const judgeSelectWinner = async (card: PlayedCard) => {
    if (!gameState || !roomCode) return;
    setConfirmWinnerCandidate(null);
    
    await update(ref(db, `rooms/${roomCode}`), {
      winningCardId: card.id,
      actualPlayerId: card.playerId,
      phase: 'GUESSING',
      lastActive: Date.now()
    });
  };

  const revealCard = async (cardId: string) => {
      if (!roomCode) return;
      await update(ref(db, `rooms/${roomCode}/playedCards/${cardId}`), {
          isRevealed: true
      });
      touchRoom(roomCode);
  };

  const judgeGuessPlayer = async (guessedId: string) => {
    if (!gameState || !roomCode) return;
    
    const isCorrect = guessedId === gameState.actualPlayerId;
    const updates: any = {};
    
    const players = gameState.players;
    
    Object.keys(players).forEach(pid => {
       const p = players[pid];
       let newScore = p.score;
       
       if (isCorrect) {
         if (pid === gameState.judgeId) newScore += 5;
         if (pid === gameState.actualPlayerId) newScore += 5;
       } else {
         if (pid === gameState.actualPlayerId) newScore += 10;
       }
       
       if (newScore !== p.score) {
         updates[`players/${pid}/score`] = newScore;
       }
    });

    updates['guessedPlayerId'] = guessedId;
    updates['roundWinnerId'] = gameState.actualPlayerId;
    updates['phase'] = 'RESULT';
    updates['lastActive'] = Date.now();

    await update(ref(db, `rooms/${roomCode}`), updates);
  };

  const leaveRoom = async () => {
     if (!gameState || !user || !roomCode) return;

     // Remove self from DB
     const roomRef = ref(db, `rooms/${roomCode}`);
     await runTransaction(roomRef, (room) => {
        if (!room || !room.players) return room;
        
        delete room.players[user.id];
        
        // Pass Host Logic
        if (room.originalHostId === user.id) {
             const remainingIds = Object.keys(room.players);
             if (remainingIds.length > 0) {
                 room.players[remainingIds[0]].isHost = true;
                 room.originalHostId = remainingIds[0];
                 // Also ensure judge is valid
                 if (room.judgeId === user.id) {
                     room.judgeId = remainingIds[0];
                 }
             } else {
                 // Empty room, might be cleaned up later or we can return null to delete
                 // returning null here deletes the room immediately
                 return null;
             }
        } else {
             // If judge left
             if (room.judgeId === user.id) {
                 const remainingIds = Object.keys(room.players);
                 if (remainingIds.length > 0) {
                     room.judgeId = room.originalHostId && room.players[room.originalHostId] ? room.originalHostId : remainingIds[0];
                 }
             }
        }
        
        return room;
     });

     localStorage.removeItem('fdp_room_code');
     setRoomCode("");
     setGameState(null);
  };

  const destroyRoom = async () => {
      if (!roomCode || !user || !gameState?.players[user.id]?.isHost) return;
      
      if(confirm("Tem certeza? Isso encerrará o jogo para todos.")) {
          await remove(ref(db, `rooms/${roomCode}`));
          localStorage.removeItem('fdp_room_code');
          setRoomCode("");
          setGameState(null);
      }
  };

  const toggleDeck = (deckId: string) => {
      if (!gameState || !user || !gameState.players[user.id].isHost) return;

      const currentIds = gameState.selectedDeckIds || [];
      let newIds: string[];
      
      if (currentIds.includes(deckId)) {
          newIds = currentIds.filter(id => id !== deckId);
      } else {
          newIds = [...currentIds, deckId];
      }
      
      update(ref(db, `rooms/${gameState.roomCode}`), {
          selectedDeckIds: newIds
      });
  };

  const updateConfig = (key: keyof GameConfig, value: any) => {
      if (!gameState || !user || !gameState.players[user.id].isHost) return;
      update(ref(db, `rooms/${gameState.roomCode}/config`), {
          [key]: value
      });
  };

  const changeMaxHandSize = (size: number) => {
      if (!gameState || !user || !gameState.players[user.id].isHost) return;
      update(ref(db, `rooms/${gameState.roomCode}`), {
          maxHandSize: size
      });
  };

  // --- DECK EDITOR FUNCTIONS ---
  
  const handleStartCreateDeck = () => {
      setEditingDeck({ name: "", description: "", blackCards: [], whiteCards: [] });
  };

  const handleCheckPassword = (deckId: string, action: 'EDIT' | 'DELETE') => {
      const deck = availableDecks.find(d => d.id === deckId);
      if (!deck) return;

      if (deck.password && deck.password.trim() !== "") {
          setShowPasswordPrompt({ deckId, action });
          setDeckPasswordInput("");
      } else {
          if (action === 'EDIT') {
              setEditingDeck({ ...deck });
          } else {
              if (window.confirm("Tem certeza que deseja excluir este baralho?")) {
                  const deckRef = ref(db, `decks/${deckId}`);
                  remove(deckRef).then(() => {
                      showNotification("Baralho excluído!");
                  }).catch((err: any) => {
                      console.error(err);
                      showNotification("Erro ao excluir.");
                  });
              }
          }
      }
  };

  const submitPassword = () => {
      if (!showPasswordPrompt) return;
      const { deckId, action } = showPasswordPrompt;
      const deck = availableDecks.find(d => d.id === deckId);
      
      if (!deck) {
          setShowPasswordPrompt(null);
          return;
      }

      if (deck.password === deckPasswordInput) {
           if (action === 'EDIT') {
              setEditingDeck({ ...deck });
          } else {
              const deckRef = ref(db, `decks/${deckId}`);
              remove(deckRef).then(() => {
                  showNotification("Baralho excluído!");
              }).catch((err: any) => {
                   console.error(err);
                   showNotification("Erro ao excluir.");
              });
          }
          setShowPasswordPrompt(null);
          setDeckPasswordInput("");
      } else {
          showNotification("Senha incorreta!");
      }
  };

  const handleSaveDeck = async () => {
      if (!editingDeck || !editingDeck.name) {
          showNotification("Nome é obrigatório!");
          return;
      }

      const deckId = editingDeck.id || `deck_${Date.now()}`;
      const deckRef = ref(db, `decks/${deckId}`);
      
      const deckData: any = {
          name: editingDeck.name,
          description: editingDeck.description || "",
          blackCards: editingDeck.blackCards || [],
          whiteCards: editingDeck.whiteCards || [],
          lastUpdated: Date.now()
      };
      
      if (editingDeck.password) deckData.password = editingDeck.password;
      if (editingDeck.isSystem) deckData.isSystem = editingDeck.isSystem;

      try {
          await firebaseSet(deckRef, deckData);
          setEditingDeck(null);
          showNotification("Baralho salvo com sucesso!");
      } catch (err) {
          console.error(err);
          showNotification("Erro ao salvar.");
      }
  };

  // --- RENDERING ---

  // 1. LOGIN SCREEN
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-between p-4 sm:p-6 overflow-y-auto">
        {/* HEADER SOCIAL */}
        <div className="w-full flex justify-center pt-6">
            <a href="https://www.instagram.com/kanasutrarepublica/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-pink-500 hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-full border border-pink-500/30">
                <Instagram size={20} />
                <span className="font-bold text-sm">@kanasutrarepublica</span>
            </a>
        </div>

        <div className="w-full max-w-md space-y-6 text-center mx-auto my-auto flex flex-col justify-center">
          <div className="flex flex-col items-center justify-center mb-2">
            <div className="relative">
               <div className="absolute inset-0 bg-pink-500 blur-xl opacity-50 rounded-full"></div>
               <img 
                 src={LOGO_URL} 
                 alt="Logo" 
                 className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-full object-cover border-4 border-white shadow-2xl animate-[pulse_3s_ease-in-out_infinite]"
               />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white mt-6 tracking-tighter drop-shadow-lg uppercase bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-500">
              FDP - KANA SUTRA
            </h1>
          </div>
          
          <div className="bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-2xl border border-gray-700 w-full">
            <h2 className="text-xl font-bold mb-6">Quem é você na fila do pão?</h2>
            <div className="space-y-4">
              <input 
                id="nameInput"
                type="text" 
                placeholder="Seu apelido..." 
                className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-pink-500 text-lg text-center text-white"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleLogin(e.currentTarget.value);
                  }
                }}
              />
              <div className="w-full">
                <Button fullWidth onClick={() => {
                    const input = document.getElementById('nameInput') as HTMLInputElement;
                    handleLogin(input.value);
                }} variant="primary">
                    ENTRAR
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="w-full text-center pb-2 text-gray-500 text-xs font-mono">
             Desenvolvido por Kana Sutra - P2 - 7.0.0.0
        </div>
      </div>
    );
  }

  // 2. MAIN MENU (Join/Create + Deck Manager)
  if (!gameState) {
    // --- DECK MANAGER VIEW ---
    if (appMode === 'DECK_EDITOR') {
        return (
            <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col">
                <header className="flex items-center gap-4 mb-6">
                   <button onClick={() => {
                       setAppMode('MENU');
                       setEditingDeck(null);
                   }} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700"><ArrowRight className="rotate-180" size={20}/></button>
                   <h2 className="text-xl font-bold flex items-center gap-2"><Database size={20} className="text-pink-500"/> Gerenciar Decks</h2>
                </header>

                {/* PASSWORD MODAL */}
                {showPasswordPrompt && (
                    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
                        <div className="bg-gray-800 p-6 rounded-xl w-full max-w-sm border border-gray-700">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Lock size={20} className="text-yellow-500"/> Senha do Deck
                            </h3>
                            <p className="text-sm text-gray-400 mb-4">
                                {showPasswordPrompt.action === 'DELETE' 
                                    ? "Digite a senha para APAGAR este deck permanentemente." 
                                    : "Digite a senha para EDITAR este deck."}
                            </p>
                            <input 
                                type="password" 
                                value={deckPasswordInput}
                                onChange={e => setDeckPasswordInput(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 mb-4"
                                placeholder="Senha..."
                            />
                            <div className="flex gap-2">
                                <Button fullWidth variant="secondary" onClick={() => setShowPasswordPrompt(null)}>Cancelar</Button>
                                <Button fullWidth variant={showPasswordPrompt.action === 'DELETE' ? 'danger' : 'success'} onClick={submitPassword}>Confirmar</Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* EDITING FORM */}
                {editingDeck ? (
                    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shrink-0">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="text-xs text-gray-400 block mb-1">Nome do Baralho</label>
                                    <input 
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2" 
                                        value={editingDeck.name} 
                                        onChange={e => setEditingDeck({...editingDeck, name: e.target.value})}
                                        placeholder="Ex: Minhas Piadas Ruins"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 block mb-1">Senha de Edição (Opcional)</label>
                                    <input 
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2" 
                                        value={editingDeck.password} 
                                        onChange={e => setEditingDeck({...editingDeck, password: e.target.value})}
                                        placeholder="Deixe em branco para público"
                                        type="text" 
                                    />
                                </div>
                            </div>
                             <div className="mb-2">
                                <label className="text-xs text-gray-400 block mb-1">Descrição</label>
                                <input 
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-sm" 
                                    value={editingDeck.description} 
                                    onChange={e => setEditingDeck({...editingDeck, description: e.target.value})}
                                    placeholder="Uma breve descrição..."
                                />
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <Button size="sm" variant="ghost" onClick={() => setEditingDeck(null)}>Cancelar</Button>
                                <Button size="sm" variant="success" onClick={handleSaveDeck}><Save size={16}/> Salvar Deck</Button>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto pb-12">
                            {/* BLACK CARDS EDITOR */}
                            <div className={`bg-gray-800 rounded-xl border border-gray-700 flex flex-col transition-all duration-300 ${minimizeBlack ? 'h-auto' : 'flex-1 min-h-[300px]'}`}>
                                <div className="p-3 bg-black/20 border-b border-gray-700 font-bold flex justify-between items-center cursor-pointer" onClick={() => setMinimizeBlack(!minimizeBlack)}>
                                    <span className="flex items-center gap-2"><Skull size={16}/> Cartas Pretas ({editingDeck.blackCards?.length || 0})</span>
                                    <button className="text-gray-400">
                                        {minimizeBlack ? <ChevronDown size={20}/> : <ChevronUp size={20}/>}
                                    </button>
                                </div>
                                
                                {!minimizeBlack && (
                                    <>
                                        <div className="p-3 border-b border-gray-700 flex gap-2">
                                            <input 
                                                value={newBlackCardText}
                                                onChange={(e) => setNewBlackCardText(e.target.value)}
                                                className="flex-1 bg-gray-900 rounded p-2 text-sm border border-gray-600"
                                                placeholder="Nova pergunta..."
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && newBlackCardText.trim()) {
                                                        setEditingDeck(prev => ({
                                                            ...prev!,
                                                            blackCards: [...(prev!.blackCards || []), newBlackCardText.trim()]
                                                        }));
                                                        setNewBlackCardText("");
                                                    }
                                                }}
                                            />
                                            <button 
                                                onClick={() => {
                                                    if (newBlackCardText.trim()) {
                                                        setEditingDeck(prev => ({
                                                            ...prev!,
                                                            blackCards: [...(prev!.blackCards || []), newBlackCardText.trim()]
                                                        }));
                                                        setNewBlackCardText("");
                                                    }
                                                }}
                                                className="bg-gray-700 p-2 rounded hover:bg-gray-600"
                                            ><Plus size={20}/></button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                            {editingDeck.blackCards?.map((text, i) => (
                                                <div key={i} className="flex gap-2 items-start bg-black/40 p-2 rounded text-sm group">
                                                    <span className="flex-1">{text}</span>
                                                    <button onClick={() => {
                                                        const newCards = [...(editingDeck.blackCards || [])];
                                                        newCards.splice(i, 1);
                                                        setEditingDeck({...editingDeck, blackCards: newCards});
                                                    }} className="text-red-500 opacity-50 group-hover:opacity-100"><X size={16}/></button>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* WHITE CARDS EDITOR */}
                             <div className={`bg-gray-800 rounded-xl border border-gray-700 flex flex-col transition-all duration-300 ${minimizeWhite ? 'h-auto' : 'flex-1 min-h-[300px]'}`}>
                                <div className="p-3 bg-white/5 border-b border-gray-700 font-bold flex justify-between items-center cursor-pointer" onClick={() => setMinimizeWhite(!minimizeWhite)}>
                                    <span className="flex items-center gap-2"><Smile size={16}/> Cartas Brancas ({editingDeck.whiteCards?.length || 0})</span>
                                    <button className="text-gray-400">
                                        {minimizeWhite ? <ChevronDown size={20}/> : <ChevronUp size={20}/>}
                                    </button>
                                </div>
                                {!minimizeWhite && (
                                    <>
                                        <div className="p-3 border-b border-gray-700 flex gap-2">
                                            <input 
                                                value={newWhiteCardText}
                                                onChange={(e) => setNewWhiteCardText(e.target.value)}
                                                className="flex-1 bg-gray-900 rounded p-2 text-sm border border-gray-600"
                                                placeholder="Nova resposta..."
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && newWhiteCardText.trim()) {
                                                        setEditingDeck(prev => ({
                                                            ...prev!,
                                                            whiteCards: [...(prev!.whiteCards || []), newWhiteCardText.trim()]
                                                        }));
                                                        setNewWhiteCardText("");
                                                    }
                                                }}
                                            />
                                            <button 
                                                 onClick={() => {
                                                    if (newWhiteCardText.trim()) {
                                                        setEditingDeck(prev => ({
                                                            ...prev!,
                                                            whiteCards: [...(prev!.whiteCards || []), newWhiteCardText.trim()]
                                                        }));
                                                        setNewWhiteCardText("");
                                                    }
                                                }}
                                                className="bg-gray-700 p-2 rounded hover:bg-gray-600"
                                            ><Plus size={20}/></button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                            {editingDeck.whiteCards?.map((text, i) => (
                                                <div key={i} className="flex gap-2 items-start bg-white/10 p-2 rounded text-sm text-gray-200 group">
                                                    <span className="flex-1">{text}</span>
                                                    <button onClick={() => {
                                                        const newCards = [...(editingDeck.whiteCards || [])];
                                                        newCards.splice(i, 1);
                                                        setEditingDeck({...editingDeck, whiteCards: newCards});
                                                    }} className="text-red-500 opacity-50 group-hover:opacity-100"><X size={16}/></button>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* LIST OF DECKS */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pb-24">
                        <button 
                            onClick={handleStartCreateDeck}
                            className="bg-pink-600/20 border-2 border-dashed border-pink-500 rounded-xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-pink-600/30 transition-colors h-48"
                        >
                            <Plus size={40} className="text-pink-500"/>
                            <span className="font-bold text-pink-500">Criar Novo Baralho</span>
                        </button>

                        {availableDecks.map(deck => (
                            <div key={deck.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4 relative flex flex-col h-48">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-lg truncate pr-8">{deck.name}</h3>
                                    {deck.password && <Lock size={14} className="text-yellow-500 absolute top-5 right-4"/>}
                                </div>
                                <p className="text-xs text-gray-400 mb-4 line-clamp-2">{deck.description}</p>
                                <div className="flex gap-4 text-sm text-gray-500 mb-auto">
                                    <span className="flex items-center gap-1"><Skull size={14}/> {deck.blackCards?.length || 0} Pretas</span>
                                    <span className="flex items-center gap-1"><Smile size={14}/> {deck.whiteCards?.length || 0} Brancas</span>
                                </div>
                                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-700">
                                    <Button 
                                        fullWidth 
                                        variant="secondary" 
                                        className="text-xs py-2 h-10"
                                        onClick={() => handleCheckPassword(deck.id, 'EDIT')}
                                    >
                                        <Edit size={14}/> Editar
                                    </Button>
                                    <Button 
                                        variant="danger" 
                                        className="px-3 h-10"
                                        onClick={() => handleCheckPassword(deck.id, 'DELETE')}
                                    >
                                        <Trash2 size={16}/>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                 {notification && <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 px-6 py-2 rounded-full shadow-xl font-bold">{notification}</div>}
            </div>
        );
    }

    // --- NORMAL MENU ---
    return (
       <div className="min-h-screen bg-gray-900 text-white p-6 flex flex-col items-center">
         {showRules && <RulesModal onClose={() => setShowRules(false)} />}
         
         <div className="w-full max-w-md space-y-6">
           <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                 <Avatar id={user.avatarId} />
                 <span className="font-bold text-xl">{user.name}</span>
              </div>
              <button onClick={() => { localStorage.clear(); setUser(null); }} className="text-gray-500 text-sm hover:text-white">Sair</button>
           </div>

           <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 space-y-6">
              <div className="text-center">
                 <img 
                    src={LOGO_URL} 
                    className="w-32 h-32 rounded-full mx-auto mb-4 border-4 border-pink-500 shadow-xl object-cover"
                    alt="Logo"
                 />
                 <h2 className="text-2xl font-black text-white mb-2 uppercase">MENU PRINCIPAL</h2>
                 <p className="text-gray-400 text-sm">Crie uma sala para jogar com amigos ou entre em uma existente.</p>
              </div>
              
              <div className="space-y-3">
                 <Button fullWidth onClick={createGame} disabled={loading} variant="primary">
                    <Play size={20} /> CRIAR SALA
                 </Button>
                 
                 <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-600"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-gray-800 text-gray-500">OU ENTRE</span>
                    </div>
                  </div>

                 <div className="flex flex-col gap-3">
                    <input 
                       id="roomInput"
                       type="text" 
                       placeholder="CÓDIGO DA SALA" 
                       maxLength={4}
                       className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-center uppercase font-mono tracking-widest focus:ring-2 focus:ring-pink-500 outline-none text-lg"
                    />
                    <Button fullWidth onClick={() => {
                       const input = document.getElementById('roomInput') as HTMLInputElement;
                       joinGame(input.value);
                    }} disabled={loading} variant="secondary">
                       ENTRAR NA SALA
                    </Button>
                 </div>
              </div>
              
              <div className="pt-4 border-t border-gray-700 space-y-3">
                  <Button fullWidth variant="ghost" onClick={() => setAppMode('DECK_EDITOR')}>
                      <Database size={18} /> GERENCIAR BARALHOS
                  </Button>
                  <Button fullWidth variant="ghost" onClick={() => setShowRules(true)} className="text-gray-400 hover:text-white border-gray-700">
                      <BookOpen size={18} /> COMO JOGAR
                  </Button>
              </div>
           </div>
         </div>
         {notification && <div className="mt-4 bg-red-500 px-4 py-2 rounded-lg font-bold">{notification}</div>}
       </div>
    );
  }

  // 3. GAME LOBBY
  if (gameState.phase === 'LOBBY') {
    const playersList = Object.values(gameState.players || {}) as Player[];
    const isHost = gameState.players[user.id]?.isHost;
    const handSizes = [4, 5, 6, 10, 15];
    const currentMaxHandSize = gameState.maxHandSize || 10;
    const currentSelectedDecks = gameState.selectedDeckIds || [];
    
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col">
        <header className="flex justify-between items-center mb-6 bg-gray-800 p-4 rounded-xl shadow-lg shrink-0">
          <div className="flex flex-col">
             <span className="text-xs text-gray-400 uppercase">Sala</span>
             <div className="flex items-center gap-2">
                <span className="font-mono text-2xl font-bold text-pink-500 tracking-widest">{gameState.roomCode}</span>
                <button onClick={handleShareRoom} className="text-green-400 hover:text-white flex items-center gap-1 bg-gray-700 px-2 py-1 rounded-lg border border-gray-600 ml-2">
                    <Share2 size={12}/> Convidar
                </button>
             </div>
          </div>
          <div className="flex gap-2">
            {isHost ? (
               <Button variant="danger" onClick={destroyRoom} className="px-3 py-2 text-xs font-bold bg-red-900/50 border border-red-500 hover:bg-red-800">
                   <Skull size={16} className="mr-1"/> Encerrar Sala
               </Button>
            ) : (
               <Button variant="secondary" onClick={leaveRoom} className="px-3 py-2 text-xs"><LogOut size={16}/> Sair</Button>
            )}
          </div>
        </header>

        <div className="max-w-md mx-auto w-full space-y-6 flex-1 flex flex-col">
          {/* PLAYER LIST */}
          <div className="grid grid-cols-2 gap-4">
            {playersList.map((p) => (
              <div key={p.id} className="bg-gray-800 p-3 rounded-xl flex items-center justify-between gap-2 border border-gray-700 relative overflow-hidden group">
                <div className="flex items-center gap-2 min-w-0">
                    <Avatar id={p.avatarId} />
                    <div className="flex flex-col z-10 min-w-0">
                    <span className="font-bold truncate text-sm">{p.name}</span>
                    {p.isHost && <span className="text-[10px] text-yellow-500 flex items-center gap-1 uppercase font-bold"><Crown size={10}/> Host</span>}
                    </div>
                </div>
                {/* KICK BUTTON */}
                {isHost && p.id !== user.id && (
                    <button 
                        onClick={() => kickPlayer(p.id)}
                        className="bg-red-500/20 p-2 rounded hover:bg-red-500 hover:text-white text-red-500 transition-colors"
                        title="Remover Jogador"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
              </div>
            ))}
          </div>

          {/* DECK SELECTION (ONLY HOST) */}
          {isHost ? (
             <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 flex-1 overflow-y-auto min-h-[200px]">
                
                {/* SETTINGS */}
                <div className="mb-6 border-b border-gray-700 pb-4 space-y-4">
                    <div className="flex items-center gap-2 text-pink-400">
                        <Settings size={18} />
                        <h3 className="font-bold uppercase text-sm">Configurações</h3>
                    </div>

                    {/* Hand Size */}
                    <div>
                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Cartas na Mão</label>
                        <div className="flex gap-2">
                            {handSizes.map(size => (
                                <button
                                    key={size}
                                    onClick={() => changeMaxHandSize(size)}
                                    className={`flex-1 py-1 rounded-lg font-bold text-xs transition-all border ${currentMaxHandSize === size ? 'bg-pink-500 border-pink-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'}`}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Timer */}
                    <div>
                        <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Tempo de Rodada</label>
                        <div className="flex gap-2">
                            {[30, 60, 90, 120].map(time => (
                                <button
                                    key={time}
                                    onClick={() => updateConfig('roundTimeout', time)}
                                    className={`flex-1 py-1 rounded-lg font-bold text-xs transition-all border ${gameState.config?.roundTimeout === time ? 'bg-pink-500 border-pink-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'}`}
                                >
                                    {time}s
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Win Condition */}
                    <div>
                         <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Fim de Jogo</label>
                         <div className="grid grid-cols-3 gap-2 mb-2">
                             <button onClick={() => updateConfig('winCondition', 'INFINITE')} className={`py-1 text-xs border rounded ${gameState.config?.winCondition === 'INFINITE' ? 'bg-blue-600 border-blue-600' : 'border-gray-600'}`}>Infinito</button>
                             <button onClick={() => updateConfig('winCondition', 'MAX_SCORE')} className={`py-1 text-xs border rounded ${gameState.config?.winCondition === 'MAX_SCORE' ? 'bg-blue-600 border-blue-600' : 'border-gray-600'}`}>Pontos</button>
                             <button onClick={() => updateConfig('winCondition', 'MAX_ROUNDS')} className={`py-1 text-xs border rounded ${gameState.config?.winCondition === 'MAX_ROUNDS' ? 'bg-blue-600 border-blue-600' : 'border-gray-600'}`}>Rodadas</button>
                         </div>
                         {gameState.config?.winCondition !== 'INFINITE' && (
                             <input 
                                type="number" 
                                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm"
                                value={gameState.config?.winValue || 0}
                                onChange={(e) => updateConfig('winValue', parseInt(e.target.value))}
                                placeholder={gameState.config?.winCondition === 'MAX_SCORE' ? "Pontuação Máxima (ex: 50)" : "Número de Rodadas (ex: 10)"}
                             />
                         )}
                    </div>
                </div>

                <div className="flex items-center gap-2 mb-4 text-pink-400">
                    <Database size={18} />
                    <h3 className="font-bold uppercase text-sm">Baralhos</h3>
                </div>
                {availableDecks.length === 0 ? (
                    <div className="text-gray-500 text-center text-sm py-4 flex flex-col items-center">
                        <Database size={40} className="mb-2 opacity-50"/>
                        <p>Nenhum baralho encontrado.</p>
                        <p className="text-xs mt-2">Crie um novo baralho no menu inicial!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {availableDecks.map(deck => {
                            const isSelected = currentSelectedDecks.includes(deck.id);
                            return (
                                <div 
                                  key={deck.id} 
                                  onClick={() => toggleDeck(deck.id)}
                                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex justify-between items-center ${isSelected ? 'border-pink-500 bg-pink-500/10' : 'border-gray-700 bg-gray-800'}`}
                                >
                                    <div>
                                        <div className="font-bold text-sm">{deck.name}</div>
                                        <div className="text-xs text-gray-400">{deck.description}</div>
                                        <div className="text-[10px] text-gray-500 mt-1 flex gap-2">
                                            <span>{deck.blackCards?.length || 0} Pretas</span>
                                            <span>{deck.whiteCards?.length || 0} Brancas</span>
                                        </div>
                                    </div>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-pink-500 border-pink-500' : 'border-gray-500'}`}>
                                        {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
             </div>
          ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 space-y-2">
                <p className="text-gray-400">O anfitrião está configurando a partida...</p>
                <div className="flex flex-wrap gap-2 justify-center">
                    <span className="text-xs bg-gray-800 px-2 py-1 rounded border border-gray-700">Mão: {currentMaxHandSize}</span>
                    <span className="text-xs bg-gray-800 px-2 py-1 rounded border border-gray-700">Tempo: {gameState.config?.roundTimeout}s</span>
                    <span className="text-xs bg-gray-800 px-2 py-1 rounded border border-gray-700">
                        {gameState.config?.winCondition === 'INFINITE' ? 'Infinito' : `${gameState.config?.winCondition === 'MAX_SCORE' ? 'Max Pontos' : 'Max Rodadas'}: ${gameState.config?.winValue}`}
                    </span>
                </div>
             </div>
          )}

          <div className="pt-2 pb-6 sticky bottom-0 bg-gray-900">
            {isHost ? (
              <Button fullWidth onClick={startGame} variant="success" disabled={playersList.length < 2 || currentSelectedDecks.length === 0 || loading}>
                <div className="flex items-center gap-2">
                  {loading ? 'Carregando...' : <><Play size={20} /> INICIAR JOGO</>}
                </div>
              </Button>
            ) : (
              <div className="text-center p-4 bg-gray-800 rounded-xl animate-pulse text-gray-400">
                 Aguardando inicio...
              </div>
            )}
            {playersList.length < 2 && <p className="text-center text-red-400 text-xs mt-2">Mínimo 2 jogadores.</p>}
          </div>
        </div>
      </div>
    );
  }

  // 4. GAME OVER SCREEN
  if (gameState.phase === 'GAME_OVER') {
      const winner = gameState.gameWinnerId ? gameState.players[gameState.gameWinnerId] : null;
      return (
          <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 text-center">
              <div className="bg-gray-800 p-8 rounded-2xl border-2 border-yellow-500 shadow-2xl max-w-md w-full relative overflow-hidden">
                  <div className="absolute inset-0 bg-yellow-500/10 animate-pulse"></div>
                  <Crown size={64} className="mx-auto text-yellow-500 mb-6 relative z-10 drop-shadow-lg"/>
                  <h1 className="text-4xl font-black text-white mb-2 relative z-10">FIM DE JOGO!</h1>
                  
                  {winner ? (
                      <div className="my-8 relative z-10">
                          <div className="mx-auto w-24 h-24 mb-4 relative">
                              <Avatar id={winner.avatarId} size="lg"/>
                              <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-black font-bold px-2 rounded-full border border-white">1º</div>
                          </div>
                          <h2 className="text-2xl font-bold">{winner.name}</h2>
                          <p className="text-yellow-500 font-mono text-xl">{winner.score} Pontos</p>
                      </div>
                  ) : (
                      <p className="text-gray-400 my-8">Empate ou jogo encerrado.</p>
                  )}

                  <div className="space-y-3 relative z-10">
                    {gameState.players[user.id]?.isHost && (
                         <Button fullWidth onClick={() => startNewRound(false)} variant="success">Nova Partida</Button>
                    )}
                    <Button fullWidth onClick={leaveRoom} variant="secondary">Voltar ao Menu</Button>
                  </div>
              </div>
          </div>
      )
  }

  // 5. GAME BOARD
  const isJudge = gameState.judgeId === user.id;
  const isSubmissionPhase = gameState.phase === 'SUBMISSION';
  const isJudgingPhase = gameState.phase === 'JUDGING';
  const isGuessingPhase = gameState.phase === 'GUESSING';
  const isResultPhase = gameState.phase === 'RESULT';

  const playedCardsList = (gameState.shuffledOrder 
     ? gameState.shuffledOrder.map(id => gameState.playedCards[id]).filter(Boolean)
     : Object.values(gameState.playedCards || {})) as PlayedCard[];

  const hasUserPlayed = isSubmissionPhase && Object.values(gameState.playedCards || {}).some((c: any) => c.playerId === user.id);
  const sortedPlayers = (Object.values(gameState.players) as Player[]).sort((a, b) => b.score - a.score);
  const isHost = gameState.players[user.id]?.isHost;
  const hand = gameState.players[user.id]?.hand || []; // Get hand from DB state

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
      
      {/* SCOREBOARD MODAL */}
      {showScoreBoard && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 animate-fadeIn" onClick={() => setShowScoreBoard(false)}>
           <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 w-full max-w-md shadow-2xl relative" onClick={e => e.stopPropagation()}>
               <button onClick={() => setShowScoreBoard(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                 <X size={24} />
               </button>
               <h2 className="text-xl font-black text-center mb-6 uppercase tracking-widest text-yellow-500 flex items-center justify-center gap-2">
                   <Trophy size={24}/> Placar Geral
               </h2>
               <div className="space-y-3">
                   {sortedPlayers.map((p, idx) => (
                       <div key={p.id} className="bg-gray-700/50 p-3 rounded-xl flex items-center justify-between border border-gray-600">
                           <div className="flex items-center gap-3">
                               <span className="font-mono text-gray-400 w-6 text-center">#{idx + 1}</span>
                               <Avatar id={p.avatarId} size="sm"/>
                               <div className="flex flex-col">
                                   <span className="font-bold text-sm flex items-center gap-1">
                                       {p.name}
                                       {p.id === gameState.judgeId && <Gavel size={12} className="text-yellow-500"/>}
                                   </span>
                                   {p.isHost && <span className="text-[10px] text-yellow-500 uppercase">Host</span>}
                               </div>
                           </div>
                           <div className="flex items-center gap-2">
                                <div className="font-bold text-xl">{p.score}</div>
                                {isHost && p.id !== user.id && (
                                    <button 
                                        onClick={() => kickPlayer(p.id)}
                                        className="text-gray-500 hover:text-red-500 p-1"
                                        title="Remover"
                                    >
                                        <Trash2 size={16}/>
                                    </button>
                                )}
                           </div>
                       </div>
                   ))}
               </div>
           </div>
        </div>
      )}

      {/* HEADER INFO */}
      <div className="bg-gray-800 p-3 shadow-lg flex justify-between items-center z-20 shrink-0">
         <div className="flex items-center gap-2">
             <button onClick={leaveRoom} className="bg-red-500/10 p-2 rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-colors">
                 <LogOut size={16} />
             </button>
             <div className="flex flex-col">
                 <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wide mb-1">Rodada {gameState.currentRound}</span>
                 <div className="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded-lg text-sm font-bold border border-yellow-500/30 flex items-center gap-2">
                     <Gavel size={16}/> 
                     <span className="truncate max-w-[100px]">{gameState.players[gameState.judgeId]?.name || 'Juiz'}</span>
                 </div>
             </div>
         </div>

         {/* TIMER */}
         {timeLeft !== null && (
             <div className={`flex items-center gap-2 font-mono text-xl font-bold ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-gray-300'}`}>
                 <Clock size={20}/>
                 {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
             </div>
         )}
         
         {!timeLeft && gameState.roomCode && (
             <div className="font-bold text-gray-600 tracking-widest text-xs flex flex-col items-center">
                 <span>SALA</span>
                 <span className="text-lg text-pink-500">{gameState.roomCode}</span>
             </div>
         )}

         <button onClick={() => setShowScoreBoard(true)} className="flex flex-col items-end group">
             <span className="text-[10px] text-gray-400 uppercase font-bold group-hover:text-white transition-colors">Ver Placar</span>
             <div className="flex items-center gap-2">
                 <span className="text-2xl font-black">{gameState.players[user.id].score}</span>
                 <div className="bg-gray-700 p-2 rounded-full border border-gray-600 group-hover:bg-gray-600 group-hover:border-yellow-500 transition-all">
                    <Trophy size={16} className="text-yellow-500"/>
                 </div>
             </div>
         </button>
      </div>

      {/* GAME AREA */}
      <div className="flex-1 relative flex flex-col overflow-hidden">
         {/* BLACK CARD */}
         <div className="bg-gray-900 p-4 shrink-0 shadow-xl z-10">
            <div className="max-w-md mx-auto">
               <Card 
                  text={gameState.blackCard || "..."} 
                  type="BLACK" 
                  hidden={!isJudge && !gameState.blackCardRevealed}
               />
            </div>
         </div>

         {/* TABLE AREA */}
         <div className="flex-1 bg-gray-800/50 overflow-y-auto p-4 relative">
            <div className="max-w-md mx-auto space-y-6 pb-24">
                {/* INSTRUCTIONS */}
                <div className="text-center text-gray-400 text-sm animate-pulse">
                   {isSubmissionPhase && (isJudge ? "Aguarde os jogadores escolherem..." : (hasUserPlayed ? "Aguardando os outros jogadores..." : "Escolha a melhor carta da sua mão!"))}
                   {isJudgingPhase && (isJudge ? "Toque nas cartas para VIRAR. Escolha a mais engraçada!" : "O Juiz está lendo as cartas...")}
                   {isGuessingPhase && (isJudge ? "Quem jogou essa carta? Adivinhe!" : "O Juiz está tentando adivinhar...")}
                   {isResultPhase && "Resultado da rodada!"}
                </div>

                {/* PLAYED CARDS GRID */}
                {(isJudgingPhase || isGuessingPhase || isResultPhase) && (
                   <div className="grid grid-cols-2 gap-3">
                      {playedCardsList.map((pc) => {
                          const isWinningCard = gameState.winningCardId === pc.id;
                          const showFace = isResultPhase || (isGuessingPhase && isWinningCard) || (isJudgingPhase && pc.isRevealed);
                          
                          return (
                            <div key={pc.id} className="flex flex-col items-center">
                               <Card 
                                  text={pc.cardText} 
                                  type="WHITE" 
                                  hidden={!showFace}
                                  isWinner={isWinningCard}
                                  onClick={() => {
                                      if(isJudgingPhase && isJudge) {
                                          if (!pc.isRevealed) {
                                              revealCard(pc.id);
                                          } else {
                                              setConfirmWinnerCandidate(pc);
                                          }
                                      }
                                  }}
                                  small
                               />
                               {isResultPhase && isWinningCard && (
                                   <div className="mt-2 text-xs font-bold text-yellow-500 bg-yellow-900/30 px-2 py-1 rounded-full">
                                       {gameState.players[pc.playerId]?.name}
                                   </div>
                               )}
                            </div>
                          )
                      })}
                   </div>
                )}

                {/* CONFIRM WINNER MODAL */}
                {isJudgingPhase && isJudge && confirmWinnerCandidate && (
                    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 animate-fadeIn">
                         <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 w-full max-w-sm text-center shadow-2xl">
                             <div className="mb-4">
                                <AlertTriangle className="mx-auto text-yellow-500 mb-2" size={32}/>
                                <h3 className="text-lg font-bold text-white">Confirmar Vencedora?</h3>
                                <p className="text-sm text-gray-400 mt-2">Você tem certeza que esta é a carta mais engraçada?</p>
                             </div>

                             <div className="bg-white text-black p-4 rounded-xl font-bold mb-6 text-sm">
                                 {confirmWinnerCandidate.cardText}
                             </div>

                             <div className="flex gap-3">
                                 <Button fullWidth onClick={() => setConfirmWinnerCandidate(null)} variant="secondary">
                                     Cancelar
                                 </Button>
                                 <Button fullWidth onClick={() => judgeSelectWinner(confirmWinnerCandidate)} variant="success">
                                     <Crown size={16} /> Confirmar
                                 </Button>
                             </div>
                         </div>
                    </div>
                )}
                
                {/* GUESSING UI */}
                {isGuessingPhase && isJudge && (
                    <div className="bg-gray-800 p-4 rounded-xl border border-pink-500/50 shadow-2xl animate-fadeIn">
                        <h3 className="font-bold text-center mb-4 text-pink-400">De quem é essa carta?</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.values(gameState.players) as Player[]).filter(p => p.id !== user.id).map(p => (
                                <button 
                                   key={p.id}
                                   onClick={() => judgeGuessPlayer(p.id)}
                                   className="flex items-center gap-2 p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                                >
                                    <Avatar id={p.avatarId} size="sm"/>
                                    <span className="truncate text-xs font-bold">{p.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* RESULT UI */}
                {isResultPhase && (
                    <div className="bg-gray-800 p-6 rounded-xl border-2 border-yellow-500 shadow-2xl text-center animate-fadeIn">
                        <Trophy size={48} className="mx-auto text-yellow-500 mb-4" />
                        <h2 className="text-2xl font-black text-white mb-2">Vencedor da Rodada!</h2>
                        
                        {/* WRONG GUESS DISPLAY */}
                        {gameState.guessedPlayerId && gameState.guessedPlayerId !== gameState.actualPlayerId && (
                             <div className="mb-4 bg-red-900/30 p-3 rounded-lg border border-red-500/50">
                                 <p className="text-xs text-red-300 uppercase mb-1">O Juiz acusou:</p>
                                 <div className="flex items-center justify-center gap-2">
                                     <Avatar id={gameState.players[gameState.guessedPlayerId].avatarId} size="sm"/>
                                     <span className="font-bold text-lg text-white">{gameState.players[gameState.guessedPlayerId].name}</span>
                                 </div>
                             </div>
                        )}

                        <div className="flex items-center justify-center gap-3 mb-4 bg-yellow-900/20 p-4 rounded-xl border border-yellow-500/30">
                            <Avatar id={gameState.players[gameState.roundWinnerId || ''].avatarId} />
                            <div className="flex flex-col text-left">
                                <span className="text-xs text-yellow-500 font-bold uppercase">Dono da Carta (Vencedor)</span>
                                <span className="text-xl font-bold">{gameState.players[gameState.roundWinnerId || ''].name}</span>
                            </div>
                        </div>
                        
                        <div className="text-sm text-gray-400 bg-gray-900/50 p-3 rounded-lg mb-4">
                            {gameState.guessedPlayerId === gameState.actualPlayerId ? (
                                <span className="text-green-400 font-bold">O Juiz acertou! (5 pts cada)</span>
                            ) : (
                                <span className="text-red-400 font-bold">O Juiz errou! (10 pts para o vencedor)</span>
                            )}
                        </div>

                        {/* AUTO NEXT ROUND PROGRESS */}
                        <div className="mt-4">
                            <p className="text-xs text-gray-400 mb-2 animate-pulse">
                                Próxima rodada em {resultCountdown}s...
                            </p>
                            <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                                <div 
                                    className="bg-green-500 h-full transition-all duration-1000 ease-linear" 
                                    style={{ width: `${(resultCountdown || 0) * 20}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
         </div>

         {/* HAND AREA (BOTTOM SHEET) */}
         {isSubmissionPhase && !isJudge && !hasUserPlayed && (
             <div className="bg-gray-900 border-t border-gray-800 p-4 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-30">
                 <div className="text-xs text-gray-500 mb-2 uppercase font-bold flex justify-between">
                    <span>Sua Mão</span>
                    <span>{hand.length} cartas</span>
                 </div>
                 <div className="flex gap-2 overflow-x-auto pb-4 px-2 snap-x">
                     {hand.map((cardText, idx) => (
                         <div key={idx} className="min-w-[140px] snap-center">
                             <Card 
                                text={cardText} 
                                type="WHITE" 
                                selected={selectedCardIndex === idx}
                                onClick={() => setSelectedCardIndex(idx)}
                             />
                         </div>
                     ))}
                 </div>
                 {selectedCardIndex !== null && (
                     <div className="mt-2">
                         <Button fullWidth onClick={() => playCard(hand[selectedCardIndex])} variant="primary">
                             JOGAR CARTA SELECIONADA
                         </Button>
                     </div>
                 )}
             </div>
         )}
         
         {/* WAITING AREA AFTER PLAYING */}
         {isSubmissionPhase && !isJudge && hasUserPlayed && (
            <div className="bg-gray-900 border-t border-gray-800 p-6 text-center z-30 flex flex-col items-center justify-center gap-2">
                 <div className="bg-gray-800 p-4 rounded-full">
                    <Smile className="text-green-500 animate-bounce" size={32}/>
                 </div>
                 <h3 className="font-bold text-white">Carta Enviada!</h3>
                 <p className="text-gray-400 text-xs animate-pulse">Aguardando os outros jogadores...</p>
            </div>
         )}
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('app')!);
root.render(<App />);