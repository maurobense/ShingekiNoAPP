import { apiCall } from './apiService.js';

// ==========================================
// 🔐 LOGIN
// ==========================================
export const login = async (username, password) => {
    try {
        const data = await apiCall('/User/login', 'POST', { username, password });
        
        if (data && data.token) {
            localStorage.setItem('jwt_token', data.token);
            localStorage.setItem('user_role', data.role);
            localStorage.setItem('user_name', data.username);
            localStorage.setItem('user_id', data.id);
            
            console.log("✅ Login OK. Rol:", data.role);

            const role = String(data.role).toUpperCase();

            // 🔥 CORRECCIÓN: Agregamos '3', 'WAITER', 'DELIVERY' para que vayan al Admin
            const dashboardRoles = ['ADMIN', '1', 'KITCHEN', '2', 'BRANCHMANAGER', 'WAITER', 'DELIVERY', '3'];

            if (dashboardRoles.includes(role)) {
                window.location.href = 'admin.html'; 
            } else {
                // Solo clientes reales van al menú visual
                window.location.href = 'menu.html';
            }
            return true;
        }
        return false;
    } catch (error) {
        throw error;
    }
};

// ==========================================
// 📝 REGISTRO
// ==========================================
export const register = async (userData) => {
    try {
        const payload = {
            username: userData.username,
            name: userData.name,
            lastName: userData.lastName,
            phone: userData.phone.toString(),
            branchId: parseInt(userData.branchId),
            password: userData.password,
            // Si viene rol úsalo, sino por defecto 3 (Delivery/Mozo) para registros externos
            role: userData.role ? parseInt(userData.role) : 3,
            picture: "",
            isDeleted: false
        };

        const response = await apiCall('/User', 'POST', payload);
        return response;

    } catch (error) {
        console.error("Error registro:", error);
        throw error;
    }
};

// ==========================================
// 🚪 LOGOUT
// ==========================================
export const logout = () => {
    console.log("👋 Cerrando sesión...");
    localStorage.clear();
    // Al salir, volvemos al login (index.html)
    window.location.href = 'index.html';
};