import { apiCall, uploadImage } from './apiService.js';
import { logout } from './auth.js';
import { confirmAction, escapeHtml, promptInput, setButtonLoading, showToast } from './ui.js';

// ==========================================
// 🛠️ UTILIDADES (FECHA Y HORA)
// ==========================================
function formatFechaLocal(fechaString) {
    if (!fechaString) return '-';
    const fecha = new Date(fechaString);
    if (!fechaString.endsWith('Z') && !fechaString.includes('+')) {
        fecha.setHours(fecha.getHours() - 3);
    }
    return fecha.toLocaleTimeString('es-UY', {
        hour: '2-digit', minute: '2-digit', hour12: false
    });
}

function formatFechaCompleta(fechaString) {
    if (!fechaString) return '-';
    const fecha = new Date(fechaString);
    if (!fechaString.endsWith('Z') && !fechaString.includes('+')) {
        fecha.setHours(fecha.getHours() - 3);
    }
    return fecha.toLocaleString('es-UY', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false
    });
}

function renderTableSkeleton(tableBodyId, rows = 5, cols = 4) {
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) return;

    tbody.innerHTML = Array.from({ length: rows }, () => `
        <tr>
            ${Array.from({ length: cols }, (_, index) => `<td class="${index === 0 ? 'ps-4' : ''}"><div class="skeleton"></div></td>`).join('')}
        </tr>
    `).join('');
}

function formatMoney(value) {
    return `$${Number(value || 0).toLocaleString('es-UY', { maximumFractionDigits: 0 })}`;
}

function setMoney(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = formatMoney(value);
}

function sumBy(items, selector) {
    return (items || []).reduce((total, item) => {
        const raw = typeof selector === 'function' ? selector(item) : item?.[selector];
        return total + (Number(raw) || 0);
    }, 0);
}

function formatHourLabel(hour) {
    const value = Number(hour);
    const normalized = Number.isFinite(value) ? ((value % 24) + 24) % 24 : 0;
    return `${String(normalized).padStart(2, '0')}:00`;
}

function getOperatingWindows(settings = currentBranchSettings) {
    const windows = [];
    if (settings.dayShiftEnabled !== false) {
        windows.push({
            key: 'day',
            name: 'Dia',
            open: Number(settings.dayOpeningHour ?? settings.openingHour ?? 10),
            close: Number(settings.dayClosingHour ?? settings.closingHour ?? 16)
        });
    }
    if (settings.nightShiftEnabled !== false) {
        windows.push({
            key: 'night',
            name: 'Noche',
            open: Number(settings.nightOpeningHour ?? settings.openingHour ?? 21),
            close: Number(settings.nightClosingHour ?? settings.closingHour ?? 2)
        });
    }

    if (!windows.length) {
        windows.push({
            key: 'day',
            name: 'Dia',
            open: Number(settings.openingHour ?? 10),
            close: Number(settings.closingHour ?? 16)
        });
    }

    return windows;
}

function formatOperatingHoursLabel(settings = currentBranchSettings) {
    return getOperatingWindows(settings)
        .map(window => `${window.name} ${formatHourLabel(window.open)}-${formatHourLabel(window.close)}`)
        .join(' / ');
}

function getPrimaryOperatingWindow(settings = currentBranchSettings) {
    return getOperatingWindows(settings)[0];
}

function renderPagination(callbackName, page, totalPages) {
    const current = Number(page) || 1;
    const total = Number(totalPages) || 1;
    if (total <= 1) return '';

    const pageSet = new Set([1, current - 1, current, current + 1, total].filter(p => p >= 1 && p <= total));
    const pages = Array.from(pageSet).sort((a, b) => a - b);
    let last = 0;
    const buttons = pages.map(p => {
        const gap = last && p - last > 1 ? '<span class="pager-gap">...</span>' : '';
        last = p;
        return `${gap}<button type="button" class="${p === current ? 'is-active' : ''}" onclick="${callbackName}(${p})">${p}</button>`;
    }).join('');

    return `
        <button type="button" ${current <= 1 ? 'disabled' : ''} onclick="${callbackName}(${current - 1})"><i class="bi bi-chevron-left"></i></button>
        ${buttons}
        <button type="button" ${current >= total ? 'disabled' : ''} onclick="${callbackName}(${current + 1})"><i class="bi bi-chevron-right"></i></button>
    `;
}

// ==========================================
// 🏛️ ESTADO GLOBAL
// ==========================================
let allCategories = [], allProducts = [], allIngredients = [];
let allClients = [], allOrders = [];
let editingAddressId = null;
let isCreatingOrderContext = false;
let currentClientIdForAddress = null;
let currentProductIdForRecipe = null;
let currentOrderStatus = 'Pending';
let autoRefreshInterval = null;
let selectedProductImageFile = null;
let selectedIngredientImageFile = null;
let selectedLogoImageFile = null;
const MAX_IMAGE_SOURCE_BYTES = 15 * 1024 * 1024;
const TARGET_IMAGE_BYTES = 2.2 * 1024 * 1024;
const IMAGE_MAX_SIDE = 1600;
let currentBranchSettings = {
    openingHour: 18,
    closingHour: 2,
    dayShiftEnabled: true,
    dayOpeningHour: 10,
    dayClosingHour: 16,
    nightShiftEnabled: true,
    nightOpeningHour: 21,
    nightClosingHour: 2,
    timeZoneId: 'America/Montevideo'
};
let cashHistoryState = {
    page: 1,
    pageSize: 8,
    total: 0,
    totalPages: 1,
    search: ''
};
let clientDirectoryState = {
    page: 1,
    pageSize: 12,
    search: ''
};

let catModal, prodModal, stockModal, ingModal, recipeModal, clientModal, addressModal, orderDetailModal, clientOrdersModal;

// ==========================================
// 🚀 INICIALIZACIÓN (INIT ADMIN)
// ==========================================
export const initAdmin = async () => {
    console.log("⚙️ Iniciando Módulo Admin...");

    const rawRole = localStorage.getItem('user_role');
    const role = String(rawRole).toUpperCase();
    const allowedRoles = ['ADMIN', 'BRANCHMANAGER', 'KITCHEN', 'WAITER', 'DELIVERY', '1', '2', '3'];

    if (!allowedRoles.includes(role)) {
        console.warn("Acceso denegado. Rol detectado:", role);
        window.location.href = 'index.html';
        return;
    }

    const userName = localStorage.getItem('user_name');
    if (document.getElementById('admin-name')) {
        document.getElementById('admin-name').textContent = userName || 'Admin';
    }

    if (document.getElementById('logout-btn')) {
        document.getElementById('logout-btn').addEventListener('click', logout);
    }

    const allowedDriverRoles = ['DELIVERY', '3', 'WAITER', 'ADMIN', '1', 'BRANCHMANAGER', '2'];
    if (allowedDriverRoles.includes(role)) {
        const driverBtn = document.getElementById('btn-driver-mode');
        if (driverBtn) driverBtn.classList.remove('d-none');
    }

    if (['KITCHEN', '2', 'WAITER', '3', 'DELIVERY'].includes(role)) {
        const sidebar = document.getElementById('main-sidebar');
        if (sidebar) {
            const buttons = sidebar.querySelectorAll('button, a');
            buttons.forEach(btn => {
                const text = btn.innerText.toLowerCase();
                if (!text.includes('pedidos') && !text.includes('salir') && !text.includes('repartidor')) {
                    btn.classList.add('d-none');
                }
            });
        }
        if (window.switchTab) window.switchTab('orders');
    }

    const initModal = (id) => document.getElementById(id) ? new bootstrap.Modal(document.getElementById(id)) : null;
    catModal = initModal('categoryModal');
    prodModal = initModal('productModal');
    stockModal = initModal('stockModal');
    ingModal = initModal('ingredientModal');
    recipeModal = initModal('recipeModal');
    clientModal = initModal('clientModal');
    addressModal = initModal('addressModal');
    orderDetailModal = initModal('orderDetailModal');
    clientOrdersModal = initModal('clientOrdersModal');

    ensureAdminEnhancements();

    // EXPONER FUNCIONES
    window.prepareCategoryModal = (id = null) => { const f = document.getElementById('category-form'); if(f) f.reset(); document.getElementById('cat-id').value = id || ''; document.getElementById('catModalTitle').textContent = id ? 'Editar' : 'Nueva'; if(catModal) catModal.show(); };
    window.prepareProductModal = (id = null) => { const f = document.getElementById('product-form'); if(f) f.reset(); document.getElementById('prod-id').value = id || ''; document.getElementById('prodModalTitle').textContent = id ? 'Editar' : 'Nuevo'; updateCategorySelect(allCategories); resetProductImage(); if(prodModal) prodModal.show(); };
    window.prepareIngredientModal = (id = null) => { const f = document.getElementById('ingredient-form'); if(f) f.reset(); document.getElementById('ing-id').value = id || ''; document.getElementById('ingModalTitle').textContent = id ? 'Editar' : 'Nuevo'; resetIngredientImage(); if(ingModal) ingModal.show(); };
    
    window.editCategory = editCategory; window.deleteCategory = deleteCategory;
    window.editProduct = editProduct; window.deleteProduct = deleteProduct;
    window.prepareStockModal = prepareStockModal;
    window.editIngredient = editIngredient; window.deleteIngredient = deleteIngredient; window.renderIngredients = renderIngredients;

    window.openRecipeModal = openRecipeModal;
    window.addIngredientToRecipe = addIngredientToRecipe;
    window.removeIngredientFromRecipe = removeIngredientFromRecipe;

    window.loadClients = loadClients;
    window.prepareClientModal = prepareClientModal;
    window.openAddressModal = openAddressModal;
    window.editAddress = editAddress;
    window.deleteAddress = deleteAddress;

    window.viewClientOrders = viewClientOrders;
    window.updateOrderDateTime = updateOrderDateTime;
    window.loadOrders = loadOrders;
    window.openOrderDetailModal = openOrderDetailModal;
    window.loadGlobalData = loadGlobalData;
    window.filterOrders = filterOrders;
    window.cancelOrder = cancelOrder;
    window.loadDashboard = loadDashboard;
    window.startLiveUpdate = startLiveUpdate;
    window.loadBranchSettings = loadBranchSettings;
    window.saveBranchSettings = saveBranchSettings;

    window.toggleHistoryView = toggleHistoryView;
    window.loadPastSession = loadPastSession;
    window.initCashView = initCashView;
    window.confirmOpenRegister = confirmOpenRegister;
    window.confirmCloseRegister = confirmCloseRegister;
    window.prepareCloseRegister = prepareCloseRegister;
    window.openExpenseModal = openExpenseModal;
    window.changeCashHistoryPage = changeCashHistoryPage;
    window.changeClientDirectoryPage = changeClientDirectoryPage;

    window.openClientModalFromOrder = openClientModalFromOrder;
    window.selectClientForOrder = selectClientForOrder;
    window.clearClientSelection = clearClientSelection;

    setupClientSearch();
    setupBranchSettingsForm();
    setupCashHistorySearch();
    setupClientDirectorySearch();
    await loadBranchSettings(true);
    await loadGlobalData(); 
    setupForms();
    setupMediaUploaders();
    initCashView();

    if (typeof setupRoleViews === 'function') {
        setupRoleViews(role);
    }
    startLiveUpdate();
};

function startLiveUpdate() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(() => {
        const ordersView = document.getElementById('view-orders');
        if (ordersView && !ordersView.classList.contains('d-none')) {
            const isModalOpen = document.body.classList.contains('modal-open');
            if (!isModalOpen) {
                loadOrders().then(() => updateLastSyncLabel());
            }
        }
    }, 15000);
}

function updateLastSyncLabel() {
    const now = new Date();
    const label = document.getElementById('live-indicator');
    if (label) label.innerHTML = `<span class="spinner-grow spinner-grow-sm text-danger" role="status"></span> Actualizado: ${now.toLocaleTimeString()}`;
}

async function loadGlobalData() {
    try {
        const rawRole = localStorage.getItem('user_role');
        const role = String(rawRole).toUpperCase();

        if (['KITCHEN', '2', 'WAITER', 'DELIVERY', '3'].includes(role)) {
            loadOrders(); 
            return;
        }

        renderTableSkeleton('categories-table', 4, 3);
        renderTableSkeleton('products-table', 6, 5);
        renderTableSkeleton('ingredients-table', 5, 4);

        const [categories, products, ingredients, clients] = await Promise.all([
            apiCall('/Categories'),
            apiCall('/Products'),
            apiCall('/Ingredient'),
            apiCall('/Client')
        ]);

        allCategories = categories || [];
        allProducts = products || [];
        allIngredients = ingredients || [];
        allClients = clients || [];

        window.renderCategoriesTable();
        renderProducts();
        renderIngredients();

        updateIngredientSelect(allIngredients);
        updateCategorySelect(allCategories);

        loadOrders();
        try { await window.loadStock(); } catch(e){}

    } catch (error) {
        console.error("Aviso:", error);
    }
}

function ensureAdminEnhancements() {
    const nav = document.querySelector('#main-sidebar .list-group');
    if (nav && !document.getElementById('nav-settings')) {
        const settingsButton = document.createElement('button');
        settingsButton.id = 'nav-settings';
        settingsButton.className = 'list-group-item list-group-item-action border-0 rounded mb-1';
        settingsButton.setAttribute('onclick', "switchTab('settings')");
        settingsButton.innerHTML = '<i class="bi bi-sliders2-vertical me-2"></i> Configuracion local';
        const menuLink = nav.querySelector('a[href="menu.html"]');
        nav.insertBefore(settingsButton, menuLink || null);
    }

    enhanceDashboardView();
    enhanceCashView();
    enhanceClientsView();
    ensureSettingsView();
}

