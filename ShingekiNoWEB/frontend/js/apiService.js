// URL de tu API (Asegúrate que coincida con la que sale en Visual Studio)
// const BASE_URL = '/api';
const BASE_URL = 'https://localhost:7200/api';

const getToken = () => localStorage.getItem('jwt_token');

export const apiCall = async (endpoint, method = 'GET', data = null) => {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };

    if (token) headers['Authorization'] = `Bearer ${token}`;

    const config = {
        method,
        headers,
        body: data ? JSON.stringify(data) : null,
    };

    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, config);
        
        if (response.status === 401) {
            console.warn("401 Unauthorized - Token inválido o expirado");
            localStorage.clear();
            if (!window.location.pathname.endsWith('index.html')) {
                window.location.href = 'index.html';
            }
            return;
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `Error HTTP: ${response.status}`);
        }

        if (response.status === 204) return null;
        return await response.json(); 

    } catch (error) {
        console.error("API Error:", error);
        throw error;
    }
};