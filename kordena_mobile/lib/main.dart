import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:signalr_netcore/signalr_client.dart' hide ConnectionState;

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const KordenaMobileApp());
}

class KordenaMobileApp extends StatefulWidget {
  const KordenaMobileApp({super.key});

  @override
  State<KordenaMobileApp> createState() => _KordenaMobileAppState();
}

class _KordenaMobileAppState extends State<KordenaMobileApp> {
  Session? _session;
  String _apiBaseUrl = ApiClient.productionApiBaseUrl;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  Future<void> _restore() async {
    final prefs = await SharedPreferences.getInstance();
    final rawSession = prefs.getString('kordena.session');
    final baseUrl = prefs.getString('kordena.apiBaseUrl');
    if (mounted) {
      setState(() {
        _apiBaseUrl = baseUrl ?? ApiClient.productionApiBaseUrl;
        _session = rawSession == null
            ? null
            : Session.fromJson(jsonDecode(rawSession));
        _loading = false;
      });
    }
  }

  Future<void> _saveSession(Session session, String apiBaseUrl) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('kordena.session', jsonEncode(session.toJson()));
    await prefs.setString('kordena.apiBaseUrl', apiBaseUrl);
    if (mounted) {
      setState(() {
        _session = session;
        _apiBaseUrl = apiBaseUrl;
      });
    }
  }

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('kordena.session');
    if (mounted) setState(() => _session = null);
  }

  @override
  Widget build(BuildContext context) {
    final theme = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: KordenaColors.background,
      colorScheme: const ColorScheme.dark(
        primary: KordenaColors.primary,
        secondary: KordenaColors.accent,
        surface: KordenaColors.surface,
        error: KordenaColors.error,
      ),
      fontFamily: 'Roboto',
      cardTheme: CardThemeData(
        color: KordenaColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(28),
          side: const BorderSide(color: KordenaColors.stroke),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: KordenaColors.surfaceSoft,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 16,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: KordenaColors.stroke),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: KordenaColors.stroke),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(
            color: KordenaColors.primary,
            width: 1.4,
          ),
        ),
      ),
    );

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Kordena Mobile',
      theme: theme,
      home: _loading
          ? const BootScreen()
          : _session == null
          ? LoginScreen(
              initialApiBaseUrl: _apiBaseUrl,
              onLoggedIn: _saveSession,
            )
          : HomeShell(
              session: _session!,
              api: ApiClient(_apiBaseUrl, token: _session!.token),
              onLogout: _logout,
            ),
    );
  }
}

class KordenaColors {
  static const background = Color(0xFF09111F);
  static const surface = Color(0xFF111B2E);
  static const surfaceSoft = Color(0xFF17243A);
  static const stroke = Color(0xFF263550);
  static const primary = Color(0xFF72D4FF);
  static const accent = Color(0xFF7B8CFF);
  static const success = Color(0xFF3DE399);
  static const warning = Color(0xFFFFC857);
  static const error = Color(0xFFFF6B7A);
  static const muted = Color(0xFF96A3B8);
}

class ApiClient {
  static const productionApiBaseUrl =
      'https://www.shingekinoappi.somee.com/api';
  static const emulatorApiBaseUrl = 'http://10.0.2.2:5019/api';

  ApiClient(String baseUrl, {this.token})
    : baseUrl = baseUrl.trim().replaceAll(RegExp(r'/+$'), '');

  final String baseUrl;
  final String? token;

  String get hubUrl => baseUrl.replaceFirst(RegExp(r'/api$'), '/deliveryHub');

  Uri uri(String path) {
    final clean = path.startsWith('/') ? path.substring(1) : path;
    return Uri.parse('$baseUrl/$clean');
  }

  Map<String, String> get _headers => {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    if (token != null && token!.isNotEmpty) 'Authorization': 'Bearer $token',
  };

  Future<Session> login(String username, String password) async {
    final response = await http
        .post(
          uri('/User/login'),
          headers: _headers,
          body: jsonEncode({'username': username, 'password': password}),
        )
        .timeout(const Duration(seconds: 25));

    final json = _decode(response);
    return Session.fromJson(json);
  }

  Future<List<DeliveryOrder>> fetchDeliveryBoard() async {
    final statuses = ['Ready', 'OnTheWay'];
    final orders = <DeliveryOrder>[];
    for (final status in statuses) {
      final response = await http
          .get(uri('/Orders/status/$status'), headers: _headers)
          .timeout(const Duration(seconds: 25));
      final json = _decode(response);
      if (json is List) {
        orders.addAll(json.map((item) => DeliveryOrder.fromJson(asMap(item))));
      }
    }
    orders.sort((a, b) {
      if (a.status == b.status) return a.orderDate.compareTo(b.orderDate);
      return a.status == 'OnTheWay' ? -1 : 1;
    });
    return orders;
  }

  Future<TrackedOrder> fetchTrackedOrder(String trackingNumber) async {
    final response = await http
        .get(uri('/Orders/track/$trackingNumber'), headers: _headers)
        .timeout(const Duration(seconds: 25));
    return TrackedOrder.fromJson(_decode(response));
  }

  Future<void> updateOrderStatus(int orderId, String status, int userId) async {
    final response = await http
        .put(
          uri('/Orders/$orderId/status'),
          headers: _headers,
          body: jsonEncode({'newStatus': status, 'userId': userId}),
        )
        .timeout(const Duration(seconds: 25));
    _decode(response, allowEmpty: true);
  }

