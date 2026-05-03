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

    window.toggleHistoryView = toggleHistoryView;
    window.loadPastSession = loadPastSession;
    window.initCashView = initCashView;
    window.confirmOpenRegister = confirmOpenRegister;
    window.confirmCloseRegister = confirmCloseRegister;
    window.prepareCloseRegister = prepareCloseRegister;
    window.openExpenseModal = openExpenseModal;

    window.openClientModalFromOrder = openClientModalFromOrder;
    window.selectClientForOrder = selectClientForOrder;
    window.clearClientSelection = clearClientSelection;

    setupClientSearch();
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
    const map = { 'Cash': 'Efectivo', 'MercadoPago': 'MercadoPago', 'Transfer': 'Transferencia' };
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
    const tbody = document.getElementById('clients-table');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Cargando...</td></tr>';
    try {
        let clients = await apiCall('/Client');
        const clientsWithAddress = await Promise.all((clients || []).map(async (c) => {
            try { return { ...c, addresses: await apiCall(`/Client/${c.id}/addresses`) || [] }; } 
            catch (e) { return { ...c, addresses: [] }; }
        }));
        allClients = clientsWithAddress;

        if (allClients.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay clientes.</td></tr>'; return; }

        tbody.innerHTML = allClients.map(c => {
            const addressBadges = c.addresses.length > 0 ? c.addresses.map(a => `
                <div class="d-flex align-items-center justify-content-between badge border text-muted fw-normal w-100 mb-1">
                    <span class="text-truncate me-2"><i class="bi bi-house-door text-danger"></i> <b>${a.label}:</b> ${a.fullAddress || a.street}</span>
                    <div class="text-nowrap"><i class="bi bi-pencil-square text-primary cursor-pointer me-2" onclick="editAddress(${c.id}, ${a.id})"></i><i class="bi bi-x-circle text-danger cursor-pointer" onclick="deleteAddress(${c.id}, ${a.id})"></i></div>
                </div>`).join('') : '<span class="text-muted small fst-italic">Sin dirección</span>';

            return `<tr><td class="ps-4 fw-bold">#${c.id}</td><td>${c.name} ${c.lastName}</td><td>${c.phone}</td>
                <td class="text-end pe-4" style="min-width: 250px;"><div class="d-flex flex-column align-items-end">${addressBadges}
                <div class="btn-group mt-1"><button class="btn btn-sm btn-outline-secondary" onclick="viewClientOrders(${c.id})"><i class="bi bi-journal-text"></i> Pedidos</button><button class="btn btn-sm btn-link text-decoration-none" onclick="openAddressModal(${c.id})">+ Dir</button></div></div></td></tr>`;
        }).join('');
    } catch (e) { tbody.innerHTML = `<tr><td colspan="4" class="text-danger text-center">Error: ${e.message}</td></tr>`; }
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

    const selectFile = file => {
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            showToast('Usa una imagen JPG, PNG o WEBP.', 'warning');
            return;
        }
        assignFile(file);
        preview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Preview">`;
    };

    dropzone.addEventListener('click', () => input.click());
    input.addEventListener('change', e => selectFile(e.target.files?.[0]));

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

    dropzone.addEventListener('drop', e => selectFile(e.dataTransfer.files?.[0]));
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
let salesChartInstance = null; let topProductsChartInstance = null; let peakHoursChartInstance = null;

window.resetDashboardDate = function() { document.getElementById('dash-date-start').value = ''; document.getElementById('dash-date-end').value = ''; loadDashboard(); }

