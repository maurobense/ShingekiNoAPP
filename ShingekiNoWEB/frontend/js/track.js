import { apiCall, initSignalR, connection } from './apiService.js';

// --- VARIABLES GLOBALES ---
let currentTrackingCode = null;
let pollInterval = null;

// Variables de Mapa (Reservadas para el futuro)
let map = null;
let driverMarker = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Obtener GUID de la URL (?code=XXXX... o ?id=XXXX...)
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || params.get('id'); 

    if (!code) {
        const statusContainer = document.getElementById('status-container');
        if(statusContainer) {
            statusContainer.innerHTML = `<h4 class="text-danger">Enlace inválido o incompleto</h4>`;
        }
        return;
    }

    currentTrackingCode = code;

    // 2. Cargar datos iniciales
    await loadOrderData(code);

    // 3. Activar Polling (Respaldo cada 15s por si SignalR falla)
    startPolling(code);

    // 4. Conectar SignalR (Tiempo Real)
    try {
        await initSignalR({
            onStatusUpdate: (id, newStatus) => {
                console.log("⚡ Estado actualizado por SignalR:", newStatus);
                // Recargamos toda la data para actualizar textos y barras
                loadOrderData(code, true);
            }
        });

        // 5. Unirse al canal seguro
        if (connection) {
            await connection.invoke("JoinTrackingGroup", code);
            console.log("📡 Unido al canal de rastreo:", code);

            /* 🚧 FUTURO: RASTREO GPS
               Descomentar cuando la App del Repartidor esté lista
            
            connection.on("ReceiveDriverLocation", (lat, lng) => {
                console.log("📍 Ubicación recibida:", lat, lng);
                updateMapLocation(lat, lng);
            });
            */
        }
    } catch (e) {
        console.warn("SignalR no conectado. Usando solo Polling.", e);
    }
});

// --- LÓGICA DE DATOS ---

function startPolling(code) {
    if (pollInterval) clearInterval(pollInterval);
    console.log("🔄 Iniciando actualizaciones automáticas (15s)...");
    pollInterval = setInterval(() => {
        loadOrderData(code, true);
    }, 15000);
}

async function loadOrderData(code, isUpdate = false) {
    try {
        // Usamos el endpoint público seguro: /api/Orders/track/{guid}
        const order = await apiCall(`/Orders/track/${code}`); 
        
        if (!order) throw new Error("Pedido no encontrado");

        // --- Actualizar Textos e Info ---
        const displayId = document.getElementById('display-id');
        if(displayId) displayId.innerText = order.id;

        const clientName = document.getElementById('client-name');
        if(clientName) clientName.innerText = order.clientName || 'Cliente';

        // Fecha (Ajuste simple de zona horaria si es necesario)
        const dateObj = new Date(order.orderDate);
        const dateEl = document.getElementById('order-date');
        if(dateEl) dateEl.innerText = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        // Pago
        const paymentData = translatePayment(order.paymentMethod);
        const badgeEl = document.getElementById('payment-method-badge');
        if(badgeEl) badgeEl.innerText = paymentData.label;
        
        // Items (Solo renderizamos items si es la carga inicial para evitar parpadeos)
        if(!isUpdate) {
            const list = document.getElementById('order-items');
            if(list) {
                list.innerHTML = (order.items || []).map(i => `
                    <li class="list-group-item d-flex justify-content-between px-0 py-2">
                        <div style="max-width: 75%;">
                            <span class="fw-bold text-primary">${i.quantity}x</span> ${i.productName}
                            ${i.observation ? `<br><small class="text-muted fst-italic"><i class="bi bi-pencil-fill" style="font-size:0.7em"></i> ${i.observation}</small>` : ''}
                        </div>
                        <span class="fw-bold">$${i.subtotal}</span>
                    </li>`).join('');
            }
        }

        // Totales y Descuento
        const discountRow = document.getElementById('discount-row'); // Asegúrate de tener este ID en HTML si usas descuentos
        if(discountRow) {
            if (order.discount > 0) {
                discountRow.classList.remove('d-none');
                const discVal = document.getElementById('order-discount');
                if(discVal) discVal.innerText = `-$${order.discount}`;
            } else {
                discountRow.classList.add('d-none');
            }
        }
        
        const totalEl = document.getElementById('order-total');
        if(totalEl) totalEl.innerText = `$${order.totalAmount}`;

        // --- Actualizar Estado Visual ---
        updateUI(order.status);

    } catch (error) {
        console.error(error);
        if(!isUpdate) {
            const container = document.getElementById('status-container');
            if(container) {
                container.innerHTML = `
                <div class="text-danger py-3">
                    <i class="bi bi-exclamation-triangle fs-1"></i>
                    <h4 class="mt-2">No encontrado</h4>
                    <p>El enlace podría estar vencido o ser incorrecto.</p>
                </div>`;
            }
        }
    }
}

