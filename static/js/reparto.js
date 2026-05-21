/**
 * reparto.js — Lógica para la sección de Reparto y Ruteador de Envíos
 */

let mapa = null;
let markersGroup = null;
let routeLine = null;
let pedidosCache = [];
let seleccionados = []; // Array de pedidos seleccionados en orden de click
let geocodeCache = {};  // Caché local de direcciones geocodificadas en la sesión
let lastRequestTime = 0;
const minInterval = 1000; // Respetar el límite de Nominatim (1 req/seg)

document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('filtro-fecha-reparto');
  const btnClearDate = document.getElementById('btn-limpiar-fecha-reparto');
  const selectAllCheckbox = document.getElementById('select-all-reparto');
  const btnGenerateRoute = document.getElementById('btn-generar-ruta');
  const btnWhatsappDriver = document.getElementById('btn-whatsapp-repartidor');

  // Inicializar Leaflet
  initMap();

  // Cargar pedidos iniciales
  cargarPedidosReparto();

  // Escuchar filtros
  dateInput?.addEventListener('change', cargarPedidosReparto);
  btnClearDate?.addEventListener('click', () => {
    if (dateInput) {
      dateInput.value = '';
      cargarPedidosReparto();
    }
  });

  // Checkbox Seleccionar Todos
  selectAllCheckbox?.addEventListener('change', (e) => {
    toggleAll(e.target.checked);
  });

  // Botón Generar Ruta
  btnGenerateRoute?.addEventListener('click', () => {
    if (seleccionados.length === 0) return;
    abrirRutaGoogleMaps();
  });

  // Botón Enviar WhatsApp
  btnWhatsappDriver?.addEventListener('click', () => {
    if (seleccionados.length === 0) return;
    despacharWhatsApp();
  });
});

// ── Inicializar el Mapa de Leaflet ───────────────────────────────────────────
function initMap() {
  // Coordenadas iniciales por defecto en San Fernando, Buenos Aires
  const defaultCenter = [-34.4379, -58.5583];
  const defaultZoom = 13;

  mapa = L.map('mapa-reparto').setView(defaultCenter, defaultZoom);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(mapa);

  markersGroup = L.featureGroup().addTo(mapa);
  
  // Ajustar tamaño para corregir posibles glitches de carga
  setTimeout(() => {
    mapa.invalidateSize();
  }, 300);
}

