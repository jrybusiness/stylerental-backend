const express = require('express');
const router = express.Router();
const Cloth = require('../models/Cloth');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const upload = multer({ dest: path.join(__dirname, '../uploads') });

// 取得所有衣服（支援分頁/查詢）
router.get('/api/clothes', async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 8;
  const search = req.query.search || '';
  const occasion = req.query.occasion || '';
  const gender = req.query.gender || '';
  const filter = {};
  if (search) filter.name = { $regex: search, $options: 'i' };
  if (occasion) filter.occasion = occasion;
  if (gender) filter.gender = gender;
  const total = await Cloth.countDocuments(filter);
  const clothes = await Cloth.find(filter)
    .populate('seller', 'username')
    .sort({ _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  res.json({ total, clothes });
});

// 取得單一衣服
router.get('/api/clothes/:id', async (req, res) => {
  const cloth = await Cloth.findById(req.params.id);
  if (!cloth) return res.status(404).json({ error: '找不到此衣服' });
  res.json(cloth);
});

// 新增衣服
router.post('/api/clothes', auth, upload.array('images'), async (req, res) => {
  try {
    const {
      name, price, size, occasion, gender, shop, phone, address, description
    } = req.body;
    let images = [];
    if (req.files) {
      images = req.files.map(f => '/uploads/' + f.filename);
    }
    const cloth = new Cloth({
      name, price, size, occasion, gender, shop, phone, address, description,
      images,
      seller: req.user._id
    });
    await cloth.save();
    res.json(cloth);
  } catch (err) {
    res.status(500).json({ error: err.message || '新增失敗' });
  }
});

// 編輯衣服
router.put('/api/clothes/:id', auth, upload.array('images'), async (req, res) => {
  try {
    const cloth = await Cloth.findById(req.params.id);
    if (!cloth) return res.status(404).json({ error: '找不到此衣服' });
    if (String(cloth.seller) !== String(req.user._id)) {
      return res.status(403).json({ error: '只能編輯自己上架的衣服' });
    }
    const {
      name, price, size, occasion, gender, shop, phone, address, description
    } = req.body;
    cloth.name = name;
    cloth.price = price;
    cloth.size = size;
    cloth.occasion = occasion;
    cloth.gender = gender;
    cloth.shop = shop;
    cloth.phone = phone;
    cloth.address = address;
    cloth.description = description;
    // 新增圖片
    if (req.files && req.files.length > 0) {
      cloth.images = cloth.images.concat(req.files.map(f => '/uploads/' + f.filename));
    }
    // 刪除指定舊圖片
    if (req.body.deleteImages) {
      const delArr = Array.isArray(req.body.deleteImages)
        ? req.body.deleteImages
        : [req.body.deleteImages];
      cloth.images = cloth.images.filter(img => !delArr.includes(img));
      // 實體檔案也移除
      delArr.forEach(imgPath => {
        const realPath = path.join(__dirname, '../', imgPath);
        if (fs.existsSync(realPath)) fs.unlinkSync(realPath);
      });
    }
    await cloth.save();
    res.json(cloth);
  } catch (err) {
    res.status(500).json({ error: err.message || '更新失敗' });
  }
});

// 刪除衣服
router.delete('/api/clothes/:id', auth, async (req, res) => {
  try {
    const cloth = await Cloth.findById(req.params.id);
    if (!cloth) return res.status(404).json({ error: '找不到此衣服' });
    if (String(cloth.seller) !== String(req.user._id)) {
      return res.status(403).json({ error: '只能刪除自己上架的衣服' });
    }
    // 刪除圖片實體檔案
    cloth.images.forEach(imgPath => {
      const realPath = path.join(__dirname, '../', imgPath);
      if (fs.existsSync(realPath)) fs.unlinkSync(realPath);
    });
    await Cloth.deleteOne({ _id: req.params.id });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message || '刪除失敗' });
  }
});

module.exports = router;