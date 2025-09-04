const Led = require('../models/Led.js')
const { initMqtt, publishLedCommand, isMQTTConnected, getMQTTClient } = require('../config/mqtt.js');

const getAllLeds = async (req, res) => {
    try {
        const leds = await Led.find().sort({ ledId: 1 })

        res.status(200).json({ success: true, data: leds })
    } catch (error) {
        res.status(500).json({
        success: false,
        message: 'Error obteniendo estado de LEDs',
        error: error.message
    });
  }
}

const getLedById = async (req, res) => {
    try {
        const { ledId } = req.parms

        const led = await Led.findOne({ ledId })

        if (!led){
            return res.status(404).json({
            success: false,
            message: 'LED no encontrado'
          });
        }

        res.status(200).json({
            success: true,
            data: led
        })
    } catch (error) {
        res.status(500).json({
        success: false,
        message: 'Error obteniendo LED',
        error: error.message
    });
  }
}

const controlLed = async (req, res) => {
    try {
        const { ledId } = req.params
        const { status } = req.params

        if (!['ON', 'OFF'].includes(status)){
            return res.status(400).json({
              success: false,
              message: 'Estado debe ser ON o OFF'
            });
        }

        // actualiza / crea registros en bd
        const led = await Led.findByIdAndUpdate(
          {ledId},
          {
              status,
              lastChange: new Date()
          },
          {
              upsert: true,
              new: true
          }
        )

        // Publica comando MQTT
        if (isMQTTConnected()){
            publishLedCommand(ledId, status)
        }

        res.status(200).json({
            success: true,
            data: led,
            message: `LED ${ledId} ${estado === 'ON' ? 'encendido' : 'apagado'}`
        })
    } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Error controlando LED',
          error: error.message
      });
    }
}

const toggleLed = async (req, res) => {
    try {
        const { ledId } = req.params;
      
        let led = await Led.findOne({ ledId });

        // Si no existe, crear con estado OFF y luego encender
        if (!led) led = new Led({ ledId, status: 'OFF' })

        const newStatus = led.status === 'ON' ? 'OFF' : 'ON'

        led.status = newStatus
        led.lastChange = new Date()
        await led.save()

        // Publica comando MQTT
        if (isMQTTConnected()){
            publishLedCommand(ledId, status)
        }

        res.status(200).json({
            success: true,
            data: led,
            message: `LED ${ledId} ${newStatus === 'ON' ? 'encendido' : 'apagado'}`
        })
    } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Error alternando LED',
          error: error.message
        });
    }
}

const initializedLeds = async () => {
    try {
        const ledIds = ['led1', 'led2', 'led3']

        for (const ledId of ledIds){
            await Led.findOneAndUpdate(
                { ledId },
                {
                    ledId,
                    statutus: 'OFF',
                    lastChange: new Date()
                },
                { upsert: true }
            )
        }
        console.log('🔦 LEDs inicializados en la base de datos');
    } catch (error) {
        console.error('Error inicializando LEDs:', error);
    }
}

module.exports = {
    getAllLeds,
    getLedById,
    controlLed,
    toggleLed,
    initializedLeds
}