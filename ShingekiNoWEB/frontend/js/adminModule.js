import { apiCall } from './apiService.js';
import { logout } from './auth.js';

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

// ==========================================
// 🏛️ ESTADO GLOBAL
// ==========================================
let allCategories = [], allProducts = [], allIngredients = [], allBranches = [];
let allClients = [], allOrders = [];
let currentBranchId = 0;
let editingAddressId = null;
let isCreatingOrderContext = false;

let currentClientIdForAddress = null;
let currentProductIdForRecipe = null;
let currentOrderStatus = 'Pending';
let autoRefreshInterval = null;

let catModal, prodModal, stockModal, ingModal, recipeModal, clientModal, addressModal, orderDetailModal, clientOrdersModal;

// ==========================================
// 🚀 INICIALIZACIÓN (INIT ADMIN)
// ==========================================
export const initAdmin = async () => {
    console.log("⚙️ Iniciando Módulo Admin...");

    // 1. VERIFICACIÓN DE ROL
    const rawRole = localStorage.getItem('user_role');
    const role = String(rawRole).toUpperCase();

    // Permitimos: Admin (1), BranchManager, Kitchen (2), Delivery/Mozo (3)
    const allowedRoles = ['ADMIN', 'BRANCHMANAGER', 'KITCHEN', 'WAITER', 'DELIVERY', '1', '2', '3'];

    if (!allowedRoles.includes(role)) {
        console.warn("Acceso denegado. Rol detectado:", role);
        window.location.href = 'index.html';
        return;
    }

    // 2. MOSTRAR NOMBRE USUARIO
    const userName = localStorage.getItem('user_name');
    if (document.getElementById('admin-name')) {
        document.getElementById('admin-name').textContent = userName || 'Admin';
    }

    if (document.getElementById('logout-btn')) {
        document.getElementById('logout-btn').addEventListener('click', logout);
    }

    // 3. LOGICA SIDEBAR (Ocultar botones para Cocina y Delivery)
    // Si es Cocina (2) o Delivery (3), limpiamos la sidebar para dejar solo Pedidos y Salir
    if (['KITCHEN', '2', 'WAITER', '3', 'DELIVERY'].includes(role)) {
        const sidebar = document.getElementById('main-sidebar');
        if (sidebar) {
            const buttons = sidebar.querySelectorAll('button, a');
            buttons.forEach(btn => {
                const text = btn.innerText.toLowerCase();
                // Ocultar todo lo que NO sea "Pedidos" o "Salir"
                if (!text.includes('pedidos') && !text.includes('salir')) {
                    btn.classList.add('d-none');
                }
            });
        }
        // Forzar vista de pedidos al entrar
        if (window.switchTab) window.switchTab('orders');
    }

    // 4. INICIALIZAR MODALES
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
    userModal = initModal('userModal');

    // 5. EXPONER FUNCIONES AL DOM (WINDOW)
    window.prepareCategoryModal = prepareCategoryModal; window.editCategory = editCategory; window.deleteCategory = deleteCategory;
    window.prepareProductModal = prepareProductModal; window.editProduct = editProduct; window.deleteProduct = deleteProduct;
    window.prepareStockModal = prepareStockModal; window.loadStock = loadStock;
    window.prepareIngredientModal = prepareIngredientModal; window.editIngredient = editIngredient; window.deleteIngredient = deleteIngredient; window.renderIngredients = renderIngredients;

    // Funciones de Usuarios
    window.loadUsers = loadUsers;
    window.prepareUserModal = prepareUserModal;
    window.editUser = editUser;
    window.deleteUser = deleteUser;

    // Recetas
    window.openRecipeModal = openRecipeModal;
    window.addIngredientToRecipe = addIngredientToRecipe;
    window.removeIngredientFromRecipe = removeIngredientFromRecipe;

    // Clientes
    window.loadClients = loadClients;
    window.prepareClientModal = prepareClientModal;
    window.openAddressModal = openAddressModal;
    window.editAddress = editAddress;
    window.deleteAddress = deleteAddress;

    // Pedidos
    window.viewClientOrders = viewClientOrders;
    window.updateOrderDateTime = updateOrderDateTime;
    window.loadOrders = loadOrders;
    window.openOrderDetailModal = openOrderDetailModal;
    window.loadGlobalData = loadGlobalData;
    window.filterOrders = filterOrders;
    window.cancelOrder = cancelOrder;
    window.loadDashboard = loadDashboard;
    window.startLiveUpdate = startLiveUpdate;
    window.currentBranchId = currentBranchId;

    // Caja
    window.toggleHistoryView = toggleHistoryView;
    window.loadPastSession = loadPastSession;
    window.initCashView = initCashView;
    window.confirmOpenRegister = confirmOpenRegister;
    window.confirmCloseRegister = confirmCloseRegister;
    window.prepareCloseRegister = prepareCloseRegister;
    window.openExpenseModal = openExpenseModal;

    // Buscador Clientes
    window.openClientModalFromOrder = openClientModalFromOrder;
    window.selectClientForOrder = selectClientForOrder;
    window.clearClientSelection = clearClientSelection;

    // 6. INICIALIZAR COMPONENTES
    setupClientSearch();
    await loadGlobalData(); // Carga inteligente (evita 403 en cocina/delivery)
    setupForms();
    setupBranchSelector();
    initCashView();
    initUserLogic();

    // 🔥 CONFIGURAR FILTROS POR ROL (Aplica filtros visuales y clic inicial)
    if (typeof setupRoleViews === 'function') {
        setupRoleViews(role);
    }

    startLiveUpdate();
};


// ==========================================
// 📡 ACTUALIZACIÓN EN VIVO
// ==========================================
function startLiveUpdate() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    console.log("📡 Modo En Vivo activado: Buscando pedidos cada 15s...");

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
    const time = now.toLocaleTimeString();
    const label = document.getElementById('live-indicator');
    if (label) {
        label.innerHTML = `<span class="spinner-grow spinner-grow-sm text-danger" role="status"></span> Actualizado: ${time}`;
    }
}

// ==========================================
// 🔄 CARGA DE DATOS GLOBAL
// ==========================================
async function loadGlobalData() {
    try {
        // 1. VERIFICAR ROL ANTES DE CARGAR
        const rawRole = localStorage.getItem('user_role');
        const role = String(rawRole).toUpperCase();

        // 🔥 CORRECCIÓN: Agregamos 'WAITER', 'DELIVERY' y '3' a la lista de exclusión.
        // Si es Cocina o Delivery, NO cargamos datos administrativos (evita el error 403)
        if (['KITCHEN', '2', 'WAITER', 'DELIVERY', '3'].includes(role)) {
            console.log("🚀 Modo Staff (Cocina/Delivery): Omitiendo carga de datos globales restringidos.");
            loadOrders(); // Solo cargamos los pedidos, que es lo único que necesitan
            return;
        }

        // SI ES ADMIN: Cargamos todo normalmente
        const [categories, products, branches, ingredients, clients] = await Promise.all([
            apiCall('/Categories'),
            apiCall('/Products'),
            apiCall('/Branch'),
            apiCall('/Ingredient'),
            apiCall('/Client')
        ]);

        allCategories = categories || [];
        allProducts = products || [];
        allBranches = branches || [];
        allIngredients = ingredients || [];
        allClients = clients || [];

        if (allBranches.length > 0) {
            currentBranchId = allBranches[0].id;
            const bSelect = document.getElementById('branch-select');
            if (bSelect) bSelect.value = currentBranchId;
            // Solo intentamos cargar stock si somos admin (aunque el backend debería filtrar)
            try { await loadStock(currentBranchId); } catch (e) { }
        }

        renderCategories();
        renderProducts();
        renderIngredients();

        updateBranchSelect(allBranches);
        updateIngredientSelect(allIngredients);
        updateCategorySelect(allCategories);

        loadOrders();

        console.log("✅ Datos globales cargados");

    } catch (error) {
        // Si falla algo, capturamos el error para que no se congele la pantalla
        console.error("⚠️ Aviso: Algunos datos no se pudieron cargar (posible falta de permisos).", error);
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

                const orderDate = new Date(dateStr);
                if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
                    orderDate.setHours(orderDate.getHours() - 3);
                }

                return orderDate.getDate() === today.getDate() &&
                    orderDate.getMonth() === today.getMonth() &&
                    orderDate.getFullYear() === today.getFullYear();
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

        container.innerHTML = allOrders.map(order => createOrderCardHtml(order)).join('');
        attachAdvanceButtonListeners();

    } catch (e) {
        console.error(e);
        if (container.innerHTML.trim() === "") {
            container.innerHTML = `<div class="col-12 text-center text-danger py-5">Error de conexión.</div>`;
        }
    }
}

