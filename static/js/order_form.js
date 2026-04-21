/**
 * order_form.js — Lógica del formulario de pedido (nuevo y editar)
 * Maneja: cálculo en vivo del total, botones +/−, validación, submit via fetch
 */

let PRECIO_LOCRO_UNITARIO = 12000;
let PRECIO_LOCRO_COMBO    = 20000;
let PRECIO_PASTELITO_DOCENA = 8000;

const form       = document.getElementById('form-pedido');
const btnSubmit  = document.getElementById('btn-submit');
const totalElem  = document.getElementById('total-display');
const bannerOk   = document.getElementById('banner-exito');
const bannerErr  = document.getElementById('banner-error');

// ── Cargar precios desde el servidor ────────────────────────────────────────
fetch('/api/precios')
  .then(r => r.json())
  .then(p => {
    PRECIO_LOCRO_UNITARIO   = p.locro_unitario;
    PRECIO_LOCRO_COMBO      = p.locro_combo;
    PRECIO_PASTELITO_DOCENA = p.pastelito_docena;
    // Actualizar hints de precio en el DOM
    const hintLocro = document.getElementById('hint-locro');
    const hintPastelito = document.getElementById('hint-pastelito');
    if (hintLocro) hintLocro.textContent = `$${fmt(PRECIO_LOCRO_UNITARIO)}/porción · combo 2 = $${fmt(PRECIO_LOCRO_COMBO)}`;
    if (hintPastelito) hintPastelito.textContent = `$${fmt(PRECIO_PASTELITO_DOCENA)}/docena`;
    recalcular(); // calcular total inicial para el formulario de edición (ya tiene valores)
  });

// ── Formateo ARS ─────────────────────────────────────────────────────────────
function fmt(n) {
  return Number(n).toLocaleString('es-AR');
}

// ── Cálculo del total ────────────────────────────────────────────────────────
function calcularTotal(qLocro, qBatata, qMembrillo) {
  const totalLocro      = Math.floor(qLocro / 2) * PRECIO_LOCRO_COMBO + (qLocro % 2) * PRECIO_LOCRO_UNITARIO;
  const totalPastelitos = (qBatata + qMembrillo) * PRECIO_PASTELITO_DOCENA;
  return totalLocro + totalPastelitos;
}

function recalcular() {
  const qLocro     = parseInt(document.getElementById('cantidad_locro')?.value)     || 0;
  const qBatata    = parseInt(document.getElementById('cantidad_pastelito_batata')?.value)    || 0;
  const qMembrillo = parseInt(document.getElementById('cantidad_pastelito_membrillo')?.value) || 0;

  // Subtotales por producto
  const subLocro     = Math.floor(qLocro / 2) * PRECIO_LOCRO_COMBO + (qLocro % 2) * PRECIO_LOCRO_UNITARIO;
  const subBatata    = qBatata * PRECIO_PASTELITO_DOCENA;
  const subMembrillo = qMembrillo * PRECIO_PASTELITO_DOCENA;

  const subLocroEl     = document.getElementById('sub-locro');
  const subBataEl      = document.getElementById('sub-batata');
  const subMembrEl     = document.getElementById('sub-membrillo');
  if (subLocroEl)  subLocroEl.textContent  = `$${fmt(subLocro)}`;
  if (subBataEl)   subBataEl.textContent   = `$${fmt(subBatata)}`;
  if (subMembrEl)  subMembrEl.textContent  = `$${fmt(subMembrillo)}`;

  const total = subLocro + subBatata + subMembrillo;
  if (totalElem) totalElem.textContent = `$${fmt(total)}`;

  // Habilitar submit solo si hay al menos un producto
  if (btnSubmit) {
    btnSubmit.disabled = (qLocro + qBatata + qMembrillo === 0);
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
