import { apiCall } from './apiService.js';
import { escapeHtml, showToast } from './ui.js';

const params = new URLSearchParams(window.location.search);
const tenantSlug = params.get('tenant') || params.get('r') || localStorage.getItem('tenant_slug');

let tenant = null;
let categories = [];
let products = [];
let cart = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!tenantSlug) {
        renderError('Falta el restaurante en el enlace.');
        return;
    }

    const lastTracking = localStorage.getItem(`last_tracking_${tenantSlug}`);
    const lastLink = document.getElementById('track-last-link');
    if (lastTracking && lastLink) {
        lastLink.href = `track.html?code=${encodeURIComponent(lastTracking)}`;
        lastLink.hidden = false;
    }

    document.getElementById('public-order-form')?.addEventListener('submit', submitPublicOrder);
    await loadPublicMenu();
});

async function loadPublicMenu() {
    try {
        tenant = await apiCall(`/public/tenants/${encodeURIComponent(tenantSlug)}`);
        const menu = await apiCall(`/public/tenants/${encodeURIComponent(tenantSlug)}/menu`);
        categories = menu.categories || [];
        products = menu.products || [];

        applyBranding();
        renderCategories();
        renderProducts();
        renderCart();
    } catch (error) {
        renderError(error.message || 'No pudimos cargar la carta.');
    }
}

function applyBranding() {
    const root = document.documentElement;
    root.style.setProperty('--tenant-primary', tenant.primaryColor || '#111827');
    root.style.setProperty('--tenant-secondary', tenant.secondaryColor || '#f59e0b');
    root.style.setProperty('--tenant-accent', tenant.accentColor || '#10b981');

    document.title = `${tenant.brandName || tenant.name} | Pedido online`;
    document.getElementById('tenant-name').textContent = tenant.brandName || tenant.name;
    document.getElementById('tenant-heading').textContent = tenant.brandName || tenant.name;
    document.getElementById('tenant-description').textContent = tenant.publicDescription || 'Hacé tu pedido y recibí el link de seguimiento al confirmar.';
    document.getElementById('tenant-subtitle').textContent = `${tenant.city || ''} Pedido online`.trim();
    document.getElementById('tenant-mark').textContent = (tenant.brandName || tenant.name || 'K').trim().charAt(0).toUpperCase();
    document.getElementById('public-city').value = tenant.city || '';

    const logo = document.getElementById('tenant-logo');
    if (tenant.logoUrl && logo) {
        logo.src = tenant.logoUrl;
        logo.hidden = false;
    }
}

function renderCategories() {
    const container = document.getElementById('public-category-filters');
    if (!container) return;

    container.innerHTML = [
        `<button class="btn btn-dark category-btn active" data-category="">Todo</button>`,
        ...categories.map(c => `<button class="btn btn-outline-dark category-btn" data-category="${c.id}">${escapeHtml(c.name)}</button>`)
    ].join('');

    container.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('button').forEach(b => b.classList.remove('active', 'btn-dark'));
            container.querySelectorAll('button').forEach(b => b.classList.add('btn-outline-dark'));
            btn.classList.add('active', 'btn-dark');
            btn.classList.remove('btn-outline-dark');
            renderProducts(btn.dataset.category ? Number(btn.dataset.category) : null);
        });
    });
}