function createOrderCardHtml(order) {
    const timeString = formatFechaLocal(order.orderDate || order.orderDateIso);

    const statusColors = {
        'Pending': 'bg-warning text-dark', 'Confirmed': 'bg-info text-white',
        'Cooking': 'bg-primary text-white', 'Ready': 'bg-success text-white',
        'Delivered': 'bg-secondary text-white', 'Cancelled': 'bg-danger text-white'
    };
    const badgeClass = statusColors[order.currentStatus] || 'bg-secondary text-white';

    let actionButtonHtml = '';
    if (order.nextStatus && order.currentStatus !== 'Delivered' && order.currentStatus !== 'Cancelled') {
        actionButtonHtml = `
            <button class="btn btn-success btn-sm w-100 mb-2 advance-status-btn" 
                    data-order-id="${order.id}" data-next-status="${order.nextStatus}">
                Avanzar a ${translateStatus(order.nextStatus)}
            </button>
        `;
    }

    const count = order.itemsCount !== undefined ? order.itemsCount : (order.ItemsCount || 0);
    const paymentLabel = order.paymentMethod ? ` | ${translatePaymentMethod(order.paymentMethod)}` : '';

    return `
        <div class="col-12 col-md-6 col-lg-4 mb-3 fade-in">
            <div class="card h-100 order-card" data-order-id="${order.id}">
                <div class="card-header border-0 d-flex justify-content-between align-items-center pt-3 bg-transparent">
                    <span class="badge ${badgeClass}">${translateStatus(order.currentStatus)}${paymentLabel}</span>
                    <small class="text-muted fw-bold">#${order.id}</small>
                </div>
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="text-muted small"><i class="bi bi-clock"></i> ${timeString}</span>
                        <span class="fw-bold fs-5 text-primary">$${order.totalAmount}</span>
                    </div>
                    <div class="p-2 rounded small border" style="background-color: var(--bg-body);">
                        <strong>${count} Ítems</strong>
                    </div>
                </div>
                <div class="card-footer border-0 pb-3 bg-transparent">
                    ${actionButtonHtml}
                    <button class="btn btn-outline-secondary w-100" onclick="openOrderDetailModal(${order.id})">
                        Ver Detalle
                    </button>
                </div>
            </div>
        </div>
    `;
}

function attachAdvanceButtonListeners() {
    const buttons = document.querySelectorAll('.advance-status-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault(); e.stopPropagation();
            const orderId = this.getAttribute('data-order-id');
            const nextStatus = this.getAttribute('data-next-status');
            updateOrderStatus(orderId, nextStatus);
        });
    });
}

async function updateOrderStatus(orderId, nextStatus) {
    const btn = document.querySelector(`button[data-order-id="${orderId}"]`);
    if (btn) { btn.disabled = true; btn.textContent = "Actualizando..."; }
    try {
        await apiCall(`/Orders/${orderId}/status`, 'PUT', { newStatus: nextStatus, userId: 1 });
        await loadOrders();
    } catch (e) {
        alert("Error: " + e.message);
        if (btn) { btn.disabled = false; btn.textContent = "Reintentar"; }
    }
}

function translateStatus(status) {
    const map = {
        'Pending': 'Pendiente',
        'Confirmed': 'Confirmado',
        'Cooking': 'En Cocina',
        'Ready': 'Listo',
        'OnTheWay': 'En Camino',
        'Delivered': 'Entregado',
        'Cancelled': 'Cancelado'
    };
    // Si viene el número en vez del texto (por si acaso)
    const mapNum = {
        0: 'Cancelado', 1: 'Pendiente', 2: 'Confirmado',
        3: 'En Cocina', 4: 'Listo', 5: 'Entregado', 6: 'En Camino'
    };

    return map[status] || mapNum[status] || status;
}

function translatePaymentMethod(method) {
    const map = { 'Cash': '💵 Efectivo', 'MercadoPago': '📱 MercadoPago', 'Transfer': '🏦 Transferencia' };
    return map[method] || method;
}

// ==========================================
// 🧾 DETALLE PEDIDO (COMPLETO DINÁMICO)
// ==========================================
async function openOrderDetailModal(orderId) {
    // Referencia al título y al cuerpo del modal
    const modalTitle = document.getElementById('detail-order-id');
    const modalBody = document.querySelector('#orderDetailModal .modal-body');

    if (modalTitle) modalTitle.textContent = `Cargando Pedido #${orderId}...`;
    if (modalBody) modalBody.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2">Obteniendo datos...</p></div>';

    orderDetailModal.show();

    try {
        const order = await apiCall(`/Orders/${orderId}`);
        if (!order) throw new Error("No se encontraron datos.");

        if (modalTitle) modalTitle.textContent = `Pedido #${order.id}`;

        // Datos calculados
        const status = order.status || order.currentStatus;
        const totalFinal = order.totalAmount;
        const globalDisc = order.discount || 0;
        const subtotal = totalFinal + globalDisc;
        const isCancellable = (status !== 'Delivered' && status !== 'Cancelled');

        // Generar filas de items
        const itemsHtml = (order.items || []).map(item => {
            let discountHtml = '';
            if (item.discount > 0) {
                const itemPct = Math.round((item.discount / (item.unitPrice * item.quantity)) * 100);
                discountHtml = `<div class="badge bg-danger bg-opacity-10 text-danger border border-danger ms-2">${itemPct}% OFF</div>`;
            }
            return `
                <tr>
                    <td>
                        <div class="fw-bold">${item.productName}</div>
                        ${item.observation ? `<div class="text-muted small fst-italic"><i class="bi bi-pencil-fill me-1" style="font-size: 0.7rem;"></i>${item.observation}</div>` : ''}
                    </td>
                    <td class="text-center fw-bold">${item.quantity}</td>
                    <td class="text-end">$${item.unitPrice}${discountHtml}</td>
                    <td class="text-end fw-bold text-primary">$${item.subtotal}</td>
                </tr>`;
        }).join('');

        // Generar HTML completo del cuerpo
        // Aquí INYECTAMOS el Nombre y el Teléfono
        const contentHtml = `
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
                    <thead class="bg-body-tertiary">
                        <tr><th class="ps-3 border-0">Producto</th><th class="text-center border-0">Cant.</th><th class="text-end border-0">Unit.</th><th class="text-end pe-3 border-0">Subtotal</th></tr>
                    </thead>
                    <tbody>${itemsHtml || '<tr><td colspan="4" class="text-center">Sin ítems</td></tr>'}</tbody>
                </table>
            </div>

            <div class="border-top pt-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="text-muted">Forma de Pago:</span>
                    <span class="fw-bold">${translatePaymentMethod(order.paymentMethod || 'Cash')}</span>
                </div>
                <div class="d-flex justify-content-end align-items-center mb-1">
                    <span class="text-muted me-3">Subtotal:</span>
                    <span class="fw-bold">$${subtotal}</span>
                </div>
                ${globalDisc > 0 ? `
                <div class="d-flex justify-content-end align-items-center mb-1 text-danger">
                    <span class="me-3">Descuento Global:</span>
                    <span class="fw-bold">-$${globalDisc}</span>
                </div>` : ''}
                <div class="d-flex justify-content-end align-items-center mt-2">
                    <span class="fs-4 fw-bold text-body me-2">Total Final:</span>
                    <span class="fs-3 fw-bold text-primary">$${totalFinal}</span>
                </div>
            </div>

            ${isCancellable ? `
            <div class="mt-4 pt-3 border-top">
                <button id="btn-cancel-dynamic" class="btn btn-outline-danger w-100" onclick="cancelOrder(${order.id})">
                    <i class="bi bi-x-circle-fill"></i> Cancelar Pedido
                </button>
            </div>` : ''}
        `;

        if (modalBody) modalBody.innerHTML = contentHtml;

    } catch (e) {
        if (modalBody) modalBody.innerHTML = `<div class="text-danger text-center py-4">Error: ${e.message}</div>`;
    }
}

