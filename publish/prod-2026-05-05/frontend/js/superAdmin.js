import { apiCall, uploadImage } from './apiService.js';
import { logout } from './auth.js';
import { escapeHtml, showToast } from './ui.js';

const MAX_IMAGE_SOURCE_BYTES = 15 * 1024 * 1024;
const TARGET_IMAGE_BYTES = 2.2 * 1024 * 1024;
const IMAGE_MAX_SIDE = 1600;

let restaurantsCache = [];
let selectedRestaurantLogoFile = null;

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
    document.getElementById('restaurant-slug')?.addEventListener('input', event => {
        event.currentTarget.dataset.touched = 'true';
    });
    document.getElementById('restaurant-search')?.addEventListener('input', renderRestaurants);
    document.getElementById('restaurant-status-filter')?.addEventListener('change', renderRestaurants);
    document.getElementById('restaurant-plan-filter')?.addEventListener('change', renderRestaurants);

    setupRestaurantLogoUploader();
    loadRestaurants();
});

async function loadRestaurants() {
    const container = document.getElementById('restaurants-list');
    if (container) container.innerHTML = '<div class="tenant-loading">Cargando restaurantes...</div>';

    try {
        restaurantsCache = await apiCall('/superadmin/restaurants');
        renderSummary(restaurantsCache);
        renderRestaurants();
    } catch (error) {
        if (container) {
            container.innerHTML = `<div class="tenant-loading text-danger">${escapeHtml(error.message)}</div>`;
        }
        showToast('No se pudo cargar el portfolio: ' + error.message, 'error');
    }
}

function renderSummary(restaurants) {
    const summary = document.getElementById('superadmin-summary');
    if (!summary) return;

    const totals = restaurants.reduce((acc, r) => {
        acc.ordersMonth += Number(r.ordersThisMonthCount || 0);
        acc.users += Number(r.totalUsersCount || 0);
        acc.s3Bytes += Number(r.s3UsageAvailable ? r.s3BytesUsed || 0 : 0);
        return acc;
    }, { ordersMonth: 0, users: 0, s3Bytes: 0 });

    summary.innerHTML = `
        <div><span>Locales</span><strong>${restaurants.length}</strong></div>
        <div><span>Pedidos mes</span><strong>${totals.ordersMonth}</strong></div>
        <div><span>Usuarios</span><strong>${totals.users}</strong></div>
        <div><span>S3 total</span><strong>${formatBytes(totals.s3Bytes)}</strong></div>
    `;
}

function renderRestaurants() {
    const container = document.getElementById('restaurants-list');
    const counter = document.getElementById('restaurants-count');
    if (!container) return;

    const search = value('restaurant-search').toLowerCase();
    const status = value('restaurant-status-filter');
    const plan = value('restaurant-plan-filter');

    const filtered = restaurantsCache.filter(r => {
        const handle = publicHandleFromRestaurant(r);
        const searchable = [
            r.name,
            r.brandName,
            r.slug,
            handle,
            r.fullAddress,
            r.billingEmail,
            r.membershipPlan,
            r.membershipStatus
        ].join(' ').toLowerCase();

        return (!search || searchable.includes(search))
            && (!status || r.membershipStatus === status)
            && (!plan || r.membershipPlan === plan);
    });

    if (counter) {
        counter.textContent = `${filtered.length} de ${restaurantsCache.length} restaurantes`;
    }

    if (!filtered.length) {
        container.innerHTML = '<div class="tenant-loading">No hay restaurantes para esos filtros.</div>';
        return;
    }

    container.innerHTML = filtered.map(renderRestaurantCard).join('');
    container.querySelectorAll('[data-copy]').forEach(btn => {
        btn.addEventListener('click', async () => {
            await navigator.clipboard.writeText(btn.dataset.copy);
            showToast('Link copiado.');
        });
    });
}

