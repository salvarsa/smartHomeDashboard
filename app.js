const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db.js');
const { initializeLeds } = require('./controllers/led.js');
const sensorRoutes = require('./routes/sensorDht11.js');
const ledRoutes = require('./routes/led.js');
const { initMqtt, publishLedCommand, isMQTTConnected, getMQTTClient } = require('./config/mqtt.js');
const { intitWebSocket, emitToAll, getConnectedClientsCount, getIO} = require('./config/websocket.js');

const app = express();
const server = http.createServer(app)

// Configuración de Express
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// conexion a base de datos MONGODB
connectDB()

// Inicializar webSocket
const io = intitWebSocket(server)

// Inicializa cliente MQTT, esta debe ser despues de que se establezca conexion con webSocket
initMqtt(io)

app.use('/api/v1/sensors', sensorRoutes)
app.use('/api/v1/leds', ledRoutes)

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// Ruta de estado del sistema
app.get('/api/v1/status', (req, res) => {
  res.json({
    success: true,
    status: 'Operative System',
    mqtt: {
      connected: isMQTTConnected(),
      broker: '10.2.20.113:1883',
      //broker: '192.168.1.52:1883'
    },
    websocket: {
      connectedClients: getConnectedClientsCount()
    },
    timestamp: new Date()
  })
})

// Maneja eventos de websocket para control de leds
io.on('connection', (socket) => {
  socket.on('ledControl', async (data) => {
    try {
      const { ledId, status } = data

      // Importar dinámicamente el controlador para evitar dependencias circulares
      const { controlLed } = require('./controllers/led.js')

      // Crear objetos mock para req y res
      const mockReq = {
        params: { ledId },
        body: { status },
      }

      const mockRes = {
        json: (response) => {
          io.emit('ledUpdate', {
            ledId,
            status,
            success: true,
            timestamp: new Date
          })
        },
        status: () => mockRes
      }

      await controlLed(mockReq, mockRes)
    } catch (error) {
      console.error('Error en control de LED vía WebSocket:', error);
      socket.emit('error', {
        message: 'Error controlando LED',
        error: error.message
      });
    }
  })
})

// Darle un pequeño delay al encendido de los leds
setTimeout(() => {
  initializeLeds()
}, 200)

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

const PORT = process.env.PORT || 1716

server.listen(PORT, () => {
  //connectDB()
  console.log(`🚀 Server runing at: ${PORT}`);
  console.log(`🌐 Dashboard for smartHome: http://localhost:${PORT}`);
});