// ==========================================
// 🚫 CANCELAR PEDIDO
// ==========================================
async function cancelOrder(orderId) {
    if (!confirm("⚠️ ¿Estás SEGURO de cancelar este pedido?\n\nEsta acción no se puede deshacer.")) return;

    const btn = document.getElementById('btn-cancel-dynamic');
    if (btn) { btn.disabled = true; btn.textContent = "Cancelando..."; }

    try {
        await apiCall(`/Orders/${orderId}/cancel`, 'POST');
        alert("✅ Pedido cancelado correctamente.");
        orderDetailModal.hide();
        loadGlobalData(); // Recargar el tablero para ver el cambio de estado
    } catch (e) {
        alert("Error al cancelar: " + e.message);
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
        clients = clients || [];

        const clientsWithAddress = await Promise.all(clients.map(async (c) => {
            try {
                const addrs = await apiCall(`/Client/${c.id}/addresses`);
                return { ...c, addresses: addrs || [] };
            } catch (e) { return { ...c, addresses: [] }; }
        }));
        allClients = clientsWithAddress;

        if (allClients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay clientes.</td></tr>';
            return;
        }

        tbody.innerHTML = allClients.map(c => {
            const addressBadges = c.addresses && c.addresses.length > 0
                ? c.addresses.map(a => `
                    <div class="d-flex align-items-center justify-content-between badge border text-muted fw-normal w-100 mb-1">
                        <span class="text-truncate me-2"><i class="bi bi-house-door text-danger"></i> <b>${a.label}:</b> ${a.fullAddress || (a.street)}</span>
                        <div class="text-nowrap">
                            <i class="bi bi-pencil-square text-primary cursor-pointer me-2" onclick="editAddress(${c.id}, ${a.id})" title="Editar"></i>
                            <i class="bi bi-x-circle text-danger cursor-pointer" onclick="deleteAddress(${c.id}, ${a.id})" title="Borrar"></i>
                        </div>
                    </div>`).join('')
                : '<span class="text-muted small fst-italic">Sin dirección</span>';

            return `<tr>
                <td class="ps-4 fw-bold">#${c.id}</td>
                <td>${c.name} ${c.lastName}</td>
                <td>${c.phone}</td>
                <td class="text-end pe-4" style="min-width: 250px;">
                    <div class="d-flex flex-column align-items-end">
                        ${addressBadges}
                        <div class="btn-group mt-1">
                            <button class="btn btn-sm btn-outline-secondary" onclick="viewClientOrders(${c.id})">
                                <i class="bi bi-journal-text"></i> Ver Pedidos
                            </button>
                            <button class="btn btn-sm btn-link text-decoration-none" onclick="openAddressModal(${c.id})">+ Dir</button>
                        </div>
                    </div>
                </td>
            </tr>`;
        }).join('');
    } catch (e) { tbody.innerHTML = `<tr><td colspan="4" class="text-danger text-center">Error: ${e.message}</td></tr>`; }
}

function prepareClientModal() {
    document.getElementById('client-name').value = '';
    document.getElementById('client-lastname').value = '';
    document.getElementById('client-phone').value = '';

    // 🔥 CORRECCIÓN: Limpiar también los campos de dirección
    const street = document.getElementById('client-addr-street');
    const city = document.getElementById('client-addr-city');
    const label = document.getElementById('client-addr-label');

    if (street) street.value = '';
    if (city) city.value = 'Ciudad de la Costa';
    if (label) label.value = 'Casa';

    clientModal.show();
}

function openAddressModal(clientId) {
    currentClientIdForAddress = clientId;
    editingAddressId = null;
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

    currentClientIdForAddress = clientId;
    editingAddressId = addressId;
    document.getElementById('addr-client-id').value = clientId;
    let streetVal = addr.street;
    if (!streetVal && addr.fullAddress) streetVal = addr.fullAddress.split(',')[0];

    document.getElementById('addr-street').value = streetVal || '';
    document.getElementById('addr-city').value = addr.city || 'Ciudad de la Costa';
    document.getElementById('addr-label').value = addr.label || 'Casa';
    addressModal.show();
}

async function deleteAddress(clientId, addressId) {
    if (!confirm("¿Borrar esta dirección?")) return;
    try {
        await apiCall(`/Client/address/${addressId}`, 'DELETE');
        await loadClients();
    } catch (e) { alert("Error al borrar: " + e.message); }
}