  Future<void> updateDriverLocation(
    String trackingNumber,
    Position position,
  ) async {
    final response = await http
        .post(
          uri('/Orders/track/$trackingNumber/driver-location'),
          headers: _headers,
          body: jsonEncode({
            'latitude': position.latitude,
            'longitude': position.longitude,
            'accuracyMeters': position.accuracy,
            'speedMetersPerSecond': position.speed,
            'headingDegrees': position.heading,
          }),
        )
        .timeout(const Duration(seconds: 20));
    _decode(response, allowEmpty: true);
  }

  Future<void> updateDriverLocationBatch(
    List<String> trackingNumbers,
    Position position,
  ) async {
    if (trackingNumbers.length == 1) {
      return updateDriverLocation(trackingNumbers.first, position);
    }

    final response = await http
        .post(
          uri('/Orders/track/driver-location/batch'),
          headers: _headers,
          body: jsonEncode({
            'trackingNumbers': trackingNumbers,
            'latitude': position.latitude,
            'longitude': position.longitude,
            'accuracyMeters': position.accuracy,
            'speedMetersPerSecond': position.speed,
            'headingDegrees': position.heading,
          }),
        )
        .timeout(const Duration(seconds: 20));
    _decode(response, allowEmpty: true);
  }

  dynamic _decode(http.Response response, {bool allowEmpty = false}) {
    final body = utf8.decode(response.bodyBytes);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(_extractError(body, response.statusCode));
    }
    if (body.trim().isEmpty) return allowEmpty ? null : <String, dynamic>{};
    try {
      return jsonDecode(body);
    } catch (_) {
      if (allowEmpty) return null;
      throw ApiException('Respuesta invalida del servidor.');
    }
  }

  String _extractError(String body, int statusCode) {
    if (body.trim().isEmpty) return 'Error HTTP $statusCode';
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map && decoded['title'] != null) {
        return decoded['title'].toString();
      }
      if (decoded is Map && decoded['message'] != null) {
        return decoded['message'].toString();
      }
      if (decoded is String) return decoded;
    } catch (_) {
      return body;
    }
    return body;
  }
}

class ApiException implements Exception {
  ApiException(this.message);
  final String message;

  @override
  String toString() => message;
}

class RealtimeTrackingClient {
  RealtimeTrackingClient(this.hubUrl, {this.token});

  final String hubUrl;
  final String? token;
  HubConnection? _connection;

  bool get isConnected => _connection?.state == HubConnectionState.Connected;

  Future<void> connect() async {
    if (isConnected) return;

    final options = token == null || token!.isEmpty
        ? null
        : HttpConnectionOptions(accessTokenFactory: () async => token!);

    _connection ??= HubConnectionBuilder()
        .withUrl(hubUrl, options: options)
        .withAutomaticReconnect(retryDelays: [2000, 5000, 10000, 20000])
        .build();

    if (_connection!.state != HubConnectionState.Connected) {
      await _connection!.start();
    }
  }

  void onDriverLocation(ValueChanged<DriverLocation> callback) {
    _connection?.on('ReceiveDriverLocation', (args) {
      if (args == null || args.length < 2) return;
      final lat = toDouble(args[0]);
      final lng = toDouble(args[1]);
      if (lat == null || lng == null) return;
      callback(
        DriverLocation(
          latitude: lat,
          longitude: lng,
          locationAtUtc: DateTime.now().toUtc(),
        ),
      );
    });

    _connection?.on('ReceiveDriverLocationDetails', (args) {
      if (args == null || args.isEmpty) return;
      final data = asMap(args.first);
      final lat = toDouble(data['latitude']);
      final lng = toDouble(data['longitude']);
      if (lat == null || lng == null) return;
      callback(
        DriverLocation(
          latitude: lat,
          longitude: lng,
          accuracyMeters: toDouble(data['accuracyMeters']),
          speedMetersPerSecond: toDouble(data['speedMetersPerSecond']),
          headingDegrees: toDouble(data['headingDegrees']),
          locationAtUtc: parseDate(data['locationAtUtc']),
        ),
      );
    });
  }

  void onStatusUpdate(ValueChanged<String> callback) {
    _connection?.on('ReceiveStatusUpdate', (args) {
      if (args == null || args.isEmpty) return;
      callback(args.last.toString());
    });
  }

  Future<void> joinTracking(String trackingNumber) async {
    await connect();
    await _connection?.invoke(
      'JoinTrackingGroup',
      args: <Object>[trackingNumber],
    );
  }

  Future<void> sendDriverLocation(
    String trackingNumber,
    Position position,
  ) async {
    await connect();
    await _connection?.invoke(
      'SendDriverLocation',
      args: <Object>[trackingNumber, position.latitude, position.longitude],
    );
  }

  Future<void> sendDriverLocationToMany(
    List<String> trackingNumbers,
    Position position,
  ) async {
    if (trackingNumbers.length == 1) {
      return sendDriverLocation(trackingNumbers.first, position);
    }

    await connect();
    await _connection?.invoke(
      'SendDriverLocationToMany',
      args: <Object>[trackingNumbers, position.latitude, position.longitude],
    );
  }

  Future<void> stop() async {
    await _connection?.stop();
    _connection = null;
  }
}

class Session {
  const Session({
    required this.id,
    required this.username,
    required this.token,
    required this.role,
    required this.branchId,
    required this.tenantSlug,
    required this.publicOrderingUrl,
  });

  final int id;
  final String username;
  final String token;
  final String role;
  final int branchId;
  final String tenantSlug;
  final String publicOrderingUrl;

  bool get canDeliver =>
      role == 'Delivery' || role == 'Admin' || role == 'BranchManager';

