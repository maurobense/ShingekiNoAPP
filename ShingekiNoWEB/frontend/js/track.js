import { apiCall, initSignalR, connection } from './apiService.js';

let currentTrackingCode = null;
let pollInterval = null;
let map = null;
let driverMarker = null;
let accuracyCircle = null;
let routeLine = null;
let routeGlow = null;
let livePulse = null;
let destinationMarker = null;
let destinationPoint = null;
let lastDestinationKey = '';
let animationFrame = null;
let lastDriverPoint = null;
let routePoints = [];
let routeDistanceMeters = 0;
let lastOrderStatus = null;

const DEFAULT_CENTER = [-34.8941, -56.0675];
const DRIVER_SIGNAL_STALE_MS = 2 * 60 * 1000;

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || params.get('tracking') || params.get('id');

    document.getElementById('recenter-map')?.addEventListener('click', () => {
        if (lastDriverPoint && map) map.flyTo(lastDriverPoint, Math.max(map.getZoom(), 15), { duration: 0.7 });
        else if (destinationPoint && map) map.flyTo(destinationPoint, Math.max(map.getZoom(), 15), { duration: 0.7 });
    });

    initMap();

    if (!code) {
        const statusContainer = document.getElementById('status-container');
        if (statusContainer) {
            statusContainer.innerHTML = '<h4 class="text-danger">Enlace invalido o incompleto</h4>';
        }
        updateDriverPanel(null, 'Link incompleto');
        return;
    }

    currentTrackingCode = code;
    await loadOrderData(code);
    startPolling(code);
    await connectRealtime(code);
});

async function connectRealtime(code) {
    try {
        await initSignalR({
            onStatusUpdate: () => loadOrderData(code, true)
        });

        if (!connection) return;

        connection.on('ReceiveDriverLocation', (lat, lng) => {
            updateMapLocation({ latitude: lat, longitude: lng, locationAtUtc: new Date().toISOString() });
        });

        connection.on('ReceiveDriverLocationDetails', (location) => {
            if (!location) return;
            updateMapLocation(location);
        });

        await connection.invoke('JoinTrackingGroup', code);
        if (!lastDriverPoint) updateLiveChip(false, 'Sin GPS');
    } catch (error) {
        updateLiveChip(false);
        console.warn('SignalR no conectado. Usando polling.', error);
    }
}

function startPolling(code) {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => loadOrderData(code, true), 15000);
}

async function loadOrderData(code, isUpdate = false) {
    try {
        const order = await apiCall(`/Orders/track/${code}`);
        if (!order) throw new Error('Pedido no encontrado');

        lastOrderStatus = order.status;

        setText('display-id', order.id);
        setText('client-name', order.clientName || 'Cliente');
        setText('map-title', order.branchName ? `${order.branchName} en reparto` : 'Pedido en reparto');

        const heroCopy = document.getElementById('track-hero-copy');
        if (heroCopy) {
            heroCopy.innerText = getHeroCopy(order.status);
        }

        renderNavigationLinks(order);
        renderDate(order.orderDate);
        renderPayment(order.paymentMethod);
        renderItems(order, isUpdate);
        renderTotals(order);
        await renderDestination(order);

        const driverLocation = extractDriverLocation(order);
        updateUI(order.status, Boolean(driverLocation));

        if (driverLocation) {
            updateMapLocation(driverLocation, { fromPolling: isUpdate });
        } else {
            clearDriverSignal();
            updateDriverPanel(null, getWaitingMapMessage(order.status));
            if (!isUpdate) fitMapToActivePoints();
        }
    } catch (error) {
        console.error(error);
        if (!isUpdate) renderNotFound();
    }
}