async function viewClientOrders(clientId) {
    const client = allClients.find(c => c.id === clientId);
    if (document.getElementById('clientOrdersTitle')) {
        document.getElementById('clientOrdersTitle').textContent = `Pedidos de ${client.name} ${client.lastName}`;
    }

    const tbody = document.getElementById('client-orders-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Buscando pedidos...</td></tr>';

    clientOrdersModal.show();

    try {
        const orders = await apiCall(`/Orders/client/${clientId}`);

        if (!orders || orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Este cliente no tiene pedidos.</td></tr>';
            return;
        }

        orders.sort((a, b) => b.id - a.id);

        tbody.innerHTML = orders.map(o => {
            const d = new Date(o.orderDate || o.orderDateIso);
            if (!(o.orderDate || o.orderDateIso).endsWith('Z')) {
                d.setHours(d.getHours() - 3);
            }
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const mins = String(d.getMinutes()).padStart(2, '0');
            const formattedDate = `${year}-${month}-${day}T${hours}:${mins}`;

            return `
            <tr>
                <td class="align-middle fw-bold">#${o.id}</td>
                <td class="align-middle">
                    <input type="datetime-local" class="form-control form-control-sm" id="date-order-${o.id}" value="${formattedDate}">
                </td>
                <td class="align-middle"><span class="badge bg-secondary">${translateStatus(o.currentStatus)}</span></td>
                <td class="align-middle fw-bold">$${o.totalAmount}</td>
                <td class="text-end align-middle">
                    <button class="btn btn-sm btn-primary" onclick="updateOrderDateTime(${o.id})">
                        <i class="bi bi-save"></i> Guardar
                    </button>
                </td>
            </tr>`;
        }).join('');

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">Error: ${e.message}</td></tr>`;
    }
}

async function updateOrderDateTime(orderId) {
    const input = document.getElementById(`date-order-${orderId}`);
    if (!input || !input.value) return alert("Selecciona una fecha válida");

    try {
        await apiCall(`/Orders/${orderId}/date`, 'PUT', { newDate: input.value });
        alert("✅ Fecha actualizada correctamente");
        if (window.loadDashboard) window.loadDashboard();
    } catch (e) {
        alert("Error al actualizar fecha: " + e.message);
    }
}

// ==========================================
// 📦 STOCK
// ==========================================
async function loadStock(branchId) {
    const tbody = document.getElementById('stock-table');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-3">Cargando inventario...</td></tr>`;
    try {
        if (!allIngredients || allIngredients.length === 0) {
            allIngredients = await apiCall('/Ingredient') || [];
        }
        const data = await apiCall(`/BranchStock/branch/${branchId}`);
        const validItems = (data || []).filter(item => allIngredients.some(ing => ing.id === item.ingredientId));
        if (validItems.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">El inventario está vacío.</td></tr>`; return; }
        renderStockTable(validItems);
    } catch (e) { tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Error al cargar stock.</td></tr>`; }
}

function renderStockTable(stockItems) {
    const tbody = document.getElementById('stock-table');
    tbody.innerHTML = stockItems.map(item => {
        const ing = allIngredients.find(x => x.id === item.ingredientId);
        if (!ing) return '';
        const min = item.minimumStockAlert || 0;
        const isLow = item.currentStock < min;
        const badge = isLow ? '<span class="badge bg-danger">BAJO</span>' : '<span class="badge bg-success">OK</span>';
        return `<tr><td class="ps-4 fw-medium">${ing.name}</td><td>${ing.unitOfMeasure}</td><td class="fw-bold ${isLow ? 'text-danger' : ''}">${item.currentStock}</td><td>${min}</td><td>${badge}</td><td class="text-end pe-4"><button class="btn btn-sm btn-outline-primary" onclick="prepareStockModal(${item.ingredientId})">Ajustar</button></td></tr>`;
    }).join('');
}

function prepareStockModal(ingId = null) {
    document.getElementById('stock-branch-id').value = currentBranchId;
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
        if (!items || !items.length) {
            tb.innerHTML = '<tr><td colspan="3" class="text-muted text-center py-3">Sin ingredientes.</td></tr>';
            return;
        }
        tb.innerHTML = items.map(i => {
            const name = i.ingredientName || i.IngredientName || "Ingrediente";
            const qty = i.quantity || i.Quantity || 0;
            const unit = i.unit || i.Unit || "";
            const ingId = i.ingredientId || i.IngredientId;
            return `<tr><td class="align-middle">${name}</td><td class="fw-bold align-middle">${qty} ${unit}</td><td class="text-end align-middle"><button class="btn btn-sm btn-outline-danger" onclick="removeIngredientFromRecipe(${pid}, ${ingId})" title="Eliminar"><i class="bi bi-trash"></i></button></td></tr>`;
        }).join('');
    } catch (e) { console.error("Error cargando receta:", e); tb.innerHTML = '<tr><td colspan="3" class="text-danger text-center">Error al cargar receta.</td></tr>'; }
}

async function addIngredientToRecipe() {
    const iId = parseInt(document.getElementById('recipe-ingredient-select').value),
        qty = parseFloat(document.getElementById('recipe-quantity').value);
    if (!iId || !qty) return alert("Datos inválidos");
    try {
        await apiCall('/ProductIngredient', 'POST', { productId: currentProductIdForRecipe, ingredientId: iId, quantity: qty });
        document.getElementById('recipe-quantity').value = '';
        await loadRecipeItems(currentProductIdForRecipe);
    } catch (e) { alert(e.message); }
}

async function removeIngredientFromRecipe(productId, ingredientId) {
    if (!productId || !ingredientId) { alert("Error: IDs inválidos."); return; }
    if (confirm("¿Quitar ingrediente de la receta?")) {
        try {
            await apiCall(`/ProductIngredient/product/${productId}/ingredient/${ingredientId}`, 'DELETE');
            await loadRecipeItems(productId);
        } catch (e) { alert("Error al borrar: " + e.message); }
    }
}

// ==========================================
// 🏗️ ABMs
// ==========================================
function renderCategories() { const tb = document.getElementById('categories-table'); if (tb) tb.innerHTML = allCategories.map(c => `<tr><td class="ps-4 fw-bold">${c.name}</td><td class="small">${c.description || '-'}</td><td class="text-end pe-4"><button class="btn btn-sm text-primary" onclick="editCategory(${c.id})"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm text-danger" onclick="deleteCategory(${c.id})"><i class="bi bi-trash"></i></button></td></tr>`).join(''); }
function editCategory(id) { const c = allCategories.find(x => x.id === id); if (c) { prepareCategoryModal(id); document.getElementById('cat-name').value = c.name; document.getElementById('cat-desc').value = c.description; catModal.show(); } }
function prepareCategoryModal(id = null) { document.getElementById('cat-id').value = id || ''; document.getElementById('cat-name').value = ''; document.getElementById('cat-desc').value = ''; const title = document.getElementById('catModalTitle'); if (title) title.textContent = id ? 'Editar' : 'Nueva'; }
async function deleteCategory(id) { if (confirm("¿Eliminar?")) try { await apiCall(`/Categories/${id}`, 'DELETE'); await loadGlobalData(); } catch (e) { alert(e.message); } }
function renderProducts() { const tb = document.getElementById('products-table'); if (tb) tb.innerHTML = allProducts.map(p => { const cName = allCategories.find(c => c.id == p.categoryId)?.name || '-'; return `<tr><td class="ps-4"><div style="width:40px;height:40px;background:#eee;border-radius:8px;overflow:hidden;">${p.imageUrl ? `<img src="${p.imageUrl}" style="width:100%;height:100%;object-fit:cover;">` : ''}</div></td><td class="fw-bold">${p.name}</td><td><span class="badge bg-light text-secondary border">${cName}</span></td><td class="fw-bold text-success">$${p.price}</td><td class="text-end pe-4"><button class="btn btn-sm me-1" onclick="openRecipeModal(${p.id})"><i class="bi bi-list-check"></i></button><button class="btn btn-sm text-primary" onclick="editProduct(${p.id})"><i class="bi bi-pencil"></i></button><button class="btn btn-sm text-danger" onclick="deleteProduct(${p.id})"><i class="bi bi-trash"></i></button></td></tr>`; }).join(''); }
function prepareProductModal(id = null) { document.getElementById('prod-id').value = id || ''; document.getElementById('prod-name').value = ''; document.getElementById('prod-price').value = ''; document.getElementById('prod-desc').value = ''; document.getElementById('prod-img').value = ''; const title = document.getElementById('prodModalTitle'); if (title) title.textContent = id ? 'Editar' : 'Nuevo'; updateCategorySelect(allCategories); }
function editProduct(id) { const p = allProducts.find(x => x.id === id); if (p) { prepareProductModal(id); document.getElementById('prod-name').value = p.name; document.getElementById('prod-price').value = p.price; document.getElementById('prod-desc').value = p.description; document.getElementById('prod-img').value = p.imageUrl; document.getElementById('prod-category').value = p.categoryId; prodModal.show(); } }
async function deleteProduct(id) { if (confirm("¿Eliminar?")) try { await apiCall(`/Products/${id}`, 'DELETE'); await loadGlobalData(); } catch (e) { alert(e.message); } }
function renderIngredients() { const tb = document.getElementById('ingredients-table'); if (tb) tb.innerHTML = allIngredients.map(i => `<tr><td class="ps-4 fw-bold">${i.name}</td><td>${i.unitOfMeasure || ''}</td><td class="text-end pe-4"><button class="btn btn-sm text-primary" onclick="editIngredient(${i.id})"><i class="bi bi-pencil"></i></button><button class="btn btn-sm text-danger" onclick="deleteIngredient(${i.id})"><i class="bi bi-trash"></i></button></td></tr>`).join(''); }
function prepareIngredientModal(id = null) { document.getElementById('ing-id').value = id || ''; document.getElementById('ing-name').value = ''; document.getElementById('ing-unit').value = ''; const title = document.getElementById('ingModalTitle'); if (title) title.textContent = id ? 'Editar' : 'Nuevo'; }
function editIngredient(id) { const i = allIngredients.find(x => x.id === id); if (i) { prepareIngredientModal(id); document.getElementById('ing-name').value = i.name; document.getElementById('ing-unit').value = i.unitOfMeasure || i.unit; ingModal.show(); } }
async function deleteIngredient(id) { if (confirm("¿Eliminar?")) try { await apiCall(`/Ingredient/${id}`, 'DELETE'); await loadGlobalData(); } catch (e) { alert(e.message); } }
function updateBranchSelect(l) { const el = document.getElementById('branch-select'); if (el) el.innerHTML = l.map(b => `<option value="${b.id}">${b.name}</option>`).join(''); }
function updateIngredientSelect(l) { const el = document.getElementById('stock-ingredient-id'); if (el) el.innerHTML = '<option value="">Selecciona...</option>' + l.map(i => `<option value="${i.id}">${i.name}</option>`).join(''); }
function updateCategorySelect(l) { const el = document.getElementById('prod-category'); if (el) el.innerHTML = '<option value="">Selecciona...</option>' + l.map(c => `<option value="${c.id}">${c.name}</option>`).join(''); }
function setupBranchSelector() { const el = document.getElementById('branch-select'); if (el) el.addEventListener('change', (e) => { currentBranchId = parseInt(e.target.value); loadStock(currentBranchId); }); }

// ==========================================
// 📝 CONFIGURACIÓN DE FORMULARIOS
// ==========================================
function setupForms() {
    const setup = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('submit', fn); };

    setup('category-form', async (e) => { e.preventDefault(); const id = document.getElementById('cat-id').value; try { await apiCall(id ? `/Categories/${id}` : '/Categories', id ? 'PUT' : 'POST', { id: id ? parseInt(id) : 0, name: document.getElementById('cat-name').value, description: document.getElementById('cat-desc').value }); catModal.hide(); await loadGlobalData(); } catch (e) { alert(e.message); } });
    setup('product-form', async (e) => { e.preventDefault(); const id = document.getElementById('prod-id').value; try { await apiCall(id ? `/Products/${id}` : '/Products', id ? 'PUT' : 'POST', { id: id ? parseInt(id) : 0, name: document.getElementById('prod-name').value, description: document.getElementById('prod-desc').value, price: parseFloat(document.getElementById('prod-price').value), imageUrl: document.getElementById('prod-img').value, categoryId: parseInt(document.getElementById('prod-category').value) }); prodModal.hide(); await loadGlobalData(); } catch (e) { alert(e.message); } });
    setup('ingredient-form', async (e) => { e.preventDefault(); const id = document.getElementById('ing-id').value; try { await apiCall(id ? `/Ingredient/${id}` : '/Ingredient', id ? 'PUT' : 'POST', { id: id ? parseInt(id) : 0, name: document.getElementById('ing-name').value, unitOfMeasure: document.getElementById('ing-unit').value }); ingModal.hide(); await loadGlobalData(); } catch (e) { alert(e.message); } });
    setup('stock-form', async (e) => { e.preventDefault(); const qty = parseFloat(document.getElementById('stock-quantity').value) || 0; const min = document.getElementById('stock-min').value ? parseFloat(document.getElementById('stock-min').value) : null; const type = document.getElementById('stock-type').value; if (qty > 0 && !type) { alert('Selecciona tipo'); return; } if (qty === 0 && min === null) { alert('Ingresa datos'); return; } try { await apiCall('/BranchStock/movement', 'POST', { branchId: parseInt(document.getElementById('stock-branch-id').value), ingredientId: parseInt(document.getElementById('stock-ingredient-id').value), quantity: qty, movementType: type || "IN", minimumStock: min }); stockModal.hide(); await loadStock(currentBranchId); } catch (e) { alert(e.message); } });

    // --- 🔥 LÓGICA DE CREACIÓN DE CLIENTE + DIRECCIÓN (Corregida) ---
    setup('client-form', async (e) => {
        e.preventDefault();
        const clientPayload = {
            name: document.getElementById('client-name').value,
            lastName: document.getElementById('client-lastname').value,
            phone: document.getElementById('client-phone').value
        };
        const addressPayload = {
            street: document.getElementById('client-addr-street').value,
            city: document.getElementById('client-addr-city').value,
            label: document.getElementById('client-addr-label').value,
            region: 'Canelones', postalCode: '15000', country: 'UY'
        };

        try {
            const newClient = await apiCall('/Client', 'POST', clientPayload);
            if (newClient && newClient.id) {
                await apiCall(`/Client/${newClient.id}/addresses`, 'POST', addressPayload);
                alert('¡Cliente guardado!');
                clientModal.hide();
                await loadGlobalData(); // Recarga la lista global con el nuevo cliente

                // Si se abrió desde un pedido, lo selecciona automáticamente
                if (isCreatingOrderContext) {
                    selectClientForOrder(newClient.id, `${newClient.name} ${newClient.lastName}`, newClient.phone);
                    isCreatingOrderContext = false;
                }
            }
        } catch (e) { alert("Error: " + e.message); }
    });

    setup('address-form', async (e) => { e.preventDefault(); const clientId = document.getElementById('addr-client-id').value; if (!clientId) { alert("Error: No se seleccionó cliente."); return; } const payload = { street: document.getElementById('addr-street').value, city: document.getElementById('addr-city').value, region: 'Canelones', postalCode: '15000', country: 'UY', label: document.getElementById('addr-label').value }; try { if (editingAddressId) { await apiCall(`/Client/address/${editingAddressId}`, 'PUT', { ...payload, id: editingAddressId, clientId: parseInt(clientId) }); } else { await apiCall(`/Client/${clientId}/addresses`, 'POST', payload); } addressModal.hide(); await loadClients(); } catch (e) { alert("Error al guardar: " + e.message); } });
}



// ==========================================
// 📊 DASHBOARD (Lógica de Negocio & Gráficos)
// ==========================================
let salesChartInstance = null;
let topProductsChartInstance = null; // 🔥 Variable renombrada
let peakHoursChartInstance = null;

// Función para reiniciar el filtro a "Hoy" (Turno Actual)
window.resetDashboardDate = function() {
    const startInput = document.getElementById('dash-date-start');
    const endInput = document.getElementById('dash-date-end');
    if(startInput) startInput.value = '';
    if(endInput) endInput.value = '';
    loadDashboard();
}

async function loadDashboard() {
    console.log("📊 Cargando Dashboard Pro...");
    
    try {
        // 1. Obtener fechas de los inputs (si existen)
        const start = document.getElementById('dash-date-start')?.value;
        const end = document.getElementById('dash-date-end')?.value;
        
        // 2. Construir URL con Query Params
        let url = '/reports/dashboard';
        if(start && end) {
            url += `?startDate=${start}&endDate=${end}`;
        }

        // 3. Llamada al API
        const data = await apiCall(url);
        
        // Si no hay datos o falló la conexión
        if (!data) return;

        // 4. Renderizar KPIs (Tarjetas Superiores)
        animateValue("dash-today-revenue", data.todayRevenue, "$");
        animateValue("dash-today-count", data.todayOrdersCount);
        animateValue("dash-avg-ticket", data.averageTicket, "$");

        //
        const timeEl = document.getElementById('dash-avg-time');
        if (timeEl) timeEl.textContent = data.averageDeliveryTime;
        
        // Renderizar Pendientes
        const pendingEl = document.getElementById('dash-pending');
        if(pendingEl) pendingEl.textContent = data.pendingOrders || 0;

        // Renderizar Alertas de Stock
        const stockLabel = document.getElementById('dash-low-stock');
        if(stockLabel) {
            const lowCount = data.lowStockCount || 0;
            stockLabel.textContent = lowCount > 0 ? `(${lowCount} Alertas)` : "(Sin alertas)";
            stockLabel.className = lowCount > 0 ? "text-danger fw-bold ms-2" : "text-muted ms-2";
        }

        // 5. Renderizar Gráficos
        if(data.last7DaysSales) renderSalesChart(data.last7DaysSales);
        // 🔥 Usamos la nueva función para Top Productos
        if(data.salesByCategory) renderTopProductsChart(data.salesByCategory);
        if(data.peakHours) renderPeakHoursChart(data.peakHours);

    } catch (error) {
        console.error("Error cargando dashboard:", error);
    }
}

// Utilidad para mostrar números con seguridad
function animateValue(id, value, prefix = "") {
    const el = document.getElementById(id);
    if (!el) return;
    const safeValue = value || 0; 
    el.textContent = `${prefix}${safeValue.toLocaleString('es-UY')}`;
}

// ---------------------------------------------
// 📈 LÓGICA DE GRÁFICOS (Chart.js)
// ---------------------------------------------

// 1. Evolución de Ventas (Barras Verticales)
function renderSalesChart(data) {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;
    
    if (salesChartInstance) salesChartInstance.destroy();

    salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.label),
            datasets: [{
                label: 'Ventas ($)',
                data: data.map(d => d.value),
                backgroundColor: 'rgba(13, 110, 253, 0.7)', // Azul Bootstrap
                borderColor: '#0d6efd',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: { label: c => '$ ' + c.raw.toLocaleString('es-UY') }
                }
            },
            scales: { y: { beginAtZero: true } }
        }
    });
}

