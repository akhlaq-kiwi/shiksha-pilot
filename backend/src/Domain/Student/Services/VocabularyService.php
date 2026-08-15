<?php

declare(strict_types=1);

namespace App\Domain\Student\Services;

use App\Domain\Student\Repositories\StudentDataRepository;
use App\Shared\BaseService;
use App\Shared\Exceptions\NotFoundException;
use Psr\Log\LoggerInterface;
use PDO;

class VocabularyService extends BaseService
{
    public function __construct(
        private StudentDataRepository $repo,
        ?LoggerInterface $logger = null,
    ) {
        parent::__construct($logger);
    }

    /**
     * Resolve the student record for the authenticated user.
     */
    private function resolveStudent(array $user): array
    {
        $schoolId = (int) ($user['school_id'] ?? 0);

        // 1. Check if specific student is requested via header or query parameter
        $reqStudentId = $_SERVER['HTTP_X_STUDENT_ID'] ?? $_SERVER['HTTP_STUDENT_ID'] ?? $_GET['student_id'] ?? null;
        if ($reqStudentId !== null && is_numeric($reqStudentId)) {
            $student = $this->repo->findById((int)$reqStudentId);
            if ($student && (int)$student['school_id'] === $schoolId) {
                return $student;
            }
        }

        // 2. Fallback to role-based resolution
        if ($user['role'] === 'STUDENT') {
            $email = $user['email'] ?? null;
            if (empty($email) && isset($user['id'])) {
                $stmt = $this->repo->getPdo()->prepare("SELECT email FROM users WHERE id = :id LIMIT 1");
                $stmt->execute([':id' => $user['id']]);
                $email = $stmt->fetchColumn() ?: '';
            }
            $student = $this->repo->findByUserEmail((string)$email, $schoolId);
        } else {
            $student = $this->repo->findByParentPhone((string) ($user['phone'] ?? ''), $schoolId);
        }

        if (!$student) {
            throw new NotFoundException('Student profile not found.');
        }

        return $student;
    }

    /**
     * Clean trailing digit and repeat letter suffixes from word spellings.
     */
    public static function cleanWordSpelling(string $word): string
    {
        // 1. Strip trailing digits
        $word = preg_replace('/[0-9]+$/', '', trim($word));

        // 2. Strip trailing duplicate S characters
        $upper = strtoupper($word);
        $stripped = preg_replace('/S+$/', '', $upper);

        if ($stripped === 'CLA') {
            return 'CLASS';
        }
        if ($stripped === 'PHOTOSYNTHESI') {
            return 'PHOTOSYNTHESIS';
        }

        if (empty($stripped)) {
            return $upper;
        }

        return $stripped;
    }

    /**
     * Sanity checks a word spelling, translations, example sentences and category fields.
     */
    public static function isValidWord(?array $word): bool
    {
        if ($word === null) {
            return false;
        }
        $spelling = self::cleanWordSpelling($word['word'] ?? '');
        if ($spelling === '' || preg_match('/\d/', $spelling)) {
            return false;
        }
        if (empty(trim($word['english_meaning'] ?? '')) ||
            empty(trim($word['hindi_meaning'] ?? '')) ||
            empty(trim($word['english_sentence'] ?? '')) ||
            empty(trim($word['hindi_sentence'] ?? ''))) {
            return false;
        }
        if (empty(trim($word['category'] ?? ''))) {
            return false;
        }
        return true;
    }

