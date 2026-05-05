import { apiCall } from './apiService.js';
import { escapeHtml, showToast } from './ui.js';

const params = new URLSearchParams(window.location.search);
const tenantSlug = params.get('negocio') || params.get('tenant') || params.get('r') || localStorage.getItem('tenant_slug');

let tenant = null;
let categories = [];
let products = [];
let cart = [];
let customerToken = localStorage.getItem(`customer_token_${tenantSlug}`);
let customerProfile = null;
let customerAddresses = [];
let pendingVerificationEmail = '';
let authMode = 'login';
let addressMode = 'saved';

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
    document.getElementById('public-payment')?.addEventListener('change', renderPaymentHint);
    document.getElementById('checkout-login-btn')?.addEventListener('click', () => openCustomerGate('register'));
    document.getElementById('public-new-address-btn')?.addEventListener('click', () => setAddressMode('new'));
    document.getElementById('public-cancel-new-address-btn')?.addEventListener('click', () => setAddressMode('saved'));
    document.getElementById('public-address-select')?.addEventListener('change', renderAddressSummary);
    bindCustomerAccount();
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
        await loadCustomerSession();
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
    renderPaymentHint();
    const profileLink = document.getElementById('customer-profile-link');
    if (profileLink) profileLink.href = `customer.html?negocio=${encodeURIComponent(tenantSlug)}`;

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

    renderCheckoutState();
}

