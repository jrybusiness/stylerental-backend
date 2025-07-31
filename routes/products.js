const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Product = require('../models/Product');
const jwt = require('jsonwebtoken');

const SECRET = 'stylerental-secret';

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 取得全部商品
router.get('/', async (req, res) => {
    const products = await Product.find().populate('seller', 'username');
    res.json(products);
});

// 上傳商品（需登入）
router.post('/', upload.single('image'), async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: '未登入' });
    try {
        const decoded = jwt.verify(token, SECRET);
        const { title, price, deposit, category, negotiable, description, sizes } = req.body;
        const image = req.file ? `/uploads/${req.file.filename}` : null;
        const product = await Product.create({
            title,
            store: decoded.username,
            price,
            deposit,
            category,
            negotiable,
            description,
            sizes: Array.isArray(sizes) ? sizes : [sizes],
            image,
            seller: decoded.id
        });
        res.json(product);
    } catch (e) {
        res.status(401).json({ error: 'token 無效' });
    }
});

// 取得單一商品
router.get('/:id', async (req, res) => {
    const product = await Product.findById(req.params.id).populate('seller', 'username');
    res.json(product);
});

module.exports = router;