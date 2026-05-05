import { apiCall } from './apiService.js';
import { escapeHtml, showToast } from './ui.js';

const params = new URLSearchParams(window.location.search);
const tenantSlug = params.get('negocio') || params.get('tenant') || localStorage.getItem('tenant_slug');
let tenant = null;
let profile = null;
let orders = [];

const tokenKey = `customer_token_${tenantSlug}`;
let customerToken = localStorage.getItem(tokenKey);

document.addEventListener('DOMContentLoaded', async () => {
    if (!tenantSlug) {
        renderAccessError('Falta el restaurante en el enlace.');
        return;
    }

    document.getElementById('back-to-order').href = `order.html?negocio=${encodeURIComponent(tenantSlug)}`;
    document.getElementById('customer-logout-btn').addEventListener('click', logout);
    document.getElementById('refresh-orders').addEventListener('click', loadOrders);
    document.getElementById('customer-profile-form').addEventListener('submit', updateProfile);
    document.getElementById('customer-password-form').addEventListener('submit', changePassword);

    if (!customerToken) {
        renderAccessError('Inicia sesion o crea una cuenta desde la carta para ver tu perfil.');
        return;
    }

    await init();
});

async function init() {
    try {
        tenant = await apiCall(`/public/tenants/${encodeURIComponent(tenantSlug)}`, 'GET', null, { skipAuth: true });
        profile = await apiCall(`/public/tenants/${encodeURIComponent(tenantSlug)}/customers/me`, 'GET', null, { token: customerToken });
        applyBranding();
        renderProfile();
        await loadOrders();
    } catch (error) {
        localStorage.removeItem(tokenKey);
        renderAccessError('Tu sesion vencio. Volve a entrar desde la carta.');
    }
}

function applyBranding() {
    const root = document.documentElement;
    root.style.setProperty('--tenant-primary', tenant.primaryColor || '#111827');
    root.style.setProperty('--tenant-secondary', tenant.secondaryColor || '#f59e0b');
    root.style.setProperty('--tenant-accent', tenant.accentColor || '#10b981');
    document.title = `Mi perfil | ${tenant.brandName || tenant.name}`;
    document.getElementById('tenant-name').textContent = tenant.brandName || tenant.name;
    document.getElementById('tenant-mark').textContent = (tenant.brandName || tenant.name || 'K').trim().charAt(0).toUpperCase();
}

function renderProfile() {
    document.getElementById('customer-profile-subtitle').textContent = `${profile.name}, aca tenes tus pedidos de ${profile.brandName}.`;
    document.getElementById('profile-name').value = profile.name || '';
    document.getElementById('profile-lastname').value = profile.lastName || '';
    document.getElementById('profile-phone').value = profile.phone || '';
    renderCurrentOrder(profile.currentOrder);
}

function renderCurrentOrder(order) {
    const card = document.getElementById('current-order-card');
    if (!order) {
        card.innerHTML = `
            <div>
                <span class="brand-subtitle">Ahora</span>
                <h2 class="h5 fw-bold mb-1">No tenes pedidos activos</h2>
                <p class="text-muted mb-0">Cuando hagas uno, lo vas a poder seguir desde aca.</p>
            </div>
            <a class="btn btn-primary" href="order.html?negocio=${encodeURIComponent(tenantSlug)}">Hacer pedido</a>
        `;
        return;
    }

    card.innerHTML = `
        <div>
            <span class="brand-subtitle">Pedido activo</span>
            <h2 class="h5 fw-bold mb-1">Pedido #${order.id}</h2>
            <p class="text-muted mb-0">${statusLabel(order.status)} · $${Number(order.totalAmount || 0).toLocaleString('es-UY')}</p>
        </div>
        <a class="btn btn-success" href="${order.trackingUrl}">Ver seguimiento</a>
    `;
}

