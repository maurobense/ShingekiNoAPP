using Business.BusinessEntities;
using Datos.EF;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace ShingekiNoAPPI.Hubs
{
    public class DeliveryHub : Hub
    {
        private readonly ShingekiContext _context;

        public DeliveryHub(ShingekiContext context)
        {
            _context = context;
        }

        public async Task JoinKitchenGroup()
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, "Kitchen");
        }

        public async Task JoinOrderGroup(string orderId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, orderId);
        }

        public async Task JoinTrackingGroup(string trackingNumber)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, trackingNumber);
        }

        [Authorize(Roles = "Delivery,Admin,BranchManager")]
        public async Task SendDriverLocation(string trackingNumber, double lat, double lng)
        {
            if (!Guid.TryParse(trackingNumber, out var trackingGuid)) return;
            if (!IsValidCoordinate(lat, lng)) return;

            var order = await _context.Orders.FirstOrDefaultAsync(o => o.TrackingNumber == trackingGuid);
            if (order == null) return;

            order.LastDriverLatitude = lat;
            order.LastDriverLongitude = lng;
            order.LastDriverLocationAtUtc = DateTime.UtcNow;
            order.LastDriverUserId = GetUserId();
            await _context.SaveChangesAsync();

            await Clients.Group(trackingNumber).SendAsync("ReceiveDriverLocation", lat, lng);
            await Clients.Group(trackingNumber).SendAsync("ReceiveDriverLocationDetails", new
            {
                latitude = lat,
                longitude = lng,
                locationAtUtc = order.LastDriverLocationAtUtc,
                orderId = order.Id
            });
        }

        [Authorize(Roles = "Delivery,Admin,BranchManager")]
        public async Task SendDriverLocationToMany(IEnumerable<string> trackingNumbers, double lat, double lng)
        {
            if (trackingNumbers == null || !IsValidCoordinate(lat, lng)) return;

            var trackingGuids = trackingNumbers
                .Select(value => Guid.TryParse(value, out var guid) ? guid : Guid.Empty)
                .Where(value => value != Guid.Empty)
                .Distinct()
                .Take(12)
                .ToList();

            if (trackingGuids.Count == 0) return;

            var orders = await _context.Orders
                .Where(o => trackingGuids.Contains(o.TrackingNumber))
                .ToListAsync();

            var activeOrders = orders
                .Where(o => o.CurrentStatus != OrderStatus.Delivered && o.CurrentStatus != OrderStatus.Cancelled)
                .ToList();

            foreach (var order in activeOrders)
            {
                order.LastDriverLatitude = lat;
                order.LastDriverLongitude = lng;
                order.LastDriverLocationAtUtc = DateTime.UtcNow;
                order.LastDriverUserId = GetUserId();
            }

            await _context.SaveChangesAsync();

            foreach (var order in activeOrders)
            {
                var trackingNumber = order.TrackingNumber.ToString();
                await Clients.Group(trackingNumber).SendAsync("ReceiveDriverLocation", lat, lng);
                await Clients.Group(trackingNumber).SendAsync("ReceiveDriverLocationDetails", new
                {
                    latitude = lat,
                    longitude = lng,
                    locationAtUtc = order.LastDriverLocationAtUtc,
                    orderId = order.Id
                });
            }
        }

        private long? GetUserId()
        {
            var id = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(id, out var userId) ? userId : null;
        }

        private static bool IsValidCoordinate(double lat, double lng)
        {
            return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
        }
    }
}
