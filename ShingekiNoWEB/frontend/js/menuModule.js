import { apiCall } from './apiService.js';

// ==========================================
// 🛒 ESTADO GLOBAL DEL MENÚ
// ==========================================
let savedCart = localStorage.getItem('cart');
let cart = savedCart ? JSON.parse(savedCart) : [];

let allProducts = [];
let allCategories = [];
let allClients = []; // Lista para el buscador

let savedDiscount = localStorage.getItem('globalDiscountPercent');
let globalDiscountPercent = savedDiscount ? parseFloat(savedDiscount) : 0; 

// Cargar forma de pago persistida (Default: 1 - Efectivo)
let currentPaymentMethod = localStorage.getItem('paymentMethod') ? parseInt(localStorage.getItem('paymentMethod')) : 1; 

// ==========================================
// 🚀 INICIALIZACIÓN DEL MENÚ
// ==========================================
export const initMenu = async () => {
    console.log("🍔 Iniciando Módulo Menú...");

    const userName = localStorage.getItem('user_name');
    if(document.getElementById('menu-user-name')) {
        document.getElementById('menu-user-name').textContent = userName || 'Usuario';
    }
    
    // Exponer funciones globales al HTML
    window.submitOrder = submitOrder;
    window.addToCart = addToCart;
    window.removeFromCart = removeFromCart;
    window.updateItemObservation = updateItemObservation;
    window.updateGlobalDiscount = updateGlobalDiscount;
    window.updateItemDiscount = updateItemDiscount; 
    window.updatePaymentMethod = updatePaymentMethod; 
    window.filterProducts = filterProducts;
    
    // Funciones del Buscador de Clientes (Carrito)
    window.selectClientForCart = selectClientForCart;
    window.clearCartClient = clearCartClient;

    // Cargar datos
    await loadData();
    
    // Inicializar lógica de UI
    const paymentSelect = document.getElementById('cart-payment-method');
    if (paymentSelect) paymentSelect.value = currentPaymentMethod;
    
    updateCartUI(); 
    
    // Activar buscadores y formularios
    setupMenuClientSearch();
    setupNewClientForm();
};

// ==========================================
// 🔄 CARGA DE DATOS
// ==========================================
async function loadData() {
    try {
        const [cats, prods, clients] = await Promise.all([
            apiCall('/Categories'),
            apiCall('/Products'),
            apiCall('/Client') 
        ]);

        allCategories = cats || [];
        allProducts = prods || [];
        allClients = clients || []; // Importante para el buscador

        renderCategories();
        renderProducts(); 

    } catch (error) {
        console.error("Error cargando menú:", error);
        const grid = document.getElementById('product-grid');
        if(grid) grid.innerHTML = '<div class="col-12 text-center text-danger">Error al cargar el menú.</div>';
    }
}

// Recargar solo clientes (útil después de crear uno nuevo)
async function reloadClients() {
    try {
        const clients = await apiCall('/Client');
        allClients = clients || [];
    } catch(e) { console.error(e); }
}

// ==========================================
// 🎨 RENDERIZADO VISUAL
// ==========================================
function renderCategories() {
    const container = document.getElementById('category-filters');
    if(!container) return;

    let html = `<button class="btn btn-dark rounded-pill me-2 px-3 category-btn active" onclick="filterProducts(null, this)">Todos</button>`;
    html += allCategories.map(c => 
        `<button class="btn btn-outline-dark border-0 rounded-pill me-2 px-3 category-btn" onclick="filterProducts(${c.id}, this)">${c.name}</button>`
    ).join('');

    container.innerHTML = html;
}

function filterProducts(categoryId, btnElement) {
    document.querySelectorAll('.category-btn').forEach(b => {
        b.classList.remove('btn-dark', 'active');
        b.classList.add('btn-outline-dark', 'border-0');
    });
    btnElement.classList.remove('btn-outline-dark', 'border-0');
    btnElement.classList.add('btn-dark', 'active');
    renderProducts(categoryId);
}

function renderProducts(categoryId = null) {
    const grid = document.getElementById('product-grid');
    if(!grid) return;

    let filtered = allProducts;
    if (categoryId) {
        filtered = allProducts.filter(p => p.categoryId === categoryId);
    }

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="col-12 text-center text-muted py-5">No hay productos en esta categoría.</div>';
        return;
    }

    grid.innerHTML = filtered.map(p => `
        <div class="col-6 col-md-4 col-lg-3">
            <div class="card border-0 shadow-sm h-100 overflow-hidden product-card" onclick="addToCart(${p.id})">
                <div style="height: 160px; background-color: #eee; position: relative;">
                    ${ p.imageUrl ? `<img src="${p.imageUrl}" class="product-card-img" style="width:100%; height:100%; object-fit:cover;">` : '<div class="d-flex align-items-center justify-content-center h-100 text-muted"><i class="bi bi-image fs-1"></i></div>' }
                    <span class="badge bg-dark position-absolute top-0 end-0 m-2">$${p.price}</span>
                    <button class="btn btn-primary btn-sm rounded-circle position-absolute bottom-0 end-0 m-2 shadow"><i class="bi bi-plus-lg"></i></button>
                </div>
                <div class="card-body p-2 text-center">
                    <h6 class="fw-bold mb-1 text-truncate">${p.name}</h6>
                    <p class="text-primary fw-bold mb-0">$${p.price}</p>
                </div>
            </div>
        </div>
    `).join('');
}