function enhanceDashboardView() {
    const view = document.getElementById('view-dashboard');
    if (!view || view.dataset.enhanced === 'true') return;
    view.dataset.enhanced = 'true';
    view.className = 'content-view fade-in d-none';
    view.innerHTML = `
        <div class="ops-page-head dashboard-head">
            <div>
                <span class="eyebrow">Centro operativo</span>
                <h1>Performance del local</h1>
                <p>Ventas, demanda, medios de pago y alertas operativas en una sola lectura.</p>
                <div class="ops-inline-meta">
                    <span><i class="bi bi-clock-history"></i> Horario: <b id="dash-operating-hours">Dia 10:00-16:00 / Noche 21:00-02:00</b></span>
                    <span><i class="bi bi-activity"></i> Datos en vivo</span>
                </div>
            </div>
            <div class="ops-toolbar">
                <label class="ops-date-field">
                    <span>Desde</span>
                    <input type="date" id="dash-date-start" class="form-control">
                </label>
                <label class="ops-date-field">
                    <span>Hasta</span>
                    <input type="date" id="dash-date-end" class="form-control">
                </label>
                <button class="btn btn-primary" onclick="loadDashboard()"><i class="bi bi-funnel me-1"></i>Filtrar</button>
                <button class="btn btn-outline-secondary" onclick="resetDashboardDate()"><i class="bi bi-calendar-check me-1"></i>Hoy</button>
            </div>
        </div>

        <div class="kpi-grid dashboard-kpis">
            <article class="kpi-card kpi-card--revenue">
                <span>Ventas del rango</span>
                <strong id="dash-today-revenue">$0</strong>
                <small>Ingreso confirmado por pedidos validos.</small>
            </article>
            <article class="kpi-card">
                <span>Pedidos</span>
                <strong id="dash-today-count">0</strong>
                <small>Total del periodo operativo elegido.</small>
            </article>
            <article class="kpi-card">
                <span>Ticket promedio</span>
                <strong id="dash-avg-ticket">$0</strong>
                <small>Valor medio por pedido.</small>
            </article>
            <article class="kpi-card">
                <span>Entrega promedio</span>
                <strong id="dash-avg-time">-</strong>
                <small>Desde confirmado hasta entregado.</small>
            </article>
            <article class="kpi-card kpi-card--warning">
                <span>Operacion activa</span>
                <strong id="dash-pending">0</strong>
                <small>Pedidos abiertos <span id="dash-low-stock">(Sin alertas)</span></small>
            </article>
        </div>

        <div class="analytics-grid">
            <section class="analytics-panel analytics-panel--wide">
                <div class="panel-title"><span><i class="bi bi-graph-up-arrow"></i> Evolucion de ventas</span></div>
                <div class="chart-shell chart-shell--lg"><canvas id="salesChart"></canvas></div>
            </section>
            <section class="analytics-panel">
                <div class="panel-title"><span><i class="bi bi-credit-card-2-front"></i> Mix de pago</span></div>
                <div class="chart-shell"><canvas id="paymentMixChart"></canvas></div>
            </section>
            <section class="analytics-panel">
                <div class="panel-title"><span><i class="bi bi-star"></i> Productos estrella</span></div>
                <div class="chart-shell"><canvas id="topProductsChart"></canvas></div>
            </section>
            <section class="analytics-panel">
                <div class="panel-title"><span><i class="bi bi-kanban"></i> Estado de pedidos</span></div>
                <div class="chart-shell"><canvas id="statusMixChart"></canvas></div>
            </section>
            <section class="analytics-panel analytics-panel--wide">
                <div class="panel-title"><span><i class="bi bi-clock"></i> Horas pico</span></div>
                <div class="chart-shell"><canvas id="peakHoursChart"></canvas></div>
            </section>
        </div>
    `;
}

function enhanceCashView() {
    const view = document.getElementById('view-cash');
    if (!view || view.dataset.enhanced === 'true') return;
    view.dataset.enhanced = 'true';
    view.innerHTML = `
        <div class="ops-page-head cash-head">
            <div>
                <span class="eyebrow">Caja diaria</span>
                <h1>Caja y movimientos</h1>
                <div class="ops-inline-meta">
                    <span id="cash-status-badge" class="status-pill status-pill--muted">Cerrada</span>
                    <span id="cash-open-time">Sin apertura activa</span>
                </div>
            </div>
            <div class="ops-toolbar">
                <button class="btn btn-outline-secondary" onclick="toggleHistoryView()"><i class="bi bi-clock-history me-1"></i>Historial</button>
                <div id="cash-actions" class="d-flex flex-wrap gap-2"></div>
            </div>
        </div>

        <div id="history-warning-banner" class="history-banner d-none">
            <span><i class="bi bi-eye-fill me-2"></i> Estas viendo un cierre pasado: <b id="hist-date-lbl"></b></span>
            <button class="btn btn-sm btn-outline-dark" onclick="initCashView()">Volver a caja actual</button>
        </div>

        <section class="cash-command-grid">
            <article class="cash-expected-card">
                <span>En caja teorico</span>
                <strong id="cash-expected">$0</strong>
                <p>Saldo inicial + efectivo + ingresos - egresos.</p>
            </article>
            <div class="cash-stat-grid">
                <article class="cash-stat"><span>Saldo inicial</span><strong id="cash-initial">$0</strong></article>
                <article class="cash-stat cash-stat--cash"><span>Efectivo</span><strong id="cash-total-cash">$0</strong></article>
                <article class="cash-stat cash-stat--mp"><span>MercadoPago</span><strong id="cash-total-mp">$0</strong></article>
                <article class="cash-stat cash-stat--transfer"><span>Transferencia</span><strong id="cash-total-transfer">$0</strong></article>
                <article class="cash-stat"><span>POS</span><strong id="cash-total-pos">$0</strong></article>
                <article class="cash-stat cash-stat--danger"><span>Gastos</span><strong id="cash-total-expenses">$0</strong></article>
            </div>
        </section>

        <section class="cash-lanes">
            <article class="cash-lane"><header><i class="bi bi-cash-coin"></i><span>Efectivo</span></header><ul id="list-cash"></ul></article>
            <article class="cash-lane"><header><i class="bi bi-phone"></i><span>MercadoPago</span></header><ul id="list-mp"></ul></article>
            <article class="cash-lane"><header><i class="bi bi-bank"></i><span>Transferencia</span></header><ul id="list-transfer"></ul></article>
            <article class="cash-lane"><header><i class="bi bi-credit-card"></i><span>POS</span></header><ul id="list-pos"></ul></article>
            <article class="cash-lane"><header><i class="bi bi-plus-circle"></i><span>Ingresos extra</span></header><ul id="list-incomes"></ul></article>
            <article class="cash-lane cash-lane--danger"><header><i class="bi bi-dash-circle"></i><span>Egresos</span><button class="btn btn-sm btn-light" onclick="openExpenseModal()">Nuevo</button></header><ul id="list-expenses"></ul></article>
        </section>

        <section id="cash-history-section" class="admin-panel d-none">
            <div class="panel-title">
                <span><i class="bi bi-archive"></i> Cajas cerradas</span>
                <button class="btn btn-sm btn-outline-secondary" onclick="toggleHistoryView()">Ocultar</button>
            </div>
            <div class="directory-toolbar">
                <div class="search-field">
                    <i class="bi bi-search"></i>
                    <input id="cash-history-search" type="search" placeholder="Buscar por numero de cierre o notas...">
                </div>
                <span class="directory-count" id="cash-history-count">0 cierres</span>
            </div>
            <div class="table-responsive">
                <table class="table admin-table align-middle mb-0">
                    <thead><tr><th>ID</th><th>Apertura</th><th>Cierre</th><th>Esperado</th><th>Final</th><th>Diferencia</th><th class="text-end">Accion</th></tr></thead>
                    <tbody id="cash-history-table"><tr><td colspan="7" class="text-center py-4">Cargando...</td></tr></tbody>
                </table>
            </div>
            <div class="directory-pagination" id="cash-history-pagination"></div>
        </section>
    `;
}

function enhanceClientsView() {
    const view = document.getElementById('view-clients');
    if (!view || view.dataset.enhanced === 'true') return;
    view.dataset.enhanced = 'true';
    view.innerHTML = `
        <div class="ops-page-head">
            <div>
                <span class="eyebrow">CRM del local</span>
                <h1>Clientes</h1>
                <p>Datos, direcciones y pedidos historicos organizados para operar rapido.</p>
            </div>
            <button class="btn btn-primary" onclick="prepareClientModal()"><i class="bi bi-person-plus-fill me-1"></i>Nuevo cliente</button>
        </div>
        <section class="admin-panel">
            <div class="directory-toolbar">
                <div class="search-field">
                    <i class="bi bi-search"></i>
                    <input id="client-directory-search" type="search" placeholder="Buscar por nombre, telefono o direccion...">
                </div>
                <span class="directory-count" id="client-directory-count">0 clientes</span>
            </div>
            <div class="client-card-grid" id="clients-grid"></div>
            <div class="directory-pagination" id="client-directory-pagination"></div>
            <table class="d-none"><tbody id="clients-table"></tbody></table>
        </section>
    `;
}

function ensureSettingsView() {
    const main = document.querySelector('.main-content > .p-4');
    if (!main || document.getElementById('view-settings')) return;

    main.insertAdjacentHTML('beforeend', `
        <div id="view-settings" class="content-view d-none">
            <div class="ops-page-head">
                <div>
                    <span class="eyebrow">Configuracion</span>
                    <h1>Configuracion del local</h1>
                    <p>Identidad publica, horario operativo y opciones de pedidos online.</p>
                </div>
                <a class="btn btn-outline-primary" id="settings-public-link" href="order.html" target="_blank">
                    <i class="bi bi-box-arrow-up-right me-1"></i>Ver carta publica
                </a>
            </div>
            <form id="branch-settings-form" class="settings-grid">
                <section class="admin-panel settings-panel">
                    <div class="panel-title"><span><i class="bi bi-shop"></i> Identidad del negocio</span></div>
                    <div class="row g-3">
                        <div class="col-md-6">
                            <label class="form-label" for="settings-brand-name">Nombre publico</label>
                            <input class="form-control" id="settings-brand-name" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label" for="settings-phone">Telefono de sucursal</label>
                            <input class="form-control" id="settings-phone" inputmode="numeric">
                        </div>
                        <div class="col-12">
                            <label class="form-label" for="settings-description">Descripcion en la carta</label>
                            <textarea class="form-control" id="settings-description" rows="3"></textarea>
                        </div>
                        <div class="col-12">
                            <label class="form-label" for="settings-logo-file">Logo del negocio</label>
                            <div class="image-uploader settings-logo-uploader" id="settings-logo-dropzone">
                                <input id="settings-logo-file" type="file" accept="image/jpeg,image/png,image/webp" hidden>
                                <div class="image-uploader__preview image-uploader__preview--logo" id="settings-logo-preview">
                                    <i class="bi bi-cloud-arrow-up fs-2"></i>
                                </div>
                                <div>
                                    <strong>Subir logo</strong>
                                    <small>Arrastra una imagen o hace click. JPG, PNG o WEBP hasta 5 MB.</small>
                                </div>
                            </div>
                            <input class="form-control mt-2" id="settings-logo-url" placeholder="URL generada automaticamente" readonly>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label" for="settings-primary-color">Color principal</label>
                            <input class="form-control form-control-color w-100" id="settings-primary-color" type="color">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label" for="settings-secondary-color">Color secundario</label>
                            <input class="form-control form-control-color w-100" id="settings-secondary-color" type="color">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label" for="settings-accent-color">Color acento</label>
                            <input class="form-control form-control-color w-100" id="settings-accent-color" type="color">
                        </div>
                    </div>
                </section>

                <section class="admin-panel settings-panel">
                    <div class="panel-title"><span><i class="bi bi-clock-history"></i> Horario operativo</span></div>
                    <div class="shift-settings">
                        <article class="shift-card">
                            <div class="settings-switch">
                                <div>
                                    <strong>Turno dia</strong>
                                    <span>Servicio de manana/tarde.</span>
                                </div>
                                <input class="form-check-input" id="settings-day-enabled" type="checkbox">
                            </div>
                            <div class="row g-3 mt-1">
                                <div class="col-6">
                                    <label class="form-label" for="settings-day-opening-hour">Apertura dia</label>
                                    <select class="form-select" id="settings-day-opening-hour"></select>
                                </div>
                                <div class="col-6">
                                    <label class="form-label" for="settings-day-closing-hour">Cierre dia</label>
                                    <select class="form-select" id="settings-day-closing-hour"></select>
                                </div>
                            </div>
                        </article>
                        <article class="shift-card">
                            <div class="settings-switch">
                                <div>
                                    <strong>Turno noche</strong>
                                    <span>Cena, delivery nocturno o madrugada.</span>
                                </div>
                                <input class="form-check-input" id="settings-night-enabled" type="checkbox">
                            </div>
                            <div class="row g-3 mt-1">
                                <div class="col-6">
                                    <label class="form-label" for="settings-night-opening-hour">Apertura noche</label>
                                    <select class="form-select" id="settings-night-opening-hour"></select>
                                </div>
                                <div class="col-6">
                                    <label class="form-label" for="settings-night-closing-hour">Cierre noche</label>
                                    <select class="form-select" id="settings-night-closing-hour"></select>
                                </div>
                            </div>
                        </article>
                        <div class="shift-summary">
                            <i class="bi bi-info-circle"></i>
                            <span id="settings-hours-summary">Dia 10:00-16:00 / Noche 21:00-02:00</span>
                        </div>
                    </div>
                    <div class="row g-3 mt-1">
                        <div class="col-12">
                            <label class="form-label" for="settings-timezone">Zona horaria</label>
                            <input class="form-control" id="settings-timezone" value="America/Montevideo">
                        </div>
                        <div class="col-12">
                            <div class="settings-switch">
                                <div>
                                    <strong>Pedidos online activos</strong>
                                    <span>Cuando esta apagado, la carta puede verse pero no deberia aceptar ventas nuevas.</span>
                                </div>
                                <input class="form-check-input" id="settings-public-enabled" type="checkbox">
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-primary w-100 mt-4" type="submit">
                        <i class="bi bi-check2-circle me-1"></i>Guardar configuracion
                    </button>
                </section>
            </form>
        </div>
    `);

    populateHourSelects();
}

