const SensorDHT11 = require('../models/SensorDht11.js');

const getAllSensorData = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;

        const sensor = await SensorDHT11.find()
            .sort({ timestamp: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await SensorDHT11.countDocuments();

        res.status(200).json({
            sucess: true,
            data: sensor,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        })
    } catch (error) {
        res.status(500).json({
        success: false,
        message: 'Error obteniendo datos de sensores',
        error: error.message
    });
  }
}

// Esta función es para obtener la data mas reciente
const getLatestData = async (req, res) => {
    try {
        const latestData = await SensorDHT11.findOne().sort({ timestamp: -1 })

        if(!latestData){
            return res.status(404).json({ sucess: false, message: 'No hay datos de sensores disponibles'})
        }

        res.status(200).json({ sucess: true, data: latestData})
    } catch (error) {
        res.status(500).json({
        success: false,
        message: 'Error obteniendo datos recientes',
        error: error.message
    });
  }
}

// funcion para obtener los datos por fecha especifica
const getSensorDataByDate = async (req, res) => {
    try {
        const {date} = req.params
        const startDate = new Date(date)
        const endDate = new Date(date)
        endDate.setDate(endDate.getDate() + 1)

        const sensor = await SensorDHT11.find({
            timestamp: {
                $gte: startDate,
                $lt: endDate
            }
        }).sort({ timestamp: 1 })

        res.status(200).json({
            success: true,
            data: sensor,
            date: date,
            count: sensor.length
        })
    } catch (error) {
        res.status(500).json({
        success: false,
        message: 'Error obteniendo datos por fecha',
        error: error.message
      });
    }
}

const getDailyStats = async (req, res) => {
    try {
        const {date} = req.params
        const startDate = new Date(date)
        const endDate = new Date(date)
        endDate.setDate(endDate.getDate() + 1)

        const stats = await SensorDHT11.aggregate([
            {
                $match: {
                    timestamp: {
                        $gte: startDate,
                        $lt: endDate
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgTemp: { $avg: '$temperatura' },
                    maxTemp: { $max: '$temperatura' },
                    minTemp: { $min: '$temperatura' },
                    avgHum: { $avg: '$humedad' },
                    maxHum: { $max: '$humedad' },
                    minHum: { $min: '$humedad' },
                    count: { $sum: 1 }
                }
            }
        ])

        res.status(200).json({
            success: true,
            data: stats[0] || null,
            date: date
        })
    } catch (error) {
        res.status(500).json({
        success: false,
        message: 'Error obteniendo estadísticas',
        error: error.message
      });
    }
}

const createSensorData = async (req, res) => {
    try {
        const {temperatura, humedad} = req.body

        const sensorData = new SensorDHT11({ temperatura, humedad }) 
        await SensorDHT11.save()

        res.status(201).json({
            success: true,
            data: sensorData,
            message: 'Datos de sensor creados exitosamente'
        })
    } catch (error) {
        res.status(400).json({
        success: false,
        message: 'Error creando datos de sensor',
        error: error.message
      });
    }
}

const deleteOldData = async (req, res) => {
    try {
        const { days = 30 } = req.query

        const cutOffDate = new Date()
        cutOffDate.setDate(cutOffDate.getDate() - days)

        const result = await SensorDHT11.deleteMany({ timestamp: { $lt: cutOffDate} })

        res.staus(200).json({
            success: true,
            message: `Eliminados ${result.deletedCount} registros anteriores a ${days} días`,
            deletedCount: result.deletedCount
        })
    } catch (error) {
        res.status(500).json({
        success: false,
        message: 'Error eliminando datos antiguos',
        error: error.message
      });
    }
}

module.exports = {
    getAllSensorData,
    getLatestData,
    getSensorDataByDate,
    getDailyStats,
    createSensorData,
    deleteOldData
}