// 🔥 2. Top Productos (Barras Horizontales)
function renderTopProductsChart(data) {
    const ctx = document.getElementById('topProductsChart'); // 🔥 ID actualizado
    if (!ctx) return;
    
    if (topProductsChartInstance) topProductsChartInstance.destroy();

    topProductsChartInstance = new Chart(ctx, {
        type: 'bar', // Usamos barras...
        data: {
            labels: data.map(d => d.label), // Nombres de productos
            datasets: [{
                label: 'Unidades Vendidas',
                data: data.map(d => d.value),
                backgroundColor: [ // Colores variados para que se vea bien
                    '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff'
                ],
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y', // 🔥 Esto hace que las barras sean horizontales
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }, // No hace falta leyenda
                tooltip: {
                    callbacks: { label: c => `${c.raw} unidades` }
                }
            },
            scales: { 
                x: { beginAtZero: true } // El eje X ahora es el de valores
            }
        }
    });
}

// 3. Horas Pico (Línea de Área)
function renderPeakHoursChart(data) {
    const ctx = document.getElementById('peakHoursChart');
    if (!ctx) return;
    
    if (peakHoursChartInstance) peakHoursChartInstance.destroy();

    peakHoursChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.label),
            datasets: [{
                label: 'Pedidos Promedio',
                data: data.map(d => d.value),
                borderColor: '#dc3545', // Rojo Bootstrap
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#dc3545'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: c => `${c.raw} pedidos aprox.` } }
            }
        }
    });
}