function populateHourSelects() {
    [
        'settings-day-opening-hour',
        'settings-day-closing-hour',
        'settings-night-opening-hour',
        'settings-night-closing-hour'
    ].forEach(id => {
        const select = document.getElementById(id);
        if (!select || select.options.length) return;
        select.innerHTML = Array.from({ length: 24 }, (_, hour) => `<option value="${hour}">${String(hour).padStart(2, '0')}:00</option>`).join('');
    });
}

async function loadBranchSettings(silent = false) {
    try {
        const settings = await apiCall('/branch-settings');
        currentBranchSettings = {
            ...currentBranchSettings,
            ...settings
        };
        renderBranchSettingsForm(settings);
        updateOperationalLabels(settings);
        return settings;
    } catch (error) {
        if (!silent) showToast(error.message || 'No se pudo cargar la configuracion.', 'error');
        return currentBranchSettings;
    }
}

function renderBranchSettingsForm(settings) {
    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value ?? '';
    };

    setValue('settings-brand-name', settings.brandName || settings.name || '');
    setValue('settings-phone', settings.phone || '');
    setValue('settings-description', settings.publicDescription || '');
    resetLogoImage(settings.logoUrl || '');
    setValue('settings-primary-color', settings.primaryColor || '#111827');
    setValue('settings-secondary-color', settings.secondaryColor || '#f59e0b');
    setValue('settings-accent-color', settings.accentColor || '#10b981');
    setValue('settings-day-opening-hour', settings.dayOpeningHour ?? settings.openingHour ?? 10);
    setValue('settings-day-closing-hour', settings.dayClosingHour ?? settings.closingHour ?? 16);
    setValue('settings-night-opening-hour', settings.nightOpeningHour ?? 21);
    setValue('settings-night-closing-hour', settings.nightClosingHour ?? 2);
    setValue('settings-timezone', settings.timeZoneId || 'America/Montevideo');

    const dayEnabled = document.getElementById('settings-day-enabled');
    if (dayEnabled) dayEnabled.checked = settings.dayShiftEnabled !== false;

    const nightEnabled = document.getElementById('settings-night-enabled');
    if (nightEnabled) nightEnabled.checked = settings.nightShiftEnabled !== false;

    const enabled = document.getElementById('settings-public-enabled');
    if (enabled) enabled.checked = settings.publicOrderingEnabled !== false;

    const link = document.getElementById('settings-public-link');
    if (link && settings.publicOrderingUrl) link.href = settings.publicOrderingUrl;

    const summary = document.getElementById('settings-hours-summary');
    if (summary) summary.textContent = formatOperatingHoursLabel(settings);
}

function updateOperationalLabels(settings = currentBranchSettings) {
    const label = formatOperatingHoursLabel(settings);
    const dash = document.getElementById('dash-operating-hours');
    if (dash) dash.textContent = label;
}

function setupBranchSettingsForm() {
    const form = document.getElementById('branch-settings-form');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';
    form.addEventListener('submit', saveBranchSettings);
    form.addEventListener('change', () => {
        const draft = readScheduleDraft();
        const summary = document.getElementById('settings-hours-summary');
        if (summary) summary.textContent = formatOperatingHoursLabel(draft);
    });
}

function resetLogoImage(url = '') {
    selectedLogoImageFile = null;
    const hidden = document.getElementById('settings-logo-url');
    const preview = document.getElementById('settings-logo-preview');
    const input = document.getElementById('settings-logo-file');
    if (hidden) hidden.value = url;
    if (input) input.value = '';
    if (preview) preview.innerHTML = url ? `<img src="${url}" alt="Logo">` : '<i class="bi bi-cloud-arrow-up fs-2"></i>';
}

function readScheduleDraft() {
    const dayShiftEnabled = document.getElementById('settings-day-enabled')?.checked ?? true;
    const nightShiftEnabled = document.getElementById('settings-night-enabled')?.checked ?? true;
    const safeDayEnabled = dayShiftEnabled || !nightShiftEnabled;

    return {
        dayShiftEnabled: safeDayEnabled,
        dayOpeningHour: Number(document.getElementById('settings-day-opening-hour')?.value || 10),
        dayClosingHour: Number(document.getElementById('settings-day-closing-hour')?.value || 16),
        nightShiftEnabled,
        nightOpeningHour: Number(document.getElementById('settings-night-opening-hour')?.value || 21),
        nightClosingHour: Number(document.getElementById('settings-night-closing-hour')?.value || 2)
    };
}

async function saveBranchSettings(event) {
    event.preventDefault();
    const button = event.submitter;
    try {
        if (button) setButtonLoading(button, true, 'Guardando...');
        let logoUrl = document.getElementById('settings-logo-url')?.value.trim() || '';
        if (selectedLogoImageFile) {
            const uploaded = await uploadImage(selectedLogoImageFile, 'brand/logo');
            logoUrl = uploaded.url;
        }

        const payload = {
            ...currentBranchSettings,
            brandName: document.getElementById('settings-brand-name')?.value.trim(),
            publicDescription: document.getElementById('settings-description')?.value.trim(),
            logoUrl,
            primaryColor: document.getElementById('settings-primary-color')?.value,
            secondaryColor: document.getElementById('settings-secondary-color')?.value,
            accentColor: document.getElementById('settings-accent-color')?.value,
            phone: Number(String(document.getElementById('settings-phone')?.value || '').replace(/\D/g, '')) || 0,
            ...readScheduleDraft(),
            timeZoneId: document.getElementById('settings-timezone')?.value.trim() || 'America/Montevideo',
            publicOrderingEnabled: document.getElementById('settings-public-enabled')?.checked ?? true
        };
        const primaryWindow = getPrimaryOperatingWindow(payload);
        payload.openingHour = primaryWindow.open;
        payload.closingHour = primaryWindow.close;

        const updated = await apiCall('/branch-settings', 'PUT', payload);
        currentBranchSettings = { ...currentBranchSettings, ...updated };
        renderBranchSettingsForm(updated);
        updateOperationalLabels(updated);
        showToast('Configuracion del local actualizada.');
        await loadDashboard();
    } catch (error) {
        showToast(error.message || 'No se pudo guardar la configuracion.', 'error');
    } finally {
        if (button) setButtonLoading(button, false);
    }
}

// ==========================================
// 🔔 GESTIÓN DE PEDIDOS
// ==========================================
function filterOrders(status, btnElement) {
    currentOrderStatus = status;
    const container = document.getElementById('order-filters');
    if (container) {
        const buttons = container.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.classList.remove('btn-dark', 'text-white');
            btn.classList.add('btn-outline-secondary', 'border-0');
        });
        if (btnElement) {
            btnElement.classList.remove('btn-outline-secondary', 'border-0');
            btnElement.classList.add('btn-dark', 'text-white');
        }
    }
    loadOrders();
}

async function loadOrders() {
    const container = document.getElementById('orders-container');
    if (!container) return;

    try {
        const orders = await apiCall(`/Orders/status/${currentOrderStatus}`);
        allOrders = orders || [];

        if (currentOrderStatus === 'Delivered' || currentOrderStatus === 'Cancelled') {
            const today = new Date();
            allOrders = allOrders.filter(order => {
                const dateStr = order.orderDate || order.orderDateIso;
                if (!dateStr) return false;
                const d = new Date(dateStr);
                if (!dateStr.endsWith('Z')) d.setHours(d.getHours() - 3); 
                return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
            });
        }

        if (allOrders.length === 0) {
            const emptyMessage = (currentOrderStatus === 'Delivered') 
                ? "No hay pedidos entregados <strong>hoy</strong>." 
                : `No hay pedidos en estado: <strong>${translateStatus(currentOrderStatus)}</strong>.`;

            container.innerHTML = `
                <div class="col-12 text-center text-muted py-5">
                    <i class="bi bi-inbox fs-1 opacity-25"></i>
                    <p class="mt-2">${emptyMessage}</p>
                </div>`;
            return;
        }

        if (currentOrderStatus !== 'Delivered' && currentOrderStatus !== 'Cancelled') {
             allOrders.sort((a, b) => new Date(a.orderDate) - new Date(b.orderDate));
        } else {
             allOrders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate)); 
        }

        container.innerHTML = allOrders.map(order => createOrderCardHtml(order)).join('');
    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="col-12 text-center text-danger py-5">Error de conexión.</div>`;
    }
}

function createOrderCardHtml(order) {
    const timeString = formatFechaLocal(order.orderDate || order.orderDateIso);
    const statusColors = {
        'Pending': 'bg-warning text-dark', 'Confirmed': 'bg-info text-dark',
        'Cooking': 'bg-danger text-white', 'Ready': 'bg-success text-white',
        'Delivered': 'bg-secondary text-white', 'Cancelled': 'bg-dark text-white',
        'OnTheWay': 'bg-primary text-white'
    };
    const badgeClass = statusColors[order.currentStatus] || 'bg-secondary text-white';

    let actionButtonHtml = '';
    if (order.nextStatus && order.currentStatus !== 'Delivered' && order.currentStatus !== 'Cancelled') {
        actionButtonHtml = `
            <button class="btn btn-success btn-sm w-100 mb-2 advance-status-btn" 
                    onclick="updateOrderStatus(${order.id}, '${order.nextStatus}')">
                Avanzar a ${translateStatus(order.nextStatus)}
            </button>
        `;
    }

    const count = order.itemsCount !== undefined ? order.itemsCount : (order.ItemsCount || 0);
    const paymentLabel = order.paymentMethod ? ` | ${translatePaymentMethod(order.paymentMethod)}` : '';
    const trackingCode = order.trackingNumber || order.TrackingNumber || order.id;
    const trackLink = `${window.location.origin}/track.html?code=${trackingCode}`;
    const clientMsg = encodeURIComponent(`Sigue tu pedido #${order.id} en vivo aquí:\n${trackLink}`);
    const driverLink = `${window.location.origin}/driver.html?code=${trackingCode}`;
    const whatsappBtn = `
        <a href="https://wa.me/${order.clientPhone || ''}?text=${clientMsg}" target="_blank" class="btn btn-outline-success w-100 mt-2">
            <i class="bi bi-whatsapp"></i> Enviar a Cliente
        </a>
    `;

    return `
        <div class="col-12 col-md-6 col-xl-4 fade-in">
            <article class="card h-100 order-card" data-order-id="${order.id}">
                <div class="card-header border-0 d-flex justify-content-between align-items-start gap-3 pt-3">
                    <div>
                        <small class="text-muted fw-bold">ORDEN #${order.id}</small>
                        <div class="mt-1"><span class="badge ${badgeClass}">${translateStatus(order.currentStatus)}${paymentLabel}</span></div>
                    </div>
                    <span class="fw-bold fs-5 text-primary">$${Number(order.totalAmount || 0).toLocaleString('es-UY')}</span>
                </div>
                <div class="card-body">
                    <div class="order-meta">
                        <div class="order-meta__item">
                            <small class="text-muted d-block">Hora</small>
                            <strong>${timeString}</strong>
                        </div>
                        <div class="order-meta__item">
                            <small class="text-muted d-block">Items</small>
                            <strong>${count}</strong>
                        </div>
                    </div>
                </div>
                <div class="card-footer border-0 pb-3">
                    ${actionButtonHtml}
                    <div class="d-grid gap-2">
                        <button class="btn btn-outline-secondary" onclick="openOrderDetailModal(${order.id})">
                            <i class="bi bi-layout-text-sidebar-reverse me-1"></i>Ver detalle
                        </button>
                        ${whatsappBtn}
                    </div>
                </div>
            </article>
        </div>
    `;
}

async function updateOrderStatus(orderId, nextStatus) {
    const statusToInt = { 'Pending': 1, 'Confirmed': 2, 'Cooking': 3, 'Ready': 4, 'Delivered': 5, 'OnTheWay': 6, 'Cancelled': 0 };
    let statusToSend = (typeof nextStatus === 'string' && statusToInt[nextStatus] !== undefined) ? statusToInt[nextStatus] : parseInt(nextStatus);

    const card = document.querySelector(`.order-card[data-order-id="${orderId}"]`);
    const btn = card ? card.querySelector('.advance-status-btn') : null;
    let originalBtnText = "";
    if (btn) {
        originalBtnText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...';
    }

    try {
        await apiCall(`/Orders/${orderId}/status`, 'PUT', { newStatus: statusToSend, userId: 1 });
        await loadOrders(); 
        if (typeof currentlyTrackingId !== 'undefined' && currentlyTrackingId === orderId) {
             updateTrackingUI(orderId, translateStatus(statusToSend));
        }
    } catch (e) {
        showToast("Error al cambiar estado: " + e.message, 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = originalBtnText; }
    }
}