function renderRestaurantCard(r) {
    const handle = publicHandleFromRestaurant(r);
    const orderUrl = absoluteFrontendUrl(r.publicOrderingUrl);
    const profileUrl = absoluteFrontendUrl(`/customer.html?negocio=${encodeURIComponent(handle)}`);
    const adminUrl = absoluteFrontendUrl('/admin.html');
    const folder = `tenants/${r.tenantFolder || r.slug || handle}/`;
    const logo = r.logoUrl
        ? `<img src="${escapeHtml(r.logoUrl)}" alt="${escapeHtml(r.brandName || r.name)}">`
        : `<span>${escapeHtml(initials(r.brandName || r.name))}</span>`;
    const monthLimit = Number(r.monthlyOrderLimit || 0);
    const orderLimitLabel = monthLimit > 0
        ? `${Number(r.ordersThisMonthCount || 0).toLocaleString('es-UY')} / ${monthLimit.toLocaleString('es-UY')}`
        : `${Number(r.ordersThisMonthCount || 0).toLocaleString('es-UY')} / sin limite`;
    const s3Label = r.s3UsageAvailable
        ? `${r.s3BytesHuman || '0 B'} - ${Number(r.s3ObjectCount || 0)} obj.`
        : (r.s3BytesHuman || 'Sin lectura S3');

    return `
        <article class="tenant-card">
            <div class="tenant-card-top">
                <div class="tenant-brand">
                    <div class="tenant-logo" style="--tenant-primary:${escapeHtml(r.primaryColor || '#2854e8')};--tenant-secondary:${escapeHtml(r.accentColor || '#0f9f8c')};">${logo}</div>
                    <div>
                        <h3>${escapeHtml(r.brandName || r.name)}</h3>
                        <p>${escapeHtml(r.fullAddress || 'Sin direccion cargada')}</p>
                    </div>
                </div>
                <div class="tenant-badges">
                    <span class="tenant-badge">${escapeHtml(r.membershipPlan || 'Starter')}</span>
                    <span class="tenant-badge ${statusClass(r.membershipStatus)}">${escapeHtml(statusLabel(r.membershipStatus))}</span>
                </div>
            </div>

            <div class="tenant-metrics">
                ${metric('Usuarios', Number(r.totalUsersCount || 0), `${Number(r.internalUsersCount || 0)} staff - ${Number(r.customerUsersCount || 0)} clientes`)}
                ${metric('Pedidos mes', orderLimitLabel, `${Number(r.ordersCount || 0)} historicos`)}
                ${metric('Facturacion mes', formatMoney(r.revenueThisMonth), `${formatMoney(r.revenueTotal)} total`)}
                ${metric('Pedidos abiertos', Number(r.openOrdersCount || 0), `${Number(r.deliveredOrdersCount || 0)} entregados`)}
                ${metric('Catalogo', Number(r.productsCount || 0), `${Number(r.categoriesCount || 0)} categorias`)}
                ${metric('Datos', Number(r.dataRowsEstimate || 0), `${Number(r.mediaAssetsCount || 0)} imagenes - ${s3Label}`)}
            </div>

            <div class="tenant-links">
                <div>
                    <span>Carpeta S3</span>
                    <code>${escapeHtml(folder)}</code>
                </div>
                <div>
                    <span>Link carta cliente</span>
                    <code>${escapeHtml(orderUrl)}</code>
                </div>
                <div>
                    <span>Link perfil cliente</span>
                    <code>${escapeHtml(profileUrl)}</code>
                </div>
            </div>

            <div class="tenant-footer">
                <div class="tenant-dates">
                    <span>Creado ${formatDate(r.createdAt)}</span>
                    <span>Ultimo pedido ${formatDate(r.lastOrderAt)}</span>
                    <span>Trial ${formatDate(r.trialEndsAt)}</span>
                </div>
                <div class="tenant-actions">
                    <a class="btn btn-sm btn-outline-primary" href="${orderUrl}" target="_blank" rel="noopener">
                        <i class="bi bi-shop"></i> Carta
                    </a>
                    <a class="btn btn-sm btn-outline-secondary" href="${profileUrl}" target="_blank" rel="noopener">
                        <i class="bi bi-person-circle"></i> Perfil cliente
                    </a>
                    <a class="btn btn-sm btn-outline-secondary" href="${adminUrl}" target="_blank" rel="noopener">
                        <i class="bi bi-speedometer2"></i> Admin
                    </a>
                    <button class="btn btn-sm btn-outline-dark" data-copy="${escapeHtml(orderUrl)}" type="button">
                        <i class="bi bi-copy"></i>
                    </button>
                </div>
            </div>
        </article>
    `;
}

function metric(label, value, detail) {
    return `
        <div class="tenant-metric">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(String(value))}</strong>
            <small>${escapeHtml(detail)}</small>
        </div>
    `;
}