// ==========================================
// 💰 GESTIÓN DE CAJA (ARQUEO)
// ==========================================

let cashStatus = { isOpen: false, openTime: null, initialBalance: 0 };

// 1. FUNCIÓN MAESTRA DE FECHA OPERATIVA
function getOperationalDate() {
    const now = new Date();
    if (now.getHours() < 4) { now.setDate(now.getDate() - 1); }
    now.setHours(0, 0, 0, 0);
    return now;
}

// 2. Inicialización de la vista Caja
async function initCashView() {
    const expForm = document.getElementById('expense-form');
    if (expForm) {
        const newForm = expForm.cloneNode(true);
        expForm.parentNode.replaceChild(newForm, expForm);
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await addCashMovement();
        });
    }
    await loadCashInfo();
}

// 3. Cargar Información de Caja
async function loadCashInfo() {
    try {
        const data = await apiCall('/CashRegister/status');
        cashStatus = data || { isOpen: false };
    } catch (e) {
        console.warn("Usando modo offline/fallback para caja");
        const stored = localStorage.getItem('cash_session');
        if (stored) cashStatus = JSON.parse(stored);
    }
    renderCashUI();
}

// 4. Renderizar la Interfaz DETALLADA
function renderCashUI() {
    const badge = document.getElementById('cash-status-badge');
    const actions = document.getElementById('cash-actions');
    const openTimeLbl = document.getElementById('cash-open-time');

    if (!badge || !actions) return;

    // --- MODO HISTORIAL O CAJA ABIERTA ---
    if (cashStatus.isOpen || cashStatus.isHistory) {
        badge.className = cashStatus.isOpen ? 'badge bg-success' : 'badge bg-secondary';
        badge.textContent = cashStatus.isOpen ? 'Abierta' : 'Cerrada (Histórico)';

        let timeTxt = `Desde: ${formatFechaLocal(cashStatus.openTime)}`;
        if (cashStatus.closeTime) timeTxt += ` hasta ${formatFechaLocal(cashStatus.closeTime)}`;
        openTimeLbl.textContent = timeTxt;

        // Si es historial, NO mostramos botones de acción
        if (cashStatus.isHistory) {
            actions.innerHTML = '<span class="badge bg-warning text-dark border border-dark">Modo Lectura</span>';
        } else {
            // Botones normales de caja abierta
            actions.innerHTML = `
                <button class="btn btn-danger btn-sm" onclick="prepareCloseRegister()">
                    <i class="bi bi-lock-fill"></i> Cerrar Caja
                </button>
                <button class="btn btn-warning btn-sm text-dark ms-2" onclick="openExpenseModal()">
                    <i class="bi bi-cash-stack"></i> Nuevo Movimiento
                </button>
            `;
        }

        const orders = cashStatus.orders || [];
        const movements = cashStatus.movements || [];

        const listCash = orders.filter(o => o.paymentMethod === 'Cash' || o.paymentMethod === 0);
        const listMP = orders.filter(o => o.paymentMethod === 'MercadoPago' || o.paymentMethod === 1);
        const listTransfer = orders.filter(o => o.paymentMethod === 'Transfer' || o.paymentMethod === 3);
        const listExpenses = movements.filter(m => m.type === 'OUT');
        const listIncomes = movements.filter(m => m.type === 'IN');


        const totalCash = listCash.reduce((acc, o) => acc + o.totalAmount, 0);
        const totalMP = listMP.reduce((acc, o) => acc + o.totalAmount, 0);
        const totalTransfer = listTransfer.reduce((acc, o) => acc + o.totalAmount, 0);
        const totalExpenses = listExpenses.reduce((acc, m) => acc + m.amount, 0);
        const totalIncomes = listIncomes.reduce((acc, m) => acc + m.amount, 0);
        const initial = cashStatus.initialBalance || 0;
        const expected = initial + totalCash + totalIncomes - totalExpenses;

        document.getElementById('cash-initial').textContent = `$${initial}`;
        document.getElementById('cash-total-cash').textContent = `$${totalCash}`;
        document.getElementById('cash-total-mp').textContent = `$${totalMP}`;
        document.getElementById('cash-total-transfer').textContent = `$${totalTransfer}`;
        document.getElementById('cash-total-expenses').textContent = `$${totalExpenses}`;
        document.getElementById('cash-expected').textContent = `$${expected}`;

        const renderList = (containerId, items, isExpense = false) => {
            const container = document.getElementById(containerId);
            if (!items.length) {
                container.innerHTML = '<li class="list-group-item text-muted fst-italic py-3 text-center">Sin movimientos</li>';
                return;
            }
            container.innerHTML = items.map(item => `
                <li class="list-group-item d-flex justify-content-between align-items-center px-3 py-2">
                    <span class="text-truncate" style="max-width: 65%;">
                        ${isExpense ? item.description : item.clientName}
                    </span>
                    <span class="fw-bold ${isExpense ? 'text-danger' : 'text-dark'}">
                        $${isExpense ? item.amount : item.totalAmount}
                    </span>
                </li>
            `).join('');
        };

        renderList('list-cash', listCash);
        renderList('list-mp', listMP);
        renderList('list-transfer', listTransfer);
        renderList('list-expenses', listExpenses, true);

    } else {
        // --- CAJA CERRADA ---
        badge.className = 'badge bg-secondary';
        badge.textContent = 'Cerrada';
        openTimeLbl.textContent = '-';
        actions.innerHTML = `<button class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#openRegisterModal"><i class="bi bi-unlock-fill"></i> Abrir Caja</button>`;

        ['cash-initial', 'cash-total-cash', 'cash-total-mp', 'cash-total-transfer', 'cash-total-expenses', 'cash-expected']
            .forEach(id => document.getElementById(id).textContent = '$0');

        ['list-cash', 'list-mp', 'list-transfer', 'list-expenses']
            .forEach(id => document.getElementById(id).innerHTML = '');
    }
}

