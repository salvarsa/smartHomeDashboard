const express = require('express')
const {
    getAllLeds,
    getLedById,
    controlLed,
    toggleLed,
    initializeLeds
} = require('../controllers/led.js')

const router = express.Router()

router.get('/', getAllLeds)
router.get('/:ledId', getLedById)
router.put('/:ledId', controlLed)
router.post('/:ledId/toggle', toggleLed)

module.exports = router
