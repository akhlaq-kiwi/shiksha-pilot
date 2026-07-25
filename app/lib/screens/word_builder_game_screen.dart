import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:school_hub/constants/predefined_words.dart';
import 'package:school_hub/services/game_service.dart';

class WordBuilderGameScreen extends StatefulWidget {
  final String baseUrl;
  final String token;
  final int? studentId;
  final String studentClass;

  const WordBuilderGameScreen({
    Key? key,
    required this.baseUrl,
    required this.token,
    required this.studentId,
    required this.studentClass,
  }) : super(key: key);

  @override
  State<WordBuilderGameScreen> createState() => _WordBuilderGameScreenState();
}

class _WordBuilderGameScreenState extends State<WordBuilderGameScreen> with SingleTickerProviderStateMixin {
  late GameService _gameService;
  late Timer _playtimeTimer;
  late TabController _tabController;

  // Game States
  bool _loading = true;
  bool _syncing = false;
  String _difficulty = 'primary-easy';
  String _playerName = 'Student';

  // Stats States
  int _coins = 0;
  int _score = 0;
  int _currentLevel = 1;
  int _currentStreak = 0;
  int _highestStreak = 0;
  int _correctAnswers = 0;
  int _wrongAnswers = 0;
  int _totalPlayTime = 0;
  List<String> _learnedWords = [];
  String? _lastClaimedDate;
  bool _dailyClaimedToday = false;

  // Active Level States
  List<WordEntry> _wordsList = [];
  int _currentWordIdx = 0;
  List<String> _scrambled = [];
  List<int> _selectedLetters = []; // indices inside _scrambled
  int _lives = 3;
  bool _showResult = false;
  bool _isCorrect = false;
  bool _showHint = false;