function renderProducts(categoryId = null) {
    const grid = document.getElementById('public-product-grid');
    const visible = categoryId ? products.filter(p => p.categoryId === categoryId) : products;

    if (!visible.length) {
        grid.innerHTML = '<div class="col-12 text-center text-muted py-5">No hay productos disponibles.</div>';
        return;
    }

    grid.innerHTML = visible.map(p => `
        <div class="col-12 col-sm-6 col-xl-4">
            <article class="public-product-card">
                <div class="public-product-media">
                    ${p.imageUrl ? `<img src="${p.imageUrl}" alt="${escapeHtml(p.name)}">` : '<i class="bi bi-image"></i>'}
                </div>
                <div class="p-3">
                    <div class="d-flex justify-content-between gap-3">
                        <h3>${escapeHtml(p.name)}</h3>
                        <strong>$${Number(p.price || 0).toLocaleString('es-UY')}</strong>
                    </div>
                    <p>${escapeHtml(p.description || p.categoryName || 'Disponible')}</p>
                    <button class="btn btn-primary w-100" data-add="${p.id}">
                        <i class="bi bi-plus-lg me-2"></i>Agregar
                    </button>
                </div>
            </article>
        </div>
    `).join('');

    grid.querySelectorAll('[data-add]').forEach(btn => {
        btn.addEventListener('click', () => addToCart(Number(btn.dataset.add)));
    });
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existing = cart.find(item => item.productId === productId);
    if (existing) existing.quantity += 1;
    else cart.push({ productId, name: product.name, price: Number(product.price || 0), quantity: 1 });

    renderCart();
}

function renderCart() {
    const itemsEl = document.getElementById('public-cart-items');
    const emptyEl = document.getElementById('public-cart-empty');
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    document.getElementById('public-cart-count').textContent = count;
    document.getElementById('public-cart-total').textContent = `$${total.toLocaleString('es-UY')}`;
    emptyEl.classList.toggle('d-none', cart.length > 0);

    itemsEl.innerHTML = cart.map((item, index) => `
        <div class="public-cart-item">
            <div>
                <strong>${escapeHtml(item.name)}</strong>
                <small>$${item.price.toLocaleString('es-UY')} x ${item.quantity}</small>
            </div>
            <div class="d-flex align-items-center gap-2">
                <button class="btn btn-sm btn-outline-secondary" data-dec="${index}">-</button>
                <span>${item.quantity}</span>
                <button class="btn btn-sm btn-primary" data-inc="${index}">+</button>
            </div>
        </div>
    `).join('');

    itemsEl.querySelectorAll('[data-inc]').forEach(btn => btn.addEventListener('click', () => {
        cart[Number(btn.dataset.inc)].quantity += 1;
        renderCart();
    }));
    itemsEl.querySelectorAll('[data-dec]').forEach(btn => btn.addEventListener('click', () => {
        const item = cart[Number(btn.dataset.dec)];
        item.quantity -= 1;
        if (item.quantity <= 0) cart.splice(Number(btn.dataset.dec), 1);
        renderCart();
    }));
}

async function submitPublicOrder(event) {
    event.preventDefault();
    if (!cart.length) return showToast('Agregá al menos un producto.', 'warning');

    const button = event.submitter;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...';

    const payload = {
        customerName: document.getElementById('public-name').value,
        customerLastName: document.getElementById('public-lastname').value,
        customerPhone: document.getElementById('public-phone').value,
        street: document.getElementById('public-street').value,
        city: document.getElementById('public-city').value,
        paymentMethod: document.getElementById('public-payment').value,
        note: document.getElementById('public-note').value,
        items: cart.map(item => ({ productId: item.productId, quantity: item.quantity, observation: '' }))
    };

    try {
        const response = await apiCall(`/public/tenants/${encodeURIComponent(tenantSlug)}/orders`, 'POST', payload);
        cart = [];
        renderCart();
        localStorage.setItem(`last_tracking_${tenantSlug}`, response.tracking);

        const result = document.getElementById('public-order-result');
        result.classList.remove('d-none');
        result.innerHTML = `
            <strong>Pedido confirmado #${response.orderId}</strong>
            <div class="small mb-2">Guardá este enlace para seguirlo en vivo.</div>
            <a class="btn btn-success btn-sm w-100" href="${response.trackingUrl}">
                Ver seguimiento
            </a>
        `;
        showToast('Pedido recibido.');
    } catch (error) {
        showToast('No pudimos confirmar el pedido: ' + error.message, 'error');
    } finally {
        button.disabled = false;
        button.innerHTML = '<i class="bi bi-check2-circle me-2"></i>Confirmar pedido';
    }
}

function renderError(message) {
    document.getElementById('public-product-grid').innerHTML = `
        <div class="col-12">
            <div class="alert alert-danger">${escapeHtml(message)}</div>
        </div>
    `;
}
