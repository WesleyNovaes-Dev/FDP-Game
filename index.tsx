import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { User, Users, Play, Crown, Trophy, Smile, Skull, Zap, MessageSquare, ArrowRight, Gavel, HelpCircle, LogOut, Copy, Shuffle, Database, Plus, Trash2, Edit, Save, X, Lock, Unlock, Eye, EyeOff, BookOpen, Instagram, Share2, ChevronDown, ChevronUp, Mic, AlertTriangle } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set as firebaseSet, onValue, update, push, child, get, remove, onDisconnect, runTransaction } from "firebase/database";
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
  inbox?: string[];
};

type Deck = {
  id: string; // key from firebase
  name: string;
  description?: string;
  password?: string; // Senha para edição/exclusão
  isSystem?: boolean;
  blackCards?: string[];
  whiteCards?: string[];
  selected?: boolean; // UI state only
};

type GamePhase = 'LOBBY' | 'SUBMISSION' | 'JUDGING' | 'GUESSING' | 'RESULT';

type PlayedCard = {
  id: string;
  playerId: string;
  cardText: string;
  isHidden: boolean;
  isRevealed?: boolean; // Se true, todos podem ver o texto na fase de julgamento
};

type GameState = {
  roomCode: string;
  players: Record<string, Player>;
  currentRound: number;
  judgeId: string;
  blackCard: string | null;
  phase: GamePhase;
  playedCards: Record<string, PlayedCard>;
  shuffledOrder?: string[]; // Array of card IDs in random order for judging
  winningCardId: string | null;
  roundWinnerId: string | null;
  guessedPlayerId: string | null;
  actualPlayerId: string | null;
  selectedDeckIds?: string[]; // IDs dos decks usados
};

