const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = 'stylerental-secret';

// 註冊
router.post('/register', async (req, res) => {
    const { username, password, role } = req.body;

    // 檢查必要欄位
    if (!username || !password || !role) {
        return res.status(400).json({ error: '缺少必要欄位' });
    }
    // 檢查 role 是否合法
    if (!['buyer', 'seller'].includes(role)) {
        return res.status(400).json({ error: '角色必須是 buyer 或 seller' });
    }

    try {
        // 檢查用戶名是否已存在
        const existUser = await User.findOne({ username });
        if (existUser) {
            return res.status(400).json({ error: '用戶名已存在' });
        }
        const hash = await bcrypt.hash(password, 10);
        await User.create({ username, password: hash, role });
        res.json({ success: true });
    } catch (e) {
        // 其他錯誤（如資料庫異常）
        res.status(500).json({ error: '伺服器錯誤', detail: e.message });
    }
});

// 登入
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: '用戶不存在' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: '密碼錯誤' });
    const token = jwt.sign({ id: user._id, role: user.role, username: user.username }, SECRET);
    res.json({ token, role: user.role, username: user.username, userId: user._id });
});

module.exports = router;