function translateStatus(status) {
    const map = { 'Pending': 'Pendiente', 'Confirmed': 'Confirmado', 'Cooking': 'En Cocina', 'Ready': 'Listo', 'OnTheWay': 'En Camino', 'Delivered': 'Entregado', 'Cancelled': 'Cancelado' };
    const mapNum = { 0: 'Cancelado', 1: 'Pendiente', 2: 'Confirmado', 3: 'En Cocina', 4: 'Listo', 5: 'Entregado', 6: 'En Camino' };
    return map[status] || mapNum[status] || status;
}

function translatePaymentMethod(method) {
    const map = { 'Cash': 'Efectivo', 'MercadoPago': 'MercadoPago', 'Transfer': 'Transferencia', 'Pos': 'POS' };
    return map[method] || method;
}

async function openOrderDetailModal(orderId) {
    const modalTitle = document.getElementById('detail-order-id');
    const modalBody = document.querySelector('#orderDetailModal .modal-body');
    if (modalTitle) modalTitle.textContent = `Cargando Pedido #${orderId}...`;
    if (modalBody) modalBody.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
    orderDetailModal.show();

    try {
        const order = await apiCall(`/Orders/${orderId}`);
        if (!order) throw new Error("No se encontraron datos.");

        if (modalTitle) modalTitle.textContent = `Pedido #${order.id}`;
        const status = order.status || order.currentStatus;
        const totalFinal = order.totalAmount;
        const globalDisc = order.discount || 0;
        const subtotal = totalFinal + globalDisc;
        const isCancellable = (status !== 'Delivered' && status !== 'Cancelled');

        const itemsHtml = (order.items || []).map(item => {
            let discountHtml = item.discount > 0 ? `<div class="badge bg-danger bg-opacity-10 text-danger ms-2">${Math.round((item.discount / (item.unitPrice * item.quantity)) * 100)}% OFF</div>` : '';
            return `<tr>
                <td><div class="fw-bold">${item.productName}</div>${item.observation ? `<div class="text-muted small fst-italic">${item.observation}</div>` : ''}</td>
                <td class="text-center fw-bold">${item.quantity}</td>
                <td class="text-end">$${item.unitPrice}${discountHtml}</td>
                <td class="text-end fw-bold text-primary">$${item.subtotal}</td>
            </tr>`;
        }).join('');

        modalBody.innerHTML = `
            <div class="alert alert-light border shadow-sm mb-4">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h5 class="fw-bold text-primary mb-0"><i class="bi bi-person-circle me-2"></i>${order.clientName || 'Cliente Casual'}</h5>
                    <span class="badge bg-primary">${translateStatus(status)}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center text-muted small">
                    <span><i class="bi bi-telephone-fill me-1"></i> ${order.clientPhone || 'Sin teléfono'}</span>
                    <span><i class="bi bi-calendar-event me-1"></i> ${formatFechaCompleta(order.orderDate)}</span>
                </div>
            </div>
            <div class="table-responsive rounded border mb-3">
                <table class="table mb-0 align-middle">
                    <thead class="bg-body-tertiary"><tr><th class="ps-3 border-0">Producto</th><th class="text-center border-0">Cant.</th><th class="text-end border-0">Unit.</th><th class="text-end pe-3 border-0">Subtotal</th></tr></thead>
                    <tbody>${itemsHtml || '<tr><td colspan="4" class="text-center">Sin ítems</td></tr>'}</tbody>
                </table>
            </div>
            <div class="border-top pt-3">
                <div class="d-flex justify-content-between align-items-center mb-1"><span class="text-muted">Forma de Pago:</span><span class="fw-bold">${translatePaymentMethod(order.paymentMethod || 'Cash')}</span></div>
                <div class="d-flex justify-content-end align-items-center mb-1"><span class="text-muted me-3">Subtotal:</span><span class="fw-bold">$${subtotal}</span></div>
                ${globalDisc > 0 ? `<div class="d-flex justify-content-end align-items-center mb-1 text-danger"><span class="me-3">Descuento Global:</span><span class="fw-bold">-$${globalDisc}</span></div>` : ''}
                <div class="d-flex justify-content-end align-items-center mt-2"><span class="fs-4 fw-bold text-body me-2">Total Final:</span><span class="fs-3 fw-bold text-primary">$${totalFinal}</span></div>
            </div>
            ${isCancellable ? `<div class="mt-4 pt-3 border-top"><button id="btn-cancel-dynamic" class="btn btn-outline-danger w-100" onclick="cancelOrder(${order.id})"><i class="bi bi-x-circle-fill"></i> Cancelar Pedido</button></div>` : ''}
        `;
    } catch (e) {
        if (modalBody) modalBody.innerHTML = `<div class="text-danger text-center py-4">Error: ${e.message}</div>`;
    }
}

async function cancelOrder(orderId) {
    const confirmed = await confirmAction('Seguro que quieres cancelar este pedido?', {
        title: 'Cancelar pedido',
        confirmLabel: 'Cancelar pedido',
        tone: 'danger'
    });
    if (!confirmed) return;
    const btn = document.getElementById('btn-cancel-dynamic');
    if (btn) { btn.disabled = true; btn.textContent = "Cancelando..."; }
    try {
        await apiCall(`/Orders/${orderId}/cancel`, 'POST');
        showToast('Pedido cancelado.');
        orderDetailModal.hide();
        loadGlobalData(); 
    } catch (e) {
        showToast(e.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = "Cancelar Pedido"; }
    }
}

// ==========================================
// 👥 CLIENTES
// ==========================================
async function loadClients() {
    const grid = document.getElementById('clients-grid');
    const tbody = document.getElementById('clients-table');
    if (grid) grid.innerHTML = '<div class="text-center text-muted py-5">Cargando clientes...</div>';
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center">Cargando...</td></tr>';
    try {
        let clients = await apiCall('/Client');
        const clientsWithAddress = await Promise.all((clients || []).map(async (c) => {
            try { return { ...c, addresses: await apiCall(`/Client/${c.id}/addresses`) || [] }; } 
            catch (e) { return { ...c, addresses: [] }; }
        }));
        allClients = clientsWithAddress;
        clientDirectoryState.page = 1;
        renderClientDirectory();
    } catch (e) {
        if (grid) grid.innerHTML = `<div class="text-danger text-center py-5">Error: ${escapeHtml(e.message)}</div>`;
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-danger text-center">Error: ${escapeHtml(e.message)}</td></tr>`;
    }
}

function renderClientDirectory() {
    const grid = document.getElementById('clients-grid');
    const count = document.getElementById('client-directory-count');
    const pager = document.getElementById('client-directory-pagination');
    if (!grid) return;

    const search = clientDirectoryState.search.trim().toLowerCase();
    const filtered = allClients.filter(c => {
        const fullName = `${c.name || ''} ${c.lastName || ''}`.toLowerCase();
        const phone = String(c.phone || '');
        const addresses = (c.addresses || []).map(a => `${a.label || ''} ${a.fullAddress || ''} ${a.street || ''} ${a.city || ''}`).join(' ').toLowerCase();
        return !search || fullName.includes(search) || phone.includes(search) || addresses.includes(search);
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / clientDirectoryState.pageSize));
    clientDirectoryState.page = Math.min(clientDirectoryState.page, totalPages);
    const start = (clientDirectoryState.page - 1) * clientDirectoryState.pageSize;
    const pageItems = filtered.slice(start, start + clientDirectoryState.pageSize);

    if (count) count.textContent = `${filtered.length} cliente${filtered.length === 1 ? '' : 's'}`;

    if (!pageItems.length) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-people"></i>
                <strong>No hay clientes para mostrar</strong>
                <span>Proba con otra busqueda o carga uno nuevo.</span>
            </div>`;
    } else {
        grid.innerHTML = pageItems.map(renderClientCard).join('');
    }

    if (pager) {
        pager.innerHTML = renderPagination('changeClientDirectoryPage', clientDirectoryState.page, totalPages);
    }
}

function renderClientCard(client) {
    const fullName = `${client.name || ''} ${client.lastName || ''}`.trim() || 'Cliente';
    const initials = fullName.split(/\s+/).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || 'C';
    const addresses = client.addresses || [];
    const addressHtml = addresses.length
        ? addresses.slice(0, 3).map(address => `
            <div class="client-address-row">
                <span title="${escapeHtml(address.fullAddress || address.street || '-')}"><i class="bi bi-geo-alt"></i><b>${escapeHtml(address.label || 'Entrega')}</b> ${escapeHtml(address.fullAddress || address.street || '-')}</span>
                <span class="client-address-actions">
                    <button type="button" onclick="editAddress(${client.id}, ${address.id})" title="Editar direccion"><i class="bi bi-pencil-square"></i></button>
                    <button type="button" onclick="deleteAddress(${client.id}, ${address.id})" title="Eliminar direccion"><i class="bi bi-x-circle"></i></button>
                </span>
            </div>`).join('')
        : '<div class="client-address-row client-address-row--empty">Sin direcciones guardadas</div>';

    return `
        <article class="client-card">
            <header>
                <span class="client-avatar">${escapeHtml(initials)}</span>
                <div>
                    <strong>${escapeHtml(fullName)}</strong>
                    <small>#${client.id} · ${escapeHtml(String(client.phone || 'Sin telefono'))}</small>
                </div>
            </header>
            <div class="client-address-list">${addressHtml}</div>
            <footer>
                <button class="btn btn-sm btn-outline-secondary" onclick="viewClientOrders(${client.id})"><i class="bi bi-journal-text me-1"></i>Pedidos</button>
                <button class="btn btn-sm btn-outline-primary" onclick="openAddressModal(${client.id})"><i class="bi bi-plus-lg me-1"></i>Direccion</button>
            </footer>
        </article>`;
}

function setupClientDirectorySearch() {
    const input = document.getElementById('client-directory-search');
    if (!input || input.dataset.bound === 'true') return;
    input.dataset.bound = 'true';
    input.addEventListener('input', event => {
        clientDirectoryState.search = event.target.value;
        clientDirectoryState.page = 1;
        renderClientDirectory();
    });
}

function changeClientDirectoryPage(page) {
    clientDirectoryState.page = Math.max(1, Number(page) || 1);
    renderClientDirectory();
}

function prepareClientModal() {
    document.getElementById('client-name').value = '';
    document.getElementById('client-lastname').value = '';
    document.getElementById('client-phone').value = '';
    const street = document.getElementById('client-addr-street'); if (street) street.value = '';
    const city = document.getElementById('client-addr-city'); if (city) city.value = 'Ciudad de la Costa';
    const label = document.getElementById('client-addr-label'); if (label) label.value = 'Casa';
    clientModal.show();
}

function openAddressModal(clientId) {
    currentClientIdForAddress = clientId; editingAddressId = null;
    document.getElementById('addr-client-id').value = clientId;
    document.getElementById('addr-street').value = '';
    document.getElementById('addr-city').value = 'Ciudad de la Costa';
    document.getElementById('addr-label').value = 'Casa';
    addressModal.show();
}

function editAddress(clientId, addressId) {
    const client = allClients.find(c => c.id === clientId);
    const addr = client ? client.addresses.find(a => a.id === addressId) : null;
    if (!addr) return;
    currentClientIdForAddress = clientId; editingAddressId = addressId;
    document.getElementById('addr-client-id').value = clientId;
    document.getElementById('addr-street').value = addr.street || (addr.fullAddress ? addr.fullAddress.split(',')[0] : '');
    document.getElementById('addr-city').value = addr.city || 'Ciudad de la Costa';
    document.getElementById('addr-label').value = addr.label || 'Casa';
    addressModal.show();
}

async function deleteAddress(clientId, addressId) {
    if (!await confirmAction('Borrar esta direccion?', { title: 'Eliminar direccion' })) return;
    try { await apiCall(`/Client/address/${addressId}`, 'DELETE'); await loadClients(); } catch (e) { showToast(e.message, 'error'); }
}

async function viewClientOrders(clientId) {
    const client = allClients.find(c => c.id === clientId);
    if (document.getElementById('clientOrdersTitle')) document.getElementById('clientOrdersTitle').textContent = `Pedidos de ${client.name} ${client.lastName}`;
    const tbody = document.getElementById('client-orders-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Buscando pedidos...</td></tr>';
    clientOrdersModal.show();

    try {
        const orders = await apiCall(`/Orders/client/${clientId}`);
        if (!orders || orders.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Este cliente no tiene pedidos.</td></tr>'; return; }
        orders.sort((a, b) => b.id - a.id);
        tbody.innerHTML = orders.map(o => {
            const d = new Date(o.orderDate || o.orderDateIso);
            if (!(o.orderDate || o.orderDateIso).endsWith('Z')) d.setHours(d.getHours() - 3);
            const formattedDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            return `<tr><td class="align-middle fw-bold">#${o.id}</td><td class="align-middle"><input type="datetime-local" class="form-control form-control-sm" id="date-order-${o.id}" value="${formattedDate}"></td><td class="align-middle"><span class="badge bg-secondary">${translateStatus(o.currentStatus)}</span></td><td class="align-middle fw-bold">$${o.totalAmount}</td><td class="text-end align-middle"><button class="btn btn-sm btn-primary" onclick="updateOrderDateTime(${o.id})">Guardar</button></td></tr>`;
        }).join('');
    } catch (e) { tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">Error: ${e.message}</td></tr>`; }
}

