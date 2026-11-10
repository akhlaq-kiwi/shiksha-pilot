import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:workmanager/workmanager.dart';
import 'constants/app_colors.dart';
import 'package:http/http.dart' as http;
import 'screens/home_screen.dart';
import 'screens/app_lock_screen.dart';
import 'services/leave_service.dart';
import 'services/auth_service.dart';
import 'services/app_lock_helper.dart';
import 'services/notification_helper.dart';
import 'services/push_notification_service.dart';
import 'services/student_session_helper.dart';
import 'config.dart';

const String fetchNotificationsTask = "com.shikshapilot.schoolhub.fetchNotifications";

@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((taskName, inputData) async {
    switch (taskName) {
      case fetchNotificationsTask:
        try {
          final prefs = await SharedPreferences.getInstance();
          final token = prefs.getString('auth_token') ?? '';
          final userRole = prefs.getString('user_role') ?? '';
          final baseUrl = resolveBaseUrlFrom(prefs);
          if (token.isEmpty || userRole.isEmpty) return true;

          final roleUpper = userRole.toUpperCase();
          final String path;
          final bool isSchoolStaff;
          if (roleUpper == 'TEACHER' || roleUpper == 'PRINCIPAL') {
            path = '/api/teacher/notifications';
            isSchoolStaff = true;
          } else if (roleUpper == 'SCHOOL_ADMIN' || roleUpper == 'SUPER_ADMIN') {
            path = '/api/school/notifications';
            isSchoolStaff = true;
          } else {
            path = '/api/student/notifications';
            isSchoolStaff = false;
          }
              
          final studentId = prefs.getInt('selected_student_id');
          final String lastNotifiedKey = (!isSchoolStaff && studentId != null)
              ? 'last_notified_id_${userRole}_$studentId'
              : 'last_notified_id_$userRole';

          final uri = Uri.parse('$baseUrl$path').replace(
            queryParameters: (!isSchoolStaff && studentId != null)
                ? {'student_id': studentId.toString()}
                : null,
          );
          final headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
            if (!isSchoolStaff && studentId != null) 'X-Student-Id': studentId.toString(),
          };

          final response = await http.get(uri, headers: headers);
          if (response.statusCode == 200) {
            final decodedBody = json.decode(response.body);
            final List<dynamic> data = isSchoolStaff 
                ? (decodedBody['notifications'] ?? decodedBody['data'] ?? [])
                : (decodedBody['data'] ?? []);

            if (data.isNotEmpty) {
              int lastNotifiedId = prefs.getInt(lastNotifiedKey) ?? 0;
              int maxId = lastNotifiedId;
              for (final n in data) {
                final int? nId = n['id'] is int ? n['id'] as int : int.tryParse(n['id']?.toString() ?? '');
                if (nId != null && nId > maxId) maxId = nId;
              }

              // On fresh session where last_notified_id is unset, baseline to current maxId
              // rather than re-emitting historical unread notifications already pushed via FCM.
              if (lastNotifiedId == 0) {
                if (maxId > 0) {
                  await prefs.setInt(lastNotifiedKey, maxId);
                }
              } else {
                final unreadNotifs = data.where((n) {
                  final isUnread = n['is_read'] == 0 || n['is_read'] == false || n['is_read'] == '0';
                  final linkStr = (n['link'] ?? '').toString().toLowerCase();
                  final catStr = (n['category'] ?? '').toString().toUpperCase();
                  final evtStr = (n['event_key'] ?? '').toString().toUpperCase();
                  if (linkStr == '/notice' || linkStr.contains('notice') || catStr == 'ANNOUNCEMENT' || evtStr == 'ANNOUNCEMENT_PUBLISHED') {
                    return false;
                  }
                  if (roleUpper == 'SCHOOL_ADMIN' &&
                      (catStr == 'LEAVE' || catStr == 'LEAVE_MANAGEMENT' || evtStr.contains('LEAVE') || linkStr.contains('leave'))) {
                    return false;
                  }
                  final int nId = n['id'] is int ? n['id'] : int.parse(n['id'].toString());
                  return isUnread && nId > lastNotifiedId;
                }).toList();

                unreadNotifs.sort((a, b) {
                  final int aId = a['id'] is int ? a['id'] : int.parse(a['id'].toString());
                  final int bId = b['id'] is int ? b['id'] : int.parse(b['id'].toString());
                  return aId.compareTo(bId);
                });

                if (unreadNotifs.isNotEmpty) {
                  await NotificationHelper.init();
                  for (final notif in unreadNotifs) {
                    final int nId = notif['id'] is int ? notif['id'] : int.parse(notif['id'].toString());
                    if (nId > maxId) maxId = nId;
                    await NotificationHelper.showNotification(notif, badgeCount: unreadNotifs.length);
                  }
                  await prefs.setInt(lastNotifiedKey, maxId);
                }
              }
            }
          }
        } catch (e) {
          debugPrint('WorkManager task error: $e');
        }
        break;
    }
    return true;
  });
}

