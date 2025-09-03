const mqtt = require('mqtt');
const SensorDHT11 = require('../models/SensorDht11.js')

const MQTT_BROKER = 'mqtt://10.2.20.113:1883';
//const MQTT_BROKER = 'mqtt://192.168.1.52:1883';

let mqttClient = null;
let socketIO = null;
let lastTemperature = undefined;
let lastHumidity = undefined;

// Inicia la comunincacion con el broker configurado en MQTT_BROKER
const initMqtt = (io) => {
    socketIO = io
    mqttClient = mqtt.connect(MQTT_BROKER)

    mqttClient.on('connect', () => {
        console.log('✅ Conectado al broker MQTT 🦟')

        //Subscripcion de topicos de sensor DHT11
        mqttClient.subscribe('esp32/temperatura')
        mqttClient.subscribe('esp32/humedad')

        // subscripción de los leds
        mqttClient.subscribe('esp32/led1')
        mqttClient.subscribe('esp32/led2')
        mqttClient.subscribe('esp32/led3')
    });
        
    mqttClient.on('error', (error) => {
        console.error('❌ Error MQTT:', error)
    });

    mqttClient.on('message', (topic, message) => {
        handleMQTTMessage(topic, message.toString())
    });
}

const handleMQTTMessage = async (topic, message) => {
    console.log(`📨 Mensaje recibido [${topic}]: ${message}`)

    try {
        if (topic === 'esp32/temperatura') {
            // Almacenar temporalmente la temperatura
            lastTemperature = parseFloat(message)
            await checkAndSaveSensorDhtData()
        } else if (topic === 'esp32/humedad') {
            // Almacenar temporalmente la humedad
            lastHumidity = parseFloat(message)
            await checkAndSaveSensorDhtData()
        }

        // Emite datos de los sensores a tiempo real por websocket
        if(socketIO) {
            socketIO.emit('sensorData', {
            topic: topic,
            value: message,
            timestamp: new Date
        })
        }

    } catch (error) {
        console.error('Error procesando mensaje MQTT:', error);
    }
}

// Verifica y guarda los datos del sensor DHT11 en base de datos
const checkAndSaveSensorDhtData = async () => {
    if (lastTemperature !== undefined && lastHumidity !== undefined){
        try {
            const sensorDhtData = new SensorDHT11({
                temperature: lastTemperature,
                humidity: lastHumidity
            });

            await sensorDhtData.save();
            console.log('💾 Datos del sensor guardados en BD')

            // Limpiar valores temporales
            lastTemperature = undefined;
            lastHumidity = undefined;

        } catch (error) {
            console.error('Error guardando datos del sensor:', error)
        }
    }
}

const publishLedCommand = async (ledId, state) => {
    if (!mqttClient || !mqttClient.connect){
        console.error('Cliente MQTT no conectado');
        return false;
    }

    const topic = `esp32/${ledId}`;
    mqttClient.publish(topic, state);
    console.log(`🔦 Comando LED enviado [${topic}]: ${state}`);
    return true
}

// Verica el estado de conexion
const isMQTTConnected = () => {
    return mqttClient && mqttClient.connected;
}

// Obtener cliente MQTT
const getMQTTClient = () => {
    return mqttClient
}

module.exports = {
    initMqtt,
    publishLedCommand,
    isMQTTConnected,
    getMQTTClient
}



