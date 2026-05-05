# Kordena Mobile

App Flutter para operaciones mobile de Kordena.

## Que incluye

- Login contra el backend de Kordena.
- Selector de servidor: produccion, local emulador o URL custom.
- Panel de repartidor con pedidos `Ready` y `OnTheWay`.
- Transmision GPS en vivo por REST y SignalR.
- Ruta multiple: una sola transmision GPS puede alimentar varios links de tracking.
- Tracking cliente con mapa y actualizacion realtime.
- APK debug y release generados en `build/app/outputs/flutter-apk`.

## Probar en emulador local

1. Ejecutar backend con perfil HTTP:

```powershell
dotnet run --project C:\Software\ShingekiNoAPP\ShingekiNoAPP\BarberShopAPI\BarberShopAPI\ShingekiNoAPPI.csproj --launch-profile http
```

2. Abrir el emulador creado:

```powershell
C:\src\flutter\bin\flutter.bat emulators --launch kordena_pixel
```

3. Correr la app:

```powershell
cd C:\Software\ShingekiNoAPP\kordena_mobile
C:\src\flutter\bin\flutter.bat run -d emulator-5554
```

4. En login elegir `Local`. La URL usada es:

```text
http://10.0.2.2:5019/api
```

## Probar contra produccion

1. Subir el publish backend de `C:\Software\ShingekiNoAPP\publish\prod-2026-05-05\backend`.
2. Subir el publish frontend de `C:\Software\ShingekiNoAPP\publish\prod-2026-05-05\frontend`.
3. Instalar `build/app/outputs/flutter-apk/app-release.apk`.
4. En login elegir `Prod`.

## Flujo de tracking

1. Crear o usar un pedido que este `Ready`.
2. Entrar con un usuario `Delivery`, `Admin` o `BranchManager`.
3. En `Reparto`, tocar `Tomar pedido y salir`.
4. Tocar `Iniciar GPS en vivo`.
5. Abrir la pantalla `Tracking` con el codigo del pedido o el link web `track.html?code=...`.

La app envia ubicacion por:

- `POST /api/Orders/track/{trackingNumber}/driver-location`
- `POST /api/Orders/track/driver-location/batch`
- SignalR `deliveryHub.SendDriverLocation`
- SignalR `deliveryHub.SendDriverLocationToMany`

El cliente escucha:

- `ReceiveDriverLocation`
- `ReceiveDriverLocationDetails`
- `ReceiveStatusUpdate`