async function updateOrderDateTime(orderId) {
    const input = document.getElementById(`date-order-${orderId}`);
    if (!input || !input.value) return showToast('Selecciona una fecha valida.', 'warning');
    try { await apiCall(`/Orders/${orderId}/date`, 'PUT', { newDate: input.value }); showToast('Fecha actualizada.'); if (window.loadDashboard) window.loadDashboard(); } catch (e) { showToast(e.message, 'error'); }
}

// ==========================================
// 📦 STOCK
// ==========================================
window.loadStock = async function() {
    const tbody = document.getElementById('stock-table');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-3">Cargando inventario...</td></tr>`;
    try {
        if (!allIngredients || allIngredients.length === 0) allIngredients = await apiCall('/Ingredient') || [];
        const data = await apiCall('/stock'); 
        const validItems = (data || []).filter(item => allIngredients.some(ing => ing.id === item.ingredientId));
        if (validItems.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">El inventario está vacío.</td></tr>`; return; }
        renderStockTable(validItems);
    } catch (e) { tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Error al cargar stock.</td></tr>`; }
};

function renderStockTable(stockItems) {
    const tbody = document.getElementById('stock-table');
    tbody.innerHTML = stockItems.map(item => {
        const ing = allIngredients.find(x => x.id === item.ingredientId);
        if (!ing) return '';
        const min = item.minimumStockAlert || 0;
        const isLow = item.currentStock < min;
        return `<tr><td class="ps-4 fw-medium">${ing.name}</td><td>${ing.unitOfMeasure}</td><td class="fw-bold ${isLow ? 'text-danger' : ''}">${item.currentStock}</td><td>${min}</td><td>${isLow ? '<span class="badge bg-danger">BAJO</span>' : '<span class="badge bg-success">OK</span>'}</td><td class="text-end pe-4"><button class="btn btn-sm btn-outline-primary" onclick="prepareStockModal(${item.ingredientId})">Ajustar</button></td></tr>`;
    }).join('');
}

function prepareStockModal(ingId = null) {
    document.getElementById('stock-quantity').value = '';
    document.getElementById('stock-min').value = '';
    document.getElementById('stock-type').value = '';
    if (ingId) document.getElementById('stock-ingredient-id').value = ingId;
    stockModal.show();
}

// ==========================================
// 🍔 PRODUCTOS Y RECETAS
// ==========================================
async function openRecipeModal(pid) {
    currentProductIdForRecipe = pid;
    const p = allProducts.find(x => x.id === pid);
    document.getElementById('recipeModalTitle').textContent = `Receta: ${p ? p.name : ''}`;
    const s = document.getElementById('recipe-ingredient-select');
    if (s) s.innerHTML = '<option value="">Selecciona...</option>' + allIngredients.map(i => `<option value="${i.id}">${i.name} (${i.unitOfMeasure})</option>`).join('');
    await loadRecipeItems(pid);
    recipeModal.show();
}

async function loadRecipeItems(pid) {
    const tb = document.getElementById('recipe-table-body');
    if (!tb) return;
    tb.innerHTML = '<tr><td colspan="3" class="text-center py-3">Cargando...</td></tr>';
    try {
        const items = await apiCall(`/ProductIngredient/product/${pid}`);
        if (!items || !items.length) { tb.innerHTML = '<tr><td colspan="3" class="text-muted text-center py-3">Sin ingredientes.</td></tr>'; return; }
        tb.innerHTML = items.map(i => `<tr><td class="align-middle">${i.ingredientName || "Ingrediente"}</td><td class="fw-bold align-middle">${i.quantity} ${i.unit || ''}</td><td class="text-end align-middle"><button class="btn btn-sm btn-outline-danger" onclick="removeIngredientFromRecipe(${pid}, ${i.ingredientId})" title="Eliminar"><i class="bi bi-trash"></i></button></td></tr>`).join('');
    } catch (e) { tb.innerHTML = '<tr><td colspan="3" class="text-danger text-center">Error al cargar receta.</td></tr>'; }
}

async function addIngredientToRecipe() {
    const iId = parseInt(document.getElementById('recipe-ingredient-select').value), qty = parseFloat(document.getElementById('recipe-quantity').value);
    if (!iId || !qty) return showToast('Datos invalidos.', 'warning');
    try { await apiCall('/ProductIngredient', 'POST', { productId: currentProductIdForRecipe, ingredientId: iId, quantity: qty }); document.getElementById('recipe-quantity').value = ''; await loadRecipeItems(currentProductIdForRecipe); } catch (e) { showToast(e.message, 'error'); }
}

async function removeIngredientFromRecipe(productId, ingredientId) {
    if (!await confirmAction('Quitar ingrediente de la receta?', { title: 'Editar receta', tone: 'warning' })) return;
    try { await apiCall(`/ProductIngredient/product/${productId}/ingredient/${ingredientId}`, 'DELETE'); await loadRecipeItems(productId); } catch (e) { showToast(e.message, 'error'); }
}

// ==========================================
// 🏗️ ABMs
// ==========================================
window.renderCategoriesTable = () => { const tb = document.getElementById('categories-table'); if (tb) tb.innerHTML = allCategories.map(c => `<tr><td class="ps-4 fw-bold">${c.name}</td><td class="small">${c.description || '-'}</td><td class="text-end pe-4"><button class="btn btn-sm text-primary" onclick="editCategory(${c.id})"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm text-danger" onclick="deleteCategory(${c.id})"><i class="bi bi-trash"></i></button></td></tr>`).join(''); };
function editCategory(id) { const c = allCategories.find(x => x.id === id); if (c) { window.prepareCategoryModal(id); document.getElementById('cat-name').value = c.name; document.getElementById('cat-desc').value = c.description; catModal.show(); } }
async function deleteCategory(id) { if (!await confirmAction('Eliminar categoria?', { title: 'Eliminar categoria' })) return; try { await apiCall(`/Categories/${id}`, 'DELETE'); await loadGlobalData(); showToast('Categoria eliminada.'); } catch (e) { showToast(e.message, 'error'); } }
function renderProducts() {
    const tb = document.getElementById('products-table');
    if (!tb) return;

    tb.innerHTML = allProducts.map(p => {
        const cName = allCategories.find(c => c.id == p.categoryId)?.name || '-';
        const img = p.imageUrl
            ? `<img src="${p.imageUrl}" alt="${escapeHtml(p.name)}">`
            : '<i class="bi bi-image text-muted"></i>';

        return `
            <tr>
                <td class="ps-4"><div class="table-thumb">${img}</div></td>
                <td><div class="fw-bold">${escapeHtml(p.name)}</div><div class="small text-muted text-truncate table-desc">${escapeHtml(p.description || '')}</div></td>
                <td><span class="badge rounded-pill badge-soft">${escapeHtml(cName)}</span></td>
                <td class="fw-bold text-success">$${Number(p.price || 0).toLocaleString('es-UY')}</td>
                <td class="text-end pe-4">
                    <button class="btn btn-icon" onclick="openRecipeModal(${p.id})" title="Receta"><i class="bi bi-list-check"></i></button>
                    <button class="btn btn-icon text-primary" onclick="editProduct(${p.id})" title="Editar"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-icon text-danger" onclick="deleteProduct(${p.id})" title="Eliminar"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
    }).join('');
}
function editProduct(id) {
    const p = allProducts.find(x => x.id === id);
    if (!p) return;

    window.prepareProductModal(id);
    document.getElementById('prod-name').value = p.name || '';
    document.getElementById('prod-price').value = p.price || 0;
    document.getElementById('prod-desc').value = p.description || '';
    document.getElementById('prod-category').value = p.categoryId;
    resetProductImage(p.imageUrl || '');
    prodModal.show();
}
async function deleteProduct(id) { if (!await confirmAction('Eliminar producto?', { title: 'Eliminar producto' })) return; try { await apiCall(`/Products/${id}`, 'DELETE'); await loadGlobalData(); showToast('Producto eliminado.'); } catch (e) { showToast(e.message, 'error'); } }
function renderIngredients() {
    const tb = document.getElementById('ingredients-table');
    if (!tb) return;

    tb.innerHTML = allIngredients.map(i => {
        const img = i.imageUrl
            ? `<img src="${i.imageUrl}" alt="${escapeHtml(i.name)}">`
            : '<i class="bi bi-image text-muted"></i>';

        return `
            <tr>
                <td class="ps-4"><div class="table-thumb">${img}</div></td>
                <td class="fw-bold">${escapeHtml(i.name)}</td>
                <td>${escapeHtml(i.unitOfMeasure || i.unit || '')}</td>
                <td class="text-end pe-4">
                    <button class="btn btn-icon text-primary" onclick="editIngredient(${i.id})" title="Editar"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-icon text-danger" onclick="deleteIngredient(${i.id})" title="Eliminar"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
    }).join('');
}
function editIngredient(id) {
    const i = allIngredients.find(x => x.id === id);
    if (!i) return;

    window.prepareIngredientModal(id);
    document.getElementById('ing-name').value = i.name || '';
    document.getElementById('ing-unit').value = i.unitOfMeasure || i.unit || '';
    resetIngredientImage(i.imageUrl || '');
    ingModal.show();
}
async function deleteIngredient(id) { if (!await confirmAction('Eliminar ingrediente?', { title: 'Eliminar ingrediente' })) return; try { await apiCall(`/Ingredient/${id}`, 'DELETE'); await loadGlobalData(); showToast('Ingrediente eliminado.'); } catch (e) { showToast(e.message, 'error'); } }
function updateIngredientSelect(l) { const el = document.getElementById('stock-ingredient-id'); if (el) el.innerHTML = '<option value="">Selecciona...</option>' + l.map(i => `<option value="${i.id}">${i.name}</option>`).join(''); }
function updateCategorySelect(l) { const el = document.getElementById('prod-category'); if (el) el.innerHTML = '<option value="">Selecciona...</option>' + l.map(c => `<option value="${c.id}">${c.name}</option>`).join(''); }

function setupMediaUploaders() {
    setupImageUploader({
        dropzoneId: 'settings-logo-dropzone',
        inputId: 'settings-logo-file',
        previewId: 'settings-logo-preview',
        assignFile: file => selectedLogoImageFile = file
    });

    setupImageUploader({
        dropzoneId: 'prod-image-dropzone',
        inputId: 'prod-image-file',
        previewId: 'prod-image-preview',
        assignFile: file => selectedProductImageFile = file
    });

    setupImageUploader({
        dropzoneId: 'ing-image-dropzone',
        inputId: 'ing-image-file',
        previewId: 'ing-image-preview',
        assignFile: file => selectedIngredientImageFile = file
    });
}

function setupImageUploader({ dropzoneId, inputId, previewId, assignFile }) {
    const dropzone = document.getElementById(dropzoneId);
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
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
            const preparedFile = await prepareImageForUpload(file);
            assignFile(preparedFile);
            preview.innerHTML = `<img src="${URL.createObjectURL(preparedFile)}" alt="Preview">`;
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

async function prepareImageForUpload(file) {
    const image = await loadImageFile(file);
    const shouldResize = image.naturalWidth > IMAGE_MAX_SIDE || image.naturalHeight > IMAGE_MAX_SIDE;
    const shouldCompress = file.size > TARGET_IMAGE_BYTES || file.type === 'image/png';
    if (!shouldResize && !shouldCompress) return file;

    const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
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

    const baseName = (file.name || 'image').replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'image';
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
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas export failed')), type, quality);
    });
}

function resetProductImage(url = '') {
    selectedProductImageFile = null;
    const hidden = document.getElementById('prod-img');
    const preview = document.getElementById('prod-image-preview');
    const input = document.getElementById('prod-image-file');
    if (hidden) hidden.value = url;
    if (input) input.value = '';
    if (preview) preview.innerHTML = url ? `<img src="${url}" alt="Preview">` : '<i class="bi bi-cloud-arrow-up fs-2"></i>';
}

function resetIngredientImage(url = '') {
    selectedIngredientImageFile = null;
    const hidden = document.getElementById('ing-img');
    const preview = document.getElementById('ing-image-preview');
    const input = document.getElementById('ing-image-file');
    if (hidden) hidden.value = url;
    if (input) input.value = '';
    if (preview) preview.innerHTML = url ? `<img src="${url}" alt="Preview">` : '<i class="bi bi-cloud-arrow-up fs-2"></i>';
}

// ==========================================
// 📝 CONFIGURACIÓN DE FORMULARIOS
// ==========================================
function setupForms() {
    const setup = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('submit', fn); };
    
    setup('category-form', async (e) => { e.preventDefault(); const id = document.getElementById('cat-id').value; const button = e.submitter; try { setButtonLoading(button, true); await apiCall(id ? `/Categories/${id}` : '/Categories', id ? 'PUT' : 'POST', { id: id ? parseInt(id) : 0, name: document.getElementById('cat-name').value.trim(), description: document.getElementById('cat-desc').value.trim(), branchId: 0 }); catModal.hide(); await loadGlobalData(); showToast(id ? 'Categoria actualizada.' : 'Categoria creada.'); } catch (err) { showToast(err.message, 'error'); } finally { setButtonLoading(button, false); } });
    setup('product-form', async (e) => {
        e.preventDefault();
        const id = document.getElementById('prod-id').value;
        const button = e.submitter;

        try {
            setButtonLoading(button, true);
            let imageUrl = document.getElementById('prod-img').value;

            if (selectedProductImageFile) {
                const uploaded = await uploadImage(selectedProductImageFile, 'products');
                imageUrl = uploaded.url;
            }

            await apiCall(id ? `/Products/${id}` : '/Products', id ? 'PUT' : 'POST', {
                id: id ? parseInt(id) : 0,
                name: document.getElementById('prod-name').value.trim(),
                description: document.getElementById('prod-desc').value.trim(),
                price: parseFloat(document.getElementById('prod-price').value),
                imageUrl,
                categoryId: parseInt(document.getElementById('prod-category').value),
                isActive: true,
                branchId: 0
            });

            prodModal.hide();
            await loadGlobalData();
            showToast(id ? 'Producto actualizado.' : 'Producto creado.');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setButtonLoading(button, false);
        }
    });
    setup('ingredient-form', async (e) => {
        e.preventDefault();
        const id = document.getElementById('ing-id').value;
        const button = e.submitter;

        try {
            setButtonLoading(button, true);
            let imageUrl = document.getElementById('ing-img').value;

            if (selectedIngredientImageFile) {
                const uploaded = await uploadImage(selectedIngredientImageFile, 'ingredients');
                imageUrl = uploaded.url;
            }

            await apiCall(id ? `/Ingredient/${id}` : '/Ingredient', id ? 'PUT' : 'POST', {
                id: id ? parseInt(id) : 0,
                name: document.getElementById('ing-name').value.trim(),
                unitOfMeasure: document.getElementById('ing-unit').value.trim(),
                imageUrl,
                branchId: 0
            });

            ingModal.hide();
            await loadGlobalData();
            showToast(id ? 'Ingrediente actualizado.' : 'Ingrediente creado.');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setButtonLoading(button, false);
        }
    });
    setup('stock-form', async (e) => { e.preventDefault(); const button = e.submitter; const qty = parseFloat(document.getElementById('stock-quantity').value) || 0; const min = document.getElementById('stock-min').value ? parseFloat(document.getElementById('stock-min').value) : null; const type = document.getElementById('stock-type').value; if (qty > 0 && !type) { showToast('Selecciona el tipo de movimiento.', 'warning'); return; } if (qty === 0 && min === null) { showToast('Ingresa una cantidad o minimo de stock.', 'warning'); return; } try { setButtonLoading(button, true); await apiCall('/BranchStock/movement', 'POST', { branchId: 0, ingredientId: parseInt(document.getElementById('stock-ingredient-id').value), quantity: qty, movementType: type || "IN", minimumStock: min }); stockModal.hide(); await window.loadStock(); showToast('Stock actualizado.'); } catch (e) { showToast(e.message, 'error'); } finally { setButtonLoading(button, false); } });

    setup('client-form', async (e) => {
        e.preventDefault();
        const clientPayload = { name: document.getElementById('client-name').value, lastName: document.getElementById('client-lastname').value, phone: document.getElementById('client-phone').value, branchId: 0 };
        const addressPayload = { street: document.getElementById('client-addr-street').value, city: document.getElementById('client-addr-city').value, label: document.getElementById('client-addr-label').value, region: 'Canelones', postalCode: '15000', country: 'UY' };
        try {
            const newClient = await apiCall('/Client', 'POST', clientPayload);
            if (newClient && newClient.id) {
                await apiCall(`/Client/${newClient.id}/addresses`, 'POST', addressPayload);
                showToast('Cliente guardado.');
                clientModal.hide();
                await loadGlobalData();
                if (isCreatingOrderContext) { selectClientForOrder(newClient.id, `${newClient.name} ${newClient.lastName}`, newClient.phone); isCreatingOrderContext = false; }
            }
        } catch (e) { showToast(e.message, 'error'); }
    });

    setup('address-form', async (e) => { e.preventDefault(); const clientId = document.getElementById('addr-client-id').value; if (!clientId) return; const payload = { street: document.getElementById('addr-street').value, city: document.getElementById('addr-city').value, region: 'Canelones', postalCode: '15000', country: 'UY', label: document.getElementById('addr-label').value }; try { if (editingAddressId) { await apiCall(`/Client/address/${editingAddressId}`, 'PUT', { ...payload, id: editingAddressId, clientId: parseInt(clientId) }); } else { await apiCall(`/Client/${clientId}/addresses`, 'POST', payload); } addressModal.hide(); await loadClients(); } catch (e) { showToast(e.message, 'error'); } });
}

// ==========================================
// 📊 DASHBOARD (Lógica de Negocio & Gráficos)
// ==========================================
let salesChartInstance = null;
let topProductsChartInstance = null;
let peakHoursChartInstance = null;
let paymentMixChartInstance = null;
let statusMixChartInstance = null;

window.resetDashboardDate = function() { document.getElementById('dash-date-start').value = ''; document.getElementById('dash-date-end').value = ''; loadDashboard(); }

async function loadDashboard() {
    try {
        const start = document.getElementById('dash-date-start')?.value; const end = document.getElementById('dash-date-end')?.value;
        let url = '/reports/dashboard'; if(start && end) url += `?startDate=${start}&endDate=${end}`;
        const data = await apiCall(url);
        if (!data) return;

        animateValue("dash-today-revenue", data.todayRevenue, "$"); animateValue("dash-today-count", data.todayOrdersCount); animateValue("dash-avg-ticket", data.averageTicket, "$");
        if (document.getElementById('dash-avg-time')) document.getElementById('dash-avg-time').textContent = data.averageDeliveryTime;
        if (document.getElementById('dash-operating-hours')) document.getElementById('dash-operating-hours').textContent = data.operatingHoursLabel || formatOperatingHoursLabel(currentBranchSettings);
        if(document.getElementById('dash-pending')) document.getElementById('dash-pending').textContent = data.pendingOrders || 0;
        const stockLabel = document.getElementById('dash-low-stock');
        if(stockLabel) { const lowCount = data.lowStockCount || 0; stockLabel.textContent = lowCount > 0 ? `${lowCount} alertas de stock` : "Sin alertas"; stockLabel.className = lowCount > 0 ? "text-danger fw-bold" : "text-muted"; }

        if(data.last7DaysSales) renderSalesChart(data.last7DaysSales);
        if(data.salesByCategory) renderTopProductsChart(data.salesByCategory);
        if(data.peakHours) renderPeakHoursChart(data.peakHours);
        if(data.paymentMix) renderPaymentMixChart(data.paymentMix);
        if(data.statusMix) renderStatusMixChart(data.statusMix);
    } catch (error) { console.error("Error cargando dashboard:", error); }
}

function animateValue(id, value, prefix = "") {
    const el = document.getElementById(id);
    if (el) el.textContent = `${prefix}${Number(value || 0).toLocaleString('es-UY')}`;
}

function renderSalesChart(data) {
    const ctx = document.getElementById('salesChart'); if (!ctx) return;
    if (salesChartInstance) salesChartInstance.destroy();
    salesChartInstance = new Chart(ctx, { type: 'bar', data: { labels: data.map(d => d.label), datasets: [{ label: 'Ventas ($)', data: data.map(d => d.value), backgroundColor: createChartGradient(ctx, '#2854e8', '#0f9f8c'), borderColor: '#2854e8', borderWidth: 1, borderRadius: 10, borderSkipped: false }] }, options: baseChartOptions({ currency: true }) });
}

function renderTopProductsChart(data) {
    const ctx = document.getElementById('topProductsChart'); if (!ctx) return;
    if (topProductsChartInstance) topProductsChartInstance.destroy();
    topProductsChartInstance = new Chart(ctx, { type: 'bar', data: { labels: data.map(d => d.label), datasets: [{ label: 'Unidades', data: data.map(d => d.value), backgroundColor: ['#2854e8', '#0f9f8c', '#f3b233', '#e14f5a', '#667085'], borderWidth: 0, borderRadius: 9 }] }, options: baseChartOptions({ horizontal: true }) });
}

function renderPeakHoursChart(data) {
    const ctx = document.getElementById('peakHoursChart'); if (!ctx) return;
    if (peakHoursChartInstance) peakHoursChartInstance.destroy();
    peakHoursChartInstance = new Chart(ctx, { type: 'line', data: { labels: data.map(d => d.label), datasets: [{ label: 'Pedidos promedio', data: data.map(d => d.value), borderColor: '#0f9f8c', backgroundColor: 'rgba(15, 159, 140, 0.14)', fill: true, tension: 0.42, pointRadius: 4, pointBackgroundColor: '#fff', pointBorderColor: '#0f9f8c', pointBorderWidth: 2 }] }, options: baseChartOptions() });
}

function renderPaymentMixChart(data) {
    const ctx = document.getElementById('paymentMixChart'); if (!ctx) return;
    if (paymentMixChartInstance) paymentMixChartInstance.destroy();
    paymentMixChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.value), backgroundColor: ['#149968', '#36a3d9', '#f3b233', '#667085'], borderWidth: 0 }]
        },
        options: doughnutOptions(true)
    });
}

