const { Schema, model } = require('mongoose');
const collectionName = 'sensor_dht11';
const { v4: uuidv4 } = require('uuid');

const schema = new Schema({
    _id: { type: uuidv4(), required: true },
    temperature: { type: Number, required: true },
    humidity:  { type: Number, required: true },
    device: { type: String, default: 'ESP32' },
}, {
    timestamps: true
});

// Índice para búsquedas por fecha
schema.index({ timestamp: -1 });


module.exports = model(collectionName, schema);