// ── Cargar Pedidos de Envío desde la API ──────────────────────────────────────
async function cargarPedidosReparto() {
  const dateInput = document.getElementById('filtro-fecha-reparto');
  const fecha = dateInput?.value || '';
  const container = document.getElementById('reparto-lista-pedidos');
  const selectAllCheckbox = document.getElementById('select-all-reparto');

  if (container) {
    container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Cargando envíos...</div>';
  }

  // Reiniciar estado
  seleccionados = [];
  markersGroup.clearLayers();
  if (routeLine) {
    mapa.removeLayer(routeLine);
    routeLine = null;
  }
  if (selectAllCheckbox) selectAllCheckbox.checked = false;
  actualizarRutaYBotones();

  try {
    const url = `/api/pedidos/envios${fecha ? '?fecha=' + fecha : ''}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Error al obtener los envíos.');

    pedidosCache = await resp.json();
    renderPedidosReparto();
  } catch (err) {
    console.error(err);
    if (container) {
      container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--red);">Error al cargar pedidos.</div>';
    }
  }
}

// ── Renderizar Pedidos de Envío en el Sidebar ────────────────────────────────
function renderPedidosReparto() {
  const container = document.getElementById('reparto-lista-pedidos');
  if (!container) return;

  if (pedidosCache.length === 0) {
    container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);">No hay envíos pendientes para esta fecha.</div>';
    return;
  }

  container.innerHTML = pedidosCache.map(p => {
    const prodText = [];
    if (p.cantidad_locro > 0) prodText.push(`${p.cantidad_locro} Locro`);
    const totalPast = (p.cantidad_pastelito_batata || 0) + (p.cantidad_pastelito_membrillo || 0);
    if (totalPast > 0) {
      const sabores = [];
      if (p.cantidad_pastelito_batata > 0) sabores.push(`${p.cantidad_pastelito_batata} Batata`);
      if (p.cantidad_pastelito_membrillo > 0) sabores.push(`${p.cantidad_pastelito_membrillo} Membrillo`);
      prodText.push(`${totalPast} Pastelitos (${sabores.join(', ')})`);
    }
    const prodSummary = prodText.join(' · ');

    return `
      <div class="delivery-item" data-id="${p.id}" onclick="handleRowClick(${p.id}, event)">
        <input type="checkbox" class="delivery-checkbox" data-id="${p.id}" onclick="event.stopPropagation(); handleCheckboxChange(${p.id}, this.checked);" />
        <div class="delivery-content">
          <div class="delivery-title-row">
            <span style="font-weight: 700;">${escHtml(p.nombre_cliente)}</span>
            <span style="color: var(--text); font-weight: 700;">$${p.monto_total.toLocaleString('es-AR')}</span>
          </div>
          <div class="delivery-address">📍 ${escHtml(p.direccion)}</div>
          <div class="delivery-products">${escHtml(prodSummary)}</div>
          ${p.horario_entrega ? `<span class="delivery-time">⏰ ${escHtml(p.horario_entrega)}</span>` : ''}
          ${p.notas ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.35rem; font-style: italic; border-left: 2px solid var(--border); padding-left: 0.5rem;">Nota: ${escHtml(p.notas)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ── Clic en Fila del Listado ──────────────────────────────────────────────────
function handleRowClick(id, event) {
  // Ignorar si hace clic en el checkbox (se maneja en su propio handler)
  if (event.target.classList.contains('delivery-checkbox')) return;

  const itemEl = document.querySelector(`.delivery-item[data-id="${id}"]`);
  const cb = itemEl?.querySelector('.delivery-checkbox');
  if (cb) {
    cb.checked = !cb.checked;
    handleCheckboxChange(id, cb.checked);
  }
}

// ── Cambio de Checkbox Individual ───────────────────────────────────────────
async function handleCheckboxChange(id, isChecked) {
  if (isChecked) {
    await seleccionarPedido(id, true);
  } else {
    deseleccionarPedido(id, true);
  }
}

// ── Lógica de Selección de Todos ──────────────────────────────────────────────
let toggleAllInProgress = false;
async function toggleAll(isChecked) {
  if (toggleAllInProgress) return;
  toggleAllInProgress = true;

  const checkboxes = document.querySelectorAll('.delivery-checkbox');

  if (!isChecked) {
    // Deseleccionar todos
    for (const cb of checkboxes) {
      cb.checked = false;
      const id = parseInt(cb.dataset.id);
      deseleccionarPedido(id, false);
    }
    seleccionados = [];
    updateMarkers();
    actualizarRutaYBotones();
    toggleAllInProgress = false;
    return;
  }

  // Seleccionar todos secuencialmente (respetando rate-limit de geocodificación)
  showToast('Geocodificando direcciones. Por favor espere...', 'info', 4000);
  for (const cb of checkboxes) {
    if (cb.checked) continue;
    const id = parseInt(cb.dataset.id);
    const success = await seleccionarPedido(id, false);
    if (!success) {
      cb.checked = false;
    }
  }

  updateMarkers();
  actualizarRutaYBotones();

  if (markersGroup.getLayers().length > 0) {
    mapa.fitBounds(markersGroup.getBounds(), { padding: [50, 50] });
  }

  toggleAllInProgress = false;
}

// ── Seleccionar Pedido y Geocodificar ─────────────────────────────────────────
async function seleccionarPedido(id, shouldFitBounds = true) {
  if (seleccionados.some(s => s.id === id)) return true;

  const p = pedidosCache.find(item => item.id === id);
  if (!p) return false;

  const prodText = [];
  if (p.cantidad_locro > 0) prodText.push(`${p.cantidad_locro} Locro`);
  if (p.cantidad_pastelito_batata > 0) prodText.push(`${p.cantidad_pastelito_batata} Batata`);
  if (p.cantidad_pastelito_membrillo > 0) prodText.push(`${p.cantidad_pastelito_membrillo} Membrillo`);
  const prodSummary = prodText.join(', ');

  const coords = await geocodeAddress(p.direccion);

  let selectionObj = {
    id: p.id,
    nombre_cliente: p.nombre_cliente,
    direccion: p.direccion,
    telefono: p.telefono,
    productos: prodSummary,
    geocoded: false,
    lat: null,
    lng: null
  };

  if (coords) {
    selectionObj.geocoded = true;
    selectionObj.lat = coords.lat;
    selectionObj.lng = coords.lng;
  } else {
    showToast(`No se pudo geocodificar la dirección de ${p.nombre_cliente}. Se usará texto para Google Maps.`, 'warning', 4500);
  }

  seleccionados.push(selectionObj);

  // Marcar visualmente en el sidebar
  const itemEl = document.querySelector(`.delivery-item[data-id="${id}"]`);
  if (itemEl) {
    itemEl.classList.add('active');
    const cb = itemEl.querySelector('.delivery-checkbox');
    if (cb) cb.checked = true;
  }

  if (shouldFitBounds) {
    updateMarkers();
    actualizarRutaYBotones();
    if (coords && markersGroup.getLayers().length > 0) {
      mapa.fitBounds(markersGroup.getBounds(), { padding: [50, 50] });
    }
  }

  return true;
}

// ── Deseleccionar Pedido ─────────────────────────────────────────────────────
function deseleccionarPedido(id, shouldFitBounds = true) {
  seleccionados = seleccionados.filter(s => s.id !== id);

  // Desmarcar en el sidebar
  const itemEl = document.querySelector(`.delivery-item[data-id="${id}"]`);
  if (itemEl) {
    itemEl.classList.remove('active');
    const cb = itemEl.querySelector('.delivery-checkbox');
    if (cb) cb.checked = false;
  }

  if (shouldFitBounds) {
    updateMarkers();
    actualizarRutaYBotones();
    if (markersGroup.getLayers().length > 0) {
      mapa.fitBounds(markersGroup.getBounds(), { padding: [50, 50] });
    }
  }
}

// ── Crear Icono de Marcador Numerado ──────────────────────────────────────────
function createNumberedIcon(number) {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="
      background-color: var(--primary-dark); 
      color: white; 
      border-radius: 50%; 
      width: 28px; 
      height: 28px; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      font-weight: bold; 
      font-size: 0.85rem;
      border: 2px solid white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    ">${number}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

// ── Actualizar Marcadores en el Mapa ──────────────────────────────────────────
function updateMarkers() {
  markersGroup.clearLayers();
  
  let stopNumber = 1;
  seleccionados.forEach(s => {
    if (s.geocoded) {
      const popupContent = `
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.85rem; min-width: 160px; line-height: 1.4;">
          <div style="font-weight: 700; color: var(--primary-dark); margin-bottom: 0.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.25rem;">
            Parada ${stopNumber}: ${escHtml(s.nombre_cliente)}
          </div>
          <div style="font-weight: 600; margin-bottom: 0.25rem;">📍 ${escHtml(s.direccion)}</div>
          <div>📞 ${escHtml(s.telefono)}</div>
          ${s.productos ? `<div style="font-size: 0.75rem; margin-top: 0.35rem; font-style: italic; background: #f1f5f9; padding: 0.25rem 0.5rem; border-radius: 4px; color: var(--text-muted);">${escHtml(s.productos)}</div>` : ''}
        </div>
      `;

      const icon = createNumberedIcon(stopNumber);
      const marker = L.marker([s.lat, s.lng], { icon: icon }).bindPopup(popupContent);
      markersGroup.addLayer(marker);
      stopNumber++;
    }
  });
}

// ── Actualizar Línea de Ruta, Botones e Info ──────────────────────────────────
function actualizarRutaYBotones() {
  const counterSpan = document.getElementById('reparto-counter');
  if (counterSpan) {
    counterSpan.textContent = `${seleccionados.length} seleccionado${seleccionados.length === 1 ? '' : 's'}`;
  }

  const btnGenerate = document.getElementById('btn-generar-ruta');
  const btnWA = document.getElementById('btn-whatsapp-repartidor');

  if (btnGenerate) btnGenerate.disabled = (seleccionados.length === 0);
  if (btnWA) btnWA.disabled = (seleccionados.length === 0);

  // Redibujar polyline
  if (routeLine) {
    mapa.removeLayer(routeLine);
    routeLine = null;
  }

  const coords = seleccionados.filter(s => s.geocoded).map(s => [s.lat, s.lng]);
  if (coords.length > 1) {
    routeLine = L.polyline(coords, {
      color: 'var(--primary-dark)',
      weight: 4,
      opacity: 0.8,
      dashArray: '5, 8'
    }).addTo(mapa);
  }

  // Actualizar panel de información de ruta
  const infoText = document.getElementById('info-ruta-texto');
  if (infoText) {
    if (seleccionados.length === 0) {
      infoText.innerHTML = 'Seleccione pedidos del listado para geocodificarlos y visualizarlos en el mapa.';
    } else {
      let html = `<ol style="margin-left: 1.2rem; margin-top: 0.35rem; display: flex; flex-direction: column; gap: 0.35rem;">`;
      seleccionados.forEach((s, idx) => {
        const geoStatus = s.geocoded ? '<span style="color: var(--green);">📍</span>' : '<span style="color: var(--amber);" title="No ubicado, se usará texto en Google Maps">⚠️</span>';
        html += `<li><strong>${idx + 1}.</strong> ${escHtml(s.nombre_cliente)} (${geoStatus} ${escHtml(s.direccion)})</li>`;
      });
      html += `</ol>`;
      infoText.innerHTML = html;
    }
  }
}

// ── Llamada Geocodificadora a Nominatim (con delay de protección) ─────────────
async function geocodeAddress(direccion) {
  let q = direccion.trim();
  const lowerQ = q.toLowerCase();
  
  if (lowerQ.includes('argentina')) {
    // Ya tiene contexto de país
  } else if (lowerQ.includes('san fernando') || lowerQ.includes('sanfer') || lowerQ.includes('tigre')) {
    q += ', Argentina';
  } else {
    q += ', San Fernando, Buenos Aires, Argentina';
  }

  // Comprobar caché
  if (geocodeCache[q]) return geocodeCache[q];

  // Controlar intervalo de peticiones
  const now = Date.now();
  const timeElapsed = now - lastRequestTime;
  if (timeElapsed < minInterval) {
    const delay = minInterval - timeElapsed;
    await new Promise(r => setTimeout(r, delay));
  }

  lastRequestTime = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
    const resp = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'VentasRF-Delivery-Router/1.0'
      }
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    if (data && data.length > 0) {
      const res = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        display_name: data[0].display_name
      };
      geocodeCache[q] = res;
      return res;
    }
  } catch (err) {
    console.error('Error al geocodificar:', err);
  }
  return null;
}

// ── Generar Enlace Completo de Google Maps ───────────────────────────────────
function obtenerUrlGoogleMaps() {
  if (seleccionados.length === 0) return '';

  const waypoints = [];
  // Todos menos el último son paradas intermedias (waypoints)
  for (let i = 0; i < seleccionados.length - 1; i++) {
    const s = seleccionados[i];
    if (s.geocoded) {
      waypoints.push(`${s.lat},${s.lng}`);
    } else {
      waypoints.push(encodeURIComponent(s.direccion));
    }
  }

  const ultimo = seleccionados[seleccionados.length - 1];
  let destStr = ultimo.geocoded ? `${ultimo.lat},${ultimo.lng}` : encodeURIComponent(ultimo.direccion);

  // Dejar origin vacío para usar ubicación GPS actual en el celular del chofer
  let url = `https://www.google.com/maps/dir/?api=1&origin=&destination=${destStr}`;
  if (waypoints.length > 0) {
    url += `&waypoints=${waypoints.join('%7C')}`;
  }

  return url;
}

// ── Abrir Ruta en Google Maps ────────────────────────────────────────────────
function abrirRutaGoogleMaps() {
  const url = obtenerUrlGoogleMaps();
  if (url) {
    window.open(url, '_blank');
  }
}

// ── Enviar Ruta por WhatsApp al Repartidor ───────────────────────────────────
function despacharWhatsApp() {
  const dateInput = document.getElementById('filtro-fecha-reparto');
  const fechaStr = dateInput?.value ? fmtFecha(dateInput.value) : 'Todas las fechas';
  const mapsUrl = obtenerUrlGoogleMaps();

  let msg = `🛵 *HOJA DE RUTA - VENTASRF*\n`;
  msg += `📅 *Fecha:* ${fechaStr}\n\n`;

  seleccionados.forEach((s, idx) => {
    msg += `${idx + 1}️⃣ *Cliente:* ${s.nombre_cliente}\n`;
    msg += `   📍 *Dirección:* ${s.direccion}\n`;

    let telLink = '';
    if (s.telefono) {
      const cleanTel = s.telefono.replace(/\D/g, '');
      let waLink = `https://wa.me/${cleanTel}`;
      if (cleanTel.length === 10 && (cleanTel.startsWith('11') || cleanTel.startsWith('3') || cleanTel.startsWith('2'))) {
        waLink = `https://wa.me/549${cleanTel}`;
      }
      telLink = ` (WhatsApp: ${waLink})`;
    }

    msg += `   📞 *Teléfono:* ${s.telefono}${telLink}\n`;
    msg += `   📦 *Pedido:* ${s.productos}\n`;

    // Buscar datos adicionales en el cache original (ej. notas y horarios)
    const orig = pedidosCache.find(p => p.id === s.id);
    if (orig) {
      if (orig.horario_entrega) {
        msg += `   ⏰ *Horario:* ${orig.horario_entrega}\n`;
      }
      if (orig.notas) {
        msg += `   📝 *Notas:* ${orig.notas}\n`;
      }
    }
    msg += `   [ ] Completado\n\n`;
  });

  msg += `🗺️ *Ruta Completa en Google Maps:*\n${mapsUrl}`;

  // Preguntar por el teléfono del repartidor (opcional)
  const telRepartidor = prompt('Ingrese el teléfono del repartidor (con código de país, ej: 5493416123456) o deje vacío para elegir contacto en WhatsApp:');
  
  let linkWhatsApp = '';
  if (telRepartidor && telRepartidor.trim()) {
    const cleanTel = telRepartidor.replace(/\D/g, '');
    linkWhatsApp = `https://wa.me/${cleanTel}?text=${encodeURIComponent(msg)}`;
  } else {
    // Si deja vacío, se abre API de envío sin número y WhatsApp preguntará a quién enviarlo
    linkWhatsApp = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  }

  window.open(linkWhatsApp, '_blank');
}

// ── Toasts de Notificación ───────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = 'toast';

  if (type === 'success') {
    toast.classList.add('toast-success');
    toast.style.background = '';
    toast.style.color = '';
  } else if (type === 'error') {
    toast.classList.add('toast-error');
    toast.style.background = '';
    toast.style.color = '';
  } else if (type === 'warning') {
    toast.style.background = 'var(--amber)';
    toast.style.color = '#fff';
  } else {
    // info
    toast.style.background = 'var(--primary-dark)';
    toast.style.color = '#fff';
  }

  toast.classList.remove('hidden');

  if (toast.timeoutId) {
    clearTimeout(toast.timeoutId);
  }

  toast.timeoutId = setTimeout(() => {
    toast.classList.add('hidden');
  }, duration);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtFecha(str) {
  if (!str) return '—';
  const parts = str.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return str;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
