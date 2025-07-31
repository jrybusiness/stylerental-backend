// ====== 設定 ======
const apiBase = 'http://localhost:3001';
const tokenKey = 'cloth_token';
const userKey = 'cloth_user';
let token = localStorage.getItem(tokenKey) || '';
let currentUser = localStorage.getItem(userKey) || '';
let currentRole = '';
let currentPage = 1, limit = 8, totalPage = 1;
let searchValue = '', filterOccasion = '', filterGender = '';
let editingId = null;
let oldImgs = [];
let delOldImgs = [];
let newImgs = [];
let uploading = false;

function setMsg(msg, isForm = false) {
  document.getElementById(isForm ? 'cloth-form-msg' : 'msg').textContent = msg || '';
}
function getImageUrl(imgUrl) {
  if (!imgUrl) return '';
  if (imgUrl.startsWith('/uploads/')) return apiBase + imgUrl;
  return imgUrl;
}
function switchPage(page) {
  document.getElementById('page-title').style.display = (page === 'auth') ? '' : 'none';
  document.getElementById('auth-form').style.display = (page === 'auth') ? '' : 'none';
  document.getElementById('main-app').style.display = (page === 'main') ? '' : 'none';
  document.getElementById('cloth-form').style.display = (page === 'cloth') ? '' : 'none';
  setMsg('');
}
function resetForm() {
  document.getElementById('cloth-name').value = '';
  document.getElementById('cloth-price').value = '';
  document.getElementById('cloth-size').value = '';
  document.getElementById('cloth-occasion').value = '';
  document.getElementById('cloth-gender').value = '';
  document.getElementById('cloth-shop').value = '';
  document.getElementById('cloth-phone').value = '';
  document.getElementById('cloth-address').value = '';
  document.getElementById('cloth-desc').value = '';
  document.getElementById('cloth-imgs').value = '';
  document.getElementById('img-preview-list').innerHTML = '';
  oldImgs = [];
  delOldImgs = [];
  newImgs = [];
}

// ====== AUTH ======
function setUser(u, t, r) {
  if (u && t) {
    localStorage.setItem(tokenKey, t);
    localStorage.setItem(userKey, u);
    token = t;
    currentUser = u;
    currentRole = r;
    document.getElementById('hello').textContent = `HI, ${u}（${r==='seller'?'賣家':'買家'}）`;
    document.getElementById('to-add-btn').style.display = r==='seller' ? '' : 'none';
  } else {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    token = '';
    currentUser = '';
    currentRole = '';
  }
}

function showAuthForm(isRegister=true) {
  switchPage('auth');
  setMsg('');
  document.getElementById('auth-form').reset();
  document.getElementById('page-title').textContent = isRegister ? '註冊' : '登入';
  document.getElementById('auth-btn').textContent = isRegister ? '註冊' : '登入';
  document.getElementById('role-row').style.display = isRegister ? '' : 'none';
  document.getElementById('switch-auth').innerHTML = isRegister
    ? `已有帳號？<a href="#" id="to-login">登入</a>`
    : `沒有帳號？<a href="#" id="to-reg">註冊</a>`;
  setTimeout(() => {
    document.getElementById(isRegister ? 'to-login' : 'to-reg').onclick = (e) => {
      e.preventDefault();
      showAuthForm(!isRegister);
    };
  }, 10);
}
document.getElementById('auth-form').onsubmit = async function(e){
  e.preventDefault();
  const user = document.getElementById('user').value.trim();
  const pass = document.getElementById('pass').value;
  const role = document.getElementById('role').value;
  setMsg('處理中...');
  if(!/^[^@]+@gmail\.com$/.test(user)){
    setMsg('只接受 Gmail 帳號');
    return;
  }
  if(pass.length < 4){
    setMsg('密碼至少 4 碼');
    return;
  }
  try {
    const isReg = document.getElementById('auth-btn').textContent === '註冊';
    const url = apiBase + (isReg ? '/api/register' : '/api/login');
    const body = { username: user, password: pass };
    if(isReg) body.role = role;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || '錯誤');
    if(isReg){
      setMsg('註冊成功，請登入');
      showAuthForm(false);
    } else {
      setUser(data.username, data.token, data.role);
      switchPage('main');
      loadClothes();
    }
  } catch (err) {
    setMsg(err.message || '錯誤');
  }
};
document.getElementById('logout-btn').onclick = function(){
  setUser('', '', '');
  showAuthForm(false);
};
if(token && currentUser){
  setUser(currentUser, token, 'user');
  switchPage('main');
  loadClothes();
} else {
  showAuthForm(true);
}