async function loadOrders() {
    try {
        orders = await apiCall(`/public/tenants/${encodeURIComponent(tenantSlug)}/customers/me/orders`, 'GET', null, { token: customerToken });
        renderOrders();
    } catch (error) {
        showToast('No pudimos cargar tus pedidos.', 'error');
    }
}

function renderOrders() {
    const container = document.getElementById('customer-orders-list');
    if (!orders.length) {
        container.innerHTML = '<div class="text-muted text-center py-4">Todavia no hay pedidos en esta cuenta.</div>';
        return;
    }

    container.innerHTML = orders.map(order => `
        <article class="customer-order-row">
            <div>
                <strong>#${order.id}</strong>
                <span class="customer-status">${statusLabel(order.status)}</span>
                <small>${new Date(order.orderDate).toLocaleString('es-UY')} · ${escapeHtml(paymentLabel(order.paymentMethod))}</small>
            </div>
            <div class="text-end">
                <strong>$${Number(order.totalAmount || 0).toLocaleString('es-UY')}</strong>
                <a href="${order.trackingUrl}" class="btn btn-sm btn-outline-dark mt-1">Seguimiento</a>
            </div>
        </article>
    `).join('');
}

async function updateProfile(event) {
    event.preventDefault();
    const button = event.submitter;
    setBusy(button, true, 'Guardando...');
    try {
        profile = await apiCall(`/public/tenants/${encodeURIComponent(tenantSlug)}/customers/me`, 'PUT', {
            name: document.getElementById('profile-name').value,
            lastName: document.getElementById('profile-lastname').value,
            phone: document.getElementById('profile-phone').value
        }, { token: customerToken });
        renderProfile();
        showToast('Perfil actualizado.');
    } catch (error) {
        showToast(error.message || 'No pudimos actualizar tu perfil.', 'error');
    } finally {
        setBusy(button, false, 'Guardar cambios');
    }
}

async function changePassword(event) {
    event.preventDefault();
    const button = event.submitter;
    setBusy(button, true, 'Actualizando...');
    try {
        await apiCall(`/public/tenants/${encodeURIComponent(tenantSlug)}/customers/me/change-password`, 'POST', {
            currentPassword: document.getElementById('current-password').value,
            newPassword: document.getElementById('new-password').value
        }, { token: customerToken });
        event.target.reset();
        showToast('Contrasena actualizada.');
    } catch (error) {
        showToast(error.message || 'No pudimos cambiar la contrasena.', 'error');
    } finally {
        setBusy(button, false, 'Actualizar');
    }
}

function logout() {
    localStorage.removeItem(tokenKey);
    window.location.href = `order.html?negocio=${encodeURIComponent(tenantSlug)}`;
}

function renderAccessError(message) {
    document.querySelector('.customer-profile-layout').innerHTML = `
        <div class="customer-panel text-center py-5">
            <i class="bi bi-person-lock fs-1 text-muted"></i>
            <h2 class="h4 fw-bold mt-3">Perfil no disponible</h2>
            <p class="text-muted">${escapeHtml(message)}</p>
            <a class="btn btn-primary" href="order.html?negocio=${encodeURIComponent(tenantSlug || '')}">Ir a la carta</a>
        </div>
    `;
}

function statusLabel(status) {
    const labels = {
        Pending: 'Pendiente',
        Confirmed: 'Confirmado',
        Cooking: 'En cocina',
        Ready: 'Listo',
        OnTheWay: 'En camino',
        Delivered: 'Entregado',
        Cancelled: 'Cancelado'
    };
    return labels[status] || status || '-';
}

function paymentLabel(method) {
    const labels = {
        Cash: 'Efectivo',
        MercadoPago: 'MercadoPago',
        Transfer: 'Transferencia',
        Pos: 'POS'
    };
    return labels[method] || method || '-';
}

function setBusy(button, busy, text) {
    button.disabled = busy;
    button.innerHTML = busy ? `<span class="spinner-border spinner-border-sm me-2"></span>${text}` : text;
}
