// Global variables
let socket;
let temperatureChart;
let humidityChart;
let temperatureData = [];
let humidityData = [];
let isConnected = false;

// Initialize dashboard when DOM is loaded
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
    document.getElementById('startDate').value = today;
    document.getElementById('endDate').value = today;
});

// ================ SOCKET.IO CONNECTION ================
function initializeSocket() {
    socket = io();
    
    socket.on('connect', function() {
        isConnected = true;
        updateConnectionStatus(true);
        console.log('✅ Conectado al servidor WebSocket');
        showNotification('Conectado al servidor', 'success');
    });

    socket.on('disconnect', function() {
        isConnected = false;
        updateConnectionStatus(false);
        console.log('❌ Desconectado del servidor WebSocket');
        showNotification('Desconectado del servidor', 'error');
    });

    socket.on('sensorData', function(data) {
        updateSensorData(data);
    });

    socket.on('ledUpdate', function(data) {
        updateLedStatus(data.ledId, data.status);
        showNotification(`LED ${data.ledId} ${data.status === 'ON' ? 'encendido' : 'apagado'}`, 'success');
    });

    socket.on('welcome', function(data) {
        console.log('👋 Mensaje de bienvenida:', data.message);
    });

    socket.on('error', function(error) {
        console.error('❌ Error de WebSocket:', error);
        showNotification('Error: ' + error.message, 'error');
    });
}

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('connectionIndicator');
    const text = document.getElementById('connectionText');
    
    if (connected) {
        indicator.classList.remove('disconnected');
        text.textContent = 'Conectado';
    } else {
        indicator.classList.add('disconnected');
        text.textContent = 'Desconectado';
    }
}

// ================ NAVIGATION ================
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
            document.getElementById(targetView).classList.add('active');
            
            // Load data for specific views
            if (targetView === 'history') {
                loadHistoryData();
            } else if (targetView === 'about') {
                loadSystemStatus();
            }
        });
    });
}

// ================ LED CONTROL ================
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

