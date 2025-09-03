const {Server} = require('socket.io');

let io = null;

//Inicializa websocket server
const intitWebSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });
  setupSocketEvents();
  return io;
}

const setupSocketEvents = () => {
    io.on('connection', (socket) => {
        console.log('👤 Cliente conectado:', socket.id);

        //Enviar estado actual del cliente
        socket.emit('welcome', {
            message: 'Conectado al dashboard ESP32',
            timestamp: new Date()
        });

        socket.on('disconnect', () => {
            console.log('👤 Cliente desconectado:', socket.id);
        });

        // Maneja las solicitudes de control desde el frontend
        socket.on('ledControl', (data) => {
            console.log(`🔦 Control LED recibido:`, data);
            // Este evento será manejado por el servidor principal
            socket.broadcast.emit('ledCommand', data);
        });
    });
}

//Se encarga de emitir a todos los clientes conectados
const emitToAll = (event, data) => {
    if(io){
        io.emit(event, data)
    }
};

// Obtiene el numero de clientes conectados
const getConnectedClientsCount = () => {
    return io ? io.engine.clientsCount : 0;
};

const getIO = () => {
    return io
};

module.exports = {
    intitWebSocket,
    emitToAll,
    getConnectedClientsCount,
    getIO
}