function renderStatusMixChart(data) {
    const ctx = document.getElementById('statusMixChart'); if (!ctx) return;
    if (statusMixChartInstance) statusMixChartInstance.destroy();
    statusMixChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.label),
            datasets: [{ label: 'Pedidos', data: data.map(d => d.value), backgroundColor: '#2854e8', borderRadius: 9, borderSkipped: false }]
        },
        options: baseChartOptions({ horizontal: true })
    });
}

function baseChartOptions({ currency = false, horizontal = false } = {}) {
    return {
        indexAxis: horizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: context => currency
                        ? `$ ${Number(context.raw || 0).toLocaleString('es-UY')}`
                        : Number(context.raw || 0).toLocaleString('es-UY')
                }
            }
        },
        scales: {
            x: { beginAtZero: true, grid: { display: !horizontal, color: 'rgba(102,112,133,0.10)' } },
            y: { beginAtZero: true, grid: { display: horizontal, color: 'rgba(102,112,133,0.10)' } }
        }
    };
}

function doughnutOptions(currency = false) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } },
            tooltip: {
                callbacks: {
                    label: context => currency
                        ? `${context.label}: $ ${Number(context.raw || 0).toLocaleString('es-UY')}`
                        : `${context.label}: ${Number(context.raw || 0).toLocaleString('es-UY')}`
                }
            }
        }
    };
}

function createChartGradient(ctx, from, to) {
    const chart = ctx.getContext('2d');
    const gradient = chart.createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0, from);
    gradient.addColorStop(1, to);
    return gradient;
}

// ==========================================
// 💰 GESTIÓN DE CAJA (ARQUEO)
// ==========================================
let cashStatus = { isOpen: false, openTime: null, initialBalance: 0 };
function legacyGetOperationalDate() { const now = new Date(); if (now.getHours() < 4) now.setDate(now.getDate() - 1); now.setHours(0, 0, 0, 0); return now; }
async function legacyInitCashView() { const expForm = document.getElementById('expense-form'); if (expForm) { const newForm = expForm.cloneNode(true); expForm.parentNode.replaceChild(newForm, expForm); newForm.addEventListener('submit', async (e) => { e.preventDefault(); await addCashMovement(); }); } await loadCashInfo(); }
async function legacyLoadCashInfo() { try { const data = await apiCall('/CashRegister/status'); cashStatus = data || { isOpen: false }; } catch (e) { const stored = localStorage.getItem('cash_session'); if (stored) cashStatus = JSON.parse(stored); } renderCashUI(); }
function legacyRenderCashUI() {
    const badge = document.getElementById('cash-status-badge'); const actions = document.getElementById('cash-actions'); const openTimeLbl = document.getElementById('cash-open-time');
    if (!badge || !actions) return;
    if (cashStatus.isOpen || cashStatus.isHistory) {
        badge.className = cashStatus.isOpen ? 'badge bg-success' : 'badge bg-secondary'; badge.textContent = cashStatus.isOpen ? 'Abierta' : 'Cerrada (Histórico)';
        openTimeLbl.textContent = `Desde: ${formatFechaLocal(cashStatus.openTime)}` + (cashStatus.closeTime ? ` hasta ${formatFechaLocal(cashStatus.closeTime)}` : '');
        actions.innerHTML = cashStatus.isHistory ? '<span class="badge bg-warning text-dark border border-dark">Modo Lectura</span>' : `<button class="btn btn-danger btn-sm" onclick="prepareCloseRegister()"><i class="bi bi-lock-fill"></i> Cerrar Caja</button> <button class="btn btn-warning btn-sm text-dark ms-2" onclick="openExpenseModal()"><i class="bi bi-cash-stack"></i> Nuevo Movimiento</button>`;
        const listCash = (cashStatus.orders || []).filter(o => o.paymentMethod === 'Cash' || o.paymentMethod === 1); const listMP = (cashStatus.orders || []).filter(o => o.paymentMethod === 'MercadoPago' || o.paymentMethod === 2); const listTransfer = (cashStatus.orders || []).filter(o => o.paymentMethod === 'Transfer' || o.paymentMethod === 3); const listPos = (cashStatus.orders || []).filter(o => o.paymentMethod === 'Pos' || o.paymentMethod === 4); const listExpenses = (cashStatus.movements || []).filter(m => m.type === 'OUT'); const listIncomes = (cashStatus.movements || []).filter(m => m.type === 'IN');
        const initial = cashStatus.initialBalance || 0; const totalCash = listCash.reduce((acc, o) => acc + o.totalAmount, 0); const totalExpenses = listExpenses.reduce((acc, m) => acc + m.amount, 0); const expected = initial + totalCash + listIncomes.reduce((acc, m) => acc + m.amount, 0) - totalExpenses;
        ['cash-initial', 'cash-total-cash', 'cash-total-mp', 'cash-total-transfer', 'cash-total-pos', 'cash-total-expenses', 'cash-expected'].forEach((id, i) => { const el = document.getElementById(id); if (el) el.textContent = `$${[initial, totalCash, listMP.reduce((a, o) => a + o.totalAmount, 0), listTransfer.reduce((a, o) => a + o.totalAmount, 0), listPos.reduce((a, o) => a + o.totalAmount, 0), totalExpenses, expected][i]}`; });
        const renderList = (id, items, isExp = false) => { const c = document.getElementById(id); if (!c) return; if (!items.length) c.innerHTML = '<li class="list-group-item text-muted fst-italic py-3 text-center">Sin movimientos</li>'; else c.innerHTML = items.map(item => `<li class="list-group-item d-flex justify-content-between align-items-center px-3 py-2"><span class="text-truncate" style="max-width: 65%;">${isExp ? item.description : item.clientName}</span><span class="fw-bold ${isExp ? 'text-danger' : 'text-dark'}">$${isExp ? item.amount : item.totalAmount}</span></li>`).join(''); };
        renderList('list-cash', listCash); renderList('list-mp', listMP); renderList('list-transfer', listTransfer); renderList('list-pos', listPos); renderList('list-expenses', listExpenses, true);
    } else {
        badge.className = 'badge bg-secondary'; badge.textContent = 'Cerrada'; openTimeLbl.textContent = '-'; actions.innerHTML = `<button class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#openRegisterModal"><i class="bi bi-unlock-fill"></i> Abrir Caja</button>`;
        ['cash-initial', 'cash-total-cash', 'cash-total-mp', 'cash-total-transfer', 'cash-total-pos', 'cash-total-expenses', 'cash-expected'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '$0'; });
        ['list-cash', 'list-mp', 'list-transfer', 'list-pos', 'list-expenses'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    }
}

