// 套件安裝：npm install express mongoose cors multer bcryptjs jsonwebtoken express-validator
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const app = express();

app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const JWT_SECRET = 'your_secret_key_1234';
const MONGO_URI = 'mongodb://localhost:27017/clothshop'; // 改為你自己的連線字串

if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'));
}

// --- User schema ---
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['user', 'seller'], default: 'user' }
});
const User = mongoose.model('User', userSchema);

// --- Clothes schema ---  // <<<<<<<<<<<<<<<<<<<<<<<<<<< 這裡加三個欄位
const clothesSchema = new mongoose.Schema({
  name: String,
  price: Number,
  size: String,
  images: [String],
  description: String,
  occasion: String, // 場合
  gender: String,   // 性別
  shop: String,     // << 新增
  phone: String,    // << 新增
  address: String,  // << 新增
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});
const Clothes = mongoose.model('Clothes', clothesSchema);

// --- Middleware ---
function auth(role) {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: '未登入' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      if (role && decoded.role !== role) {
        return res.status(403).json({ error: '權限不足' });
      }
      next();
    } catch {
      return res.status(401).json({ error: 'JWT驗證失敗' });
    }
  };
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random()*1E9) + path.extname(file.originalname))
});
const upload = multer({ storage });

// --- 註冊 (只允許 Gmail 帳號) ---
app.post('/api/register', [
  body('username')
    .isEmail().withMessage('帳號必須為 Email 格式')
    .matches(/@gmail\.com$/).withMessage('只接受 Gmail 帳號'),
  body('password').isLength({ min: 4 }).withMessage('密碼至少 4 碼'),
  body('role').optional().isIn(['user','seller']).withMessage('角色必須為 user 或 seller')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg, details: errors.array() });
  let { username, password, role } = req.body;
  role = role || 'user';
  try {
    if (await User.findOne({ username })) return res.status(400).json({ error: '帳號已存在' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hashed, role });
    res.json({ message: '註冊成功' });
  } catch (e) {
    res.status(500).json({ error: '註冊失敗' });
  }
});

// --- 登入 ---
app.post('/api/login', [
  body('username').isLength({ min: 3 }),
  body('password').isLength({ min: 4 })
], async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: '帳號或密碼錯誤' });
  if (!(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: '帳號或密碼錯誤' });
  const token = jwt.sign({ id: user._id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, role: user.role, username: user.username });
});

// --- 衣服列表（支援篩選/搜尋/分頁/場合/性別） ---
app.get('/api/clothes', async (req, res) => {
  const { search = '', page = 1, limit = 8, occasion = '', gender = '' } = req.query;
  const query = {};
  if (search) query.name = { $regex: search, $options: 'i' };
  if (occasion) query.occasion = occasion;
  if (gender) query.gender = gender;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [total, clothes] = await Promise.all([
    Clothes.countDocuments(query),
    Clothes.find(query).populate('seller','username role').skip(skip).limit(parseInt(limit)).sort({ _id: -1 })
  ]);
  res.json({ total, clothes });
});

// --- 取得單件衣服 ---
app.get('/api/clothes/:id', async (req, res) => {
  try {
    const cloth = await Clothes.findById(req.params.id).populate('seller','username role');
    res.json(cloth);
  } catch {
    res.status(404).json({ error: '找不到資料' });
  }
});

// --- 新增衣服（僅賣家）---
app.post('/api/clothes', auth('seller'), upload.array('images', 5), [
  body('name').isLength({ min: 1 }),
  body('price').isNumeric(),
  body('size').isLength({ min: 1 }),
  body('occasion').isLength({ min: 1 }),
  body('gender').isLength({ min: 1 }),
  body('shop').isLength({ min: 1 }),
  body('phone').isLength({ min: 1 }),
  body('address').isLength({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: '資料錯誤', details: errors.array() });
  let images = [];
  if (req.files) images = req.files.map(f => `/uploads/${f.filename}`);
  try {
    const c = await Clothes.create({
      name: req.body.name,
      price: req.body.price,
      size: req.body.size,
      images,
      category: '', // 已棄用
      occasion: req.body.occasion,
      gender: req.body.gender,
      description: req.body.description,
      shop: req.body.shop,         // << 支援店鋪名
      phone: req.body.phone,       // << 支援電話
      address: req.body.address,   // << 支援地址
      seller: req.user.id
    });
    res.status(201).json(c);
  } catch {
    res.status(500).json({ error: '新增失敗' });
  }
});

// --- 更新衣服（僅賣家/本人）---
app.put('/api/clothes/:id', auth('seller'), upload.array('images', 5), [
  body('name').optional().isLength({ min: 1 }),
  body('price').optional().isNumeric(),
  body('size').optional().isLength({ min: 1 }),
  body('occasion').optional().isLength({ min: 1 }),
  body('gender').optional().isLength({ min: 1 }),
  body('shop').optional().isLength({ min: 1 }),
  body('phone').optional().isLength({ min: 1 }),
  body('address').optional().isLength({ min: 1 })
], async (req, res) => {
  try {
    const current = await Clothes.findById(req.params.id);
    if (!current) return res.status(404).json({ error: '找不到資料' });
    if (String(current.seller) !== req.user.id) return res.status(403).json({ error: '只能編輯自己的商品' });

    // 刪除單張舊圖片
    let images = current.images;
    if (req.body.deleteImages) {
      const toDelete = Array.isArray(req.body.deleteImages) ? req.body.deleteImages : [req.body.deleteImages];
      images = images.filter(img => !toDelete.includes(img));
      for (const img of toDelete) if (img.startsWith('/uploads/')) {
        const fp = path.join(__dirname, img);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
    }
    // 新增新圖片
    if (req.files && req.files.length > 0) images = images.concat(req.files.map(f => `/uploads/${f.filename}`));
    current.name = req.body.name ?? current.name;
    current.price = req.body.price ?? current.price;
    current.size = req.body.size ?? current.size;
    current.occasion = req.body.occasion ?? current.occasion;
    current.gender = req.body.gender ?? current.gender;
    current.description = req.body.description ?? current.description;
    current.shop = req.body.shop ?? current.shop;
    current.phone = req.body.phone ?? current.phone;
    current.address = req.body.address ?? current.address;
    current.images = images;
    await current.save();
    res.json(current);
  } catch {
    res.status(500).json({ error: '更新失敗' });
  }
});

// --- 刪除衣服（僅賣家/本人）---
app.delete('/api/clothes/:id', auth('seller'), async (req, res) => {
  try {
    const c = await Clothes.findById(req.params.id);
    if (!c) return res.status(404).json({ error: '找不到資料' });
    if (String(c.seller) !== req.user.id) return res.status(403).json({ error: '只能刪除自己的商品' });
    for (const img of c.images) {
      if (img.startsWith('/uploads/')) {
        const fp = path.join(__dirname, img);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
    }
    await Clothes.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch {
    res.status(500).json({ error: '刪除失敗' });
  }
});

// --- 場合與性別選項 API ---
app.get('/api/occasions', (req, res) => {
  res.json([MONGO_URI 
    '約會', '面試', '運動', '放鬆', '逛街', 'cosplay'
  ]);
});
app.get('/api/genders', (req, res) => {
  res.json([
    '男士','女士','中性'
  ]);
});

const PORT = 3001;
mongoose.connect(MONGO_URI, { })
  .then(() => app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`)))
  .catch(err => console.error('MongoDB connect error:', err));