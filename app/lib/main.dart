import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:workmanager/workmanager.dart';
import 'package:http/http.dart' as http;
import 'screens/leave_list_screen.dart';
import 'screens/home_screen.dart';
import 'services/leave_service.dart';
import 'services/auth_service.dart';
import 'services/notification_helper.dart';

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
          final baseUrl = prefs.getString('base_url') ?? 'http://10.55.253.71:8000';
          if (token.isEmpty || userRole.isEmpty) return true;

          final isSchoolStaff = userRole.toUpperCase() == 'TEACHER' || 
                                userRole.toUpperCase() == 'SCHOOL_ADMIN' || 
                                userRole.toUpperCase() == 'PRINCIPAL';

          final path = isSchoolStaff 
              ? '/api/school/notifications' 
              : '/api/student/notifications';
              
          final studentId = prefs.getInt('selected_student_id');

          final uri = Uri.parse('$baseUrl$path');
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
              final latestNotif = data.first;
              final int latestId = latestNotif['id'] is int 
                  ? latestNotif['id'] 
                  : int.parse(latestNotif['id'].toString());
              final isUnread = latestNotif['is_read'] == 0 || latestNotif['is_read'] == false || latestNotif['is_read'] == '0';

              final lastNotifiedId = prefs.getInt('last_notified_id_$userRole') ?? 0;
              if (isUnread && latestId > lastNotifiedId) {
                await prefs.setInt('last_notified_id_$userRole', latestId);
                await NotificationHelper.init();
                await NotificationHelper.showNotification(latestNotif);
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

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await NotificationHelper.init();
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
    return MaterialApp(
      navigatorKey: navigatorKey,
      title: 'Shiksha Pilot School Hub',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.indigo,
        useMaterial3: true,
        fontFamily: 'Roboto',
        scaffoldBackgroundColor: Colors.grey[50],
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.indigo,
          primary: Colors.indigo,
          secondary: Colors.deepPurple,
        ),
      ),
      home: const SplashScreen(),
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

  final String _baseUrl = 'http://10.55.253.71:8000';

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _animationController,
      curve: const Interval(0.0, 0.7, curve: Curves.easeIn),
    );
    _scaleAnimation = CurvedAnimation(
      parent: _animationController,
      curve: const Interval(0.1, 0.9, curve: Curves.easeOutBack),
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

    if (token != null && role != null) {
      final leaveService = LeaveService(baseUrl: _baseUrl, token: token);
      
      final roleUpper = role.toUpperCase();
      if (roleUpper == 'PARENT' || roleUpper == 'STUDENT') {
        final savedStudentId = prefs.getInt('selected_student_id');
        if (savedStudentId != null) {
          if (mounted) {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(
                builder: (context) => HomeScreen(
                  leaveService: leaveService,
                  userRole: role,
                  selectedStudentId: savedStudentId,
                ),
              ),
            );
            return;
          }
        } else {
          // Fallback to query children if not saved
          try {
            final children = await leaveService.getChildren();
            if (children.isNotEmpty) {
              final defaultStudentId = children[0]['id'] as int;
              await prefs.setInt('selected_student_id', defaultStudentId);
              if (mounted) {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(
                    builder: (context) => HomeScreen(
                      leaveService: leaveService,
                      userRole: role,
                      selectedStudentId: defaultStudentId,
                    ),
                  ),
                );
                return;
              }
            }
          } catch (e) {
            // Ignore offline fallback failures, let it fall through to login
          }
        }
      } else {
        // Teacher / School Admin
        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (context) => HomeScreen(
                leaveService: leaveService,
                userRole: role,
              ),
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
                  Container(
                    width: 120,
                    height: 120,
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black26,
                          blurRadius: 20,
                          offset: Offset(0, 10),
                        )
                      ],
                    ),
                    child: ClipOval(
                      child: Image.asset(
                        'assets/images/logo.png',
                        width: 120,
                        height: 120,
                        fit: BoxFit.cover,
                      ),
                    ),
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
  const LoginScreen({Key? key}) : super(key: key);

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

  final String _baseUrl = 'http://10.55.253.71:8000';

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

    try {
      final authService = AuthService(baseUrl: _baseUrl);
      final data = await authService.login(
        _phoneController.text.trim(),
        _passwordController.text,
      );

      final token = data['token'] as String;
      final user = data['user'] as Map<String, dynamic>;
      final role = user['role'] as String;
      final name = user['name'] as String;

      // Save credentials locally
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('auth_token', token);
      await prefs.setString('user_role', role);
      await prefs.setString('user_name', name);
      await prefs.setString('user_phone', (user['phone'] as String?) ?? '');
      await prefs.setString('school_name', ((user['school_name'] as String?) ?? 'Shiksha Pilot Academy').toUpperCase());
      await prefs.setString('user_photo', (user['staff_photo_path'] as String?) ?? '');

      final leaveService = LeaveService(baseUrl: _baseUrl, token: token);

      if (role == 'STUDENT') {
        final students = await leaveService.getChildren();
        if (students.isEmpty) {
          throw Exception('No student profile found for this user.');
        }
        final studentId = students[0]['id'] as int;
        await prefs.setInt('selected_student_id', studentId);
        
        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (context) => HomeScreen(
                leaveService: leaveService,
                userRole: role,
                selectedStudentId: studentId,
              ),
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
            final childId = children[0]['id'] as int;
            await prefs.setInt('selected_student_id', childId);
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(
                builder: (context) => HomeScreen(
                  leaveService: leaveService,
                  userRole: role,
                  selectedStudentId: childId,
                ),
              ),
            );
          } else {
            // Multiple children, show selector dialog
            _showChildrenSelector(children, leaveService, role);
          }
        }
      } else {
        // Teacher / School Admin profile
        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (context) => HomeScreen(
                leaveService: leaveService,
                userRole: role,
              ),
            ),
          );
        }
      }
    } catch (e) {
      final errorMsg = e.toString().replaceAll('Exception:', '').trim();
      
      setState(() {
        _phoneValidationError = null;
        _passwordValidationError = null;
        _errorMessage = '';
      });

      if (errorMsg.toLowerCase().contains('mobile no not found')) {
        setState(() {
          _phoneValidationError = 'Mobile No not found';
        });
        _formKey.currentState!.validate();
      } else if (errorMsg.toLowerCase().contains('incorrect password')) {
        setState(() {
          _passwordValidationError = 'Incorrect password';
        });
        _formKey.currentState!.validate();
      } else if (errorMsg.toLowerCase().contains('validation failed') ||
                 errorMsg.toLowerCase().contains('invalid credentials') ||
                 errorMsg.toLowerCase().contains('invalid credential')) {
        setState(() {
          _phoneValidationError = 'Invalid credential';
        });
        _formKey.currentState!.validate();
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

  void _showChildrenSelector(List<dynamic> children, LeaveService leaveService, String role) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text(
            'Select Student Profile',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          content: SizedBox(
            width: double.maxFinite,
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: children.length,
              itemBuilder: (BuildContext context, int index) {
                final student = children[index];
                final studentName = student['name'] ?? '';
                final className = student['class_name'] ?? '';
                final sectionName = student['section_name'] ?? '';
                final rollNo = student['roll_no'] ?? '';
                
                return Card(
                  margin: const EdgeInsets.symmetric(vertical: 6),
                  elevation: 2,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: Colors.indigo.shade50,
                      child: Icon(Icons.person, color: Colors.indigo.shade800),
                    ),
                    title: Text(
                      studentName,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text('Class $className $sectionName | Roll: $rollNo'),
                    onTap: () async {
                      final prefs = await SharedPreferences.getInstance();
                      final childId = student['id'] as int;
                      await prefs.setInt('selected_student_id', childId);
                      if (context.mounted) {
                        Navigator.pop(context); // Close dialog
                        Navigator.pushReplacement(
                          context,
                          MaterialPageRoute(
                            builder: (ctx) => HomeScreen(
                              leaveService: leaveService,
                              userRole: role,
                              selectedStudentId: childId,
                            ),
                          ),
                        );
                      }
                    },
                  ),
                );
              },
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SingleChildScrollView(
        child: Container(
          height: MediaQuery.of(context).size.height,
          padding: const EdgeInsets.symmetric(horizontal: 28),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [Colors.indigo.shade900, Colors.indigo.shade700],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Logo
              const Icon(
                Icons.school_rounded,
                size: 80,
                color: Colors.white,
              ),
              const SizedBox(height: 16),
              const Text(
                'Shiksha Pilot',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Sign in to access leaves hub',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.white.withOpacity(0.7),
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 36),

              // Form Card
              Card(
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

                        // Phone Field
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

                        // Password Field
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
                        const SizedBox(height: 24),

                        // Login Button
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
    );
  }
}