// 5. Abrir Caja
async function confirmOpenRegister() {
    const amount = parseFloat(document.getElementById('open-amount').value) || 0;
    const payload = {
        initialBalance: amount,
        openTime: new Date().toISOString(),
        operationalDate: getOperationalDate().toISOString()
    };
    try {
        await apiCall('/CashRegister/open', 'POST', payload);
        const modalEl = document.getElementById('openRegisterModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        await loadCashInfo();
        alert("✅ Caja Abierta.");
    } catch (e) { alert("Error al abrir: " + e.message); }
}

// 6. Preparar Cierre
function prepareCloseRegister() {
    const expected = document.getElementById('cash-expected').textContent;
    document.getElementById('modal-expected-amount').textContent = expected;
    document.getElementById('close-real-amount').value = '';
    document.getElementById('close-notes').value = '';
    const modalEl = document.getElementById('closeRegisterModal');
    if (modalEl) { const modal = new bootstrap.Modal(modalEl); modal.show(); }
}

// 7. Cerrar Caja
async function confirmCloseRegister() {
    const realAmount = parseFloat(document.getElementById('close-real-amount').value) || 0;
    const notes = document.getElementById('close-notes').value;
    const expectedText = document.getElementById('modal-expected-amount').textContent;
    const expected = parseFloat(expectedText.replace('$', '')) || 0;
    const difference = realAmount - expected;

    const payload = { finalBalance: realAmount, notes: notes, closeTime: new Date().toISOString() };

    try {
        await apiCall('/CashRegister/close', 'POST', payload);
        const modalEl = document.getElementById('closeRegisterModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        await loadCashInfo();
        let msg = "✅ Caja Cerrada.";
        if (difference < 0) msg += `\n⚠️ Faltante: $${Math.abs(difference)}`;
        if (difference > 0) msg += `\n🤑 Sobrante: $${difference}`;
        alert(msg);
    } catch (e) { alert("Error al cerrar: " + e.message); }
}

// 8. Abrir Modal de Gastos
window.openExpenseModal = function () {
    const modalEl = document.getElementById('expenseModal');
    if (modalEl) {
        document.getElementById('expense-amount').value = '';
        document.getElementById('expense-desc').value = '';
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    } else { console.error("No se encuentra el modal #expenseModal"); }
};

// 9. Guardar Movimiento
async function addCashMovement() {
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const desc = document.getElementById('expense-desc').value;
    const type = document.getElementById('expense-type').value;

    if (!amount || !desc) { alert("Ingresa monto y descripción"); return; }

    try {
        await apiCall('/CashRegister/movement', 'POST', { type: type || "OUT", amount: amount, description: desc });
        const modalEl = document.getElementById('expenseModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        await loadCashInfo();
        alert("Movimiento registrado.");
    } catch (e) { alert("Error: " + e.message); }
}

// ==========================================
// 📜 HISTORIAL DE CAJA
// ==========================================

async function toggleHistoryView() {
    const section = document.getElementById('cash-history-section');
    if (section.classList.contains('d-none')) {
        section.classList.remove('d-none');
        await loadCashHistoryTable();
    } else {
        section.classList.add('d-none');
    }
}

async function loadCashHistoryTable() {
    const tbody = document.getElementById('cash-history-table');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando...</td></tr>';
    try {
        const history = await apiCall('/CashRegister/history');
        if (!history || history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay cierres anteriores.</td></tr>';
            return;
        }
        tbody.innerHTML = history.map(h => {
            const diffClass = h.difference < 0 ? 'text-danger' : (h.difference > 0 ? 'text-success' : 'text-muted');
            const diffIcon = h.difference < 0 ? '📉' : (h.difference > 0 ? '📈' : '✅');
            return `<tr><td class="fw-bold">#${h.id}</td><td>${formatFechaCompleta(h.openTime)}</td><td>${formatFechaCompleta(h.closeTime)}</td><td class="fw-bold">$${h.finalBalance}</td><td class="${diffClass}">${diffIcon} $${h.difference}</td><td><button class="btn btn-sm btn-outline-primary" onclick="loadPastSession(${h.id})">Ver Detalle</button></td></tr>`;
        }).join('');
    } catch (e) { tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Error: ${e.message}</td></tr>`; }
}

async function loadPastSession(id) {
    try {
        const data = await apiCall(`/CashRegister/session/${id}`);
        cashStatus = data;
        document.getElementById('cash-history-section').classList.add('d-none');
        const banner = document.getElementById('history-warning-banner');
        const lbl = document.getElementById('hist-date-lbl');
        if (banner) banner.classList.remove('d-none');
        if (lbl) lbl.textContent = formatFechaCompleta(data.closeTime);
        renderCashUI();
    } catch (e) { alert("Error al cargar sesión: " + e.message); }
}
// ==========================================
// 🔍 BUSCADOR DE CLIENTES (CORREGIDO)
// ==========================================
function setupClientSearch() {
    const input = document.getElementById('client-search-input');
    const resultsContainer = document.getElementById('client-search-results');

    if (!input || !resultsContainer) return;

    input.addEventListener('input', function (e) {
        const term = e.target.value.toLowerCase();

        if (term.length < 2) {
            resultsContainer.style.display = 'none';
            return;
        }

        const matches = allClients.filter(c => {
            // 1. Unimos nombre y apellido, manejando nulos
            const fullName = ((c.name || '') + ' ' + (c.lastName || '')).toLowerCase();

            // 2. 🔥 FIX CRÍTICO: Convertimos el teléfono a String para que .includes() no falle
            const phoneStr = String(c.phone || '');

            return fullName.includes(term) || phoneStr.includes(term);
        });

        if (matches.length > 0) {
            resultsContainer.innerHTML = matches.map(c => `
                <a href="#" class="list-group-item list-group-item-action" 
                   onclick="selectClientForOrder(${c.id}, '${c.name} ${c.lastName}', '${c.phone}')">
                    <div class="d-flex justify-content-between">
                        <strong>${c.name} ${c.lastName}</strong>
                        <small class="text-muted">${c.phone}</small>
                    </div>
                </a>`).join('');
            resultsContainer.style.display = 'block';
        } else {
            resultsContainer.innerHTML = '<div class="list-group-item text-muted">No encontrado</div>';
            resultsContainer.style.display = 'block';
        }
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.style.display = 'none';
        }
    });
}

async function selectClientForOrder(id, name, phone) {
    document.getElementById('selected-client-id').value = id;
    document.getElementById('selected-client-name').textContent = `${name} (${phone})`;
    document.getElementById('client-search-results').style.display = 'none';
    document.getElementById('client-search-input').parentElement.classList.add('d-none');
    document.getElementById('selected-client-display').classList.remove('d-none');
    await loadClientAddressesForOrder(id);
}

function clearClientSelection() {
    document.getElementById('selected-client-id').value = '';
    document.getElementById('order-address-id').innerHTML = '<option value="">Selecciona cliente primero...</option>';
    document.getElementById('selected-client-display').classList.add('d-none');
    document.getElementById('client-search-input').parentElement.classList.remove('d-none');
    document.getElementById('client-search-input').value = '';
}

async function loadClientAddressesForOrder(clientId) {
    const addressSelect = document.getElementById('order-address-id');
    try {
        const addresses = await apiCall(`/Client/${clientId}/addresses`);
        addressSelect.innerHTML = (addresses && addresses.length > 0)
            ? addresses.map(a => `<option value="${a.id}">${a.label}: ${a.street}</option>`).join('')
            : '<option value="">Sin dirección registrada</option>';
    } catch (e) { addressSelect.innerHTML = '<option value="">Error</option>'; }
}

function openClientModalFromOrder() {
    isCreatingOrderContext = true;
    prepareClientModal();
}

// ==========================================
// 👥 GESTIÓN DE USUARIOS
// ==========================================
let allUsers = [];
let userModal; // Variable para la instancia del modal

function initUserLogic() {
    // Inicializar el modal de usuarios si existe en el DOM
    const modalEl = document.getElementById('userModal');
    if (modalEl) {
        userModal = new bootstrap.Modal(modalEl);

        // Configurar el submit del formulario
        const form = document.getElementById('user-form');
        if (form) {
            // Clonar para eliminar listeners previos
            const newForm = form.cloneNode(true);
            form.parentNode.replaceChild(newForm, form);

            newForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await saveUser();
            });
        }
    }
}

async function loadUsers() {
    const tbody = document.getElementById('users-table');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Cargando usuarios...</td></tr>';

    try {
        // Usa tu función apiCall que ya maneja el token y la BASE_URL
        const users = await apiCall('/User');
        allUsers = users || [];

        if (allUsers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay usuarios registrados.</td></tr>';
            return;
        }

        tbody.innerHTML = allUsers.map(u => {
            let roleHtml = '<span class="badge bg-secondary">Staff</span>';
            // Ajusta estos valores según tu Enum en C#
            if (u.role == 1 || u.role === 'ADMIN') roleHtml = '<span class="badge bg-danger">Admin</span>';
            else if (u.role == 2 || u.role === 'KITCHEN') roleHtml = '<span class="badge bg-warning text-dark">Cocina</span>';
            else roleHtml = '<span class="badge bg-info text-dark">Mozo/Delivery</span>';

            return `
                <tr>
                    <td class="ps-4 fw-bold">${u.name} ${u.lastName}</td>
                    <td>${u.username || '-'}</td>
                    <td>${roleHtml}</td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="editUser(${u.id})">
                            <i class="bi bi-pencil-fill"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteUser(${u.id})">
                            <i class="bi bi-trash-fill"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error("Error cargando usuarios:", error);
        tbody.innerHTML = `<tr><td colspan="4" class="text-danger text-center">Error: ${error.message}</td></tr>`;
    }
}

function prepareUserModal() {
    document.getElementById('user-form').reset();
    document.getElementById('user-id').value = '';
    document.getElementById('userModalTitle').innerText = 'Nuevo Usuario';

    // Cargar sucursales en el select del modal
    const branchSelect = document.getElementById('user-branch');
    if (branchSelect) {
        branchSelect.innerHTML = '<option value="">Selecciona...</option>' +
            allBranches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    }

    if (userModal) userModal.show();
}

async function saveUser() {
    const id = document.getElementById('user-id').value;
    const isEdit = !!id;

    const userData = {
        username: document.getElementById('user-username').value,
        name: document.getElementById('user-name').value,
        lastName: document.getElementById('user-lastname').value,
        phone: document.getElementById('user-phone').value,
        password: document.getElementById('user-pass').value,
        role: parseInt(document.getElementById('user-role').value),
        branchId: parseInt(document.getElementById('user-branch').value),
        picture: ''
    };

    // Si es edición, agregamos el ID
    if (isEdit) userData.id = parseInt(id);

    try {
        const endpoint = isEdit ? `/User/${id}` : '/User';
        const method = isEdit ? 'PUT' : 'POST';

        await apiCall(endpoint, method, userData);

        alert(isEdit ? 'Usuario actualizado.' : 'Usuario creado.');
        if (userModal) userModal.hide();
        await loadUsers(); // Recargar tabla

    } catch (error) {
        alert("Error al guardar: " + error.message);
    }
}

async function editUser(id) {
    try {
        const user = await apiCall(`/User/${id}`);
        if (!user) throw new Error("Usuario no encontrado");

        prepareUserModal();
        document.getElementById('userModalTitle').innerText = 'Editar Usuario';

        document.getElementById('user-id').value = user.id;
        document.getElementById('user-username').value = user.username || '';
        document.getElementById('user-name').value = user.name;
        document.getElementById('user-lastname').value = user.lastName;
        document.getElementById('user-phone').value = user.phone;
        document.getElementById('user-branch').value = user.branchId;

        // Mapeo de rol para el select
        let roleVal = 3;
        if (user.role === 'ADMIN' || user.role === 1) roleVal = 1;
        else if (user.role === 'KITCHEN' || user.role === 2) roleVal = 2;

        document.getElementById('user-role').value = roleVal;
        document.getElementById('user-pass').value = ''; // Limpiar contraseña

    } catch (error) {
        alert("Error cargando usuario: " + error.message);
    }
}

async function deleteUser(id) {
    if (!confirm("¿Seguro que quieres eliminar este usuario?")) return;
    try {
        await apiCall(`/User/${id}`, 'DELETE');
        await loadUsers();
    } catch (error) {
        alert("Error al eliminar: " + error.message);
    }
}
// ==========================================
// 🎭 CONFIGURACIÓN DE VISTAS POR ROL
// ==========================================
function setupRoleViews(role) {
    // Helper para ocultar botón por su estado
    const hideBtn = (status) => {
        const btn = document.querySelector(`#order-filters button[onclick*="'${status}'"]`);
        if (btn) btn.classList.add('d-none');
    };

    // Helper para simular clic en una pestaña por defecto
    const clickDefault = (status) => {
        const btn = document.querySelector(`#order-filters button[onclick*="'${status}'"]`);
        if (btn) btn.click();
    };

    // --- REGLAS PARA COCINA (Kitchen / 2) ---
    if (role === 'KITCHEN' || role === '2') {
        // Cocina NO ve Pendientes (lo ve el Cajero/Admin para confirmar)
        hideBtn('Pending');

        // Arrancan viendo "Confirmados" (lo que tienen que empezar a cocinar)
        clickDefault('Confirmed');
    }

    // --- REGLAS PARA DELIVERY/MOZO (Waiter / 3) ---
    else if (role === 'WAITER' || role === '3' || role === 'DELIVERY') {
        // Delivery NO ve Pendientes ni Confirmados (solo lo que está en proceso o listo)
        hideBtn('Pending');
        hideBtn('Confirmed');

        // Arrancan viendo "Listos" (lo que tienen que llevar)
        clickDefault('Ready');
    }

    // --- REGLAS PARA ADMIN ---
    else {
        // Admin ve todo, arranca en Pendientes
        clickDefault('Pending');
    }
}
// EXPONER FUNCIONES AL HTML
window.confirmOpenRegister = confirmOpenRegister;
window.confirmCloseRegister = confirmCloseRegister;
window.prepareCloseRegister = prepareCloseRegister;
window.initCashView = initCashView;
window.toggleHistoryView = toggleHistoryView;
window.loadPastSession = loadPastSession;
window.cancelOrder = cancelOrder;
window.openExpenseModal = openExpenseModal;
window.openClientModalFromOrder = openClientModalFromOrder;
window.selectClientForOrder = selectClientForOrder;
window.clearClientSelection = clearClientSelection;