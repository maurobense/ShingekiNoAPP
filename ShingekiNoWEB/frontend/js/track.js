import { apiCall, initSignalR, connection } from './apiService.js';

let map = null;
let driverMarker = null;
let currentTrackingCode = null;
let pollInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Obtener GUID de la URL (?code=XXXX... o ?id=XXXX...)
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || params.get('id'); 

    if (!code) {
        document.getElementById('status-container').innerHTML = `<h4 class="text-danger">Enlace inválido o incompleto</h4>`;
        return;
    }

    currentTrackingCode = code;

    // 2. Cargar datos iniciales
    await loadOrderData(code);

    // 3. Activar Polling (Respaldo cada 15s)
    startPolling(code);

    // 4. Conectar SignalR (Tiempo Real)
    try {
        await initSignalR({
            onStatusUpdate: (id, newStatus) => {
                // Como no tenemos el ID numérico fácil, recargamos si llega evento
                console.log("⚡ Estado actualizado:", newStatus);
                loadOrderData(code, true);
            }
        });

        // 5. Unirse al canal seguro de Rastreo GPS
        if (connection) {
            // Unirse al grupo del GUID
            await connection.invoke("JoinTrackingGroup", code);
            console.log("📡 Unido al canal de rastreo:", code);

            // Escuchar ubicación del repartidor
            connection.on("ReceiveDriverLocation", (lat, lng) => {
                console.log("📍 Ubicación recibida:", lat, lng);
                updateMapLocation(lat, lng);
            });
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

        const branchName = document.getElementById('branch-name');
        if(branchName) branchName.innerText = order.branchName || 'Central';

        // Fecha
        const dateObj = new Date(order.orderDate);
        if (!order.orderDate.endsWith('Z')) dateObj.setHours(dateObj.getHours() - 3);
        const dateEl = document.getElementById('order-date');
        if(dateEl) dateEl.innerText = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        // Pago
        const paymentData = translatePayment(order.paymentMethod);
        const badgeEl = document.getElementById('payment-method-badge');
        if(badgeEl) badgeEl.innerText = paymentData.label;
        const infoEl = document.getElementById('payment-info-text');
        if(infoEl) infoEl.innerText = `Método: ${paymentData.text}`;

        // Items (Solo si no es update automático para no parpadear, o siempre si prefieres)
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
        const discountRow = document.getElementById('discount-row');
        if(discountRow) {
            if (order.discount > 0) {
                discountRow.classList.remove('d-none');
                document.getElementById('order-discount').innerText = `-$${order.discount}`;
            } else {
                discountRow.classList.add('d-none');
            }
        }
        document.getElementById('order-total').innerText = `$${order.totalAmount}`;

        // --- Actualizar Estado Visual ---
        updateUI(order.status);

    } catch (error) {
        console.error(error);
        if(!isUpdate) {
            document.getElementById('status-container').innerHTML = `
                <div class="text-danger py-3">
                    <i class="bi bi-exclamation-triangle fs-1"></i>
                    <h4 class="mt-2">No encontrado</h4>
                    <p>El enlace podría estar vencido o ser incorrecto.</p>
                </div>`;
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
        
        // 🔥 MOSTRAR EL MAPA
        if(mapSection) {
            mapSection.style.display = 'block';
            // Pequeño delay para que Leaflet calcule bien el tamaño al hacerse visible
            setTimeout(initMap, 500); 
        }
    }
    else if (status === 'Delivered') { 
        icon='bi-emoji-smile-fill'; text='¡Entregado!'; color='success'; width='100%'; 
        if(mapSection) mapSection.style.display = 'none';
    }
    else if (status === 'Cancelled') { 
        icon='bi-x-octagon-fill'; text='Cancelado'; color='dark'; width='100%'; 
        if(mapSection) mapSection.style.display = 'none';
    }

    // Actualizamos el HTML del estado
    // Usamos innerHTML simple. Si quieres evitar parpadeo en polling, compara texto antes.
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

// --- LÓGICA DE MAPA (Leaflet) ---

function initMap() {
    // Si el mapa ya existe, solo ajustamos tamaño y salimos
    if (map) { 
        map.invalidateSize(); 
        return; 
    }

    const container = document.getElementById('map-container');
    if(!container) return;

    // Coordenadas iniciales (Centro genérico, ej: Montevideo o tu local)
    const defaultLat = -34.85; 
    const defaultLng = -56.00;

    map = L.map('map-container').setView([defaultLat, defaultLng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
}

function updateMapLocation(lat, lng) {
    // 1. Si el mapa no existe, crearlo
    if (!map) initMap();

    // 2. Validar coordenadas (Evitar errores si llegan nulos)
    if (!lat || !lng) return;

    // 3. Crear o Mover el marcador
    if (!driverMarker) {
        console.log("📍 Creando marcador en:", lat, lng);

        const bikeIcon = L.divIcon({
            html: '<i class="bi bi-scooter text-danger" style="font-size: 3rem; display:block;"></i>',
            className: 'bike-icon-marker', // Usa la clase que definimos en CSS
            iconSize: [50, 50],             // Tamaño del contenedor
            iconAnchor: [25, 25]            // Punto de anclaje (centro)
        });

        driverMarker = L.marker([lat, lng], { icon: bikeIcon }).addTo(map);
        
        // Popup opcional
        driverMarker.bindPopup("<b>¡Aquí está tu pedido!</b>").openPopup();
    } else {
        console.log("📍 Moviendo marcador a:", lat, lng);
        // Mover suavemente
        driverMarker.setLatLng([lat, lng]);
    }
    
    // 4. Centrar el mapa en la moto
    map.panTo([lat, lng]);
}