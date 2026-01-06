import { login, register, logout } from './auth.js';
import { apiCall, initSignalR } from './apiService.js'; // ⚠️ Importante: traer initSignalR
import { initAdmin } from './adminModule.js';
import { initMenu } from './menuModule.js';

// ==========================================
// 🧠 ROUTER (El Cerebro)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. ¿Estamos en el LOGIN? (index.html)
    if (document.getElementById('login-view')) {
        initAuthLogic(); 
    } 
    // 2. ¿Estamos en el ADMIN? (admin.html)
    else if (document.getElementById('sidebar-toggle') || document.getElementById('admin-name')) {
        initAdmin();      // Lógica general (Sidebar, navegación, etc)
        initUserLogic();  // Lógica de Usuarios (CRUD)
        
        // 🔥 INICIAMOS SIGNALR (Solo en Admin/Cocina)
        await initSignalR({
            // Callback: Cuando llega un pedido nuevo
            onNewOrder: (orderId) => {
                console.log("🔔 Pedido recibido:", orderId);
                
                // A) Alerta sonora o visual (Toast)
                // Puedes usar librerías como Toastify o SweetAlert aquí
                alert(`🔔 ¡NUEVO PEDIDO RECIBIDO! #${orderId}`);

                // B) Recargar la tabla si estamos en la vista de pedidos
                // Verificamos si la función existe (está en adminModule.js)
                if (window.loadOrders) window.loadOrders();
            },
            
            // Callback: Cuando cambia un estado (ej: Cancelado por el cliente)
            onStatusUpdate: (orderId, newStatus) => {
                console.log(`Estado pedido ${orderId} cambió a: ${newStatus}`);
                if (window.loadOrders) window.loadOrders();
            }
        });

        // ⚠️ IMPORTANTE: Si tu apiService.js no une automáticamente al grupo, 
        // deberías tener una función exportada 'joinKitchenGroup' y llamarla aquí.
        // Si seguiste mi consejo anterior de que initSignalR maneje la conexión, 
        // asegúrate de invocar "JoinKitchenGroup" dentro de apiService.js al conectar.
    }
    // 3. ¿Estamos en el MENÚ? (menu.html)
    else if (document.getElementById('product-grid')) {
        initMenu(); 
    }

    // Configuración global del botón salir
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
});

// =====================================================================
// 🔐 LÓGICA DE LOGIN Y REGISTRO (Solo para index.html)
// =====================================================================
function initAuthLogic() {
    console.log("🔒 Iniciando lógica de Autenticación...");

    // --- TOGGLES VISUALES ---
    const linkRegister = document.getElementById('go-to-register');
    const linkLogin = document.getElementById('go-to-login');
    const viewLogin = document.getElementById('login-view');
    const viewRegister = document.getElementById('register-view');

    if(linkRegister) {
        linkRegister.addEventListener('click', () => {
            viewLogin.classList.add('d-none');
            viewRegister.classList.remove('d-none');
        });
    }

    if(linkLogin) {
        linkLogin.addEventListener('click', () => {
            viewRegister.classList.add('d-none');
            viewLogin.classList.remove('d-none');
        });
    }

    // --- LOGIN SUBMIT ---
    const loginForm = document.getElementById('login-form');
    if(loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = document.getElementById('login-username').value;
            const pass = document.getElementById('login-password').value;
            const errorDiv = document.getElementById('login-error');
            const btn = e.submitter;

            if(errorDiv) errorDiv.classList.add('d-none');
            btn.disabled = true;
            btn.textContent = "Verificando...";

            try {
                await login(user, pass);
                // La redirección la maneja auth.js (window.location.href = 'admin.html' o 'menu.html')
            } catch (error) {
                console.error("Login fallido:", error);
                if(errorDiv) {
                    errorDiv.textContent = "Credenciales incorrectas o error de conexión.";
                    errorDiv.classList.remove('d-none');
                }
                btn.disabled = false;
                btn.textContent = "Ingresar";
            }
        });
    }

    // --- REGISTRO SUBMIT ---
    const regForm = document.getElementById('register-form');
    if(regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const errorDiv = document.getElementById('reg-error');
            const successDiv = document.getElementById('reg-success');
            const btn = e.submitter;

            if(errorDiv) errorDiv.classList.add('d-none');
            if(successDiv) successDiv.classList.add('d-none');
            
            const userData = {
                name: document.getElementById('reg-name').value,
                lastName: document.getElementById('reg-lastname').value,
                phone: document.getElementById('reg-phone').value,
                branchId: document.getElementById('reg-branch').value,
                username: document.getElementById('reg-username').value,
                password: document.getElementById('reg-password').value,
                role: 3 // Por defecto Mozo/Delivery al registrarse desde fuera
            };

            btn.disabled = true;
            btn.textContent = "Creando...";

            try {
                await register(userData);
                if(successDiv) successDiv.classList.remove('d-none');
                
                // Recargar para volver al login
                setTimeout(() => window.location.reload(), 2000);
            } catch (error) {
                console.error(error);
                if(errorDiv) {
                    errorDiv.textContent = "Error al registrar. Verifique los datos.";
                    errorDiv.classList.remove('d-none');
                }
                btn.disabled = false;
                btn.textContent = "Registrar";
            }
        });
    }
}

