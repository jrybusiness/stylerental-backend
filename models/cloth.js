const mongoose = require('mongoose');
const ClothSchema = new mongoose.Schema({
  name: String,
  price: Number,
  size: String,
  occasion: String,
  gender: String,
  shop: String,         // 新增
  phone: String,        // 新增
  address: String,      // 新增
  description: String,
  images: [String],
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});
module.exports = mongoose.model('Cloth', ClothSchema);