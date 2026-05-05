const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

let BASE_URL;
let HUB_URL;

if (isLocal) {
    console.log('Modo Desarrollo Detectado (Localhost)');
    BASE_URL = 'http://localhost:5019/api';
    HUB_URL = 'http://localhost:5019/deliveryHub';
} else {
    console.log('Modo Produccion Detectado (Somee API directa)');
    BASE_URL = 'https://www.shingekinoappi.somee.com/api';
    HUB_URL = 'https://www.shingekinoappi.somee.com/deliveryHub';
}

export let connection = null;
const getToken = () => localStorage.getItem('jwt_token');

export const apiCall = async (endpoint, method = 'GET', data = null, options = {}) => {
    const token = options.token ?? getToken();
    const isFormData = data instanceof FormData;
    const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
    if (token && !options.skipAuth) headers.Authorization = `Bearer ${token}`;

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${BASE_URL}${cleanEndpoint}`;

    const config = {
        method,
        headers,
        body: data ? (isFormData ? data : JSON.stringify(data)) : null,
    };

    try {
        const response = await fetch(url, config);

        if (response.status === 401) {
            const errorText = await response.text();
            const message = errorText || 'Credenciales incorrectas o sesion vencida.';
            const path = window.location.pathname;
            const isInternalLogin = path.endsWith('index.html') || path === '/';
            const isPublicCustomerFlow =
                options.skipAuth ||
                options.token ||
                path.includes('order.html') ||
                path.includes('customer.html') ||
                path.includes('track.html');

            if (isInternalLogin || isPublicCustomerFlow) {
                throw new Error(message);
            }

            console.error('ALERTA 401: Token interno vencido o invalido. Redirigiendo al login...');
            localStorage.removeItem('jwt_token');
            window.location.href = 'index.html';
            return null;
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `Error HTTP: ${response.status}`);
        }

        if (response.status === 204) return null;

        const responseText = await response.text();
        if (!responseText) {
            throw new Error(`La API respondio ${response.status} sin contenido para ${cleanEndpoint}. Revisar despliegue del backend.`);
        }

        try {
            return JSON.parse(responseText);
        } catch {
            throw new Error(`La API no devolvio JSON valido para ${cleanEndpoint}: ${responseText.slice(0, 180)}`);
        }
    } catch (error) {
        console.error('API Error details:', error);
        throw error;
    }
};

export const getApiBaseUrl = () => BASE_URL;

export const uploadImage = async (file, folder = 'products', options = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    const params = new URLSearchParams({ folder });
    if (options.tenantFolder) params.set('tenantFolder', options.tenantFolder);
    return apiCall(`/files/images?${params.toString()}`, 'POST', formData);
};

export const initSignalR = async (callbacks = {}) => {
    if (typeof signalR === 'undefined') {
        if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
            console.error('SignalR no cargado.');
        }
        return;
    }

    if (connection && connection.state === signalR.HubConnectionState.Connected) {
        if (callbacks.onNewOrder) {
            connection.off('ReceiveNewOrder');
            connection.on('ReceiveNewOrder', callbacks.onNewOrder);
        }
        if (callbacks.onStatusUpdate) {
            connection.off('ReceiveStatusUpdate');
            connection.on('ReceiveStatusUpdate', callbacks.onStatusUpdate);
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

    if (callbacks.onNewOrder) connection.on('ReceiveNewOrder', callbacks.onNewOrder);
    if (callbacks.onStatusUpdate) connection.on('ReceiveStatusUpdate', callbacks.onStatusUpdate);

    try {
        await connection.start();
        console.log('SignalR conectado a:', HUB_URL);
    } catch (err) {
        console.error('Error conectando SignalR:', err);
        setTimeout(() => initSignalR(callbacks), 5000);
    }
};

export const stopSignalR = async () => {
    if (connection) {
        await connection.stop();
        console.log('SignalR desconectado');
        connection = null;
    }
};