  factory Session.fromJson(Map<String, dynamic> json) {
    return Session(
      id: toInt(json['id']) ?? 0,
      username: json['username']?.toString() ?? '',
      token: json['token']?.toString() ?? '',
      role: json['role']?.toString() ?? '',
      branchId: toInt(json['branchId']) ?? 0,
      tenantSlug: json['tenantSlug']?.toString() ?? '',
      publicOrderingUrl: json['publicOrderingUrl']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'username': username,
    'token': token,
    'role': role,
    'branchId': branchId,
    'tenantSlug': tenantSlug,
    'publicOrderingUrl': publicOrderingUrl,
  };
}

class DeliveryOrder {
  DeliveryOrder({
    required this.id,
    required this.orderDate,
    required this.totalAmount,
    required this.trackingNumber,
    required this.clientName,
    required this.phone,
    required this.itemsCount,
    required this.status,
    required this.paymentMethod,
    required this.nextStatus,
  });

  final int id;
  final DateTime orderDate;
  final double totalAmount;
  final String trackingNumber;
  final String clientName;
  final String phone;
  final int itemsCount;
  final String status;
  final String paymentMethod;
  final String nextStatus;

  factory DeliveryOrder.fromJson(Map<String, dynamic> json) {
    return DeliveryOrder(
      id: toInt(json['id']) ?? 0,
      orderDate: parseDate(json['orderDate']) ?? DateTime.now(),
      totalAmount: toDouble(json['totalAmount']) ?? 0,
      trackingNumber: json['trackingNumber']?.toString() ?? '',
      clientName: json['clientName']?.toString() ?? 'Cliente',
      phone: json['phone']?.toString() ?? '',
      itemsCount: toInt(json['itemsCount']) ?? 0,
      status:
          json['currentStatus']?.toString() ?? json['status']?.toString() ?? '',
      paymentMethod: json['paymentMethod']?.toString() ?? '',
      nextStatus: json['nextStatus']?.toString() ?? '',
    );
  }
}

class TrackedOrder {
  TrackedOrder({
    required this.id,
    required this.orderDate,
    required this.status,
    required this.clientName,
    required this.clientPhone,
    required this.paymentMethod,
    required this.totalAmount,
    required this.trackingNumber,
    required this.branchName,
    required this.publicOrderingUrl,
    required this.items,
    this.driverLocation,
  });

  final int id;
  final DateTime orderDate;
  final String status;
  final String clientName;
  final String clientPhone;
  final String paymentMethod;
  final double totalAmount;
  final String trackingNumber;
  final String branchName;
  final String publicOrderingUrl;
  final List<OrderLine> items;
  final DriverLocation? driverLocation;

  TrackedOrder copyWith({String? status, DriverLocation? driverLocation}) {
    return TrackedOrder(
      id: id,
      orderDate: orderDate,
      status: status ?? this.status,
      clientName: clientName,
      clientPhone: clientPhone,
      paymentMethod: paymentMethod,
      totalAmount: totalAmount,
      trackingNumber: trackingNumber,
      branchName: branchName,
      publicOrderingUrl: publicOrderingUrl,
      items: items,
      driverLocation: driverLocation ?? this.driverLocation,
    );
  }

  factory TrackedOrder.fromJson(Map<String, dynamic> json) {
    DriverLocation? location;
    final lat = toDouble(json['driverLatitude']);
    final lng = toDouble(json['driverLongitude']);
    if (lat != null && lng != null) {
      location = DriverLocation(
        latitude: lat,
        longitude: lng,
        accuracyMeters: toDouble(json['driverAccuracyMeters']),
        speedMetersPerSecond: toDouble(json['driverSpeedMetersPerSecond']),
        headingDegrees: toDouble(json['driverHeadingDegrees']),
        locationAtUtc: parseDate(json['driverLocationAtUtc']),
      );
    }

    final items = (json['items'] is List ? json['items'] as List : const [])
        .map((item) => OrderLine.fromJson(asMap(item)))
        .toList();

    return TrackedOrder(
      id: toInt(json['id']) ?? 0,
      orderDate: parseDate(json['orderDate']) ?? DateTime.now(),
      status: json['status']?.toString() ?? '',
      clientName: json['clientName']?.toString() ?? 'Cliente',
      clientPhone: json['clientPhone']?.toString() ?? '',
      paymentMethod: json['paymentMethod']?.toString() ?? '',
      totalAmount: toDouble(json['totalAmount']) ?? 0,
      trackingNumber: json['trackingNumber']?.toString() ?? '',
      branchName: json['branchName']?.toString() ?? 'Local',
      publicOrderingUrl: json['publicOrderingUrl']?.toString() ?? '',
      items: items,
      driverLocation: location,
    );
  }
}

class OrderLine {
  OrderLine({
    required this.productName,
    required this.quantity,
    required this.subtotal,
  });

  final String productName;
  final int quantity;
  final double subtotal;

  factory OrderLine.fromJson(Map<String, dynamic> json) {
    return OrderLine(
      productName: json['productName']?.toString() ?? 'Item',
      quantity: toInt(json['quantity']) ?? 0,
      subtotal: toDouble(json['subtotal']) ?? 0,
    );
  }
}

class DriverLocation {
  DriverLocation({
    required this.latitude,
    required this.longitude,
    this.accuracyMeters,
    this.speedMetersPerSecond,
    this.headingDegrees,
    this.locationAtUtc,
  });

  final double latitude;
  final double longitude;
  final double? accuracyMeters;
  final double? speedMetersPerSecond;
  final double? headingDegrees;
  final DateTime? locationAtUtc;