// =====================================================================
// 👥 LÓGICA DE GESTIÓN DE USUARIOS
// =====================================================================
function initUserLogic() {
    console.log("👥 Iniciando lógica de Usuarios en app.js...");

    // 1. Sobreescribimos switchTab para detectar la pestaña 'users'
    window.switchTab = function(tabName) {
        
        // A) Lógica Visual: Mostrar/Ocultar Vistas
        document.querySelectorAll('.content-view').forEach(el => el.classList.add('d-none'));
        const target = document.getElementById('view-' + tabName);
        if (target) target.classList.remove('d-none');

        // B) Lógica Visual: Botón activo en sidebar
        document.querySelectorAll('.list-group-item').forEach(el => el.classList.remove('active', 'bg-primary', 'bg-opacity-10', 'text-primary'));
        // (Nota: La clase 'active' visual se suele poner en el elemento clickeado pasando 'this' en el HTML)

        // C) Cargar datos específicos
        if (tabName === 'users') {
            loadUsers();
        }
        
        // D) Delegar a funciones globales de adminModule.js para otras pestañas
        // Verificamos si existen antes de llamarlas para evitar errores
        if (tabName === 'stock' && window.loadStock) window.loadStock(window.currentBranchId || 1);
        if (tabName === 'ingredients' && window.renderIngredients) window.renderIngredients();
        if (tabName === 'clients' && window.loadClients) window.loadClients();
        if (tabName === 'orders' && window.loadOrders) window.loadOrders();
        if (tabName === 'dashboard' && window.loadDashboard) window.loadDashboard();
        if (tabName === 'cash' && window.initCashView) window.initCashView();
    };

    // 2. Función Global: Preparar Modal
    window.prepareUserModal = function() {
        const form = document.getElementById('user-form');
        if(form) form.reset();
        
        document.getElementById('user-id').value = '';
        document.getElementById('userModalTitle').innerText = 'Nuevo Usuario';
        
        loadBranchesForUserSelect();
    };

    // 3. Función: Cargar Sucursales
    async function loadBranchesForUserSelect() {
        try {
            const branches = await apiCall('/Branch');
            const select = document.getElementById('user-branch');
            if (select) {
                select.innerHTML = '<option value="">Selecciona...</option>';
                if (branches && branches.length > 0) {
                    branches.forEach(b => {
                        select.innerHTML += `<option value="${b.id}">${b.name}</option>`;
                    });
                }
            }
        } catch (error) {
            console.error("Error cargando sucursales", error);
        }
    }

    // 4. Función: Cargar Usuarios
    async function loadUsers() {
        const tbody = document.getElementById('users-table');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Cargando...</td></tr>';
        
        try {
            const users = await apiCall('/User');
            
            if (typeof allUsers !== 'undefined') allUsers = users || [];
            
            const listToRender = users || [];

            tbody.innerHTML = '';
            if (listToRender.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay usuarios.</td></tr>';
                return;
            }
    
            tbody.innerHTML = listToRender.map(u => {
                const rawRole = u.role; 
                const roleStr = String(rawRole).toUpperCase().trim();
                
                let roleHtml = `<span class="badge bg-secondary">Empleado (${rawRole})</span>`; 
                
                if (['1', 'ADMIN', 'ADMINISTRATOR', 'BRANCHMANAGER'].includes(roleStr)) {
                    roleHtml = '<span class="badge bg-danger">Admin</span>';
                } else if (['2', 'KITCHEN', 'COCINA', 'CHEF'].includes(roleStr)) {
                    roleHtml = '<span class="badge bg-warning text-dark">Cocina</span>';
                } else if (['3', 'WAITER', 'DELIVERY', 'MOZO', 'SERVER'].includes(roleStr)) {
                    roleHtml = '<span class="badge bg-info text-dark">Mozo/Delivery</span>';
                }
    
                return `
                    <tr>
                        <td class="ps-4 fw-bold">${u.name} ${u.lastName}</td>
                        <td>${u.username || u.Username || '-'}</td>
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
            console.error(error);
            tbody.innerHTML = `<tr><td colspan="4" class="text-danger text-center">Error: ${error.message}</td></tr>`;
        }
    }

    // 5. Función Global: Editar Usuario
    window.editUser = async function(id) {
        try {
            const modal = new bootstrap.Modal(document.getElementById('userModal'));
            modal.show();
            document.getElementById('userModalTitle').innerText = 'Editar Usuario';
            
            await loadBranchesForUserSelect();
    
            const user = await apiCall(`/User/${id}`);
    
            document.getElementById('user-id').value = user.id;
            document.getElementById('user-username').value = user.username || user.Username || '';
            document.getElementById('user-name').value = user.name;
            document.getElementById('user-lastname').value = user.lastName;
            document.getElementById('user-phone').value = user.phone;
            document.getElementById('user-branch').value = user.branchId || ''; 
            
            let roleVal = 3; 
            if(user.role === 'ADMIN' || user.role === 1) roleVal = 1;
            else if(user.role === 'KITCHEN' || user.role === 2) roleVal = 2;
            else roleVal = 3;
            
            document.getElementById('user-role').value = roleVal;
            document.getElementById('user-pass').value = ''; 
    
        } catch (error) {
            console.error(error);
            alert('Error al cargar usuario.');
        }
    };

    // 6. Función Global: Eliminar Usuario
    window.deleteUser = async function(id) {
        if(!confirm('¿Seguro que quieres eliminar este usuario?')) return;
    
        try {
            await apiCall(`/User/${id}`, 'DELETE');
            loadUsers();
        } catch (error) {
            console.error(error);
            alert('Error al eliminar: ' + error.message);
        }
    };

    // 7. Event Listener: Submit del Formulario Usuario
    const userForm = document.getElementById('user-form');
    if(userForm) {
        // Clonar para limpiar listeners previos y evitar duplicados
        const newForm = userForm.cloneNode(true);
        userForm.parentNode.replaceChild(newForm, userForm);
        
        newForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const id = document.getElementById('user-id').value;
            
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
    
            if(id) userData.id = parseInt(id);
    
            const method = id ? 'PUT' : 'POST';
            const endpoint = id ? `/User/${id}` : '/User';
    
            try {
                await apiCall(endpoint, method, userData);
    
                const modalEl = document.getElementById('userModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal.hide();
                
                loadUsers();
                alert('Usuario guardado correctamente.');
    
            } catch (error) {
                alert('Error: ' + error.message);
            }
        });
    }
}

// =====================================================================
// 🛠️ UTILIDADES GLOBALES
// =====================================================================
window.formatFechaLocal = function(fechaString) {
    if (!fechaString) return '-';
    const fecha = new Date(fechaString); 
    if (!fechaString.endsWith('Z') && !fechaString.includes('+')) {
        fecha.setHours(fecha.getHours() - 3); 
    }
    return fecha.toLocaleString('es-UY', {
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', hour12: false
    });
};