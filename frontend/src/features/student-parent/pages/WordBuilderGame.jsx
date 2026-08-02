import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, Flame, Coins, Heart, Play, RefreshCw, Volume2, HelpCircle,
  SkipForward, BookOpen, CheckCircle, AlertCircle, Award, Check, X,
  Activity, Star, Sparkles, AlertTriangle, ArrowRight, ShieldCheck, Wifi, WifiOff
} from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../common/ui/card';
import { getDifficultyByClass } from '../../../common/constants/predefinedWords';
import { studentService } from '../../../common/services/studentService';
import { useToast } from '../../../common/components/Toast';

// Web Audio API Synthesizer for pleasant educational sounds (Zero assets footprint)
const playTone = (type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    if (type === 'correct') {
      // Pleasant double beep ascending
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      
      osc1.start();
      osc1.stop(ctx.currentTime + 0.3);
    } else if (type === 'wrong') {
      // Soft low buzzer
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.2);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'complete') {
      // Celebration chord
      const freqs = [261.63, 329.63, 392.00, 523.25]; // C major chord
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.05, ctx.currentTime + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.frequency.setValueAtTime(f, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      });
    }
  } catch (e) {
    console.error('Audio synthesis failed', e);
  }
};

export default function WordBuilderGame() {
  const toast = useToast();
  
  // Game Settings & Progression States
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activeTab, setActiveTab] = useState('game'); // 'game' | 'notebook' | 'stats'
  
  // Student Profile Data
  const [studentClass, setStudentClass] = useState('Class 1');
  const [difficulty, setDifficulty] = useState('primary-easy');
  const [playerName, setPlayerName] = useState('Student');
  
  // Core Statistics (Synced with LocalStorage & API)
  const [coins, setCoins] = useState(0);
  const [score, setScore] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [highestStreak, setHighestStreak] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState(0);
  const [totalPlayTime, setTotalPlayTime] = useState(0);
  const [learnedWords, setLearnedWords] = useState([]);
  const [lastClaimedDate, setLastClaimedDate] = useState(null);

  // Active Gameplay States
  const [wordsList, setWordsList] = useState([]);
  const [currentWordIdx, setCurrentWordIdx] = useState(0);
  const [scrambled, setScrambled] = useState([]);
  const [selectedLetters, setSelectedLetters] = useState([]); // indices inside scrambled
  const [lives, setLives] = useState(3);
  const [showResult, setShowResult] = useState(false); // true when resolved (correct or failed 3 times)
  const [isCorrect, setIsCorrect] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [dailyClaimedToday, setDailyClaimedToday] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  useEffect(() => {
    setImageError(false);
  }, [currentWordIdx, wordsList]);

  const [unlockedHints, setUnlockedHints] = useState({
    firstLetter: false,
    meaning: false,
    sentence: false,
    image: false
  });
  const [bufferedPlayedWords, setBufferedPlayedWords] = useState([]);
  
  const isPrePrimary = ['Play Group', 'Nursery', 'LKG', 'UKG'].includes(studentClass);
  
  // Challenge & Gamification states
  const [gameMode, setGameMode] = useState('normal'); // 'normal' | 'daily' | 'weekly'
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [leaderboardSubTab, setLeaderboardSubTab] = useState('school'); // 'school' | 'class' | 'section'
  const [achievementsData, setAchievementsData] = useState([]);
  const [challengesData, setChallengesData] = useState({ daily: null, weekly: null });
  const [loadingChallenge, setLoadingChallenge] = useState(false);
  
  // Playtime accumulator ref
  const timerRef = useRef(null);

  // Track network connectivity
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Internet connected. Syncing progress...');
      triggerSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Offline mode. Progress will be saved locally.');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [coins, score, currentLevel, currentStreak, highestStreak, correctAnswers, wrongAnswers, totalPlayTime, learnedWords]);

  // Track playtime
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTotalPlayTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Fetch initial progress from API or load LocalStorage fallback
  useEffect(() => {
    loadGameProgress();
  }, []);

  // Whenever word list or word index changes, set up current word
  useEffect(() => {
    if (wordsList.length > 0 && wordsList[currentWordIdx]) {
      setupWord(wordsList[currentWordIdx].word);
    }
  }, [wordsList, currentWordIdx]);

  // Save to LocalStorage whenever state changes
  useEffect(() => {
    if (!loading) {
      saveLocalData();
    }
  }, [coins, score, currentLevel, currentStreak, highestStreak, correctAnswers, wrongAnswers, totalPlayTime, learnedWords, lastClaimedDate]);

  // Fetch data dynamically on tab shifts
  useEffect(() => {
    if (activeTab === 'leaderboard') {
      fetchLeaderboard();
    } else if (activeTab === 'achievements') {
      fetchAchievements();
    } else if (activeTab === 'challenges') {
      fetchChallengesStatus();
    }
  }, [activeTab]);

  const fetchLeaderboard = async () => {
    if (!navigator.onLine) return;
    try {
      const res = await studentService.getVocabularyLeaderboard();
      if (res?.success) {
        setLeaderboardData(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAchievements = async () => {
    if (!navigator.onLine) return;
    try {
      const res = await studentService.getVocabularyAchievements();
      if (res?.success) {
        setAchievementsData(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchChallengesStatus = async () => {
    if (!navigator.onLine) return;
    try {
      const [dailyRes, weeklyRes] = await Promise.all([
        studentService.getDailyChallenge(),
        studentService.getWeeklyChallenge()
      ]);
      setChallengesData({
        daily: dailyRes?.data || null,
        weekly: weeklyRes?.data || null
      });
    } catch (e) {
      console.error(e);
    }
  };

  const startChallenge = async (type) => {
    setLoadingChallenge(true);
    setGameMode(type);
    try {
      const res = type === 'daily' 
        ? await studentService.getDailyChallenge()
        : await studentService.getWeeklyChallenge();
        
      if (res?.success && res.data?.words) {
        setWordsList(res.data.words);
        setCurrentWordIdx(0);
        setActiveTab('game');
        setupWord(res.data.words[0].word);
        toast.info(`Started ${type === 'daily' ? 'Daily Challenge' : 'Weekly Review Test'}!`);
      }
    } catch (e) {
      toast.error('Failed to load challenge.');
    } finally {
      setLoadingChallenge(false);
    }
  };

  const handleChallengeCompleted = async () => {
    try {
      const res = gameMode === 'daily'
        ? await studentService.submitDailyChallenge({})
        : await studentService.submitWeeklyChallenge({});
      if (res?.success) {
        playTone('complete');
        toast.success(res.message);
        fetchChallengesStatus();
        setGameMode('normal');
        loadGameProgress();
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to submit challenge results.');
    }
  };

  const loadGameProgress = async () => {
    setLoading(true);
    try {
      // 1. Try fetching from server API if online
      if (navigator.onLine) {
        const res = await studentService.getGameProgress();
        if (res?.success && res?.data) {
          const apiData = res.data;
          setStudentClass(apiData.student_class || 'Class 1');
          const diff = getDifficultyByClass(apiData.student_class);
          setDifficulty(diff);
          
          const prog = apiData.progress;
          setCoins(prog.coins || 0);
          setScore(prog.score || 0);
          setCurrentLevel(prog.current_level || 1);
          setCurrentStreak(prog.current_streak || 0);
          setHighestStreak(prog.highest_streak || 0);
          setCorrectAnswers(prog.correct_answers || 0);
          setWrongAnswers(prog.wrong_answers || 0);
          setTotalPlayTime(prog.total_play_time || 0);
          setLastClaimedDate(prog.last_login_reward_date);
          
          const getLocalDate = () => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          };
          const today = getLocalDate();
          setDailyClaimedToday(prog.last_login_reward_date === today);
          
          setLearnedWords(apiData.learned_words || []);
          
          // Seed gameplay list from server active words
          setWordsList(apiData.active_words || []);
          localStorage.setItem('wb_cached_words', JSON.stringify(apiData.active_words || []));
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.error('API load failed, falling back to LocalStorage', e);
    }

    // 2. LocalStorage fallback (reads cached progress)
    const local = localStorage.getItem('wb_game_progress');
    const studentInfo = localStorage.getItem('wb_student_info');
    
    if (studentInfo) {
      const info = JSON.parse(studentInfo);
      setStudentClass(info.class || 'Class 1');
      setDifficulty(getDifficultyByClass(info.class));
    }
    
    if (local) {
      const data = JSON.parse(local);
      setCoins(data.coins || 0);
      setScore(data.score || 0);
      setCurrentLevel(data.currentLevel || 1);
      setCurrentStreak(data.currentStreak || 0);
      setHighestStreak(data.highestStreak || 0);
      setCorrectAnswers(data.correctAnswers || 0);
      setWrongAnswers(data.wrongAnswers || 0);
      setTotalPlayTime(data.totalPlayTime || 0);
      setLearnedWords(data.learnedWords || []);
      setLastClaimedDate(data.lastClaimedDate);
      
      const dLocal = new Date();
      const today = `${dLocal.getFullYear()}-${String(dLocal.getMonth() + 1).padStart(2, '0')}-${String(dLocal.getDate()).padStart(2, '0')}`;
      setDailyClaimedToday(data.lastClaimedDate === today);
      
      // Fallback: use previously loaded wordsList from local cache if offline
      const cachedList = localStorage.getItem('wb_cached_words');
      if (cachedList) {
        setWordsList(JSON.parse(cachedList));
      }
    }
    setLoading(false);
  };

  const setupWord = (word) => {
    // Reset word level states
    setShowResult(false);
    setIsCorrect(false);
    setShowHint(false);
    setLives(3);
    setSelectedLetters([]);
    setUnlockedHints({
      firstLetter: false,
      meaning: false,
      sentence: false,
      image: false
    });
    
    // Scramble letters
    const letters = word.split('');
    let shuffled = [...letters];
    let attempts = 0;
    while (attempts < 5) {
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      if (shuffled.join('') !== word) break;
      attempts++;
    }
    setScrambled(shuffled);
  };

  const saveLocalData = () => {
    const data = {
      coins,
      score,
      currentLevel,
      currentStreak,
      highestStreak,
      correctAnswers,
      wrongAnswers,
      totalPlayTime,
      learnedWords,
      lastClaimedDate
    };
    localStorage.setItem('wb_game_progress', JSON.stringify(data));
  };

  const triggerSync = async (nextLvl = currentLevel) => {
    if (!navigator.onLine) return;
    try {
      const syncData = {
        coins,
        score,
        current_level: nextLvl,
        current_streak: currentStreak,
        highest_streak: highestStreak,
        correct_answers: correctAnswers,
        wrong_answers: wrongAnswers,
        total_play_time: totalPlayTime,
        played_words: bufferedPlayedWords
      };
      const res = await studentService.syncGameProgress(syncData);
      if (res?.success && res?.data) {
        const apiData = res.data;
        setCoins(apiData.progress.coins || 0);
        setScore(apiData.progress.score || 0);
        setCurrentLevel(apiData.progress.current_level || nextLvl);
        setCurrentStreak(apiData.progress.current_streak || 0);
        setHighestStreak(apiData.progress.highest_streak || 0);
        setCorrectAnswers(apiData.progress.correct_answers || 0);
        setWrongAnswers(apiData.progress.wrong_answers || 0);
        setTotalPlayTime(apiData.progress.total_play_time || 0);
        setLearnedWords(apiData.learned_words || []);
        
        // Cache active words list locally for offline fallback
        localStorage.setItem('wb_cached_words', JSON.stringify(apiData.active_words || []));
        setWordsList(apiData.active_words || []);
        setCurrentWordIdx(0);
        setBufferedPlayedWords([]);
        console.log('Progress synced and next level words loaded successfully.');
      }
    } catch (e) {
      console.error('Progress sync failed', e);
    }
  };

  const handleClaimDaily = async () => {
    if (dailyClaimedToday) return;

    if (navigator.onLine) {
      try {
        const res = await studentService.claimDailyLogin();
        if (res?.success) {
          toast.success(res.message);
          setDailyClaimedToday(true);
          const dClaim = new Date();
          const today = `${dClaim.getFullYear()}-${String(dClaim.getMonth() + 1).padStart(2, '0')}-${String(dClaim.getDate()).padStart(2, '0')}`;
          setLastClaimedDate(today);
          setCoins(prev => prev + 20);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Offline claim fallback
    setCoins(prev => prev + 20);
    setDailyClaimedToday(true);
    const dClaimOff = new Date();
    const today = `${dClaimOff.getFullYear()}-${String(dClaimOff.getMonth() + 1).padStart(2, '0')}-${String(dClaimOff.getDate()).padStart(2, '0')}`;
    setLastClaimedDate(today);
    toast.success('Daily login claimed! +20 Coins saved locally.');
  };

  const selectLetter = (scrambledIdx) => {
    if (showResult) return;
    
    // Remove if already selected
    if (selectedLetters.includes(scrambledIdx)) {
      setSelectedLetters(prev => prev.filter(idx => idx !== scrambledIdx));
      return;
    }
    
    // Add to selection
    setSelectedLetters(prev => [...prev, scrambledIdx]);
  };

  const handleTextToSpeech = (text) => {
    const currentWord = wordsList[currentWordIdx];
    if (currentWord?.audio_path) {
      const audio = new Audio(currentWord.audio_path);
      audio.play().catch(e => {
        console.error('Custom audio playback failed, falling back to TTS', e);
        playSpeechSynthesis(text);
      });
    } else {
      playSpeechSynthesis(text);
    }
  };

  const playSpeechSynthesis = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    } else {
      toast.warning('Text-to-speech is not supported on this device.');
    }
  };

  const handleVerifyAnswer = () => {
    const currentWord = wordsList[currentWordIdx];
    const spelling = selectedLetters.map(idx => scrambled[idx]).join('');
    
    if (spelling.length !== currentWord.word.length) {
      toast.warning('Spell the complete word first!');
      return;
    }

    const totalHints = (unlockedHints.firstLetter ? 1 : 0) + 
                       (unlockedHints.meaning ? 1 : 0) + 
                       (unlockedHints.sentence ? 1 : 0) + 
                       (unlockedHints.image ? 1 : 0);

    if (spelling === currentWord.word) {
      // CORRECT SPELLED
      playTone('correct');
      setIsCorrect(true);
      setShowResult(true);
      setCorrectAnswers(prev => prev + 1);
      
      const newStreak = currentStreak + 1;
      setCurrentStreak(newStreak);
      if (newStreak > highestStreak) setHighestStreak(newStreak);
      
      // Coins award
      let coinReward = 10;
      if (newStreak > 0 && newStreak % 10 === 0) {
        coinReward += 50; // Celebrate perfect streak
        toast.success(`🎉 Perfect 10 Streak Bonus! +50 Coins!`);
      }
      setCoins(prev => prev + coinReward);
      setScore(prev => prev + 20);

      // Buffer this word log
      const playedWordLog = {
        word_id: currentWord.id,
        is_correct: true,
        hints_used: totalHints
      };
      setBufferedPlayedWords(prev => [...prev, playedWordLog]);
      
      // Speak pronunciation automatically on success
      handleTextToSpeech(currentWord.word);
    } else {
      // WRONG ANSWER
      playTone('wrong');
      const remainingLives = lives - 1;
      setLives(remainingLives);
      setSelectedLetters([]); // clear answer for retry
      
      if (remainingLives <= 0) {
        // Failed 3 attempts
        setIsCorrect(false);
        setShowResult(true);
        setWrongAnswers(prev => prev + 1);
        setCurrentStreak(0); // reset streak
        setCoins(prev => prev + 2); // wrong answer reward after retries
        toast.info('Answer revealed! Let\'s read the meaning to learn.');

        // Buffer this word log as incorrect
        const playedWordLog = {
          word_id: currentWord.id,
          is_correct: false,
          hints_used: totalHints
        };
        setBufferedPlayedWords(prev => [...prev, playedWordLog]);
      } else {
        toast.error(`Wrong spelling! ${remainingLives} attempts left.`);
      }
    }
  };

  const handleUseHint = () => {
    if (coins < 5) {
      toast.warning('Not enough coins! Hints cost 5 coins.');
      return;
    }
    setCoins(prev => prev - 5);
    setUnlockedHints(prev => ({ ...prev, meaning: true }));
    toast.success('Meaning hint unlocked! (Cost: 5 coins)');
  };

  const handleSkipWord = () => {
    if (coins < 10) {
      toast.warning('Not enough coins! Skips cost 10 coins.');
      return;
    }
    const currentWord = wordsList[currentWordIdx];
    const playedWordLog = {
      word_id: currentWord.id,
      is_correct: false,
      hints_used: 0
    };
    setBufferedPlayedWords(prev => [...prev, playedWordLog]);
    setCoins(prev => prev - 10);
    toast.info('Word skipped! (Cost: 10 coins)');
    handleNextWord();
  };

  const handleNextWord = () => {
    if (currentWordIdx < wordsList.length - 1) {
      setCurrentWordIdx(prev => prev + 1);
    } else {
      if (gameMode !== 'normal') {
        handleChallengeCompleted();
      } else {
        // LEVEL COMPLETED!
        playTone('complete');
        toast.success(`🎉 Level ${currentLevel} Completed!`);
        const nextLvl = currentLevel + 1;
        setCurrentLevel(nextLvl);
        
        // Reset level word sequence
        triggerSync(nextLvl);
      }
    }
  };

  return (
    <div className="flex justify-center items-start min-h-[calc(100vh-140px)] w-full py-4 px-2">
      {/* Premium Mobile Simulator Frame */}
      <div className="w-full max-w-[430px] min-h-[82vh] bg-background border-4 border-border rounded-[36px] shadow-lg flex flex-col justify-between overflow-hidden relative font-sans">
        
        {/* Top Header Panel */}
        <div className="bg-background px-5 pt-5 pb-3 border-b border-border flex flex-col gap-2.5 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-bold text-[11px]">
                {playerName.charAt(0)}
              </div>
              <div>
                <p className="text-[11px] font-bold text-text-primary truncate max-w-[80px]">{playerName}</p>
                <p className="text-[8px] font-bold text-text-muted mt-0.5">{studentClass}</p>
              </div>
            </div>
            
            {/* Sync Badge */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-border bg-white text-[8px] font-bold text-text-secondary">
              {isOnline ? (
                <>
                  <Wifi className="h-2.5 w-2.5 text-emerald-600" />
                  <span className="text-emerald-700">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-2.5 w-2.5 text-amber-600" />
                  <span className="text-amber-700">Offline</span>
                </>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-1 pt-1.5">
            <div className="bg-white border border-border px-2 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs">
              <Trophy className="h-3 w-3 text-amber-500 flex-shrink-0" />
              <div className="min-w-0">
                <span className="block text-[7px] text-text-muted font-bold uppercase tracking-wider leading-none">Score</span>
                <span className="text-xs font-bold text-text-primary leading-none tabular-nums mt-0.5 block">{score}</span>
              </div>
            </div>
            
            <div className="bg-white border border-border px-2 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs">
              <Coins className="h-3 w-3 text-yellow-500 flex-shrink-0" />
              <div className="min-w-0">
                <span className="block text-[7px] text-text-muted font-bold uppercase tracking-wider leading-none">Coins</span>
                <span className="text-xs font-bold text-text-primary leading-none tabular-nums mt-0.5 block">{coins}</span>
              </div>
            </div>

            <div className="bg-white border border-border px-2 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs">
              <Flame className="h-3 w-3 text-orange-500 flex-shrink-0" />
              <div className="min-w-0">
                <span className="block text-[7px] text-text-muted font-bold uppercase tracking-wider leading-none">Streak</span>
                <span className="text-xs font-bold text-text-primary leading-none tabular-nums mt-0.5 block">{currentStreak}</span>
              </div>
            </div>

            <div className="bg-white border border-border px-2 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs">
              <Award className="h-3 w-3 text-indigo-500 flex-shrink-0" />
              <div className="min-w-0">
                <span className="block text-[7px] text-text-muted font-bold uppercase tracking-wider leading-none">
                  {gameMode === 'daily' ? 'Daily' : gameMode === 'weekly' ? 'Weekly' : `Lvl ${currentLevel}`}
                </span>
                <span className="text-[11px] font-bold text-text-primary leading-none mt-0.5 block truncate">
                  Word {currentWordIdx + 1}/{wordsList.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab View Container */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-[420px] bg-background">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Loading Word Builder...</p>
            </div>
          ) : activeTab === 'game' ? (
            // GAMEPLAY MODE
            <div className="space-y-4">
              
              {/* Daily Claim Banner */}
              {!dailyClaimedToday && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    <div>
                      <p className="text-[11px] font-bold text-amber-800 leading-none">Daily Login Reward!</p>
                      <p className="text-[8px] text-text-secondary mt-0.5 leading-none">Claim your daily +20 Coins</p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleClaimDaily}
                    className="h-6 px-2.5 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white border-none rounded-lg shadow-sm"
                  >
                    Claim
                  </Button>
                </div>
              )}

              {/* Central Gameplay Card */}
              {wordsList[currentWordIdx] && (
                <Card className="border border-border shadow-sm rounded-3xl overflow-hidden bg-white">
                  <CardHeader className="bg-surface-sunken border-b border-border py-3 px-5 flex flex-row items-center justify-between">
                    <span className="text-[11px] font-bold text-text-primary uppercase tracking-wider">
                      Category: {wordsList[currentWordIdx].category}
                    </span>
                    
                    {/* Lives Counter */}
                    <div className="flex items-center gap-1">
                      {[1, 2, 3].map(h => (
                        <Heart 
                          key={h} 
                          className={`h-4.5 w-4.5 transition-all ${
                            h <= lives 
                              ? 'text-rose-500 fill-rose-500 scale-100' 
                              : 'text-zinc-300 scale-90'
                          }`} 
                        />
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 text-center space-y-5">
                    
                    {/* Visual Illustration Area */}
                    {wordsList[currentWordIdx].image_path && (
                      <div className="flex justify-center items-center py-1">
                        <div className="relative w-28 h-28 rounded-2xl overflow-hidden border border-border bg-white flex items-center justify-center shadow-2xs">
                          {imageError ? (
                            <div className="flex flex-col items-center justify-center gap-1.5 p-2">
                              <HelpCircle className="h-6 w-6 text-text-muted animate-pulse" />
                              <span className="text-[8px] font-bold text-text-muted uppercase tracking-wider text-center">Illustration Pending</span>
                            </div>
                          ) : (isPrePrimary || unlockedHints.image) ? (
                            <img 
                              src={wordsList[currentWordIdx].image_path} 
                              alt={wordsList[currentWordIdx].word} 
                              onError={() => setImageError(true)}
                              className="w-24 h-24 object-contain transition-all duration-300"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-1.5 p-2">
                              <HelpCircle className="h-6 w-6 text-text-muted animate-pulse" />
                              <span className="text-[8px] font-bold text-text-muted uppercase tracking-wider text-center">Image Hint Locked</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Granular Hint Panel */}
                    <div className="bg-background border border-border rounded-2xl p-4 space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[8px] font-bold text-text-muted uppercase tracking-wider">Available Hints</span>
                        <span className="text-[8px] font-bold text-text-secondary">Coins: {coins} 🪙</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          disabled={unlockedHints.firstLetter || coins < 5}
                          onClick={() => {
                            setCoins(prev => prev - 5);
                            setUnlockedHints(prev => ({ ...prev, firstLetter: true }));
                            toast.success("First letter revealed!");
                          }}
                          variant="outline"
                          className="h-8 text-[11px] font-bold flex items-center justify-center gap-1 border border-border rounded-lg shadow-3xs"
                        >
                          {unlockedHints.firstLetter ? `Starts with: ${wordsList[currentWordIdx].word.charAt(0)}` : "First Letter (5 🪙)"}
                        </Button>

                        <Button
                          disabled={unlockedHints.meaning || coins < 5}
                          onClick={() => {
                            setCoins(prev => prev - 5);
                            setUnlockedHints(prev => ({ ...prev, meaning: true }));
                            toast.success("Meaning unlocked!");
                          }}
                          variant="outline"
                          className="h-8 text-[11px] font-bold flex items-center justify-center gap-1 border border-border rounded-lg shadow-3xs"
                        >
                          {unlockedHints.meaning ? "Meaning Unlocked" : "Meaning (5 🪙)"}
                        </Button>

                        <Button
                          disabled={unlockedHints.sentence || coins < 5}
                          onClick={() => {
                            setCoins(prev => prev - 5);
                            setUnlockedHints(prev => ({ ...prev, sentence: true }));
                            toast.success("Sentence unlocked!");
                          }}
                          variant="outline"
                          className="h-8 text-[11px] font-bold flex items-center justify-center gap-1 border border-border rounded-lg shadow-3xs"
                        >
                          {unlockedHints.sentence ? "Sentence Unlocked" : "Sentence (5 🪙)"}
                        </Button>

                        {wordsList[currentWordIdx].image_path && (
                          <Button
                            disabled={isPrePrimary || unlockedHints.image || coins < 10}
                            onClick={() => {
                              setCoins(prev => prev - 10);
                              setUnlockedHints(prev => ({ ...prev, image: true }));
                              toast.success("Image revealed!");
                            }}
                            variant="outline"
                            className="h-8 text-[11px] font-bold flex items-center justify-center gap-1 border border-border rounded-lg shadow-3xs"
                          >
                            {(isPrePrimary || unlockedHints.image) ? "Image Unlocked" : "Reveal Image (10 🪙)"}
                          </Button>
                        )}
                      </div>

                      {(unlockedHints.meaning || unlockedHints.sentence) && (
                        <div className="border-t border-dashed border-border pt-2.5 text-left space-y-1.5">
                          {unlockedHints.meaning && (
                            <p className="text-[11px] text-text-primary font-bold">
                              💡 <span className="font-bold text-text-secondary">Meaning:</span> {wordsList[currentWordIdx].english_meaning} ({wordsList[currentWordIdx].hindi_meaning})
                            </p>
                          )}
                          {unlockedHints.sentence && (
                            <p className="text-[11px] text-text-primary font-bold leading-relaxed">
                              📝 <span className="font-bold text-text-secondary">Sentence:</span> "{wordsList[currentWordIdx].english_sentence}"
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* spelling slots area */}
                    <div className="flex flex-wrap justify-center gap-1.5 min-h-[50px] items-center py-2.5">
                      {scrambled.map((_, idx) => {
                        const filledLetterIdx = selectedLetters[idx];
                        const letter = filledLetterIdx !== undefined ? scrambled[filledLetterIdx] : '';
                        
                        return (
                          <div 
                            key={idx} 
                            className={`w-9 h-11 border-2 rounded-xl flex items-center justify-center text-lg font-bold tracking-tight transition-all duration-150 ${
                              letter 
                                ? 'bg-primary border-primary text-white scale-100 shadow-sm' 
                                : 'bg-background border-dashed border-border text-transparent scale-95'
                            }`}
                          >
                            {letter}
                          </div>
                        );
                      })}
                    </div>

                    {/* Scrambled letter tiles */}
                    <div className="space-y-2 pt-2">
                      <p className="text-[8px] font-bold text-text-muted uppercase tracking-wider">Tap letters to arrange</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {scrambled.map((char, idx) => {
                          const isSelected = selectedLetters.includes(idx);
                          return (
                            <button
                              key={idx}
                              onClick={() => selectLetter(idx)}
                              disabled={showResult}
                              className={`w-10 h-10 rounded-xl text-md font-bold flex items-center justify-center border-2 transition-all shadow-2xs select-none active:scale-95 ${
                                isSelected
                                  ? 'bg-surface-sunken border-border text-[#9ca3af] cursor-not-allowed scale-90'
                                  : 'bg-white border-border text-text-primary hover:border-primary/80 hover:bg-zinc-50'
                              }`}
                            >
                              {char}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Verification Action */}
                    {!showResult && (
                      <div className="flex gap-2.5 pt-2">
                        <Button 
                          onClick={handleSkipWord}
                          variant="outline"
                          className="flex-1 h-10 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 border border-border rounded-xl"
                        >
                          <SkipForward className="h-3.5 w-3.5" /> Skip (10 🪙)
                        </Button>
                        <Button 
                          onClick={handleVerifyAnswer}
                          className="flex-1 h-10 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center bg-primary text-white rounded-xl shadow-md"
                        >
                          Verify
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Resolved Overlay Panel (Meaning, Pronunciation, Next level actions) */}
              {showResult && wordsList[currentWordIdx] && (
                <div className="bg-white border border-border rounded-3xl p-5 shadow-sm space-y-4 animate-in slide-in-from-bottom duration-300">
                  <div className="flex items-center gap-2.5">
                    {isCorrect ? (
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                        <Check className="h-5.5 w-5.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-600">
                        <X className="h-5.5 w-5.5 stroke-[3]" />
                      </div>
                    )
                    }
                    <div>
                      <h4 className="text-sm font-bold text-text-primary">
                        {isCorrect ? '🎉 Correct Answer!' : '😞 Nice Try!'}
                      </h4>
                      <p className="text-[11px] text-text-muted font-bold mt-0.5 leading-none">
                        Word: <span className="text-text-primary text-xs font-bold">{wordsList[currentWordIdx].word}</span>
                      </p>
                    </div>
                  </div>

                  {/* Pronunciation & Meaning detail */}
                  <div className="bg-background border border-border rounded-2xl p-4 space-y-3.5 text-left">
                    <div className="flex items-center justify-between border-b border-border/80 pb-2">
                      <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Pronunciation & Meaning</span>
                      <button 
                        onClick={() => handleTextToSpeech(wordsList[currentWordIdx].word)}
                        className="w-7 h-7 rounded-full bg-primary/10 text-text-primary hover:bg-primary/20 flex items-center justify-center transition-colors"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <span className="text-[8px] font-bold text-text-muted uppercase tracking-wider block">English Meaning</span>
                        <p className="text-xs text-text-primary font-bold">{wordsList[currentWordIdx].english_meaning}</p>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-text-muted uppercase tracking-wider block">Hindi Meaning</span>
                        <p className="text-xs text-text-primary font-bold font-sans">{wordsList[currentWordIdx].hindi_meaning}</p>
                      </div>
                      <div className="pt-1.5 border-t border-dashed border-border">
                        <span className="text-[8px] font-bold text-text-muted uppercase tracking-wider block">Example Sentence</span>
                        <p className="text-xs text-text-primary font-bold">"{wordsList[currentWordIdx].english_sentence}"</p>
                        <p className="text-[11px] text-text-muted font-semibold mt-1 font-sans">"{wordsList[currentWordIdx].hindi_sentence}"</p>
                      </div>
                    </div>
                  </div>

                  <Button 
                    onClick={handleNextWord}
                    className="w-full h-11 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 bg-primary text-white rounded-xl shadow-md"
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ) : activeTab === 'notebook' ? (
            // VOCABULARY NOTEBOOK MODE
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-text-primary tracking-tight font-display">My Learned Words</h3>
              </div>
              <p className="text-[11px] text-text-secondary leading-relaxed font-bold">
                Every correctly answered word is saved here. Tap the speaker icon to hear the pronunciation.
              </p>

              <div className="space-y-3 pt-2">
                {learnedWords.length === 0 ? (
                  <div className="bg-white border border-border p-8 text-center rounded-3xl space-y-2">
                    <p className="text-xs text-text-muted font-bold">Your vocabulary dictionary is empty.</p>
                    <p className="text-[11px] text-text-secondary">Spell words correctly in gameplay mode to add them here.</p>
                  </div>
                ) : (
                  learnedWords.map(wordObj => {
                    return (
                      <Card key={wordObj.id} className="border border-border rounded-2xl bg-white shadow-2xs">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-border/60 pb-2">
                            <div>
                              <h4 className="text-sm font-bold text-text-primary tracking-wide leading-none">{wordObj.word}</h4>
                              <span className="text-[7px] font-bold text-text-muted uppercase tracking-wider mt-1 block">
                                {wordObj.category}
                              </span>
                            </div>
                            <button
                              onClick={() => handleTextToSpeech(wordObj.word)}
                              className="w-7 h-7 rounded-full bg-primary/10 text-text-primary hover:bg-primary/20 flex items-center justify-center transition-colors"
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          
                          <div className="space-y-1.5 text-[11px] text-text-secondary font-bold">
                            <p><span className="text-text-muted text-[11px] uppercase block">Meaning</span> {wordObj.english_meaning}</p>
                            <p><span className="text-text-muted text-[11px] uppercase block font-sans">Hindi Meaning</span> {wordObj.hindi_meaning}</p>
                            <div className="pt-1.5 border-t border-dashed border-border/80">
                              <p><span className="text-text-muted text-[11px] uppercase block">Example</span> "{wordObj.english_sentence}"</p>
                              <p className="text-text-muted font-normal mt-0.5 font-sans">"{wordObj.hindi_sentence}"</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          ) : activeTab === 'stats' ? (
            // STATS & PROGRESS TRACKING MODE
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-text-primary tracking-tight font-display">Progress & Stats</h3>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-white border border-border p-3 rounded-2xl shadow-2xs">
                  <span className="block text-[8px] text-text-muted font-bold uppercase tracking-wider leading-none">Words Learned</span>
                  <span className="text-2xl font-bold text-text-primary tracking-tight mt-1.5 block tabular-nums leading-none">
                    {learnedWords.length}
                  </span>
                </div>
                
                <div className="bg-white border border-border p-3 rounded-2xl shadow-2xs">
                  <span className="block text-[8px] text-text-muted font-bold uppercase tracking-wider leading-none">Accuracy Rate</span>
                  <span className="text-2xl font-bold text-text-primary tracking-tight mt-1.5 block tabular-nums leading-none">
                    {correctAnswers + wrongAnswers > 0 
                      ? Math.round((correctAnswers / (correctAnswers + wrongAnswers)) * 100) 
                      : 0}%
                  </span>
                </div>

                <div className="bg-white border border-border p-3 rounded-2xl shadow-2xs">
                  <span className="block text-[8px] text-text-muted font-bold uppercase tracking-wider leading-none">Answers Status</span>
                  <span className="text-xs font-bold text-emerald-600 block mt-2.5 tabular-nums leading-none">
                    ✓ {correctAnswers} Correct
                  </span>
                  <span className="text-xs font-bold text-red-500 block mt-1.5 tabular-nums leading-none">
                    ✕ {wrongAnswers} Wrong
                  </span>
                </div>

                <div className="bg-white border border-border p-3 rounded-2xl shadow-2xs">
                  <span className="block text-[8px] text-text-muted font-bold uppercase tracking-wider leading-none">Play Time</span>
                  <span className="text-lg font-bold text-text-primary tracking-tight mt-2 block tabular-nums leading-none">
                    {Math.floor(totalPlayTime / 60)}m {totalPlayTime % 60}s
                  </span>
                  <span className="text-[7px] text-text-muted font-bold block mt-1 uppercase">Total play session</span>
                </div>
              </div>

              {/* Trophy Accomplishments Card */}
              <Card className="border border-border rounded-2xl bg-white shadow-2xs mt-1">
                <CardContent className="p-4 space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Achievements</h4>
                  </div>

                  <div className="space-y-3 text-[11px] text-text-secondary font-bold">
                    <div className="flex items-center justify-between">
                      <p>Highest Correct Streak</p>
                      <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 tabular-nums">
                        {highestStreak} Words
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <p>Predefined Word Difficulty</p>
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-text-primary uppercase text-[8px]">
                        {difficulty}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <p>Daily Login Streak Badge</p>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 uppercase text-[8px] flex items-center gap-0.5">
                        <Check className="h-3 w-3 stroke-[3]" /> Active
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : activeTab === 'challenges' ? (
            // CHALLENGES MODE VIEW
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-text-primary tracking-tight font-display">Challenges</h3>
              </div>
              <p className="text-[11px] text-text-secondary leading-relaxed font-bold">
                Solve unique challenges every day and week to earn trophies, coins, and extra XP!
              </p>

              {loadingChallenge ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Starting challenge...</span>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  {/* Daily Challenge Card */}
                  <Card className="border border-border rounded-2xl bg-white shadow-2xs">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-sm font-bold text-text-primary">Daily Word Theme</h4>
                          <p className="text-[11px] text-text-muted mt-0.5">10 questions · Topic-specific vocabulary</p>
                        </div>
                        {challengesData.daily?.completed ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[8px] font-bold uppercase">Completed</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[8px] font-bold uppercase">Available</span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-[11px] font-bold text-text-secondary uppercase">
                        <div>XP: <span className="text-text-primary font-bold">+100</span></div>
                        <div>Coins: <span className="text-text-primary font-bold">+50</span></div>
                      </div>

                      {!challengesData.daily?.completed && (
                        <Button 
                          onClick={() => startChallenge('daily')}
                          className="w-full text-xs font-bold uppercase tracking-wider py-2 justify-center bg-primary text-white"
                        >
                          Start Daily Challenge
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  {/* Weekly Challenge Card */}
                  <Card className="border border-border rounded-2xl bg-white shadow-2xs">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-sm font-bold text-text-primary">Weekly Review Test</h4>
                          <p className="text-[11px] text-text-muted mt-0.5">20 questions · Spaced-repetition review</p>
                        </div>
                        {challengesData.weekly?.completed ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[8px] font-bold uppercase">Completed</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[8px] font-bold uppercase">Available</span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-[11px] font-bold text-text-secondary uppercase">
                        <div>XP: <span className="text-text-primary font-bold">+250</span></div>
                        <div>Coins: <span className="text-text-primary font-bold">+100</span></div>
                        <div>Badge: <span className="text-text-primary font-bold">Trophy</span></div>
                      </div>

                      {!challengesData.weekly?.completed && (
                        <Button 
                          onClick={() => startChallenge('weekly')}
                          className="w-full text-xs font-bold uppercase tracking-wider py-2 justify-center bg-zinc-900 text-white dark:bg-white dark:text-black"
                        >
                          Start Weekly Challenge
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          ) : activeTab === 'leaderboard' ? (
            // LEADERBOARD RATING VIEW
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-text-primary tracking-tight font-display">Leaderboard</h3>
              </div>

              {/* Sub tabs selector */}
              <div className="flex border border-border rounded-xl overflow-hidden text-[11px] font-bold uppercase tracking-wider">
                {['school', 'class', 'section'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setLeaderboardSubTab(tab)}
                    className={`flex-1 py-1.5 text-center transition-colors ${
                      leaderboardSubTab === tab 
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' 
                        : 'bg-white text-text-secondary hover:bg-zinc-50'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="space-y-2.5 pt-2">
                {!leaderboardData ? (
                  <div className="text-center py-8 text-xs text-text-muted font-bold">
                    No leaderboard scores loaded.
                  </div>
                ) : (
                  (leaderboardSubTab === 'school' ? leaderboardData.school_rankings :
                   leaderboardSubTab === 'class' ? leaderboardData.class_rankings :
                   leaderboardData.section_rankings).map((row, idx) => {
                    const medals = ['🥇', '🥈', '🥉'];
                    return (
                      <div 
                        key={row.id}
                        className={`flex items-center justify-between p-3.5 bg-white border border-border rounded-2xl shadow-2xs transition-all ${
                          row.id === studentService.getCurrentUser()?.student_id ? 'border-primary/60 bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-text-muted w-6 block">
                            {idx < 3 ? medals[idx] : `#${idx + 1}`}
                          </span>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-text-primary block truncate">{row.name}</span>
                            <span className="text-[7px] font-bold text-text-muted block mt-0.5 uppercase">
                              {row.total_words_mastered} mastered
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-text-primary tabular-nums">
                          {row.score} XP
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            // ACHIEVEMENTS / BADGES VIEW
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-text-primary tracking-tight font-display">My Badges</h3>
              </div>
              <p className="text-[11px] text-text-secondary leading-relaxed font-bold">
                Check your unlocked accolades and practice milestones below.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                {achievementsData.length === 0 ? (
                  <div className="col-span-2 text-center py-8 text-xs text-text-muted font-bold">
                    Achievements are currently loading...
                  </div>
                ) : (
                  achievementsData.map(badge => (
                    <Card 
                      key={badge.key} 
                      className={`border border-border rounded-2xl transition-all ${
                        badge.unlocked ? 'bg-white opacity-100 shadow-2xs' : 'bg-background opacity-60'
                      }`}
                    >
                      <CardContent className="p-3 text-center flex flex-col items-center justify-between min-h-[145px] gap-2.5">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          badge.unlocked ? 'bg-primary/10 text-primary' : 'bg-zinc-200 text-zinc-400'
                        }`}>
                          <Award className="h-5.5 w-5.5" />
                        </div>
                        <div>
                          <h4 className="text-[11px] font-bold text-text-primary leading-tight">{badge.title}</h4>
                          <p className="text-[8px] text-text-muted mt-1 leading-normal font-bold">{badge.desc}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[7px] font-bold uppercase ${
                          badge.unlocked ? 'bg-emerald-500/10 text-emerald-600' : 'bg-zinc-200 text-zinc-500'
                        }`}>
                          {badge.unlocked ? 'Unlocked' : 'Locked'}
                        </span>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Tab Menu Navigation */}
        <div className="border-t border-border bg-white grid grid-cols-5 h-[60px] relative z-20 shadow-sm">
          <button 
            onClick={() => { setActiveTab('game'); setGameMode('normal'); }}
            className={`flex flex-col items-center justify-center gap-1.5 text-[8px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'game' 
                ? 'text-primary' 
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Play className="h-4.5 w-4.5" />
            Play
          </button>
          
          <button 
            onClick={() => setActiveTab('notebook')}
            className={`flex flex-col items-center justify-center gap-1.5 text-[8px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'notebook' 
                ? 'text-primary' 
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <BookOpen className="h-4.5 w-4.5" />
            Notebook
          </button>

          <button 
            onClick={() => setActiveTab('challenges')}
            className={`flex flex-col items-center justify-center gap-1.5 text-[8px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'challenges' 
                ? 'text-primary' 
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Sparkles className="h-4.5 w-4.5" />
            Challenges
          </button>

          <button 
            onClick={() => setActiveTab('leaderboard')}
            className={`flex flex-col items-center justify-center gap-1.5 text-[8px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'leaderboard' 
                ? 'text-primary' 
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Trophy className="h-4.5 w-4.5" />
            Ranks
          </button>

          <button 
            onClick={() => setActiveTab('achievements')}
            className={`flex flex-col items-center justify-center gap-1.5 text-[8px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'achievements' 
                ? 'text-primary' 
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Award className="h-4.5 w-4.5" />
            Badges
          </button>
        </div>
      </div>
    </div>
  );
}
