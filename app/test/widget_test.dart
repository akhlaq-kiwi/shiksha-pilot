import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_hub/main.dart';

void main() {
  testWidgets('App selector profile smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const MyApp());

    // Verify that the title and buttons are rendered.
    expect(find.text('Shiksha Pilot'), findsOneWidget);
    expect(find.text('Select Testing Profile:'), findsOneWidget);
    expect(find.text('Test as Teacher Profile'), findsOneWidget);
    expect(find.text('Test as Parent Profile (Student ID: 1)'), findsOneWidget);
  });
}
