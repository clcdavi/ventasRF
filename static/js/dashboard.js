/**
 * dashboard.js — Panel de control de ventas
 * Maneja: tabla de pedidos, filtros, cambio de estado, eliminación, estadísticas
 */

// ── Estado local del dashboard ───────────────────────────────────────────────
let sortCol = 'id';
let sortDir = 'desc';  // 'asc' | 'desc'
let pedidosCached = [];

// ── Formateo fecha ───────────────────────────────────────────────────────────
function fmtFecha(str) {
  if (!str) return '—';
  const [fecha, hora] = str.split(' ');
  const [y, m, d] = fecha.split('-');
  return `${d}/${m} ${hora ? hora.slice(0, 5) : ''}`;
}

// ── Formateo ARS ─────────────────────────────────────────────────────────────
function fmt(n) {
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0 });
}

// ── Colores de estado ────────────────────────────────────────────────────────
const ESTADO_CLASS = {
  'Pendiente':       'badge-gray',
  'En preparación':  'badge-blue',
  'En envío':        'badge-amber',
  'Entregado':       'badge-green',
};

// ── Carga inicial ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  cargarTodo();

  document.getElementById('btn-refresh')?.addEventListener('click', cargarTodo);
  document.getElementById('btn-limpiar')?.addEventListener('click', limpiarFiltros);
  document.getElementById('btn-exportar')?.addEventListener('click', exportarExcel);

  // Filtros: re-fetch al cambiar
  ['filtro-estado', 'filtro-pago', 'filtro-fecha'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', cargarPedidos);
  });

  // Ordenar al hacer clic en cabeceras
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = col;
        sortDir = 'asc';
      }
      renderTabla(pedidosCached);
    });
  });

  // Event delegation para botones de eliminar (evita onclick inline con strings)
  document.getElementById('tbody-pedidos')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-delete');
    if (!btn || btn.disabled) return;
    const id     = parseInt(btn.dataset.id);
    const nombre = btn.dataset.nombre;
    confirmarEliminar(id, nombre);
  });
});

function cargarTodo() {
  cargarPedidos();
  cargarStats();
}

// ── Carga de pedidos con filtros ─────────────────────────────────────────────
async function cargarPedidos() {
  const estado    = document.getElementById('filtro-estado')?.value || '';
  const medioPago = document.getElementById('filtro-pago')?.value    || '';
  const fecha     = document.getElementById('filtro-fecha')?.value   || '';

  const params = new URLSearchParams();
  if (estado)    params.append('estado',     estado);
  if (medioPago) params.append('medio_pago', medioPago);
  if (fecha)     params.append('fecha',      fecha);

  try {
    const resp = await fetch(`/api/pedidos?${params.toString()}`);
    const data = await resp.json();
    pedidosCached = data;
    renderTabla(data);
  } catch (err) {
    mostrarToast('Error al cargar pedidos.', 'error');
  }
}

