import { apiCall } from './apiService.js';
import { logout } from './auth.js';
import { escapeHtml, showToast } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    const role = String(localStorage.getItem('user_role') || '').toUpperCase();
    if (!['SUPERADMIN', '99'].includes(role)) {
        window.location.href = 'admin.html';
        return;
    }

    document.getElementById('logout-btn')?.addEventListener('click', logout);
    document.getElementById('refresh-restaurants')?.addEventListener('click', loadRestaurants);
    document.getElementById('restaurant-form')?.addEventListener('submit', createRestaurant);
    document.getElementById('restaurant-name')?.addEventListener('input', syncSlugAndAdmin);
    loadRestaurants();
});

async function loadRestaurants() {
    const tbody = document.getElementById('restaurants-table');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Cargando...</td></tr>';

    try {
        const restaurants = await apiCall('/superadmin/restaurants');
        if (!restaurants.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Todavia no hay restaurantes.</td></tr>';
            return;
        }

        tbody.innerHTML = restaurants.map(r => {
            const orderUrl = absoluteFrontendUrl(r.publicOrderingUrl);
            return `
                <tr>
                    <td>
                        <strong>${escapeHtml(r.brandName || r.name)}</strong>
                        <small class="d-block text-muted">${escapeHtml(r.slug)}</small>
                    </td>
                    <td><span class="badge text-bg-dark">${escapeHtml(r.membershipPlan)}</span></td>
                    <td><span class="badge ${statusClass(r.membershipStatus)}">${escapeHtml(r.membershipStatus)}</span></td>
                    <td><code>tenants/${escapeHtml(r.tenantFolder)}/</code></td>
                    <td class="text-end">
                        <a class="btn btn-sm btn-outline-primary" href="${orderUrl}" target="_blank">
                            <i class="bi bi-box-arrow-up-right"></i>
                        </a>
                        <button class="btn btn-sm btn-outline-secondary" data-copy="${orderUrl}">
                            <i class="bi bi-copy"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('[data-copy]').forEach(btn => {
            btn.addEventListener('click', async () => {
                await navigator.clipboard.writeText(btn.dataset.copy);
                showToast('Link copiado.');
            });
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-4">${escapeHtml(error.message)}</td></tr>`;
    }
}

async function createRestaurant(event) {
    event.preventDefault();
    const btn = event.submitter;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creando...';

    const payload = {
        name: value('restaurant-name'),
        slug: value('restaurant-slug'),
        brandName: value('restaurant-name'),
        publicDescription: value('restaurant-description'),
        logoUrl: value('restaurant-logo'),
        primaryColor: value('restaurant-primary'),
        secondaryColor: '#f59e0b',
        accentColor: value('restaurant-accent'),
        billingEmail: value('restaurant-billing'),
        membershipPlan: value('restaurant-plan'),
        membershipStatus: value('restaurant-status'),
        publicOrderingEnabled: true,
        monthlyOrderLimit: Number(value('restaurant-limit') || 0),
        address: value('restaurant-address'),
        city: value('restaurant-city'),
        region: value('restaurant-city'),
        postalCode: 15000,
        country: 'UY',
        phone: Number(value('restaurant-phone') || 0),
        homePage: '',
        adminUsername: value('admin-username-input'),
        adminPassword: value('admin-password-input'),
        adminName: value('admin-name-input'),
        adminLastName: value('admin-lastname-input'),
        adminPhone: value('restaurant-phone')
    };

    try {
        const response = await apiCall('/superadmin/restaurants', 'POST', payload);
        showToast(`Restaurante creado: ${response.restaurant.brandName}`);
        event.target.reset();
        document.getElementById('restaurant-primary').value = '#111827';
        document.getElementById('restaurant-accent').value = '#10b981';
        await loadRestaurants();
    } catch (error) {
        showToast('Error al crear restaurante: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-building-add me-2"></i>Crear restaurante';
    }
}

function syncSlugAndAdmin() {
    const name = value('restaurant-name');
    const slug = slugify(name);
    const slugInput = document.getElementById('restaurant-slug');
    const adminInput = document.getElementById('admin-username-input');
    if (slugInput && !slugInput.dataset.touched) slugInput.value = slug;
    if (adminInput && !adminInput.value) adminInput.value = `${slug || 'resto'}_admin`;
}

function value(id) {
    return document.getElementById(id)?.value?.trim() || '';
}

function slugify(value) {
    return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function statusClass(status) {
    const s = String(status).toLowerCase();
    if (s === 'active') return 'text-bg-success';
    if (s === 'trial') return 'text-bg-primary';
    if (s === 'pastdue') return 'text-bg-warning';
    return 'text-bg-secondary';
}

function absoluteFrontendUrl(path) {
    if (!path) return '#';
    if (/^https?:\/\//i.test(path)) return path;
    return `${window.location.origin}/${path.replace(/^\//, '')}`;
}
