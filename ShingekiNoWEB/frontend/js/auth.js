import { apiCall } from './apiService.js';

export const login = async (username, password) => {
    const data = await apiCall('/User/login', 'POST', { username, password });

    if (!data || !data.token) {
        throw new Error('La API no devolvio el token de login.');
    }

    localStorage.setItem('jwt_token', data.token);
    localStorage.setItem('user_role', data.role);
    localStorage.setItem('user_name', data.username);
    localStorage.setItem('user_id', data.id);
    localStorage.setItem('branch_id', data.branchId || '');
    localStorage.setItem('tenant_slug', data.tenantSlug || '');
    localStorage.setItem('tenant_folder', data.tenantFolder || '');
    localStorage.setItem('public_ordering_url', data.publicOrderingUrl || '');

    const role = String(data.role).toUpperCase();

    if (['SUPERADMIN', '99'].includes(role)) {
        window.location.href = 'superadmin.html';
        return true;
    }

    const dashboardRoles = ['ADMIN', '1', 'KITCHEN', '2', 'BRANCHMANAGER', '4', 'WAITER', 'DELIVERY', '3'];

    if (dashboardRoles.includes(role)) {
        window.location.href = 'admin.html';
    } else {
        window.location.href = 'menu.html';
    }

    return true;
};

export const logout = () => {
    localStorage.clear();
    window.location.href = 'index.html';
};
