/**
 * order_form.js — Lógica del formulario de pedido (nuevo y editar)
 * Maneja: cálculo en vivo del total, botones +/−, validación, submit via fetch
 */

let PRECIO_LOCRO_UNITARIO = 10000;
let PRECIO_PASTELITO_DOCENA = 8000;
let PRECIO_PASTELITO_MEDIA_DOCENA = 4000;
let PRECIO_PASTELITO_UNIDAD = 700;

const form       = document.getElementById('form-pedido');
const btnSubmit  = document.getElementById('btn-submit');
const totalElem  = document.getElementById('total-display');
const bannerOk   = document.getElementById('banner-exito');
const bannerErr  = document.getElementById('banner-error');

// Establecer fecha por defecto (25 de mayo de 2026) para nuevos pedidos
const fechaPedidoInput = document.getElementById('fecha_pedido');
const modoForm = form?.dataset.modo || 'nuevo';
if (fechaPedidoInput && modoForm === 'nuevo' && !fechaPedidoInput.value) {
  fechaPedidoInput.value = '2026-05-25';
}

// Pre-fill form from URL query parameters (Re-pedido logic)
if (modoForm === 'nuevo') {
  const params = new URLSearchParams(window.location.search);
  if (params.has('nombre')) {
    document.getElementById('nombre_cliente').value = params.get('nombre');
  }
  if (params.has('telefono')) {
    document.getElementById('telefono').value = params.get('telefono');
  }
  if (params.has('email')) {
    document.getElementById('email').value = params.get('email') || '';
  }
  if (params.has('direccion')) {
    document.getElementById('direccion').value = params.get('direccion');
  }
  if (params.has('cantidad_locro')) {
    document.getElementById('cantidad_locro').value = params.get('cantidad_locro');
  }
  if (params.has('cantidad_pastelito_batata')) {
    document.getElementById('cantidad_pastelito_batata').value = params.get('cantidad_pastelito_batata');
  }
  if (params.has('cantidad_pastelito_membrillo')) {
    document.getElementById('cantidad_pastelito_membrillo').value = params.get('cantidad_pastelito_membrillo');
  }
  if (params.has('tipo_entrega')) {
    const radio = document.querySelector(`input[name="tipo_entrega"][value="${params.get('tipo_entrega')}"]`);
    if (radio) radio.checked = true;
  }
  if (params.has('medio_pago')) {
    const radio = document.querySelector(`input[name="medio_pago"][value="${params.get('medio_pago')}"]`);
    if (radio) radio.checked = true;
  }
  if (params.has('notas')) {
    document.getElementById('notas').value = params.get('notas') || '';
  }
  recalcular();
}

// ── Cargar precios desde el servidor ────────────────────────────────────────
fetch('/api/precios')
  .then(r => r.json())
  .then(p => {
    PRECIO_LOCRO_UNITARIO     = p.locro_unitario;
    PRECIO_PASTELITO_DOCENA   = p.pastelito_docena;
    PRECIO_PASTELITO_MEDIA_DOCENA = p.pastelito_media_docena;
    PRECIO_PASTELITO_UNIDAD   = p.pastelito_unidad;
    // Actualizar hints de precio en el DOM
    const hintLocro = document.getElementById('hint-locro');
    const hintPastelito = document.getElementById('hint-pastelito');
    if (hintLocro) hintLocro.textContent = `$${fmt(PRECIO_LOCRO_UNITARIO)}/porción`;
    if (hintPastelito) hintPastelito.textContent = `$${fmt(PRECIO_PASTELITO_UNIDAD)}/u · $${fmt(PRECIO_PASTELITO_MEDIA_DOCENA)}/½doc · $${fmt(PRECIO_PASTELITO_DOCENA)}/doc`;
    recalcular(); // calcular total inicial para el formulario de edición (ya tiene valores)
  });

// ── Formateo ARS ─────────────────────────────────────────────────────────────
function fmt(n) {
  return Number(n).toLocaleString('es-AR');
}