  LatLng get point => LatLng(latitude, longitude);
}

class BootScreen extends StatelessWidget {
  const BootScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            BrandMark(size: 68),
            SizedBox(height: 22),
            CircularProgressIndicator(strokeWidth: 3),
          ],
        ),
      ),
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.initialApiBaseUrl,
    required this.onLoggedIn,
  });

  final String initialApiBaseUrl;
  final Future<void> Function(Session session, String apiBaseUrl) onLoggedIn;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _username = TextEditingController();
  final _password = TextEditingController();
  final _customBaseUrl = TextEditingController();
  bool _loading = false;
  String _serverMode = 'prod';

  @override
  void initState() {
    super.initState();
    _username.text = 'admin';
    _password.text = 'admin123';
    if (widget.initialApiBaseUrl == ApiClient.emulatorApiBaseUrl) {
      _serverMode = 'emulator';
    } else if (widget.initialApiBaseUrl != ApiClient.productionApiBaseUrl) {
      _serverMode = 'custom';
      _customBaseUrl.text = widget.initialApiBaseUrl;
    }
  }

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    _customBaseUrl.dispose();
    super.dispose();
  }

  String get _apiBaseUrl {
    if (_serverMode == 'emulator') return ApiClient.emulatorApiBaseUrl;
    if (_serverMode == 'custom') return _customBaseUrl.text.trim();
    return ApiClient.productionApiBaseUrl;
  }

  Future<void> _login() async {
    FocusScope.of(context).unfocus();
    if (_apiBaseUrl.isEmpty) {
      showKordenaSnack(context, 'Configura la URL de API.');
      return;
    }
    setState(() => _loading = true);
    try {
      final api = ApiClient(_apiBaseUrl);
      final session = await api.login(_username.text.trim(), _password.text);
      await widget.onLoggedIn(session, _apiBaseUrl);
    } catch (error) {
      if (mounted) showKordenaSnack(context, error.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openTracking() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PublicTrackingScreen(api: ApiClient(_apiBaseUrl)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(22, 22, 22, 30),
          children: [
            const SizedBox(height: 18),
            const BrandMark(size: 70),
            const SizedBox(height: 28),
            Text(
              'Kordena Mobile',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                fontWeight: FontWeight.w900,
                letterSpacing: 0,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Operaciones, reparto y tracking en vivo.',
              textAlign: TextAlign.center,
              style: TextStyle(color: KordenaColors.muted, fontSize: 16),
            ),
            const SizedBox(height: 34),
            KordenaPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SectionLabel('Acceso seguro'),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _username,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Usuario',
                      prefixIcon: Icon(Icons.person_outline),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _password,
                    obscureText: true,
                    onSubmitted: (_) => _login(),
                    decoration: const InputDecoration(
                      labelText: 'Contrasena',
                      prefixIcon: Icon(Icons.lock_outline),
                    ),
                  ),
                  const SizedBox(height: 18),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'prod', label: Text('Prod')),
                      ButtonSegment(value: 'emulator', label: Text('Local')),
                      ButtonSegment(value: 'custom', label: Text('Custom')),
                    ],
                    selected: {_serverMode},
                    onSelectionChanged: (value) =>
                        setState(() => _serverMode = value.first),
                  ),
                  if (_serverMode == 'custom') ...[
                    const SizedBox(height: 14),
                    TextField(
                      controller: _customBaseUrl,
                      decoration: const InputDecoration(
                        labelText: 'URL API',
                        hintText: 'http://192.168.1.20:5019/api',
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: _loading ? null : _login,
                    icon: _loading
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.login_rounded),
                    label: const Text('Ingresar'),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: _loading ? null : _openTracking,
                    icon: const Icon(Icons.route_outlined),
                    label: const Text('Seguir un pedido'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),
            const Text(
              'Para probar local en emulador Android usa http://10.0.2.2:5019/api y ejecuta el backend con perfil HTTP.',
              textAlign: TextAlign.center,
              style: TextStyle(color: KordenaColors.muted),
            ),
          ],
        ),
      ),
    );
  }
}

class HomeShell extends StatefulWidget {
  const HomeShell({
    super.key,
    required this.session,
    required this.api,
    required this.onLogout,
  });

  final Session session;
  final ApiClient api;
  final Future<void> Function() onLogout;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      DriverDashboardScreen(api: widget.api, session: widget.session),
      PublicTrackingScreen(api: ApiClient(widget.api.baseUrl)),
      AccountScreen(
        session: widget.session,
        api: widget.api,
        onLogout: widget.onLogout,
      ),
    ];

    return Scaffold(
      body: pages[_index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (index) => setState(() => _index = index),
        backgroundColor: KordenaColors.surface,
        indicatorColor: KordenaColors.primary.withValues(alpha: 0.16),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.delivery_dining_outlined),
            selectedIcon: Icon(Icons.delivery_dining),
            label: 'Reparto',
          ),
          NavigationDestination(
            icon: Icon(Icons.map_outlined),
            selectedIcon: Icon(Icons.map),
            label: 'Tracking',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Cuenta',
          ),
        ],
      ),
    );
  }
}

class DriverDashboardScreen extends StatefulWidget {
  const DriverDashboardScreen({
    super.key,
    required this.api,
    required this.session,
  });

  final ApiClient api;
  final Session session;

  @override
  State<DriverDashboardScreen> createState() => _DriverDashboardScreenState();
}

class _DriverDashboardScreenState extends State<DriverDashboardScreen> {
  late Future<List<DeliveryOrder>> _ordersFuture;

  @override
  void initState() {
    super.initState();
    _ordersFuture = widget.api.fetchDeliveryBoard();
  }

  void _refresh() {
    setState(() {
      _ordersFuture = widget.api.fetchDeliveryBoard();
    });
  }

