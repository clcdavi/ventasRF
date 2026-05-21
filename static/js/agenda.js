/**
 * agenda.js — Lógica para la agenda de contactos y su historial
 */

let contactosCache = [];
let contactoSeleccionado = null;

document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('filtro-fecha-agenda');
  const searchInput = document.getElementById('buscar-contacto');
  const btnClearDate = document.getElementById('btn-limpiar-fecha-agenda');

  cargarContactos();

  // Escuchar filtros
  dateInput?.addEventListener('change', cargarContactos);
  btnClearDate?.addEventListener('click', () => {
    if (dateInput) {
      dateInput.value = '';
      cargarContactos();
    }
  });

  searchInput?.addEventListener('input', () => {
    renderContactos();
  });
});

// ── Cargar lista de contactos de la API ──────────────────────────────────────
async function cargarContactos() {
  const dateInput = document.getElementById('filtro-fecha-agenda');
  const fecha = dateInput?.value || '';
  
  const container = document.getElementById('agenda-lista-contactos');
  if (container) {
    container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Cargando contactos...</div>';
  }

  try {
    const url = `/api/contactos${fecha ? '?fecha=' + fecha : ''}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Error en respuesta del servidor');
    
    contactosCache = await resp.json();
    renderContactos();
    
    // Si hay un contacto seleccionado previamente, buscar si sigue en la lista
    if (contactoSeleccionado) {
      const match = contactosCache.find(c => c.nombre_cliente === contactoSeleccionado.nombre_cliente && c.telefono === contactoSeleccionado.telefono);
      if (match) {
        // Volver a seleccionarlo para refrescar buscando su índice en la lista filtrada actual
        const q = document.getElementById('buscar-contacto')?.value.toLowerCase().trim() || '';
        const filtrados = contactosCache.filter(c => {
          return c.nombre_cliente.toLowerCase().includes(q) || 
                 c.telefono.toLowerCase().includes(q);
        });
        const index = filtrados.findIndex(c => c.nombre_cliente === contactoSeleccionado.nombre_cliente && c.telefono === contactoSeleccionado.telefono);
        if (index !== -1) {
          const elements = document.querySelectorAll('.contact-item');
          if (elements[index]) {
            elements[index].click();
          }
        }
      } else {
        // Deseleccionar si ya no está en el filtro
        deseleccionarContacto();
      }
    }
  } catch (err) {
    console.error(err);
    if (container) {
      container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--red);">Error al cargar contactos.</div>';
    }
  }
}

// ── Renderizar contactos aplicando búsqueda local ────────────────────────────
function renderContactos() {
  const container = document.getElementById('agenda-lista-contactos');
  const q = document.getElementById('buscar-contacto')?.value.toLowerCase().trim() || '';

  if (!container) return;

  const filtrados = contactosCache.filter(c => {
    return c.nombre_cliente.toLowerCase().includes(q) || 
           c.telefono.toLowerCase().includes(q);
  });

  if (filtrados.length === 0) {
    container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);">No se encontraron contactos.</div>';
    return;
  }

  container.innerHTML = filtrados.map(c => {
    const isSelected = contactoSeleccionado && 
                       contactoSeleccionado.nombre_cliente === c.nombre_cliente && 
                       contactoSeleccionado.telefono === c.telefono;
    
    return `
      <div class="contact-item ${isSelected ? 'active' : ''}" onclick="seleccionarContacto(${JSON.stringify(c).replace(/"/g, '&quot;')}, this)">
        <div class="contact-item-name">${escHtml(c.nombre_cliente)}</div>
        <div class="contact-item-meta">
          <span>📞 ${escHtml(c.telefono)}</span>
          <span class="contact-item-orders">${c.total_pedidos} ped.</span>
        </div>
      </div>
    `;
  }).join('');
}

// ── Seleccionar un contacto de la lista ──────────────────────────────────────
function seleccionarContacto(contacto, element) {
  contactoSeleccionado = contacto;

  // Actualizar clases activas en el listado
  document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
  element.classList.add('active');

  // Mostrar el panel de detalle
  document.getElementById('agenda-detalle-placeholder')?.classList.add('hidden');
  const contentPanel = document.getElementById('agenda-detalle-contenido');
  contentPanel?.classList.remove('hidden');

  // Rellenar datos estáticos del cliente
  document.getElementById('detalle-nombre').textContent = contacto.nombre_cliente;
  document.getElementById('detalle-telefono-sub').textContent = `Tel: ${contacto.telefono}`;
  document.getElementById('detalle-telefono').textContent = contacto.telefono;
  document.getElementById('detalle-email').textContent = contacto.email || '—';
  if (contacto.email) {
    document.getElementById('detalle-email').title = contacto.email;
  }
  document.getElementById('detalle-direccion').textContent = contacto.direccion || '—';
  if (contacto.direccion) {
    document.getElementById('detalle-direccion').title = contacto.direccion;
  }
  
  // Resumen
  document.getElementById('detalle-resumen-compras').textContent = 
    `${contacto.total_pedidos} pedidos ($${contacto.gasto_total.toLocaleString('es-AR')})`;

  // WhatsApp link
  const cleanTel = contacto.telefono.replace(/\D/g, '');
  let waLink = `https://wa.me/${cleanTel}`;
  if (cleanTel.length === 10 && (cleanTel.startsWith('11') || cleanTel.startsWith('3') || cleanTel.startsWith('2'))) {
    waLink = `https://wa.me/549${cleanTel}`;
  }
  document.getElementById('btn-whatsapp-contacto').href = waLink;

  // Cargar historial de pedidos
  cargarHistorial(contacto.nombre_cliente, contacto.telefono);

  // Desplazar al detalle en móviles
  if (window.innerWidth <= 768) {
    setTimeout(() => {
      contentPanel?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  }
}

// ── Deseleccionar contacto actual ───────────────────────────────────────────
function deseleccionarContacto() {
  contactoSeleccionado = null;
  document.getElementById('agenda-detalle-placeholder')?.classList.remove('hidden');
  document.getElementById('agenda-detalle-contenido')?.classList.add('hidden');
}

// ── Cargar historial de pedidos desde el API ─────────────────────────────────
async function cargarHistorial(nombre, telefono) {
  const tbody = document.getElementById('historial-pedidos-tbody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Cargando historial de pedidos...</td></tr>';
  }

  try {
    const params = new URLSearchParams({ nombre, telefono });
    const resp = await fetch(`/api/contactos/historial?${params.toString()}`);
    if (!resp.ok) throw new Error('Error al cargar historial');

    const historial = await resp.json();

    if (historial.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Sin pedidos registrados.</td></tr>';
      return;
    }

    // Configurar el botón de Re-pedido con los datos del último pedido (que es el primero de la lista cronológica)
    const ultimoPedido = historial[0];
    const repedidoParams = new URLSearchParams({
      nombre: ultimoPedido.nombre_cliente,
      telefono: ultimoPedido.telefono,
      email: ultimoPedido.email || '',
      direccion: ultimoPedido.direccion,
      cantidad_locro: ultimoPedido.cantidad_locro || 0,
      cantidad_pastelito_batata: ultimoPedido.cantidad_pastelito_batata || 0,
      cantidad_pastelito_membrillo: ultimoPedido.cantidad_pastelito_membrillo || 0,
      tipo_entrega: ultimoPedido.tipo_entrega || 'envio',
      medio_pago: ultimoPedido.medio_pago || 'efectivo',
      notas: ultimoPedido.notas || ''
    });
    document.getElementById('btn-repedido-contacto').href = `/nuevo-pedido?${repedidoParams.toString()}`;

    // Renderizar la tabla de historial
    const ESTADO_CLASS = {
      'Pendiente':       'badge-gray',
      'En preparación':  'badge-blue',
      'En envío':        'badge-amber',
      'Entregado':       'badge-green',
    };

    tbody.innerHTML = historial.map(p => {
      const prodText = [] ;
      if (p.cantidad_locro > 0) prodText.push(`${p.cantidad_locro} Locro`);
      const totalPast = (p.cantidad_pastelito_batata || 0) + (p.cantidad_pastelito_membrillo || 0);
      if (totalPast > 0) {
        const sabores = [];
        if (p.cantidad_pastelito_batata > 0) sabores.push(`${p.cantidad_pastelito_batata} Batata`);
        if (p.cantidad_pastelito_membrillo > 0) sabores.push(`${p.cantidad_pastelito_membrillo} Membrillo`);
        prodText.push(`${totalPast} Pastelitos (${sabores.join(', ')})`);
      }

      return `
        <tr>
          <td style="font-weight: 700; color: var(--text-muted);">#${p.id}</td>
          <td>${fmtFecha(p.fecha_pedido)}</td>
          <td style="font-size: 0.85em; line-height: 1.4;">${prodText.join('<br>')}</td>
          <td style="font-weight: 700; white-space: nowrap;">$${p.monto_total.toLocaleString('es-AR')}</td>
          <td>
            <span class="badge ${p.tipo_entrega === 'retiro' ? 'badge-retiro' : 'badge-envio'}">
              ${p.tipo_entrega === 'retiro' ? '⛪ Retiro' : '🛵 Envío'}
            </span>
          </td>
          <td>
            <span class="badge ${ESTADO_CLASS[p.estado] || ''}">${p.estado}</span>
          </td>
          <td>
            <span class="badge ${p.pagado ? 'badge-green' : 'badge-amber'}">
              ${p.pagado ? 'Cobrado' : 'No Cobrado'}
            </span>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error(err);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--red);">Error al obtener historial.</td></tr>';
    }
  }
}

// ── Helpers de formateo y escape ─────────────────────────────────────────────
function fmtFecha(str) {
  if (!str) return '—';
  const [fecha, hora] = str.split(' ');
  const [, m, d] = fecha.split('-');
  return `${d}/${m} ${hora ? hora.slice(0, 5) : ''}`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