// ── Render de la tabla ───────────────────────────────────────────────────────
function renderTabla(pedidos) {
  const tbody      = document.getElementById('tbody-pedidos');
  const emptyState = document.getElementById('empty-state');
  const table      = document.getElementById('tabla-pedidos');
  if (!tbody) return;

  // Ordenar
  const sorted = [...pedidos].sort((a, b) => {
    let va = a[sortCol], vb = b[sortCol];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  if (sorted.length === 0) {
    tbody.innerHTML = '';
    emptyState?.classList.remove('hidden');
    table?.classList.add('hidden');
    return;
  }

  emptyState?.classList.add('hidden');
  table?.classList.remove('hidden');

  tbody.innerHTML = sorted.map(p => `
    <tr data-id="${p.id}">
      <td class="td-id">#${p.id}</td>
      <td class="td-fecha">${fmtFecha(p.fecha_pedido)}</td>
      <td>
        <div class="cliente-nombre">${escHtml(p.nombre_cliente)}</div>
        <div class="cliente-tel">${escHtml(p.telefono)}</div>
      </td>
      <td class="td-dir">${escHtml(p.direccion)}</td>
      <td class="td-productos">${resumenProductos(p)}</td>
      <td class="td-total">$${fmt(p.monto_total)}</td>
      <td><span class="badge badge-pago">${escHtml(p.medio_pago)}</span></td>
      <td class="td-horario">${escHtml(p.horario_entrega || '—')}</td>
      <td>
        <select class="select-estado-inline badge ${ESTADO_CLASS[p.estado] || ''}"
                data-id="${p.id}" onchange="cambiarEstado(${p.id}, this.value, this)">
          ${opcionesEstado(p.estado)}
        </select>
      </td>
      <td class="td-pagado">
        <button class="btn-pagado ${p.pagado ? 'pagado' : 'no-pagado'}"
                data-id="${p.id}" onclick="togglePagado(${p.id}, ${!p.pagado}, this)">
          ${p.pagado ? 'Pagado' : 'Pendiente'}
        </button>
      </td>
      <td class="td-acciones">
        <a href="/pedidos/${p.id}/editar" class="btn-icon btn-edit" title="Editar">✏️</a>
        <button class="btn-icon btn-delete ${p.estado !== 'Pendiente' ? 'disabled' : ''}"
                data-id="${p.id}" data-nombre="${escHtml(p.nombre_cliente)}"
                ${p.estado !== 'Pendiente' ? 'disabled title="Solo se puede eliminar si está Pendiente"' : 'title="Eliminar pedido"'}>
          🗑️
        </button>
      </td>
    </tr>
  `).join('');
}

function resumenProductos(p) {
  const partes = [];
  if (p.cantidad_locro > 0)               partes.push(`${p.cantidad_locro} locro`);
  if (p.cantidad_pastelito_batata > 0)    partes.push(`${p.cantidad_pastelito_batata} ½doc batata`);
  if (p.cantidad_pastelito_membrillo > 0) partes.push(`${p.cantidad_pastelito_membrillo} ½doc memb.`);
  return partes.join('<br>') || '—';
}

function opcionesEstado(actual) {
  const estados = ['Pendiente', 'En preparación', 'En envío', 'Entregado'];
  return estados.map(e =>
    `<option value="${e}" ${e === actual ? 'selected' : ''}>${e}</option>`
  ).join('');
}

// ── Cambiar estado desde la tabla ────────────────────────────────────────────
async function cambiarEstado(id, nuevoEstado, selectEl) {
  try {
    const resp = await fetch(`/api/pedidos/${id}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado }),
    });
    if (!resp.ok) {
      const json = await resp.json();
      mostrarToast(json.error || 'Error al cambiar estado.', 'error');
      // Revertir el select visualmente
      cargarPedidos();
      return;
    }
    // Actualizar clase del select para reflejar nuevo color
    selectEl.className = `select-estado-inline badge ${ESTADO_CLASS[nuevoEstado] || ''}`;

    // Actualizar cache local
    const idx = pedidosCached.findIndex(p => p.id === id);
    if (idx !== -1) {
      pedidosCached[idx].estado = nuevoEstado;
      // Actualizar botón de eliminar en la fila
      const row = document.querySelector(`tr[data-id="${id}"]`);
      const btnDel = row?.querySelector('.btn-delete');
      if (btnDel) {
        if (nuevoEstado !== 'Pendiente') {
          btnDel.disabled = true;
          btnDel.classList.add('disabled');
          btnDel.title = 'Solo se puede eliminar si está Pendiente';
        } else {
          btnDel.disabled = false;
          btnDel.classList.remove('disabled');
          btnDel.title = 'Eliminar pedido';
        }
      }
    }
    mostrarToast(`Estado actualizado: ${nuevoEstado}`, 'success');
    cargarStats(); // actualizar tarjetas
  } catch (err) {
    mostrarToast('Error de red.', 'error');
  }
}

// ── Cambiar estado de pago ────────────────────────────────────────────────────
async function togglePagado(id, nuevoPagado, btn) {
  try {
    const resp = await fetch(`/api/pedidos/${id}/pagado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pagado: nuevoPagado }),
    });
    if (!resp.ok) { mostrarToast('Error al actualizar pago.', 'error'); return; }
    btn.textContent = nuevoPagado ? 'Pagado' : 'Pendiente';
    btn.className = `btn-pagado ${nuevoPagado ? 'pagado' : 'no-pagado'}`;
    btn.onclick = () => togglePagado(id, !nuevoPagado, btn);
    const idx = pedidosCached.findIndex(p => p.id === id);
    if (idx !== -1) pedidosCached[idx].pagado = nuevoPagado;
    mostrarToast(nuevoPagado ? 'Marcado como pagado.' : 'Marcado como pendiente.', 'success');
  } catch { mostrarToast('Error de red.', 'error'); }
}