async function createRestaurant(event) {
    event.preventDefault();
    const btn = event.submitter;
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creando...';

    const slug = value('restaurant-slug') || slugify(value('restaurant-name'));
    let logoUrl = value('restaurant-logo');

    try {
        if (selectedRestaurantLogoFile) {
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Subiendo logo...';
            const uploaded = await uploadImage(selectedRestaurantLogoFile, 'brand/logo', { tenantFolder: slug });
            logoUrl = uploaded.url;
        }

        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creando...';
        const payload = {
            name: value('restaurant-name'),
            slug,
            brandName: value('restaurant-name'),
            publicDescription: value('restaurant-description'),
            logoUrl,
            primaryColor: value('restaurant-primary'),
            secondaryColor: value('restaurant-secondary') || '#f59e0b',
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

        const response = await apiCall('/superadmin/restaurants', 'POST', payload);
        showToast(`Restaurante creado: ${response.restaurant.brandName}`);
        event.target.reset();
        document.getElementById('restaurant-primary').value = '#111827';
        document.getElementById('restaurant-secondary').value = '#f59e0b';
        document.getElementById('restaurant-accent').value = '#10b981';
        resetRestaurantLogo();
        await loadRestaurants();
    } catch (error) {
        showToast('Error al crear restaurante: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

function setupRestaurantLogoUploader() {
    const dropzone = document.getElementById('restaurant-logo-dropzone');
    const input = document.getElementById('restaurant-logo-file');
    const preview = document.getElementById('restaurant-logo-preview');
    if (!dropzone || !input || !preview) return;

    const selectFile = async file => {
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            showToast('Usa una imagen JPG, PNG o WEBP.', 'warning');
            return;
        }
        if (file.size > MAX_IMAGE_SOURCE_BYTES) {
            showToast('La imagen es demasiado pesada. Usa una imagen de hasta 15 MB.', 'warning');
            return;
        }

        dropzone.classList.add('is-processing');
        try {
            selectedRestaurantLogoFile = await prepareImageForUpload(file);
            preview.innerHTML = `<img src="${URL.createObjectURL(selectedRestaurantLogoFile)}" alt="Preview logo">`;
        } catch {
            showToast('No se pudo procesar la imagen. Proba con otro archivo.', 'error');
        } finally {
            dropzone.classList.remove('is-processing');
        }
    };

    dropzone.addEventListener('click', () => input.click());
    input.addEventListener('change', e => { void selectFile(e.target.files?.[0]); });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, e => {
            e.preventDefault();
            dropzone.classList.add('is-dragging');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, e => {
            e.preventDefault();
            dropzone.classList.remove('is-dragging');
        });
    });

    dropzone.addEventListener('drop', e => { void selectFile(e.dataTransfer.files?.[0]); });
}

function resetRestaurantLogo() {
    selectedRestaurantLogoFile = null;
    const preview = document.getElementById('restaurant-logo-preview');
    const hidden = document.getElementById('restaurant-logo');
    const input = document.getElementById('restaurant-logo-file');
    if (preview) preview.innerHTML = '<i class="bi bi-cloud-arrow-up"></i>';
    if (hidden) hidden.value = '';
    if (input) input.value = '';
}

async function prepareImageForUpload(file) {
    const image = await loadImageFile(file);
    const maxSide = Math.max(image.naturalWidth, image.naturalHeight);
    const shouldResize = maxSide > IMAGE_MAX_SIDE;
    const shouldCompress = file.size > TARGET_IMAGE_BYTES || file.type === 'image/png';
    if (!shouldResize && !shouldCompress) return file;

    const scale = Math.min(1, IMAGE_MAX_SIDE / maxSide);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, width, height);

    let quality = 0.88;
    let blob = await canvasToBlob(canvas, 'image/webp', quality);
    while (blob.size > TARGET_IMAGE_BYTES && quality > 0.66) {
        quality -= 0.08;
        blob = await canvasToBlob(canvas, 'image/webp', quality);
    }

    const baseName = (file.name || 'logo')
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-z0-9_-]+/gi, '-')
        .replace(/^-|-$/g, '') || 'logo';
    return new File([blob], `${baseName}.webp`, { type: blob.type || 'image/webp', lastModified: Date.now() });
}

function loadImageFile(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Invalid image'));
        };
        image.src = url;
    });
}

function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas export failed'));
        }, type, quality);
    });
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
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function initials(value) {
    const parts = String(value || 'K')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    return (parts.map(p => p[0]).join('') || 'K').toUpperCase();
}

function statusClass(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'active') return 'is-active';
    if (s === 'trial') return 'is-trial';
    if (s === 'pastdue') return 'is-warning';
    if (s === 'paused') return 'is-muted';
    return 'is-muted';
}

function statusLabel(status) {
    const labels = {
        Active: 'Activo',
        Trial: 'Trial',
        PastDue: 'Pago pendiente',
        Paused: 'Pausado'
    };
    return labels[status] || status || 'Sin estado';
}

function absoluteFrontendUrl(path) {
    if (!path) return '#';
    if (/^https?:\/\//i.test(path)) return path;
    return `${window.location.origin}/${path.replace(/^\//, '')}`;
}

function publicHandleFromRestaurant(restaurant) {
    const fromUrl = publicHandleFromUrl(absoluteFrontendUrl(restaurant.publicOrderingUrl || ''));
    return fromUrl || slugify(restaurant.brandName || restaurant.name);
}

function publicHandleFromUrl(url) {
    try {
        const parsed = new URL(url, window.location.origin);
        return parsed.searchParams.get('negocio') || parsed.searchParams.get('tenant') || '';
    } catch {
        return '';
    }
}

function formatMoney(value) {
    return new Intl.NumberFormat('es-UY', {
        style: 'currency',
        currency: 'UYU',
        maximumFractionDigits: 0
    }).format(Number(value || 0));
}

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = Number(bytes || 0);
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}