function toggleLED(ledId, status) {
    if (!isConnected) {
        showNotification('No hay conexión con el servidor', 'error');
        return;
    }

    // Emit via WebSocket
    socket.emit('ledControl', {
        ledId: ledId,
        status: status
    });

    // Also make HTTP request as backup
    fetch(`/api/v1/leds/${ledId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: status })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateLedStatus(ledId, status);
        } else {
            showNotification('Error: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('❌ Error controlando LED:', error);
        showNotification('Error de conexión', 'error');
    });
}

function updateLedStatus(ledId, status) {
    const toggle = document.querySelector(`[data-led="${ledId}"].led-toggle`);
    const card = document.querySelector(`[data-led="${ledId}"].led-card`);
    const icon = card.querySelector('.led-icon');
    
    if (status === 'ON') {
        toggle.classList.add('on');
        icon.classList.remove('off');
        icon.classList.add('on');
    } else {
        toggle.classList.remove('on');
        icon.classList.remove('on');
        icon.classList.add('off');
    }
}

// ================ CHARTS ================
function initializeCharts() {
    const chartConfig = {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { 
                        color: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(255, 255, 255, 0.2)'
                    },
                    ticks: { 
                        color: '#cccccc',
                        font: {
                            size: 11
                        }
                    }
                },
                x: {
                    grid: { 
                        color: 'rgba(255, 255, 255, 0.05)',
                        borderColor: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: { 
                        color: '#cccccc',
                        font: {
                            size: 11
                        }
                    }
                }
            },
            plugins: {
                legend: { 
                    display: false 
                }
            },
            elements: {
                line: { 
                    tension: 0.4,
                    borderWidth: 2
                },
                point: {
                    radius: 3,
                    hoverRadius: 6,
                    borderWidth: 2
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    };

    // Temperature Chart
    temperatureChart = new Chart(document.getElementById('temperatureChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                label: 'Temperatura (°C)',
                data: [],
                borderColor: '#ff4444',
                backgroundColor: 'rgba(255, 68, 68, 0.1)',
                fill: true,
                pointBackgroundColor: '#ff4444',
                pointBorderColor: '#ffffff'
            }]
        }
    });

    // Humidity Chart
    humidityChart = new Chart(document.getElementById('humidityChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                label: 'Humedad (%)',
                data: [],
                borderColor: '#00d4ff',
                backgroundColor: 'rgba(0, 212, 255, 0.1)',
                fill: true,
                pointBackgroundColor: '#00d4ff',
                pointBorderColor: '#ffffff'
            }]
        }
    });
}

// ================ SENSOR DATA ================
function updateSensorData(data) {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    if (data.topic === 'esp32/temperatura') {
        const temperature = parseFloat(data.value);
        document.getElementById('temperatureValue').textContent = `${temperature.toFixed(1)}°C`;
        
        temperatureData.push({
            time: timeLabel,
            value: temperature
        });
        
        // Keep only last 20 readings
        if (temperatureData.length > 20) {
            temperatureData.shift();
        }
        
        updateChart(temperatureChart, temperatureData);
        
    } else if (data.topic === 'esp32/humedad') {
        const humidity = parseFloat(data.value);
        document.getElementById('humidityValue').textContent = `${humidity.toFixed(1)}%`;
        
        humidityData.push({
            time: timeLabel,
            value: humidity
        });
        
        // Keep only last 20 readings
        if (humidityData.length > 20) {
            humidityData.shift();
        }
        
        updateChart(humidityChart, humidityData);
    }
}

function updateChart(chart, data) {
    chart.data.labels = data.map(d => d.time);
    chart.data.datasets[0].data = data.map(d => d.value);
    chart.update('none');
}

// ================ LOAD INITIAL DATA ================
function loadInitialData() {
    // Load LED states
    fetch('/api/v1/leds')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                data.data.forEach(led => {
                    updateLedStatus(led.ledId, led.status);
                });
            }
        })
        .catch(error => {
            console.error('❌ Error loading LED states:', error);
            showNotification('Error cargando estados de LEDs', 'error');
        });

    // Load latest sensor data
    fetch('/api/v1/sensors/latest')
        .then(response => response.json())
        .then(data => {
            if (data.sucess && data.data) {
                document.getElementById('temperatureValue').textContent = `${data.data.temperature.toFixed(1)}°C`;
                document.getElementById('humidityValue').textContent = `${data.data.humidity.toFixed(1)}%`;
            }
        })
        .catch(error => {
            console.error('❌ Error loading sensor data:', error);
        });

    // Setup LED controls after loading states
    setTimeout(setupLEDControls, 500);
}

// ================ HISTORY FUNCTIONS ================
function loadHistoryData() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const limit = document.getElementById('limitSelect').value;
    
    const tableBody = document.getElementById('historyTableBody');
    tableBody.innerHTML = '<tr><td colspan="4" class="loading"><div class="spinner"></div></td></tr>';
    
    let url = `/api/v1/sensors?limit=${limit}`;
    if (startDate && endDate && startDate === endDate) {
        url = `/api/v1/sensors/date/${startDate}`;
    }
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.sucess && data.data) {
                displayHistoryData(data.data);
            } else {
                tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">No hay datos disponibles</td></tr>';
            }
        })
        .catch(error => {
            console.error('❌ Error loading history:', error);
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #ff4444;">Error cargando datos</td></tr>';
            showNotification('Error cargando historial', 'error');
        });
}

function displayHistoryData(data) {
    const tableBody = document.getElementById('historyTableBody');
    
    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">No hay datos para el período seleccionado</td></tr>';
        return;
    }
    
    tableBody.innerHTML = data.map(item => `
        <tr>
            <td>${new Date(item.createdAt || item.timestamp).toLocaleString('es-ES')}</td>
            <td>${item.temperature.toFixed(1)}°C</td>
            <td>${item.humidity.toFixed(1)}%</td>
            <td>${item.device}</td>
        </tr>
    `).join('');
}

function exportData() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    let url = '/api/v1/sensors?limit=1000';
    if (startDate && endDate && startDate === endDate) {
        url = `/api/v1/sensors/date/${startDate}`;
    }
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.sucess && data.data) {
                downloadCSV(data.data);
                showNotification('Datos exportados correctamente', 'success');
            } else {
                showNotification('No hay datos para exportar', 'error');
            }
        })
        .catch(error => {
            console.error('❌ Error exporting data:', error);
            showNotification('Error exportando datos', 'error');
        });
}

function downloadCSV(data) {
    const csv = [
        ['Fecha/Hora', 'Temperatura', 'Humedad', 'Dispositivo'],
        ...data.map(item => [
            new Date(item.createdAt || item.timestamp).toLocaleString('es-ES'),
            item.temperature.toFixed(1),
            item.humidity.toFixed(1),
            item.device
        ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `sensor_data_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ================ SYSTEM STATUS ================
function loadSystemStatus() {
    fetch('/api/v1/status')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateSystemStatusDisplay(data);
            }
        })
        .catch(error => {
            console.error('❌ Error loading system status:', error);
            showNotification('Error cargando estado del sistema', 'error');
        });
}

function updateSystemStatusDisplay(data) {
    // System status
    document.getElementById('systemStatus').textContent = data.status || 'Desconocido';
    document.getElementById('systemUptime').textContent = 'Activo';
    document.getElementById('lastUpdate').textContent = new Date(data.timestamp).toLocaleString('es-ES');
    
    // MQTT status
    document.getElementById('mqttStatus').textContent = data.mqtt.connected ? 'Conectado' : 'Desconectado';
    document.getElementById('mqttStatus').style.color = data.mqtt.connected ? '#00ff88' : '#ff4444';
    document.getElementById('mqttBroker').textContent = data.mqtt.broker || '--';
    
    // WebSocket status
    document.getElementById('wsClients').textContent = data.websocket.connectedClients || 0;
    document.getElementById('wsStatus').textContent = isConnected ? 'Conectado' : 'Desconectado';
    document.getElementById('wsStatus').style.color = isConnected ? '#00ff88' : '#ff4444';
}

// ================ UTILITY FUNCTIONS ================
function updateSystemTime() {
    const now = new Date();
    const timeString = now.toLocaleString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const timeElement = document.getElementById('systemTime');
    if (timeElement) {
        timeElement.textContent = timeString;
    }
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                container.removeChild(notification);
            }, 300);
        }
    }, 5000);
    
    // Add click to dismiss
    notification.addEventListener('click', () => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                container.removeChild(notification);
            }, 300);
        }
    });
}

// ================ ERROR HANDLING ================
window.addEventListener('error', function(e) {
    console.error('❌ Error global:', e.error);
    showNotification('Ha ocurrido un error inesperado', 'error');
});

// Handle connection errors
window.addEventListener('online', function() {
    showNotification('Conexión restaurada', 'success');
});

window.addEventListener('offline', function() {
    showNotification('Sin conexión a internet', 'error');
});

// ================ ANIMATIONS FOR SLIDEOUT ================
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);