  Future<void> _takeOrder(DeliveryOrder order) async {
    try {
      if (order.status == 'Ready') {
        await widget.api.updateOrderStatus(
          order.id,
          'OnTheWay',
          widget.session.id,
        );
      }
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => DriverTripScreen(
            api: widget.api,
            session: widget.session,
            orders: [order],
          ),
        ),
      );
      _refresh();
    } catch (error) {
      if (mounted) showKordenaSnack(context, error.toString(), isError: true);
    }
  }

  Future<void> _takeRoute(List<DeliveryOrder> orders) async {
    try {
      final routeOrders = orders
          .where(
            (order) => order.status == 'Ready' || order.status == 'OnTheWay',
          )
          .toList();

      for (final order in routeOrders.where(
        (order) => order.status == 'Ready',
      )) {
        await widget.api.updateOrderStatus(
          order.id,
          'OnTheWay',
          widget.session.id,
        );
      }

      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => DriverTripScreen(
            api: widget.api,
            session: widget.session,
            orders: routeOrders,
          ),
        ),
      );
      _refresh();
    } catch (error) {
      if (mounted) showKordenaSnack(context, error.toString(), isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async => _refresh(),
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 18, 18, 12),
                  child: HeaderPanel(
                    label: 'Centro de reparto',
                    title: 'Rutas activas',
                    subtitle:
                        'Pedidos listos y viajes en curso con GPS en vivo.',
                    trailing: IconButton.filledTonal(
                      onPressed: _refresh,
                      icon: const Icon(Icons.refresh_rounded),
                    ),
                  ),
                ),
              ),
              FutureBuilder<List<DeliveryOrder>>(
                future: _ordersFuture,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(child: CircularProgressIndicator()),
                    );
                  }
                  if (snapshot.hasError) {
                    return SliverFillRemaining(
                      hasScrollBody: false,
                      child: EmptyState(
                        icon: Icons.cloud_off_outlined,
                        title: 'No pude cargar reparto',
                        message: snapshot.error.toString(),
                        action: FilledButton(
                          onPressed: _refresh,
                          child: const Text('Reintentar'),
                        ),
                      ),
                    );
                  }
                  final orders = snapshot.data ?? [];
                  if (orders.isEmpty) {
                    return SliverFillRemaining(
                      hasScrollBody: false,
                      child: EmptyState(
                        icon: Icons.inventory_2_outlined,
                        title: 'No hay pedidos para repartir',
                        message:
                            'Cuando cocina marque un pedido como listo va a aparecer aca.',
                        action: FilledButton(
                          onPressed: _refresh,
                          child: const Text('Actualizar'),
                        ),
                      ),
                    );
                  }
                  return SliverPadding(
                    padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
                    sliver: SliverList.separated(
                      itemCount: orders.length + (orders.length > 1 ? 1 : 0),
                      separatorBuilder: (context, separatorIndex) =>
                          const SizedBox(height: 14),
                      itemBuilder: (context, index) {
                        if (orders.length > 1 && index == 0) {
                          return BatchRouteCard(
                            orders: orders,
                            onStart: () => _takeRoute(orders),
                          );
                        }

                        final order =
                            orders[orders.length > 1 ? index - 1 : index];
                        return DeliveryOrderCard(
                          order: order,
                          onStart: () => _takeOrder(order),
                        );
                      },
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class DeliveryOrderCard extends StatelessWidget {
  const DeliveryOrderCard({
    super.key,
    required this.order,
    required this.onStart,
  });

  final DeliveryOrder order;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat.currency(
      locale: 'es_UY',
      symbol: r'$ ',
      decimalDigits: 0,
    );
    final time = DateFormat('HH:mm').format(order.orderDate);
    final isLive = order.status == 'OnTheWay';

    return KordenaPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              StatusPill(status: order.status),
              const Spacer(),
              Text(
                '#${order.id}',
                style: const TextStyle(
                  color: KordenaColors.muted,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      order.clientName,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '$time  -  ${order.itemsCount} items  -  ${order.paymentMethod}',
                      style: const TextStyle(
                        color: KordenaColors.muted,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                formatter.format(order.totalAmount),
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: KordenaColors.surfaceSoft,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: KordenaColors.stroke),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.confirmation_number_outlined,
                  color: KordenaColors.primary,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    order.trackingNumber,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: onStart,
            icon: Icon(
              isLive ? Icons.near_me_rounded : Icons.play_arrow_rounded,
            ),
            label: Text(isLive ? 'Continuar GPS' : 'Tomar pedido y salir'),
          ),
        ],
      ),
    );
  }
}

class BatchRouteCard extends StatelessWidget {
  const BatchRouteCard({
    super.key,
    required this.orders,
    required this.onStart,
  });

  final List<DeliveryOrder> orders;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    final total = orders.fold<double>(
      0,
      (sum, order) => sum + order.totalAmount,
    );
    final formatter = NumberFormat.currency(
      locale: 'es_UY',
      symbol: r'$ ',
      decimalDigits: 0,
    );

    return KordenaPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionLabel('Ruta multiple'),
          const SizedBox(height: 10),
          Text(
            '${orders.length} pedidos en el mismo viaje',
            style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          Text(
            '${orders.map((order) => '#${order.id}').join('  ')} - ${formatter.format(total)}',
            style: const TextStyle(
              color: KordenaColors.muted,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: onStart,
            icon: const Icon(Icons.route_rounded),
            label: const Text('Transmitir GPS a todos'),
          ),
        ],
      ),
    );
  }
}

class DriverTripScreen extends StatefulWidget {
  const DriverTripScreen({
    super.key,
    required this.api,
    required this.session,
    required this.orders,
  });

  final ApiClient api;
  final Session session;
  final List<DeliveryOrder> orders;

