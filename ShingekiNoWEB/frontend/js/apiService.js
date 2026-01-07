// ==========================================
// ⚙️ CONFIGURACIÓN DE CONEXIÓN
// ==========================================

// Detecta automáticamente si estás en tu PC o en Netlify
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

let BASE_URL;
let HUB_URL;

if (isLocal) {
    console.log("🏠 Modo Desarrollo Detectado (Localhost)");
    BASE_URL = 'https://localhost:7200/api';
    HUB_URL = 'https://localhost:7200/deliveryHub';
} else {
    // ☁️ MODO PRODUCCIÓN (Netlify)
    // USAMOS RUTAS RELATIVAS PARA QUE EL _REDIRECTS FUNCIONE
    // Eliminamos la URL de Somee de aquí, Netlify se encarga por detrás
    console.log("☁️ Modo Producción Detectado (Netlify Proxy)");
    BASE_URL = '/api/'; 
    HUB_URL = '/deliveryHub/';
}

export let connection = null;
const getToken = () => localStorage.getItem('jwt_token');

// ==========================================
// 📡 API CALL (Fetch Wrapper)
// ==========================================
export const apiCall = async (endpoint, method = 'GET', data = null) => {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // 🛠️ Limpieza de barras: asegura que el endpoint no duplique la barra
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${BASE_URL}${cleanEndpoint}`;

    const config = {
        method,
        headers,
        body: data ? JSON.stringify(data) : null,
    };

    try {
        const response = await fetch(url, config);
        
        if (response.status === 401) {
            if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
                 throw new Error("Unauthorized");
            }
            if (!window.location.pathname.includes('track.html')) {
                localStorage.clear();
                window.location.href = 'index.html';
            }
            return;
        }

        if (!response.ok) {
            const errorText = await response.text();
            // Esto te ayudará a ver el error real en la consola si el servidor devuelve detalles
            throw new Error(errorText || `Error HTTP: ${response.status}`);
        }

        if (response.status === 204) return null;
        return await response.json(); 

    } catch (error) {
        console.error("API Error details:", error);
        throw error;
    }
};

// ==========================================
// 🔥 SIGNALR (WebSockets en Tiempo Real)
// ==========================================
export const initSignalR = async (callbacks = {}) => {
    if (typeof signalR === 'undefined') {
        if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
            console.error("⚠️ SignalR no cargado.");
        }
        return;
    }

    if (connection && connection.state === signalR.HubConnectionState.Connected) {
        if (callbacks.onNewOrder) {
            connection.off("ReceiveNewOrder");
            connection.on("ReceiveNewOrder", callbacks.onNewOrder);
        }
        if (callbacks.onStatusUpdate) {
            connection.off("ReceiveStatusUpdate");
            connection.on("ReceiveStatusUpdate", callbacks.onStatusUpdate);
        }
        return;
    }

    if (!connection) {
        connection = new signalR.HubConnectionBuilder()
            .withUrl(HUB_URL, {
                accessTokenFactory: () => getToken()
            })
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Information)
            .build();
    }

    if (callbacks.onNewOrder) connection.on("ReceiveNewOrder", callbacks.onNewOrder);
    if (callbacks.onStatusUpdate) connection.on("ReceiveStatusUpdate", callbacks.onStatusUpdate);

    try {
        await connection.start();
        console.log("🟢 SignalR Conectado a:", HUB_URL);
    } catch (err) {
        console.error("🔴 Error conectando SignalR:", err);
        setTimeout(() => initSignalR(callbacks), 5000);
    }
};

export const stopSignalR = async () => {
    if (connection) {
        await connection.stop();
        console.log("🔴 SignalR Desconectado");
        connection = null;
    }
};