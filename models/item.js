const mongoose = require("mongoose");
const { Schema } = mongoose;

const itemSchema = new Schema({
  title: { type: String, required: false },
  qty: { type: Number, required: false },
  price: { type: Number, required: false },
  image: { type: String },
  vat: { type: Boolean, required: false, default: false },
  product_code: { type: String },
  warehouse: { type: String }
});

module.exports = itemSchema;