async function legacyConfirmOpenRegister() {
    try { await apiCall('/CashRegister/open', 'POST', { initialBalance: parseFloat(document.getElementById('open-amount').value) || 0, openTime: new Date().toISOString(), operationalDate: getOperationalDate().toISOString() }); const m = bootstrap.Modal.getInstance(document.getElementById('openRegisterModal')); if (m) m.hide(); await loadCashInfo(); showToast('Caja abierta.'); } catch (e) { showToast(e.message, 'error'); }
}

function legacyPrepareCloseRegister() { document.getElementById('modal-expected-amount').textContent = document.getElementById('cash-expected').textContent; document.getElementById('close-real-amount').value = ''; document.getElementById('close-notes').value = ''; new bootstrap.Modal(document.getElementById('closeRegisterModal')).show(); }

async function legacyConfirmCloseRegister() {
    const real = parseFloat(document.getElementById('close-real-amount').value) || 0; const diff = real - (parseFloat(document.getElementById('modal-expected-amount').textContent.replace('$', '')) || 0);
    try { await apiCall('/CashRegister/close', 'POST', { finalBalance: real, notes: document.getElementById('close-notes').value, closeTime: new Date().toISOString() }); const m = bootstrap.Modal.getInstance(document.getElementById('closeRegisterModal')); if (m) m.hide(); await loadCashInfo(); showToast(diff < 0 ? `Caja cerrada. Faltante: $${Math.abs(diff)}` : (diff > 0 ? `Caja cerrada. Sobrante: $${diff}` : 'Caja cerrada.')); } catch (e) { showToast(e.message, 'error'); }
}

window.openExpenseModal = function () { const m = document.getElementById('expenseModal'); if (m) { document.getElementById('expense-amount').value = ''; document.getElementById('expense-desc').value = ''; bootstrap.Modal.getOrCreateInstance(m).show(); } };

async function legacyAddCashMovement() {
    const amt = parseFloat(document.getElementById('expense-amount').value); const desc = document.getElementById('expense-desc').value; if (!amt || !desc) return showToast('Ingresa monto y descripcion.', 'warning');
    try { await apiCall('/CashRegister/movement', 'POST', { type: document.getElementById('expense-type').value || "OUT", amount: amt, description: desc }); const m = bootstrap.Modal.getInstance(document.getElementById('expenseModal')); if (m) m.hide(); await loadCashInfo(); showToast('Movimiento registrado.'); } catch (e) { showToast(e.message, 'error'); }
}

async function legacyToggleHistoryView() { const s = document.getElementById('cash-history-section'); if (s.classList.contains('d-none')) { s.classList.remove('d-none'); await loadCashHistoryTable(); } else s.classList.add('d-none'); }

async function legacyLoadCashHistoryTable() {
    const tbody = document.getElementById('cash-history-table'); tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando...</td></tr>';
    try { const history = await apiCall('/CashRegister/history'); if (!history || !history.length) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay cierres.</td></tr>'; return; } tbody.innerHTML = history.map(h => `<tr><td class="fw-bold">#${h.id}</td><td>${formatFechaCompleta(h.openTime)}</td><td>${formatFechaCompleta(h.closeTime)}</td><td class="fw-bold">$${h.finalBalance}</td><td class="${h.difference < 0 ? 'text-danger' : (h.difference > 0 ? 'text-success' : 'text-muted')}">$${h.difference}</td><td><button class="btn btn-sm btn-outline-primary" onclick="loadPastSession(${h.id})">Detalle</button></td></tr>`).join(''); } catch (e) { tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Error: ${e.message}</td></tr>`; }
}

async function legacyLoadPastSession(id) { try { cashStatus = await apiCall(`/CashRegister/session/${id}`); document.getElementById('cash-history-section').classList.add('d-none'); document.getElementById('history-warning-banner').classList.remove('d-none'); document.getElementById('hist-date-lbl').textContent = formatFechaCompleta(cashStatus.closeTime); renderCashUI(); } catch (e) { showToast(e.message, 'error'); } }

// ==========================================
// 🔍 BUSCADOR DE CLIENTES
// ==========================================
function normalizePaymentMethod(method) {
    const value = String(method ?? '').toLowerCase();
    if (value === '1' || value.includes('cash') || value.includes('efectivo')) return 'cash';
    if (value === '2' || value.includes('mercado')) return 'mp';
    if (value === '3' || value.includes('transfer')) return 'transfer';
    if (value === '4' || value.includes('pos')) return 'pos';
    return value;
}

function orderAmount(order) {
    return Number(order?.totalAmount ?? order?.total ?? order?.amount ?? 0) || 0;
}

function getOperationalDate() {
    const now = new Date();
    const windows = getOperatingWindows(currentBranchSettings);
    const overnight = windows.find(window => window.close <= window.open && now.getHours() < window.close);
    if (overnight) now.setDate(now.getDate() - 1);
    const firstWindow = windows[0];
    now.setHours(firstWindow.open, 0, 0, 0);
    return now;
}

async function initCashView() {
    const banner = document.getElementById('history-warning-banner');
    if (banner) banner.classList.add('d-none');

    const expForm = document.getElementById('expense-form');
    if (expForm && expForm.dataset.bound !== 'true') {
        expForm.dataset.bound = 'true';
        expForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            await addCashMovement();
        });
    }

    await loadCashInfo();
}

async function loadCashInfo() {
    try {
        const data = await apiCall('/CashRegister/status');
        cashStatus = data || { isOpen: false };
        localStorage.setItem('cash_session', JSON.stringify(cashStatus));
    } catch (error) {
        const stored = localStorage.getItem('cash_session');
        cashStatus = stored ? JSON.parse(stored) : { isOpen: false };
    }
    renderCashUI();
}

function renderCashUI() {
    const badge = document.getElementById('cash-status-badge');
    const actions = document.getElementById('cash-actions');
    const openTimeLbl = document.getElementById('cash-open-time');
    if (!badge || !actions || !openTimeLbl) return;

    const orders = cashStatus.orders || [];
    const movements = cashStatus.movements || [];
    const listCash = orders.filter(o => normalizePaymentMethod(o.paymentMethod) === 'cash');
    const listMP = orders.filter(o => normalizePaymentMethod(o.paymentMethod) === 'mp');
    const listTransfer = orders.filter(o => normalizePaymentMethod(o.paymentMethod) === 'transfer');
    const listPos = orders.filter(o => normalizePaymentMethod(o.paymentMethod) === 'pos');
    const listIncomes = movements.filter(m => String(m.type || '').toUpperCase() === 'IN');
    const listExpenses = movements.filter(m => String(m.type || '').toUpperCase() === 'OUT');

    const initial = Number(cashStatus.initialBalance || 0);
    const totalCash = sumBy(listCash, orderAmount);
    const totalMP = sumBy(listMP, orderAmount);
    const totalTransfer = sumBy(listTransfer, orderAmount);
    const totalPos = sumBy(listPos, orderAmount);
    const totalIncomes = sumBy(listIncomes, 'amount');
    const totalExpenses = sumBy(listExpenses, 'amount');
    const expected = Number(cashStatus.expectedBalance ?? (initial + totalCash + totalIncomes - totalExpenses));
    const isActive = Boolean(cashStatus.isOpen || cashStatus.isHistory);

    if (cashStatus.isHistory) {
        badge.className = 'status-pill status-pill--muted';
        badge.textContent = `Cierre #${cashStatus.sessionId || cashStatus.id || '-'}`;
        openTimeLbl.textContent = `${formatFechaCompleta(cashStatus.openTime)} a ${formatFechaCompleta(cashStatus.closeTime)}`;
        actions.innerHTML = '<span class="status-pill status-pill--warning">Solo lectura</span>';
    } else if (cashStatus.isOpen) {
        badge.className = 'status-pill status-pill--success';
        badge.textContent = 'Abierta';
        openTimeLbl.textContent = `Desde ${formatFechaCompleta(cashStatus.openTime)} / operativo ${formatOperatingHoursLabel(currentBranchSettings)}`;
        actions.innerHTML = `
            <button class="btn btn-danger" onclick="prepareCloseRegister()"><i class="bi bi-lock-fill me-1"></i>Cerrar caja</button>
            <button class="btn btn-warning text-dark" onclick="openExpenseModal()"><i class="bi bi-cash-stack me-1"></i>Nuevo movimiento</button>
        `;
    } else {
        badge.className = 'status-pill status-pill--muted';
        badge.textContent = 'Cerrada';
        openTimeLbl.textContent = `Turnos: ${formatOperatingHoursLabel(currentBranchSettings)}`;
        actions.innerHTML = `<button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#openRegisterModal"><i class="bi bi-unlock-fill me-1"></i>Abrir caja</button>`;
    }

    setMoney('cash-initial', isActive ? initial : 0);
    setMoney('cash-total-cash', isActive ? totalCash : 0);
    setMoney('cash-total-mp', isActive ? totalMP : 0);
    setMoney('cash-total-transfer', isActive ? totalTransfer : 0);
    setMoney('cash-total-pos', isActive ? totalPos : 0);
    setMoney('cash-total-expenses', isActive ? totalExpenses : 0);
    setMoney('cash-expected', isActive ? expected : 0);

    renderCashList('list-cash', isActive ? listCash : [], { empty: cashStatus.isOpen ? 'Sin efectivo todavia' : 'Caja cerrada', icon: 'bi-cash-coin' });
    renderCashList('list-mp', isActive ? listMP : [], { empty: cashStatus.isOpen ? 'Sin MercadoPago' : 'Caja cerrada', icon: 'bi-phone' });
    renderCashList('list-transfer', isActive ? listTransfer : [], { empty: cashStatus.isOpen ? 'Sin transferencias' : 'Caja cerrada', icon: 'bi-bank' });
    renderCashList('list-pos', isActive ? listPos : [], { empty: cashStatus.isOpen ? 'Sin POS' : 'Caja cerrada', icon: 'bi-credit-card' });
    renderCashList('list-incomes', isActive ? listIncomes : [], { empty: cashStatus.isOpen ? 'Sin ingresos extra' : 'Caja cerrada', icon: 'bi-plus-circle', movement: true });
    renderCashList('list-expenses', isActive ? listExpenses : [], { empty: cashStatus.isOpen ? 'Sin egresos' : 'Caja cerrada', icon: 'bi-dash-circle', movement: true, danger: true });
}

function renderCashList(id, items, options = {}) {
    const container = document.getElementById(id);
    if (!container) return;

    if (!items.length) {
        container.innerHTML = `<li class="cash-empty"><i class="bi ${options.icon || 'bi-inbox'}"></i><span>${options.empty || 'Sin movimientos'}</span></li>`;
        return;
    }

    container.innerHTML = items.map(item => {
        const title = options.movement ? item.description : (item.clientName || item.customerName || 'Cliente');
        const amount = options.movement ? item.amount : orderAmount(item);
        const time = item.time || item.orderDate || item.createdAt;
        return `
            <li class="cash-row ${options.danger ? 'cash-row--danger' : ''}">
                <span>
                    <b>${escapeHtml(title || 'Movimiento')}</b>
                    ${time ? `<small>${formatFechaLocal(time)}</small>` : ''}
                </span>
                <strong>${formatMoney(amount)}</strong>
            </li>`;
    }).join('');
}

