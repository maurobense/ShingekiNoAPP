// js/signalrService.js

// Ajusta el puerto a tu backend real
const HUB_URL = 'http://localhost:5000/ordersHub'; 

let connection = null;

export async function startSignalR() {
    const token = localStorage.getItem('token');
    if (!token) return;

    // 'signalR' es global gracias al script del CDN en el HTML
    connection = new signalR.HubConnectionBuilder()
        .withUrl(HUB_URL, {
            accessTokenFactory: () => token // Envía el token JWT
        })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Information)
        .build();

    // --- DEFINIR EVENTOS QUE ESCUCHAMOS DEL BACKEND ---
    
    // Ejemplo: Cuando entra un pedido nuevo
    connection.on("ReceiveNewOrder", (orderId) => {
        console.log("🔔 Nuevo pedido recibido! ID:", orderId);
        
        // Opción A: Mostrar una notificación Toastify/SweetAlert
        alert("¡Nuevo pedido entrante! #" + orderId); 

        // Opción B: Recargar la tabla de pedidos automáticamente si existe
        if (window.loadOrders) window.loadOrders(); 
    });

    // Ejemplo: Cuando cambia el estado de un pedido
    connection.on("ReceiveOrderStatusUpdate", (orderId, status) => {
        console.log(`Pedido ${orderId} cambió a ${status}`);
        if (window.loadOrders) window.loadOrders();
    });

    try {
        await connection.start();
        console.log("🟢 SignalR Conectado exitosamente.");
    } catch (err) {
        console.error("🔴 Error conectando SignalR:", err);
        // Reintentar en 5 segundos si falla al inicio
        setTimeout(startSignalR, 5000);
    }
}