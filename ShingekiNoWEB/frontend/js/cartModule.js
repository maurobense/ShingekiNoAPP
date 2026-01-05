import { apiCall } from './apiService.js';

// 1. CARGAR CARRITO AL INICIAR
// Intentamos leer del localStorage, si no hay nada, array vacío.
let cart = JSON.parse(localStorage.getItem('shingeki_cart')) || [];

// Actualizar UI inicial por si había algo guardado
document.addEventListener('DOMContentLoaded', () => {
    // Pequeño delay para asegurar que el DOM del modal existe
    setTimeout(updateCartUI, 100); 
});

// Función interna para guardar
const saveCart = () => {
    localStorage.setItem('shingeki_cart', JSON.stringify(cart));
    updateCartUI();
};

export const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    
    saveCart(); // Guardar cambios
    
    if(navigator.vibrate) navigator.vibrate(50);
};

function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart(); // Guardar cambios
}

function updateQuantity(index, change) {
    const item = cart[index];
    item.quantity += change;
    
    if (item.quantity <= 0) {
        removeFromCart(index);
    } else {
        saveCart(); // Guardar cambios
    }
}

function updateCartUI() {
    const countEl = document.getElementById('cart-count');
    const totalEl = document.getElementById('cart-total');
    const finalTotalEl = document.getElementById('cart-final-total');
    const floatBtn = document.getElementById('cart-float-btn');
    const container = document.getElementById('cart-items-container');
    const emptyMsg = document.getElementById('cart-empty-msg');

    // Cálculos
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Actualizar Textos (Validamos que existan los elementos primero)
    if(countEl) countEl.textContent = totalItems;
    if(totalEl) totalEl.textContent = `$${totalPrice}`;
    if(finalTotalEl) finalTotalEl.textContent = `$${totalPrice}`;

    // Mostrar/Ocultar Botón Flotante
    if (floatBtn) {
        if (totalItems > 0) floatBtn.classList.remove('d-none');
        else floatBtn.classList.add('d-none');
    }

    // Mostrar/Ocultar Mensaje Vacío
    if (emptyMsg) {
        if (totalItems > 0) emptyMsg.classList.add('d-none');
        else emptyMsg.classList.remove('d-none');
    }

    // Renderizar Lista
    if(container) {
        container.innerHTML = cart.map((item, index) => `
            <div class="list-group-item d-flex justify-content-between align-items-center px-3 py-2 bg-white border-bottom">
                <div class="ms-2 me-auto">
                    <div class="fw-bold text-dark">${item.name}</div>
                    <div class="text-muted small">$${item.price} x ${item.quantity} = <span class="text-success fw-bold">$${item.price * item.quantity}</span></div>
                </div>
                <div class="d-flex align-items-center gap-2 bg-light rounded-pill p-1">
                    <button class="btn btn-sm btn-light rounded-circle shadow-sm" style="width:28px;height:28px;padding:0" onclick="cartUpdateQty(${index}, -1)">-</button>
                    <span class="fw-bold text-dark" style="min-width: 20px; text-align: center;">${item.quantity}</span>
                    <button class="btn btn-sm btn-primary rounded-circle shadow-sm" style="width:28px;height:28px;padding:0" onclick="cartUpdateQty(${index}, 1)">+</button>
                </div>
            </div>
        `).join('');
    }
}

// Exponer al window para los onclick del HTML
window.cartUpdateQty = updateQuantity;

// --- ENVÍO DEL PEDIDO ---
window.submitOrder = async () => {
    if (cart.length === 0) return;

    const clientSelect = document.getElementById('cart-client-select');
    const selectedClientId = clientSelect ? clientSelect.value : null;

    if (!selectedClientId) {
        alert("⚠️ Por favor, selecciona un cliente para el pedido.");
        return;
    }

    const payload = {
        items: cart.map(item => ({
            productId: item.id,
            quantity: item.quantity
        })),
        clientId: parseInt(selectedClientId),
        branchId: 1, 
        clientAddressId: 1, 
        note: "Pedido Web"
    };

    try {
        if(!confirm(`¿Confirmar pedido por $${cart.reduce((s,i)=>s+(i.price*i.quantity),0)}?`)) return;
        
        const response = await apiCall('/Orders', 'POST', payload);
        
        alert('¡Pedido enviado! ID: ' + (response.orderId || 'OK'));
        
        // 3. LIMPIAR CARRITO Y STORAGE
        cart = [];
        saveCart(); // Esto borra el localStorage y actualiza la UI
        
        const modalEl = document.getElementById('cartModal');
        if(modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if(modal) modal.hide();
        }

    } catch (error) {
        alert('Error al enviar pedido: ' + error.message);
    }
};