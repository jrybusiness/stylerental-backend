const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const jwt = require('jsonwebtoken');
const SECRET = 'stylerental-secret';

// 傳送訊息（需登入）
router.post('/', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: '未登入' });
    try {
        const decoded = jwt.verify(token, SECRET);
        const { to, product, content } = req.body;
        const msg = await Message.create({
            from: decoded.id,
            to,
            product,
            content
        });
        res.json(msg);
    } catch (e) {
        res.status(401).json({ error: 'token 無效' });
    }
});

// 取得與自己相關訊息（需登入）
router.get('/my', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: '未登入' });
    try {
        const decoded = jwt.verify(token, SECRET);
        const messages = await Message.find({
            $or: [{ from: decoded.id }, { to: decoded.id }]
        }).populate('from', 'username role').populate('to', 'username role').populate('product', 'title');
        res.json(messages);
    } catch (e) {
        res.status(401).json({ error: 'token 無效' });
    }
});

module.exports = router;