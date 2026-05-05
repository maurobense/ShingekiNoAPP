import { login, logout } from './auth.js';
import { apiCall, initSignalR } from './apiService.js';
import { initAdmin } from './adminModule.js';
import { initMenu } from './menuModule.js';
import { confirmAction, showToast } from './ui.js';

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
            onNewOrder: (orderId) => {
                console.log("🔔 Pedido recibido:", orderId);
                showToast(`Nuevo pedido recibido #${orderId}`, 'info');
                if (window.loadOrders) window.loadOrders();
            },
            onStatusUpdate: (orderId, newStatus) => {
                console.log(`Estado pedido ${orderId} cambió a: ${newStatus}`);
                if (window.loadOrders) window.loadOrders();
            }
        });
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
// 🔐 LÓGICA DE LOGIN (Solo para index.html)
// =====================================================================
function initAuthLogic() {
    console.log("🔒 Iniciando lógica de Autenticación...");

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
}

// =====================================================================
// 👥 LÓGICA DE GESTIÓN DE USUARIOS
// =====================================================================
function initUserLogic() {
    console.log("👥 Iniciando lógica de Usuarios en app.js...");

    window.switchTab = function(tabName) {
        document.querySelectorAll('.content-view').forEach(el => el.classList.add('d-none'));
        const target = document.getElementById('view-' + tabName);
        if (target) target.classList.remove('d-none');

        document.querySelectorAll('.list-group-item').forEach(el => el.classList.remove('active', 'bg-primary', 'bg-opacity-10', 'text-primary'));

        if (tabName === 'users') { window.loadUsers(); }
        if (tabName === 'stock' && window.loadStock) window.loadStock();
        if (tabName === 'ingredients' && window.renderIngredients) window.renderIngredients();
        if (tabName === 'clients' && window.loadClients) window.loadClients();
        if (tabName === 'orders' && window.loadOrders) window.loadOrders();
        if (tabName === 'dashboard' && window.loadDashboard) window.loadDashboard();
        if (tabName === 'cash' && window.initCashView) window.initCashView();
        if (tabName === 'settings' && window.loadBranchSettings) window.loadBranchSettings();
    };

    window.prepareUserModal = function() {
        const form = document.getElementById('user-form');
        if(form) form.reset();
        
        document.getElementById('user-id').value = '';
        document.getElementById('userModalTitle').innerText = 'Nuevo Usuario';
        
        const modalEl = document.getElementById('userModal');
        if (modalEl) {
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();
        }
    };

    window.loadUsers = async function() {
        const tbody = document.getElementById('users-table');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Cargando...</td></tr>';
        
        try {
            const users = await apiCall('/User');
            window.allUsers = users || [];
            
            const listToRender = window.allUsers;

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
    };

    window.editUser = async function(id) {
        try {
            window.prepareUserModal();
            document.getElementById('userModalTitle').innerText = 'Editar Usuario';
            const user = await apiCall(`/User/${id}`);
    
            document.getElementById('user-id').value = user.id;
            document.getElementById('user-username').value = user.username || user.Username || '';
            document.getElementById('user-name').value = user.name;
            document.getElementById('user-lastname').value = user.lastName;
            document.getElementById('user-phone').value = user.phone;
            
            let roleVal = 3; 
            if(user.role === 'ADMIN' || user.role === 1) roleVal = 1;
            else if(user.role === 'KITCHEN' || user.role === 2) roleVal = 2;
            
            document.getElementById('user-role').value = roleVal;
            document.getElementById('user-pass').value = ''; 
    
        } catch (error) {
            console.error(error);
            showToast('Error al cargar usuario.', 'error');
        }
    };

    window.deleteUser = async function(id) {
        if(!await confirmAction('Eliminar este usuario?', { title: 'Eliminar usuario' })) return;
        try {
            await apiCall(`/User/${id}`, 'DELETE');
            window.loadUsers();
        } catch (error) {
            console.error(error);
            showToast('Error al eliminar: ' + error.message, 'error');
        }
    };

    const userForm = document.getElementById('user-form');
    if(userForm) {
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
                branchId: 0, // 🔥 YA NO MANDA SUCURSAL, EL BACKEND LO SABE 
                picture: '' 
            };
    
            if(id) userData.id = parseInt(id);
    
            const method = id ? 'PUT' : 'POST';
            const endpoint = id ? `/User/${id}` : '/User';
    
            try {
                await apiCall(endpoint, method, userData);
                const modalEl = document.getElementById('userModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
                window.loadUsers();
                showToast('Usuario guardado correctamente.');
            } catch (error) {
                showToast('Error: ' + error.message, 'error');
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
