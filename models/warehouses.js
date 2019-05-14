var mongoose = require('mongoose');

// Warehouse schema
var WarehouseSchema = mongoose.Schema({

    name: {
        type: String,
        require: true
    },
    slug: {
        type: String
    }
});

var Warehouse = module.exports = mongoose.model('Warehouse', WarehouseSchema);