function renderDate(orderDate) {
    const dateEl = document.getElementById('order-date');
    if (!dateEl) return;

    const dateObj = new Date(orderDate);
    dateEl.innerText = `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function renderPayment(paymentMethod) {
    const paymentData = translatePayment(paymentMethod);
    setText('payment-method-badge', paymentData.label);
}

function renderItems(order, isUpdate) {
    if (isUpdate) return;

    const list = document.getElementById('order-items');
    if (!list) return;

    list.innerHTML = (order.items || []).map(item => `
        <li>
            <div>
                <span>${item.quantity}x</span>
                <strong>${escapeHtml(item.productName)}</strong>
                ${item.observation ? `<small><i class="bi bi-pencil"></i> ${escapeHtml(item.observation)}</small>` : ''}
            </div>
            <b>$${formatMoney(item.subtotal)}</b>
        </li>
    `).join('');
}

function renderTotals(order) {
    setText('order-total', `$${formatMoney(order.totalAmount)}`);
}

async function renderDestination(order) {
    const destination = extractDestination(order);
    const title = document.getElementById('map-title');

    if (title && !lastDriverPoint) {
        title.innerText = destination?.label
            ? `Entrega: ${destination.label}`
            : 'Esperando salida del pedido';
    }

    if (!destination?.query || !map) return;
    if (destination.query === lastDestinationKey && destinationMarker) return;

    lastDestinationKey = destination.query;

    const point = await geocodeDestination(destination.query);
    if (!point) return;

    destinationPoint = point;
    if (!destinationMarker) {
        destinationMarker = L.marker(point, {
            icon: createDestinationIcon(),
            zIndexOffset: 600
        }).addTo(map);
    } else {
        destinationMarker.setLatLng(point);
    }

    destinationMarker.bindTooltip(destination.label || 'Destino de entrega', {
        direction: 'top',
        offset: [0, -18],
        opacity: 0.92
    });

    fitMapToActivePoints();
}

function extractDestination(order) {
    const street = order.deliveryStreet || '';
    const city = order.deliveryCity || '';
    const region = order.deliveryRegion || '';
    const country = order.deliveryCountry || 'Uruguay';
    const addressText = order.deliveryAddressText || [street, city, region, country]
        .filter(Boolean)
        .join(', ');

    if (!addressText.trim()) return null;

    return {
        query: addressText,
        label: order.deliveryAddressLabel
            ? `${order.deliveryAddressLabel}: ${addressText}`
            : addressText
    };
}

async function geocodeDestination(query) {
    try {
        const params = new URLSearchParams({
            format: 'jsonv2',
            limit: '1',
            countrycodes: 'uy',
            q: query
        });
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
            headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) return null;
        const results = await response.json();
        const first = Array.isArray(results) ? results[0] : null;
        const lat = Number(first?.lat);
        const lng = Number(first?.lon);
        return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
    } catch (error) {
        console.warn('No se pudo ubicar la direccion de entrega.', error);
        return null;
    }
}

function renderNotFound() {
    const container = document.getElementById('status-container');
    if (!container) return;

    container.innerHTML = `
        <div class="text-danger py-3">
            <i class="bi bi-exclamation-triangle fs-1"></i>
            <h4 class="mt-2">No encontrado</h4>
            <p>El enlace podria estar vencido o ser incorrecto.</p>
        </div>
    `;
}

function translatePayment(method) {
    const map = {
        Cash: { label: 'Efectivo', text: 'Efectivo' },
        MercadoPago: { label: 'MercadoPago', text: 'MercadoPago' },
        Transfer: { label: 'Transferencia', text: 'Transferencia Bancaria' },
        Pos: { label: 'POS', text: 'POS al entregar' }
    };
    return map[method] || { label: method || '-', text: method || '-' };
}

function renderNavigationLinks(order) {
    const slug = order.tenantSlug || order.branchSlug || '';
    const menuLink = document.getElementById('track-menu-link');
    const profileLink = document.getElementById('track-profile-link');
    const publicOrderingUrl = order.publicOrderingUrl || (slug ? `order.html?negocio=${encodeURIComponent(slug)}` : '');

    if (menuLink && publicOrderingUrl) {
        menuLink.href = publicOrderingUrl;
        menuLink.hidden = false;
    }

    if (profileLink && slug) {
        profileLink.href = `customer.html?negocio=${encodeURIComponent(slug)}`;
        profileLink.hidden = false;
    }
}

function updateUI(status, hasDriverLocation = false) {
    const container = document.getElementById('status-container');
    const bar = document.getElementById('status-bar');

    const data = getStatusData(status);

    if (container) {
        container.innerHTML = `
            <div class="track-status-orb track-status-orb--${data.tone}">
                <i class="bi ${data.icon}"></i>
            </div>
            <div>
                <small>${data.eyebrow}</small>
                <h2>${data.text}</h2>
                <p>${hasDriverLocation ? 'El mapa se actualiza en vivo.' : data.helper}</p>
            </div>
        `;
    }

    if (bar) {
        bar.style.width = data.width;
        bar.dataset.tone = data.tone;
    }

    renderSteps(status);

    if (status === 'Delivered' || status === 'Cancelled') {
        updateLiveChip(false, status === 'Delivered' ? 'Entregado' : 'Cancelado');
    }

    if (map) setTimeout(() => map.invalidateSize(), 120);
}

function initMap() {
    if (map) {
        map.invalidateSize();
        return;
    }

    const container = document.getElementById('map-container');
    if (!container || typeof L === 'undefined') return;

    map = L.map('map-container', {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: true
    }).setView(DEFAULT_CENTER, 12);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    routeGlow = L.polyline([], {
        color: '#72d4ff',
        weight: 12,
        opacity: 0.18,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(map);

    routeLine = L.polyline([], {
        color: '#2854e8',
        weight: 5,
        opacity: 0.9,
        dashArray: '1 13',
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(map);

    setTimeout(() => map.invalidateSize(), 200);
}

function updateMapLocation(rawLocation, options = {}) {
    const location = normalizeLocation(rawLocation);
    if (!location) return;

    if (!map) initMap();
    if (!map) return;

    const nextPoint = [location.latitude, location.longitude];
    const previousPoint = lastDriverPoint;

    if (!lastDriverPoint || !samePoint(lastDriverPoint, nextPoint)) {
        if (lastDriverPoint) {
            routeDistanceMeters += distanceBetween(lastDriverPoint, nextPoint);
        }
        routePoints.push(nextPoint);
        if (routePoints.length > 80) routePoints = routePoints.slice(-80);
        lastDriverPoint = nextPoint;
    }

    updateRouteLine();
    updateAccuracy(location);
    updateDriverPanel(location);

    if (!driverMarker) {
        driverMarker = L.marker(nextPoint, { icon: createDriverIcon(), zIndexOffset: 1000 }).addTo(map);
        livePulse = L.circleMarker(nextPoint, {
            radius: 20,
            color: '#2854e8',
            fillColor: '#72d4ff',
            fillOpacity: 0.18,
            opacity: 0.38,
            weight: 2
        }).addTo(map);
        fitMapToActivePoints();
    } else if (previousPoint && !samePoint(previousPoint, nextPoint)) {
        animateMarker(previousPoint, nextPoint, 900);
    } else {
        driverMarker.setLatLng(nextPoint);
        livePulse?.setLatLng(nextPoint);
    }

    if (!options.fromPolling || routePoints.length <= 2) {
        fitMapToActivePoints();
    }
}

function clearDriverSignal() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = null;
    driverMarker?.remove();
    livePulse?.remove();
    accuracyCircle?.remove();
    driverMarker = null;
    livePulse = null;
    accuracyCircle = null;
    lastDriverPoint = null;
    routePoints = [];
    routeDistanceMeters = 0;
    updateRouteLine();
}

function animateMarker(from, to, duration) {
    if (animationFrame) cancelAnimationFrame(animationFrame);

    const start = performance.now();
    const ease = value => 1 - Math.pow(1 - value, 3);

    const step = now => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = ease(progress);
        const lat = from[0] + (to[0] - from[0]) * eased;
        const lng = from[1] + (to[1] - from[1]) * eased;
        const point = [lat, lng];

        driverMarker?.setLatLng(point);
        livePulse?.setLatLng(point);

        if (progress < 1) {
            animationFrame = requestAnimationFrame(step);
        }
    };

    animationFrame = requestAnimationFrame(step);
}

function updateRouteLine() {
    routeLine?.setLatLngs(routePoints);
    routeGlow?.setLatLngs(routePoints);
}

function updateAccuracy(location) {
    if (!Number.isFinite(location.accuracyMeters)) {
        accuracyCircle?.remove();
        accuracyCircle = null;
        return;
    }

    if (!accuracyCircle) {
        accuracyCircle = L.circle([location.latitude, location.longitude], {
            radius: Math.max(20, Math.min(location.accuracyMeters, 220)),
            color: '#2854e8',
            fillColor: '#72d4ff',
            fillOpacity: 0.08,
            opacity: 0.24,
            weight: 1
        }).addTo(map);
    } else {
        accuracyCircle.setLatLng([location.latitude, location.longitude]);
        accuracyCircle.setRadius(Math.max(20, Math.min(location.accuracyMeters, 220)));
    }
}

function updateDriverPanel(location, emptyMessage = 'Esperando primera ubicacion') {
    const hasLocation = Boolean(location);
    const signalDot = document.getElementById('signal-dot');
    const signalLabel = document.getElementById('driver-signal-label');
    const signal = document.getElementById('driver-signal');
    const statusOverlay = document.querySelector('.track-map-overlay--status');
    const metricsOverlay = document.querySelector('.track-map-overlay--metrics');
    const recenterButton = document.getElementById('recenter-map');

    if (statusOverlay) statusOverlay.hidden = !hasLocation;
    if (metricsOverlay) metricsOverlay.hidden = !hasLocation;
    if (recenterButton) {
        recenterButton.disabled = !hasLocation && !destinationPoint;
        recenterButton.title = hasLocation ? 'Centrar repartidor' : 'Centrar destino';
    }

    signalDot?.classList.toggle('is-live', hasLocation);
    setText('driver-updated', hasLocation ? formatTime(location.locationAtUtc) : '-');
    setText('driver-distance', formatDistance(routeDistanceMeters));
    setText('driver-speed', hasLocation ? formatSpeed(location.speedMetersPerSecond) : '-');

    if (signalLabel) signalLabel.innerText = hasLocation ? 'GPS activo' : 'Sin GPS activo';
    if (signal) {
        signal.innerText = hasLocation
            ? (lastOrderStatus === 'OnTheWay' ? 'Tu pedido esta en camino' : 'Repartidor localizado')
            : emptyMessage;
    }

    updateLiveChip(hasLocation);
}

function createDriverIcon() {
    return L.divIcon({
        html: `
            <span class="driver-marker">
                <span class="driver-marker__ring"></span>
                <span class="driver-marker__core"><i class="bi bi-scooter"></i></span>
            </span>
        `,
        className: 'driver-marker-host',
        iconSize: [64, 64],
        iconAnchor: [32, 32]
    });
}

function createDestinationIcon() {
    return L.divIcon({
        html: `
            <span class="destination-marker">
                <span class="destination-marker__core"><i class="bi bi-house-door-fill"></i></span>
                <span class="destination-marker__pin"></span>
            </span>
        `,
        className: 'destination-marker-host',
        iconSize: [48, 58],
        iconAnchor: [24, 52]
    });
}

function extractDriverLocation(order) {
    const latitude = Number(order.driverLatitude);
    const longitude = Number(order.driverLongitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (!isFreshSignal(order.driverLocationAtUtc)) return null;

    return {
        latitude,
        longitude,
        accuracyMeters: Number(order.driverAccuracyMeters),
        speedMetersPerSecond: Number(order.driverSpeedMetersPerSecond),
        headingDegrees: Number(order.driverHeadingDegrees),
        locationAtUtc: order.driverLocationAtUtc
    };
}

function isFreshSignal(value) {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return Date.now() - date.getTime() <= DRIVER_SIGNAL_STALE_MS;
}

function normalizeLocation(location) {
    const latitude = Number(location.latitude ?? location.lat);
    const longitude = Number(location.longitude ?? location.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return {
        latitude,
        longitude,
        accuracyMeters: Number(location.accuracyMeters),
        speedMetersPerSecond: Number(location.speedMetersPerSecond),
        headingDegrees: Number(location.headingDegrees),
        locationAtUtc: location.locationAtUtc || new Date().toISOString()
    };
}

function renderSteps(status) {
    const order = ['Pending', 'Confirmed', 'Cooking', 'Ready', 'OnTheWay', 'Delivered'];
    const currentIndex = order.indexOf(status);
    document.querySelectorAll('#status-steps [data-status]').forEach(step => {
        const stepIndex = order.indexOf(step.dataset.status);
        step.classList.toggle('is-active', stepIndex <= currentIndex && currentIndex >= 0);
        step.classList.toggle('is-current', step.dataset.status === status);
    });
}

function fitMapToActivePoints() {
    if (!map) return;

    const points = [];
    if (destinationPoint) points.push(destinationPoint);
    if (lastDriverPoint) points.push(lastDriverPoint);

    if (points.length >= 2) {
        map.fitBounds(L.latLngBounds(points), {
            paddingTopLeft: [40, 94],
            paddingBottomRight: [40, 40],
            maxZoom: 15
        });
        return;
    }

    if (points.length === 1) {
        map.flyTo(points[0], 15, { duration: 0.75 });
    }
}

function getStatusData(status) {
    const map = {
        Pending: {
            icon: 'bi-clock-history',
            text: 'Pedido recibido',
            eyebrow: 'Confirmacion',
            helper: 'El local esta revisando tu pedido.',
            tone: 'warning',
            width: '12%'
        },
        Confirmed: {
            icon: 'bi-check-circle',
            text: 'Confirmado',
            eyebrow: 'Pedido aceptado',
            helper: 'Tu pedido entra al flujo de cocina.',
            tone: 'info',
            width: '28%'
        },
        Cooking: {
            icon: 'bi-fire',
            text: 'En cocina',
            eyebrow: 'Preparacion',
            helper: 'El equipo esta preparando tu pedido.',
            tone: 'danger',
            width: '52%'
        },
        Ready: {
            icon: 'bi-bag-check',
            text: 'Listo para salir',
            eyebrow: 'Despacho',
            helper: 'El pedido espera al repartidor.',
            tone: 'success',
            width: '74%'
        },
        OnTheWay: {
            icon: 'bi-scooter',
            text: 'En camino',
            eyebrow: 'Reparto activo',
            helper: 'El mapa se activa cuando llega la primera senal GPS.',
            tone: 'primary',
            width: '90%'
        },
        Delivered: {
            icon: 'bi-check-circle-fill',
            text: 'Entregado',
            eyebrow: 'Finalizado',
            helper: 'Gracias por comprar.',
            tone: 'success',
            width: '100%'
        },
        Cancelled: {
            icon: 'bi-x-octagon-fill',
            text: 'Cancelado',
            eyebrow: 'Pedido cancelado',
            helper: 'Este pedido fue cancelado.',
            tone: 'dark',
            width: '100%'
        }
    };

    return map[status] || {
        icon: 'bi-circle',
        text: status || 'Actualizando',
        eyebrow: 'Estado',
        helper: 'Actualizacion en tiempo real.',
        tone: 'secondary',
        width: '8%'
    };
}

function getHeroCopy(status) {
    if (status === 'OnTheWay') return 'Tu pedido ya salio. El recorrido se anima con cada senal del repartidor.';
    if (status === 'Ready') return 'Tu pedido esta listo y esperando despacho.';
    if (status === 'Delivered') return 'Pedido entregado. El tracking queda disponible como comprobante.';
    if (status === 'Cancelled') return 'Este pedido fue cancelado por el local.';
    return 'El estado se actualiza automaticamente durante la preparacion y entrega.';
}

function getWaitingMapMessage(status) {
    if (status === 'OnTheWay') return 'Esperando primera senal del repartidor';
    if (status === 'Ready') return 'El mapa se activa cuando el pedido sale';
    if (status === 'Delivered') return 'Pedido entregado';
    return 'El mapa se activa durante el reparto';
}

function updateLiveChip(active, label = null) {
    const chip = document.getElementById('live-chip');
    if (!chip) return;

    chip.classList.toggle('is-live', active);
    chip.innerHTML = active
        ? '<i class="bi bi-broadcast-pin"></i> En vivo'
        : `<i class="bi bi-broadcast"></i> ${label || 'Actualizando'}`;
}

function samePoint(a, b) {
    return Math.abs(a[0] - b[0]) < 0.000001 && Math.abs(a[1] - b[1]) < 0.000001;
}

function distanceBetween(a, b) {
    const earthRadius = 6371000;
    const dLat = toRadians(b[0] - a[0]);
    const dLng = toRadians(b[1] - a[1]);
    const lat1 = toRadians(a[0]);
    const lat2 = toRadians(b[0]);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const value = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
    return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function toRadians(value) {
    return value * Math.PI / 180;
}

function formatDistance(meters) {
    if (!Number.isFinite(meters) || meters <= 0) return '0 m';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
}

function formatSpeed(speedMps) {
    if (!Number.isFinite(speedMps) || speedMps <= 0) return 'Detenido';
    return `${Math.round(speedMps * 3.6)} km/h`;
}

function formatTime(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return 'ahora';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatMoney(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString('es-UY', { maximumFractionDigits: 0 }) : '0';
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.innerText = value ?? '';
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