  @override
  void initState() {
    super.initState();
    _gameService = GameService(baseUrl: widget.baseUrl, token: widget.token);
    _tabController = TabController(length: 3, vsync: this);
    _difficulty = getDifficultyByClass(widget.studentClass);

    _loadGameProgress();

    // Start playtime accumulator
    _playtimeTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() {
          _totalPlayTime++;
        });
      }
    });
  }

  @override
  void dispose() {
    _playtimeTimer.cancel();
    _tabController.dispose();
    super.dispose();
  }

  // Load progress from backend API, falling back to SharedPreferences
  Future<void> _loadGameProgress() async {
    setState(() {
      _loading = true;
    });

    final prefs = await SharedPreferences.getInstance();
    _playerName = prefs.getString('user_name') ?? 'Student';

    try {
      final res = await _gameService.getGameProgress(widget.studentId);
      final progress = res['progress'] ?? {};
      final words = List<String>.from(res['learned_words'] ?? []);

      setState(() {
        _coins = progress['coins'] ?? 0;
        _score = progress['score'] ?? 0;
        _currentLevel = progress['current_level'] ?? 1;
        _currentStreak = progress['current_streak'] ?? 0;
        _highestStreak = progress['highest_streak'] ?? 0;
        _correctAnswers = progress['correct_answers'] ?? 0;
        _wrongAnswers = progress['wrong_answers'] ?? 0;
        _totalPlayTime = progress['total_play_time'] ?? 0;
        _lastClaimedDate = progress['last_login_reward_date'];
        _learnedWords = words;

        final today = DateTime.now().toIso8601String().split('T')[0];
        _dailyClaimedToday = _lastClaimedDate == today;

        if (res['student_class'] != null) {
          _difficulty = getDifficultyByClass(res['student_class'] as String?);
        }

        final activeList = res['active_words'] as List<dynamic>?;
        if (activeList != null && activeList.isNotEmpty) {
          _wordsList = activeList.map((item) {
            final map = item as Map<String, dynamic>;
            return WordEntry(
              id: map['id'] is int ? map['id'] as int : int.tryParse(map['id']?.toString() ?? ''),
              word: map['word']?.toString() ?? '',
              hint: map['english_meaning']?.toString() ?? '',
              meaning: map['english_meaning']?.toString() ?? '',
              hindiMeaning: map['hindi_meaning']?.toString() ?? '',
              sentence: map['english_sentence']?.toString() ?? '',
              hindiSentence: map['hindi_sentence']?.toString() ?? '',
              category: map['category']?.toString() ?? '',
            );
          }).toList();
          _currentWordIdx = 0;
          _setupWord();
        } else {
          _loadWordsForLevel();
        }
        _loading = false;
      });
      _saveLocalProgress();
    } catch (e) {
      debugPrint('API Load failed, loading from local cache: $e');
      int savedIdx = 0;
      final localDataStr = prefs.getString('wb_game_progress_${widget.studentId ?? 0}');
      if (localDataStr != null) {
        final Map<String, dynamic> data = json.decode(localDataStr);
        setState(() {
          _coins = data['coins'] ?? 0;
          _score = data['score'] ?? 0;
          _currentLevel = data['currentLevel'] ?? 1;
          _currentStreak = data['currentStreak'] ?? 0;
          _highestStreak = data['highestStreak'] ?? 0;
          _correctAnswers = data['correctAnswers'] ?? 0;
          _wrongAnswers = data['wrongAnswers'] ?? 0;
          _totalPlayTime = data['totalPlayTime'] ?? 0;
          _lastClaimedDate = data['lastClaimedDate'];
          _learnedWords = List<String>.from(data['learnedWords'] ?? []);
          savedIdx = data['currentWordIdx'] ?? 0;

          final today = DateTime.now().toIso8601String().split('T')[0];
          _dailyClaimedToday = _lastClaimedDate == today;
        });
      }
      setState(() {
        _loadWordsForLevel(initialIndex: savedIdx);
        _loading = false;
      });
    }
  }

  // Save current stats locally to cache
  Future<void> _saveLocalProgress() async {
    final prefs = await SharedPreferences.getInstance();
    final data = {
      'coins': _coins,
      'score': _score,
      'currentLevel': _currentLevel,
      'currentStreak': _currentStreak,
      'highestStreak': _highestStreak,
      'correctAnswers': _correctAnswers,
      'wrongAnswers': _wrongAnswers,
      'totalPlayTime': _totalPlayTime,
      'learnedWords': _learnedWords,
      'lastClaimedDate': _lastClaimedDate,
      'currentWordIdx': _currentWordIdx,
    };
    await prefs.setString('wb_game_progress_${widget.studentId ?? 0}', json.encode(data));
  }

  // Push local state metrics back to database
  Future<void> _triggerSync({int? lastWordId, bool? lastIsCorrect}) async {
    setState(() {
      _syncing = true;
    });

    await _saveLocalProgress();

    try {
      final syncData = {
        'coins': _coins,
        'score': _score,
        'current_level': _currentLevel,
        'current_streak': _currentStreak,
        'highest_streak': _highestStreak,
        'correct_answers': _correctAnswers,
        'wrong_answers': _wrongAnswers,
        'total_play_time': _totalPlayTime,
        'new_words': _learnedWords,
        if (lastWordId != null && lastIsCorrect != null)
          'played_words': [
            {
              'word_id': lastWordId,
              'is_correct': lastIsCorrect,
            }
          ]
      };
      await _gameService.syncGameProgress(syncData, widget.studentId);
    } catch (e) {
      debugPrint('Sync failed (will retry next time): $e');
    } finally {
      if (mounted) {
        setState(() {
          _syncing = false;
        });
      }
    }
  }

  // Populate words bank list based on current active level
  void _loadWordsForLevel({int initialIndex = 0}) {
    final allWords = predefinedWords[_difficulty] ?? predefinedWords['primary-easy']!;
    final items = <WordEntry>[];
    const wordsPerLevel = 10;

    for (var i = 0; i < wordsPerLevel; i++) {
      // Shift indices to fetch unique sets of words per level
      final index = ((_currentLevel - 1) * wordsPerLevel + i) % allWords.length;
      items.add(allWords[index]);
    }

    _wordsList = items;
    _currentWordIdx = initialIndex;
    _setupWord();
  }

  // Prepare and scramble the letters of the current word
  void _setupWord() {
    if (_wordsList.isEmpty) return;
    final word = _wordsList[_currentWordIdx].word.toUpperCase();

    // Reset level active variables
    _showResult = false;
    _isCorrect = false;
    _showHint = false;
    _lives = 3;
    _selectedLetters.clear();

    final letters = word.split('');
    var shuffled = List<String>.from(letters);
    final random = Random();

    var attempts = 0;
    while (attempts < 8) {
      for (var i = shuffled.length - 1; i > 0; i--) {
        final j = random.nextInt(i + 1);
        final temp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = temp;
      }
      if (shuffled.join('') != word) break;
      attempts++;
    }

    _scrambled = shuffled;
  }

  // Trigger claim login reward
  Future<void> _handleClaimDaily() async {
    if (_dailyClaimedToday) return;

    final today = DateTime.now().toIso8601String().split('T')[0];

    try {
      await _gameService.claimDailyLogin(widget.studentId);
      setState(() {
        _coins += 20;
        _dailyClaimedToday = true;
        _lastClaimedDate = today;
      });
      _showCustomSnackBar('Daily login claimed! +20 Coins', isError: false);
      _triggerSync();
    } catch (e) {
      debugPrint('Daily claim failed online, using offline fallback: $e');
      setState(() {
        _coins += 20;
        _dailyClaimedToday = true;
        _lastClaimedDate = today;
      });
      _showCustomSnackBar('Daily login claimed offline! +20 Coins', isError: false);
      _saveLocalProgress();
    }
  }

  // Tap handler for letter selection
  void _selectLetter(int idx) {
    if (_showResult) return;

    setState(() {
      if (_selectedLetters.contains(idx)) {
        _selectedLetters.remove(idx);
      } else {
        _selectedLetters.add(idx);
      }
    });

    final currentWord = _wordsList[_currentWordIdx];
    if (_selectedLetters.length == currentWord.word.length) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _handleVerifyAnswer();
        }
      });
    }
  }

  // Clear all filled letter boxes
  void _handleReset() {
    if (_showResult) return;
    setState(() {
      _selectedLetters.clear();
    });
  }

  // Confirm word spelling correctness
  void _handleVerifyAnswer() {
    final currentWord = _wordsList[_currentWordIdx];
    final spelling = _selectedLetters.map((idx) => _scrambled[idx]).join('');

    if (spelling.length != currentWord.word.length) {
      _showCustomSnackBar('Spell the complete word first!');
      return;
    }

    final isMatch = spelling == currentWord.word || _isAcceptedAnagram(spelling, currentWord.word);

    if (isMatch) {
      // CORRECT SPELLED
      final isAnagram = spelling != currentWord.word;
      setState(() {
        _isCorrect = true;
        _showResult = true;
        _correctAnswers++;
        _currentStreak++;
        if (_currentStreak > _highestStreak) {
          _highestStreak = _currentStreak;
        }

        var reward = 10;
        if (_currentStreak > 0 && _currentStreak % 10 == 0) {
          reward += 50; //perfect streak bonus
          _showCustomSnackBar('Perfect 10 Streak Bonus! +50 Coins 🎉', isError: false);
        } else if (isAnagram) {
          _showCustomSnackBar('Alternative word "$spelling" accepted! +$reward Coins', isError: false);
        }
        _coins += reward;
        _score += 20;

        if (!_learnedWords.contains(currentWord.word)) {
          _learnedWords.add(currentWord.word);
        }
      });
      _triggerSync(lastWordId: currentWord.id, lastIsCorrect: true);
    } else {
      // WRONG ANSWER
      setState(() {
        _lives--;
        _selectedLetters.clear(); // Clear answer for retry
        if (_lives <= 0) {
          _isCorrect = false;
          _showResult = true;
          _wrongAnswers++;
          _currentStreak = 0;
          _coins += 2; // Console reward
          _showCustomSnackBar('Answer revealed! Read definition below to learn.');
          _triggerSync(lastWordId: currentWord.id, lastIsCorrect: false);
        } else {
          _showCustomSnackBar('Wrong spelling! $_lives attempts left.', isError: true);
        }
      });
    }
  }

  // Deduct 2 coins and unlock meaning
  void _handleUseHint() {
    if (_showHint) return;
    if (_coins < 2) {
      _showCustomSnackBar('Not enough coins! Hint costs 2 coins.', isError: true);
      return;
    }

    setState(() {
      _coins -= 2;
      _showHint = true;
    });
    _showCustomSnackBar('Hint unlocked! (-2 coins)', isError: false);
    _triggerSync();
  }

  // Deduct 2 coins and jump to next word
  void _handleSkipWord() {
    if (_coins < 2) {
      _showCustomSnackBar('Not enough coins! Skip costs 2 coins.', isError: true);
      return;
    }

    setState(() {
      _coins -= 2;
    });
    _showCustomSnackBar('Word skipped! (-2 coins)', isError: false);
    _handleNextWord();
  }

  // Proceed to next level item
  void _handleNextWord() {
    if (_currentWordIdx < _wordsList.length - 1) {
      setState(() {
        _currentWordIdx++;
        _setupWord();
      });
      _saveLocalProgress();
    } else {
      // LEVEL COMPLETED!
      setState(() {
        _currentLevel++;
        _showCustomSnackBar('🎉 Level Completed! Loading Level $_currentLevel...', isError: false);
        _loadWordsForLevel();
      });
      _triggerSync();
    }
  }

  // Helper method to show customized toast messages
  void _showCustomSnackBar(String text, {bool isError = false}) {
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          text,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
        ),
        behavior: SnackBarBehavior.floating,
        backgroundColor: isError ? Colors.redAccent : Colors.indigo.shade800,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  // Format accumulated playtime into mm:ss
  String _formatPlayTime(int seconds) {
    final m = (seconds ~/ 60).toString().padLeft(2, '0');
    final s = (seconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Word Builder', style: TextStyle(fontWeight: FontWeight.w900)),
          centerTitle: true,
        ),
        body: const Center(
          child: CircularProgressIndicator(color: Colors.indigo),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Word Builder',
              style: TextStyle(fontWeight: FontWeight.w900, color: Colors.black87, fontSize: 17),
            ),
            Text(
              _playerName,
              style: const TextStyle(fontWeight: FontWeight.w500, color: Colors.black45, fontSize: 11),
            ),
          ],
        ),
        centerTitle: true,
        backgroundColor: Colors.white,
        elevation: 0.5,
        iconTheme: const IconThemeData(color: Colors.black87),
        actions: [
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.amber.shade50,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.amber.shade300, width: 1),
            ),
            child: Row(
              children: [
                const Icon(Icons.monetization_on, color: Colors.amber, size: 16),
                const SizedBox(width: 4),
                Text(
                  '$_coins',
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    color: Colors.amber.shade900,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          )
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Daily login reward banner
            if (!_dailyClaimedToday)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Colors.indigo.shade800, Colors.deepPurple.shade700],
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Expanded(
                      child: Text(
                        'Claim your Daily Reward! +20 Coins 🪙',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.amber,
                        foregroundColor: Colors.black87,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      ),
                      onPressed: _handleClaimDaily,
                      child: const Text('CLAIM', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11)),
                    ),
                  ],
                ),
              ),

            // Tab bar switcher
            Container(
              color: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: TabBar(
                controller: _tabController,
                indicatorColor: Colors.indigo,
                labelColor: Colors.indigo,
                unselectedLabelColor: Colors.grey,
                labelStyle: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 0.5),
                tabs: const [
                  Tab(icon: Icon(Icons.videogame_asset, size: 20), text: 'GAME'),
                  Tab(icon: Icon(Icons.book_rounded, size: 20), text: 'NOTEBOOK'),
                  Tab(icon: Icon(Icons.analytics_rounded, size: 20), text: 'STATS'),
                ],
              ),
            ),

            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  _buildGameplayTab(),
                  _buildNotebookTab(),
                  _buildStatsTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --- GAMEPLAY TAB VIEW ---
  Widget _buildGameplayTab() {
    if (_wordsList.isEmpty) {
      return const Center(child: Text('No words loaded.'));
    }

    final currentWord = _wordsList[_currentWordIdx];

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Info row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'LEVEL $_currentLevel · WORD ${_currentWordIdx + 1}/10',
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11, color: Colors.grey),
              ),
              // Lives indicator
              Row(
                children: List.generate(3, (index) {
                  return Icon(
                    Icons.favorite,
                    color: index < _lives ? Colors.redAccent : Colors.grey.shade300,
                    size: 20,
                  );
                }),
              )
            ],
          ),
          const SizedBox(height: 16),

          // Central Card for gameplay
          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            elevation: 1,
            color: Colors.white,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
              child: Column(
                children: [
                  // Category tag
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.indigo.shade50,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      currentWord.category.toUpperCase(),
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        color: Colors.indigo.shade800,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Hint description if unlocked
                  if (_showHint) ...[
                    Text(
                      'HINT: ${currentWord.hint}',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey.shade700,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '(${currentWord.hindiMeaning})',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.indigo,
                      ),
                    ),
                  ] else
                    GestureDetector(
                      onTap: _handleUseHint,
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.amber.shade50,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.amber.shade200),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.help_outline, size: 16, color: Colors.amber),
                            const SizedBox(width: 6),
                            Text(
                              'Unlock Hint (Costs 2 🪙)',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Colors.amber.shade900,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  const SizedBox(height: 24),

                  // Spelling slot row
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 6,
                    runSpacing: 6,
                    children: List.generate(currentWord.word.length, (index) {
                      final letterSelected = index < _selectedLetters.length;
                      final letter = letterSelected ? _scrambled[_selectedLetters[index]] : '';

                      return Container(
                        width: 36,
                        height: 44,
                        decoration: BoxDecoration(
                          color: letterSelected ? Colors.indigo.shade50 : Colors.grey.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: letterSelected ? Colors.indigo.shade300 : Colors.grey.shade300,
                            width: 1.5,
                          ),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          letter,
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: Colors.indigo.shade900,
                          ),
                        ),
                      );
                    }),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Answer Reveal / Result box
          if (_showResult) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _isCorrect ? Colors.green.shade50 : Colors.red.shade50,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _isCorrect ? Colors.green.shade300 : Colors.red.shade300),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        _isCorrect ? Icons.check_circle_outline : Icons.error_outline,
                        color: _isCorrect ? Colors.green.shade800 : Colors.red.shade800,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _isCorrect ? 'EXCELLENT! CORRECT!' : 'OOPS! TRY AGAIN NEXT TIME',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          color: _isCorrect ? Colors.green.shade900 : Colors.red.shade900,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Word: ${currentWord.word}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Meaning: ${currentWord.meaning}',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade700, height: 1.3),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Example: "${currentWord.sentence}"',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: Colors.indigo),
                  ),
                  const SizedBox(height: 14),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _isCorrect ? Colors.green.shade700 : Colors.red.shade700,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: _handleNextWord,
                    child: const Text('CONTINUE', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ] else ...[
            // Scrambled letters tiles
            const Text(
              'TAP LETTER TILES TO SPELL THE WORD',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.grey, letterSpacing: 0.5),
            ),
            const SizedBox(height: 10),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 10,
              runSpacing: 10,
              children: List.generate(_scrambled.length, (index) {
                final isSelected = _selectedLetters.contains(index);

                return Opacity(
                  opacity: isSelected ? 0.3 : 1.0,
                  child: Container(
                    width: 44,
                    height: 48,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey.shade300, width: 1),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.grey.shade200,
                          offset: const Offset(0, 2),
                          blurRadius: 1,
                        )
                      ],
                    ),
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () => _selectLetter(index),
                        child: Center(
                          child: Text(
                            _scrambled[index],
                            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.black87),
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ),
            const SizedBox(height: 32),

            // Action row buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      side: BorderSide(color: Colors.grey.shade300),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: const Icon(Icons.skip_next, size: 18, color: Colors.grey),
                    label: const Text('SKIP (2 🪙)', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold, fontSize: 12)),
                    onPressed: _handleSkipWord,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.orange.shade800,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 1,
                    ),
                    icon: const Icon(Icons.refresh, size: 18),
                    label: const Text('RESET', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12)),
                    onPressed: _handleReset,
                  ),
                ),
              ],
            ),
          ]
        ],
      ),
    );
  }

  // --- NOTEBOOK TAB VIEW ---
  Widget _buildNotebookTab() {
    if (_learnedWords.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.menu_book_rounded, size: 64, color: Colors.grey.shade300),
              const SizedBox(height: 12),
              const Text(
                'Vocabulary Notebook Empty',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Colors.black87),
              ),
              const SizedBox(height: 6),
              const Text(
                'Spell words correctly in gameplay mode to save them in your notebook dictionary.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: Colors.grey, height: 1.3),
              ),
            ],
          ),
        ),
      );
    }

    // Match vocabulary dictionary words from predefined lists
    final allPredefinedWords = predefinedWords.values.expand((w) => w).toList();
    final notebookWords = allPredefinedWords.where((entry) => _learnedWords.contains(entry.word)).toList();

    return ListView.builder(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.all(16),
      itemCount: notebookWords.length,
      itemBuilder: (context, index) {
        final item = notebookWords[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          elevation: 0.5,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      item.word,
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Colors.indigo),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.indigo.shade50,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        item.category,
                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.indigo.shade900),
                      ),
                    )
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  '${item.meaning} (${item.hindiMeaning})',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade800, height: 1.4),
                ),
                const SizedBox(height: 6),
                const Divider(height: 1),
                const SizedBox(height: 6),
                Text(
                  'Example: "${item.sentence}"',
                  style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Colors.black54),
                ),
                Text(
                  'हिन्दी वाक्य: "${item.hindiSentence}"',
                  style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // --- STATS TAB VIEW ---
  Widget _buildStatsTab() {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Synced info badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'YOUR PROGRESS RECORD',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11, color: Colors.grey, letterSpacing: 0.5),
              ),
              _syncing
                  ? Row(
                      children: [
                        SizedBox(
                          width: 10,
                          height: 10,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.indigo.shade800),
                        ),
                        const SizedBox(width: 6),
                        const Text('Syncing...', style: TextStyle(fontSize: 10, color: Colors.grey))
                      ],
                    )
                  : const Row(
                      children: [
                        Icon(Icons.cloud_done, size: 14, color: Colors.green),
                        SizedBox(width: 4),
                        Text('Synced', style: TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.bold))
                      ],
                    )
            ],
          ),
          const SizedBox(height: 12),

          // Cards grid of statistics
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.4,
            children: [
              _buildStatCard('Total Score', '$_score', Icons.emoji_events, Colors.orange),
              _buildStatCard('Current Level', '$_currentLevel', Icons.star, Colors.indigo),
              _buildStatCard('Streak Record', '$_highestStreak', Icons.local_fire_department, Colors.redAccent),
              _buildStatCard('Learned Words', '${_learnedWords.length}', Icons.menu_book, Colors.teal),
              _buildStatCard('Correct Answers', '$_correctAnswers', Icons.check_circle, Colors.green),
              _buildStatCard('Wrong Answers', '$_wrongAnswers', Icons.cancel, Colors.red),
            ],
          ),
          const SizedBox(height: 16),

          // Total playtime card
          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            elevation: 0.5,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(12)),
                    child: const Icon(Icons.timer, color: Colors.blue),
                  ),
                  const SizedBox(width: 14),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Total Time Played',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black87),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _formatPlayTime(_totalPlayTime),
                        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Colors.black87),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          )
        ],
      ),
    );
  }

  // Helper widget to construct individual stats tiles
  Widget _buildStatCard(String title, String val, IconData icon, Color color) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 0.5,
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Icon(icon, color: color, size: 20),
                Text(
                  val,
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Colors.black87),
                ),
              ],
            ),
            Text(
              title,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 11,
                color: Colors.grey.shade600,
              ),
            )
          ],
        ),
      ),
    );
  }

  bool _isAcceptedAnagram(String spelling, String target) {
    var s = spelling.toUpperCase();
    var t = target.toUpperCase();
    
    if (s == t) return true;
    
    // Strip trailing 'S' characters to resolve seeder plural/spelling variants
    while (s.endsWith('S') && t.endsWith('S')) {
      s = s.substring(0, s.length - 1);
      t = t.substring(0, t.length - 1);
    }
    
    if (s == t) return true;
    
    final List<Set<String>> groups = [
      {'GARDEN', 'DANGER'},
      {'CAT', 'ACT'},
      {'DOG', 'GOD'},
      {'CAR', 'ARC'},
      {'STAR', 'RATS', 'ARTS', 'TARS'},
      {'RULE', 'LURE'},
      {'BOARD', 'BROAD'},
      {'FLOW', 'WOLF'},
      {'EAT', 'TEA', 'ATE'},
      {'MEAT', 'TEAM', 'MATE', 'TAME'},
      {'LAMP', 'PALM'},
      {'POST', 'STOP', 'SPOT', 'TOPS'},
      {'BAKE', 'BEAK'},
      {'LATE', 'TALE'},
      {'EAST', 'SEAT'},
      {'LEAF', 'FLEA'},
      {'PEAR', 'REAP'},
      {'RACE', 'CARE'},
      {'SNAKE', 'SNEAK'},
    ];

    for (final group in groups) {
      if (group.contains(t) && group.contains(s)) {
        return true;
      }
    }
    return false;
  }
}
