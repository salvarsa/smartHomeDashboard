const express = require('express')
const {
    getAllSensorData,
    getLatestData,
    getSensorDataByDate,
    getDailyStats,
    createSensorData,
    deleteOldData
} = require('../controllers/sensorDht11.js');

const router = express.Router()

router.get('/', getAllSensorData)
router.get('/latest', getLatestData)
router.get('/date/:date', getSensorDataByDate)
router.get('/stats/:date', getDailyStats)
router.post('/', createSensorData)
router.delete('/cleanup', deleteOldData)

module.exports = router