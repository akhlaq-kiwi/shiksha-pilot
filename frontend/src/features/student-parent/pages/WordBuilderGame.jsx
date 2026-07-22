import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, Flame, Coins, Heart, Play, RefreshCw, Volume2, HelpCircle,
  SkipForward, BookOpen, CheckCircle, AlertCircle, Award, Check, X,
  Activity, Star, Sparkles, AlertTriangle, ArrowRight, ShieldCheck, Wifi, WifiOff
} from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../common/ui/card';
import { PREDEFINED_WORDS, getDifficultyByClass } from '../../../common/constants/predefinedWords';
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
  
  // Daily challenge state
  const [isDailyChallenge, setIsDailyChallenge] = useState(false);
  
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
          
          const today = new Date().toISOString().split('T')[0];
          setDailyClaimedToday(prog.last_login_reward_date === today);
          
          setLearnedWords(apiData.learned_words || []);
          
          // Seed gameplay list
          const list = getWordsForLevel(diff, prog.current_level || 1);
          setWordsList(list);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.error('API load failed, falling back to LocalStorage', e);
    }

    // 2. LocalStorage fallback
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
      
      const today = new Date().toISOString().split('T')[0];
      setDailyClaimedToday(data.lastClaimedDate === today);
      
      const diff = getDifficultyByClass(studentClass);
      setWordsList(getWordsForLevel(diff, data.currentLevel || 1));
    } else {
      // First time initialization
      const diff = getDifficultyByClass(studentClass);
      setWordsList(getWordsForLevel(diff, 1));
    }
    setLoading(false);
  };

  const getWordsForLevel = (diff, level) => {
    const allWords = PREDEFINED_WORDS[diff] || PREDEFINED_WORDS['primary-easy'];
    // Rotate words if level exceeds word bank size
    const items = [];
    const count = 10;
    for (let i = 0; i < count; i++) {
      const index = ((level - 1) * count + i) % allWords.length;
      items.push(allWords[index]);
    }
    return items;
  };

  const setupWord = (word) => {
    // Reset word level states
    setShowResult(false);
    setIsCorrect(false);
    setShowHint(false);
    setLives(3);
    setSelectedLetters([]);
    
    // Scramble letters
    const letters = word.split('');
    // Fisher-Yates shuffle with fallback to ensure it is scrambled
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

  const triggerSync = async () => {
    if (!navigator.onLine) return;
    try {
      const syncData = {
        coins,
        score,
        current_level: currentLevel,
        current_streak: currentStreak,
        highest_streak: highestStreak,
        correct_answers: correctAnswers,
        wrong_answers: wrongAnswers,
        total_play_time: totalPlayTime,
        new_words: learnedWords
      };
      await studentService.syncGameProgress(syncData);
      console.log('Progress synced successfully.');
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
          const today = new Date().toISOString().split('T')[0];
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
    const today = new Date().toISOString().split('T')[0];
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
      
      // Add to vocabulary notebook if not already there
      if (!learnedWords.includes(currentWord.word)) {
        setLearnedWords(prev => [...prev, currentWord.word]);
      }
      
      // Speak pronunciation automatically on success
      handleTextToSpeech(currentWord.word);
      triggerSync();
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
        triggerSync();
      } else {
        toast.error(`Wrong spelling! ${remainingLives} attempts left.`);
      }
    }
  };

  const handleUseHint = () => {
    if (showHint) return;
    if (coins < 5) {
      toast.warning('Not enough coins! Hints cost 5 coins.');
      return;
    }
    setCoins(prev => prev - 5);
    setShowHint(true);
    toast.success('Hint unlocked! (Cost: 5 coins)');
  };

  const handleSkipWord = () => {
    if (coins < 10) {
      toast.warning('Not enough coins! Skips cost 10 coins.');
      return;
    }
    setCoins(prev => prev - 10);
    toast.info('Word skipped! (Cost: 10 coins)');
    handleNextWord();
  };

  const handleNextWord = () => {
    if (currentWordIdx < wordsList.length - 1) {
      setCurrentWordIdx(prev => prev + 1);
    } else {
      // LEVEL COMPLETED!
      playTone('complete');
      toast.success(`🎉 Level ${currentLevel} Completed!`);
      const nextLvl = currentLevel + 1;
      setCurrentLevel(nextLvl);
      
      // Reload words list for next level
      const list = getWordsForLevel(difficulty, nextLvl);
      setWordsList(list);
      setCurrentWordIdx(0);
      triggerSync();
    }
  };

  return (
    <div className="flex justify-center items-start min-h-[calc(100vh-140px)] w-full py-4 px-2">
      {/* Premium Mobile Simulator Frame */}
      <div className="w-full max-w-[430px] min-h-[82vh] bg-[#FAF9F6] border-4 border-[#E5E5E1] rounded-[36px] shadow-lg flex flex-col justify-between overflow-hidden relative font-sans">
        
        {/* Top Header Panel */}
        <div className="bg-[#FAF9F6] px-5 pt-5 pb-3 border-b border-[#E5E5E1] flex flex-col gap-2.5 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-black text-[10px]">
                {playerName.charAt(0)}
              </div>
              <div>
                <p className="text-[10px] font-black text-text-primary truncate max-w-[80px]">{playerName}</p>
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
            <div className="bg-white border border-[#EBEAE8] px-2 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs">
              <Trophy className="h-3 w-3 text-amber-500 flex-shrink-0" />
              <div className="min-w-0">
                <span className="block text-[7px] text-text-muted font-bold uppercase tracking-wider leading-none">Score</span>
                <span className="text-xs font-black text-text-primary leading-none tabular-nums mt-0.5 block">{score}</span>
              </div>
            </div>
            
            <div className="bg-white border border-[#EBEAE8] px-2 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs">
              <Coins className="h-3 w-3 text-yellow-500 flex-shrink-0" />
              <div className="min-w-0">
                <span className="block text-[7px] text-text-muted font-bold uppercase tracking-wider leading-none">Coins</span>
                <span className="text-xs font-black text-text-primary leading-none tabular-nums mt-0.5 block">{coins}</span>
              </div>
            </div>

            <div className="bg-white border border-[#EBEAE8] px-2 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs">
              <Flame className="h-3 w-3 text-orange-500 flex-shrink-0" />
              <div className="min-w-0">
                <span className="block text-[7px] text-text-muted font-bold uppercase tracking-wider leading-none">Streak</span>
                <span className="text-xs font-black text-text-primary leading-none tabular-nums mt-0.5 block">{currentStreak}</span>
              </div>
            </div>

            <div className="bg-white border border-[#EBEAE8] px-2 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs">
              <Award className="h-3 w-3 text-indigo-500 flex-shrink-0" />
              <div className="min-w-0">
                <span className="block text-[7px] text-text-muted font-bold uppercase tracking-wider leading-none">Lvl {currentLevel}</span>
                <span className="text-[10px] font-black text-text-primary leading-none mt-0.5 block truncate">Word {currentWordIdx + 1}/10</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab View Container */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-[420px] bg-[#FAF9F6]">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Loading Word Builder...</p>
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
                      <p className="text-[10px] font-black text-amber-800 leading-none">Daily Login Reward!</p>
                      <p className="text-[8px] text-text-secondary mt-0.5 leading-none">Claim your daily +20 Coins</p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleClaimDaily}
                    className="h-6 px-2.5 text-[9px] font-black bg-amber-600 hover:bg-amber-700 text-white border-none rounded-lg shadow-sm"
                  >
                    Claim
                  </Button>
                </div>
              )}

              {/* Central Gameplay Card */}
              {wordsList[currentWordIdx] && (
                <Card className="border border-[#EBEAE8] shadow-sm rounded-3xl overflow-hidden bg-white">
                  <CardHeader className="bg-[#EFEEEB] border-b border-[#EBEAE8] py-3 px-5 flex flex-row items-center justify-between">
                    <span className="text-[9px] font-black text-text-primary uppercase tracking-wider">
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
                  <CardContent className="p-6 text-center space-y-6">
                    
                    {/* Clue/Hint Area */}
                    <div className="bg-[#FAF9F6] border border-[#EBEAE8] rounded-2xl p-4 min-h-[90px] flex flex-col justify-center items-center">
                      {showHint ? (
                        <p className="text-xs font-semibold text-text-primary italic leading-relaxed">
                          "{wordsList[currentWordIdx].hint}"
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[9px] font-black text-text-muted uppercase tracking-wider">Need a Clue?</p>
                          <Button 
                            onClick={handleUseHint}
                            variant="outline"
                            className="h-8 px-4 text-[10px] font-extrabold flex items-center gap-1 border border-[#E5E5E1] rounded-lg shadow-2xs hover:bg-[#F4F3F1]"
                          >
                            <HelpCircle className="h-3.5 w-3.5" /> Unlock Hint (5 🪙)
                          </Button>
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
                            className={`w-9 h-11 border-2 rounded-xl flex items-center justify-center text-lg font-black tracking-tight transition-all duration-150 ${
                              letter 
                                ? 'bg-primary border-primary text-white scale-100 shadow-sm' 
                                : 'bg-[#FAF9F6] border-dashed border-[#E5E5E1] text-transparent scale-95'
                            }`}
                          >
                            {letter}
                          </div>
                        );
                      })}
                    </div>

                    {/* Scrambled letter tiles */}
                    <div className="space-y-2 pt-2">
                      <p className="text-[8px] font-black text-text-muted uppercase tracking-wider">Tap letters to arrange</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {scrambled.map((char, idx) => {
                          const isSelected = selectedLetters.includes(idx);
                          return (
                            <button
                              key={idx}
                              onClick={() => selectLetter(idx)}
                              disabled={showResult}
                              className={`w-10 h-10 rounded-xl text-md font-black flex items-center justify-center border-2 transition-all shadow-2xs select-none active:scale-95 ${
                                isSelected
                                  ? 'bg-[#EFEEEB] border-[#E5E5E1] text-[#9ca3af] cursor-not-allowed scale-90'
                                  : 'bg-white border-[#EBEAE8] text-text-primary hover:border-primary/80 hover:bg-zinc-50'
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
                          className="flex-1 h-10 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 border border-[#E5E5E1] rounded-xl"
                        >
                          <SkipForward className="h-3.5 w-3.5" /> Skip (10 🪙)
                        </Button>
                        <Button 
                          onClick={handleVerifyAnswer}
                          className="flex-1 h-10 text-[10px] font-black uppercase tracking-wider flex items-center justify-center bg-primary text-white rounded-xl shadow-md"
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
                <div className="bg-white border border-[#EBEAE8] rounded-3xl p-5 shadow-sm space-y-4 animate-in slide-in-from-bottom duration-300">
                  <div className="flex items-center gap-2.5">
                    {isCorrect ? (
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                        <Check className="h-5.5 w-5.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-600">
                        <X className="h-5.5 w-5.5 stroke-[3]" />
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm font-black text-text-primary">
                        {isCorrect ? '🎉 Correct Answer!' : '😞 Nice Try!'}
                      </h4>
                      <p className="text-[10px] text-text-muted font-bold mt-0.5 leading-none">
                        Word: <span className="text-text-primary text-xs font-black">{wordsList[currentWordIdx].word}</span>
                      </p>
                    </div>
                  </div>

                  {/* Pronunciation & Meaning detail */}
                  <div className="bg-[#FAF9F6] border border-[#EBEAE8] rounded-2xl p-4 space-y-3.5 text-left">
                    <div className="flex items-center justify-between border-b border-border/80 pb-2">
                      <span className="text-[9px] font-black text-text-muted uppercase tracking-wider">Pronunciation & Meaning</span>
                      <button 
                        onClick={() => handleTextToSpeech(wordsList[currentWordIdx].word)}
                        className="w-7 h-7 rounded-full bg-primary/10 text-text-primary hover:bg-primary/20 flex items-center justify-center transition-colors"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <span className="text-[8px] font-black text-text-muted uppercase tracking-wider block">English Meaning</span>
                        <p className="text-xs text-text-primary font-bold">{wordsList[currentWordIdx].meaning}</p>
                      </div>
                      <div>
                        <span className="text-[8px] font-black text-text-muted uppercase tracking-wider block">Hindi Meaning</span>
                        <p className="text-xs text-text-primary font-bold font-sans">{wordsList[currentWordIdx].hindiMeaning}</p>
                      </div>
                      <div className="pt-1.5 border-t border-dashed border-border">
                        <span className="text-[8px] font-black text-text-muted uppercase tracking-wider block">Example Sentence</span>
                        <p className="text-xs text-text-primary font-bold">"{wordsList[currentWordIdx].sentence}"</p>
                        <p className="text-[10px] text-text-muted font-semibold mt-1 font-sans">"{wordsList[currentWordIdx].hindiSentence}"</p>
                      </div>
                    </div>
                  </div>

                  <Button 
                    onClick={handleNextWord}
                    className="w-full h-11 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 bg-primary text-white rounded-xl shadow-md"
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
                <h3 className="text-lg font-black text-text-primary tracking-tight font-display">My Learned Words</h3>
              </div>
              <p className="text-[10px] text-text-secondary leading-relaxed font-bold">
                Every correctly answered word is saved here. Tap the speaker icon to hear the pronunciation.
              </p>

              <div className="space-y-3 pt-2">
                {learnedWords.length === 0 ? (
                  <div className="bg-white border border-[#EBEAE8] p-8 text-center rounded-3xl space-y-2">
                    <p className="text-xs text-text-muted font-bold">Your vocabulary dictionary is empty.</p>
                    <p className="text-[10px] text-text-secondary">Spell words correctly in gameplay mode to add them here.</p>
                  </div>
                ) : (
                  // Group words by their category
                  learnedWords.map(wordStr => {
                    // Find actual word details from PREDEFINED_WORDS
                    let matchedWord = null;
                    const diffKeys = Object.keys(PREDEFINED_WORDS);
                    for (const key of diffKeys) {
                      const found = PREDEFINED_WORDS[key].find(item => item.word === wordStr);
                      if (found) {
                        matchedWord = found;
                        break;
                      }
                    }
                    if (!matchedWord) return null;

                    return (
                      <Card key={wordStr} className="border border-[#EBEAE8] rounded-2xl bg-white shadow-2xs">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-border/60 pb-2">
                            <div>
                              <h4 className="text-sm font-black text-text-primary tracking-wide leading-none">{matchedWord.word}</h4>
                              <span className="text-[7px] font-black text-text-muted uppercase tracking-wider mt-1 block">
                                {matchedWord.category}
                              </span>
                            </div>
                            <button
                              onClick={() => handleTextToSpeech(matchedWord.word)}
                              className="w-7 h-7 rounded-full bg-primary/10 text-text-primary hover:bg-primary/20 flex items-center justify-center transition-colors"
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          
                          <div className="space-y-1.5 text-[10px] text-text-secondary font-bold">
                            <p><span className="text-text-muted text-[9px] uppercase block">Meaning</span> {matchedWord.meaning}</p>
                            <p><span className="text-text-muted text-[9px] uppercase block font-sans">Hindi Meaning</span> {matchedWord.hindiMeaning}</p>
                            <div className="pt-1.5 border-t border-dashed border-border/80">
                              <p><span className="text-text-muted text-[9px] uppercase block">Example</span> "{matchedWord.sentence}"</p>
                              <p className="text-text-muted font-normal mt-0.5 font-sans">"{matchedWord.hindiSentence}"</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            // STATS & PROGRESS TRACKING MODE
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-black text-text-primary tracking-tight font-display">Progress & Stats</h3>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-white border border-[#EBEAE8] p-3 rounded-2xl shadow-2xs">
                  <span className="block text-[8px] text-text-muted font-bold uppercase tracking-wider leading-none">Words Learned</span>
                  <span className="text-2xl font-black text-text-primary tracking-tight mt-1.5 block tabular-nums leading-none">
                    {learnedWords.length}
                  </span>
                </div>
                
                <div className="bg-white border border-[#EBEAE8] p-3 rounded-2xl shadow-2xs">
                  <span className="block text-[8px] text-text-muted font-bold uppercase tracking-wider leading-none">Accuracy Rate</span>
                  <span className="text-2xl font-black text-text-primary tracking-tight mt-1.5 block tabular-nums leading-none">
                    {correctAnswers + wrongAnswers > 0 
                      ? Math.round((correctAnswers / (correctAnswers + wrongAnswers)) * 100) 
                      : 0}%
                  </span>
                </div>

                <div className="bg-white border border-[#EBEAE8] p-3 rounded-2xl shadow-2xs">
                  <span className="block text-[8px] text-text-muted font-bold uppercase tracking-wider leading-none">Answers Status</span>
                  <span className="text-xs font-black text-emerald-600 block mt-2.5 tabular-nums leading-none">
                    ✓ {correctAnswers} Correct
                  </span>
                  <span className="text-xs font-black text-red-500 block mt-1.5 tabular-nums leading-none">
                    ✕ {wrongAnswers} Wrong
                  </span>
                </div>

                <div className="bg-white border border-[#EBEAE8] p-3 rounded-2xl shadow-2xs">
                  <span className="block text-[8px] text-text-muted font-bold uppercase tracking-wider leading-none">Play Time</span>
                  <span className="text-lg font-black text-text-primary tracking-tight mt-2 block tabular-nums leading-none">
                    {Math.floor(totalPlayTime / 60)}m {totalPlayTime % 60}s
                  </span>
                  <span className="text-[7px] text-text-muted font-bold block mt-1 uppercase">Total play session</span>
                </div>
              </div>

              {/* Trophy Accomplishments Card */}
              <Card className="border border-[#EBEAE8] rounded-2xl bg-white shadow-2xs mt-1">
                <CardContent className="p-4 space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">Achievements</h4>
                  </div>

                  <div className="space-y-3 text-[10px] text-text-secondary font-bold">
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
          )}
        </div>

        {/* Bottom Tab Menu Navigation */}
        <div className="border-t border-[#E5E5E1] bg-white grid grid-cols-3 h-[60px] relative z-20 shadow-sm">
          <button 
            onClick={() => setActiveTab('game')}
            className={`flex flex-col items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-wider transition-colors ${
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
            className={`flex flex-col items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-wider transition-colors ${
              activeTab === 'notebook' 
                ? 'text-primary' 
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <BookOpen className="h-4.5 w-4.5" />
            Notebook
          </button>

          <button 
            onClick={() => setActiveTab('stats')}
            className={`flex flex-col items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-wider transition-colors ${
              activeTab === 'stats' 
                ? 'text-primary' 
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Activity className="h-4.5 w-4.5" />
            Stats
          </button>
        </div>
      </div>
    </div>
  );
}