// ==========================================
// 🛒 LÓGICA DEL CARRITO
// ==========================================
function updateCartPersistence() { localStorage.setItem('cart', JSON.stringify(cart)); }

function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if(!product) return;

    const existing = cart.find(item => item.productId === productId);
    if(existing) { existing.quantity++; } 
    else {
        cart.push({ 
            productId: product.id, name: product.name, price: product.price, 
            quantity: 1, observation: "", discountPercent: 0 
        });
    }
    updateCartUI();
}

function removeFromCart(productId) {
    const index = cart.findIndex(item => item.productId === productId);
    if (index > -1) {
        if (cart[index].quantity > 1) cart[index].quantity--;
        else cart.splice(index, 1);
    }
    updateCartUI();
}

function updateItemObservation(productId, text) {
    const item = cart.find(i => i.productId === productId);
    if(item) item.observation = text;
    updateCartPersistence(); 
}

function updateItemDiscount(productId, value) {
    const item = cart.find(i => i.productId === productId);
    if(item) {
        let val = parseFloat(value);
        if(isNaN(val) || val < 0) val = 0; if(val > 100) val = 100;
        item.discountPercent = val;
    }
    updateCartUI(); 
}

function updateGlobalDiscount(value) {
    let val = parseFloat(value);
    if(isNaN(val) || val < 0) val = 0; if(val > 100) val = 100;
    globalDiscountPercent = val;
    localStorage.setItem('globalDiscountPercent', globalDiscountPercent.toString());
    updateCartUI(); 
}

function updatePaymentMethod(value) {
    let val = parseInt(value);
    if (isNaN(val) || val < 1 || val > 3) val = 1;
    currentPaymentMethod = val;
    localStorage.setItem('paymentMethod', val.toString());
}