// --- LÓGICA VISUAL ---

function translatePayment(method) {
    const map = {
        'Cash': { label: 'Efectivo', text: 'Efectivo 💵' },
        'MercadoPago': { label: 'MercadoPago', text: 'MercadoPago 📱' },
        'Transfer': { label: 'Transferencia', text: 'Transferencia Bancaria 🏦' }
    };
    return map[method] || { label: method, text: method };
}

function updateUI(status) {
    const container = document.getElementById('status-container');
    const bar = document.getElementById('status-bar');
    const mapSection = document.getElementById('map-section');

    let icon = 'bi-circle', text = status, color = 'secondary', width = '0%';

    // Mapeo de Estados
    if (status === 'Pending') { icon='bi-clock-history'; text='Esperando Confirmación'; color='warning'; width='10%'; }
    else if (status === 'Confirmed') { icon='bi-check-circle'; text='Confirmado'; color='info'; width='25%'; }
    else if (status === 'Cooking') { icon='bi-fire'; text='En Cocina 🔥'; color='danger'; width='50%'; }
    else if (status === 'Ready') { icon='bi-box-seam'; text='Listo para Salir'; color='success'; width='75%'; }
    
    else if (status === 'OnTheWay') { 
        icon='bi-scooter'; text='En Camino 🛵'; color='primary'; width='90%'; 
        
        /* 🚧 FUTURO: MOSTRAR MAPA
           Descomentar esto cuando la App del Repartidor esté lista
        
        if(mapSection) {
            mapSection.style.display = 'block';
            setTimeout(initMap, 500); 
        }
        */
       
        // Mantenemos oculto por ahora
        if(mapSection) mapSection.style.display = 'none';
    }
    
    else if (status === 'Delivered') { 
        icon='bi-emoji-smile-fill'; text='¡Entregado!'; color='success'; width='100%'; 
        if(mapSection) mapSection.style.display = 'none';
    }
    else if (status === 'Cancelled') { 
        icon='bi-x-octagon-fill'; text='Cancelado'; color='dark'; width='100%'; 
        if(mapSection) mapSection.style.display = 'none';
    }

    // Render HTML del Estado
    if(container) {
        container.innerHTML = `
            <div class="status-icon-lg text-${color} animate__animated animate__pulse animate__infinite">
                <i class="bi ${icon}"></i>
            </div>
            <h2 class="fw-bold text-${color} mb-0">${text}</h2>
            <p class="text-muted small mt-2">Actualización en tiempo real</p>
        `;
    }

    if(bar) {
        bar.className = `progress-bar progress-bar-striped progress-bar-animated bg-${color}`;
        bar.style.width = width;
    }
}

// --- LÓGICA DE MAPA (Leaflet) - RESERVADA ---
/*
function initMap() {
    if (map) { map.invalidateSize(); return; }

    const container = document.getElementById('map-container');
    if(!container) return;

    // Coordenadas por defecto (ej: Montevideo)
    const defaultLat = -34.85; 
    const defaultLng = -56.00;

    map = L.map('map-container').setView([defaultLat, defaultLng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
}

function updateMapLocation(lat, lng) {
    if (!map) initMap();
    if (!lat || !lng) return;

    if (!driverMarker) {
        const bikeIcon = L.divIcon({
            html: '<i class="bi bi-scooter text-danger" style="font-size: 3rem; display:block;"></i>',
            className: 'bike-icon-marker',
            iconSize: [50, 50],
            iconAnchor: [25, 25]
        });

        driverMarker = L.marker([lat, lng], { icon: bikeIcon }).addTo(map);
        driverMarker.bindPopup("<b>¡Aquí está tu pedido!</b>").openPopup();
    } else {
        driverMarker.setLatLng([lat, lng]);
    }
    map.panTo([lat, lng]);
}
*/