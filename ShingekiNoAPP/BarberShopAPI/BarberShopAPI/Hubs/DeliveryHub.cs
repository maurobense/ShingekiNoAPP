using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace ShingekiNoAPPI.Hubs
{
    public class DeliveryHub : Hub
    {
        // -------------------------------------------------------------
        // 1. COCINA / ADMIN (Dashboard)
        // -------------------------------------------------------------
        // La pantalla de Admin se une aquí para escuchar "ReceiveNewOrder" y actualizaciones globales.
        public async Task JoinKitchenGroup()
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, "Kitchen");
        }

        // -------------------------------------------------------------
        // 2. CLIENTE (Rastreo Interno / Legacy)
        // -------------------------------------------------------------
        // Se une usando el ID numérico (Ej: "1050"). 
        // Útil si usas el rastreo desde dentro de la app logueada.
        public async Task JoinOrderGroup(string orderId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, orderId);
        }

        // -------------------------------------------------------------
        // 3. CLIENTE PÚBLICO (Rastreo Seguro con Link)
        // -------------------------------------------------------------
        // Se une usando el GUID (Ej: "550e8400-e29b...").
        // Esto lo usa track.html para escuchar cambios de estado y ubicación.
        public async Task JoinTrackingGroup(string trackingNumber)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, trackingNumber);
        }

        // -------------------------------------------------------------
        // 4. REPARTIDOR (GPS en Tiempo Real)
        // -------------------------------------------------------------
        // El celular del repartidor llama a este método cada 5 segundos.
        // El Hub recibe la lat/lng y la REENVÍA a quien esté mirando ese pedido específico.
        public async Task SendDriverLocation(string trackingNumber, double lat, double lng)
        {
            // Enviamos el evento "ReceiveDriverLocation" solo al grupo de ese pedido
            await Clients.Group(trackingNumber).SendAsync("ReceiveDriverLocation", lat, lng);
        }
    }
}