final ValueNotifier<ThemeMode> appThemeNotifier = ValueNotifier<ThemeMode>(ThemeMode.light);

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    // Login screen is always light/normal. Only apply user-selected theme if already signed in!
    if (token != null && token.isNotEmpty) {
      final savedTheme = prefs.getString('theme_mode') ?? 'Light Mode';
      if (savedTheme == 'Dark Mode') {
        appThemeNotifier.value = ThemeMode.dark;
      } else if (savedTheme == 'System Defaults' || savedTheme == 'System') {
        appThemeNotifier.value = ThemeMode.system;
      } else {
        appThemeNotifier.value = ThemeMode.light;
      }
    } else {
      appThemeNotifier.value = ThemeMode.light;
    }
  } catch (_) {}
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  await NotificationHelper.init();
  try {
    await PushNotificationService.init();
  } catch (e) {
    debugPrint('PushNotificationService.init error: $e');
  }
  await Workmanager().initialize(
    callbackDispatcher,
    isInDebugMode: false,
  );
  await Workmanager().registerPeriodicTask(
    "1",
    fetchNotificationsTask,
    frequency: const Duration(minutes: 15),
    existingWorkPolicy: ExistingPeriodicWorkPolicy.replace,
  );
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: appThemeNotifier,
      builder: (context, currentThemeMode, _) {
        return MaterialApp(
          navigatorKey: navigatorKey,
          title: 'Shiksha Pilot',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            useMaterial3: true,
            fontFamily: 'Roboto',
            scaffoldBackgroundColor: AppColors.surfaceCanvas,
            colorScheme: AppColors.lightColorScheme,
            tabBarTheme: const TabBarThemeData(
              splashFactory: NoSplash.splashFactory,
              overlayColor: WidgetStatePropertyAll(Colors.transparent),
            ),
          ),
          darkTheme: ThemeData(
            useMaterial3: true,
            fontFamily: 'Roboto',
            brightness: Brightness.dark,
            scaffoldBackgroundColor: AppColors.darkSurfaceCanvas,
            canvasColor: AppColors.darkSurfaceCanvas,
            cardColor: const Color(0xFF1E293B),
            colorScheme: AppColors.darkColorScheme.copyWith(
              surface: const Color(0xFF1E293B),
              onSurface: Colors.white,
            ),
            appBarTheme: const AppBarTheme(
              backgroundColor: Color(0xFF1E293B),
              foregroundColor: Colors.white,
              elevation: 0,
              iconTheme: IconThemeData(color: Colors.white),
              titleTextStyle: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            cardTheme: CardThemeData(
              color: const Color(0xFF1E293B),
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            bottomSheetTheme: const BottomSheetThemeData(
              backgroundColor: Color(0xFF1E293B),
              modalBackgroundColor: Color(0xFF1E293B),
            ),
            dialogTheme: const DialogThemeData(
              backgroundColor: Color(0xFF1E293B),
              titleTextStyle: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              contentTextStyle: TextStyle(color: Color(0xFFCBD5E1), fontSize: 14),
            ),
            tabBarTheme: const TabBarThemeData(
              splashFactory: NoSplash.splashFactory,
              overlayColor: WidgetStatePropertyAll(Colors.transparent),
            ),
          ),
          themeMode: currentThemeMode,
          builder: (context, child) {
            return GestureDetector(
              behavior: HitTestBehavior.translucent,
              onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
              child: NotificationListener<ScrollStartNotification>(
                onNotification: (scroll) {
                  if (scroll.dragDetails != null) {
                    FocusManager.instance.primaryFocus?.unfocus();
                  }
                  return false;
                },
                child: child ?? const SizedBox.shrink(),
              ),
            );
          },
          home: const SplashScreen(),
        );
      },
    );
  }
}

