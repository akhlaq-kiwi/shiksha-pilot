import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:school_hub/services/student_session_helper.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final siblingChildren = <Map<String, dynamic>>[
    {
      'id': 7001,
      'name': 'Gaurav Chandra Gupta',
      'admission_no': 'ADM-101',
      'photo_path': '/uploads/gaurav.jpg',
      'is_current_academic_year': 1,
      'academic_year_status': 'ACTIVE',
    },
    {
      'id': 7002,
      'name': 'Sai Mohan Tiwari',
      'admission_no': 'ADM-102',
      'photo_path': '/uploads/sai.jpg',
      'is_current_academic_year': 1,
      'academic_year_status': 'ACTIVE',
    },
    {
      'id': 7003,
      'name': 'Diya Singh Verma',
      'admission_no': 'ADM-103',
      'photo_path': '',
      'is_current_academic_year': 1,
      'academic_year_status': 'ACTIVE',
    },
  ];

  test('Retains switched second sibling across simulated kill and relaunch', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();

    // User switches profile to student 2 before killing the app.
    await StudentSessionHelper.persistSelectedChild(prefs, siblingChildren[1]);

    // Simulated cold relaunch: read persisted selection and resolve against API list.
    final relaunchPrefs = await SharedPreferences.getInstance();
    final savedId = StudentSessionHelper.readSavedStudentId(relaunchPrefs);
    final savedAdm = relaunchPrefs.getString(
      StudentSessionHelper.prefSelectedStudentAdmissionNo,
    );
    final savedName = relaunchPrefs.getString(
      StudentSessionHelper.prefSelectedStudentName,
    );

    final resolved = StudentSessionHelper.resolveActiveChild(
      siblingChildren,
      preferredStudentId: savedId,
      savedAdmissionNo: savedAdm,
      savedName: savedName,
    );

    expect(resolved, isNotNull);
    expect(StudentSessionHelper.parseId(resolved!['id']), equals(7002));
    expect(resolved['name'], equals('Sai Mohan Tiwari'));
    expect(relaunchPrefs.getString('user_name'), equals('Sai Mohan Tiwari'));
    expect(relaunchPrefs.getString('user_photo'), equals('/uploads/sai.jpg'));
  });

  test('Keeps switched student even when is_current_academic_year is 0 or null', () async {
    SharedPreferences.setMockInitialValues({
      'selected_student_id': 7002,
      'selected_student_name': 'Sai Mohan Tiwari',
      'selected_student_admission_no': 'ADM-102',
    });
    final prefs = await SharedPreferences.getInstance();

    final nonCurrentChildren = [
      {
        'id': 7001,
        'name': 'Gaurav Chandra Gupta',
        'admission_no': 'ADM-101',
        'is_current_academic_year': 0,
        'academic_year_status': 'ACTIVE',
      },
      {
        'id': 7002,
        'name': 'Sai Mohan Tiwari',
        'admission_no': 'ADM-102',
        'is_current_academic_year': 0,
        'academic_year_status': null,
      },
      {
        'id': 7003,
        'name': 'Diya Singh Verma',
        'admission_no': 'ADM-103',
        'is_current_academic_year': null,
      },
    ];

    final resolved = StudentSessionHelper.resolveActiveChild(
      nonCurrentChildren,
      preferredStudentId: StudentSessionHelper.readSavedStudentId(prefs),
      savedAdmissionNo: prefs.getString(
        StudentSessionHelper.prefSelectedStudentAdmissionNo,
      ),
      savedName: prefs.getString(
        StudentSessionHelper.prefSelectedStudentName,
      ),
    );

    expect(StudentSessionHelper.parseId(resolved?['id']), equals(7002));
    expect(resolved?['name'], equals('Sai Mohan Tiwari'));
  });

  test('Matches stringified backend IDs without falling back to top student', () {
    final stringIdChildren = siblingChildren
        .map((c) => {...c, 'id': c['id'].toString()})
        .toList();

    final found = StudentSessionHelper.findChildById(stringIdChildren, 7002);
    expect(found, isNotNull);
    expect(found!['name'], equals('Sai Mohan Tiwari'));

    final resolved = StudentSessionHelper.resolveActiveChild(
      stringIdChildren,
      preferredStudentId: 7002,
    );
    expect(StudentSessionHelper.parseId(resolved?['id']), equals(7002));
  });

  test('Remaps promoted student ID via admission number or unique name', () {
    final promotedChildren = [
      {
        'id': 8001,
        'name': 'Gaurav Chandra Gupta',
        'admission_no': 'ADM-101',
        'is_current_academic_year': 1,
      },
      {
        'id': 8002,
        'name': 'Sai Mohan Tiwari',
        'admission_no': 'ADM-102',
        'is_current_academic_year': 1,
      },
    ];

    final byAdmission = StudentSessionHelper.resolveActiveChild(
      promotedChildren,
      preferredStudentId: 7002,
      savedAdmissionNo: 'ADM-102',
      savedName: 'Sai Mohan Tiwari',
    );
    expect(StudentSessionHelper.parseId(byAdmission?['id']), equals(8002));

    final noAdmChildren = [
      {'id': 9001, 'name': 'Gaurav Chandra Gupta', 'admission_no': null},
      {'id': 9002, 'name': 'Sai Mohan Tiwari', 'admission_no': null},
    ];
    final byUniqueName = StudentSessionHelper.resolveActiveChild(
      noAdmChildren,
      preferredStudentId: 7002,
      savedAdmissionNo: '',
      savedName: 'Sai Mohan Tiwari',
    );
    expect(StudentSessionHelper.parseId(byUniqueName?['id']), equals(9002));
  });

  test('Clears previous sibling cached photo when newly selected student has no photo', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();

    await StudentSessionHelper.persistSelectedChild(prefs, siblingChildren[1]);
    expect(prefs.getString('user_photo'), equals('/uploads/sai.jpg'));

    await StudentSessionHelper.persistSelectedChild(prefs, siblingChildren[2]);
    expect(prefs.getInt('selected_student_id'), equals(7003));
    expect(prefs.getString('user_name'), equals('Diya Singh Verma'));
    expect(prefs.getString('user_photo'), equals(''));
  });
}

