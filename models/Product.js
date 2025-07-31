const mongoose = require('mongoose');
const ProductSchema = new mongoose.Schema({
    title: String,
    store: String,
    price: Number,
    deposit: Number,
    category: String,
    negotiable: Boolean,
    description: String,
    sizes: [String],
    image: String,
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});
module.exports = mongoose.model('Product', ProductSchema);