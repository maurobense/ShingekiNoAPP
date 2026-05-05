import 'package:flutter_test/flutter_test.dart';
import 'package:kordena_mobile/main.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('shows the login screen when no session is stored', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const KordenaMobileApp());
    await tester.pumpAndSettle();

    expect(find.text('Kordena Mobile'), findsOneWidget);
    expect(find.text('Ingresar'), findsOneWidget);
  });
}