async function loadDashboard() {
    try {
        const start = document.getElementById('dash-date-start')?.value; const end = document.getElementById('dash-date-end')?.value;
        let url = '/reports/dashboard'; if(start && end) url += `?startDate=${start}&endDate=${end}`;
        const data = await apiCall(url);
        if (!data) return;

        animateValue("dash-today-revenue", data.todayRevenue, "$"); animateValue("dash-today-count", data.todayOrdersCount); animateValue("dash-avg-ticket", data.averageTicket, "$");
        if (document.getElementById('dash-avg-time')) document.getElementById('dash-avg-time').textContent = data.averageDeliveryTime;
        if(document.getElementById('dash-pending')) document.getElementById('dash-pending').textContent = data.pendingOrders || 0;
        const stockLabel = document.getElementById('dash-low-stock');
        if(stockLabel) { const lowCount = data.lowStockCount || 0; stockLabel.textContent = lowCount > 0 ? `(${lowCount} Alertas)` : "(Sin alertas)"; stockLabel.className = lowCount > 0 ? "text-danger fw-bold ms-2" : "text-muted ms-2"; }

        if(data.last7DaysSales) renderSalesChart(data.last7DaysSales);
        if(data.salesByCategory) renderTopProductsChart(data.salesByCategory);
        if(data.peakHours) renderPeakHoursChart(data.peakHours);
    } catch (error) { console.error("Error cargando dashboard:", error); }
}

function animateValue(id, value, prefix = "") { const el = document.getElementById(id); if (el) el.textContent = `${prefix}${value.toLocaleString('es-UY')}`; }

function renderSalesChart(data) {
    const ctx = document.getElementById('salesChart'); if (!ctx) return;
    if (salesChartInstance) salesChartInstance.destroy();
    salesChartInstance = new Chart(ctx, { type: 'bar', data: { labels: data.map(d => d.label), datasets: [{ label: 'Ventas ($)', data: data.map(d => d.value), backgroundColor: 'rgba(40, 84, 232, 0.72)', borderColor: '#2854e8', borderWidth: 1, borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => '$ ' + c.raw.toLocaleString('es-UY') } } }, scales: { y: { beginAtZero: true } } } });
}