// ====== 查詢 ======
document.getElementById('search-btn').onclick = function(){
  searchValue = document.getElementById('search-input').value.trim();
  filterOccasion = document.getElementById('occasion-select').value.trim();
  filterGender = document.getElementById('gender-select').value;
  currentPage = 1;
  loadClothes();
};
document.getElementById('clear-search-btn').onclick = function(){
  searchValue = '';
  filterOccasion = '';
  filterGender = '';
  currentPage = 1;
  document.getElementById('search-input').value = '';
  document.getElementById('occasion-select').value = '';
  document.getElementById('gender-select').value = '';
  loadClothes();
};
document.getElementById('occasion-select').onchange = function(){
  filterOccasion = this.value.trim();
  currentPage = 1;
  loadClothes();
};
document.getElementById('gender-select').onchange = function(){
  filterGender = this.value;
  currentPage = 1;
  loadClothes();
};

// ====== 衣服清單 ======
async function loadClothes(){
  let url = `${apiBase}/api/clothes?page=${currentPage}&limit=${limit}`;
  if(searchValue) url += `&search=${encodeURIComponent(searchValue)}`;
  if(filterOccasion) url += `&occasion=${encodeURIComponent(filterOccasion)}`;
  if(filterGender) url += `&gender=${encodeURIComponent(filterGender)}`;
  setMsg('載入中...', false);
  try {
    const res = await fetch(url);
    const data = await res.json();
    renderClothes(data.clothes || []);
    renderPagination(data.total || 0);
    setMsg('');
  } catch {
    setMsg('載入失敗', false);
  }
}
function renderClothes(list){
  const box = document.getElementById('cloth-list');
  if(list.length===0){
    box.innerHTML = `<div style="text-align:center;color:#b2bec3;padding:36px;">查無資料</div>`;
    return;
  }
  box.innerHTML = list.map(item => {
    let imgs = `<div class="cloth-img-list">` + (item.images||[]).map(imgUrl => {
      let src = getImageUrl(imgUrl);
      return `<img src="${src}" alt="${item.name||'衣服圖'}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/892/892458.png'">`;
    }).join('') + `</div>`;
    let meta = `<div class="meta">場合：${item.occasion||"-"}　性別：${item.gender||"-"}</div>`;
    let owner = item.seller && item.seller.username
      ? `<div class="meta">賣家：${item.seller.username}</div>` : '';
    let shopInfo = `<div class="meta">店鋪：${item.shop||'-'}<br>電話：${item.phone||'-'}<br>地址：${item.address||'-'}</div>`;
    let admin = '';
    if(currentRole === 'seller' && item.seller && item.seller.username === currentUser){
      admin = `<div class="admin-btns">
        <button class="edit" data-id="${item._id}">編輯</button>
        <button class="del" data-id="${item._id}">刪除</button>
      </div>`;
    }
    return `<div class="cloth-card">
      ${imgs}
      <h4>${item.name}</h4>
      <div class="desc">${item.description||'-'}</div>
      <div class="meta">價格：<b style="color:#00b894;">$${item.price||'-'}</b>　尺寸：${item.size||'-'}</div>
      ${meta}
      ${owner}
      ${shopInfo}
      ${admin}
    </div>`;
  }).join('');
  box.querySelectorAll('.edit').forEach(btn =>
    btn.onclick = () => editCloth(btn.getAttribute('data-id')));
  box.querySelectorAll('.del').forEach(btn =>
    btn.onclick = () => delCloth(btn.getAttribute('data-id')));
}
function renderPagination(total){
  totalPage = Math.ceil(total/limit);
  let html = '';
  for(let i=1;i<=totalPage;i++){
    html += `<button class="${i===currentPage?'active':''}" onclick="gotoPage(${i})">${i}</button>`;
  }
  document.getElementById('pagination').innerHTML = html;
}
window.gotoPage = function(p){
  currentPage = p;
  loadClothes();
}