// ── Cálculo del total ────────────────────────────────────────────────────────
function recalcular() {
  const qLocro     = parseInt(document.getElementById('cantidad_locro')?.value)     || 0;
  const qBatata    = parseInt(document.getElementById('cantidad_pastelito_batata')?.value)    || 0;
  const qMembrillo = parseInt(document.getElementById('cantidad_pastelito_membrillo')?.value) || 0;

  const subLocro = qLocro * PRECIO_LOCRO_UNITARIO;
  const totalUnidades = qBatata + qMembrillo;
  
  const docenas = Math.floor(totalUnidades / 12);
  const resto = totalUnidades % 12;
  const medias = Math.floor(resto / 6);
  const unidades = resto % 6;
  
  const subPastelitos = (docenas * PRECIO_PASTELITO_DOCENA) + 
                        (medias * PRECIO_PASTELITO_MEDIA_DOCENA) + 
                        (unidades * PRECIO_PASTELITO_UNIDAD);

  const subLocroEl  = document.getElementById('sub-locro');
  const subPastEl   = document.getElementById('sub-pastelitos');
  if (subLocroEl) subLocroEl.textContent = `$${fmt(subLocro)}`;
  if (subPastEl) {
    if (totalUnidades > 0) {
      let partes = [];
      if (docenas > 0) partes.push(`${docenas} doc`);
      if (medias > 0) partes.push(`1 ½doc`);
      if (unidades > 0) partes.push(`${unidades} u`);
      subPastEl.textContent = `${partes.join(' + ')} · $${fmt(subPastelitos)}`;
    } else {
      subPastEl.textContent = '$0';
    }
  }

  const total = subLocro + subPastelitos;
  if (totalElem) totalElem.textContent = `$${fmt(total)}`;

  // Habilitar submit solo si hay al menos un producto
  if (btnSubmit) {
    btnSubmit.disabled = (qLocro + totalUnidades === 0);
  }
}

// ── Botones +/− para cantidades ──────────────────────────────────────────────
document.querySelectorAll('.qty-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const delta    = parseInt(btn.dataset.delta);
    const input    = document.getElementById(targetId);
    if (!input) return;
    const newVal = Math.max(0, (parseInt(input.value) || 0) + delta);
    input.value = newVal;
    recalcular();
  });
});

// ── Inputs de cantidad (tipeo directo) ───────────────────────────────────────
document.querySelectorAll('.qty-input').forEach(input => {
  input.addEventListener('input', recalcular);
});

// ── Submit del formulario ────────────────────────────────────────────────────
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarBanners();

    // Recolectar datos del form como objeto
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());

    // Validación básica en el cliente
    if (!data.nombre_cliente?.trim()) { mostrarError('El nombre es obligatorio.'); return; }
    if (!data.telefono?.trim())       { mostrarError('El teléfono es obligatorio.'); return; }
    if (!data.direccion?.trim())      { mostrarError('La dirección es obligatoria.'); return; }
    if (!data.medio_pago)             { mostrarError('Seleccioná un medio de pago.'); return; }

    const qLocro     = parseInt(data.cantidad_locro)                || 0;
    const qBatata    = parseInt(data.cantidad_pastelito_batata)     || 0;
    const qMembrillo = parseInt(data.cantidad_pastelito_membrillo)  || 0;
    if (qLocro + qBatata + qMembrillo === 0) {
      mostrarError('El pedido debe tener al menos un producto.');
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Guardando…';

    // Determinar URL y modo (nuevo vs editar)
    const modo     = form.dataset.modo || 'nuevo';
    const pedidoId = form.dataset.pedidoId;
    const url      = modo === 'editar' ? `/pedidos/${pedidoId}/editar` : '/pedidos';

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
          // Nuevo pedido exitoso
          const idSpan = document.getElementById('pedido-id-exito');
          if (idSpan) idSpan.textContent = json.id;
          bannerOk.classList.remove('hidden');
          form.reset();
          recalcular();
          window.scrollTo(0, 0);
        }
      }
    } catch (err) {
      mostrarError('Error de red. Verificá tu conexión.');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = modo === 'editar' ? 'Guardar cambios' : 'Confirmar pedido';
      // En modo nuevo el botón vuelve a quedar disabled (form reseteado)
      if (modo === 'nuevo') btnSubmit.disabled = true;
    }
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function ocultarBanners() {
  if (bannerOk)  bannerOk.classList.add('hidden');
  if (bannerErr) bannerErr.classList.add('hidden');
}

function mostrarError(msg) {
  const span = document.getElementById('error-msg');
  if (span) span.textContent = msg;
  if (bannerErr) bannerErr.classList.remove('hidden');
  window.scrollTo(0, 0);
}