function renderTopProductsChart(data) {
    const ctx = document.getElementById('topProductsChart'); if (!ctx) return;
    if (topProductsChartInstance) topProductsChartInstance.destroy();
    topProductsChartInstance = new Chart(ctx, { type: 'bar', data: { labels: data.map(d => d.label), datasets: [{ label: 'Unidades', data: data.map(d => d.value), backgroundColor: ['#2854e8', '#0f9f8c', '#f3b233', '#e14f5a', '#667085'], borderWidth: 1, borderRadius: 6 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } } });
}

function renderPeakHoursChart(data) {
    const ctx = document.getElementById('peakHoursChart'); if (!ctx) return;
    if (peakHoursChartInstance) peakHoursChartInstance.destroy();
    peakHoursChartInstance = new Chart(ctx, { type: 'line', data: { labels: data.map(d => d.label), datasets: [{ label: 'Pedidos', data: data.map(d => d.value), borderColor: '#0f9f8c', backgroundColor: 'rgba(15, 159, 140, 0.12)', fill: true, tension: 0.42, pointRadius: 4, pointBackgroundColor: '#fff', pointBorderColor: '#0f9f8c' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } } });
}

// ==========================================
// 💰 GESTIÓN DE CAJA (ARQUEO)
// ==========================================
let cashStatus = { isOpen: false, openTime: null, initialBalance: 0 };
function getOperationalDate() { const now = new Date(); if (now.getHours() < 4) now.setDate(now.getDate() - 1); now.setHours(0, 0, 0, 0); return now; }
async function initCashView() { const expForm = document.getElementById('expense-form'); if (expForm) { const newForm = expForm.cloneNode(true); expForm.parentNode.replaceChild(newForm, expForm); newForm.addEventListener('submit', async (e) => { e.preventDefault(); await addCashMovement(); }); } await loadCashInfo(); }
async function loadCashInfo() { try { const data = await apiCall('/CashRegister/status'); cashStatus = data || { isOpen: false }; } catch (e) { const stored = localStorage.getItem('cash_session'); if (stored) cashStatus = JSON.parse(stored); } renderCashUI(); }
function renderCashUI() {
    const badge = document.getElementById('cash-status-badge'); const actions = document.getElementById('cash-actions'); const openTimeLbl = document.getElementById('cash-open-time');
    if (!badge || !actions) return;
    if (cashStatus.isOpen || cashStatus.isHistory) {
        badge.className = cashStatus.isOpen ? 'badge bg-success' : 'badge bg-secondary'; badge.textContent = cashStatus.isOpen ? 'Abierta' : 'Cerrada (Histórico)';
        openTimeLbl.textContent = `Desde: ${formatFechaLocal(cashStatus.openTime)}` + (cashStatus.closeTime ? ` hasta ${formatFechaLocal(cashStatus.closeTime)}` : '');
        actions.innerHTML = cashStatus.isHistory ? '<span class="badge bg-warning text-dark border border-dark">Modo Lectura</span>' : `<button class="btn btn-danger btn-sm" onclick="prepareCloseRegister()"><i class="bi bi-lock-fill"></i> Cerrar Caja</button> <button class="btn btn-warning btn-sm text-dark ms-2" onclick="openExpenseModal()"><i class="bi bi-cash-stack"></i> Nuevo Movimiento</button>`;
        const listCash = (cashStatus.orders || []).filter(o => o.paymentMethod === 'Cash' || o.paymentMethod === 0); const listMP = (cashStatus.orders || []).filter(o => o.paymentMethod === 'MercadoPago' || o.paymentMethod === 1); const listTransfer = (cashStatus.orders || []).filter(o => o.paymentMethod === 'Transfer' || o.paymentMethod === 3); const listExpenses = (cashStatus.movements || []).filter(m => m.type === 'OUT'); const listIncomes = (cashStatus.movements || []).filter(m => m.type === 'IN');
        const initial = cashStatus.initialBalance || 0; const totalCash = listCash.reduce((acc, o) => acc + o.totalAmount, 0); const totalExpenses = listExpenses.reduce((acc, m) => acc + m.amount, 0); const expected = initial + totalCash + listIncomes.reduce((acc, m) => acc + m.amount, 0) - totalExpenses;
        ['cash-initial', 'cash-total-cash', 'cash-total-mp', 'cash-total-transfer', 'cash-total-expenses', 'cash-expected'].forEach((id, i) => document.getElementById(id).textContent = `$${[initial, totalCash, listMP.reduce((a, o) => a + o.totalAmount, 0), listTransfer.reduce((a, o) => a + o.totalAmount, 0), totalExpenses, expected][i]}`);
        const renderList = (id, items, isExp = false) => { const c = document.getElementById(id); if (!items.length) c.innerHTML = '<li class="list-group-item text-muted fst-italic py-3 text-center">Sin movimientos</li>'; else c.innerHTML = items.map(item => `<li class="list-group-item d-flex justify-content-between align-items-center px-3 py-2"><span class="text-truncate" style="max-width: 65%;">${isExp ? item.description : item.clientName}</span><span class="fw-bold ${isExp ? 'text-danger' : 'text-dark'}">$${isExp ? item.amount : item.totalAmount}</span></li>`).join(''); };
        renderList('list-cash', listCash); renderList('list-mp', listMP); renderList('list-transfer', listTransfer); renderList('list-expenses', listExpenses, true);
    } else {
        badge.className = 'badge bg-secondary'; badge.textContent = 'Cerrada'; openTimeLbl.textContent = '-'; actions.innerHTML = `<button class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#openRegisterModal"><i class="bi bi-unlock-fill"></i> Abrir Caja</button>`;
        ['cash-initial', 'cash-total-cash', 'cash-total-mp', 'cash-total-transfer', 'cash-total-expenses', 'cash-expected'].forEach(id => document.getElementById(id).textContent = '$0');
        ['list-cash', 'list-mp', 'list-transfer', 'list-expenses'].forEach(id => document.getElementById(id).innerHTML = '');
    }
}

async function confirmOpenRegister() {
    try { await apiCall('/CashRegister/open', 'POST', { initialBalance: parseFloat(document.getElementById('open-amount').value) || 0, openTime: new Date().toISOString(), operationalDate: getOperationalDate().toISOString() }); const m = bootstrap.Modal.getInstance(document.getElementById('openRegisterModal')); if (m) m.hide(); await loadCashInfo(); showToast('Caja abierta.'); } catch (e) { showToast(e.message, 'error'); }
}

function prepareCloseRegister() { document.getElementById('modal-expected-amount').textContent = document.getElementById('cash-expected').textContent; document.getElementById('close-real-amount').value = ''; document.getElementById('close-notes').value = ''; new bootstrap.Modal(document.getElementById('closeRegisterModal')).show(); }

async function confirmCloseRegister() {
    const real = parseFloat(document.getElementById('close-real-amount').value) || 0; const diff = real - (parseFloat(document.getElementById('modal-expected-amount').textContent.replace('$', '')) || 0);
    try { await apiCall('/CashRegister/close', 'POST', { finalBalance: real, notes: document.getElementById('close-notes').value, closeTime: new Date().toISOString() }); const m = bootstrap.Modal.getInstance(document.getElementById('closeRegisterModal')); if (m) m.hide(); await loadCashInfo(); showToast(diff < 0 ? `Caja cerrada. Faltante: $${Math.abs(diff)}` : (diff > 0 ? `Caja cerrada. Sobrante: $${diff}` : 'Caja cerrada.')); } catch (e) { showToast(e.message, 'error'); }
}

window.openExpenseModal = function () { const m = document.getElementById('expenseModal'); if (m) { document.getElementById('expense-amount').value = ''; document.getElementById('expense-desc').value = ''; bootstrap.Modal.getOrCreateInstance(m).show(); } };

async function addCashMovement() {
    const amt = parseFloat(document.getElementById('expense-amount').value); const desc = document.getElementById('expense-desc').value; if (!amt || !desc) return showToast('Ingresa monto y descripcion.', 'warning');
    try { await apiCall('/CashRegister/movement', 'POST', { type: document.getElementById('expense-type').value || "OUT", amount: amt, description: desc }); const m = bootstrap.Modal.getInstance(document.getElementById('expenseModal')); if (m) m.hide(); await loadCashInfo(); showToast('Movimiento registrado.'); } catch (e) { showToast(e.message, 'error'); }
}

async function toggleHistoryView() { const s = document.getElementById('cash-history-section'); if (s.classList.contains('d-none')) { s.classList.remove('d-none'); await loadCashHistoryTable(); } else s.classList.add('d-none'); }

async function loadCashHistoryTable() {
    const tbody = document.getElementById('cash-history-table'); tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando...</td></tr>';
    try { const history = await apiCall('/CashRegister/history'); if (!history || !history.length) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay cierres.</td></tr>'; return; } tbody.innerHTML = history.map(h => `<tr><td class="fw-bold">#${h.id}</td><td>${formatFechaCompleta(h.openTime)}</td><td>${formatFechaCompleta(h.closeTime)}</td><td class="fw-bold">$${h.finalBalance}</td><td class="${h.difference < 0 ? 'text-danger' : (h.difference > 0 ? 'text-success' : 'text-muted')}">$${h.difference}</td><td><button class="btn btn-sm btn-outline-primary" onclick="loadPastSession(${h.id})">Detalle</button></td></tr>`).join(''); } catch (e) { tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Error: ${e.message}</td></tr>`; }
}

async function loadPastSession(id) { try { cashStatus = await apiCall(`/CashRegister/session/${id}`); document.getElementById('cash-history-section').classList.add('d-none'); document.getElementById('history-warning-banner').classList.remove('d-none'); document.getElementById('hist-date-lbl').textContent = formatFechaCompleta(cashStatus.closeTime); renderCashUI(); } catch (e) { showToast(e.message, 'error'); } }

// ==========================================
// 🔍 BUSCADOR DE CLIENTES
// ==========================================
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
