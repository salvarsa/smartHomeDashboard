const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configuración de Express
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor'
  });
});

const PORT = process.env.PORT || 1716

server.listen(PORT, () => {
  console.log(`🚀 Server runing at: ${PORT}`);
  console.log(`🌐 Dashboard for smartHome: http://localhost:${PORT}`);
});