// ====== 新增/編輯衣服 ======
document.getElementById('to-add-btn').onclick = function(){
  editingId = null;
  document.getElementById('cloth-form-title').textContent = '新增衣服';
  resetForm();
  switchPage('cloth');
};
document.getElementById('cloth-cancel-btn').onclick = function(){
  switchPage('main');
};
document.getElementById('cloth-imgs').addEventListener('change', function(){
  newImgs = Array.from(this.files);
  renderImgPreview();
});
function renderImgPreview(){
  const box = document.getElementById('img-preview-list');
  box.innerHTML = '';
  oldImgs.forEach((url,idx) => {
    if(delOldImgs.includes(url)) return;
    let src = getImageUrl(url);
    let el = document.createElement('div');
    el.className = 'img-wrap';
    el.innerHTML = `<img src="${src}" alt="old">
      <button class="del-img" data-idx="${idx}" title="刪除這張舊圖">×</button>`;
    el.querySelector('.del-img').onclick = function(){
      delOldImgs.push(url);
      renderImgPreview();
    };
    box.appendChild(el);
  });
  newImgs.forEach((f,idx) => {
    let el = document.createElement('div');
    el.className = 'img-wrap';
    let reader = new FileReader();
    reader.onload = function(e){
      el.innerHTML = `<img src="${e.target.result}" alt="new">
        <button class="del-img" data-idx="${idx}" title="刪除此新圖">×</button>`;
      el.querySelector('.del-img').onclick = function(){
        newImgs.splice(idx,1);
        renderImgPreview();
      };
    };
    reader.readAsDataURL(f);
    box.appendChild(el);
  });
}
document.getElementById('cloth-form').onsubmit = async function(e){
  e.preventDefault();
  if(uploading) return;
  uploading = true;
  setMsg('處理中...', true);
  const name = document.getElementById('cloth-name').value.trim();
  const price = document.getElementById('cloth-price').value.trim();
  const size = document.getElementById('cloth-size').value.trim();
  const occasion = document.getElementById('cloth-occasion').value.trim();
  const gender = document.getElementById('cloth-gender').value;
  const shop = document.getElementById('cloth-shop').value.trim();
  const phone = document.getElementById('cloth-phone').value.trim();
  const address = document.getElementById('cloth-address').value.trim();
  const desc = document.getElementById('cloth-desc').value.trim();
  if(!name||!price||!size||!occasion||!gender||!shop||!phone||!address){
    setMsg('請完整填寫', true); uploading=false; return;
  }
  if (!/^\d+$/.test(price)) {
    setMsg('價格只可填數字', true); uploading = false; return;
  }
  let formData = new FormData();
  formData.append('name', name);
  formData.append('price', price);
  formData.append('size', size);
  formData.append('occasion', occasion);
  formData.append('gender', gender);
  formData.append('shop', shop);
  formData.append('phone', phone);
  formData.append('address', address);
  formData.append('description', desc);
  delOldImgs.forEach(img => formData.append('deleteImages', img));
  for(const f of newImgs) formData.append('images', f);

  try {
    let url = apiBase + '/api/clothes';
    let method = 'POST';
    if(editingId){
      url += '/'+editingId;
      method = 'PUT';
    }
    const res = await fetch(url, {
      method,
      headers: { Authorization: 'Bearer ' + token },
      body: formData
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error||'失敗');
    setMsg('成功', true);
    switchPage('main');
    loadClothes();
  } catch(err){
    setMsg(err.message, true);
  }
  uploading = false;
};
async function editCloth(id){
  editingId = id;
  resetForm();
  setMsg('', true);
  document.getElementById('cloth-form-title').textContent = '編輯衣服';
  switchPage('cloth');
  try {
    const res = await fetch(`${apiBase}/api/clothes/${id}`);
    const data = await res.json();
    document.getElementById('cloth-name').value = data.name||'';
    document.getElementById('cloth-price').value = data.price||'';
    document.getElementById('cloth-size').value = data.size||'';
    document.getElementById('cloth-occasion').value = data.occasion||'';
    document.getElementById('cloth-gender').value = data.gender||'';
    document.getElementById('cloth-shop').value = data.shop||'';
    document.getElementById('cloth-phone').value = data.phone||'';
    document.getElementById('cloth-address').value = data.address||'';
    document.getElementById('cloth-desc').value = data.description||'';
    oldImgs = Array.isArray(data.images) ? data.images : [];
    delOldImgs = [];
    newImgs = [];
    renderImgPreview();
  } catch {
    setMsg('取得資料失敗', true);
  }
}
async function delCloth(id){
  if(!confirm('確認刪除這件衣服嗎？')) return;
  setMsg('刪除中...');
  try {
    const res = await fetch(`${apiBase}/api/clothes/${id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token }
    });
    if(res.status === 204){
      setMsg('刪除成功');
      loadClothes();
    }else{
      const data = await res.json();
      throw new Error(data.error||'刪除失敗');
    }
  } catch(err){
    setMsg(err.message);
  }
}