  @override
  State<DriverTripScreen> createState() => _DriverTripScreenState();
}

class _DriverTripScreenState extends State<DriverTripScreen>
    with WidgetsBindingObserver {
  final MapController _mapController = MapController();
  StreamSubscription<Position>? _positionSubscription;
  RealtimeTrackingClient? _hub;
  Position? _lastPosition;
  DateTime? _lastSentAt;
  bool _casting = false;
  bool _starting = false;
  String _statusText = 'GPS detenido';

  DeliveryOrder get primaryOrder => widget.orders.first;
  List<String> get trackingNumbers =>
      widget.orders.map((order) => order.trackingNumber).toList();
  bool get isBatchRoute => widget.orders.length > 1;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stopCasting();
    super.dispose();
  }

  Future<void> _startCasting() async {
    if (_starting || _casting) return;
    setState(() {
      _starting = true;
      _statusText = 'Preparando permisos de ubicacion...';
    });

    try {
      await _ensureLocationPermission();
      _hub = RealtimeTrackingClient(
        widget.api.hubUrl,
        token: widget.session.token,
      );
      await _hub!.connect();

      final current = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
      await _sendPosition(current, force: true);

      final settings = AndroidSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 6,
        intervalDuration: const Duration(seconds: 5),
        foregroundNotificationConfig: const ForegroundNotificationConfig(
          notificationTitle: 'Kordena reparto activo',
          notificationText: 'Compartiendo ubicacion del pedido en vivo.',
          enableWakeLock: true,
        ),
      );

      _positionSubscription =
          Geolocator.getPositionStream(locationSettings: settings).listen(
            (position) => _sendPosition(position),
            onError: (error) {
              if (mounted) {
                setState(() {
                  _casting = false;
                  _statusText = error.toString();
                });
              }
            },
          );

      if (mounted) {
        setState(() {
          _casting = true;
          _starting = false;
          _statusText = 'Transmitiendo GPS en vivo';
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _starting = false;
          _casting = false;
          _statusText = 'GPS detenido';
        });
        showKordenaSnack(context, error.toString(), isError: true);
      }
    }
  }

  Future<void> _stopCasting() async {
    await _positionSubscription?.cancel();
    _positionSubscription = null;
    await _hub?.stop();
    _hub = null;
    if (mounted) {
      setState(() {
        _casting = false;
        _starting = false;
        _statusText = 'GPS detenido';
      });
    }
  }

  Future<void> _sendPosition(Position position, {bool force = false}) async {
    final now = DateTime.now();
    if (!force &&
        _lastSentAt != null &&
        now.difference(_lastSentAt!) < const Duration(seconds: 4)) {
      return;
    }

    setState(() {
      _lastPosition = position;
      _lastSentAt = now;
      _statusText =
          'Ultima ubicacion enviada ${DateFormat('HH:mm:ss').format(now)}';
    });

    _mapController.move(LatLng(position.latitude, position.longitude), 16);

    await widget.api.updateDriverLocationBatch(trackingNumbers, position);
    try {
      await _hub?.sendDriverLocationToMany(trackingNumbers, position);
    } catch (_) {
      // REST already persisted and broadcasted the location. SignalR invoke is best effort.
    }
  }

  Future<void> _ensureLocationPermission() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw ApiException(
        'Activa la ubicacion del telefono para iniciar el reparto.',
      );
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied) {
      throw ApiException('Permiso de ubicacion rechazado.');
    }
    if (permission == LocationPermission.deniedForever) {
      throw ApiException(
        'Permiso bloqueado. Habilitalo desde ajustes de Android.',
      );
    }
  }

  Future<void> _markDelivered() async {
    try {
      await widget.api.updateOrderStatus(
        primaryOrder.id,
        'Delivered',
        widget.session.id,
      );
      await _stopCasting();
      if (mounted) {
        showKordenaSnack(context, 'Pedido entregado.');
        Navigator.of(context).pop();
      }
    } catch (error) {
      if (mounted) showKordenaSnack(context, error.toString(), isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final point = _lastPosition == null
        ? null
        : LatLng(_lastPosition!.latitude, _lastPosition!.longitude);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Viaje en curso'),
        actions: [
          IconButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => PublicTrackingScreen(
                  api: ApiClient(widget.api.baseUrl),
                  initialCode: primaryOrder.trackingNumber,
                ),
              ),
            ),
            icon: const Icon(Icons.visibility_outlined),
            tooltip: 'Ver como cliente',
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
        children: [
          KordenaPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    StatusDot(active: _casting),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _statusText,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Text(
                  isBatchRoute
                      ? '${widget.orders.length} pedidos en ruta'
                      : primaryOrder.clientName,
                  style: const TextStyle(
                    fontSize: 25,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  isBatchRoute
                      ? widget.orders.map((order) => '#${order.id}').join('  ')
                      : 'Pedido #${primaryOrder.id} - ${primaryOrder.paymentMethod}',
                  style: const TextStyle(color: KordenaColors.muted),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 380,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(28),
              child: KordenaMap(
                controller: _mapController,
                location: point == null
                    ? null
                    : DriverLocation(
                        latitude: point.latitude,
                        longitude: point.longitude,
                        accuracyMeters: _lastPosition?.accuracy,
                      ),
                emptyMessage: 'Inicia GPS para ver tu ubicacion en el mapa.',
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (_lastPosition != null)
            KordenaPanel(
              child: Row(
                children: [
                  MetricTile(
                    label: 'Precision',
                    value: '${_lastPosition!.accuracy.toStringAsFixed(0)} m',
                  ),
                  MetricTile(
                    label: 'Velocidad',
                    value:
                        '${(_lastPosition!.speed * 3.6).clamp(0, 220).toStringAsFixed(0)} km/h',
                  ),
                ],
              ),
            ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _starting
                ? null
                : _casting
                ? _stopCasting
                : _startCasting,
            icon: _starting
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Icon(
                    _casting ? Icons.stop_rounded : Icons.navigation_rounded,
                  ),
            label: Text(
              _casting ? 'Detener transmision' : 'Iniciar GPS en vivo',
            ),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: isBatchRoute ? null : _markDelivered,
            icon: const Icon(Icons.check_circle_outline),
            label: Text(
              isBatchRoute ? 'Entregar pedidos de a uno' : 'Marcar entregado',
            ),
          ),
        ],
      ),
    );
  }
}

class PublicTrackingScreen extends StatefulWidget {
  const PublicTrackingScreen({super.key, required this.api, this.initialCode});

  final ApiClient api;
  final String? initialCode;

  @override
  State<PublicTrackingScreen> createState() => _PublicTrackingScreenState();
}

class _PublicTrackingScreenState extends State<PublicTrackingScreen> {
  final _code = TextEditingController();
  final _mapController = MapController();
  RealtimeTrackingClient? _hub;
  TrackedOrder? _order;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialCode != null && widget.initialCode!.isNotEmpty) {
      _code.text = widget.initialCode!;
      WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    }
  }

  @override
  void dispose() {
    _hub?.stop();
    _code.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final tracking = _code.text.trim();
    if (tracking.isEmpty) {
      showKordenaSnack(context, 'Ingresa el codigo de tracking.');
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() => _loading = true);
    try {
      final order = await widget.api.fetchTrackedOrder(tracking);
      await _hub?.stop();
      final hub = RealtimeTrackingClient(widget.api.hubUrl);
      await hub.connect();
      hub.onDriverLocation((location) {
        if (!mounted) return;
        setState(() => _order = _order?.copyWith(driverLocation: location));
        _mapController.move(location.point, 16);
      });
      hub.onStatusUpdate((status) {
        if (!mounted) return;
        setState(() => _order = _order?.copyWith(status: status));
      });
      await hub.joinTracking(tracking);

      if (mounted) {
        setState(() {
          _order = order;
          _hub = hub;
        });
        if (order.driverLocation != null) {
          _mapController.move(order.driverLocation!.point, 16);
        }
      }
    } catch (error) {
      if (mounted) showKordenaSnack(context, error.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = _order;

    return Scaffold(
      appBar: AppBar(title: const Text('Tracking cliente')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
        children: [
          HeaderPanel(
            label: 'Seguimiento',
            title: order?.branchName ?? 'Segui tu pedido',
            subtitle:
                'Estado en vivo y ubicacion del repartidor cuando sale del local.',
          ),
          const SizedBox(height: 16),
          KordenaPanel(
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _code,
                    textInputAction: TextInputAction.go,
                    onSubmitted: (_) => _load(),
                    decoration: const InputDecoration(
                      labelText: 'Codigo de tracking',
                      prefixIcon: Icon(Icons.confirmation_number_outlined),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                FilledButton(
                  onPressed: _loading ? null : _load,
                  child: _loading
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.search_rounded),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (order != null) ...[
            KordenaPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      StatusPill(status: order.status),
                      const Spacer(),
                      Text(
                        NumberFormat.currency(
                          locale: 'es_UY',
                          symbol: r'$ ',
                          decimalDigits: 0,
                        ).format(order.totalAmount),
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Text(
                    'Pedido #${order.id}',
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${order.clientName} - ${order.paymentMethod}',
                    style: const TextStyle(
                      color: KordenaColors.muted,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 16),
                  for (final item in order.items.take(4))
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              '${item.quantity} x ${item.productName}',
                            ),
                          ),
                          Text(
                            NumberFormat.currency(
                              locale: 'es_UY',
                              symbol: r'$ ',
                              decimalDigits: 0,
                            ).format(item.subtotal),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 410,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(28),
                child: KordenaMap(
                  controller: _mapController,
                  location: order.driverLocation,
                  emptyMessage: order.status == 'OnTheWay'
                      ? 'Esperando primera ubicacion del repartidor...'
                      : 'El mapa se activa cuando el pedido sale a reparto.',
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class AccountScreen extends StatelessWidget {
  const AccountScreen({
    super.key,
    required this.session,
    required this.api,
    required this.onLogout,
  });

  final Session session;
  final ApiClient api;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 28),
          children: [
            HeaderPanel(
              label: 'Cuenta',
              title: session.username,
              subtitle:
                  '${session.role} - ${session.tenantSlug.isEmpty ? 'Sin negocio' : session.tenantSlug}',
              trailing: IconButton.filledTonal(
                onPressed: onLogout,
                icon: const Icon(Icons.logout_rounded),
              ),
            ),
            const SizedBox(height: 16),
            KordenaPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SectionLabel('Servidor'),
                  const SizedBox(height: 12),
                  SelectableText(
                    api.baseUrl,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 18),
                  const SectionLabel('Permisos'),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      StatusDot(active: session.canDeliver),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          session.canDeliver
                              ? 'Puede transmitir ubicacion de repartidor.'
                              : 'Este usuario no tiene rol de reparto.',
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class KordenaMap extends StatelessWidget {
  const KordenaMap({
    super.key,
    required this.controller,
    required this.location,
    required this.emptyMessage,
  });

  final MapController controller;
  final DriverLocation? location;
  final String emptyMessage;

  @override
  Widget build(BuildContext context) {
    final center = location?.point ?? const LatLng(-34.8941, -56.0675);

    return Stack(
      children: [
        FlutterMap(
          mapController: controller,
          options: MapOptions(
            initialCenter: center,
            initialZoom: location == null ? 12 : 16,
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.kordena.mobile',
            ),
            if (location != null && location!.accuracyMeters != null)
              CircleLayer(
                circles: [
                  CircleMarker(
                    point: location!.point,
                    radius: location!.accuracyMeters!.clamp(20, 220),
                    useRadiusInMeter: true,
                    color: KordenaColors.primary.withValues(alpha: 0.14),
                    borderColor: KordenaColors.primary.withValues(alpha: 0.35),
                    borderStrokeWidth: 1.5,
                  ),
                ],
              ),
            if (location != null)
              MarkerLayer(
                markers: [
                  Marker(
                    point: location!.point,
                    width: 82,
                    height: 82,
                    child: const DriverMarker(),
                  ),
                ],
              ),
          ],
        ),
        Positioned(
          left: 14,
          right: 14,
          bottom: 14,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: KordenaColors.background.withValues(alpha: 0.88),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: KordenaColors.stroke),
            ),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Icon(
                    location == null
                        ? Icons.satellite_alt_outlined
                        : Icons.my_location_rounded,
                    color: location == null
                        ? KordenaColors.warning
                        : KordenaColors.success,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      location == null
                          ? emptyMessage
                          : 'Ubicacion recibida ${formatLocationTime(location!.locationAtUtc)}',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class HeaderPanel extends StatelessWidget {
  const HeaderPanel({
    super.key,
    required this.label,
    required this.title,
    required this.subtitle,
    this.trailing,
  });

  final String label;
  final String title;
  final String subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return KordenaPanel(
      padding: const EdgeInsets.all(24),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SectionLabel(label),
                const SizedBox(height: 10),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 34,
                    fontWeight: FontWeight.w900,
                    height: 1.05,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: KordenaColors.muted,
                    fontSize: 15,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 16), trailing!],
        ],
      ),
    );
  }
}

class KordenaPanel extends StatelessWidget {
  const KordenaPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
  });

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: KordenaColors.surface,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: KordenaColors.stroke),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.20),
            blurRadius: 28,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      child: child,
    );
  }
}

class BrandMark extends StatelessWidget {
  const BrandMark({super.key, required this.size});
  final double size;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [
              KordenaColors.accent,
              KordenaColors.primary,
              KordenaColors.success,
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(size * 0.28),
          boxShadow: [
            BoxShadow(
              color: KordenaColors.primary.withValues(alpha: 0.25),
              blurRadius: 30,
              offset: const Offset(0, 15),
            ),
          ],
        ),
        child: Center(
          child: Text(
            'K',
            style: TextStyle(
              color: Colors.white,
              fontSize: size * 0.46,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
      ),
    );
  }
}

class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: const TextStyle(
        color: KordenaColors.primary,
        fontSize: 12,
        fontWeight: FontWeight.w900,
        letterSpacing: 0,
      ),
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'Ready' => KordenaColors.warning,
      'OnTheWay' => KordenaColors.success,
      'Delivered' => KordenaColors.success,
      'Cancelled' => KordenaColors.error,
      _ => KordenaColors.primary,
    };
    final label = switch (status) {
      'Ready' => 'Listo',
      'OnTheWay' => 'En camino',
      'Delivered' => 'Entregado',
      'Cancelled' => 'Cancelado',
      'Cooking' => 'Cocina',
      'Confirmed' => 'Confirmado',
      'Pending' => 'Pendiente',
      _ => status,
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.13),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontWeight: FontWeight.w900),
      ),
    );
  }
}

