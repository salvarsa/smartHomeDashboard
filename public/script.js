// Global variables
let socket;
let temperatureChart;
let humidityChart;
let temperatureData = [];
let humidityData = [];
let isConnected = false;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeSocket();
    initializeNavigation();
    initializeCharts();
    updateSystemTime();
    loadInitialData();

    // Update time every second
    setInterval(updateSystemTime, 1000);

    // Set default date for history filters
    const today = new Date().toISOString().split('T')[0];
    const startEl = document.getElementById('startDate');
    const endEl = document.getElementById('endDate');
    if (startEl) startEl.value = today;
    if (endEl) endEl.value = today;
});

// -------------------- SOCKET.IO --------------------
function initializeSocket() {
    if (typeof io === 'undefined') {
        console.warn('Socket.IO client no cargado.');
        showNotification('Socket.IO client no cargado.', 'error');
        return;
    }

    socket = io();

    socket.on('connect', function() {
        isConnected = true;
        updateConnectionStatus(true);
        console.log('Conectado al servidor WebSocket');
    });

    socket.on('disconnect', function() {
        isConnected = false;
        updateConnectionStatus(false);
        console.log('Desconectado del servidor WebSocket');
    });

    socket.on('sensorData', function(data) {
        updateSensorData(data);
    });

    socket.on('ledUpdate', function(data) {
        const id = data.ledId || data.id || data.led;
        const status = data.status || data.state;
        if (id && typeof status !== 'undefined') updateLedStatus(id, status);
    });

    socket.on('welcome', function(data) {
        console.log('Mensaje de bienvenida:', data?.message || data);
    });

    socket.on('error', function(error) {
        console.error('Error de WebSocket:', error);
        showNotification('Error WebSocket: ' + (error?.message || error), 'error');
    });
}

// -------------------- UI HELPERS --------------------
function updateConnectionStatus(connected) {
    const indicator = document.getElementById('connectionIndicator');
    const text = document.getElementById('connectionText');
    if (!indicator || !text) return;
    if (connected) {
        indicator.classList.remove('disconnected');
        text.textContent = 'Conectado';
    } else {
        indicator.classList.add('disconnected');
        text.textContent = 'Desconectado';
    }
}

function showNotification(message, type = 'success') {
    try {
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        const div = document.createElement('div');
        div.className = `notification ${type === 'error' ? 'error' : 'success'}`;
        div.textContent = message;
        document.body.appendChild(div);

        setTimeout(() => {
            if (div && div.parentNode) div.remove();
        }, 4500);
    } catch (e) {
        console.warn('showNotification error', e);
    }
}

// -------------------- NAVIGATION --------------------
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');

    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const targetView = this.getAttribute('data-view');

            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');

            // Show target view
            views.forEach(view => view.classList.remove('active'));
            const target = document.getElementById(targetView);
            if (target) target.classList.add('active');

            // Load data for specific views
            if (targetView === 'history') {
                loadHistoryData();
            } else if (targetView === 'about') {
                loadSystemStatus();
            }
        });
    });
}

// -------------------- LED CONTROL --------------------
function setupLEDControls() {
    const ledToggles = document.querySelectorAll('.led-toggle');

    ledToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const ledId = this.getAttribute('data-led');
            const isOn = this.classList.contains('on');
            const newStatus = isOn ? 'OFF' : 'ON';
            toggleLED(ledId, newStatus);
        });
    });
}

