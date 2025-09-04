const { Schema, model } = require('mongoose');
const collectionName = 'led';
const { v4: uuidv4 } = require('uuid');

const schema = new Schema({
    _id: { type: String, default: uuidv4 },
    ledId: { type: String, enum: ['led1', 'led2', 'led3']},
    status: { type: String, required: true, enum: ['ON', 'OFF'], default: 'OFF'},
    lastChange: { type: Date, default: Date.now },
}, {
    timestamps: true
});


module.exports = model(collectionName, schema);