// -----------------------------------------------------------------------------
// Splash Screen
// -----------------------------------------------------------------------------
class SplashScreen extends StatefulWidget {
  const SplashScreen({Key? key}) : super(key: key);

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeIn),
    );
    _scaleAnimation = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeOutBack),
    );

    _animationController.forward();
    _checkAuthSession();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  Future<void> _checkAuthSession() async {
    // Wait for the animation to look premium and natural
    await Future.delayed(const Duration(milliseconds: 2500));
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    final role = prefs.getString('user_role');
    final baseUrl = resolveBaseUrlFrom(prefs);
    await prefs.setString('base_url', baseUrl);

    if (token != null && role != null) {
      // Check if session token has expired
      bool isExpired = false;
      try {
        String normalized = base64.normalize(token.trim());
        final decodedBytes = base64.decode(normalized);
        final decodedStr = utf8.decode(decodedBytes);
        final payload = json.decode(decodedStr);
        if (payload is Map && payload.containsKey('exp')) {
          final expSec = int.tryParse(payload['exp'].toString());
          if (expSec != null) {
            final expTime = DateTime.fromMillisecondsSinceEpoch(expSec * 1000);
            if (DateTime.now().isAfter(expTime)) {
              isExpired = true;
            }
          }
        }
      } catch (e) {
        debugPrint('Token decode error in SplashScreen: $e');
      }

      if (isExpired) {
        await prefs.remove('auth_token');
        await prefs.remove('user_role');
        await prefs.remove('user_name');
        await prefs.remove('user_phone');
        await prefs.remove('user_id');
        await prefs.remove('selected_student_id');
        await prefs.remove('selected_student_name');
        await prefs.remove('selected_student_admission_no');
        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (_) => const LoginScreen(
                initialErrorMessage: 'Your session has expired. Please sign in again.',
              ),
            ),
          );
        }
        return;
      }

      final leaveService = LeaveService(baseUrl: baseUrl, token: token);

      // Sync latest account-level security state (App Lock) & school_name from backend when online
      String schoolName = (prefs.getString('school_name') ?? '').trim();
      try {
        final authService = AuthService(baseUrl: baseUrl);
        final profile = await authService.fetchProfile(token).timeout(const Duration(seconds: 4));
        final sName = ((profile['school_name'] as String?) ?? '').trim();
        if (sName.isNotEmpty) {
          schoolName = sName.toUpperCase();
          await prefs.setString('school_name', schoolName);
        }
        final int profileUid = profile['id'] is int
            ? profile['id'] as int
            : int.tryParse(profile['id']?.toString() ?? '') ?? (prefs.getInt('user_id') ?? 0);
        final String profilePhone = ((profile['phone'] as String?) ?? (prefs.getString('user_phone') ?? '')).trim();
        if (profileUid > 0 && (prefs.getInt('user_id') ?? 0) <= 0) {
          await prefs.setInt('user_id', profileUid);
        }
        if (profilePhone.isNotEmpty && (prefs.getString('user_phone') ?? '').isEmpty) {
          await prefs.setString('user_phone', profilePhone);
        }
        if (profile.containsKey('app_lock_enabled')) {
          final bool serverLockEnabled = profile['app_lock_enabled'] == true ||
              profile['app_lock_enabled'] == 1 ||
              profile['app_lock_enabled'] == '1';
          await AppLockHelper.syncFromServerState(
            prefs,
            userId: profileUid,
            phone: profilePhone,
            enabled: serverLockEnabled,
          );
        }
      } catch (e) {
        debugPrint('Profile/AppLock sync skipped in SplashScreen (offline or timeout): $e');
      }
      if (schoolName.isEmpty) {
        schoolName = 'SHIKSHA PILOT ACADEMY';
        await prefs.setString('school_name', schoolName);
      } else {
        schoolName = schoolName.toUpperCase();
      }

      final roleUpper = role.toUpperCase();

      void navigateToHome(Widget homeScreenWidget) {
        final uid = prefs.getInt('user_id') ?? 0;
        final phone = (prefs.getString('user_phone') ?? '').trim();
        final bool isAppLockEnabled = AppLockHelper.isEnabledLocally(
          prefs,
          userId: uid,
          phone: phone,
        );
        final String userName = prefs.getString('user_name') ?? '';

        if (isAppLockEnabled) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (lockContext) => AppLockScreen(
                userName: userName,
                userRole: role,
                schoolName: schoolName,
                baseUrl: baseUrl,
                token: token,
                onUnlockSuccess: () {
                  Navigator.pushReplacement(
                    lockContext,
                    MaterialPageRoute(builder: (_) => homeScreenWidget),
                  );
                },
              ),
            ),
          );
        } else {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (_) => homeScreenWidget),
          );
        }
      }

      if (roleUpper == 'PARENT' || roleUpper == 'STUDENT') {
        final savedStudentId = StudentSessionHelper.readSavedStudentId(prefs);
        final savedAdmNo = prefs.getString(StudentSessionHelper.prefSelectedStudentAdmissionNo);
        final savedStudentName = prefs.getString(StudentSessionHelper.prefSelectedStudentName);
        try {
          final children = await leaveService.getChildren().timeout(const Duration(seconds: 8));
          if (children.isNotEmpty) {
            final resolved = StudentSessionHelper.resolveActiveChild(
              children,
              preferredStudentId: savedStudentId,
              savedAdmissionNo: savedAdmNo,
              savedName: savedStudentName,
            );
            final activeStudentId = StudentSessionHelper.parseId(resolved?['id']);
            if (resolved != null && activeStudentId != null) {
              await StudentSessionHelper.persistSelectedChild(prefs, resolved);
              if (mounted) {
                navigateToHome(
                  HomeScreen(
                    leaveService: leaveService,
                    userRole: role,
                    selectedStudentId: activeStudentId,
                    userName: (resolved['name'] ?? '').toString().trim(),
                    userPhoto: (resolved['photo_path'] ?? resolved['photo'] ?? '').toString().trim(),
                    schoolName: schoolName,
                  ),
                );
                return;
              }
            }
          }
        } catch (e) {
          debugPrint('Splash getChildren failed/timed out, using saved student: $e');
        }
        if (savedStudentId != null && mounted) {
          navigateToHome(
            HomeScreen(
              leaveService: leaveService,
              userRole: role,
              selectedStudentId: savedStudentId,
              schoolName: schoolName,
            ),
          );
          return;
        }
      } else {
        // Teacher / School Admin
        final bool isPrincipal = (prefs.getBool('is_principal') ?? false) || (roleUpper == 'PRINCIPAL');
        final bool isFeeCollector = prefs.getBool('is_fee_collector') ?? false;
        final String userPhoto = prefs.getString('user_photo') ?? '';
        final String userName = prefs.getString('user_name') ?? '';
        if (mounted) {
          navigateToHome(
            HomeScreen(
              leaveService: leaveService,
              userRole: role,
              isPrincipal: isPrincipal,
              isFeeCollector: isFeeCollector,
              userPhoto: userPhoto,
              userName: userName,
              schoolName: schoolName,
            ),
          );
          return;
        }
      }
    }

    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Colors.indigo, Colors.deepPurple],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: ScaleTransition(
            scale: _scaleAnimation,
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // logo_mark.png, not logo.png: the latter has an opaque white
                  // plate baked in behind the artwork, which showed up as a
                  // white square against this gradient.
                  Image.asset(
                    'assets/images/logo_mark.png',
                    width: 140,
                    height: 140,
                    fit: BoxFit.contain,
                  ),
                  const SizedBox(height: 32),
                  const Text(
                    'SHIKSHA PILOT',
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      letterSpacing: 2,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Login Screen
// -----------------------------------------------------------------------------
class LoginScreen extends StatefulWidget {
  final String? initialErrorMessage;
  const LoginScreen({Key? key, this.initialErrorMessage}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  
  bool _obscurePassword = true;
  bool _isLoading = false;
  String _errorMessage = '';

  String? _phoneValidationError;
  String? _passwordValidationError;

  @override
  void initState() {
    super.initState();
    if (widget.initialErrorMessage != null && widget.initialErrorMessage!.isNotEmpty) {
      _errorMessage = widget.initialErrorMessage!;
    }
    _loadServerUrl();
  }

  Future<void> _loadServerUrl() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(kBaseUrlPrefKey, resolveBaseUrlFrom(prefs));
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    final prefs = await SharedPreferences.getInstance();
    final activeBaseUrl = resolveBaseUrlFrom(prefs);
    await prefs.setString(kBaseUrlPrefKey, activeBaseUrl);

    try {
      final authService = AuthService(baseUrl: activeBaseUrl);
      final data = await authService.login(
        _phoneController.text.trim(),
        _passwordController.text,
      );

      final token = data['token'] as String;
      final user = data['user'] as Map<String, dynamic>;
      final role = user['role'] as String;
      final name = user['name'] as String;

      // Save credentials locally
      await prefs.setString('auth_token', token);
      await prefs.setString('user_role', role);
      await prefs.setString('user_name', name);
      await prefs.setString('user_phone', (user['phone'] as String?) ?? '');
      if (user['id'] != null) {
        await prefs.setInt('user_id', int.tryParse(user['id'].toString()) ?? 0);
      }
      final fetchedSchoolName = ((user['school_name'] as String?) ?? '').trim();
      String schoolName = fetchedSchoolName.isNotEmpty ? fetchedSchoolName.toUpperCase() : '';
      if (schoolName.isEmpty) {
        try {
          final profile = await authService.fetchProfile(token);
          final sName = ((profile['school_name'] as String?) ?? '').trim();
          if (sName.isNotEmpty) schoolName = sName.toUpperCase();
        } catch (_) {}
      }
      if (schoolName.isEmpty) {
        schoolName = 'SHIKSHA PILOT ACADEMY';
      }
      await prefs.setString('school_name', schoolName);
      final String userPhoto = (user['staff_photo_path'] as String?) ?? (user['photo_path'] as String?) ?? (user['photo'] as String?) ?? '';
      await prefs.setString('user_photo', userPhoto);
      final bool isPrincipal = user['is_principal'] == true ||
          user['is_principal'] == 1 ||
          user['is_principal'] == '1' ||
          (user['role']?.toString().toUpperCase() == 'PRINCIPAL');
      await prefs.setBool('is_principal', isPrincipal);

      final bool isFeeCollector = user['is_fee_collector'] == true ||
          user['is_fee_collector'] == 1 ||
          user['is_fee_collector'] == '1';
      await prefs.setBool('is_fee_collector', isFeeCollector);

      final workingBaseUrl = prefs.getString('base_url') ?? activeBaseUrl;
      final leaveService = LeaveService(baseUrl: workingBaseUrl, token: token);
      try {
        await PushNotificationService.init();
        await PushNotificationService.registerDevice();
      } catch (e) {
        debugPrint('registerDevice error on login: $e');
      }

      final inputPhone = _phoneController.text.trim();
      final String userPhone = (user['phone']?.toString().trim().isNotEmpty == true)
          ? user['phone'].toString().trim()
          : inputPhone;
      final loginUid = user['id'] is int ? user['id'] : int.tryParse(user['id']?.toString() ?? '') ?? 0;

      // Authoritative account-level App Lock flag returned by backend on every login
      final bool isAppLockEnabled = user['app_lock_enabled'] == true ||
          user['app_lock_enabled'] == 1 ||
          user['app_lock_enabled'] == '1';

      await AppLockHelper.syncFromServerState(
        prefs,
        userId: loginUid,
        phone: userPhone,
        enabled: isAppLockEnabled,
      );
      if (inputPhone.isNotEmpty && inputPhone != userPhone) {
        await AppLockHelper.syncFromServerState(
          prefs,
          userId: loginUid,
          phone: inputPhone,
          enabled: isAppLockEnabled,
        );
      }

      // Activate user's saved appearance theme after successful login
      final savedTheme = prefs.getString('theme_mode') ?? 'Light Mode';
      if (savedTheme == 'Dark Mode') {
        appThemeNotifier.value = ThemeMode.dark;
      } else if (savedTheme == 'System Defaults' || savedTheme == 'System') {
        appThemeNotifier.value = ThemeMode.system;
      } else {
        appThemeNotifier.value = ThemeMode.light;
      }

      void navigateAfterLogin(Widget targetScreen, {VoidCallback? onUnlocked}) {
        if (isAppLockEnabled) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (lockContext) => AppLockScreen(
                userName: name,
                userRole: role,
                schoolName: schoolName,
                baseUrl: workingBaseUrl,
                token: token,
                onUnlockSuccess: () {
                  Navigator.pushReplacement(
                    lockContext,
                    MaterialPageRoute(builder: (_) => targetScreen),
                  );
                  onUnlocked?.call();
                },
              ),
            ),
          );
        } else {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (_) => targetScreen),
          );
          onUnlocked?.call();
        }
      }

      final pendingPayload = prefs.getString('pending_notification_payload');
      if (pendingPayload != null && pendingPayload.isNotEmpty) {
        await prefs.remove('pending_notification_payload');
        try {
          final notif = json.decode(pendingPayload);
          final selId = StudentSessionHelper.readSavedStudentId(prefs);
          if (mounted) {
            navigateAfterLogin(
              HomeScreen(
                leaveService: leaveService,
                userRole: role,
                selectedStudentId: selId,
                schoolName: schoolName,
              ),
              onUnlocked: () {
                NotificationHelper.navigateToTarget(notif, activeBaseUrl, token, role, selId);
              },
            );
            return;
          }
        } catch (_) {}
      }

      if (role == 'STUDENT') {
        final students = await leaveService.getChildren();
        if (students.isEmpty) {
          throw Exception('No student profile found for this user.');
        }
        final firstStudent = Map<String, dynamic>.from(students[0] as Map);
        final studentId = StudentSessionHelper.parseId(firstStudent['id']);
        if (studentId == null) {
          throw Exception('Invalid student profile identifier.');
        }
        await StudentSessionHelper.persistSelectedChild(prefs, firstStudent);
        
        if (mounted) {
          navigateAfterLogin(
            HomeScreen(
              leaveService: leaveService,
              userRole: role,
              selectedStudentId: studentId,
              userName: (firstStudent['name'] ?? '').toString().trim(),
              userPhoto: (firstStudent['photo_path'] ?? firstStudent['photo'] ?? '').toString().trim(),
              schoolName: schoolName,
            ),
          );
        }
      } else if (role == 'PARENT') {
        final children = await leaveService.getChildren();
        if (children.isEmpty) {
          throw Exception('No students registered under this parent phone number.');
        }

        if (mounted) {
          if (children.length == 1) {
            // Only one child, login directly
            final onlyChild = Map<String, dynamic>.from(children[0] as Map);
            final childId = StudentSessionHelper.parseId(onlyChild['id']);
            if (childId == null) {
              throw Exception('Invalid student profile identifier.');
            }
            await StudentSessionHelper.persistSelectedChild(prefs, onlyChild);
            navigateAfterLogin(
              HomeScreen(
                leaveService: leaveService,
                userRole: role,
                selectedStudentId: childId,
                userName: (onlyChild['name'] ?? '').toString().trim(),
                userPhoto: (onlyChild['photo_path'] ?? onlyChild['photo'] ?? '').toString().trim(),
                schoolName: schoolName,
              ),
            );
          } else {
            // Multiple children: always pass through App Lock first if enabled, then child selector
            navigateAfterLogin(
              _SelectStudentProfileScreen(
                children: children,
                leaveService: leaveService,
                role: role,
                schoolName: schoolName,
              ),
            );
          }
        }
      } else {
        // Teacher / School Admin profile
        if (mounted) {
          navigateAfterLogin(
            HomeScreen(
              leaveService: leaveService,
              userRole: role,
              isPrincipal: isPrincipal,
              isFeeCollector: isFeeCollector,
              userPhoto: userPhoto,
              userName: name,
              schoolName: schoolName,
            ),
          );
        }
      }
    } catch (e) {
      final rawError = e.toString();
      final errorMsg = rawError.replaceAll('Exception:', '').trim();
      
      setState(() {
        _phoneValidationError = null;
        _passwordValidationError = null;
        _errorMessage = '';
      });

      if (rawError.contains('SocketException') || rawError.contains('ClientException') || rawError.contains('Connection refused') || rawError.contains('Failed host lookup')) {
        setState(() {
          _errorMessage = 'Cannot reach Shiksha Pilot. Check your internet connection and try again.';
        });
      } else if (errorMsg.toLowerCase().contains('mobile no not found')) {
        setState(() {
          _phoneValidationError = 'Mobile No not found';
        });
        _formKey.currentState!.validate();
      } else if (errorMsg.toLowerCase().contains('incorrect password')) {
        setState(() {
          _passwordValidationError = 'Incorrect password';
        });
        _formKey.currentState!.validate();
      } else if (errorMsg.toLowerCase().contains('inactive') || errorMsg.toLowerCase().contains('account marked as inactive')) {
        setState(() {
          _errorMessage = 'Your account marked as Inactive Please contact Academy management';
        });
      } else if (errorMsg.toLowerCase().contains('invalid credentials') ||
                 errorMsg.toLowerCase().contains('invalid credential')) {
        setState(() {
          _phoneValidationError = 'Invalid credential';
        });
        _formKey.currentState!.validate();
      } else if (errorMsg.toLowerCase().contains('timeout') || errorMsg.toLowerCase().contains('future not completed')) {
        setState(() {
          _errorMessage = 'Connection timeout. Please check your network or server connection.';
        });
      } else {
        setState(() {
          _errorMessage = errorMsg;
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final isKeyboardOpen = bottomInset > 0;

    final lightTheme = ThemeData(
      useMaterial3: true,
      fontFamily: 'Roboto',
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.surfaceCanvas,
      colorScheme: AppColors.lightColorScheme,
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 12,
        shadowColor: Colors.black45,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
    );

    return Theme(
      data: lightTheme,
      child: Scaffold(
        resizeToAvoidBottomInset: true,
        body: GestureDetector(
          onTap: () => FocusScope.of(context).unfocus(),
          behavior: HitTestBehavior.opaque,
          child: Container(
            width: double.infinity,
            height: double.infinity,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [Colors.indigo.shade900, Colors.indigo.shade700],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
          child: SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final availHeight = constraints.maxHeight;

                // When keyboard is open:
                // 1. Container (Card), inputs, and button KEEP THEIR EXACT SAME FULL SIZE (no shrinking!).
                // 2. The gap between keypad and card/button is reduced to half (~12dp).
                // 3. Header spacing and logo adapt smoothly so the card never has to shrink.
                final double logoHeight = isKeyboardOpen
                    ? ((availHeight - 340).clamp(40.0, 75.0))
                    : 96.0;
                final double logoToTitleSpace = isKeyboardOpen ? 8.0 : 16.0;
                final double titleFontSize = isKeyboardOpen ? 24.0 : 32.0;
                final double titleToCardSpace = isKeyboardOpen ? 14.0 : 34.0;
                final double bottomGap = isKeyboardOpen ? 12.0 : 12.0;

                return SizedBox(
                  width: constraints.maxWidth,
                  height: constraints.maxHeight,
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(28, 8, 28, bottomGap),
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: isKeyboardOpen ? Alignment.bottomCenter : Alignment.center,
                      child: SizedBox(
                        width: constraints.maxWidth - 56,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          mainAxisAlignment: isKeyboardOpen ? MainAxisAlignment.end : MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // The brand mark
                            Image.asset(
                              'assets/images/logo_mark.png',
                              height: logoHeight,
                              fit: BoxFit.contain,
                            ),
                            SizedBox(height: logoToTitleSpace),
                            Text(
                              'Shiksha Pilot',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: titleFontSize,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                                letterSpacing: 1,
                              ),
                            ),
                            SizedBox(height: titleToCardSpace),

                            // Form Card - keeps exact original size, padding, inputs and button
                            Card(
                              color: Colors.white,
                              elevation: 12,
                              shadowColor: Colors.black45,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Padding(
                                padding: const EdgeInsets.all(24),
                                child: Form(
                                  key: _formKey,
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.stretch,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      if (_errorMessage.isNotEmpty) ...[
                                        Container(
                                          padding: const EdgeInsets.all(12),
                                          decoration: BoxDecoration(
                                            color: Colors.red.shade50,
                                            border: Border.all(color: Colors.red.shade200),
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                          child: Row(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Icon(Icons.error_outline, color: Colors.red.shade800, size: 18),
                                              const SizedBox(width: 8),
                                              Expanded(
                                                child: Text(
                                                  _errorMessage,
                                                  style: TextStyle(
                                                    fontSize: 12,
                                                    color: Colors.red.shade900,
                                                    fontWeight: FontWeight.w600,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        const SizedBox(height: 16),
                                      ],

                                      // Phone Field - exact standard size
                                      TextFormField(
                                        controller: _phoneController,
                                        keyboardType: TextInputType.phone,
                                        onChanged: (val) {
                                          if (_phoneValidationError != null) {
                                            setState(() {
                                              _phoneValidationError = null;
                                            });
                                          }
                                        },
                                        decoration: InputDecoration(
                                          labelText: 'Mobile Number',
                                          prefixIcon: const Icon(Icons.phone_android),
                                          border: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                        ),
                                        validator: (value) {
                                          if (value == null || value.trim().isEmpty) {
                                            return 'Please enter mobile number';
                                          }
                                          if (!RegExp(r'^\d{10}$').hasMatch(value.trim())) {
                                            return 'Mobile number must be exactly 10 digits';
                                          }
                                          if (_phoneValidationError != null) {
                                            return _phoneValidationError;
                                          }
                                          return null;
                                        },
                                      ),
                                      const SizedBox(height: 18),

                                      // Password Field - exact standard size
                                      TextFormField(
                                        controller: _passwordController,
                                        obscureText: _obscurePassword,
                                        onChanged: (val) {
                                          if (_passwordValidationError != null) {
                                            setState(() {
                                              _passwordValidationError = null;
                                            });
                                          }
                                        },
                                        decoration: InputDecoration(
                                          labelText: 'Password',
                                          prefixIcon: const Icon(Icons.lock_outline),
                                          suffixIcon: IconButton(
                                            icon: Icon(
                                              _obscurePassword
                                                  ? Icons.visibility_off_outlined
                                                  : Icons.visibility_outlined,
                                            ),
                                            onPressed: () {
                                              setState(() {
                                                _obscurePassword = !_obscurePassword;
                                              });
                                            },
                                          ),
                                          border: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                        ),
                                        validator: (value) {
                                          if (value == null || value.isEmpty) {
                                            return 'Please enter password';
                                          }
                                          if (_passwordValidationError != null) {
                                            return _passwordValidationError;
                                          }
                                          return null;
                                        },
                                      ),
                                      const SizedBox(height: 16),

                                      // Login Button - exact standard size
                                      ElevatedButton(
                                        onPressed: _isLoading ? null : _handleLogin,
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: Colors.indigo.shade800,
                                          foregroundColor: Colors.white,
                                          padding: const EdgeInsets.symmetric(vertical: 16),
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                          elevation: 3,
                                        ),
                                        child: _isLoading
                                            ? const SizedBox(
                                                height: 20,
                                                width: 20,
                                                child: CircularProgressIndicator(
                                                  strokeWidth: 2.5,
                                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                                ),
                                              )
                                            : const Text(
                                                'SIGN IN',
                                                style: TextStyle(
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 15,
                                                  letterSpacing: 1,
                                                ),
                                              ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    ),
  );
}
}

class _SelectStudentProfileScreen extends StatelessWidget {
  final List<dynamic> children;
  final LeaveService leaveService;
  final String role;
  final String? schoolName;

  const _SelectStudentProfileScreen({
    required this.children,
    required this.leaveService,
    required this.role,
    this.schoolName,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Select Student Profile',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white),
        ),
        backgroundColor: isDark ? const Color(0xFF1E293B) : const Color(0xFF2196F3),
        automaticallyImplyLeading: false,
        elevation: 0,
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: children.length,
        itemBuilder: (BuildContext ctx, int index) {
          final student = children[index];
          final studentName = (student['name'] ?? '').toString();
          final className = (student['class_name'] ?? '').toString();
          final sectionName = (student['section_name'] ?? '').toString();
          final rollNo = (student['roll_no'] ?? '').toString();

          return Card(
            margin: const EdgeInsets.symmetric(vertical: 6),
            elevation: 1,
            color: isDark ? const Color(0xFF1E293B) : Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
            ),
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              leading: CircleAvatar(
                backgroundColor: isDark ? const Color(0xFF1E3A8A).withValues(alpha: 0.35) : const Color(0xFFE3F2FD),
                child: const Icon(Icons.person, color: Color(0xFF2196F3)),
              ),
              title: Text(
                studentName,
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              subtitle: Text(
                'Class $className $sectionName | Roll: $rollNo',
                style: TextStyle(color: isDark ? const Color(0xFF94A3B8) : Colors.grey.shade600),
              ),
              trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 16, color: Color(0xFF2196F3)),
              onTap: () async {
                final prefs = await SharedPreferences.getInstance();
                final studentMap = Map<String, dynamic>.from(student as Map);
                final childId = StudentSessionHelper.parseId(studentMap['id']);
                if (childId == null) return;
                await StudentSessionHelper.persistSelectedChild(prefs, studentMap);
                final resolvedSchool = (schoolName != null && schoolName!.isNotEmpty)
                    ? schoolName!
                    : (prefs.getString('school_name') ?? 'SHIKSHA PILOT ACADEMY').toUpperCase();
                if (ctx.mounted) {
                  Navigator.pushReplacement(
                    ctx,
                    MaterialPageRoute(
                      builder: (_) => HomeScreen(
                        leaveService: leaveService,
                        userRole: role,
                        selectedStudentId: childId,
                        userName: (studentMap['name'] ?? '').toString().trim(),
                        userPhoto: (studentMap['photo_path'] ?? studentMap['photo'] ?? '').toString().trim(),
                        schoolName: resolvedSchool,
                      ),
                    ),
                  );
                }
              },
            ),
          );
        },
      ),
    );
  }
}