async function submitPublicOrder(event) {
    event.preventDefault();
    if (!cart.length) return showToast('Agregá al menos un producto.', 'warning');
    if (!customerProfile || !customerToken) {
        showToast('Crea tu cuenta o inicia sesion para confirmar el pedido.', 'warning');
        openCustomerGate('register');
        return;
    }

    const addressPayload = buildAddressPayload();
    if (!addressPayload) return;

    const button = event.submitter;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...';

    const payload = {
        ...addressPayload,
        paymentMethod: document.getElementById('public-payment').value,
        note: document.getElementById('public-note').value,
        items: cart.map(item => ({ productId: item.productId, quantity: item.quantity, observation: '' }))
    };

    try {
        const response = await apiCall(
            `/public/tenants/${encodeURIComponent(tenantSlug)}/orders`,
            'POST',
            payload,
            customerToken ? { token: customerToken } : {}
        );
        cart = [];
        renderCart();
        await loadCustomerAddresses();
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

function bindCustomerAccount() {
    document.getElementById('customer-login-toggle')?.addEventListener('click', () => {
        setAuthMode('login');
        showCustomerModal();
    });

    document.getElementById('customer-auth-switch')?.addEventListener('click', () => {
        setAuthMode(authMode === 'login' ? 'register' : 'login');
    });

    document.querySelectorAll('[data-auth-tab]').forEach(button => {
        button.addEventListener('click', () => setAuthMode(button.dataset.authTab));
    });

    document.getElementById('customer-login-form')?.addEventListener('submit', loginCustomer);
    document.getElementById('customer-register-form')?.addEventListener('submit', registerCustomer);
    document.getElementById('customer-verify-form')?.addEventListener('submit', verifyCustomer);
    document.getElementById('customer-resend-code')?.addEventListener('click', resendCustomerCode);
    document.getElementById('customer-logout-btn')?.addEventListener('click', logoutCustomer);
}

async function loadCustomerSession() {
    if (!customerToken) {
        renderCustomerState();
        renderCheckoutState();
        return;
    }

    try {
        customerProfile = await apiCall(`/public/tenants/${encodeURIComponent(tenantSlug)}/customers/me`, 'GET', null, { token: customerToken });
        await loadCustomerAddresses();
    } catch (error) {
        localStorage.removeItem(`customer_token_${tenantSlug}`);
        customerToken = null;
        customerProfile = null;
        customerAddresses = [];
    }

    renderCustomerState();
}

async function loginCustomer(event) {
    event.preventDefault();
    const button = event.submitter;
    setButtonBusy(button, true, 'Entrando...');

    try {
        const response = await apiCall(`/public/tenants/${encodeURIComponent(tenantSlug)}/customers/login`, 'POST', {
            email: document.getElementById('customer-login-email').value,
            password: document.getElementById('customer-login-password').value
        }, { skipAuth: true });

        if (response.requiresVerification) {
            pendingVerificationEmail = response.email;
            setAuthMode('verify');
            showToast('Te enviamos un codigo por email.');
        } else {
            setCustomerSession(response);
            showToast('Sesion iniciada.');
        }
    } catch (error) {
        showToast(error.message || 'No pudimos iniciar sesion.', 'error');
    } finally {
        setButtonBusy(button, false, 'Entrar');
    }
}

async function registerCustomer(event) {
    event.preventDefault();
    const button = event.submitter;
    const password = document.getElementById('customer-reg-password').value;
    const confirmPassword = document.getElementById('customer-reg-password-confirm')?.value;

    if (confirmPassword !== password) {
        showToast('Las contrasenas no coinciden.', 'warning');
        return;
    }

    setButtonBusy(button, true, 'Creando...');

    try {
        const response = await apiCall(`/public/tenants/${encodeURIComponent(tenantSlug)}/customers/register`, 'POST', {
            name: document.getElementById('customer-reg-name').value,
            lastName: document.getElementById('customer-reg-lastname').value,
            phone: document.getElementById('customer-reg-phone').value,
            email: document.getElementById('customer-reg-email').value,
            password
        }, { skipAuth: true });

        pendingVerificationEmail = response.email;
        setAuthMode('verify');
        showToast('Cuenta creada. Revisa tu email.');
    } catch (error) {
        showToast(error.message || 'No pudimos crear la cuenta.', 'error');
    } finally {
        setButtonBusy(button, false, 'Crear cuenta');
    }
}

async function verifyCustomer(event) {
    event.preventDefault();
    const button = event.submitter;
    setButtonBusy(button, true, 'Confirmando...');

    try {
        const response = await apiCall(`/public/tenants/${encodeURIComponent(tenantSlug)}/customers/verify`, 'POST', {
            email: pendingVerificationEmail || document.getElementById('customer-login-email').value || document.getElementById('customer-reg-email').value,
            code: document.getElementById('customer-code').value
        }, { skipAuth: true });
        setCustomerSession(response);
        showToast('Email confirmado.');
    } catch (error) {
        showToast(error.message || 'Codigo invalido.', 'error');
    } finally {
        setButtonBusy(button, false, 'Confirmar email');
    }
}

async function resendCustomerCode() {
    const email = pendingVerificationEmail || document.getElementById('customer-login-email').value || document.getElementById('customer-reg-email').value;
    if (!email) return showToast('Ingresa tu email primero.', 'warning');

    try {
        await apiCall(`/public/tenants/${encodeURIComponent(tenantSlug)}/customers/resend-code`, 'POST', { email }, { skipAuth: true });
        showToast('Codigo reenviado.');
    } catch (error) {
        showToast(error.message || 'No pudimos reenviar el codigo.', 'error');
    }
}

async function setCustomerSession(response) {
    customerToken = response.token;
    customerProfile = response.customer;
    localStorage.setItem(`customer_token_${tenantSlug}`, customerToken);
    try {
        await loadCustomerAddresses();
    } catch {
        customerAddresses = [];
    }
    renderCustomerState();
    hideCustomerModal();
}

function logoutCustomer() {
    localStorage.removeItem(`customer_token_${tenantSlug}`);
    customerToken = null;
    customerProfile = null;
    customerAddresses = [];
    renderCustomerState();
    showToast('Sesion cerrada.');
}

function renderCustomerState() {
    const sessionView = document.getElementById('customer-session-view');
    const authView = document.getElementById('customer-auth-view');
    const loginToggle = document.getElementById('customer-login-toggle');
    const profileLink = document.getElementById('customer-profile-link');
    const sessionName = document.getElementById('customer-session-name');

    if (customerProfile) {
        if (sessionView) sessionView.hidden = false;
        if (authView) authView.hidden = true;
        if (loginToggle) loginToggle.hidden = true;
        if (profileLink) profileLink.hidden = false;
        if (sessionName) sessionName.textContent = `${customerProfile.name} ${customerProfile.lastName || ''}`.trim();
    } else {
        if (sessionView) sessionView.hidden = true;
        if (authView) authView.hidden = false;
        if (loginToggle) loginToggle.hidden = false;
        if (profileLink) profileLink.hidden = true;
        setAuthMode(authMode);
    }

    renderCheckoutState();
}

function setAuthMode(mode) {
    authMode = mode;
    document.getElementById('customer-login-form').hidden = mode !== 'login';
    document.getElementById('customer-register-form').hidden = mode !== 'register';
    document.getElementById('customer-verify-form').hidden = mode !== 'verify';
    document.getElementById('customer-auth-title').textContent =
        mode === 'register' ? 'Crear cuenta cliente' : mode === 'verify' ? 'Confirmar email' : 'Entrar como cliente';

    const tabs = document.getElementById('customer-auth-tabs');
    if (tabs) tabs.hidden = mode === 'verify';
    document.querySelectorAll('[data-auth-tab]').forEach(button => {
        button.classList.toggle('active', button.dataset.authTab === mode);
    });

    const switchButton = document.getElementById('customer-auth-switch');
    if (switchButton) {
        switchButton.hidden = mode === 'verify';
        switchButton.textContent = mode === 'login' ? 'Crear cuenta' : 'Ya tengo cuenta';
    }
}

async function loadCustomerAddresses() {
    if (!customerToken) {
        customerAddresses = [];
        renderAddressOptions();
        return;
    }

    customerAddresses = await apiCall(
        `/public/tenants/${encodeURIComponent(tenantSlug)}/customers/me/addresses`,
        'GET',
        null,
        { token: customerToken }
    ) || [];
    if (!customerAddresses.length) addressMode = 'new';
    renderAddressOptions();
}

function renderCheckoutState() {
    const idle = document.getElementById('public-checkout-idle');
    const gate = document.getElementById('public-checkout-gate');
    const form = document.getElementById('public-order-form');

    if (!idle || !gate || !form) return;

    const hasItems = cart.length > 0;
    idle.hidden = hasItems;
    gate.hidden = !hasItems || !!customerProfile;
    form.hidden = !hasItems || !customerProfile;

    if (!customerProfile) return;

    const fullName = `${customerProfile.name || ''} ${customerProfile.lastName || ''}`.trim() || 'Cliente';
    const phone = customerProfile.phone ? `Telefono ${customerProfile.phone}` : 'Telefono verificado';
    const nameEl = document.getElementById('checkout-customer-name');
    const phoneEl = document.getElementById('checkout-customer-phone');
    const profileLink = document.getElementById('checkout-profile-link');

    if (nameEl) nameEl.textContent = fullName;
    if (phoneEl) phoneEl.textContent = phone;
    if (profileLink) profileLink.href = `customer.html?negocio=${encodeURIComponent(tenantSlug)}`;

    renderAddressOptions();
    renderPaymentHint();
}

function renderAddressOptions() {
    const select = document.getElementById('public-address-select');
    const savedBlock = document.getElementById('public-saved-address-block');
    const newBlock = document.getElementById('public-new-address-block');
    const cancelNew = document.getElementById('public-cancel-new-address-btn');
    const newButton = document.getElementById('public-new-address-btn');
    if (!select || !savedBlock || !newBlock) return;

    const hasAddresses = customerAddresses.length > 0;
    if (!hasAddresses) addressMode = 'new';

    const currentValue = select.value;
    savedBlock.hidden = addressMode !== 'saved' || !hasAddresses;
    newBlock.hidden = addressMode !== 'new';
    if (cancelNew) cancelNew.hidden = !hasAddresses;
    if (newButton) newButton.hidden = addressMode === 'new';

    select.innerHTML = customerAddresses
        .map(address => `<option value="${address.id}">${escapeHtml(formatAddress(address))}</option>`)
        .join('');

    if (hasAddresses) {
        const stillExists = customerAddresses.some(address => String(address.id) === currentValue);
        select.value = stillExists ? currentValue : String(customerAddresses[0].id);
    }
    renderAddressSummary();
}

function renderAddressSummary() {
    const summary = document.getElementById('public-address-summary');
    const selected = getSelectedAddress();
    if (!summary) return;
    summary.innerHTML = selected
        ? `<i class="bi bi-geo-alt me-1"></i>Se envia a ${escapeHtml(formatAddress(selected))}.`
        : '';
}

function setAddressMode(mode) {
    addressMode = mode === 'new' ? 'new' : 'saved';
    renderAddressOptions();
}

function getSelectedAddress() {
    const selectedId = Number(document.getElementById('public-address-select')?.value || 0);
    return customerAddresses.find(address => Number(address.id) === selectedId) || customerAddresses[0] || null;
}

function buildAddressPayload() {
    if (addressMode === 'saved' && customerAddresses.length) {
        const selected = getSelectedAddress();
        if (!selected) {
            showToast('Elegí una direccion de entrega.', 'warning');
            return null;
        }
        return { clientAddressId: selected.id };
    }

    const street = document.getElementById('public-street')?.value.trim();
    const city = document.getElementById('public-city')?.value.trim() || tenant?.city || '';
    const label = document.getElementById('public-address-label')?.value.trim() || 'Entrega';

    if (!street) {
        showToast('Ingresa la direccion de entrega.', 'warning');
        setAddressMode('new');
        document.getElementById('public-street')?.focus();
        return null;
    }

    return {
        street,
        city,
        addressLabel: label
    };
}

function formatAddress(address) {
    const label = address.label || 'Entrega';
    const street = address.street || '';
    const city = address.city ? `, ${address.city}` : '';
    return `${label}: ${street}${city}`;
}

function openCustomerGate(mode = 'login') {
    setAuthMode(mode);
    showCustomerModal();
}

function setButtonBusy(button, busy, text) {
    if (!button) return;
    button.disabled = busy;
    button.innerHTML = busy ? '<span class="spinner-border spinner-border-sm me-2"></span>' + text : text;
}

function showCustomerModal() {
    const modalEl = document.getElementById('customerAuthModal');
    if (!modalEl || !window.bootstrap) return;
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function hideCustomerModal() {
    const modalEl = document.getElementById('customerAuthModal');
    if (!modalEl || !window.bootstrap) return;
    bootstrap.Modal.getOrCreateInstance(modalEl).hide();
}

function renderPaymentHint() {
    const hint = document.getElementById('public-payment-hint');
    const payment = document.getElementById('public-payment')?.value || 'Cash';
    if (!hint) return;

    const phone = formatBranchPhone();
    const receiptText = phone
        ? `Despues de confirmar, envia el comprobante al ${phone}.`
        : 'Despues de confirmar, envia el comprobante al numero de la sucursal.';

    const messages = {
        Cash: { icon: 'bi-cash-coin', title: 'Pagas en efectivo al recibir.', text: 'El repartidor cobra cuando entrega el pedido.' },
        Pos: { icon: 'bi-credit-card-2-front', title: 'Te enviamos el POS.', text: 'Pagas con tarjeta cuando llega el pedido.' },
        MercadoPago: { icon: 'bi-phone', title: 'Pago por Mercado Pago.', text: receiptText },
        Transfer: { icon: 'bi-bank', title: 'Pago por transferencia.', text: receiptText }
    };

    const data = messages[payment] || messages.Cash;
    hint.innerHTML = `
        <i class="bi ${data.icon}"></i>
        <span><strong>${escapeHtml(data.title)}</strong> ${escapeHtml(data.text)}</span>
    `;
}

function formatBranchPhone() {
    const raw = String(tenant?.phone || '').replace(/\D/g, '');
    if (!raw) return '';
    if (raw.startsWith('598')) return `+${raw}`;
    return raw.length >= 8 ? `+598 ${raw}` : raw;
}

function renderError(message) {
    document.getElementById('public-product-grid').innerHTML = `
        <div class="col-12">
            <div class="alert alert-danger">${escapeHtml(message)}</div>
        </div>
    `;
}