// --- UTILS ---
const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();
const generatePlayerId = () => 'user_' + Math.random().toString(36).substring(2, 9);
const shuffleArray = (array: any[]) => {
  if (!array) return [];
  const newArr = [...array];
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
  const [hand, setHand] = useState<string[]>([]);
  const [appMode, setAppMode] = useState<'MENU' | 'DECK_EDITOR'>('MENU');
  
  // Synced Game State
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [availableDecks, setAvailableDecks] = useState<Deck[]>([]);
  const [selectedDeckIds, setSelectedDeckIds] = useState<Set<string>>(new Set());

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
  
  // Judge Interaction State
  const [confirmWinnerCandidate, setConfirmWinnerCandidate] = useState<PlayedCard | null>(null);

  // Ref to track auto-selection
  const hasAutoSelectedDecks = useRef(false);

  // Initial Check
  useEffect(() => {
    const savedId = localStorage.getItem('fdp_player_id');
    const savedName = localStorage.getItem('fdp_player_name');
    if (savedId && savedName) {
      setUser({ 
        id: savedId, 
        name: savedName, 
        avatarId: Math.floor(Math.random() * 10) 
      });
    }
    
    // Fetch Decks using onValue (Realtime) instead of get (One-time)
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

    setInitializing(false);
    return () => unsubscribeDecks();
  }, []);

  // Prevent refresh/close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (user || gameState) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user, gameState]);

  // Effect to select the first deck automatically once loaded
  useEffect(() => {
    if (availableDecks.length > 0 && !hasAutoSelectedDecks.current) {
        setSelectedDeckIds(new Set([availableDecks[0].id]));
        hasAutoSelectedDecks.current = true;
    }
  }, [availableDecks]);

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

  // ... (keep existing draw functions) ...
  const drawCardsFromRoom = async (count: number): Promise<string[]> => {
    if (!roomCode) return [];
    
    const deckRef = ref(db, `rooms/${roomCode}/gameDeck/whiteCards`);
    let drawnCards: string[] = [];
    
    try {
      await runTransaction(deckRef, (currentDeck) => {
        if (!currentDeck || !Array.isArray(currentDeck) || currentDeck.length === 0) {
          return currentDeck; 
        }
        
        const available = currentDeck.length;
        const toDraw = Math.min(count, available);
        
        if (toDraw > 0) {
           drawnCards = currentDeck.slice(0, toDraw);
           const newDeck = currentDeck.slice(toDraw); // Resto do deck
           return newDeck;
        }
        return currentDeck;
      });
      return drawnCards; 
    } catch (e) {
      console.error("Erro ao comprar cartas", e);
      return [];
    }
  };

  const moveCardsToInbox = async (amount: number) => {
      if(!roomCode || !user) return;
      
      const roomRef = ref(db, `rooms/${roomCode}`);
      await runTransaction(roomRef, (room) => {
          if (!room || !room.gameDeck || !room.gameDeck.whiteCards) return room;
          
          const deck = room.gameDeck.whiteCards;
          if (deck.length === 0) return room;
          
          const actualAmount = Math.min(amount, deck.length);
          const drawn = [];
          
          // Tira do topo
          for(let i=0; i<actualAmount; i++) {
              drawn.push(deck.pop());
          }
          
          if (!room.players[user.id].inbox) room.players[user.id].inbox = [];
          room.players[user.id].inbox = [...room.players[user.id].inbox, ...drawn];
          
          room.gameDeck.whiteCards = deck;
          return room;
      });
  };

  const consumeInbox = async () => {
     if(!gameState || !user) return;
     // Use gameState.roomCode to be safe
     const currentRoomCode = gameState.roomCode || roomCode;
     if (!currentRoomCode) return;

     const inbox = gameState.players[user.id]?.inbox || [];
     if (inbox.length > 0) {
         setHand(prev => [...prev, ...inbox]);
         // Using firebaseSet explicitly
         await firebaseSet(ref(db, `rooms/${currentRoomCode}/players/${user.id}/inbox`), []);
     }
  };

  useEffect(() => {
     if (gameState && user && gameState.players[user.id]?.inbox?.length > 0) {
         consumeInbox();
     }
  }, [gameState, user]);


  useEffect(() => {
    if (!roomCode) return;

    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data);
      } else {
        setGameState(null);
      }
    });

    return () => unsubscribe();
  }, [roomCode, user]);

  useEffect(() => {
      if (gameState && gameState.phase === 'SUBMISSION' && user) {
          const currentHandSize = hand.length;
          const inboxSize = gameState.players[user.id]?.inbox?.length || 0;
          const needed = 10 - currentHandSize - inboxSize;
          
          if (needed > 0) {
              const timer = setTimeout(() => {
                 moveCardsToInbox(needed);
              }, Math.random() * 1000 + 500); 
              return () => clearTimeout(timer);
          }
      }
  }, [gameState?.phase, hand.length]);

  // --- DECK EDITOR ACTIONS ---

  const handleStartCreateDeck = () => {
      setNewBlackCardText("");
      setNewWhiteCardText("");
      setMinimizeBlack(false);
      setMinimizeWhite(false);
      setEditingDeck({
          name: "",
          description: "",
          password: "",
          blackCards: [],
          whiteCards: []
      });
  };

  const handleCheckPassword = (deckId: string, action: 'EDIT' | 'DELETE') => {
      const deck = availableDecks.find((d: Deck) => d.id === deckId);
      if (!deck) return;
      
      // Se não tiver senha, permite ação direta
      if (!deck.password) {
           if (action === 'DELETE') {
             remove(ref(db, `decks/${deck.id}`));
             showNotification("Deck excluído!");
           } else {
             setNewBlackCardText("");
             setNewWhiteCardText("");
             setMinimizeBlack(false);
             setMinimizeWhite(false);
             setEditingDeck({ ...deck });
           }
           return;
      }
      
      // Se tiver senha, pede
      setDeckPasswordInput("");
      setShowPasswordPrompt({ deckId, action });
  };

  const submitPassword = () => {
      if (!showPasswordPrompt) return;
      
      const deck = availableDecks.find((d: Deck) => d.id === showPasswordPrompt.deckId);
      
      if (deck && deck.password === deckPasswordInput) {
          if (showPasswordPrompt.action === 'DELETE') {
             remove(ref(db, `decks/${deck.id}`));
             showNotification("Deck excluído!");
          } else {
             setNewBlackCardText("");
             setNewWhiteCardText("");
             setMinimizeBlack(false);
             setMinimizeWhite(false);
             setEditingDeck({ ...deck });
          }
          setShowPasswordPrompt(null);
      } else {
          showNotification("Senha incorreta!");
      }
  };

  const handleSaveDeck = async () => {
      if (!editingDeck) return;
      if (!editingDeck.name) return showNotification("Nome é obrigatório");
      // Senha agora é opcional na criação/edição
      
      const isNew = !editingDeck.id;
      const deckData = {
          name: editingDeck.name,
          description: editingDeck.description || "",
          password: editingDeck.password || "", // Salva vazio se não tiver
          blackCards: editingDeck.blackCards || [],
          whiteCards: editingDeck.whiteCards || []
      };

      try {
          if (isNew) {
              await push(ref(db, 'decks'), deckData);
              showNotification("Deck criado com sucesso!");
          } else {
              await update(ref(db, `decks/${editingDeck.id}`), deckData);
              showNotification("Deck atualizado!");
          }
          setEditingDeck(null);
      } catch (e) {
          console.error(e);
          showNotification("Erro ao salvar");
      }
  };

  // --- ACTIONS ---

  const joinGame = async (code: string) => {
    if (!user || !code) return;
    setLoading(true);
    const codeUpper = code.toUpperCase();
    
    const roomRef = ref(db, `rooms/${codeUpper}`);
    const snapshot = await get(roomRef);

    if (snapshot.exists()) {
      const gameData = snapshot.val();
      
      const newPlayer: Player = {
        id: user.id,
        name: user.name,
        score: 0,
        avatarId: user.avatarId,
        isHost: false
      };
      
      await update(roomRef, {
        [`players/${user.id}`]: newPlayer
      });

      setRoomCode(codeUpper);
      setHand([]);
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
      isHost: true
    };

    const initialState: GameState = {
      roomCode: newCode,
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
      selectedDeckIds: []
    };

    // Using firebaseSet explicitly
    await firebaseSet(ref(db, `rooms/${newCode}`), initialState);
    
    setRoomCode(newCode);
    setHand([]);
    setLoading(false);
  };

  const startGame = async () => {
    if (!gameState || !user || !gameState.players[user.id].isHost) return;
    
    const idsToLoad = Array.from(selectedDeckIds);
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
            if(deckData.blackCards) allBlackCards = [...allBlackCards, ...deckData.blackCards];
            if(deckData.whiteCards) allWhiteCards = [...allWhiteCards, ...deckData.whiteCards];
        }
    }
    
    allBlackCards = shuffleArray(allBlackCards);
    allWhiteCards = shuffleArray(allWhiteCards);
    
    await update(ref(db, `rooms/${roomCode}`), {
        gameDeck: {
            blackCards: allBlackCards,
            whiteCards: allWhiteCards
        },
        selectedDeckIds: idsToLoad
    });
    
    setLoading(false);
    startNewRound(true);
  };

  const startNewRound = async (isFirst = false) => {
    if (!gameState || !roomCode) return;

    const playersList = Object.values(gameState.players || {}) as Player[];
    if (playersList.length < 2) {
      showNotification("Precisa de pelo menos 2 jogadores!");
      return;
    }

    let nextJudgeId = gameState.judgeId;

    if (!isFirst) {
      const currentJudgeIdx = playersList.findIndex(p => p.id === gameState.judgeId);
      const nextJudgeIdx = (currentJudgeIdx + 1) % playersList.length;
      nextJudgeId = playersList[nextJudgeIdx].id;
    } 

    await runTransaction(ref(db, `rooms/${roomCode}`), (room) => {
        if (!room || !room.gameDeck || !room.gameDeck.blackCards || room.gameDeck.blackCards.length === 0) {
             return room;
        }
        
        const card = room.gameDeck.blackCards.pop();
        room.blackCard = card;
        
        room.currentRound = (room.currentRound || 0) + 1;
        room.judgeId = nextJudgeId;
        room.phase = 'SUBMISSION';
        room.playedCards = {};
        room.winningCardId = null;
        room.roundWinnerId = null;
        room.guessedPlayerId = null;
        room.actualPlayerId = null;
        room.shuffledOrder = null;
        
        return room;
    });
  };

  const playCard = async (cardText: string) => {
    if (!user || !gameState || !roomCode) return;
    
    // Check if player already played this round
    const hasPlayed = gameState.playedCards && Object.values(gameState.playedCards).some((c: PlayedCard) => c.playerId === user.id);
    if (hasPlayed) {
        showNotification("Você já enviou uma carta nesta rodada!");
        return;
    }

    const newHand = hand.filter(c => c !== cardText);
    setHand(newHand);
    setSelectedCardIndex(null);

    const cardId = `card_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
    const playedCard: PlayedCard = {
      id: cardId,
      playerId: user.id,
      cardText: cardText,
      isHidden: true,
      isRevealed: false
    };

    await update(ref(db, `rooms/${roomCode}/playedCards/${cardId}`), playedCard);
  };
  
  useEffect(() => {
    if (gameState && gameState.phase === 'SUBMISSION' && user && gameState.judgeId === user.id) {
       const playersCount = Object.keys(gameState.players).length;
       const playedCount = gameState.playedCards ? Object.keys(gameState.playedCards).length : 0;
       
       if (playersCount > 1 && playedCount === playersCount - 1) {
         // Create shuffled order
         const cardIds = Object.keys(gameState.playedCards || {});
         const shuffled = shuffleArray(cardIds);
         
         setTimeout(() => {
            update(ref(db, `rooms/${gameState.roomCode}`), { 
                phase: 'JUDGING',
                shuffledOrder: shuffled
            });
         }, 1000);
       }
    }
  }, [gameState?.playedCards, gameState?.phase]);

  const judgeSelectWinner = async (card: PlayedCard) => {
    if (!gameState || !roomCode) return;
    setConfirmWinnerCandidate(null); // Close confirmation modal
    
    await update(ref(db, `rooms/${roomCode}`), {
      winningCardId: card.id,
      actualPlayerId: card.playerId,
      phase: 'GUESSING'
    });
  };

  const revealCard = async (cardId: string) => {
      if (!roomCode) return;
      await update(ref(db, `rooms/${roomCode}/playedCards/${cardId}`), {
          isRevealed: true
      });
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

    await update(ref(db, `rooms/${roomCode}`), updates);
  };

  const leaveRoom = () => {
     setRoomCode("");
     setGameState(null);
     setHand([]);
  };

  const toggleDeck = (deckId: string) => {
      const newSet = new Set(selectedDeckIds);
      if (newSet.has(deckId)) newSet.delete(deckId);
      else newSet.add(deckId);
      setSelectedDeckIds(newSet);
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

        <div className="w-full max-w-md space-y-6 text-center mx-auto my-6 flex flex-col justify-center flex-1">
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
          
          <div className="bg-gray-800 p-6 rounded-2xl shadow-2xl border border-gray-700 w-full">
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
              <Button fullWidth onClick={() => {
                   const input = document.getElementById('nameInput') as HTMLInputElement;
                   handleLogin(input.value);
              }} variant="primary">
                  ENTRAR
              </Button>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="w-full text-center pb-2 text-gray-500 text-xs font-mono">
             Desenvolvido por Kana Sutra - P2 - 1.0.0.0
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
                                        type="text" // Show clear for creator
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
                                    <span className="flex items-center gap-1"><Skull size={14}/> {deck.blackCards?.length || 0}</span>
                                    <span className="flex items-center gap-1"><Smile size={14}/> {deck.whiteCards?.length || 0}</span>
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
         {/* RULES MODAL */}
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

                 <div className="flex gap-2">
                    <input 
                       id="roomInput"
                       type="text" 
                       placeholder="CÓDIGO" 
                       maxLength={4}
                       className="flex-1 bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-center uppercase font-mono tracking-widest focus:ring-2 focus:ring-pink-500 outline-none"
                    />
                    <Button onClick={() => {
                       const input = document.getElementById('roomInput') as HTMLInputElement;
                       joinGame(input.value);
                    }} disabled={loading} variant="secondary">
                       ENTRAR
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
    
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col">
        <header className="flex justify-between items-center mb-6 bg-gray-800 p-4 rounded-xl shadow-lg shrink-0">
          <div className="flex flex-col">
             <span className="text-xs text-gray-400 uppercase">Sala</span>
             <div className="flex items-center gap-2">
                <span className="font-mono text-2xl font-bold text-pink-500 tracking-widest">{gameState.roomCode}</span>
                <button onClick={handleShareRoom} className="text-green-400 hover:text-white flex items-center gap-1 bg-gray-700 px-2 py-1 rounded text-xs ml-2 border border-gray-600">
                    <Share2 size={12}/> Convidar
                </button>
             </div>
          </div>
          <Button variant="secondary" onClick={leaveRoom} className="px-3 py-2 text-xs"><LogOut size={16}/></Button>
        </header>

        <div className="max-w-md mx-auto w-full space-y-6 flex-1 flex flex-col">
          {/* PLAYER LIST */}
          <div className="grid grid-cols-2 gap-4">
            {playersList.map((p) => (
              <div key={p.id} className="bg-gray-800 p-3 rounded-xl flex items-center gap-3 border border-gray-700 relative overflow-hidden">
                <Avatar id={p.avatarId} />
                <div className="flex flex-col z-10 min-w-0">
                  <span className="font-bold truncate text-sm">{p.name}</span>
                  {p.isHost && <span className="text-[10px] text-yellow-500 flex items-center gap-1 uppercase font-bold"><Crown size={10}/> Host</span>}
                </div>
              </div>
            ))}
          </div>

          {/* DECK SELECTION (ONLY HOST) */}
          {isHost ? (
             <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 flex-1 overflow-y-auto min-h-[200px]">
                <div className="flex items-center gap-2 mb-4 text-pink-400">
                    <Database size={18} />
                    <h3 className="font-bold uppercase text-sm">Configuração de Baralhos</h3>
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
                            const isSelected = selectedDeckIds.has(deck.id);
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
             <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                <p className="text-gray-400">O anfitrião está configurando os baralhos...</p>
             </div>
          )}

          <div className="pt-2 pb-6 sticky bottom-0 bg-gray-900">
            {isHost ? (
              <Button fullWidth onClick={startGame} variant="success" disabled={playersList.length < 2 || selectedDeckIds.size === 0 || loading}>
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

  // 4. GAME BOARD
  // (No Changes to game board rendering, just kept it clean for completion if needed)
  const isJudge = gameState.judgeId === user.id;
  const isSubmissionPhase = gameState.phase === 'SUBMISSION';
  const isJudgingPhase = gameState.phase === 'JUDGING';
  const isGuessingPhase = gameState.phase === 'GUESSING';
  const isResultPhase = gameState.phase === 'RESULT';

  // Order logic: if shuffledOrder exists (in Judging), use it. Otherwise use normal order.
  const playedCardsList = (gameState.shuffledOrder 
     ? gameState.shuffledOrder.map(id => gameState.playedCards[id]).filter(Boolean)
     : Object.values(gameState.playedCards || {})) as PlayedCard[];

  // Check if current user has already played a card in this round
  const hasUserPlayed = isSubmissionPhase && Object.values(gameState.playedCards || {}).some((c: any) => c.playerId === user.id);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
      {/* HEADER INFO */}
      <div className="bg-gray-800 p-2 shadow-lg flex justify-between items-center z-20 shrink-0">
         <div className="flex items-center gap-2">
            <div className="bg-gray-700 px-3 py-1 rounded-lg text-xs font-mono border border-gray-600">
               R: {gameState.currentRound}
            </div>
            {isJudge && <div className="bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded-lg text-xs font-bold border border-yellow-500/50 flex items-center gap-1"><Gavel size={12}/> JUIZ</div>}
         </div>
         <div className="font-bold text-pink-500 tracking-widest text-lg">{gameState.roomCode}</div>
      </div>

      {/* GAME AREA */}
      <div className="flex-1 relative flex flex-col overflow-hidden">
         {/* BLACK CARD */}
         <div className="bg-gray-900 p-4 shrink-0 shadow-xl z-10">
            <div className="max-w-md mx-auto">
               <Card text={gameState.blackCard || "..."} type="BLACK" />
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
                        
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <Avatar id={gameState.players[gameState.roundWinnerId || ''].avatarId} />
                            <span className="text-xl font-bold">{gameState.players[gameState.roundWinnerId || ''].name}</span>
                        </div>
                        
                        <div className="text-sm text-gray-400 bg-gray-900/50 p-3 rounded-lg mb-4">
                            {gameState.guessedPlayerId === gameState.actualPlayerId ? (
                                <span className="text-green-400 font-bold">O Juiz acertou! (5 pts cada)</span>
                            ) : (
                                <span className="text-red-400 font-bold">O Juiz errou! (10 pts para o vencedor)</span>
                            )}
                        </div>

                        {isJudge && (
                            <Button fullWidth onClick={() => startNewRound(false)} variant="primary">
                                Próxima Rodada <ArrowRight size={16}/>
                            </Button>
                        )}
                        {!isJudge && <p className="text-xs animate-pulse">Aguardando o Juiz iniciar...</p>}
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