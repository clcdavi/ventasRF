/**
 * order_form.js — Lógica del formulario de pedido (nuevo y editar)
 * Maneja: carga dinámica de productos, cálculo en vivo, envío JSON.
 */

let productosGlobal = [];
const form = document.getElementById('form-pedido');
const btnSubmit = document.getElementById('btn-submit');
const totalElem = document.getElementById('total-display');
const bannerOk = document.getElementById('banner-exito');
const bannerErr = document.getElementById('banner-error');

const modoForm = form?.dataset.modo || 'nuevo';
const fechaPedidoInput = document.getElementById('fecha_pedido');
if (fechaPedidoInput && modoForm === 'nuevo' && !fechaPedidoInput.value) {
  fechaPedidoInput.value = '2026-05-25';
}

// ── Cargar Productos Dinámicamente ──────────────────────────────────────────
async function cargarProductos() {
  try {
    const res = await fetch('/api/productos?activos=true');
    const productos = await res.json();
    productosGlobal = productos;
    renderProductosGrid(productos);
    prefillForm();
  } catch (e) {
    document.getElementById('productos-grid').innerHTML = '<p class="error">Error al cargar productos.</p>';
  }
}

function renderProductosGrid(productos) {
  const container = document.getElementById('productos-grid');
  if (!container) return;

  if (productos.length === 0) {
    container.innerHTML = '<p>No hay productos activos disponibles.</p>';
    return;
  }

  let html = '';
  productos.forEach(p => {
    html += `
      <div class="producto-item">
        <label for="prod_${p.id}">
          ${escHtml(p.nombre)}
          <span class="precio-hint" id="hint_${p.id}">$${fmt(p.precio)}${p.descripcion ? ' - ' + escHtml(p.descripcion) : ''}</span>
        </label>
        <div class="qty-input-wrap">
          <button type="button" class="qty-btn" data-target="prod_${p.id}" data-delta="-1">−</button>
          <input type="number" id="prod_${p.id}" data-precio="${p.precio}" data-id="${p.id}" class="qty-input" value="0" min="0" />
          <button type="button" class="qty-btn" data-target="prod_${p.id}" data-delta="1">+</button>
        </div>
        <span class="subtotal" id="sub_${p.id}">$0</span>
      </div>
    `;
  });
  
  container.innerHTML = html;

  // Bind events for the new buttons and inputs
  document.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const delta = parseInt(btn.dataset.delta);
      const input = document.getElementById(targetId);
      if (!input) return;
      const newVal = Math.max(0, (parseInt(input.value) || 0) + delta);
      input.value = newVal;
      recalcular();
    });
  });

  document.querySelectorAll('.qty-input').forEach(input => {
    input.addEventListener('input', recalcular);
  });
}

// ── Pre-fill Form (URL params o window.PEDIDO_ITEMS) ─────────────────────────
function prefillForm() {
  if (modoForm === 'nuevo') {
    const params = new URLSearchParams(window.location.search);
    if (params.has('nombre')) document.getElementById('nombre_cliente').value = params.get('nombre');
    if (params.has('telefono')) document.getElementById('telefono').value = params.get('telefono');
    if (params.has('email')) document.getElementById('email').value = params.get('email') || '';
    if (params.has('direccion')) document.getElementById('direccion').value = params.get('direccion');
    if (params.has('tipo_entrega')) {
      const radio = document.querySelector(`input[name="tipo_entrega"][value="${params.get('tipo_entrega')}"]`);
      if (radio) radio.checked = true;
    }
    if (params.has('medio_pago')) {
      const radio = document.querySelector(`input[name="medio_pago"][value="${params.get('medio_pago')}"]`);
      if (radio) radio.checked = true;
    }
    if (params.has('notas')) document.getElementById('notas').value = params.get('notas') || '';
    
    // Si viene en URL un formato genérico de items (no soportado nativamente, pero dejamos recalcular por si acaso)
  } else if (modoForm === 'editar') {
    if (window.PEDIDO_ITEMS) {
      window.PEDIDO_ITEMS.forEach(it => {
        const input = document.getElementById(`prod_${it.producto_id}`);
        if (input) {
          input.value = it.cantidad;
        }
      });
    }
  }
  recalcular();
}

function fmt(n) {
  return Number(n).toLocaleString('es-AR');
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Cálculo del total ────────────────────────────────────────────────────────
function recalcular() {
  let total = 0;
  let totalCantidades = 0;
  
  document.querySelectorAll('.qty-input').forEach(input => {
    const cant = parseInt(input.value) || 0;
    const precio = parseFloat(input.dataset.precio) || 0;
    const prodId = input.dataset.id;
    
    const subtotal = cant * precio;
    total += subtotal;
    totalCantidades += cant;
    
    const subEl = document.getElementById(`sub_${prodId}`);
    if (subEl) {
      subEl.textContent = cant > 0 ? `$${fmt(subtotal)}` : '$0';
    }
  });

  if (totalElem) totalElem.textContent = `$${fmt(total)}`;

  if (btnSubmit) {
    btnSubmit.disabled = (totalCantidades === 0);
  }
}

// ── Submit del formulario ────────────────────────────────────────────────────
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarBanners();

    // Recolectar datos básicos
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    
    // Recolectar items
    const items = [];
    document.querySelectorAll('.qty-input').forEach(input => {
      const cant = parseInt(input.value) || 0;
      if (cant > 0) {
        items.push({
          producto_id: parseInt(input.dataset.id),
          cantidad: cant
        });
      }
    });
    
    data.items = items;
    
    if (!data.nombre_cliente?.trim()) { mostrarError('El nombre es obligatorio.'); return; }
    if (!data.telefono?.trim())       { mostrarError('El teléfono es obligatorio.'); return; }
    if (!data.direccion?.trim())      { mostrarError('La dirección es obligatoria.'); return; }
    if (!data.medio_pago)             { mostrarError('Seleccioná un medio de pago.'); return; }

    if (items.length === 0) {
      mostrarError('El pedido debe tener al menos un producto.');
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Guardando…';

    const modo = form.dataset.modo || 'nuevo';
    const pedidoId = form.dataset.pedidoId;
    const url = modo === 'editar' ? `/api/pedidos/${pedidoId}/editar` : '/api/pedidos';

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await resp.json();

      if (!resp.ok) {
        const msg = json.errores ? json.errores.join(' ') : (json.error || 'Error desconocido.');
        mostrarError(msg);
      } else {
        if (modo === 'editar') {
          bannerOk.classList.remove('hidden');
          window.scrollTo(0, 0);
        } else {
          const idSpan = document.getElementById('pedido-id-exito');
          if (idSpan) idSpan.textContent = json.id;
          bannerOk.classList.remove('hidden');
          
          form.reset();
          document.querySelectorAll('.qty-input').forEach(input => input.value = '0');
          recalcular();
          window.scrollTo(0, 0);
        }
      }
    } catch (err) {
      mostrarError('Error de red. Verificá tu conexión.');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = modo === 'editar' ? 'Guardar cambios' : 'Confirmar pedido';
      if (modo === 'nuevo') btnSubmit.disabled = true;
    }
  });
}

function ocultarBanners() {
  if (bannerOk) bannerOk.classList.add('hidden');
  if (bannerErr) bannerErr.classList.add('hidden');
}

function mostrarError(msg) {
  const span = document.getElementById('error-msg');
  if (span) span.textContent = msg;
  if (bannerErr) bannerErr.classList.remove('hidden');
  window.scrollTo(0, 0);
}

// Inicializar cargar
document.addEventListener('DOMContentLoaded', cargarProductos);