function updateCartUI() {
    // Calculos
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => {
        const itemTotal = item.price * item.quantity;
        const discountAmount = itemTotal * ((item.discountPercent || 0) / 100);
        return sum + (itemTotal - discountAmount);
    }, 0);
    const globalDiscountAmount = subtotal * (globalDiscountPercent / 100);
    let finalTotal = subtotal - globalDiscountAmount;
    if (finalTotal < 0) finalTotal = 0;
    updateCartPersistence(); 

    // Botón Flotante
    const floatBtn = document.getElementById('cart-float-btn');
    if(floatBtn) {
        document.getElementById('cart-count').textContent = totalItems;
        document.getElementById('cart-total').textContent = `$${finalTotal.toFixed(0)}`;
        if(totalItems > 0) floatBtn.classList.remove('d-none'); else floatBtn.classList.add('d-none');
    }

    // Modal Carrito
    const container = document.getElementById('cart-items-container');
    const emptyMsg = document.getElementById('cart-empty-msg');
    const finalTotalEl = document.getElementById('cart-final-total');

    if(container) {
        if(cart.length === 0) {
            container.innerHTML = '';
            if(emptyMsg) emptyMsg.classList.remove('d-none');
        } else {
            if(emptyMsg) emptyMsg.classList.add('d-none');
            container.innerHTML = cart.map(item => {
                const itemTotalRaw = item.price * item.quantity;
                const discountMoney = itemTotalRaw * ((item.discountPercent || 0) / 100);
                const itemTotalFinal = itemTotalRaw - discountMoney;

                return `
                <div class="list-group-item py-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div>
                            <h6 class="mb-0 fw-bold">${item.name}</h6>
                            <small class="text-muted">$${item.price} x ${item.quantity}</small>
                            ${ item.discountPercent > 0 ? `<br><small class="text-success fw-bold">Desc: ${item.discountPercent}%</small>` : '' }
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="fw-bold text-primary">$${itemTotalFinal.toFixed(0)}</span>
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-secondary" onclick="removeFromCart(${item.productId})">-</button>
                                <button class="btn btn-outline-primary" onclick="addToCart(${item.productId})">+</button>
                            </div>
                        </div>
                    </div>
                    <div class="row g-2 mt-1">
                        <div class="col-8">
                            <input type="text" class="form-control form-control-sm bg-light" placeholder="Nota..." value="${item.observation || ''}" oninput="updateItemObservation(${item.productId}, this.value)">
                        </div>
                        <div class="col-4">
                            <div class="input-group input-group-sm">
                                <input type="number" class="form-control bg-light" placeholder="0" min="0" max="100" value="${item.discountPercent > 0 ? item.discountPercent : ''}" onchange="updateItemDiscount(${item.productId}, this.value)">
                                <span class="input-group-text bg-light">%</span>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');

            const visualGlobalDiscount = globalDiscountAmount > 0 ? `(-$${globalDiscountAmount.toFixed(0)})` : '';
            container.innerHTML += `
                <div class="list-group-item bg-light border-0 mt-2">
                    <div class="d-flex justify-content-between align-items-center">
                        <label class="small fw-bold text-muted mb-0">Desc. Global (%) <span class="text-success">${visualGlobalDiscount}</span></label>
                        <div class="input-group input-group-sm w-25">
                            <input type="number" class="form-control text-end" placeholder="0" min="0" max="100" value="${globalDiscountPercent > 0 ? globalDiscountPercent : ''}" oninput="updateGlobalDiscount(this.value)">
                            <span class="input-group-text">%</span>
                        </div>
                    </div>
                </div>`;
        }
    }
    if(finalTotalEl) finalTotalEl.textContent = `$${finalTotal.toFixed(0)}`;
}

// ==========================================
// 🔍 BUSCADOR DE CLIENTES (LÓGICA TYPEAHEAD)
// ==========================================
function setupMenuClientSearch() {
    const input = document.getElementById('cart-client-search');
    const results = document.getElementById('cart-client-results');

    if(!input) return;

    input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        
        if (term.length < 2) { 
            results.style.display = 'none'; 
            return; 
        }

        const matches = allClients.filter(c => {
            const fullName = ((c.name || '') + ' ' + (c.lastName || '')).toLowerCase();
            const phoneStr = String(c.phone || '');
            return fullName.includes(term) || phoneStr.includes(term);
        });

        if (matches.length > 0) {
            results.innerHTML = matches.map(c => `
                <a href="#" class="list-group-item list-group-item-action" 
                   onclick="selectClientForCart(${c.id}, '${c.name} ${c.lastName}')">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${c.name} ${c.lastName}</strong><br>
                            <small class="text-muted"><i class="bi bi-telephone"></i> ${c.phone}</small>
                        </div>
                        <i class="bi bi-chevron-right text-muted small"></i>
                    </div>
                </a>
            `).join('');
            results.style.display = 'block';
        } else {
            results.innerHTML = '<div class="list-group-item text-muted text-center small">No encontrado</div>';
            results.style.display = 'block';
        }
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !results.contains(e.target)) {
            results.style.display = 'none';
        }
    });
}

function selectClientForCart(id, name) {
    document.getElementById('cart-selected-client-id').value = id;
    document.getElementById('cart-client-name-display').textContent = name;
    
    document.getElementById('cart-client-search').parentElement.classList.add('d-none');
    document.getElementById('cart-client-results').style.display = 'none';
    document.getElementById('cart-client-selected-display').classList.remove('d-none');

    loadClientAddresses(id);
}

function clearCartClient() {
    document.getElementById('cart-selected-client-id').value = '';
    document.getElementById('cart-client-search').value = '';
    
    document.getElementById('cart-client-search').parentElement.classList.remove('d-none');
    document.getElementById('cart-client-selected-display').classList.add('d-none');
    document.getElementById('cart-address-container').classList.add('d-none');
}

async function loadClientAddresses(clientId) {
    const select = document.getElementById('cart-address-select');
    const container = document.getElementById('cart-address-container');
    
    select.innerHTML = '<option>Cargando...</option>';
    container.classList.remove('d-none');
    
    try {
        const addresses = await apiCall(`/Client/${clientId}/addresses`);
        
        // 🔍 DEBUG: Mira en la consola cómo llegan los datos realmente
        console.log("Direcciones recibidas:", addresses); 

        if (addresses && addresses.length > 0) {
            select.innerHTML = addresses.map(a => {
                // Hacemos "fallback" para leer la propiedad sin importar cómo venga del backend
                // Intenta 'street' (minúscula), si no existe prueba 'Street' (Mayúscula), si no, vacío.
                const street = a.street || a.Street || a.fullAddress || ''; 
                const city = a.city || a.City || '';
                const label = a.label || a.Label || 'Casa';

                return `<option value="${a.id}">${label}: ${street} ${city}</option>`;
            }).join('');
        } else {
            select.innerHTML = '<option value="">Sin dirección registrada</option>';
        }
    } catch (e) { 
        console.error(e); 
        container.classList.add('d-none');
    }
}

// ==========================================
// ➕ CREAR CLIENTE RÁPIDO (SIN ALERTAS)
// ==========================================
function setupNewClientForm() {
    const form = document.getElementById('menu-client-form');
    if(!form) return;

    // Clonar para limpiar listeners viejos
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = newForm.querySelector('button[type="submit"]');
        btn.disabled = true; 
        btn.textContent = "Guardando...";

        const clientData = {
            name: document.getElementById('new-client-name').value,
            lastName: document.getElementById('new-client-lastname').value,
            phone: document.getElementById('new-client-phone').value
        };

        const addressData = {
            street: document.getElementById('new-client-street').value,
            city: document.getElementById('new-client-city').value,
            label: document.getElementById('new-client-label').value,
            region: 'Canelones', postalCode: '15000', country: 'UY'
        };

        try {
            // 1. Crear Cliente
            const newClient = await apiCall('/Client', 'POST', clientData);
            
            // Verificación segura de ID (Minúscula o Mayúscula)
            const newId = newClient ? (newClient.id || newClient.Id) : null;

            if (newId) {
                // 2. Crear Dirección
                await apiCall(`/Client/${newId}/addresses`, 'POST', addressData);
                
                // 3. Recargar lista para el buscador (silencioso)
                await reloadClients(); 
                
                // 4. Cerrar Modal de Cliente
                const clientModalEl = document.getElementById('clientModal');
                const clientModal = bootstrap.Modal.getOrCreateInstance(clientModalEl);
                clientModal.hide();

                // 5. Seleccionar automáticamente en el carrito
                const fullName = `${newClient.name || newClient.Name} ${newClient.lastName || newClient.LastName}`;
                selectClientForCart(newId, fullName);
                
                // 6. Asegurar que el Carrito esté visible y activo
                const cartModalEl = document.getElementById('cartModal');
                const cartModal = bootstrap.Modal.getOrCreateInstance(cartModalEl);
                cartModal.show();
            }
        } catch (err) {
            console.error(err);
            alert("Error: " + err.message); // Solo mostramos alerta si falla
        } finally {
            btn.disabled = false;
            btn.textContent = "Guardar y Seleccionar";
        }
    });
}

// ==========================================
// 📨 ENVIAR PEDIDO
// ==========================================
async function submitOrder() {
    if(cart.length === 0) return alert("El carrito está vacío.");

    // OBTENER ID DESDE EL INPUT OCULTO, NO DEL SELECT VIEJO
    const clientId = document.getElementById('cart-selected-client-id').value;
    const addressId = document.getElementById('cart-address-select').value;
    
    if (!clientId) {
        return alert("⚠️ Por favor selecciona un cliente usando el buscador.");
    }

    const itemsPayload = cart.map(item => {
        const totalItemPrice = item.price * item.quantity;
        const discountMoney = totalItemPrice * ((item.discountPercent || 0) / 100);
        return {
            productId: item.productId,
            quantity: item.quantity,
            observation: item.observation || "", 
            discount: parseFloat(discountMoney.toFixed(2)) 
        };
    });

    // Calcular descuento global dinero
    const subtotal = itemsPayload.reduce((sum, i) => {
        const orig = cart.find(x => x.productId === i.productId);
        return sum + ((orig.price * orig.quantity) - i.discount);
    }, 0);
    const globalDiscountMoney = subtotal * (globalDiscountPercent / 100);

    // Leer método de pago
    const paymentSelect = document.getElementById('cart-payment-method');
    let paymentMethodValue = 1; 
    if (paymentSelect && paymentSelect.value) {
        paymentMethodValue = parseInt(paymentSelect.value);
        updatePaymentMethod(paymentMethodValue); 
    }

    const orderPayload = {
        branchId: 1, 
        clientId: parseInt(clientId),
        clientAddressId: addressId ? parseInt(addressId) : 0, 
        note: "Pedido Web", 
        globalDiscount: parseFloat(globalDiscountMoney.toFixed(2)),
        paymentMethod: paymentMethodValue, 
        items: itemsPayload
    };

    const btn = document.querySelector('#cartModal .modal-footer button');
    if(btn) { btn.disabled = true; btn.textContent = "Enviando..."; }

    try {
        const response = await apiCall('/Orders', 'POST', orderPayload);
        alert(`✅ ¡Pedido Confirmado! ID: #${response.orderId}`);
        
        cart = [];
        globalDiscountPercent = 0;
        localStorage.removeItem('cart'); 
        localStorage.removeItem('globalDiscountPercent');
        
        updateCartUI();
        clearCartClient(); // Limpiar el cliente seleccionado
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('cartModal'));
        if(modal) modal.hide();

    } catch (error) {
        console.error(error);
        alert("Error al enviar pedido: " + error.message);
    } finally {
        if(btn) { btn.disabled = false; btn.textContent = "Confirmar Pedido"; }
    }
}