async function toggleLED(ledId, status) {
    if (!ledId) {
        showNotification('LED indefinido', 'error');
        return;
    }

    if (!isConnected) {
        // aviso pero igual intentamos petición HTTP (backup)
        showNotification('No hay conexión WebSocket — intentando HTTP...', 'error');
    } else {
        // Emit via WebSocket
        try {
            socket.emit('ledControl', { ledId, status });
        } catch (e) {
            console.warn('Error emitiendo por socket', e);
        }
    }

    // HTTP backup (intento)
    try {
        const res = await fetch(`/api/v1/leds/${encodeURIComponent(ledId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        const data = await res.json();
        const ok = data?.success || data?.sucess || data?.ok;
        if (ok) {
            updateLedStatus(ledId, status);
            showNotification(data.message || 'LED actualizado', 'success');
        } else {
            // si backend devolvió error, mostrarlos
            updateLedStatus(ledId, status); // opción: asumir estado optimista
            showNotification(data.message || 'Error actualizando LED (HTTP)', 'error');
        }
    } catch (error) {
        console.error('Error controlando LED:', error);
        showNotification('Error de conexión al intentar controlar LED', 'error');
    }
}

function updateLedStatus(ledId, status) {
    if (!ledId) return;
    const toggle = document.querySelector(`.led-toggle[data-led="${ledId}"]`);
    if (!toggle) {
        console.warn('Toggle no encontrado para', ledId);
        return;
    }
    const card = toggle.closest('.led-card');
    const icon = card ? card.querySelector('.led-icon') : null;

    const on = status === 'ON' || status === 'on' || status === true || status === 'true';

    if (on) {
        toggle.classList.add('on');
        toggle.setAttribute('aria-pressed', 'true');
        if (icon) {
            icon.classList.remove('off');
            icon.classList.add('on');
        }
    } else {
        toggle.classList.remove('on');
        toggle.setAttribute('aria-pressed', 'false');
        if (icon) {
            icon.classList.remove('on');
            icon.classList.add('off');
        }
    }
}

// -------------------- CHARTS --------------------
function initializeCharts() {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js no cargado.');
        return;
    }

    const baseOptions = {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: false, grid: { color: '#475569' }, ticks: { color: '#cbd5e1' } },
                x: { grid: { color: '#475569' }, ticks: { color: '#cbd5e1' } }
            },
            plugins: { legend: { display: false } },
            elements: { line: { tension: 0.4 } }
        }
    };

    const tCanvas = document.getElementById('temperatureChart');
    if (tCanvas) {
        temperatureChart = new Chart(tCanvas.getContext('2d'), {
            ...baseOptions,
            data: {
                labels: [],
                datasets: [{
                    label: 'Temperatura',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true
                }]
            }
        });
    }

    const hCanvas = document.getElementById('humidityChart');
    if (hCanvas) {
        humidityChart = new Chart(hCanvas.getContext('2d'), {
            ...baseOptions,
            data: {
                labels: [],
                datasets: [{
                    label: 'Humedad',
                    data: [],
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    fill: true
                }]
            }
        });
    }
}

function updateChart(chart, data) {
    if (!chart || !Array.isArray(data)) return;
    chart.data.labels = data.map(d => d.time);
    chart.data.datasets[0].data = data.map(d => d.value);
    chart.update('none');
}

// -------------------- SENSOR DATA --------------------
function pushSeries(series, point, maxLen = 20) {
    series.push(point);
    if (series.length > maxLen) series.shift();
}

function updateSensorData(data) {
    // data puede llegar en varias formas: { topic, value } o { temperature, humidity }
    if (!data) return;
    const now = new Date();
    const timeLabel = now.toLocaleTimeString();

    // forma MQTT-like
    if (typeof data.topic === 'string' && typeof data.value !== 'undefined') {
        const topic = data.topic.toLowerCase();
        const val = Number(data.value);
        if (!Number.isNaN(val)) {
            if (topic.includes('temp')) {
                document.getElementById('temperatureValue')?.textContent = `${val.toFixed(1)}°C`;
                pushSeries(temperatureData, { time: timeLabel, value: val });
                updateChart(temperatureChart, temperatureData);
            } else if (topic.includes('hum') || topic.includes('humi')) {
                document.getElementById('humidityValue')?.textContent = `${val.toFixed(1)}%`;
                pushSeries(humidityData, { time: timeLabel, value: val });
                updateChart(humidityChart, humidityData);
            }
        }
        return;
    }

    // forma objeto combinado
    if (typeof data.temperature !== 'undefined') {
        const t = Number(data.temperature);
        if (!Number.isNaN(t)) {
            document.getElementById('temperatureValue')?.textContent = `${t.toFixed(1)}°C`;
            pushSeries(temperatureData, { time: timeLabel, value: t });
            updateChart(temperatureChart, temperatureData);
        }
    }
    if (typeof data.humidity !== 'undefined') {
        const h = Number(data.humidity);
        if (!Number.isNaN(h)) {
            document.getElementById('humidityValue')?.textContent = `${h.toFixed(1)}%`;
            pushSeries(humidityData, { time: timeLabel, value: h });
            updateChart(humidityChart, humidityData);
        }
    }
}

// -------------------- INITIAL DATA LOAD --------------------
async function loadInitialData() {
    // Load LED states
    try {
        const res = await fetch('/api/v1/leds');
        const json = await res.json();
        const arr = json?.data || (Array.isArray(json) ? json : null);
        if (Array.isArray(arr)) {
            arr.forEach(led => {
                const id = led.ledId || led.id || led.name;
                const status = led.status || led.state || (led.on ? 'ON' : (led.off ? 'OFF' : undefined));
                if (id && typeof status !== 'undefined') updateLedStatus(id, status);
            });
        }
    } catch (e) {
        console.warn('Error loading LED states:', e);
    }

    // Load latest sensor data
    try {
        const res = await fetch('/api/v1/sensors/latest');
        const json = await res.json();
        const payload = json?.data || json;
        if (payload) {
            if (typeof payload.temperature !== 'undefined') {
                const t = Number(payload.temperature);
                if (!Number.isNaN(t)) document.getElementById('temperatureValue')?.textContent = `${t.toFixed(1)}°C`;
            }
            if (typeof payload.humidity !== 'undefined') {
                const h = Number(payload.humidity);
                if (!Number.isNaN(h)) document.getElementById('humidityValue')?.textContent = `${h.toFixed(1)}%`;
            }
        }
    } catch (e) {
        console.warn('Error loading sensor data:', e);
    }

    // Setup controls
    setupLEDControls();
}

// -------------------- HISTORY / EXPORT --------------------
async function loadHistoryData() {
    const startDate = document.getElementById('startDate')?.value;
    const endDate = document.getElementById('endDate')?.value;
    const limit = document.getElementById('limitSelect')?.value || '50';

    const tableBody = document.getElementById('historyTableBody');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="4" class="loading"><div class="spinner"></div></td></tr>';

    let url = `/api/v1/sensors?limit=${encodeURIComponent(limit)}`;
    if (startDate && endDate) {
        url = `/api/v1/sensors?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}&limit=${encodeURIComponent(limit)}`;
    } else if (startDate) {
        url = `/api/v1/sensors?start=${encodeURIComponent(startDate)}&limit=${encodeURIComponent(limit)}`;
    }

    try {
        const res = await fetch(url);
        const json = await res.json();
        const data = json?.data || (Array.isArray(json) ? json : json?.records);
        if (Array.isArray(data)) {
            displayHistoryData(data);
        } else {
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="4">No hay datos disponibles</td></tr>';
        }
    } catch (error) {
        console.error('Error loading history:', error);
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="4">Error cargando datos</td></tr>';
    }
}

function displayHistoryData(data) {
    const tableBody = document.getElementById('historyTableBody');
    if (!tableBody) return;

    if (!Array.isArray(data) || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4">No hay datos para el período seleccionado</td></tr>';
        return;
    }

    tableBody.innerHTML = data.map(item => {
        const ts = item.timestamp || item.timestamps || item.createdAt || item.created_at || item.date;
        const dateStr = ts ? new Date(ts).toLocaleString() : '--';
        const temp = (typeof item.temperature !== 'undefined') ? Number(item.temperature).toFixed(1) + '°C' : '--';
        const hum = (typeof item.humidity !== 'undefined') ? Number(item.humidity).toFixed(1) + '%' : '--';
        const device = item.device || item.deviceId || item.node || '--';
        return `<tr>
            <td>${dateStr}</td>
            <td>${temp}</td>
            <td>${hum}</td>
            <td>${device}</td>
        </tr>`;
    }).join('');
}

async function exportData() {
    const startDate = document.getElementById('startDate')?.value;
    const endDate = document.getElementById('endDate')?.value;
    const limit = 1000;

    let url = `/api/v1/sensors?limit=${limit}`;
    if (startDate && endDate) {
        url = `/api/v1/sensors?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}&limit=${limit}`;
    } else if (startDate) {
        url = `/api/v1/sensors?start=${encodeURIComponent(startDate)}&limit=${limit}`;
    }

    try {
        const res = await fetch(url);
        const json = await res.json();
        const data = json?.data || (Array.isArray(json) ? json : json?.records);
        if (Array.isArray(data) && data.length > 0) {
            downloadCSV(data);
        } else {
            showNotification('No hay datos para exportar', 'error');
        }
    } catch (error) {
        console.error('Error exporting data:', error);
        showNotification('Error exportando datos', 'error');
    }
}

function downloadCSV(data) {
    if (!Array.isArray(data) || data.length === 0) {
        showNotification('No hay datos para exportar', 'error');
        return;
    }

    const headers = ['Fecha/Hora', 'Temperatura', 'Humedad', 'Dispositivo'];
    const rows = data.map(item => {
        const ts = item.timestamp || item.timestamps || item.createdAt || item.created_at || item.date || '';
        const dateStr = ts ? new Date(ts).toLocaleString() : '';
        const temp = (typeof item.temperature !== 'undefined') ? Number(item.temperature).toFixed(1) : '';
        const hum = (typeof item.humidity !== 'undefined') ? Number(item.humidity).toFixed(1) : '';
        const device = item.device || item.deviceId || item.node || '';
        // escape quotes
        return [dateStr, temp, hum, device].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sensors_export_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// -------------------- ABOUT / SYSTEM STATUS --------------------
async function loadSystemStatus() {
    const elSystemStatus = document.getElementById('systemStatus');
    const elUptime = document.getElementById('systemUptime');
    const elLastUpdate = document.getElementById('lastUpdate');
    const elMqttStatus = document.getElementById('mqttStatus');
    const elMqttBroker = document.getElementById('mqttBroker');
    const elWsClients = document.getElementById('wsClients');
    const elWsStatus = document.getElementById('wsStatus');

    if (elSystemStatus) elSystemStatus.textContent = isConnected ? 'OK' : 'Degradado';
    if (elWsStatus) elWsStatus.textContent = isConnected ? 'Conectado' : 'Desconectado';

    try {
        const res = await fetch('/api/v1/system');
        const json = await res.json();
        if (json) {
            if (elSystemStatus && json.status) elSystemStatus.textContent = json.status;
            if (elUptime && json.uptime) elUptime.textContent = json.uptime;
            if (elLastUpdate && json.lastUpdate) elLastUpdate.textContent = json.lastUpdate;
            if (elMqttStatus) elMqttStatus.textContent = json?.mqtt?.status || json.mqttStatus || '--';
            if (elMqttBroker) elMqttBroker.textContent = json?.mqtt?.broker || '--';
            if (elWsClients) elWsClients.textContent = json.wsClients || json.clients || '--';
        }
    } catch (e) {
        console.warn('No se pudo obtener estado del sistema:', e);
    }
}

// -------------------- UTIL --------------------
function updateSystemTime() {
    const el = document.getElementById('systemTime');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleString();
}