class StatusDot extends StatelessWidget {
  const StatusDot({super.key, required this.active});
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 14,
      height: 14,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: active ? KordenaColors.success : KordenaColors.muted,
        boxShadow: [
          if (active)
            BoxShadow(
              color: KordenaColors.success.withValues(alpha: 0.45),
              blurRadius: 16,
              spreadRadius: 3,
            ),
        ],
      ),
    );
  }
}

class DriverMarker extends StatelessWidget {
  const DriverMarker({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 58,
        height: 58,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: KordenaColors.background,
          border: Border.all(color: Colors.white, width: 3),
          boxShadow: [
            BoxShadow(
              color: KordenaColors.primary.withValues(alpha: 0.35),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: const Icon(
          Icons.delivery_dining,
          color: KordenaColors.primary,
          size: 32,
        ),
      ),
    );
  }
}

class MetricTile extends StatelessWidget {
  const MetricTile({super.key, required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionLabel(label),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.action,
  });

  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 58, color: KordenaColors.primary),
            const SizedBox(height: 18),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: KordenaColors.muted, height: 1.4),
            ),
            if (action != null) ...[const SizedBox(height: 18), action!],
          ],
        ),
      ),
    );
  }
}

void showKordenaSnack(
  BuildContext context,
  String message, {
  bool isError = false,
}) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(message),
      backgroundColor: isError
          ? KordenaColors.error
          : KordenaColors.surfaceSoft,
      behavior: SnackBarBehavior.floating,
      showCloseIcon: true,
    ),
  );
}

Map<String, dynamic> asMap(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map((key, item) => MapEntry(key.toString(), item));
  }
  return <String, dynamic>{};
}

double? toDouble(Object? value) {
  if (value is double) return value;
  if (value is int) return value.toDouble();
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

int? toInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}

DateTime? parseDate(Object? value) {
  if (value == null) return null;
  final parsed = DateTime.tryParse(value.toString());
  return parsed?.toLocal();
}

String formatLocationTime(DateTime? date) {
  if (date == null) return 'ahora';
  return DateFormat('HH:mm:ss').format(date.toLocal());
}
