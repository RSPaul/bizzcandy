const mongoose = require("mongoose");
const { Schema } = mongoose;
const OrderItemsSchema = require('./order_items');

const invoiceSchema = new Schema({
	warehouse: { type: String},
  	orderNo: {type: String, required: true},
  	invoiceNo: {type: String, required: true},
	user: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	items: [OrderItemsSchema],   
	paid: {type: Boolean, default: false},
	date: {type: Date, default: Date.now}
});

var Invoice = module.exports = mongoose.model('Invoice', invoiceSchema);