// ── Eliminar pedido ───────────────────────────────────────────────────────────
function confirmarEliminar(id, nombre) {
  if (!confirm(`¿Eliminar el pedido #${id} de ${nombre}?\n\nEsta acción no se puede deshacer.`)) return;
  fetch(`/api/pedidos/${id}`, { method: 'DELETE' })
    .then(r => r.json())
    .then(json => {
      if (json.ok) {
        mostrarToast(`Pedido #${id} eliminado.`, 'success');
        cargarTodo();
      } else {
        mostrarToast(json.error || 'No se pudo eliminar.', 'error');
      }
    })
    .catch(() => mostrarToast('Error de red.', 'error'));
}

// ── Estadísticas ─────────────────────────────────────────────────────────────
async function cargarStats() {
  try {
    const resp = await fetch('/api/stats');
    const s = await resp.json();

    // Tarjetas resumen
    setText('stat-total-pedidos', s.total_pedidos);
    setText('stat-ingresos', `$${fmt(s.ingresos_totales)}`);
    setText('stat-pendientes', s.por_estado?.['Pendiente'] || 0);
    setText('stat-entregados', s.por_estado?.['Entregado'] || 0);

    // Barras de unidades
    const maxQty = Math.max(s.total_locro, s.total_batata, s.total_membrillo, 1);
    setBar('bar-locro',     s.total_locro,    maxQty);
    setBar('bar-batata',    s.total_batata,   maxQty);
    setBar('bar-membrillo', s.total_membrillo, maxQty);
    setText('val-locro',     s.total_locro);
    setText('val-batata',    s.total_batata);
    setText('val-membrillo', s.total_membrillo);

    // Barras de ingresos por pago
    const pagos = s.ingresos_por_pago || {};
    const maxPago = Math.max(pagos.efectivo || 0, pagos.transferencia || 0, pagos.tarjeta || 0, 1);
    setBar('bar-efectivo',      pagos.efectivo      || 0, maxPago);
    setBar('bar-transferencia', pagos.transferencia  || 0, maxPago);
    setBar('bar-tarjeta',       pagos.tarjeta        || 0, maxPago);
    setText('val-efectivo',      `$${fmt(pagos.efectivo      || 0)}`);
    setText('val-transferencia', `$${fmt(pagos.transferencia  || 0)}`);
    setText('val-tarjeta',       `$${fmt(pagos.tarjeta        || 0)}`);

  } catch (err) {
    console.error('Error al cargar stats:', err);
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setBar(id, val, max) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${Math.round((val / max) * 100)}%`;
}

// ── Exportar a Excel ──────────────────────────────────────────────────────────
function exportarExcel() {
  const estado    = document.getElementById('filtro-estado')?.value || '';
  const medioPago = document.getElementById('filtro-pago')?.value    || '';
  const fecha     = document.getElementById('filtro-fecha')?.value   || '';

  const params = new URLSearchParams();
  if (estado)    params.append('estado',     estado);
  if (medioPago) params.append('medio_pago', medioPago);
  if (fecha)     params.append('fecha',      fecha);

  window.location.href = `/api/export?${params.toString()}`;
}

// ── Limpiar filtros ───────────────────────────────────────────────────────────
function limpiarFiltros() {
  document.getElementById('filtro-estado').value = '';
  document.getElementById('filtro-pago').value   = '';
  document.getElementById('filtro-fecha').value  = '';
  cargarPedidos();
}

// ── Toast de feedback ─────────────────────────────────────────────────────────
let toastTimer;
function mostrarToast(msg, tipo = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className   = `toast toast-${tipo}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

// ── Sanitización básica ───────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