async function confirmOpenRegister() {
    const initialBalance = Number(document.getElementById('open-amount')?.value || 0) || 0;
    try {
        await apiCall('/CashRegister/open', 'POST', {
            initialBalance,
            openTime: new Date().toISOString(),
            operationalDate: getOperationalDate().toISOString()
        });
        bootstrap.Modal.getInstance(document.getElementById('openRegisterModal'))?.hide();
        await loadCashInfo();
        showToast('Caja abierta.');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function prepareCloseRegister() {
    const expected = document.getElementById('cash-expected')?.textContent || '$0';
    const modalExpected = document.getElementById('modal-expected-amount');
    if (modalExpected) modalExpected.textContent = expected;
    const realAmount = document.getElementById('close-real-amount');
    const notes = document.getElementById('close-notes');
    if (realAmount) realAmount.value = '';
    if (notes) notes.value = '';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('closeRegisterModal')).show();
}

async function confirmCloseRegister() {
    const real = Number(document.getElementById('close-real-amount')?.value || 0) || 0;
    const expectedText = document.getElementById('modal-expected-amount')?.textContent || '0';
    const expected = Number(expectedText.replace(/[^\d.-]/g, '')) || 0;
    const difference = real - expected;

    try {
        await apiCall('/CashRegister/close', 'POST', {
            finalBalance: real,
            notes: document.getElementById('close-notes')?.value || '',
            closeTime: new Date().toISOString()
        });
        bootstrap.Modal.getInstance(document.getElementById('closeRegisterModal'))?.hide();
        await loadCashInfo();
        showToast(difference === 0 ? 'Caja cerrada sin diferencias.' : `Caja cerrada con ${difference > 0 ? 'sobrante' : 'faltante'} de ${formatMoney(Math.abs(difference))}.`);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function openExpenseModal() {
    const modal = document.getElementById('expenseModal');
    if (!modal) return;
    const amount = document.getElementById('expense-amount');
    const desc = document.getElementById('expense-desc');
    if (amount) amount.value = '';
    if (desc) desc.value = '';
    bootstrap.Modal.getOrCreateInstance(modal).show();
}

async function addCashMovement() {
    const amount = Number(document.getElementById('expense-amount')?.value || 0);
    const description = document.getElementById('expense-desc')?.value.trim();
    if (!amount || !description) return showToast('Ingresa monto y descripcion.', 'warning');

    try {
        await apiCall('/CashRegister/movement', 'POST', {
            type: document.getElementById('expense-type')?.value || 'OUT',
            amount,
            description
        });
        bootstrap.Modal.getInstance(document.getElementById('expenseModal'))?.hide();
        await loadCashInfo();
        showToast('Movimiento registrado.');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function toggleHistoryView() {
    const section = document.getElementById('cash-history-section');
    if (!section) return;
    if (section.classList.contains('d-none')) {
        section.classList.remove('d-none');
        await loadCashHistoryTable();
    } else {
        section.classList.add('d-none');
    }
}

function setupCashHistorySearch() {
    const input = document.getElementById('cash-history-search');
    if (!input || input.dataset.bound === 'true') return;
    input.dataset.bound = 'true';
    let timer = null;
    input.addEventListener('input', event => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
            cashHistoryState.search = event.target.value;
            cashHistoryState.page = 1;
            loadCashHistoryTable();
        }, 250);
    });
}

function changeCashHistoryPage(page) {
    cashHistoryState.page = Math.max(1, Number(page) || 1);
    loadCashHistoryTable();
}

async function loadCashHistoryTable() {
    const tbody = document.getElementById('cash-history-table');
    const counter = document.getElementById('cash-history-count');
    const pager = document.getElementById('cash-history-pagination');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><span class="spinner-border spinner-border-sm me-2"></span>Cargando cierres...</td></tr>';

    const query = new URLSearchParams({
        page: cashHistoryState.page,
        pageSize: cashHistoryState.pageSize,
        search: cashHistoryState.search || ''
    });

    try {
        const response = await apiCall(`/CashRegister/history?${query.toString()}`);
        const items = Array.isArray(response) ? response : (response.items || []);
        cashHistoryState.total = Array.isArray(response) ? items.length : (response.total || 0);
        cashHistoryState.totalPages = Array.isArray(response) ? 1 : (response.totalPages || 1);
        cashHistoryState.page = Array.isArray(response) ? 1 : (response.page || cashHistoryState.page);

        if (counter) counter.textContent = `${cashHistoryState.total} cierre${cashHistoryState.total === 1 ? '' : 's'}`;
        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state empty-state--table"><i class="bi bi-safe"></i><strong>No hay cierres para mostrar</strong><span>Proba otra busqueda o cerra una caja nueva.</span></div></td></tr>';
        } else {
            tbody.innerHTML = items.map(session => {
                const diff = Number(session.difference || 0);
                const diffClass = diff < 0 ? 'text-danger' : diff > 0 ? 'text-success' : 'text-muted';
                return `
                    <tr>
                        <td class="fw-bold">#${session.id}</td>
                        <td>${formatFechaCompleta(session.openTime)}</td>
                        <td>${formatFechaCompleta(session.closeTime)}</td>
                        <td>${formatMoney(session.expectedBalance)}</td>
                        <td class="fw-bold">${formatMoney(session.finalBalance)}</td>
                        <td class="${diffClass} fw-bold">${formatMoney(diff)}</td>
                        <td class="text-end"><button class="btn btn-sm btn-outline-primary" onclick="loadPastSession(${session.id})">Detalle</button></td>
                    </tr>`;
            }).join('');
        }

        if (pager) pager.innerHTML = renderPagination('changeCashHistoryPage', cashHistoryState.page, cashHistoryState.totalPages);
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-danger text-center py-4">Error: ${escapeHtml(error.message)}</td></tr>`;
        if (pager) pager.innerHTML = '';
    }
}

async function loadPastSession(id) {
    try {
        cashStatus = await apiCall(`/CashRegister/session/${id}`);
        document.getElementById('cash-history-section')?.classList.add('d-none');
        const banner = document.getElementById('history-warning-banner');
        if (banner) banner.classList.remove('d-none');
        const label = document.getElementById('hist-date-lbl');
        if (label) label.textContent = formatFechaCompleta(cashStatus.closeTime);
        renderCashUI();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function setupClientSearch() {
    const input = document.getElementById('client-search-input'); const res = document.getElementById('client-search-results'); if (!input || !res) return;
    input.addEventListener('input', e => {
        const term = e.target.value.toLowerCase(); if (term.length < 2) { res.style.display = 'none'; return; }
        const matches = allClients.filter(c => ((c.name || '') + ' ' + (c.lastName || '')).toLowerCase().includes(term) || String(c.phone || '').includes(term));
        res.innerHTML = matches.length ? matches.map(c => `<a href="#" class="list-group-item list-group-item-action" onclick="selectClientForOrder(${c.id}, '${c.name} ${c.lastName}', '${c.phone}')"><div class="d-flex justify-content-between"><strong>${c.name} ${c.lastName}</strong><small class="text-muted">${c.phone}</small></div></a>`).join('') : '<div class="list-group-item text-muted">No encontrado</div>';
        res.style.display = 'block';
    });
    document.addEventListener('click', e => { if (!input.contains(e.target) && !res.contains(e.target)) res.style.display = 'none'; });
}

async function selectClientForOrder(id, name, phone) { document.getElementById('selected-client-id').value = id; document.getElementById('selected-client-name').textContent = `${name} (${phone})`; document.getElementById('client-search-results').style.display = 'none'; document.getElementById('client-search-input').parentElement.classList.add('d-none'); document.getElementById('selected-client-display').classList.remove('d-none'); await loadClientAddressesForOrder(id); }
function clearClientSelection() { document.getElementById('selected-client-id').value = ''; document.getElementById('order-address-id').innerHTML = '<option value="">Selecciona cliente primero...</option>'; document.getElementById('selected-client-display').classList.add('d-none'); document.getElementById('client-search-input').parentElement.classList.remove('d-none'); document.getElementById('client-search-input').value = ''; }
async function loadClientAddressesForOrder(clientId) { const sel = document.getElementById('order-address-id'); try { const addrs = await apiCall(`/Client/${clientId}/addresses`); sel.innerHTML = addrs && addrs.length ? addrs.map(a => `<option value="${a.id}">${a.label}: ${a.street}</option>`).join('') : '<option value="">Sin dirección</option>'; } catch (e) { sel.innerHTML = '<option value="">Error</option>'; } }
function openClientModalFromOrder() { isCreatingOrderContext = true; prepareClientModal(); }

// ==========================================
// 🎭 CONFIGURACIÓN DE VISTAS POR ROL
// ==========================================
function setupRoleViews(role) {
    const clickDefault = (s) => { const b = document.querySelector(`#order-filters button[onclick*="'${s}'"]`); if (b) b.click(); };
    const hideBtn = (s) => { const b = document.querySelector(`#order-filters button[onclick*="'${s}'"]`); if (b) b.classList.add('d-none'); };
    if (role === 'KITCHEN' || role === '2') { hideBtn('Pending'); clickDefault('Confirmed'); }
    else if (role === 'WAITER' || role === '3' || role === 'DELIVERY') { hideBtn('Pending'); hideBtn('Confirmed'); clickDefault('Ready'); }
    else { clickDefault('Pending'); }
}

// ==========================================
// 🕵️ RASTREO MANUAL
// ==========================================
window.promptForTracking = async function() {
    const input = await promptInput('ID del pedido a rastrear', {
        title: 'Rastreo manual',
        placeholder: 'Ej: 128'
    });
    if (!input) return;
    currentlyTrackingId = parseInt(input);
    const m = document.getElementById('trackingModal'); if(m) new bootstrap.Modal(m).show();
    if(document.getElementById('track-order-id')) document.getElementById('track-order-id').textContent = currentlyTrackingId;
    window.updateTrackingUI(null, 'Searching'); 
    try { const o = await apiCall(`/Orders/${currentlyTrackingId}`); if(o) window.updateTrackingUI(null, o.currentStatus || o.status); } catch(e) { window.updateTrackingUI(null, 'NotFound'); }
};

window.updateTrackingUI = function(orderId, status) {
    if (orderId !== null && parseInt(orderId) !== currentlyTrackingId) return;
    const lbl = document.getElementById('track-status'), icon = document.getElementById('track-icon'), bar = document.getElementById('track-bar'), msg = document.getElementById('track-msg');
    if (!lbl || !icon) return;
    const sMap = {
        'Searching': {l: 'Buscando...', i: '<div class="spinner-border text-primary" style="width: 3rem; height: 3rem;"></div>', bc: 'bg-secondary', w: '0%', m: 'Consultando base de datos...'},
        'NotFound': {l: 'No Encontrado', i: '<i class="bi bi-question-circle text-muted" style="font-size: 4rem;"></i>', bc: 'bg-secondary', w: '0%', m: 'Verifica el número.'},
        'Pending': {l: 'Pendiente', i: '<i class="bi bi-clock-history text-warning" style="font-size: 4rem;"></i>', bc: 'bg-warning', w: '10%', m: 'Esperando confirmación...'},
        'Confirmed': {l: 'Confirmado', i: '<i class="bi bi-check-circle text-info" style="font-size: 4rem;"></i>', bc: 'bg-info', w: '25%', m: 'Pedido recibido.'},
        'Cooking': {l: 'En Cocina', i: '<i class="bi bi-fire text-danger animate__animated animate__pulse animate__infinite" style="font-size: 4rem;"></i>', bc: 'bg-danger', w: '50%', m: 'Preparando tu comida!'},
        'Ready': {l: '¡Listo!', i: '<i class="bi bi-bell-fill text-success animate__animated animate__tada" style="font-size: 4rem;"></i>', bc: 'bg-success', w: '75%', m: 'Esperando retiro/delivery.'},
        'OnTheWay': {l: 'En Camino', i: '<i class="bi bi-scooter text-primary animate__animated animate__slideInLeft" style="font-size: 4rem;"></i>', bc: 'bg-primary', w: '90%', m: 'Enviado a tu dirección.'},
        'Delivered': {l: 'Entregado', i: '<i class="bi bi-emoji-smile-fill text-success" style="font-size: 4rem;"></i>', bc: 'bg-success', w: '100%', m: 'Pedido finalizado.'},
        'Cancelled': {l: 'Cancelado', i: '<i class="bi bi-x-octagon-fill text-dark" style="font-size: 4rem;"></i>', bc: 'bg-dark', w: '100%', m: 'Pedido cancelado.'}
    };
    const s = sMap[status]; if(s) { lbl.innerText = s.l; icon.innerHTML = s.i; bar.className = `progress-bar ${s.bc}`; bar.style.width = s.w; msg.innerText = s.m; }
};

async function copyDriverLink(link) {
    try {
        await navigator.clipboard.writeText(link);
        showToast('Link para repartidor copiado.');
    } catch {
        await promptInput('Copia el link manualmente', {
            title: 'Link para repartidor',
            value: link,
            confirmLabel: 'Cerrar'
        });
    }
}

window.confirmOpenRegister = confirmOpenRegister; window.confirmCloseRegister = confirmCloseRegister; window.prepareCloseRegister = prepareCloseRegister; window.initCashView = initCashView; window.toggleHistoryView = toggleHistoryView; window.loadPastSession = loadPastSession; window.cancelOrder = cancelOrder; window.openExpenseModal = openExpenseModal; window.openClientModalFromOrder = openClientModalFromOrder; window.selectClientForOrder = selectClientForOrder; window.clearClientSelection = clearClientSelection; window.promptForTracking = promptForTracking; window.updateTrackingUI = updateTrackingUI; window.updateOrderStatus = updateOrderStatus; window.openOrderDetailModal = openOrderDetailModal; window.copyDriverLink = copyDriverLink;
