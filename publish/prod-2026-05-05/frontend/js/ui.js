const TOAST_TYPES = {
    success: { className: 'text-bg-success', icon: 'bi-check-circle-fill' },
    error: { className: 'text-bg-danger', icon: 'bi-exclamation-triangle-fill' },
    warning: { className: 'text-bg-warning', icon: 'bi-exclamation-circle-fill' },
    info: { className: 'text-bg-primary', icon: 'bi-info-circle-fill' }
};

export function showToast(message, type = 'success') {
    const toastType = TOAST_TYPES[type] || TOAST_TYPES.info;
    let host = document.getElementById('toast-host');

    if (!host) {
        host = document.createElement('div');
        host.id = 'toast-host';
        host.className = 'toast-container position-fixed top-0 end-0 p-3';
        host.style.zIndex = '2000';
        document.body.appendChild(host);
    }

    const toast = document.createElement('div');
    toast.className = `toast k-toast align-items-center border-0 shadow-lg ${toastType.className}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <div class="toast-body d-flex align-items-center gap-2">
                <i class="bi ${toastType.icon}"></i>
                <span>${message}</span>
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button>
        </div>
    `;

    host.appendChild(toast);
    if (window.bootstrap?.Toast) {
        const instance = bootstrap.Toast.getOrCreateInstance(toast, { delay: 3600 });
        toast.addEventListener('hidden.bs.toast', () => toast.remove());
        instance.show();
        return;
    }

    toast.classList.add('show');
    window.setTimeout(() => toast.remove(), 3600);
}

export function setButtonLoading(button, loading, label = 'Guardando...') {
    if (!button) return;

    if (loading) {
        button.dataset.originalHtml = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${label}`;
        return;
    }

    button.disabled = false;
    button.innerHTML = button.dataset.originalHtml || button.innerHTML;
}

export function escapeHtml(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export function confirmAction(message, {
    title = 'Confirmar accion',
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    tone = 'danger'
} = {}) {
    if (!window.bootstrap?.Modal) {
        return Promise.resolve(window.confirm(message));
    }

    return new Promise(resolve => {
        const modal = document.createElement('div');
        modal.className = 'modal fade confirm-dialog';
        modal.tabIndex = -1;
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title fw-bold">${escapeHtml(title)}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                    </div>
                    <div class="modal-body">
                        <p class="mb-0">${escapeHtml(message)}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline-secondary" data-confirm="false">${escapeHtml(cancelLabel)}</button>
                        <button type="button" class="btn btn-${tone}" data-confirm="true">${escapeHtml(confirmLabel)}</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const instance = bootstrap.Modal.getOrCreateInstance(modal);
        let settled = false;

        modal.addEventListener('click', event => {
            const button = event.target.closest('[data-confirm]');
            if (!button) return;
            settled = true;
            resolve(button.dataset.confirm === 'true');
            instance.hide();
        });

        modal.addEventListener('hidden.bs.modal', () => {
            if (!settled) resolve(false);
            modal.remove();
        });

        instance.show();
    });
}

export function promptInput(message, {
    title = 'Ingresar dato',
    confirmLabel = 'Continuar',
    cancelLabel = 'Cancelar',
    placeholder = '',
    value = ''
} = {}) {
    if (!window.bootstrap?.Modal) {
        return Promise.resolve(window.prompt(message));
    }

    return new Promise(resolve => {
        const modal = document.createElement('div');
        modal.className = 'modal fade confirm-dialog';
        modal.tabIndex = -1;
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title fw-bold">${escapeHtml(title)}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                    </div>
                    <div class="modal-body">
                        <label class="form-label">${escapeHtml(message)}</label>
                        <input type="text" class="form-control" data-prompt-input placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}">
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline-secondary" data-prompt-cancel>${escapeHtml(cancelLabel)}</button>
                        <button type="button" class="btn btn-primary" data-prompt-ok>${escapeHtml(confirmLabel)}</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const input = modal.querySelector('[data-prompt-input]');
        const instance = bootstrap.Modal.getOrCreateInstance(modal);
        let settled = false;

        const submit = () => {
            settled = true;
            resolve(input.value.trim());
            instance.hide();
        };

        modal.querySelector('[data-prompt-ok]').addEventListener('click', submit);
        modal.querySelector('[data-prompt-cancel]').addEventListener('click', () => {
            settled = true;
            resolve(null);
            instance.hide();
        });
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') submit();
        });

        modal.addEventListener('shown.bs.modal', () => input.focus());
        modal.addEventListener('hidden.bs.modal', () => {
            if (!settled) resolve(null);
            modal.remove();
        });

        instance.show();
    });
}