    /**
     * Retrieves or initializes student progress and active 10-word list.
     */
    public function getGameProgress(array $user): array
    {
        $student = $this->resolveStudent($user);
        $studentId = (int)$student['id'];
        $schoolId = (int)$student['school_id'];

        $studentWithClass = $this->repo->findWithClass($studentId) ?? $student;
        $className = $studentWithClass['class_name'] ?? 'Class 1';

        $pdo = $this->repo->getPdo();

        // 1. Retrieve or create progress
        $stmt = $pdo->prepare("SELECT * FROM student_game_progress WHERE student_id = :student_id AND game_key = 'word-builder' LIMIT 1");
        $stmt->execute([':student_id' => $studentId]);
        $progress = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$progress) {
            $stmtInsert = $pdo->prepare("
                INSERT INTO student_game_progress 
                (student_id, school_id, game_key, coins, score, current_level, current_streak, highest_streak, correct_answers, wrong_answers, total_play_time, current_stage)
                VALUES 
                (:student_id, :school_id, 'word-builder', 0, 0, 1, 0, 0, 0, 0, 0, 1)
            ");
            $stmtInsert->execute([
                ':student_id' => $studentId,
                ':school_id' => $schoolId
            ]);
            $stmt->execute([':student_id' => $studentId]);
            $progress = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        $currentStage = (int)$progress['current_stage'];
        $totalCorrect = (int)$progress['correct_answers'];

        // 2. Fetch the last 6 played words for Anti-Boredom logic
        $stmtBoredom = $pdo->prepare("
            SELECT w.id FROM vocabulary_words w
            JOIN vocabulary_mappings m ON w.id = m.word_id
            JOIN student_vocabulary_states s ON m.id = s.word_mapping_id
            WHERE s.student_id = :student_id AND m.academic_level = :level
            ORDER BY s.last_seen_at DESC LIMIT 6
        ");
        $stmtBoredom->execute([
            ':student_id' => $studentId,
            ':level' => $className
        ]);
        $antiBoredomIds = $stmtBoredom->fetchAll(PDO::FETCH_COLUMN) ?: [];

        // 3. Select 10 active words using Smart Selection
        $activeWords = [];
        $selectedWordIds = [];
        $lastCategory = '';

        for ($i = 0; $i < 10; $i++) {
            $sequenceNum = $totalCorrect + $i + 1;
            $word = $this->getWordForSlot(
                $pdo,
                $studentId,
                $className,
                $currentStage,
                $sequenceNum,
                $selectedWordIds,
                $antiBoredomIds,
                $lastCategory
            );

            if ($word) {
                $selectedWordIds[] = (int)$word['id'];
                $lastCategory = $word['category'];
                
                // Hide synonyms/opposites for Pre Nursery to Class 2
                $isLowerClass = in_array($className, ['Pre Nursery', 'Play Group', 'Nursery', 'LKG', 'UKG', 'KG', 'Class 1', 'Class 2']);
                if ($isLowerClass) {
                    $word['synonyms'] = null;
                    $word['opposites'] = null;
                } else {
                    $word['synonyms'] = $word['synonyms'] ? json_decode($word['synonyms'], true) : null;
                    $word['opposites'] = $word['opposites'] ? json_decode($word['opposites'], true) : null;
                }

                $word['word'] = self::cleanWordSpelling($word['word']);
                $activeWords[] = $word;
            }
        }

        // 4. Retrieve list of mastered word objects to return in learned_words
        $stmtLearned = $pdo->prepare("
            SELECT w.word FROM vocabulary_words w
            JOIN vocabulary_mappings m ON w.id = m.word_id
            JOIN student_vocabulary_states s ON m.id = s.word_mapping_id
            WHERE s.student_id = :student_id 
              AND s.mastery_status = 'MASTERED'
        ");
        $stmtLearned->execute([':student_id' => $studentId]);
        $learnedWords = $stmtLearned->fetchAll(PDO::FETCH_COLUMN) ?: [];
        foreach ($learnedWords as &$lw) {
            $lw = self::cleanWordSpelling($lw);
        }

        return [
            'progress' => [
                'coins' => (int)$progress['coins'],
                'score' => (int)$progress['score'],
                'current_level' => (int)$progress['current_level'],
                'current_stage' => $currentStage,
                'current_streak' => (int)$progress['current_streak'],
                'highest_streak' => (int)$progress['highest_streak'],
                'correct_answers' => $totalCorrect,
                'wrong_answers' => (int)$progress['wrong_answers'],
                'total_play_time' => (int)$progress['total_play_time'],
                'total_words_learned' => (int)$progress['total_words_learned'],
                'total_words_mastered' => (int)$progress['total_words_mastered'],
                'accuracy_percent' => (float)$progress['accuracy_percent'],
                'last_login_reward_date' => $progress['last_login_reward_date']
            ],
            'active_words' => $activeWords,
            'learned_words' => $learnedWords,
            'student_class' => $className
        ];
    }

    /**
     * Resolves a single word for a session slot index using prioritized queues.
     */
    private function getWordForSlot(
        PDO $pdo,
        int $studentId,
        string $className,
        int $stageNumber,
        int $sequenceNum,
        array $selectedWordIds,
        array $antiBoredomIds,
        string $lastCategory
    ): ?array {
        $excludeIds = array_unique(array_merge($selectedWordIds, $antiBoredomIds));
        
        $attempts = 0;
        $maxAttempts = 15;
        
        while ($attempts < $maxAttempts) {
            $attempts++;
            $excludePlaceholders = count($excludeIds) > 0 ? implode(',', $excludeIds) : '0';
            
            $word = null;
            
            // Slot Spacing:
            // Every 7th word / 25th word -> Revision (Mastered Word)
            // Every 15th word -> Weak Word
            if ($sequenceNum % 25 === 0 || $sequenceNum % 7 === 0) {
                $word = $this->queryMasteredWord($pdo, $studentId, $className, $excludePlaceholders, $lastCategory);
            } elseif ($sequenceNum % 15 === 0) {
                $word = $this->queryWeakWord($pdo, $studentId, $className, $excludePlaceholders, $lastCategory);
            }
            
            // Fallback: load normal Stage Progression (60% New stage words, 40% practicing stage words)
            if (!$word) {
                $word = $this->queryStageProgression($pdo, $studentId, $className, $stageNumber, $excludePlaceholders, $lastCategory);
            }
            
            // Universal Fallback: load any word from the class mapping if criteria are too restrictive
            if (!$word) {
                $stmtFallback = $pdo->prepare("
                    SELECT w.*, m.id as mapping_id FROM vocabulary_words w
                    JOIN vocabulary_mappings m ON w.id = m.word_id
                    WHERE m.academic_level = :level 
                      AND w.id NOT IN ($excludePlaceholders)
                    ORDER BY RAND() LIMIT 1
                ");
                $stmtFallback->execute([':level' => $className]);
                $word = $stmtFallback->fetch(PDO::FETCH_ASSOC) ?: null;
            }

            // Intelligent Fallback 1: Repeat weak words (only exclude active session IDs)
            if (!$word) {
                $sessionList = count($selectedWordIds) > 0 ? implode(',', $selectedWordIds) : '0';
                $word = $this->queryWeakWord($pdo, $studentId, $className, $sessionList, '');
            }

            // Intelligent Fallback 2: Repeat mastered words (only exclude active session IDs)
            if (!$word) {
                $sessionList = count($selectedWordIds) > 0 ? implode(',', $selectedWordIds) : '0';
                $word = $this->queryMasteredWord($pdo, $studentId, $className, $sessionList, '');
            }

            // Intelligent Fallback 3: Any real word of this class (only exclude active session IDs)
            if (!$word) {
                $sessionList = count($selectedWordIds) > 0 ? implode(',', $selectedWordIds) : '0';
                $stmtFallbackLooser = $pdo->prepare("
                    SELECT w.*, m.id as mapping_id FROM vocabulary_words w
                    JOIN vocabulary_mappings m ON w.id = m.word_id
                    WHERE m.academic_level = :level 
                      AND w.id NOT IN ($sessionList)
                    ORDER BY RAND() LIMIT 1
                ");
                $stmtFallbackLooser->execute([':level' => $className]);
                $word = $stmtFallbackLooser->fetch(PDO::FETCH_ASSOC) ?: null;
            }

            // Intelligent Fallback 4: Absolute fallback: any real word of this class (no exclusions, repeats allowed)
            if (!$word) {
                $stmtFallbackAbsolute = $pdo->prepare("
                    SELECT w.*, m.id as mapping_id FROM vocabulary_words w
                    JOIN vocabulary_mappings m ON w.id = m.word_id
                    WHERE m.academic_level = :level 
                    ORDER BY RAND() LIMIT 1
                ");
                $stmtFallbackAbsolute->execute([':level' => $className]);
                $word = $stmtFallbackAbsolute->fetch(PDO::FETCH_ASSOC) ?: null;
            }

            // Validate spelling, meanings, sentences, category
            if ($word && self::isValidWord($word)) {
                $word['word'] = self::cleanWordSpelling($word['word']);
                return $word;
            }

            if ($word) {
                // Exclude invalid word and try again
                $excludeIds[] = (int)$word['id'];
            } else {
                // No words matching level at all
                break;
            }
        }
        
        return null;
    }

    private function queryMasteredWord(PDO $pdo, int $studentId, string $className, string $excludeList, string $lastCategory): ?array
    {
        $stmt = $pdo->prepare("
            SELECT w.*, m.id as mapping_id FROM vocabulary_words w
            JOIN vocabulary_mappings m ON w.id = m.word_id
            JOIN student_vocabulary_states s ON m.id = s.word_mapping_id
            WHERE s.student_id = :student_id 
              AND s.mastery_status = 'MASTERED'
              AND m.academic_level = :level
              AND w.category != :last_cat
              AND w.id NOT IN ($excludeList)
            ORDER BY RAND() LIMIT 1
        ");
        $stmt->execute([
            ':student_id' => $studentId,
            ':level' => $className,
            ':last_cat' => $lastCategory
        ]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    private function queryWeakWord(PDO $pdo, int $studentId, string $className, string $excludeList, string $lastCategory): ?array
    {
        $stmt = $pdo->prepare("
            SELECT w.*, m.id as mapping_id FROM vocabulary_words w
            JOIN vocabulary_mappings m ON w.id = m.word_id
            JOIN student_vocabulary_states s ON m.id = s.word_mapping_id
            WHERE s.student_id = :student_id 
              AND s.wrong_count > s.correct_count
              AND m.academic_level = :level
              AND w.category != :last_cat
              AND w.id NOT IN ($excludeList)
            ORDER BY RAND() LIMIT 1
        ");
        $stmt->execute([
            ':student_id' => $studentId,
            ':level' => $className,
            ':last_cat' => $lastCategory
        ]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    private function queryStageProgression(PDO $pdo, int $studentId, string $className, int $stageNumber, string $excludeList, string $lastCategory): ?array
    {
        $preferNew = rand(1, 100) <= 60;
        
        if ($preferNew) {
            $stmt = $pdo->prepare("
                SELECT w.*, m.id as mapping_id FROM vocabulary_words w
                JOIN vocabulary_mappings m ON w.id = m.word_id
                LEFT JOIN student_vocabulary_states s ON m.id = s.word_mapping_id AND s.student_id = :student_id
                WHERE m.academic_level = :level 
                  AND m.stage_number = :stage
                  AND s.id IS NULL
                  AND w.category != :last_cat
                  AND w.id NOT IN ($excludeList)
                ORDER BY m.difficulty_score ASC, RAND() LIMIT 1
            ");
            $stmt->execute([
                ':student_id' => $studentId,
                ':level' => $className,
                ':stage' => $stageNumber,
                ':last_cat' => $lastCategory
            ]);
            $word = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($word) return $word;
        }

        $stmt = $pdo->prepare("
            SELECT w.*, m.id as mapping_id FROM vocabulary_words w
            JOIN vocabulary_mappings m ON w.id = m.word_id
            JOIN student_vocabulary_states s ON m.id = s.word_mapping_id
            WHERE s.student_id = :student_id 
              AND m.academic_level = :level
              AND m.stage_number = :stage
              AND s.mastery_status != 'MASTERED'
              AND w.category != :last_cat
              AND w.id NOT IN ($excludeList)
            ORDER BY s.next_revision_at ASC, RAND() LIMIT 1
        ");
        $stmt->execute([
            ':student_id' => $studentId,
            ':level' => $className,
            ':stage' => $stageNumber,
            ':last_cat' => $lastCategory
        ]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    /**
     * Synchronizes progress counters and checks achievements.
     */
    public function syncGameProgress(array $user, array $data): array
    {
        $student = $this->resolveStudent($user);
        $studentId = (int)$student['id'];
        $schoolId = (int)$student['school_id'];
        $studentWithClass = $this->repo->findWithClass($studentId) ?? $student;
        $className = $studentWithClass['class_name'] ?? 'Class 1';

        $pdo = $this->repo->getPdo();
        $today = date('Y-m-d');

        $pdo->beginTransaction();
        try {
            // 1. Sync played word states
            if (isset($data['played_words']) && is_array($data['played_words'])) {
                foreach ($data['played_words'] as $pw) {
                    $wordId = (int)($pw['word_id'] ?? 0);
                    $isCorrect = (bool)($pw['is_correct'] ?? false);

                    $stmtMap = $pdo->prepare("SELECT id FROM vocabulary_mappings WHERE word_id = :word_id AND academic_level = :level LIMIT 1");
                    $stmtMap->execute([':word_id' => $wordId, ':level' => $className]);
                    $mappingId = $stmtMap->fetchColumn();

                    if (!$mappingId) continue;

                    $stmtState = $pdo->prepare("SELECT * FROM student_vocabulary_states WHERE student_id = :student_id AND word_mapping_id = :mapping_id LIMIT 1");
                    $stmtState->execute([':student_id' => $studentId, ':mapping_id' => $mappingId]);
                    $state = $stmtState->fetch(PDO::FETCH_ASSOC);

                    $correctCount = 0;
                    $wrongCount = 0;
                    $consecutiveCorrect = 0;
                    $masteryStatus = 'UNKNOWN';

                    if ($state) {
                        $correctCount = (int)$state['correct_count'];
                        $wrongCount = (int)$state['wrong_count'];
                        $consecutiveCorrect = (int)$state['consecutive_correct'];
                        $masteryStatus = $state['mastery_status'];
                    }

                    if ($isCorrect) {
                        $correctCount++;
                        $consecutiveCorrect++;
                        if ($consecutiveCorrect >= 3) {
                            $masteryStatus = 'MASTERED';
                            $nextRevision = date('Y-m-d H:i:s', strtotime('+7 days'));
                        } else {
                            $masteryStatus = 'PRACTICING';
                            $days = $consecutiveCorrect === 2 ? 3 : 1;
                            $nextRevision = date('Y-m-d H:i:s', strtotime("+$days days"));
                        }
                    } else {
                        $wrongCount++;
                        $consecutiveCorrect = 0;
                        if ($masteryStatus === 'MASTERED') {
                            $masteryStatus = 'PRACTICING';
                        }
                        $nextRevision = date('Y-m-d H:i:s', strtotime('+1 hour'));
                    }

                    if ($state) {
                        $stmtUpState = $pdo->prepare("
                            UPDATE student_vocabulary_states 
                            SET mastery_status = :status,
                                correct_count = :correct,
                                wrong_count = :wrong,
                                consecutive_correct = :consecutive,
                                last_seen_at = CURRENT_TIMESTAMP,
                                next_revision_at = :next_rev
                            WHERE id = :id
                        ");
                        $stmtUpState->execute([
                            ':status' => $masteryStatus,
                            ':correct' => $correctCount,
                            ':wrong' => $wrongCount,
                            ':consecutive' => $consecutiveCorrect,
                            ':next_rev' => $nextRevision,
                            ':id' => $state['id']
                        ]);
                    } else {
                        $stmtInsState = $pdo->prepare("
                            INSERT INTO student_vocabulary_states 
                            (student_id, school_id, word_mapping_id, mastery_status, correct_count, wrong_count, consecutive_correct, last_seen_at, next_revision_at)
                            VALUES 
                            (:student_id, :school_id, :mapping_id, :status, :correct, :wrong, :consecutive, CURRENT_TIMESTAMP, :next_rev)
                        ");
                        $stmtInsState->execute([
                            ':student_id' => $studentId,
                            ':school_id' => $schoolId,
                            ':mapping_id' => $mappingId,
                            ':status' => $masteryStatus,
                            ':correct' => $correctCount,
                            ':wrong' => $wrongCount,
                            ':consecutive' => $consecutiveCorrect,
                            ':next_rev' => $nextRevision
                        ]);
                    }
                }
            }

            // 2. Fetch current progress counters
            $stmtProg = $pdo->prepare("SELECT * FROM student_game_progress WHERE student_id = :student_id AND game_key = 'word-builder' LIMIT 1");
            $stmtProg->execute([':student_id' => $studentId]);
            $progRow = $stmtProg->fetch(PDO::FETCH_ASSOC);

            $currentStage = (int)($progRow['current_stage'] ?? 1);
            $dailyPracticeDays = (int)($progRow['daily_practice_days'] ?? 0);
            $lastPracticeDate = $progRow['last_practice_date'] ?? null;

            if ($lastPracticeDate !== $today) {
                $dailyPracticeDays++;
            }

            // Stage unlocked calculation
            $stmtTotWords = $pdo->prepare("SELECT COUNT(*) FROM vocabulary_mappings WHERE academic_level = :level AND stage_number = :stage");
            $stmtTotWords->execute([':level' => $className, ':stage' => $currentStage]);
            $totalStageWords = (int)$stmtTotWords->fetchColumn();

            $stmtMastWords = $pdo->prepare("
                SELECT COUNT(*) FROM student_vocabulary_states s
                JOIN vocabulary_mappings m ON s.word_mapping_id = m.id
                WHERE s.student_id = :student_id AND m.academic_level = :level AND m.stage_number = :stage AND s.mastery_status = 'MASTERED'
            ");
            $stmtMastWords->execute([':student_id' => $studentId, ':level' => $className, ':stage' => $currentStage]);
            $masteredStageWords = (int)$stmtMastWords->fetchColumn();

            if ($totalStageWords > 0 && ($masteredStageWords / $totalStageWords >= 0.80) && $currentStage < 8) {
                $currentStage++;
            }

            // Recalculate stats
            $stmtTotLearned = $pdo->prepare("
                SELECT COUNT(*) FROM student_vocabulary_states s
                JOIN vocabulary_mappings m ON s.word_mapping_id = m.id
                WHERE s.student_id = :student_id AND m.academic_level = :level AND s.mastery_status != 'UNKNOWN'
            ");
            $stmtTotLearned->execute([':student_id' => $studentId, ':level' => $className]);
            $totalLearned = (int)$stmtTotLearned->fetchColumn();

            $stmtTotMastered = $pdo->prepare("
                SELECT COUNT(*) FROM student_vocabulary_states s
                JOIN vocabulary_mappings m ON s.word_mapping_id = m.id
                WHERE s.student_id = :student_id AND m.academic_level = :level AND s.mastery_status = 'MASTERED'
            ");
            $stmtTotMastered->execute([':student_id' => $studentId, ':level' => $className]);
            $totalMastered = (int)$stmtTotMastered->fetchColumn();

            $correctAnswers = (int)($data['correct_answers'] ?? 0);
            $wrongAnswers = (int)($data['wrong_answers'] ?? 0);
            $accuracy = 0.00;
            if (($correctAnswers + $wrongAnswers) > 0) {
                $accuracy = round(($correctAnswers / ($correctAnswers + $wrongAnswers)) * 100, 2);
            }

            // Save progression metrics
            $stmtUpdate = $pdo->prepare("
                UPDATE student_game_progress 
                SET coins = :coins,
                    score = :score,
                    current_level = :current_level,
                    current_streak = :current_streak,
                    highest_streak = :highest_streak,
                    correct_answers = :correct_answers,
                    wrong_answers = :wrong_answers,
                    total_play_time = :total_play_time,
                    current_stage = :current_stage,
                    total_words_learned = :total_learned,
                    total_words_mastered = :total_mastered,
                    accuracy_percent = :accuracy,
                    longest_streak = GREATEST(longest_streak, :streak_for_longest),
                    daily_practice_days = :practice_days,
                    last_practice_date = :today
                WHERE student_id = :student_id AND game_key = 'word-builder'
            ");
            $stmtUpdate->execute([
                ':coins' => (int)($data['coins'] ?? 0),
                ':score' => (int)($data['score'] ?? 0),
                ':current_level' => (int)($data['current_level'] ?? 1),
                ':current_streak' => (int)($data['current_streak'] ?? 0),
                ':streak_for_longest' => (int)($data['current_streak'] ?? 0),
                ':highest_streak' => (int)($data['highest_streak'] ?? 0),
                ':correct_answers' => $correctAnswers,
                ':wrong_answers' => $wrongAnswers,
                ':total_play_time' => (int)($data['total_play_time'] ?? 0),
                ':current_stage' => $currentStage,
                ':total_learned' => $totalLearned,
                ':total_mastered' => $totalMastered,
                ':accuracy' => $accuracy,
                ':practice_days' => $dailyPracticeDays,
                ':today' => $today,
                ':student_id' => $studentId
            ]);

            // 3. Smart Achievement Unlocks Checker
            $this->checkAchievements($pdo, $studentId, $schoolId, $totalLearned, $totalMastered, (int)($data['highest_streak'] ?? 0));

            $pdo->commit();
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        return $this->getGameProgress($user);
    }

    private function checkAchievements(PDO $pdo, int $studentId, int $schoolId, int $learned, int $mastered, int $streak): void
    {
        $stmtUnlock = $pdo->prepare("INSERT IGNORE INTO student_achievements (student_id, school_id, achievement_key) VALUES (:student_id, :school_id, :key)");

        if ($learned >= 1) {
            $stmtUnlock->execute([':student_id' => $studentId, ':school_id' => $schoolId, ':key' => 'FIRST_WORD']);
        }
        if ($learned >= 100) {
            $stmtUnlock->execute([':student_id' => $studentId, ':school_id' => $schoolId, ':key' => 'WORDS_100']);
        }
        if ($learned >= 500) {
            $stmtUnlock->execute([':student_id' => $studentId, ':school_id' => $schoolId, ':key' => 'WORDS_500']);
        }
        if ($learned >= 1000) {
            $stmtUnlock->execute([':student_id' => $studentId, ':school_id' => $schoolId, ':key' => 'WORDS_1000']);
        }
        if ($streak >= 30) {
            $stmtUnlock->execute([':student_id' => $studentId, ':school_id' => $schoolId, ':key' => 'STREAK_30']);
        }

        // Masters of Category checks
        $stmtCatMaster = $pdo->prepare("
            SELECT COUNT(*) FROM student_vocabulary_states s
            JOIN vocabulary_mappings m ON s.word_mapping_id = m.id
            JOIN vocabulary_words w ON m.word_id = w.id
            WHERE s.student_id = :student_id AND s.mastery_status = 'MASTERED' AND w.category = :category
        ");
        
        $stmtCatMaster->execute([':student_id' => $studentId, ':category' => 'Animals']);
        if ((int)$stmtCatMaster->fetchColumn() >= 10) {
            $stmtUnlock->execute([':student_id' => $studentId, ':school_id' => $schoolId, ':key' => 'ANIMAL_MASTER']);
        }

        $stmtCatMaster->execute([':student_id' => $studentId, ':category' => 'Science']);
        if ((int)$stmtCatMaster->fetchColumn() >= 10) {
            $stmtUnlock->execute([':student_id' => $studentId, ':school_id' => $schoolId, ':key' => 'SCIENCE_MASTER']);
        }
    }

    /**
     * Retrieves or generates Today's Daily challenge.
     */
    public function getDailyChallenge(array $user): array
    {
        $student = $this->resolveStudent($user);
        $studentId = (int)$student['id'];
        $schoolId = (int)$student['school_id'];
        $studentWithClass = $this->repo->findWithClass($studentId) ?? $student;
        $className = $studentWithClass['class_name'] ?? 'Class 1';

        $pdo = $this->repo->getPdo();
        $today = date('Y-m-d');

        // Check if today's challenge already exists
        $stmt = $pdo->prepare("SELECT * FROM student_challenges WHERE student_id = :student_id AND challenge_type = 'DAILY' AND challenge_date = :today LIMIT 1");
        $stmt->execute([':student_id' => $studentId, ':today' => $today]);
        $challenge = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($challenge) {
            $wordIds = json_decode($challenge['word_ids'], true) ?: [];
            $placeholders = implode(',', $wordIds);
            $stmtWords = $pdo->query("SELECT * FROM vocabulary_words WHERE id IN ($placeholders)");
            $words = $stmtWords->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($words as &$w) {
                $w['word'] = self::cleanWordSpelling($w['word']);
            }
            
            return [
                'completed' => (bool)$challenge['is_completed'],
                'words' => $words
            ];
        }

        // Daily Challenge Theme generator: picks category dynamically by weekday
        $themes = ['Animals', 'Nature', 'School', 'Science'];
        $dayIndex = (int)date('w'); // 0 (Sunday) to 6 (Saturday)
        $selectedTheme = $themes[$dayIndex % count($themes)];

        // Get 10 words matching theme and class level
        $stmtSelect = $pdo->prepare("
            SELECT w.* FROM vocabulary_words w
            JOIN vocabulary_mappings m ON w.id = m.word_id
            WHERE m.academic_level = :level AND w.category = :cat
            ORDER BY RAND() LIMIT 100
        ");
        $stmtSelect->execute([':level' => $className, ':cat' => $selectedTheme]);
        $rawWords = $stmtSelect->fetchAll(PDO::FETCH_ASSOC) ?: [];
        
        $words = [];
        foreach ($rawWords as $w) {
            if (self::isValidWord($w)) {
                $words[] = $w;
                if (count($words) === 10) break;
            }
        }

        // If fallback needed
        if (count($words) < 10) {
            $stmtSelectFallback = $pdo->prepare("
                SELECT w.* FROM vocabulary_words w
                JOIN vocabulary_mappings m ON w.id = m.word_id
                WHERE m.academic_level = :level
                ORDER BY RAND() LIMIT 100
            ");
            $stmtSelectFallback->execute([':level' => $className]);
            $rawFallback = $stmtSelectFallback->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($rawFallback as $w) {
                if (in_array($w['id'], array_column($words, 'id'))) continue;
                if (self::isValidWord($w)) {
                    $words[] = $w;
                    if (count($words) === 10) break;
                }
            }
        }

        $wordIds = array_column($words, 'id');
        $stmtIns = $pdo->prepare("
            INSERT INTO student_challenges (student_id, school_id, challenge_type, challenge_date, word_ids, is_completed, score_earned, xp_earned, coins_earned)
            VALUES (:student_id, :school_id, 'DAILY', :today, :word_ids, 0, 0, 0, 0)
        ");
        $stmtIns->execute([
            ':student_id' => $studentId,
            ':school_id' => $schoolId,
            ':today' => $today,
            ':word_ids' => json_encode($wordIds)
        ]);

        foreach ($words as &$w) {
            $w['word'] = self::cleanWordSpelling($w['word']);
        }

        return [
            'completed' => false,
            'words' => $words
        ];
    }

    public function submitDailyChallenge(array $user, array $data): array
    {
        $student = $this->resolveStudent($user);
        $studentId = (int)$student['id'];
        $today = date('Y-m-d');
        $pdo = $this->repo->getPdo();

        $pdo->beginTransaction();
        try {
            $stmtUp = $pdo->prepare("
                UPDATE student_challenges 
                SET is_completed = 1, score_earned = 100, xp_earned = 100, coins_earned = 50
                WHERE student_id = :student_id AND challenge_type = 'DAILY' AND challenge_date = :today
            ");
            $stmtUp->execute([':student_id' => $studentId, ':today' => $today]);

            // Award daily reward coins and score
            $stmtProg = $pdo->prepare("
                UPDATE student_game_progress 
                SET coins = coins + 50, score = score + 100
                WHERE student_id = :student_id AND game_key = 'word-builder'
            ");
            $stmtProg->execute([':student_id' => $studentId]);

            $pdo->commit();
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        return ['success' => true, 'message' => 'Daily Challenge Completed! +50 Coins, +100 XP.'];
    }

    /**
     * Weekly review test: 10 words from active stage + 10 words from previous stages.
     */
    public function getWeeklyChallenge(array $user): array
    {
        $student = $this->resolveStudent($user);
        $studentId = (int)$student['id'];
        $studentWithClass = $this->repo->findWithClass($studentId) ?? $student;
        $className = $studentWithClass['class_name'] ?? 'Class 1';

        $pdo = $this->repo->getPdo();
        $today = date('Y-m-d');

        // Check if weekly challenge exists
        $stmt = $pdo->prepare("SELECT * FROM student_challenges WHERE student_id = :student_id AND challenge_type = 'WEEKLY' AND challenge_date = :today LIMIT 1");
        $stmt->execute([':student_id' => $studentId, ':today' => $today]);
        $challenge = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($challenge) {
            $wordIds = json_decode($challenge['word_ids'], true) ?: [];
            $placeholders = implode(',', $wordIds);
            $stmtWords = $pdo->query("SELECT * FROM vocabulary_words WHERE id IN ($placeholders)");
            $words = $stmtWords->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($words as &$w) {
                $w['word'] = self::cleanWordSpelling($w['word']);
            }
            return [
                'completed' => (bool)$challenge['is_completed'],
                'words' => $words
            ];
        }

        // Get 10 words from current stage
        $stmtProgress = $pdo->prepare("SELECT current_stage FROM student_game_progress WHERE student_id = :student_id AND game_key = 'word-builder'");
        $stmtProgress->execute([':student_id' => $studentId]);
        $currentStage = (int)($stmtProgress->fetchColumn() ?: 1);

        $stmtCurrent = $pdo->prepare("
            SELECT w.* FROM vocabulary_words w
            JOIN vocabulary_mappings m ON w.id = m.word_id
            WHERE m.academic_level = :level AND m.stage_number = :stage
            ORDER BY RAND() LIMIT 50
        ");
        $stmtCurrent->execute([':level' => $className, ':stage' => $currentStage]);
        $rawCurr = $stmtCurrent->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $currWords = [];
        foreach ($rawCurr as $w) {
            if (self::isValidWord($w)) {
                $currWords[] = $w;
                if (count($currWords) === 10) break;
            }
        }

        // Get 10 words from previous stages or classes
        $prevStage = max(1, $currentStage - 1);
        $stmtPrev = $pdo->prepare("
            SELECT w.* FROM vocabulary_words w
            JOIN vocabulary_mappings m ON w.id = m.word_id
            WHERE m.academic_level = :level AND m.stage_number = :stage
            ORDER BY RAND() LIMIT 50
        ");
        $stmtPrev->execute([':level' => $className, ':stage' => $prevStage]);
        $rawPrev = $stmtPrev->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $prevWords = [];
        foreach ($rawPrev as $w) {
            if (self::isValidWord($w)) {
                $prevWords[] = $w;
                if (count($prevWords) === 10) break;
            }
        }

        $allWords = array_merge($currWords, $prevWords);
        $wordIds = array_column($allWords, 'id');

        $stmtIns = $pdo->prepare("
            INSERT INTO student_challenges (student_id, school_id, challenge_type, challenge_date, word_ids, is_completed, score_earned, xp_earned, coins_earned)
            VALUES (:student_id, :school_id, 'WEEKLY', :today, :word_ids, 0, 0, 0, 0)
        ");
        $stmtIns->execute([
            ':student_id' => $studentId,
            ':school_id' => $student['school_id'],
            ':today' => $today,
            ':word_ids' => json_encode($wordIds)
        ]);

        foreach ($allWords as &$w) {
            $w['word'] = self::cleanWordSpelling($w['word']);
        }

        return [
            'completed' => false,
            'words' => $allWords
        ];
    }

    public function submitWeeklyChallenge(array $user, array $data): array
    {
        $student = $this->resolveStudent($user);
        $studentId = (int)$student['id'];
        $schoolId = (int)$student['school_id'];
        $today = date('Y-m-d');
        $pdo = $this->repo->getPdo();

        $pdo->beginTransaction();
        try {
            $stmtUp = $pdo->prepare("
                UPDATE student_challenges 
                SET is_completed = 1, score_earned = 250, xp_earned = 250, coins_earned = 100
                WHERE student_id = :student_id AND challenge_type = 'WEEKLY' AND challenge_date = :today
            ");
            $stmtUp->execute([':student_id' => $studentId, ':today' => $today]);

            $stmtProg = $pdo->prepare("
                UPDATE student_game_progress 
                SET coins = coins + 100, score = score + 250
                WHERE student_id = :student_id AND game_key = 'word-builder'
            ");
            $stmtProg->execute([':student_id' => $studentId]);

            // Unlock Weekly Champion badge
            $stmtUnlock = $pdo->prepare("INSERT IGNORE INTO student_achievements (student_id, school_id, achievement_key) VALUES (:student_id, :school_id, 'WEEKLY_CHAMPION')");
            $stmtUnlock->execute([':student_id' => $studentId, ':school_id' => $schoolId]);

            $pdo->commit();
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        return ['success' => true, 'message' => 'Weekly Challenge Completed! +100 Coins, +250 XP, Badge Unlocked.'];
    }

    /**
     * School, Section, and Class Rankings.
     */
    public function getLeaderboard(array $user): array
    {
        $student = $this->resolveStudent($user);
        $studentId = (int)$student['id'];
        $schoolId = (int)$student['school_id'];
        $studentWithClass = $this->repo->findWithClass($studentId) ?? $student;
        $className = $studentWithClass['class_name'] ?? 'Class 1';
        $classId = (int)($studentWithClass['class_id'] ?? 0);

        $pdo = $this->repo->getPdo();

        // 1. School Leaderboard
        $stmtSchool = $pdo->prepare("
            SELECT s.id, u.name, p.score, p.total_words_mastered FROM students s
            JOIN users u ON s.email = u.email
            JOIN student_game_progress p ON s.id = p.student_id
            WHERE s.school_id = :school_id AND p.game_key = 'word-builder'
            ORDER BY p.score DESC LIMIT 10
        ");
        $stmtSchool->execute([':school_id' => $schoolId]);
        $schoolRank = $stmtSchool->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // 2. Class Leaderboard (grade-wide: e.g. all sections of Class 3)
        $stmtClass = $pdo->prepare("
            SELECT s.id, u.name, p.score, p.total_words_mastered FROM students s
            JOIN users u ON s.email = u.email
            JOIN student_game_progress p ON s.id = p.student_id
            JOIN classes c ON s.class_id = c.id
            WHERE s.school_id = :school_id AND c.name = :class AND p.game_key = 'word-builder'
            ORDER BY p.score DESC LIMIT 10
        ");
        $stmtClass->execute([':school_id' => $schoolId, ':class' => $className]);
        $classRank = $stmtClass->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // 3. Section Leaderboard (specific class section)
        $stmtSection = $pdo->prepare("
            SELECT s.id, u.name, p.score, p.total_words_mastered FROM students s
            JOIN users u ON s.email = u.email
            JOIN student_game_progress p ON s.id = p.student_id
            WHERE s.school_id = :school_id AND s.class_id = :class_id AND p.game_key = 'word-builder'
            ORDER BY p.score DESC LIMIT 10
        ");
        $stmtSection->execute([':school_id' => $schoolId, ':class_id' => $classId]);
        $sectionRank = $stmtSection->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return [
            'school_rankings' => $schoolRank,
            'class_rankings' => $classRank,
            'section_rankings' => $sectionRank
        ];
    }

    /**
     * Achievements listing.
     */
    public function getAchievements(array $user): array
    {
        $student = $this->resolveStudent($user);
        $studentId = (int)$student['id'];
        $pdo = $this->repo->getPdo();

        $stmt = $pdo->prepare("SELECT achievement_key, unlocked_at FROM student_achievements WHERE student_id = :student_id");
        $stmt->execute([':student_id' => $studentId]);
        $unlocked = $stmt->fetchAll(PDO::FETCH_UNIQUE | PDO::FETCH_ASSOC) ?: [];

        $allBadges = [
            ['key' => 'FIRST_WORD', 'title' => 'First Word', 'desc' => 'Answered first word correctly', 'points' => 50],
            ['key' => 'WORDS_100', 'title' => 'Centurion Reader', 'desc' => 'Learned 100 vocabulary words', 'points' => 100],
            ['key' => 'WORDS_500', 'title' => 'Vocabulary Sage', 'desc' => 'Learned 500 vocabulary words', 'points' => 250],
            ['key' => 'WORDS_1000', 'title' => 'Master Dictionary', 'desc' => 'Learned 1,000 vocabulary words', 'points' => 500],
            ['key' => 'STREAK_30', 'title' => 'Loyal Scholar', 'desc' => 'Achieved a 30-day streak', 'points' => 300],
            ['key' => 'ANIMAL_MASTER', 'title' => 'Master of Animals', 'desc' => 'Mastered 10 animal words', 'points' => 100],
            ['key' => 'SCIENCE_MASTER', 'title' => 'Science Champion', 'desc' => 'Mastered 10 science words', 'points' => 100],
            ['key' => 'WEEKLY_CHAMPION', 'title' => 'Weekly Champion', 'desc' => 'Completed a Weekly challenge', 'points' => 200],
        ];

        foreach ($allBadges as &$badge) {
            $badgeKey = $badge['key'];
            $badge['unlocked'] = isset($unlocked[$badgeKey]);
            $badge['unlocked_at'] = $unlocked[$badgeKey]['unlocked_at'] ?? null;
        }

        return $allBadges;
    }

    /**
     * Parent statistics report.
     */
    public function getParentReport(array $user, int $studentId = 0): array
    {
        $pdo = $this->repo->getPdo();
        if ($studentId > 0) {
            // Verify this student belongs to parent phone or school_id
            if ($user['role'] === 'PARENT') {
                $stmtVerify = $pdo->prepare("
                    SELECT s.* FROM students s
                    JOIN users u ON s.parent_phone = u.phone
                    WHERE s.id = :student_id AND u.phone = :phone AND s.school_id = :school_id
                ");
                $stmtVerify->execute([
                    ':student_id' => $studentId,
                    ':phone' => $user['phone'],
                    ':school_id' => $user['school_id']
                ]);
                $student = $stmtVerify->fetch(PDO::FETCH_ASSOC);
            } else {
                $stmtVerify = $pdo->prepare("SELECT * FROM students WHERE id = :student_id AND school_id = :school_id");
                $stmtVerify->execute([':student_id' => $studentId, ':school_id' => $user['school_id']]);
                $student = $stmtVerify->fetch(PDO::FETCH_ASSOC);
            }
            if (!$student) {
                throw new NotFoundException('Student child not found.');
            }
        } else {
            $student = $this->resolveStudent($user);
        }
        $studentId = (int)$student['id'];
        $studentWithClass = $this->repo->findWithClass($studentId) ?? $student;
        $className = $studentWithClass['class_name'] ?? 'Class 1';

        // 1. Basic progress stats
        $stmtProg = $pdo->prepare("SELECT * FROM student_game_progress WHERE student_id = :student_id AND game_key = 'word-builder' LIMIT 1");
        $stmtProg->execute([':student_id' => $studentId]);
        $prog = $stmtProg->fetch(PDO::FETCH_ASSOC) ?: [];

        // 2. Strengths and Weaknesses by Category
        $stmtCat = $pdo->prepare("
            SELECT w.category, SUM(s.correct_count) as correct, SUM(s.wrong_count) as wrong FROM student_vocabulary_states s
            JOIN vocabulary_mappings m ON s.word_mapping_id = m.id
            JOIN vocabulary_words w ON m.word_id = w.id
            WHERE s.student_id = :student_id
            GROUP BY w.category
        ");
        $stmtCat->execute([':student_id' => $studentId]);
        $categories = $stmtCat->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return [
            'stats' => [
                'score' => (int)($prog['score'] ?? 0),
                'coins' => (int)($prog['coins'] ?? 0),
                'current_level' => (int)($prog['current_level'] ?? 1),
                'total_words_learned' => (int)($prog['total_words_learned'] ?? 0),
                'total_words_mastered' => (int)($prog['total_words_mastered'] ?? 0),
                'accuracy_percent' => (float)($prog['accuracy_percent'] ?? 0.00),
                'current_streak' => (int)($prog['current_streak'] ?? 0),
                'longest_streak' => (int)($prog['longest_streak'] ?? 0),
                'daily_practice_days' => (int)($prog['daily_practice_days'] ?? 0)
            ],
            'category_performance' => $categories,
            'student_name' => $student['first_name'] . ' ' . $student['last_name'],
            'student_class' => $className
        ];
    }

    /**
     * Teacher statistics report.
     */
    public function getTeacherReport(array $user, int $classId): array
    {
        $pdo = $this->repo->getPdo();

        // Find class name
        $stmtClassName = $pdo->prepare("SELECT name FROM classes WHERE id = :id LIMIT 1");
        $stmtClassName->execute([':id' => $classId]);
        $className = $stmtClassName->fetchColumn() ?: 'Class 1';

        // 1. Fetch class metrics
        $stmtClassMetrics = $pdo->prepare("
            SELECT 
                AVG(p.accuracy_percent) as avg_accuracy,
                AVG(p.current_stage) as avg_stage,
                SUM(p.total_words_learned) as total_learned,
                SUM(p.total_words_mastered) as total_mastered
            FROM students s
            JOIN student_game_progress p ON s.id = p.student_id
            WHERE s.class_id = :class_id AND p.game_key = 'word-builder'
        ");
        $stmtClassMetrics->execute([':class_id' => $classId]);
        $metrics = $stmtClassMetrics->fetch(PDO::FETCH_ASSOC);

        // 2. Class Weak Categories
        $stmtClassCat = $pdo->prepare("
            SELECT w.category, SUM(s.correct_count) as correct, SUM(s.wrong_count) as wrong FROM student_vocabulary_states s
            JOIN students st ON s.student_id = st.id
            JOIN vocabulary_mappings m ON s.word_mapping_id = m.id
            JOIN vocabulary_words w ON m.word_id = w.id
            WHERE st.class_id = :class_id
            GROUP BY w.category
            ORDER BY wrong DESC LIMIT 5
        ");
        $stmtClassCat->execute([':class_id' => $classId]);
        $weakCategories = $stmtClassCat->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // 3. Most difficult words
        $stmtDiff = $pdo->prepare("
            SELECT w.word, SUM(s.wrong_count) as total_wrongs FROM student_vocabulary_states s
            JOIN students st ON s.student_id = st.id
            JOIN vocabulary_mappings m ON s.word_mapping_id = m.id
            JOIN vocabulary_words w ON m.word_id = w.id
            WHERE st.class_id = :class_id
            GROUP BY w.id
            ORDER BY total_wrongs DESC LIMIT 5
        ");
        $stmtDiff->execute([':class_id' => $classId]);
        $difficultWords = $stmtDiff->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // 4. Most active students
        $stmtActive = $pdo->prepare("
            SELECT s.first_name, s.last_name, p.score, p.total_words_learned FROM students s
            JOIN student_game_progress p ON s.id = p.student_id
            WHERE s.class_id = :class_id AND p.game_key = 'word-builder'
            ORDER BY p.score DESC LIMIT 5
        ");
        $stmtActive->execute([':class_id' => $classId]);
        $activeStudents = $stmtActive->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return [
            'class_name' => $className,
            'summary' => [
                'average_accuracy' => round((float)($metrics['avg_accuracy'] ?? 0.00), 2),
                'average_stage' => round((float)($metrics['avg_stage'] ?? 1.00), 2),
                'total_words_learned' => (int)($metrics['total_learned'] ?? 0),
                'total_words_mastered' => (int)($metrics['total_mastered'] ?? 0)
            ],
            'weak_categories' => $weakCategories,
            'difficult_words' => $difficultWords,
            'active_students' => $activeStudents
        ];
    }

    /**
     * School Analytics.
     */
    public function getSchoolAnalytics(array $user): array
    {
        $schoolId = (int)$user['school_id'];
        $pdo = $this->repo->getPdo();

        // 1. Total words played
        $stmtPlayed = $pdo->prepare("SELECT SUM(correct_count + wrong_count) FROM student_vocabulary_states WHERE school_id = :school_id");
        $stmtPlayed->execute([':school_id' => $schoolId]);
        $totalPlayed = (int)$stmtPlayed->fetchColumn();

        // 2. DAU & MAU
        $stmtDau = $pdo->prepare("SELECT COUNT(DISTINCT student_id) FROM student_vocabulary_states WHERE school_id = :school_id AND last_seen_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)");
        $stmtDau->execute([':school_id' => $schoolId]);
        $dau = (int)$stmtDau->fetchColumn();

        $stmtMau = $pdo->prepare("SELECT COUNT(DISTINCT student_id) FROM student_vocabulary_states WHERE school_id = :school_id AND last_seen_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
        $stmtMau->execute([':school_id' => $schoolId]);
        $mau = (int)$stmtMau->fetchColumn();

        // 3. Category performance
        $stmtCat = $pdo->prepare("
            SELECT w.category, SUM(s.correct_count) as correct, SUM(s.wrong_count) as wrong FROM student_vocabulary_states s
            JOIN vocabulary_mappings m ON s.word_mapping_id = m.id
            JOIN vocabulary_words w ON m.word_id = w.id
            WHERE s.school_id = :school_id
            GROUP BY w.category
        ");
        $stmtCat->execute([':school_id' => $schoolId]);
        $categories = $stmtCat->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // 4. Grade performance
        $stmtGrade = $pdo->prepare("
            SELECT m.academic_level, SUM(s.correct_count) as correct, SUM(s.wrong_count) as wrong FROM student_vocabulary_states s
            JOIN vocabulary_mappings m ON s.word_mapping_id = m.id
            WHERE s.school_id = :school_id
            GROUP BY m.academic_level
        ");
        $stmtGrade->execute([':school_id' => $schoolId]);
        $grades = $stmtGrade->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return [
            'total_words_played' => $totalPlayed,
            'dau' => $dau,
            'mau' => $mau,
            'category_performance' => $categories,
            'grade_performance' => $grades
        ];
    }
}
