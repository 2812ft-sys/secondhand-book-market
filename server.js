const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const crypto = require('crypto');

const {
  getDb,
  seedDatabase,
  syncReservationQueues,
  recordSellerStrike,
  FIVE_HOURS_MS,
  FORTY_EIGHT_HOURS_MS,
  SIX_MONTHS_MS,
  ESCROW_FEE_PER_BOOK,
  PLATFORM_FEE_RATE,
  MERCHANT_BADGE_TIERS
} = require('./database/init-db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || '007_MARKETPLACE_ESCROW_JWT_KEY_2026';
const PUBLIC_DIR = __dirname;

// ============================================================================
// HIGH-CONCURRENCY IN-MEMORY CACHE & RATE LIMITER (รองรับผู้ใช้งานพร้อมกันระดับแสนคน)
// ============================================================================
const appMemoryCache = new Map();
const CACHE_TTL_MS = 25 * 1000; // แคชข้อมูลรายการหนังสือและหมวดหมู่ 25 วินาที (และ Invalidate ทันทีที่มีการแก้ไขข้อมูล)

function getFromCache(key) {
  const entry = appMemoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    appMemoryCache.delete(key);
    return null;
  }
  return entry.data;
}

function setInCache(key, data, ttlMs = CACHE_TTL_MS) {
  if (appMemoryCache.size > 1000) {
    const oldestKey = appMemoryCache.keys().next().value;
    if (oldestKey) appMemoryCache.delete(oldestKey);
  }
  appMemoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs
  });
}

function invalidateBookCache() {
  appMemoryCache.clear();
}

// ระบบ Rate Limiter ป้องกันผู้ใช้หรือบอทยิงคำสั่งรัวเกินกำหนด
const rateLimitStore = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) rateLimitStore.delete(key);
  }
}, 30000);

function createRateLimiter({ windowMs = 10000, maxRequests = 10, keyPrefix = 'rl', message = 'คุณส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง' }) {
  return (req, res, next) => {
    const userPart = req.user ? `u:${req.user.id}` : `ip:${req.ip || req.connection?.remoteAddress || 'anon'}`;
    const key = `${keyPrefix}:${userPart}`;
    const now = Date.now();
    let record = rateLimitStore.get(key);

    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + windowMs };
      rateLimitStore.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (record.count > maxRequests) {
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: `⏳ ${message} (กรุณารอ ${retryAfterSec} วินาที)`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterSec
      });
    }
    next();
  };
}

const reservationRateLimiter = createRateLimiter({
  windowMs: 10000,
  maxRequests: 6,
  keyPrefix: 'reserve_queue',
  message: 'ระบบป้องกันการกดจองคิวรัวเกินกำหนด'
});

const chatMessageRateLimiter = createRateLimiter({
  windowMs: 10000,
  maxRequests: 8,
  keyPrefix: 'chat_msg',
  message: 'ระบบป้องกันการส่งข้อความแชทรัวเกินกำหนด'
});

// Initialize & Seed SQLite Database on Startup
seedDatabase(false);

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(cookieParser());

// Background worker to sync expired 5-hour reservation queues every 5 seconds
setInterval(() => {
  try {
    syncReservationQueues();
  } catch (err) {
    console.error('Queue sync error:', err.message);
  }
}, 5000);

function sanitizeUserRow(userRow) {
  if (!userRow) return null;
  const bannedUntil = userRow.seller_banned_until || null;
  const isSellingBanned = Boolean(bannedUntil && new Date(bannedUntil).getTime() > Date.now());
  return {
    id: userRow.id,
    username: userRow.username,
    email: userRow.email,
    phone_number: userRow.phone_number,
    role: userRow.role,
    bank_name: userRow.bank_name || '',
    bank_account_no: userRow.bank_account_no || '',
    bank_account_name: userRow.bank_account_name || userRow.username,
    strike_count: Number(userRow.strike_count || 0),
    strike_month: userRow.strike_month || new Date().toISOString().slice(0, 7),
    seller_banned_until: bannedUntil,
    is_selling_banned: isSellingBanned,
    selling_status_label: isSellingBanned
      ? 'ระงับสิทธิ์การลงขายชั่วคราวเป็นเวลา 6 เดือน'
      : 'ปกติ (ลงขายและซื้อได้ตามปกติ)',
    merchant_tier: userRow.merchant_tier || 'none',
    merchant_badge_label: userRow.merchant_badge_label || '',
    boost_level: Number(userRow.boost_level || 0),
    merchant_expires_at: userRow.merchant_expires_at || null,
    created_at: userRow.created_at
  };
}

function extractUserFromRequest(req) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token;
  }

  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = getDb();
    const userRow = db.prepare(`SELECT * FROM Users WHERE id = ?`).get(decoded.id);
    return sanitizeUserRow(userRow);
  } catch (err) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = extractUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งานส่วนนี้ (Unauthorized)' });
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  const user = extractUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน (Unauthorized)' });
  }
  if (user.role !== 'Admin') {
    return res.status(403).json({ error: 'เฉพาะแอดมินตัวกลาง (Admin) เท่านั้นที่เข้าถึงส่วนนี้ได้' });
  }
  req.user = user;
  next();
}

// Helper: คำนวณค่าธรรมเนียมระบบ (Escrow Fee) แบบผสม: 5 บาท + 5% ของราคาหนังสือ (ปัดเศษเป็นจำนวนเต็ม ขั้นต่ำ 5฿ สูงสุดไม่เกิน 30฿ ต่อเล่ม)
function calculateEscrowFee(bookPrice) {
  const price = Math.max(0, Number(bookPrice) || 0);
  return Math.min(30, Math.max(5, Math.round(5 + price * 0.05)));
}

// Helper: สร้างข้อความตอบกลับอัตโนมัติจาก AI Chatbot ของแพลตฟอร์ม (ดูแลครบทุกขั้นตอน 1/6 ถึง 6/6)
function buildAIAutoReply(book, seller, buyer, queueInfo, userMessage = '') {
  const platformFee = calculateEscrowFee(book.price); // ค่าธรรมเนียมระบบ (5 บาท + 5% สูงสุดไม่เกิน 30฿/เล่ม)
  const totalAmount = Number(book.price) + Number(book.shipping_fee) + platformFee;
  const queueText = queueInfo
    ? `ลำดับคิวที่ ${queueInfo.queue_no} (สถานะ: ${queueInfo.status}${queueInfo.status === 'Active' ? ' — มีเวลาชำระเงิน 5 ชั่วโมง' : ''})`
    : 'สามารถกดจองคิวได้ทันที';

  if (!userMessage) {
    return `🤖 [AI Chatbot ดูแลการซื้อขายครบวงจร — ขั้นตอนที่ 1/6 & 2/6]: ยินดีต้อนรับสู่ห้องแชทรายการจองหนังสือ "${book.title}"!\n` +
      `✅ [ขั้นตอนที่ 1/6 - จองคิวสำเร็จ]: ${queueText}\n` +
      `💳 [ขั้นตอนที่ 2/6 - แจ้งยอดโอนเข้าบัญชีกลาง]: ค่าหนังสือ ฿${book.price} + ค่าส่ง ฿${book.shipping_fee} + ค่าธรรมเนียมระบบ (5฿ + 5% สูงสุด 30฿) ฿${platformFee} = ยอดโอนสุทธิ ฿${totalAmount} (โอนเข้าบัญชีกลางแอดมิน กสิกรไทย 007-1-99999-8)\n` +
      `📦 [ขั้นตอนที่ 3/6 - กติกาผู้ขายจัดส่งภายใน 1-2 วัน (48 ชม.)]: หลังแอดมินยืนยันยอดเงิน ผู้ขาย (${seller.username}) ต้องจัดส่งและกรอกเลขพัสดุภายใน 48 ชม. (หากส่งล่าช้าจะได้รับดาวเตือน ⚠️⭐ 1 ดวง และหากครบ 3 ดวงในเดือนเดียวกันจะถูกระงับสิทธิ์การขาย 6 เดือน)\n` +
      `🔄 [ขั้นตอนที่ 4/6 - 6/6]: เมื่อผู้ขายแจ้งเลขพัสดุแล้ว ผู้ซื้อตรวจรับหนังสือและกดยืนยันรับสินค้าเพื่อให้แอดมินโอนเงินให้ผู้ขาย หรือกดปุ่ม "🔄 แจ้งปัญหา / ขอคืนสินค้า" ในห้องแชทนี้ได้ทันทีครับ!`;
  }

  const msgLower = userMessage.toLowerCase();
  let specificAnswer = '';
  if (msgLower.includes('คืน') || msgLower.includes('ไม่ตรงปก') || msgLower.includes('เสียหาย') || msgLower.includes('ขาด') || msgLower.includes('ผิดเล่ม') || msgLower.includes('แอดมิน')) {
    specificAnswer = `🔄 การแจ้งปัญหา / ขอคืนสินค้า: คุณผู้ซื้อสามารถกดปุ่ม "🔄 แจ้งปัญหา / ขอคืนสินค้า (Request Return / Call Admin)" ด้านบนห้องแชท เพื่อเลือกเหตุผล (สภาพหนังสือไม่ตรงปก / หน้าขาดเสียหาย / ได้รับหนังสือผิดเล่ม) พร้อมแนบรูปหลักฐาน ระบบจะระงับการโอนเงินให้ผู้ขายชั่วคราว (Freeze Escrow) และส่งแจ้งเตือนด่วนไปยัง Admin Dashboard ทันทีครับ!`;
  } else if (msgLower.includes('ค่าส่ง') || msgLower.includes('ส่งยังไง') || msgLower.includes('ขนส่ง') || msgLower.includes('แพ็ก') || msgLower.includes('48')) {
    specificAnswer = `📦 ข้อมูลการจัดส่งที่ผู้ขาย (${seller.username}) ระบุไว้: ค่าจัดส่ง ฿${book.shipping_fee} บาท (${book.packing_note}) — ผู้ขายต้องจัดส่งภายใน 1-2 วัน (48 ชั่วโมง) หลังชำระเงิน มิฉะนั้นจะได้รับสัญลักษณ์ดาวเตือน ⚠️⭐ ครับ`;
  } else if (msgLower.includes('สภาพ') || msgLower.includes('ตำหนิ') || msgLower.includes('รูป')) {
    specificAnswer = `🔍 ข้อมูลสภาพหนังสือที่ผู้ขายระบุไว้: ${book.condition_grade} — จุดสังเกต/ตำหนิ: "${book.defect_details}" (หากต้องการรูปถ่ายเพิ่มเติม ระบบได้แจ้งเตือนผู้ขาย ${seller.username} ให้ส่งรูปในแชทนี้แล้วครับ)`;
  } else if (msgLower.includes('โอน') || msgLower.includes('ชำระ') || msgLower.includes('บัญชี') || msgLower.includes('สลิป') || msgLower.includes('ราคา')) {
    specificAnswer = `💳 ขั้นตอนชำระเงินปลอดภัยผ่านบัญชีกลาง: โอนยอดสุทธิ ฿${totalAmount} (ค่าหนังสือ ฿${book.price} + ค่าส่ง ฿${book.shipping_fee} + ค่าธรรมเนียมระบบ ฿${platformFee}) เข้าบัญชีกลางแอดมิน กสิกรไทย 007-1-99999-8 แล้วกดแจ้งชำระเงินได้เลยครับ`;
  } else {
    specificAnswer = `📋 สรุปรายการ "${book.title}": สถานะคิว ${queueText} | สภาพ ${book.condition_grade} | ค่าหนังสือ ฿${book.price} + ค่าส่ง ฿${book.shipping_fee} + ค่าธรรมเนียมระบบ ฿${platformFee} = ยอดโอนสุทธิ ฿${totalAmount}`;
  }

  return `🤖 [AI Chatbot ตอบกลับอัตโนมัติ]: รับทราบข้อความของคุณแล้วครับ!\n${specificAnswer}\n🔔 ระบบดูแลทุกขั้นตอนตั้งแต่จองคิว แจ้งยอดโอน แจ้งเตือนส่งของใน 48 ชม. แจ้งเลขพัสดุ จนถึงโอนเงินให้ผู้ขายสำเร็จครับ`;
}

// Helper: สร้างหรือดึงห้องแชท 3 ฝ่าย (Buyer + Seller + Admin)
function getOrCreateThreePartyChatRoom(db, book_id, buyer_id, reservation_id = null) {
  const book = db.prepare(`SELECT * FROM Books WHERE id = ?`).get(book_id);
  if (!book) return null;

  let room = db.prepare(`
    SELECT * FROM ChatRooms WHERE book_id = ? AND buyer_id = ? LIMIT 1
  `).get(book_id, buyer_id);

  const nowIso = new Date().toISOString();
  const seller = db.prepare(`SELECT id, username, email FROM Users WHERE id = ?`).get(book.seller_id);
  const buyer = db.prepare(`SELECT id, username, email FROM Users WHERE id = ?`).get(buyer_id);
  const queueInfo = db.prepare(`
    SELECT * FROM Reservations WHERE book_id = ? AND buyer_id = ? ORDER BY id DESC LIMIT 1
  `).get(book_id, buyer_id);

  if (!room) {
    const roomCode = `ROOM-BK${String(book_id).padStart(2, '0')}-B${buyer_id}-${Math.floor(100 + Math.random() * 900)}`;
    const insertRes = db.prepare(`
      INSERT INTO ChatRooms (room_code, book_id, buyer_id, seller_id, admin_id, reservation_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?)
    `).run(roomCode, book_id, buyer_id, book.seller_id, reservation_id || (queueInfo ? queueInfo.id : null), nowIso, nowIso);

    const roomId = Number(insertRes.lastInsertRowid);

    // บอท AI ตอบกลับต้อนรับอัตโนมัติทันทีที่เปิดห้องแชท 3 ฝ่าย
    const welcomeText = buildAIAutoReply(book, seller, buyer, queueInfo, '');
    db.prepare(`
      INSERT INTO ChatMessages (room_id, sender_id, sender_role, sender_name, message, attachment_note, created_at)
      VALUES (?, NULL, 'AI_Bot', '🤖 AI Assistant (บอทตัวกลาง 007)', ?, '', ?)
    `).run(roomId, welcomeText, nowIso);

    room = db.prepare(`SELECT * FROM ChatRooms WHERE id = ?`).get(roomId);
  } else if (reservation_id && !room.reservation_id) {
    db.prepare(`UPDATE ChatRooms SET reservation_id = ?, updated_at = ? WHERE id = ?`).run(reservation_id, nowIso, room.id);
    room = db.prepare(`SELECT * FROM ChatRooms WHERE id = ?`).get(room.id);
  }

  return room;
}

// Helper: อัลกอริทึมจัดเรียงหน้าฟีดแบบผสมผสาน (Smart Blended Feed Boost)
// ให้ร้านค้าที่ซื้อแพ็กเกจ (VIP 500+ > แนะนำ 300+ > ขายดี 100+ > ร้านค้า 50+) มีโอกาสแสดงผลในแถวแรกๆ สูงขึ้น
// แต่สลับแทรก (Interleave) หนังสือของผู้ขายทั่วไปที่ไม่ได้ซื้อแพ็กเกจในทุกๆ แถว (เช่น 2 เล่มดันฟีด สลับกับ 2 เล่มผู้ขายทั่วไป) เพื่อไม่ให้ผู้ขายรายย่อยถูกดันตกไปอยู่หน้าหลังสุด
function blendBooksFeedServer(books) {
  if (!Array.isArray(books) || books.length <= 2) return books;
  const boosted = books
    .filter(b => Number(b.boost_level || 0) > 0)
    .sort((a, b) => {
      if (Number(b.boost_level || 0) !== Number(a.boost_level || 0)) {
        return Number(b.boost_level || 0) - Number(a.boost_level || 0);
      }
      return (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0);
    });
  const regular = books
    .filter(b => Number(b.boost_level || 0) <= 0)
    .sort((a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0));

  if (boosted.length === 0 || regular.length === 0) {
    return [...boosted, ...regular];
  }

  const blended = [];
  let bIdx = 0;
  let rIdx = 0;
  // ในแต่ละแถว (4 เล่ม): แสดงหนังสือร้านค้าดันฟีด 2 เล่ม สลับกับหนังสือผู้ขายทั่วไป 2 เล่ม
  while (bIdx < boosted.length || rIdx < regular.length) {
    for (let i = 0; i < 2 && bIdx < boosted.length; i++) {
      blended.push(boosted[bIdx++]);
    }
    for (let j = 0; j < 2 && rIdx < regular.length; j++) {
      blended.push(regular[rIdx++]);
    }
  }
  return blended;
}

function formatBookRow(row, db) {
  if (!row) return null;
  let coverTheme = { bg1: '#0f172a', bg2: '#1e3a8a', accent: '#fbbf24', badge: '007 MARKET' };
  let uploadedImages = [];
  try {
    const parsed = JSON.parse(row.images_json);
    if (parsed && typeof parsed === 'object') {
      coverTheme = parsed;
      if (Array.isArray(parsed.images)) {
        uploadedImages = parsed.images;
      }
    }
  } catch (e) {}

  const seller = db.prepare(`
    SELECT id, username, email, phone_number, strike_count, strike_month, seller_banned_until,
           merchant_tier, merchant_badge_label, boost_level, merchant_expires_at
    FROM Users WHERE id = ?
  `).get(row.seller_id);

  // คำนวณคะแนนรีวิวของผู้ขาย (Seller Star Rating & Review Count)
  let sellerRating = row.seller_id === 2 ? 4.9 : 4.9;
  let sellerReviewsCount = row.seller_id === 2 ? 28 : 34;
  let bookReviews = [];
  try {
    const sellerRevStats = db.prepare(`
      SELECT COUNT(*) AS cnt, AVG(rating) AS avg_rating
      FROM Reviews
      WHERE seller_id = ?
    `).get(row.seller_id);
    if (sellerRevStats && sellerRevStats.cnt > 0) {
      sellerRating = Number(Number(sellerRevStats.avg_rating).toFixed(1));
      sellerReviewsCount = (row.seller_id === 2 ? 27 : 32) + Number(sellerRevStats.cnt);
    }
    bookReviews = db.prepare(`
      SELECT id, order_id, book_id, seller_id, buyer_id, buyer_name, rating, comment, created_at
      FROM Reviews
      WHERE seller_id = ? OR book_id = ?
      ORDER BY id DESC
      LIMIT 10
    `).all(row.seller_id, row.id);
  } catch (e) {}

  const queues = db.prepare(`
    SELECT r.id, r.buyer_id, r.seller_id, r.book_id, r.queue_no, r.status, r.expires_at, r.created_at, u.username AS buyer_name
    FROM Reservations r
    JOIN Users u ON u.id = r.buyer_id
    WHERE r.book_id = ? AND r.status IN ('Active', 'Waiting')
    ORDER BY r.queue_no ASC, r.id ASC
  `).all(row.id);

  const effectiveStock = row.stock_status === 'Sold Out' ? 0 : Math.max(0, Number(row.stock ?? 1));
  const effectiveStatus = effectiveStock <= 0 ? 'Sold Out' : row.stock_status;

  return {
    id: `bk-${String(row.id).padStart(3, '0')}`,
    book_id: row.id,
    dbId: row.id,
    seller_id: row.seller_id,
    seller_name: seller ? seller.username : 'สมาชิกผู้ขาย',
    seller_strike_count: seller ? Number(seller.strike_count || 0) : 0,
    seller_banned_until: seller ? (seller.seller_banned_until || null) : null,
    seller_badge_label: seller ? (seller.merchant_badge_label || '') : '',
    merchant_tier: seller ? (seller.merchant_tier || 'none') : 'none',
    boost_level: seller ? Number(seller.boost_level || 0) : 0,
    seller_rating: sellerRating,
    seller_reviews_count: sellerReviewsCount,
    reviews: bookReviews,
    code: row.code,
    title: row.title,
    enTitle: row.en_title,
    author: row.author,
    translator: row.translator,
    publisher: row.publisher,
    category: row.category,
    categoryName: row.category_name,
    originalPrice: row.original_price,
    salePrice: row.price,
    price: row.price,
    shipping_fee: row.shipping_fee,
    packing_note: row.packing_note,
    conditionPercent: row.condition_percent,
    conditionGrade: row.condition_grade,
    defectNote: row.defect_details,
    defect_details: row.defect_details,
    coverTheme,
    images: uploadedImages,
    stock_status: effectiveStatus,
    stock: effectiveStock,
    isNewArrival: Boolean(row.is_new_arrival),
    isBestSeller: Boolean(row.is_best_seller),
    pages: row.pages,
    year: row.publish_year,
    isbn: row.isbn,
    synopsis: row.synopsis,
    activeQueueCount: queues.length,
    queues
  };
}

// ============================================================================
// 1. AUTHENTICATION & UNIFIED MEMBER REGISTRATION API
// ============================================================================

app.post('/api/auth/register', (req, res) => {
  try {
    const { username, email, phone_number, password, bank_name, bank_account_no, bank_account_name } = req.body;
    if (!username || !email || !phone_number || !password) {
      return res.status(400).json({ error: 'กรุณากรอก username, email, phone_number และ password ให้ครบถ้วน' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });
    }

    const db = getDb();
    const cleanEmail = String(email).trim().toLowerCase();
    const existing = db.prepare(`SELECT id FROM Users WHERE LOWER(email) = ?`).get(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานในระบบแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ' });
    }

    const password_hash = bcrypt.hashSync(String(password), 10);
    const created_at = new Date().toISOString();
    // ข้อ 2: ไม่ต้องแยกสถานะผู้ซื้อหรือผู้ขาย สมาชิกทุกคนมี role เป็น 'Member'
    const role = 'Member';

    const result = db.prepare(`
      INSERT INTO Users (username, email, phone_number, password_hash, role, bank_name, bank_account_no, bank_account_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(username).trim(),
      cleanEmail,
      String(phone_number).trim(),
      password_hash,
      role,
      String(bank_name || '').trim(),
      String(bank_account_no || '').trim(),
      String(bank_account_name || username).trim(),
      created_at
    );

    const newUserRow = db.prepare(`SELECT * FROM Users WHERE id = ?`).get(Number(result.lastInsertRowid));
    const user = sanitizeUserRow(newUserRow);

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('auth_token', token, { httpOnly: false, maxAge: 7 * 24 * 3600 * 1000, path: '/' });

    return res.status(201).json({
      message: 'สมัครสมาชิกสำเร็จ! บัญชีของคุณมีสิทธิ์เป็น Member (สามารถเป็นได้ทั้งผู้ซื้อและผู้ขายในบัญชีเดียว)',
      token,
      user,
      redirectUrl: '/index.html'
    });
  } catch (err) {
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก: ' + err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
    }

    const db = getDb();
    const cleanEmail = String(email).trim().toLowerCase();
    const userRow = db.prepare(`SELECT * FROM Users WHERE LOWER(email) = ?`).get(cleanEmail);

    if (!userRow) {
      return res.status(401).json({ error: 'ไม่พบบัญชีอีเมลนี้ในระบบ' });
    }

    const isValid = bcrypt.compareSync(String(password), userRow.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' });
    }

    const user = sanitizeUserRow(userRow);

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('auth_token', token, { httpOnly: false, maxAge: 7 * 24 * 3600 * 1000, path: '/' });

    // Role-based Redirect: Admin -> /admin.html, Member -> /index.html
    const redirectUrl = user.role === 'Admin' ? '/admin.html' : '/index.html';

    return res.json({
      message: `เข้าสู่ระบบสำเร็จในสิทธิ์ ${user.role}`,
      token,
      user,
      redirectUrl
    });
  } catch (err) {
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ: ' + err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_token', { path: '/' });
  return res.json({ message: 'ออกจากระบบสำเร็จ' });
});

app.get('/api/auth/me', (req, res) => {
  const user = extractUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ authenticated: false, user: null });
  }
  return res.json({ authenticated: true, user });
});

app.post('/api/auth/forgot-password', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'กรุณากรอกอีเมลของคุณเพื่อรับลิงก์รีเซ็ตรหัสผ่าน' });
    }

    const db = getDb();
    const cleanEmail = String(email).trim().toLowerCase();
    const userRow = db.prepare(`SELECT id, username, email FROM Users WHERE LOWER(email) = ?`).get(cleanEmail);

    if (!userRow) {
      return res.status(404).json({ error: 'ไม่พบอีเมลนี้ในระบบฐานข้อมูลสมาชิก' });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetExpires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    db.prepare(`
      UPDATE Users SET reset_token = ?, reset_expires_at = ? WHERE id = ?
    `).run(resetToken, resetExpires, userRow.id);

    const resetUrl = `${req.protocol}://${req.get('host')}/forgot-password.html?token=${resetToken}&email=${encodeURIComponent(userRow.email)}`;

    console.log('===============================================================');
    console.log('🔑 [SIMULATED EMAIL - FORGOT PASSWORD LINK]');
    console.log(`ผู้รับ: ${userRow.username} <${userRow.email}>`);
    console.log(`ลิงก์สำหรับรีเซ็ตรหัสผ่าน: ${resetUrl}`);
    console.log('===============================================================');

    return res.json({
      message: `สร้างลิงก์รีเซ็ตรหัสผ่านสำหรับ ${userRow.email} เรียบร้อยแล้ว!`,
      simulatedResetLink: resetUrl,
      resetToken,
      email: userRow.email
    });
  } catch (err) {
    return res.status(500).json({ error: 'เกิดข้อผิดพลาด: ' + err.message });
  }
});

app.post('/api/auth/reset-password', (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password || String(new_password).length < 6) {
      return res.status(400).json({ error: 'กรุณาระบุ Token และรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร' });
    }

    const db = getDb();
    const userRow = db.prepare(`SELECT id, email, reset_expires_at FROM Users WHERE reset_token = ?`).get(String(token).trim());
    if (!userRow) {
      return res.status(400).json({ error: 'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือถูกใช้งานไปแล้ว' });
    }

    const newHash = bcrypt.hashSync(String(new_password), 10);
    db.prepare(`UPDATE Users SET password_hash = ?, reset_token = NULL, reset_expires_at = NULL WHERE id = ?`).run(newHash, userRow.id);

    return res.json({ message: 'รีเซ็ตรหัสผ่านใหม่สำเร็จ! (เข้ารหัสด้วย bcrypt เรียบร้อย)' });
  } catch (err) {
    return res.status(500).json({ error: 'เกิดข้อผิดพลาด: ' + err.message });
  }
});

// ============================================================================
// 2. USER PROFILE API (แก้ไขข้อมูลส่วนตัว + เลขบัญชีธนาคารสำหรับรับเงินจากแอดมิน)
// ============================================================================

app.put('/api/profile', requireAuth, (req, res) => {
  try {
    const { username, email, phone_number, bank_name, bank_account_no, bank_account_name } = req.body;
    if (!username || !email || !phone_number) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้ อีเมล และเบอร์โทรศัพท์ให้ครบถ้วน' });
    }

    const db = getDb();
    const cleanEmail = String(email).trim().toLowerCase();
    const duplicate = db.prepare(`SELECT id FROM Users WHERE LOWER(email) = ? AND id != ?`).get(cleanEmail, req.user.id);
    if (duplicate) {
      return res.status(409).json({ error: 'อีเมลนี้มีผู้ใช้งานอื่นใช้แล้ว' });
    }

    db.prepare(`
      UPDATE Users
      SET username = ?, email = ?, phone_number = ?, bank_name = ?, bank_account_no = ?, bank_account_name = ?
      WHERE id = ?
    `).run(
      String(username).trim(),
      cleanEmail,
      String(phone_number).trim(),
      String(bank_name || '').trim(),
      String(bank_account_no || '').trim(),
      String(bank_account_name || '').trim(),
      req.user.id
    );

    const updatedUserRow = db.prepare(`SELECT * FROM Users WHERE id = ?`).get(req.user.id);
    const updatedUser = sanitizeUserRow(updatedUserRow);

    return res.json({
      message: 'บันทึกข้อมูลส่วนตัวและบัญชีธนาคารสำหรับรับเงินขายหนังสือเรียบร้อยแล้ว!',
      user: updatedUser
    });
  } catch (err) {
    return res.status(500).json({ error: 'เกิดข้อผิดพลาด: ' + err.message });
  }
});

app.put('/api/profile/password', requireAuth, (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password || String(new_password).length < 6) {
      return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร' });
    }

    const db = getDb();
    const userRow = db.prepare(`SELECT password_hash FROM Users WHERE id = ?`).get(req.user.id);
    if (!bcrypt.compareSync(String(current_password), userRow.password_hash)) {
      return res.status(401).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
    }

    const newHash = bcrypt.hashSync(String(new_password), 10);
    db.prepare(`UPDATE Users SET password_hash = ? WHERE id = ?`).run(newHash, req.user.id);

    return res.json({ message: 'เปลี่ยนรหัสผ่านใหม่สำเร็จ! (เข้ารหัสด้วย bcrypt เรียบร้อย)' });
  } catch (err) {
    return res.status(500).json({ error: 'เกิดข้อผิดพลาด: ' + err.message });
  }
});

// ============================================================================
// 3. BOOKS & MEMBER LISTING API (รองรับ In-memory Cache & Pagination ครั้งละ 12 เล่ม)
// ============================================================================

app.get('/api/books', (req, res) => {
  try {
    const db = getDb();
    syncReservationQueues(db);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = req.query.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit, 10))) : 0; // limit=12 สำหรับแบ่งหน้า
    const category = String(req.query.category || 'all').trim();
    const search = String(req.query.search || '').trim().toLowerCase();
    const condition = Math.max(0, parseInt(req.query.condition, 10) || 0);
    const status = String(req.query.status || 'all').trim();
    const maxPrice = Math.max(0, parseFloat(req.query.maxPrice) || 0);
    const sort = String(req.query.sort || 'popular').trim();

    const cacheKey = `books:p=${page}:l=${limit}:cat=${category}:q=${search}:cond=${condition}:st=${status}:mp=${maxPrice}:sort=${sort}`;
    const cachedPayload = getFromCache(cacheKey);
    if (cachedPayload) {
      res.setHeader('X-Cache', 'HIT');
      return res.json({ ...cachedPayload, cacheStatus: 'HIT' });
    }

    // ดึงข้อมูลหนังสือพร้อมใช้ Index และคำนวณจำนวนหนังสือแต่ละหมวดหมู่
    const allRows = db.prepare(`SELECT * FROM Books ORDER BY id DESC`).all();
    const allBooks = allRows.map(r => formatBookRow(r, db));

    // คำนวณจำนวนเล่มต่อหมวดหมู่ (Category Counts) เพื่อแสดงในปุ่มแคปซูล 20 หมวดหมู่
    const categoryCounts = { all: allBooks.length };
    for (const b of allBooks) {
      categoryCounts[b.category] = (categoryCounts[b.category] || 0) + 1;
    }

    // กรองตามเงื่อนไข (Category, Search, Condition, Queue Status, Max Price)
    let filtered = allBooks.filter(b => {
      const matchCat = !category || category === 'all' || b.category === category;
      const matchSearch =
        !search ||
        b.title.toLowerCase().includes(search) ||
        (b.enTitle || '').toLowerCase().includes(search) ||
        b.author.toLowerCase().includes(search) ||
        (b.seller_name || '').toLowerCase().includes(search) ||
        (b.categoryName || '').toLowerCase().includes(search);
      const matchCond = !condition || Number(b.conditionPercent || 0) >= condition;
      const matchPrice = !maxPrice || Number(b.salePrice || b.price || 0) <= maxPrice;

      const isSoldOut = b.stock <= 0 || b.stock_status === 'Sold Out';
      const qCount = b.activeQueueCount || 0;
      const isAvailableQueue = !isSoldOut && qCount === 0 && b.stock_status === 'Available';
      const isReservedQueue = !isSoldOut && (qCount > 0 || b.stock_status === 'Reserved');

      let matchStatus = true;
      if (status === 'available') matchStatus = isAvailableQueue;
      else if (status === 'reserved') matchStatus = isReservedQueue;

      return matchCat && matchSearch && matchCond && matchPrice && matchStatus;
    });

    // เรียงลำดับ (กรณีค่าเริ่มต้น popular / latest / recommended ให้ใช้อัลกอริทึม Smart Blended Feed Boost สลับร้านค้าดันฟีดกับผู้ขายทั่วไป)
    if (sort === 'price-asc' || sort === 'price-desc' || sort === 'condition-desc' || sort === 'discount-desc') {
      filtered.sort((a, b) => {
        if (sort === 'price-asc') return a.salePrice - b.salePrice;
        if (sort === 'price-desc') return b.salePrice - a.salePrice;
        if (sort === 'condition-desc') return b.conditionPercent - a.conditionPercent;
        if (sort === 'discount-desc') return b.discountPercent - a.discountPercent;
        return 0;
      });
    } else {
      filtered = blendBooksFeedServer(filtered);
    }

    const totalItems = filtered.length;
    const effectiveLimit = limit > 0 ? limit : totalItems || 12;
    const totalPages = Math.max(1, Math.ceil(totalItems / effectiveLimit));
    const startIndex = limit > 0 ? (page - 1) * limit : 0;
    const paginatedBooks = limit > 0 ? filtered.slice(startIndex, startIndex + limit) : filtered;
    const hasMore = limit > 0 ? startIndex + paginatedBooks.length < totalItems : false;

    const payload = {
      books: paginatedBooks,
      pagination: {
        page,
        limit: effectiveLimit,
        totalItems,
        totalPages,
        hasMore
      },
      categoryCounts
    };

    setInCache(cacheKey, payload);
    res.setHeader('X-Cache', 'MISS');
    return res.json({ ...payload, cacheStatus: 'MISS' });
  } catch (err) {
    return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลหนังสือได้: ' + err.message });
  }
});

app.get('/api/books/:id', (req, res) => {
  try {
    const db = getDb();
    syncReservationQueues(db);
    const rawId = String(req.params.id).replace('bk-', '');
    const bookId = parseInt(rawId, 10);
    const row = db.prepare(`SELECT * FROM Books WHERE id = ? OR code = ?`).get(bookId || -1, req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'ไม่พบหนังสือที่คุณค้นหา' });
    }
    return res.json({ book: formatBookRow(row, db) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// สมาชิกลงประกาศขายหนังสือของตัวเอง (POST /api/books) พร้อมตรวจสอบกฎแบนผู้ขาย 6 เดือน (⚠️⭐x3) + บังคับอัปโหลดรูปภาพ 2-10 รูป + จำนวนเล่ม (stock)
app.post('/api/books', requireAuth, (req, res) => {
  try {
    const db = getDb();

    // ตรวจสอบว่าผู้ใช้นี้ถูกระงับสิทธิ์การลงขายชั่วคราวเป็นเวลา 6 เดือนหรือไม่ (ได้รับดาวเตือน ⚠️⭐ ครบ 3 ดวงในเดือนเดียวกัน)
    const freshUser = db.prepare(`SELECT * FROM Users WHERE id = ?`).get(req.user.id);
    if (freshUser && freshUser.seller_banned_until && new Date(freshUser.seller_banned_until).getTime() > Date.now()) {
      const banDateStr = new Date(freshUser.seller_banned_until).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      return res.status(403).json({
        error: `🔒 บัญชีของคุณอยู่ในสถานะ "ระงับสิทธิ์การลงขายชั่วคราวเป็นเวลา 6 เดือน" (จนถึงวันที่ ${banDateStr}) เนื่องจากได้รับสัญลักษณ์ดาวเตือนส่งของล่าช้า (⚠️⭐) ครบ ${freshUser.strike_count || 3} ดวงภายในเดือนเดียวกัน — คุณยังสามารถใช้งานในฐานะผู้ซื้อ (จองคิวและสั่งซื้อหนังสือ) ได้ตามปกติครับ`,
        code: 'SELLER_BANNED_6_MONTHS',
        seller_banned_until: freshUser.seller_banned_until,
        strike_count: freshUser.strike_count
      });
    }

    const {
      title, en_title, author, publisher, category, category_name,
      original_price, price, shipping_fee, packing_note,
      condition_percent, defect_details, synopsis, images, stock
    } = req.body;

    if (!title || !author || price === undefined || shipping_fee === undefined) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อหนังสือ ผู้แต่ง ราคาขาย และค่าจัดส่งที่ต้องการกำหนด' });
    }

    const uploadedImages = Array.isArray(images) ? images.filter(Boolean) : [];
    if (uploadedImages.length < 2 || uploadedImages.length > 10) {
      return res.status(400).json({
        error: '⚠️ กฎการลงขายหนังสือ: ต้องอัปโหลดรูปภาพขั้นต่ำ 2 รูป (รูปที่ 1: ปกหน้า, รูปที่ 2: ปกหลัง) และสูงสุดไม่เกิน 10 รูป'
      });
    }

    const stockQty = Math.max(1, parseInt(stock || 1, 10) || 1);
    const count = db.prepare(`SELECT COUNT(*) AS cnt FROM Books`).get().cnt + 1;
    const code = `MKT-BK${String(count).padStart(2, '0')}`;
    const condPct = parseInt(condition_percent || 90, 10);
    const condGrade = `สภาพ ${condPct}%`;

    const colorThemes = [
      { bg1: '#0f172a', bg2: '#1e3a8a', accent: '#fbbf24' },
      { bg1: '#14532d', bg2: '#166534', accent: '#fde047' },
      { bg1: '#7f1d1d', bg2: '#b91c1c', accent: '#fef08a' },
      { bg1: '#3b0764', bg2: '#6b21a8', accent: '#fcd34d' }
    ];
    const picked = colorThemes[count % colorThemes.length];
    const images_json = JSON.stringify({
      ...picked,
      badge: category_name || 'ลงขายใหม่',
      angles: ['front', 'spine', 'back', 'inside'],
      images: uploadedImages
    });

    const nowIso = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO Books (
        seller_id, code, title, en_title, author, translator, publisher,
        category, category_name, original_price, price, shipping_fee, packing_note,
        condition_percent, condition_grade, defect_details, images_json,
        stock_status, stock, is_new_arrival, is_best_seller,
        pages, publish_year, isbn, synopsis, created_at
      ) VALUES (?, ?, ?, ?, ?, '-', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available', ?, 1, 0, 260, 2566, '978-616-007-888-9', ?, ?)
    `).run(
      req.user.id,
      code,
      String(title).trim(),
      String(en_title || title).trim(),
      String(author).trim(),
      String(publisher || 'ไม่ระบุสำนักพิมพ์').trim(),
      String(category || 'translated-novel'),
      String(category_name || 'นิยายแปล'),
      Number(original_price || Number(price) * 1.3),
      Number(price),
      Number(shipping_fee),
      String(packing_note || `ผู้ขาย (${req.user.username}) แพ็กและจัดส่งตามเงื่อนไขที่ตกลงกัน`).trim(),
      condPct,
      condGrade,
      String(defect_details || 'ผู้ขายตรวจสอบสภาพเรียบร้อย สามารถขอดูรูปเพิ่มในห้องแชทได้').trim(),
      images_json,
      stockQty,
      String(synopsis || 'หนังสือมือสองลงประกาศขายโดยสมาชิกในตลาดกลาง 007 Book Marketplace').trim(),
      nowIso
    );

    const newBook = formatBookRow(db.prepare(`SELECT * FROM Books WHERE id = ?`).get(Number(result.lastInsertRowid)), db);
    invalidateBookCache();

    return res.status(201).json({
      message: `🎉 ลงประกาศขายหนังสือ "${title}" สำเร็จ! (จำนวน ${stockQty} เล่ม • รูปภาพ ${uploadedImages.length} รูป • ราคา ฿${price})`,
      book: newBook
    });
  } catch (err) {
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลงขายหนังสือ: ' + err.message });
  }
});

// ดึงรายการหนังสือที่ฉันลงขาย (ฝั่งผู้ขาย - My Listings & Sales)
app.get('/api/my-listings', requireAuth, (req, res) => {
  try {
    const db = getDb();
    syncReservationQueues(db);

    const rows = db.prepare(`SELECT * FROM Books WHERE seller_id = ? ORDER BY id DESC`).all(req.user.id);
    const books = rows.map(r => formatBookRow(r, db));

    // ดึงรายการคำสั่งซื้อที่ฉันเป็นผู้ขาย (seller_id = req.user.id)
    const salesOrders = db.prepare(`
      SELECT o.*, u.username AS buyer_name, u.email AS buyer_email
      FROM Orders o
      JOIN Users u ON u.id = o.buyer_id
      WHERE o.seller_id = ?
      ORDER BY o.id DESC
    `).all(req.user.id);

    // ดึงห้องแชททั้งหมดที่เกี่ยวกับหนังสือของฉัน
    const chatRooms = db.prepare(`
      SELECT cr.*, b.title AS book_title, u.username AS buyer_name
      FROM ChatRooms cr
      JOIN Books b ON b.id = cr.book_id
      JOIN Users u ON u.id = cr.buyer_id
      WHERE cr.seller_id = ?
      ORDER BY cr.updated_at DESC
    `).all(req.user.id);

    return res.json({
      books,
      salesOrders,
      chatRooms
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 4. RESERVATIONS & AUTO 3-PARTY CHAT ROOM API
// ============================================================================

app.get('/api/reservations/my', requireAuth, (req, res) => {
  try {
    const db = getDb();
    syncReservationQueues(db);

    const rows = db.prepare(`
      SELECT
        r.id, r.buyer_id, r.seller_id, r.book_id, r.queue_no, r.status, r.expires_at, r.created_at,
        b.code AS book_code, b.title AS book_title, b.author AS book_author,
        b.category_name, b.price AS book_price, b.shipping_fee, b.packing_note, b.original_price,
        b.condition_grade, b.condition_percent, b.defect_details, b.images_json, b.stock_status,
        s.username AS seller_name
      FROM Reservations r
      JOIN Books b ON b.id = r.book_id
      JOIN Users s ON s.id = r.seller_id
      WHERE r.buyer_id = ?
      ORDER BY
        CASE r.status
          WHEN 'Active' THEN 1
          WHEN 'Waiting' THEN 2
          WHEN 'Completed' THEN 3
          WHEN 'Expired' THEN 4
          ELSE 5
        END,
        r.id DESC
    `).all(req.user.id);

    const reservations = rows.map(r => {
      let coverTheme = {};
      try { coverTheme = JSON.parse(r.images_json); } catch (e) {}

      const room = db.prepare(`
        SELECT id, room_code FROM ChatRooms WHERE book_id = ? AND buyer_id = ? LIMIT 1
      `).get(r.book_id, req.user.id);

      const order = db.prepare(`
        SELECT id, order_code, status, tracking_no, payout_status
        FROM Orders
        WHERE book_id = ? AND buyer_id = ?
        ORDER BY id DESC LIMIT 1
      `).get(r.book_id, req.user.id);

      return {
        ...r,
        coverTheme,
        chat_room_id: room ? room.id : null,
        chat_room_code: room ? room.room_code : null,
        existing_order: order || null
      };
    });

    return res.json({
      serverTime: new Date().toISOString(),
      reservations
    });
  } catch (err) {
    return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลคิวจองได้: ' + err.message });
  }
});

// กดจองคิวหนังสือแบบ Atomic Transaction ป้องกันการแย่งกดจองชนกัน (Race Condition Prevention) + Rate Limiter
app.post('/api/reservations', requireAuth, reservationRateLimiter, (req, res) => {
  const db = getDb();
  let inTransaction = false;
  try {
    syncReservationQueues(db);

    const rawBookId = String(req.body.book_id || '').replace('bk-', '');
    const book_id = parseInt(rawBookId, 10);
    if (!book_id) {
      return res.status(400).json({ error: 'กรุณาระบุรหัสหนังสือ (book_id) ที่ต้องการจอง' });
    }

    // เริ่มต้น Atomic Write Transaction (BEGIN IMMEDIATE) ล็อกลำดับคิวทันทีป้องกัน Race Condition 100%
    db.exec('BEGIN IMMEDIATE TRANSACTION;');
    inTransaction = true;

    const book = db.prepare(`SELECT * FROM Books WHERE id = ?`).get(book_id);
    if (!book) {
      db.exec('ROLLBACK;');
      inTransaction = false;
      return res.status(404).json({ error: 'ไม่พบหนังสือเล่มนี้ในระบบ' });
    }
    if (book.stock_status === 'Sold Out' || book.stock <= 0) {
      db.exec('ROLLBACK;');
      inTransaction = false;
      return res.status(400).json({ error: 'ขออภัย หนังสือเล่มนี้จำหน่ายออกไปแล้ว (Sold Out)' });
    }

    // ห้ามผู้ขายกดจองหนังสือที่ตัวเองลงขายเด็ดขาด
    if (book.seller_id === req.user.id) {
      db.exec('ROLLBACK;');
      inTransaction = false;
      return res.status(403).json({
        error: `⚠️ ไม่สามารถกดจองได้: คุณเป็นผู้ลงประกาศขายหนังสือ "${book.title}" เล่มนี้เอง ห้ามผู้ขายกดจองหนังสือของตัวเอง!`,
        code: 'SELF_RESERVATION_BLOCKED'
      });
    }

    // ตรวจสอบการจองซ้ำซ้อน (Unique Index คู่ book_id, buyer_id)
    const existingRow = db.prepare(`
      SELECT id, queue_no, status, expires_at
      FROM Reservations
      WHERE book_id = ? AND buyer_id = ?
      LIMIT 1
    `).get(book_id, req.user.id);

    if (existingRow && (existingRow.status === 'Waiting' || existingRow.status === 'Active')) {
      db.exec('ROLLBACK;');
      inTransaction = false;
      const existingRoom = getOrCreateThreePartyChatRoom(db, book_id, req.user.id, existingRow.id);
      return res.status(409).json({
        error: `⚠️ ระบบบล็อกการจองซ้ำซ้อน: คุณมีคิวจองหนังสือ "${book.title}" อยู่แล้วในลำดับคิวที่ ${existingRow.queue_no} (สถานะ: ${existingRow.status}) ไม่สามารถกดจองซ้ำสองคิวได้!`,
        code: 'DUPLICATE_RESERVATION_BLOCKED',
        existingReservation: existingRow,
        chatRoomId: existingRoom ? existingRoom.id : null
      });
    }

    const currentActive = db.prepare(`
      SELECT id FROM Reservations WHERE book_id = ? AND status = 'Active' LIMIT 1
    `).get(book_id);

    // คำนวณลำดับคิวแบบ Atomic Increment ภายใต้ Transaction Lock
    const maxQueueRow = db.prepare(`
      SELECT COALESCE(MAX(queue_no), 0) AS max_q
      FROM Reservations
      WHERE book_id = ?
    `).get(book_id);

    const nextQueueNo = (maxQueueRow?.max_q || 0) + 1;
    const nowIso = new Date().toISOString();

    let status = 'Waiting';
    let expires_at = null;

    if (!currentActive) {
      status = 'Active';
      expires_at = new Date(Date.now() + FIVE_HOURS_MS).toISOString();
    }

    let reservationId = null;
    if (existingRow) {
      // กรณีเคยจองแต่คิวเก่า Expired ไปแล้ว ให้อัปเดตแถวเดิมขึ้นเป็นลำดับคิวใหม่ภายใต้ Unique Index (book_id, buyer_id)
      db.prepare(`
        UPDATE Reservations
        SET queue_no = ?, status = ?, expires_at = ?, created_at = ?
        WHERE id = ?
      `).run(nextQueueNo, status, expires_at, nowIso, existingRow.id);
      reservationId = existingRow.id;
    } else {
      const insertResult = db.prepare(`
        INSERT INTO Reservations (book_id, buyer_id, seller_id, queue_no, status, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(book_id, req.user.id, book.seller_id, nextQueueNo, status, expires_at, nowIso);
      reservationId = Number(insertResult.lastInsertRowid);
    }

    db.prepare(`UPDATE Books SET stock_status = 'Reserved' WHERE id = ?`).run(book_id);

    db.exec('COMMIT;');
    inTransaction = false;
    invalidateBookCache();

    // สร้างและดึงเข้าห้องแชทสำหรับรายการจองอัตโนมัติ พร้อมบอท AI ตอบกลับทันที
    const chatRoom = getOrCreateThreePartyChatRoom(db, book_id, req.user.id, reservationId);
    const createdRes = db.prepare(`SELECT * FROM Reservations WHERE id = ?`).get(reservationId);

    return res.status(201).json({
      message: status === 'Active'
        ? `🎉 จองสำเร็จ! คุณได้คิวที่ ${nextQueueNo} (สถานะ Active - มีเวลาโอนเข้าบัญชีกลาง 5 ชั่วโมง) ระบบกำลังเปิดห้องแชทรายการจองอัตโนมัติ...`
        : `⏳ เข้าคิวจองสำเร็จ! คุณได้คิวที่ ${nextQueueNo} (สถานะ Waiting) ระบบกำลังเปิดห้องแชทรายการจองอัตโนมัติ...`,
      reservation: createdRes,
      chatRoom
    });
  } catch (err) {
    if (inTransaction) {
      try { db.exec('ROLLBACK;'); } catch (e) {}
    }
    if (String(err.message).includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        error: '⚠️ ระบบป้องกันการจองชนกัน (Atomic Lock): คุณมีคิวจองหนังสือเล่มนี้อยู่แล้ว หรือกำลังประมวลผลคิว กรุณาลองใหม่อีกครั้ง',
        code: 'ATOMIC_UNIQUE_CONSTRAINT'
      });
    }
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการจองคิว: ' + err.message });
  }
});

// จำลองให้เวลาคิว Active หมดอายุ 5 ชั่วโมงทันที เพื่อดูการเลื่อนคิวถัดไป
app.post('/api/reservations/:id/simulate-expire', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const reservationId = parseInt(req.params.id, 10);
    const row = db.prepare(`SELECT * FROM Reservations WHERE id = ?`).get(reservationId);

    if (!row) {
      return res.status(404).json({ error: 'ไม่พบรายการคิวจองนี้' });
    }

    const pastIso = new Date(Date.now() - 1000).toISOString();
    db.prepare(`UPDATE Reservations SET expires_at = ?, status = 'Active' WHERE id = ?`).run(pastIso, reservationId);

    syncReservationQueues(db);
    invalidateBookCache();

    const nextActive = db.prepare(`
      SELECT r.*, u.username FROM Reservations r
      JOIN Users u ON u.id = r.buyer_id
      WHERE r.book_id = ? AND r.status = 'Active'
    `).get(row.book_id);

    return res.json({
      message: nextActive
        ? `⏰ ครบกำหนด 5 ชั่วโมง! คิวที่ ${row.queue_no} เปลี่ยนเป็น 'Expired' และเลื่อนคิวถัดไป (คิวที่ ${nextActive.queue_no} ของ ${nextActive.username}) ขึ้นมาเป็น 'Active' พร้อมตั้งเวลาใหม่ 5 ชั่วโมงแล้ว!`
        : `⏰ ครบกำหนด 5 ชั่วโมง! คิวที่ ${row.queue_no} เปลี่ยนเป็น 'Expired' และหนังสือกลับสู่สถานะพร้อมจำหน่าย (Available)`,
      promotedQueue: nextActive || null
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 5. 3-PARTY CHAT ROOM & AI ASSISTANT AUTO-REPLY API
// ============================================================================

// เปิดห้องแชท 3 ฝ่ายสำหรับหนังสือเล่มนั้น (ทั้งกรณีจองแล้วและทักสอบถามก่อนจอง)
app.post('/api/chat/open', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const rawBookId = String(req.body.book_id || '').replace('bk-', '');
    const book_id = parseInt(rawBookId, 10);
    const buyer_id = req.body.buyer_id ? parseInt(req.body.buyer_id, 10) : req.user.id;

    const book = db.prepare(`SELECT * FROM Books WHERE id = ?`).get(book_id);
    if (!book) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลหนังสือ' });
    }

    // หากผู้ขายกดเปิดแชทจากหน้าหนังสือตัวเอง ให้เปิดห้องแชทล่าสุดของหนังสือนั้น
    let targetBuyerId = buyer_id;
    if (req.user.id === book.seller_id && !req.body.buyer_id) {
      const existingRoom = db.prepare(`SELECT buyer_id FROM ChatRooms WHERE book_id = ? ORDER BY updated_at DESC LIMIT 1`).get(book_id);
      if (existingRoom) {
        targetBuyerId = existingRoom.buyer_id;
      } else {
        return res.status(400).json({ error: 'ยังไม่มีผู้ซื้อทักแชทสำหรับหนังสือเล่มนี้' });
      }
    }

    const room = getOrCreateThreePartyChatRoom(db, book_id, targetBuyerId);
    return res.json({ room });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ดึงรายการห้องแชททั้งหมดที่ผู้ใช้เกี่ยวข้อง (หรือทั้งหมดสำหรับ Admin)
app.get('/api/chat/rooms', requireAuth, (req, res) => {
  try {
    const db = getDb();
    let rooms = [];
    if (req.user.role === 'Admin') {
      rooms = db.prepare(`
        SELECT cr.*, b.title AS book_title, b.code AS book_code, b.price AS book_price, b.shipping_fee,
               bu.username AS buyer_name, se.username AS seller_name
        FROM ChatRooms cr
        JOIN Books b ON b.id = cr.book_id
        JOIN Users bu ON bu.id = cr.buyer_id
        JOIN Users se ON se.id = cr.seller_id
        ORDER BY cr.updated_at DESC
      `).all();
    } else {
      rooms = db.prepare(`
        SELECT cr.*, b.title AS book_title, b.code AS book_code, b.price AS book_price, b.shipping_fee,
               bu.username AS buyer_name, se.username AS seller_name
        FROM ChatRooms cr
        JOIN Books b ON b.id = cr.book_id
        JOIN Users bu ON bu.id = cr.buyer_id
        JOIN Users se ON se.id = cr.seller_id
        WHERE cr.buyer_id = ? OR cr.seller_id = ?
        ORDER BY cr.updated_at DESC
      `).all(req.user.id, req.user.id);
    }
    return res.json({ rooms });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ดึงรายละเอียดห้องแชท 3 ฝ่าย + ข้อความทั้งหมด
app.get('/api/chat/rooms/:roomId', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const roomId = parseInt(req.params.roomId, 10);
    const room = db.prepare(`
      SELECT cr.*,
             b.title AS book_title, b.code AS book_code, b.price AS book_price, b.shipping_fee,
             b.packing_note, b.condition_grade, b.defect_details,
             bu.username AS buyer_name, bu.email AS buyer_email,
             se.username AS seller_name, se.email AS seller_email,
             ad.username AS admin_name, ad.bank_name AS escrow_bank, ad.bank_account_no AS escrow_acc_no, ad.bank_account_name AS escrow_acc_name
      FROM ChatRooms cr
      JOIN Books b ON b.id = cr.book_id
      JOIN Users bu ON bu.id = cr.buyer_id
      JOIN Users se ON se.id = cr.seller_id
      JOIN Users ad ON ad.id = cr.admin_id
      WHERE cr.id = ?
    `).get(roomId);

    if (!room) {
      return res.status(404).json({ error: 'ไม่พบห้องแชทนี้' });
    }

    // ตรวจสอบสิทธิ์ว่าอยู่ในรายการนี้หรือไม่ (Buyer, Seller, หรือ Admin)
    if (req.user.role !== 'Admin' && req.user.id !== room.buyer_id && req.user.id !== room.seller_id) {
      return res.status(403).json({ error: 'คุณไม่ได้เป็นคู่สัญญาในห้องแชทรายการนี้' });
    }

    const reservation = db.prepare(`
      SELECT * FROM Reservations WHERE book_id = ? AND buyer_id = ? ORDER BY id DESC LIMIT 1
    `).get(room.book_id, room.buyer_id);

    const order = db.prepare(`
      SELECT * FROM Orders WHERE book_id = ? AND buyer_id = ? ORDER BY id DESC LIMIT 1
    `).get(room.book_id, room.buyer_id);

    const messages = db.prepare(`
      SELECT * FROM ChatMessages WHERE room_id = ? ORDER BY id ASC
    `).all(roomId);

    return res.json({
      room,
      reservation: reservation || null,
      order: order || null,
      messages
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ส่งข้อความเข้าห้องแชทรายการจอง + Rate Limiter ป้องกันสแปมแชท + บอท AI ตอบกลับเบื้องต้นอัตโนมัติ
app.post('/api/chat/rooms/:roomId/messages', requireAuth, chatMessageRateLimiter, (req, res) => {
  try {
    const db = getDb();
    const roomId = parseInt(req.params.roomId, 10);
    const { message, attachment_note } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'กรุณาพิมพ์ข้อความ' });
    }

    const room = db.prepare(`SELECT * FROM ChatRooms WHERE id = ?`).get(roomId);
    if (!room) {
      return res.status(404).json({ error: 'ไม่พบห้องแชทนี้' });
    }

    let senderRole = 'Buyer';
    if (req.user.role === 'Admin') {
      senderRole = 'Admin';
    } else if (req.user.id === room.seller_id) {
      senderRole = 'Seller';
    }

    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO ChatMessages (room_id, sender_id, sender_role, sender_name, message, attachment_note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(roomId, req.user.id, senderRole, req.user.username, String(message).trim(), String(attachment_note || ''), nowIso);

    // ข้อ 4: เมื่อผู้ซื้อทักแชทเข้ามา ให้บอท AI ของแพลตฟอร์มตอบกลับเบื้องต้นอัตโนมัติทันที
    if (senderRole === 'Buyer') {
      const book = db.prepare(`SELECT * FROM Books WHERE id = ?`).get(room.book_id);
      const seller = db.prepare(`SELECT * FROM Users WHERE id = ?`).get(room.seller_id);
      const buyer = db.prepare(`SELECT * FROM Users WHERE id = ?`).get(room.buyer_id);
      const queueInfo = db.prepare(`
        SELECT * FROM Reservations WHERE book_id = ? AND buyer_id = ? ORDER BY id DESC LIMIT 1
      `).get(room.book_id, room.buyer_id);

      const aiReply = buildAIAutoReply(book, seller, buyer, queueInfo, String(message));
      db.prepare(`
        INSERT INTO ChatMessages (room_id, sender_id, sender_role, sender_name, message, attachment_note, created_at)
        VALUES (?, NULL, 'AI_Bot', '🤖 AI Assistant (บอทตัวกลาง 007)', ?, '', ?)
      `).run(roomId, aiReply, new Date(Date.now() + 200).toISOString());
    }

    db.prepare(`UPDATE ChatRooms SET updated_at = ? WHERE id = ?`).run(nowIso, roomId);

    const messages = db.prepare(`SELECT * FROM ChatMessages WHERE room_id = ? ORDER BY id ASC`).all(roomId);
    return res.status(201).json({ messages });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 6. ESCROW PAYMENT & 4-STEP ORDER FLOW API (แอดมินเป็นตัวกลางพักเงิน)
// ============================================================================

// ดึงประวัติคำสั่งซื้อของสมาชิก (ทั้งรายการที่ซื้อและรายการที่ขาย)
app.get('/api/orders/my', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const buyOrders = db.prepare(`
      SELECT o.*, se.username AS seller_name, b.code AS book_code, b.condition_grade, b.packing_note
      FROM Orders o
      JOIN Users se ON se.id = o.seller_id
      JOIN Books b ON b.id = o.book_id
      WHERE o.buyer_id = ?
      ORDER BY o.id DESC
    `).all(req.user.id);

    const sellOrders = db.prepare(`
      SELECT o.*, bu.username AS buyer_name, b.code AS book_code, b.condition_grade
      FROM Orders o
      JOIN Users bu ON bu.id = o.buyer_id
      JOIN Books b ON b.id = o.book_id
      WHERE o.seller_id = ?
      ORDER BY o.id DESC
    `).all(req.user.id);

    return res.json({ buyOrders, sellOrders });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ขั้นที่ 1 (Pending Payment): ผู้ซื้อโอนเงินเข้า 'บัญชีกลางของแอดมิน' พร้อมแนบสลิป
app.post('/api/escrow/step1-pay', requireAuth, (req, res) => {
  try {
    const db = getDb();
    syncReservationQueues(db);

    const { reservation_id, book_id, slip_reference, recipient_name, recipient_phone, shipping_address } = req.body;

    let targetBookId = book_id ? parseInt(String(book_id).replace('bk-', ''), 10) : null;
    let reservation = null;

    if (reservation_id) {
      reservation = db.prepare(`SELECT * FROM Reservations WHERE id = ? AND buyer_id = ?`).get(parseInt(reservation_id, 10), req.user.id);
      if (!reservation) {
        return res.status(404).json({ error: 'ไม่พบคิวจองนี้ของคุณ' });
      }
      if (reservation.status !== 'Active') {
        return res.status(400).json({ error: `คิวของคุณอยู่ในสถานะ '${reservation.status}' (ต้องรอให้ถึงคิว Active ก่อนจึงจะโอนเงินได้)` });
      }
      targetBookId = reservation.book_id;
    }

    const book = db.prepare(`SELECT * FROM Books WHERE id = ?`).get(targetBookId);
    if (!book) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลหนังสือ' });
    }
    if (book.seller_id === req.user.id) {
      return res.status(400).json({ error: 'ผู้ขายไม่สามารถสั่งซื้อหนังสือของตัวเองได้' });
    }

    const book_price = Number(book.price);
    const shipping_fee = Number(book.shipping_fee); // ค่าจัดส่งตามที่ผู้ขายแต่ละรายกำหนดเอง
    const platform_fee = calculateEscrowFee(book_price); // ค่าธรรมเนียมระบบ 5฿ + 5% ของราคาหนังสือ (สูงสุดไม่เกิน 30฿/เล่ม)
    const total_amount = book_price + shipping_fee + platform_fee; // ยอดโอนสุทธิของผู้ซื้อ
    const seller_payout = book_price + shipping_fee; // ยอดโอนให้ผู้ขาย (ราคาหนังสือ + ค่าจัดส่ง)

    const order_code = 'ESC-007' + Math.floor(1000 + Math.random() * 9000);
    const nowIso = new Date().toISOString();
    const slipText = String(slip_reference || `SLIP-PROMPTPAY-${Date.now().toString().slice(-6)} (โอนเข้าบัญชีกลางแอดมิน ฿${total_amount})`).trim();

    const insertOrder = db.prepare(`
      INSERT INTO Orders (
        order_code, book_id, reservation_id, buyer_id, seller_id,
        book_title, book_price, shipping_fee, total_amount, platform_fee, seller_payout,
        status, slip_reference, tracking_no,
        recipient_name, recipient_phone, shipping_address, payout_status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Payment', ?, '', ?, ?, ?, 'Holding in Escrow', ?, ?)
    `).run(
      order_code,
      book.id,
      reservation ? reservation.id : null,
      req.user.id,
      book.seller_id,
      book.title,
      book_price,
      shipping_fee,
      total_amount,
      platform_fee,
      seller_payout,
      slipText,
      String(recipient_name || req.user.username).trim(),
      String(recipient_phone || req.user.phone_number).trim(),
      String(shipping_address || 'จัดส่งตามที่อยู่ที่แจ้งในระบบ').trim(),
      nowIso,
      nowIso
    );

    if (reservation) {
      db.prepare(`UPDATE Reservations SET status = 'Completed' WHERE id = ?`).run(reservation.id);
    }
    db.prepare(`UPDATE Books SET stock_status = 'Reserved' WHERE id = ?`).run(book.id);

    // แจ้งเตือนลงในห้องแชทรายการจองอัตโนมัติ
    const room = getOrCreateThreePartyChatRoom(db, book.id, req.user.id, reservation ? reservation.id : null);
    if (room) {
      db.prepare(`
        INSERT INTO ChatMessages (room_id, sender_id, sender_role, sender_name, message, attachment_note, created_at)
        VALUES (?, ?, 'Buyer', ?, ?, ?, ?)
      `).run(
        room.id,
        req.user.id,
        req.user.username,
        `💳 [ขั้นที่ 1 - แจ้งโอนเงินเข้าบัญชีกลาง] โอนเงินยอดสุทธิ ฿${total_amount} (ค่าหนังสือ ฿${book_price} + ค่าส่ง ฿${shipping_fee} + ค่าดูแลบัญชีกลาง ฿${platform_fee}) เข้าบัญชีกลางเรียบร้อยแล้ว รหัสคำสั่งซื้อ #${order_code}`,
        slipText,
        nowIso
      );

      db.prepare(`
        INSERT INTO ChatMessages (room_id, sender_id, sender_role, sender_name, message, attachment_note, created_at)
        VALUES (?, NULL, 'AI_Bot', '🤖 AI Assistant (บอทดูแลรายการ)', ?, '', ?)
      `).run(
        room.id,
        `✅ ระบบได้รับหลักฐานการโอนเงินเข้าบัญชีกลางสำหรับบิล #${order_code} แล้ว! สถานะปัจจุบัน: "ขั้นที่ 1: Pending Payment" — ระบบได้แจ้งเตือนแอดมินให้ตรวจสอบยอดเงินและกดยืนยันรับเงินเข้าบัญชีกลาง (ขั้นที่ 2) แล้วครับ`,
        nowIso
      );
    }

    return res.status(201).json({
      message: `แจ้งโอนเงินเข้าบัญชีกลางแอดมินสำเร็จ! (รหัสบิล #${order_code} สถานะ: ขั้นที่ 1 Pending Payment — รอแอดมินกดยืนยันยอดเงิน)`,
      orderId: Number(insertOrder.lastInsertRowid),
      orderCode: order_code
    });
  } catch (err) {
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการแจ้งชำระเงิน: ' + err.message });
  }
});

// ขั้นที่ 2 (Paid - Awaiting Shipment): แอดมินตรวจสอบยอดเงินและกดยืนยันรับเงินเข้าบัญชีกลาง + ตั้งเวลา shipping_deadline 48 ชม. (2 วัน) ให้ผู้ขายจัดส่งหนังสือ
app.put('/api/escrow/step2-admin-verify/:orderId', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const orderId = parseInt(req.params.orderId, 10);
    const order = db.prepare(`SELECT * FROM Orders WHERE id = ?`).get(orderId);
    if (!order) {
      return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อนี้' });
    }

    const nowIso = new Date().toISOString();
    const shippingDeadlineIso = new Date(Date.now() + FORTY_EIGHT_HOURS_MS).toISOString(); // บวกเพิ่ม 48 ชั่วโมง (2 วัน) โดยอัตโนมัติ

    db.prepare(`
      UPDATE Orders
      SET status = 'Paid - Awaiting Shipment',
          payout_status = 'Holding in Escrow',
          shipping_deadline = ?,
          updated_at = ?
      WHERE id = ?
    `).run(shippingDeadlineIso, nowIso, orderId);
    invalidateBookCache();

    // แจ้งลงห้องแชทรายการจองให้ผู้ขายส่งหนังสือภายใน 48 ชั่วโมง (AI Chatbot ขั้นตอนที่ 3/6)
    const room = getOrCreateThreePartyChatRoom(db, order.book_id, order.buyer_id);
    if (room) {
      db.prepare(`
        INSERT INTO ChatMessages (room_id, sender_id, sender_role, sender_name, message, attachment_note, created_at)
        VALUES (?, ?, 'Admin', ?, ?, '', ?)
      `).run(
        room.id,
        req.user.id,
        req.user.username,
        `🛡️ [ขั้นที่ 2 - แอดมินยืนยันรับเงินเข้าบัญชีกลางแล้ว] บิล #${order.order_code} แอดมินตรวจสอบยอดเงิน ฿${order.total_amount} และพักเงินไว้ในบัญชีกลางเรียบร้อยแล้ว!`,
        nowIso
      );

      db.prepare(`
        INSERT INTO ChatMessages (room_id, sender_id, sender_role, sender_name, message, attachment_note, created_at)
        VALUES (?, NULL, 'AI_Bot', '🤖 AI Chatbot (ดูแลการซื้อขายครบวงจร)', ?, '', ?)
      `).run(
        room.id,
        `⏰ [AI Chatbot ขั้นตอนที่ 3/6 — แจ้งเตือนผู้ขายให้ส่งของภายใน 1-2 วัน (48 ชม.)]:\n` +
        `• ขอให้ผู้ขายจัดส่งหนังสือและกรอกเลขพัสดุ (tracking_no) ภายใน 48 ชั่วโมง\n` +
        `• ⚠️ กฎติดดาวเตือนผู้ขาย (Seller Strike ⚠️⭐): หากผู้ขายไม่ส่งของภายใน 48 ชม. ระบบจะบันทึกดาวเตือนความผิดพลาด ⚠️⭐ 1 ดวงที่โปรไฟล์ทันที และหากสะสมครบ 3 ดวงภายในเดือนเดียวกัน จะถูกระงับสิทธิ์การลงขายชั่วคราวเป็นเวลา 6 เดือนอัตโนมัติครับ!`,
        new Date(Date.now() + 200).toISOString()
      );
    }

    return res.json({
      message: `ยืนยันรับเงินเข้าบัญชีกลางสำเร็จ! บิล #${order.order_code} เปลี่ยนเป็นขั้นที่ 2 (Paid - Awaiting Shipment) พร้อมตั้งเวลาให้ผู้ขายจัดส่งภายใน 48 ชั่วโมง`,
      shipping_deadline: shippingDeadlineIso
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// จำลองให้เวลาจัดส่ง 48 ชั่วโมงของผู้ขายหมดเวลาทันที + ติดดาวเตือน ⚠️⭐ ให้ผู้ขายอัตโนมัติ (หากครบ 3 ดวงในเดือนเดียว แบนสิทธิ์ขาย 6 เดือนทันที)
app.post('/api/escrow/simulate-shipping-overdue/:orderId', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const orderId = parseInt(req.params.orderId, 10);
    const order = db.prepare(`SELECT * FROM Orders WHERE id = ?`).get(orderId);
    if (!order) {
      return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อนี้' });
    }

    const pastDeadlineIso = new Date(Date.now() - 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    let strikeResult = null;
    if (!order.strike_recorded) {
      strikeResult = recordSellerStrike(db, order.seller_id);
    }

    db.prepare(`
      UPDATE Orders
      SET shipping_deadline = ?, status = 'Paid - Awaiting Shipment', strike_recorded = 1, updated_at = ?
      WHERE id = ?
    `).run(pastDeadlineIso, nowIso, orderId);
    invalidateBookCache();

    const sellerUser = db.prepare(`SELECT * FROM Users WHERE id = ?`).get(order.seller_id);
    const strikeCount = sellerUser ? Number(sellerUser.strike_count || 1) : 1;
    const isBanned = sellerUser && sellerUser.seller_banned_until && new Date(sellerUser.seller_banned_until).getTime() > Date.now();
    const banText = isBanned
      ? `\n🔒 [แบนสิทธิ์การขายอัตโนมัติ 6 เดือน]: เนื่องจากผู้ขาย (${sellerUser.username}) ได้รับดาวเตือน ⚠️⭐ ครบ ${strikeCount} ดวงภายในเดือนเดียวกัน ระบบได้เปลี่ยนสถานะเป็น "ระงับสิทธิ์การลงขายชั่วคราวเป็นเวลา 6 เดือน" ทันที!`
      : `\n⚠️ [บันทึกดาวเตือนผู้ขาย]: ระบบได้ติดสัญลักษณ์ดาวเตือนความผิดพลาด (⚠️⭐ สะสม ${strikeCount}/3 ดวงในเดือนนี้) ไว้ที่โปรไฟล์ของผู้ขาย (${sellerUser ? sellerUser.username : 'ผู้ขาย'}) เรียบร้อยแล้ว`;

    const room = getOrCreateThreePartyChatRoom(db, order.book_id, order.buyer_id);
    if (room) {
      db.prepare(`
        INSERT INTO ChatMessages (room_id, sender_id, sender_role, sender_name, message, attachment_note, created_at)
        VALUES (?, NULL, 'AI_Bot', '🤖 AI Chatbot (ดูแลการซื้อขายครบวงจร)', ?, '', ?)
      `).run(
        room.id,
        `🚨 [แจ้งเตือนแอดมินส่วนกลาง - ผู้ขายไม่ส่งของภายใน 48 ชม.]: บิล #${order.order_code} เลยกำหนดเวลาจัดส่ง 48 ชั่วโมง (shipping_deadline) โดยที่ผู้ขายยังไม่ได้กรอกเลขพัสดุ!${banText}\n👉 ผู้ซื้อหรือแอดมินสามารถกดยกเลิกรายการและรับเงินคืนเต็มจำนวน (฿${order.total_amount}) ได้ทันทีครับ!`,
        nowIso
      );
    }

    return res.json({
      message: `⏰ จำลองครบกำหนด 48 ชม. สำหรับบิล #${order.order_code} แล้ว! ระบบติดสัญลักษณ์ดาวเตือน ⚠️⭐ ให้ผู้ขาย (สะสม ${strikeCount}/3 ดวง)${isBanned ? ' และระงับสิทธิ์การขาย 6 เดือนอัตโนมัติ!' : ''}`,
      strikeResult: strikeResult || sanitizeUserRow(sellerUser)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// กรณีผู้ขายไม่กรอกเลขพัสดุภายใน 48 ชั่วโมง: แอดมิน (หรือผู้ซื้อเมื่อเลยกำหนด 48 ชม.) กดยกเลิกรายการและคืนเงินให้ผู้ซื้อเต็มจำนวนทันที + ติดดาวเตือน ⚠️⭐
app.put('/api/escrow/admin-cancel-overdue/:orderId', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const orderId = parseInt(req.params.orderId, 10);
    const order = db.prepare(`SELECT * FROM Orders WHERE id = ?`).get(orderId);
    if (!order) {
      return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อนี้' });
    }

    if (req.user.role !== 'Admin' && req.user.id !== order.buyer_id) {
      return res.status(403).json({ error: 'เฉพาะแอดมินส่วนกลางหรือผู้ซื้อของรายการนี้เท่านั้นที่สามารถขอยกเลิกและรับเงินคืนได้' });
    }

    if (!order.strike_recorded) {
      recordSellerStrike(db, order.seller_id);
    }

    const nowIso = new Date().toISOString();
    const cancelReason = 'ผู้ขายไม่จัดส่งหนังสือและไม่แจ้งเลขพัสดุภายในเวลา 48 ชั่วโมง (1-2 วัน) ตามกติกาบัญชีกลาง (ติดดาวเตือน ⚠️⭐)';

    db.prepare(`
      UPDATE Orders
      SET status = 'Cancelled - Refunded',
          payout_status = 'Refunded to Buyer (Seller Overdue 48h)',
          dispute_reason = ?,
          strike_recorded = 1,
          updated_at = ?
      WHERE id = ?
    `).run(cancelReason, nowIso, orderId);

    // คืนสถานะหนังสือกลับเป็น Available
    db.prepare(`UPDATE Books SET stock_status = 'Available', stock = 1 WHERE id = ?`).run(order.book_id);
    invalidateBookCache();

    const sellerUser = db.prepare(`SELECT * FROM Users WHERE id = ?`).get(order.seller_id);
    const strikeCount = sellerUser ? Number(sellerUser.strike_count || 1) : 1;

    const room = getOrCreateThreePartyChatRoom(db, order.book_id, order.buyer_id);
    if (room) {
      db.prepare(`
        INSERT INTO ChatMessages (room_id, sender_id, sender_role, sender_name, message, attachment_note, created_at)
        VALUES (?, ?, ?, ?, ?, '', ?)
      `).run(
        room.id,
        req.user.id,
        req.user.role === 'Admin' ? 'Admin' : 'Buyer',
        req.user.username,
        `🚫 [ยกเลิกรายการ & คืนเงินเต็มจำนวน - ผู้ขายไม่ส่งของภายใน 48 ชม.] บิล #${order.order_code}\n• เนื่องจากผู้ขายไม่กรอกเลขพัสดุภายในเวลา 48 ชั่วโมง แอดมินส่วนกลางจึงดำเนินการยกเลิกรายการและโอนเงินคืนให้ผู้ซื้อเต็มจำนวน ฿${order.total_amount} เรียบร้อยแล้ว\n• บันทึกสัญลักษณ์ดาวเตือน ⚠️⭐ ที่โปรไฟล์ผู้ขาย (สะสม ${strikeCount}/3 ดวงในเดือนนี้) ครับ`,
        nowIso
      );
    }

    return res.json({
      message: `🚫 ยกเลิกรายการ #${order.order_code} และโอนเงินคืนให้ผู้ซื้อเต็มจำนวน (฿${order.total_amount}) เรียบร้อยแล้ว พร้อมบันทึกดาวเตือน ⚠️⭐ ให้ผู้ขาย (สะสม ${strikeCount}/3 ดวง)`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ขั้นที่ 3 (Shipped): ผู้ขายส่งของและกรอกเลขพัสดุ (tracking_no) ลูกค้ามีเวลาตรวจสอบสินค้าภายใน 24 ชม. หลังจากได้รับหนังสือ
app.put('/api/escrow/step3-seller-ship/:orderId', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const orderId = parseInt(req.params.orderId, 10);
    const { tracking_no } = req.body;

    if (!tracking_no || !String(tracking_no).trim()) {
      return res.status(400).json({ error: 'กรุณากรอกหมายเลขติดตามพัสดุ (tracking_no)' });
    }

    const order = db.prepare(`SELECT * FROM Orders WHERE id = ?`).get(orderId);
    if (!order) {
      return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อนี้' });
    }

    if (req.user.role !== 'Admin' && req.user.id !== order.seller_id) {
      return res.status(403).json({ error: 'เฉพาะผู้ขายเจ้าของหนังสือหรือแอดมินเท่านั้นที่กรอกเลขพัสดุของรายการนี้ได้' });
    }

    const nowIso = new Date().toISOString();
    const cleanTrack = String(tracking_no).trim();
    const inspectionExpiresIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      UPDATE Orders SET status = 'Shipped', tracking_no = ?, inspection_expires_at = ?, updated_at = ? WHERE id = ?
    `).run(cleanTrack, inspectionExpiresIso, nowIso, orderId);

    const curBook = db.prepare(`SELECT stock FROM Books WHERE id = ?`).get(order.book_id);
    const nextStock = Math.max(0, Number(curBook?.stock || 1) - 1);
    db.prepare(`
      UPDATE Books SET stock = ?, stock_status = ? WHERE id = ?
    `).run(nextStock, nextStock <= 0 ? 'Sold Out' : 'Available', order.book_id);
    invalidateBookCache();

    const room = getOrCreateThreePartyChatRoom(db, order.book_id, order.buyer_id);
    if (room) {
      db.prepare(`
        INSERT INTO ChatMessages (room_id, sender_id, sender_role, sender_name, message, attachment_note, created_at)
        VALUES (?, ?, 'Seller', ?, ?, '', ?)
      `).run(
        room.id,
        req.user.id,
        req.user.username,
        `🚚 [ขั้นที่ 3 - ผู้ขายจัดส่งหนังสือแล้ว] บิล #${order.order_code} หมายเลขพัสดุ: ${cleanTrack}`,
        nowIso
      );

      db.prepare(`
        INSERT INTO ChatMessages (room_id, sender_id, sender_role, sender_name, message, attachment_note, created_at)
        VALUES (?, NULL, 'AI_Bot', '🤖 AI Chatbot (ดูแลการซื้อขายครบวงจร)', ?, '', ?)
      `).run(
        room.id,
        `📦 [AI Chatbot ขั้นตอนที่ 4/6 & 5/6 — แจ้งเลขพัสดุ & การตรวจรับสินค้า]:\n` +
        `• ผู้ขายได้จัดส่งหนังสือแล้ว! เลขพัสดุของคุณคือ: ${cleanTrack}\n` +
        `• [ขั้นตอนที่ 5/6]: เมื่อได้รับหนังสือแล้ว กรุณาตรวจสอบสภาพภายใน 24 ชั่วโมง:\n` +
        `  1) หากหนังสือตรงปกเรียบร้อย ให้กดปุ่ม "✅ ยืนยันรับของ & ให้แอดมินโอนเงินให้ผู้ขาย"\n` +
        `  2) หากพบปัญหา (สภาพไม่ตรงปก / หน้าขาดเสียหาย / ได้รับหนังสือผิดเล่ม) ให้กดปุ่ม "🔄 แจ้งปัญหา / ขอคืนสินค้า (Request Return / Call Admin)" ในห้องแชทนี้เพื่อแนบรูปหลักฐานและระงับการโอนเงินทันทีครับ!`,
        new Date(Date.now() + 200).toISOString()
      );
    }

    return res.json({
      message: `บันทึกเลขพัสดุ (${cleanTrack}) สำเร็จ! AI Chatbot ได้แจ้งเลขพัสดุและขั้นตอนตรวจรับสินค้าให้ผู้ซื้อในห้องแชทแล้ว`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ปุ่ม '🔄 แจ้งปัญหา / ขอคืนสินค้า (Request Return / Call Admin)' ทั้งจากหน้ารายการคำสั่งซื้อและในห้องแชท:
// รองรับเลือกเหตุผล (สภาพหนังสือไม่ตรงปก / หน้าขาดเสียหาย / ได้รับหนังสือผิดเล่ม) + แนบรูปหลักฐาน + ระงับการโอนเงินชั่วคราว (Freeze Escrow) + แจ้งเตือนด่วนไปยัง Admin Dashboard
app.post('/api/escrow/dispute-return/:orderId', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const orderId = parseInt(req.params.orderId, 10);
    const { dispute_category, dispute_reason, dispute_evidence_image, return_shipping_fee } = req.body;

    const order = db.prepare(`SELECT * FROM Orders WHERE id = ?`).get(orderId);
    if (!order) {
      return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อนี้' });
    }
    if (req.user.role !== 'Admin' && req.user.id !== order.buyer_id) {
      return res.status(403).json({ error: 'เฉพาะผู้ซื้อหรือแอดมินเท่านั้นที่สามารถแจ้งปัญหา/ขอคืนสินค้าได้' });
    }

    const nowIso = new Date().toISOString();
    const categoryText = String(dispute_category || 'สภาพหนังสือไม่ตรงปก').trim();
    const detailText = String(dispute_reason || '').trim();
    const fullReason = detailText ? `[${categoryText}] ${detailText}` : `[${categoryText}] แจ้งขอคืนสินค้าและเรียกแอดมินตรวจสอบ`;
    const evidenceImg = String(dispute_evidence_image || '').trim();
    const returnFee = Number(return_shipping_fee || order.shipping_fee || 40);

    db.prepare(`
      UPDATE Orders
      SET status = 'Disputed - Return Requested',
          payout_status = 'Frozen - Dispute Pending Admin',
          escrow_frozen = 1,
          dispute_category = ?,
          dispute_reason = ?,
          dispute_evidence_image = ?,
          return_shipping_fee = ?,
          updated_at = ?
      WHERE id = ?
    `).run(categoryText, fullReason, evidenceImg, returnFee, nowIso, orderId);

    const room = getOrCreateThreePartyChatRoom(db, order.book_id, order.buyer_id);
    if (room) {
      db.prepare(`
        INSERT INTO ChatMessages (room_id, sender_id, sender_role, sender_name, message, attachment_note, created_at)
        VALUES (?, ?, 'Buyer', ?, ?, ?, ?)
      `).run(
        room.id,
        req.user.id,
        req.user.username,
        `🔄 [แจ้งปัญหา / ขอคืนสินค้า - เรียกแอดมินตรวจสอบ] บิล #${order.order_code}\n• หัวข้อปัญหา: ${categoryText}\n• รายละเอียด: "${detailText || categoryText}"\n• แนบรูปภาพหลักฐานเพื่อขอให้แอดมินระงับการโอนเงินและอนุมัติคืนเงินเต็มจำนวนครับ`,
        evidenceImg || 'แนบรูปหลักฐานสภาพสินค้าในระบบแล้ว',
        nowIso
      );

      db.prepare(`
        INSERT INTO ChatMessages (room_id, sender_id, sender_role, sender_name, message, attachment_note, created_at)
        VALUES (?, NULL, 'AI_Bot', '🤖 AI Chatbot (บอทดูแลการซื้อขาย & ระงับข้อพิพาท)', ?, '', ?)
      `).run(
        room.id,
        `🚨 [AI Chatbot รับเรื่องแจ้งปัญหา & ระงับการโอนเงินชั่วคราว (Escrow Frozen)]:\n` +
        `• บอทได้รับแจ้งปัญหา "${categoryText}" พร้อมรูปหลักฐานสำหรับบิล #${order.order_code} เรียบร้อยแล้ว!\n` +
        `• ❄️ สถานะบัญชีกลาง: ระงับการโอนเงินให้ผู้ขายชั่วคราว (Frozen - Dispute Pending Admin) ยอดเงิน ฿${order.total_amount} ถูกคุ้มครองไว้ในบัญชีกลางอย่างปลอดภัย 100%\n` +
        `• 🔔 ระบบได้ส่ง "แจ้งเตือนด่วน (Urgent Dispute Alert)" ไปยังหน้า Admin Dashboard แล้ว แอดมินกำลังเข้ามาตรวจสอบหลักฐานในห้องแชทนี้เพื่อกดอนุมัติคืนเงินให้ผู้ซื้อทันทีครับ!`,
        new Date(Date.now() + 200).toISOString()
      );
      db.prepare(`UPDATE ChatRooms SET updated_at = ? WHERE id = ?`).run(nowIso, room.id);
    }

    return res.json({
      message: `🚨 แจ้งปัญหา "${categoryText}" สำเร็จ! ระบบได้ระงับการโอนเงินให้ผู้ขายชั่วคราว (Freeze Escrow) และส่งแจ้งเตือนด่วนไปยัง Admin Dashboard เรียบร้อยแล้ว`,
      orderId,
      roomId: room ? room.id : null
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// แจ้งปัญหา / ขอคืนสินค้าโดยตรงจากปุ่มในห้องแชท (กรณีมีหรือยังไม่มีบิล Order ก็สามารถเรียกแอดมินและสร้าง/อัปเดตเคสข้อพิพาทได้ทันที)
app.post('/api/chat/rooms/:roomId/dispute', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const roomId = parseInt(req.params.roomId, 10);
    const { dispute_category, dispute_reason, dispute_evidence_image } = req.body;

    const room = db.prepare(`SELECT * FROM ChatRooms WHERE id = ?`).get(roomId);
    if (!room) {
      return res.status(404).json({ error: 'ไม่พบห้องแชทนี้' });
    }

    const nowIso = new Date().toISOString();
    const categoryText = String(dispute_category || 'สภาพหนังสือไม่ตรงปก').trim();
    const detailText = String(dispute_reason || '').trim();
    const fullReason = detailText ? `[${categoryText}] ${detailText}` : `[${categoryText}] แจ้งขอคืนสินค้าผ่านห้องแชท`;
    const evidenceImg = String(dispute_evidence_image || '').trim();

    let order = db.prepare(`
      SELECT * FROM Orders WHERE book_id = ? AND buyer_id = ? ORDER BY id DESC LIMIT 1
    `).get(room.book_id, room.buyer_id);

    if (!order) {
      // หากยังไม่มีบิลในห้องแชทนี้ ให้สร้างรายการ Order สถานะ Disputed เพื่อให้แอดมินกดอนุมัติคืนเงินใน Dashboard ได้ทันที
      const book = db.prepare(`SELECT * FROM Books WHERE id = ?`).get(room.book_id);
      const bookPrice = Number(book ? book.price : 200);
      const shipFee = Number(book ? book.shipping_fee : 40);
      const dispFee = calculateEscrowFee(bookPrice);
      const totalAmt = bookPrice + shipFee + dispFee;
      const ordCode = 'ESC-007' + Math.floor(1000 + Math.random() * 9000);
      const ins = db.prepare(`
        INSERT INTO Orders (
          order_code, book_id, reservation_id, buyer_id, seller_id,
          book_title, book_price, shipping_fee, total_amount, platform_fee, seller_payout,
          status, slip_reference, tracking_no,
          dispute_category, dispute_reason, dispute_evidence_image, escrow_frozen, return_shipping_fee,
          recipient_name, recipient_phone, shipping_address, payout_status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Disputed - Return Requested', 'SLIP-ESCROW-HOLD', 'TH-DISPUTE-CHECK', ?, ?, ?, 1, ?, ?, '', 'แจ้งผ่านห้องแชท 3 ฝ่าย', 'Frozen - Dispute Pending Admin', ?, ?)
      `).run(
        ordCode,
        room.book_id,
        room.reservation_id || null,
        room.buyer_id,
        room.seller_id,
        book ? book.title : 'หนังสือในห้องแชท',
        bookPrice,
        shipFee,
        totalAmt,
        dispFee,
        bookPrice + shipFee,
        categoryText,
        fullReason,
        evidenceImg,
        shipFee,
        req.user.username,
        nowIso,
        nowIso
      );
      order = db.prepare(`SELECT * FROM Orders WHERE id = ?`).get(Number(ins.lastInsertRowid));
    } else {
      db.prepare(`
        UPDATE Orders
        SET status = 'Disputed - Return Requested',
            payout_status = 'Frozen - Dispute Pending Admin',
            escrow_frozen = 1,
            dispute_category = ?,
            dispute_reason = ?,
            dispute_evidence_image = ?,
            updated_at = ?
        WHERE id = ?
      `).run(categoryText, fullReason, evidenceImg, nowIso, order.id);
      order = db.prepare(`SELECT * FROM Orders WHERE id = ?`).get(order.id);
    }

    db.prepare(`
      INSERT INTO ChatMessages (room_id, sender_id, sender_role, sender_name, message, attachment_note, created_at)
      VALUES (?, ?, 'Buyer', ?, ?, ?, ?)
    `).run(
      roomId,
      req.user.id,
      req.user.username,
      `🔄 [แจ้งปัญหา / ขอคืนสินค้า - เรียกแอดมินตรวจสอบ] บิล #${order.order_code}\n• หัวข้อปัญหา: ${categoryText}\n• รายละเอียด: "${detailText || categoryText}"`,
      evidenceImg || 'แนบรูปหลักฐานสภาพสินค้าในระบบแล้ว',
      nowIso
    );

    db.prepare(`
      INSERT INTO ChatMessages (room_id, sender_id, sender_role, sender_name, message, attachment_note, created_at)
      VALUES (?, NULL, 'AI_Bot', '🤖 AI Chatbot (บอทดูแลการซื้อขาย & ระงับข้อพิพาท)', ?, '', ?)
    `).run(
      roomId,
      `🚨 [AI Chatbot รับเรื่องแจ้งปัญหา & ระงับการโอนเงินชั่วคราว (Escrow Frozen)]:\n` +
      `• บอทได้รับแจ้งปัญหา "${categoryText}" สำหรับบิล #${order.order_code} เรียบร้อยแล้ว!\n` +
      `• ❄️ ระงับการโอนเงินให้ผู้ขายชั่วคราว (Frozen - Dispute Pending Admin) ยอดเงิน ฿${order.total_amount} ถูกอายัดไว้ในบัญชีกลางอย่างปลอดภัย\n` +
      `• 🔔 ส่งแจ้งเตือนด่วน (Urgent Dispute Alert) ไปยัง Admin Dashboard แล้ว แอดมินสามารถเข้ามาตรวจสอบในแชทนี้และกดอนุมัติคืนเงินให้ผู้ซื้อได้ทันทีครับ!`,
      new Date(Date.now() + 200).toISOString()
    );

    db.prepare(`UPDATE ChatRooms SET updated_at = ? WHERE id = ?`).run(nowIso, roomId);
    const messages = db.prepare(`SELECT * FROM ChatMessages WHERE room_id = ? ORDER BY id ASC`).all(roomId);

    return res.status(201).json({
      message: `🚨 แจ้งปัญหา "${categoryText}" ในห้องแชทสำเร็จ! AI Chatbot ระงับการโอนเงินชั่วคราวและส่งแจ้งเตือนด่วนให้แอดมินแล้ว`,
      order,
      messages
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// แอดมินดำเนินการอนุมัติคืนสินค้า คืนเงินเต็มจำนวนให้ผู้ซื้อ และเรียกเก็บค่าส่งคืนจากผู้ขายเพิ่ม (PUT /api/escrow/admin-approve-return/:orderId)
app.put('/api/escrow/admin-approve-return/:orderId', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const orderId = parseInt(req.params.orderId, 10);
    const { return_shipping_fee, return_tracking_no } = req.body;

    const order = db.prepare(`SELECT * FROM Orders WHERE id = ?`).get(orderId);
    if (!order) {
      return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อนี้' });
    }

    const nowIso = new Date().toISOString();
    const extraReturnFee = Number(return_shipping_fee || order.return_shipping_fee || order.shipping_fee || 40);
    const retTrack = String(return_tracking_no || order.return_tracking_no || 'RET-007-RETURNED').trim();

    db.prepare(`
      UPDATE Orders
      SET status = 'Returned & Refunded',
          payout_status = 'Refunded to Buyer (Seller Pays Return Fee)',
          escrow_frozen = 0,
          return_shipping_fee = ?,
          return_tracking_no = ?,
          updated_at = ?
      WHERE id = ?
    `).run(extraReturnFee, retTrack, nowIso, orderId);

    // คืนสถานะหนังสือกลับเป็น Available เพื่อให้ผู้ขายแก้ไขรายละเอียดตามจริงก่อนขายใหม่
    db.prepare(`UPDATE Books SET stock_status = 'Available', stock = 1 WHERE id = ?`).run(order.book_id);
    invalidateBookCache();

    const room = getOrCreateThreePartyChatRoom(db, order.book_id, order.buyer_id);
    if (room) {
      db.prepare(`
        INSERT INTO ChatMessages (room_id, sender_id, sender_role, sender_name, message, attachment_note, created_at)
        VALUES (?, ?, 'Admin', ?, ?, '', ?)
      `).run(
        room.id,
        req.user.id,
        req.user.username,
        `⚖️ [แอดมินอนุมัติคืนเงินให้ผู้ซื้อเต็มจำนวนเรียบร้อยแล้ว] บิล #${order.order_code}\n• แอดมินตรวจสอบหลักฐานในห้องแชทและโอนเงินคืนให้คุณลูกค้าเต็มจำนวน ฿${order.total_amount} เรียบร้อยแล้ว\n• สำหรับผู้ขาย: ผู้ขายต้องชำระค่าจัดส่งในการส่งคืนสินค้านี้เพิ่มจำนวน ฿${extraReturnFee} บาท (เลขพัสดุตีกลับ: ${retTrack}) ครับ`,
        nowIso
      );
    }

    return res.json({
      message: `ดำเนินการอนุมัติคืนเงินสำเร็จ! คืนเงินให้ผู้ซื้อเต็มจำนวน ฿${order.total_amount} เรียบร้อยแล้ว`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ขั้นที่ 4 (Completed & Released): ผู้ซื้อกดยืนยันรับของและตรวจสอบสภาพเรียบร้อย / แอดมินโอนเงิน (ราคาหนังสือ + ค่าจัดส่ง) ให้ผู้ขาย และเก็บ 10 บาท/เล่ม เป็นรายได้ค่าบริการส่วนกลาง
app.put('/api/escrow/step4-complete-release/:orderId', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const orderId = parseInt(req.params.orderId, 10);
    const order = db.prepare(`SELECT * FROM Orders WHERE id = ?`).get(orderId);
    if (!order) {
      return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อนี้' });
    }

    if (req.user.role !== 'Admin' && req.user.id !== order.buyer_id) {
      return res.status(403).json({ error: 'เฉพาะผู้ซื้อหรือแอดมินตัวกลางเท่านั้นที่ยืนยันการรับของและปล่อยเงินได้' });
    }

    const nowIso = new Date().toISOString();
    db.prepare(`
      UPDATE Orders
      SET status = 'Completed & Released', payout_status = 'Released to Seller', escrow_frozen = 0, updated_at = ?
      WHERE id = ?
    `).run(nowIso, orderId);

    db.prepare(`UPDATE Books SET stock_status = 'Sold Out', stock = 0 WHERE id = ?`).run(order.book_id);
    invalidateBookCache();

    const seller = db.prepare(`SELECT username, bank_name, bank_account_no FROM Users WHERE id = ?`).get(order.seller_id);
    const room = getOrCreateThreePartyChatRoom(db, order.book_id, order.buyer_id);

    if (room) {
      db.prepare(`
        INSERT INTO ChatMessages (room_id, sender_id, sender_role, sender_name, message, attachment_note, created_at)
        VALUES (?, ?, ?, ?, ?, '', ?)
      `).run(
        room.id,
        req.user.id,
        req.user.role === 'Admin' ? 'Admin' : 'Buyer',
        req.user.username,
        `🎉 [ขั้นที่ 4 - ยืนยันรับหนังสือ & โอนเงินให้ผู้ขายสำเร็จ!] บิล #${order.order_code}`,
        nowIso
      );

      db.prepare(`
        INSERT INTO ChatMessages (room_id, sender_id, sender_role, sender_name, message, attachment_note, created_at)
        VALUES (?, NULL, 'AI_Bot', '🤖 AI Chatbot (ดูแลการซื้อขายครบวงจร)', ?, '', ?)
      `).run(
        room.id,
        `🏆 [AI Chatbot ขั้นตอนที่ 6/6 — แอดมินโอนเงินให้ผู้ขายสำเร็จ & ปิดการขายสมบูรณ์!]:\n` +
        `• บิล #${order.order_code} เสร็จสมบูรณ์เรียบร้อยแล้ว!\n` +
        `• 💰 แอดมินบัญชีกลางได้โอนเงินยอดสุทธิ ฿${order.seller_payout} (ค่าหนังสือ ฿${order.book_price} + ค่าส่ง ฿${order.shipping_fee}) เข้าบัญชีผู้ขาย (${seller ? `${seller.bank_name} ${seller.bank_account_no}` : ''}) และหักค่าธรรมเนียมระบบ ฿${order.platform_fee} (5฿ + 5% สูงสุดไม่เกิน 30฿/เล่ม) เรียบร้อยแล้ว ขอบคุณทั้งผู้ซื้อและผู้ขายครับ!`,
        new Date(Date.now() + 200).toISOString()
      );
    }

    return res.json({
      message: `🎉 จบรายการซื้อขายอย่างปลอดภัย (ขั้นตอนที่ 6/6 Completed & Released)! แอดมินโอนเงิน ฿${order.seller_payout} ให้ผู้ขายเรียบร้อยแล้ว`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 6.2 SELLER STRIKE STAR (⚠️⭐) & 6-MONTH SELLING BAN MANAGEMENT API
// ============================================================================

// จำลองเพิ่มดาวเตือนผู้ขายส่งของล่าช้า (⚠️⭐ +1 ดวง) — หากครบ 3 ดวงภายในเดือนเดียวกัน จะระงับสิทธิ์การลงขายชั่วคราว 6 เดือนอัตโนมัติ
app.post('/api/users/simulate-strike', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const targetUserId = req.body.user_id && req.user.role === 'Admin' ? parseInt(req.body.user_id, 10) : req.user.id;
    const strikeInfo = recordSellerStrike(db, targetUserId);
    invalidateBookCache();

    const updatedUserRow = db.prepare(`SELECT * FROM Users WHERE id = ?`).get(targetUserId);
    const sanitized = sanitizeUserRow(updatedUserRow);

    const banMsg = sanitized.is_selling_banned
      ? `🔒 สะสมครบ ${sanitized.strike_count} ดวงในเดือนเดียวกัน! ระบบได้เปลี่ยนสถานะเป็น "ระงับสิทธิ์การลงขายชั่วคราวเป็นเวลา 6 เดือน" (จนถึง ${new Date(sanitized.seller_banned_until).toLocaleDateString('th-TH')}) — ยังสามารถซื้อหนังสือได้ตามปกติ แต่ปุ่ม '+ ลงขายหนังสือ' จะถูกล็อกชั่วคราว`
      : `⚠️⭐ บันทึกสัญลักษณ์ดาวเตือนความผิดพลาดที่โปรไฟล์แล้ว (ปัจจุบันสะสม ${sanitized.strike_count}/3 ดวงในเดือนนี้ — หากครบ 3 ดวงจะถูกระงับสิทธิ์การลงขาย 6 เดือน)`;

    return res.json({
      message: banMsg,
      user: sanitized,
      strikeInfo
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// รีเซ็ตดาวเตือน ⚠️⭐ และปลดล็อกระงับสิทธิ์การขาย 6 เดือน (สำหรับการทดสอบหรือแอดมินปลดแบน)
app.post('/api/users/clear-strikes', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const targetUserId = req.body.user_id && req.user.role === 'Admin' ? parseInt(req.body.user_id, 10) : req.user.id;
    const currentMonth = new Date().toISOString().slice(0, 7);

    db.prepare(`
      UPDATE Users
      SET strike_count = 0, strike_month = ?, seller_banned_until = NULL
      WHERE id = ?
    `).run(currentMonth, targetUserId);
    invalidateBookCache();

    const updatedUserRow = db.prepare(`SELECT * FROM Users WHERE id = ?`).get(targetUserId);
    const sanitized = sanitizeUserRow(updatedUserRow);

    return res.json({
      message: `✅ รีเซ็ตสัญลักษณ์ดาวเตือน (⚠️⭐ = 0) และปลดล็อกสิทธิ์การลงขายหนังสือให้ "${sanitized.username}" เรียบร้อยแล้ว!`,
      user: sanitized
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 6.4 MERCHANT BADGE TIERS & SMART FEED BOOST SUBSCRIPTION API (4 ระดับแพ็กเกจรายเดือน)
// ============================================================================

app.get('/api/merchant/tiers', (req, res) => {
  return res.json({
    tiers: Object.values(MERCHANT_BADGE_TIERS)
  });
});

app.post('/api/merchant/subscribe', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { tier_key } = req.body;
    const tier = MERCHANT_BADGE_TIERS[tier_key];
    if (!tier) {
      return res.status(400).json({ error: 'กรุณาเลือกแพ็กเกจสัญลักษณ์ร้านค้าที่ถูกต้อง (tier_1 ถึง tier_4)' });
    }

    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // อายุแพ็กเกจรายเดือน 30 วัน

    db.prepare(`
      UPDATE Users
      SET merchant_tier = ?,
          merchant_badge_label = ?,
          boost_level = ?,
          merchant_expires_at = ?
      WHERE id = ?
    `).run(tier.key, tier.badge_label, tier.boost_level, expiresIso, req.user.id);

    const subInsert = db.prepare(`
      INSERT INTO MerchantSubscriptions (
        user_id, username, tier_key, tier_name, badge_label, boost_level, original_price, paid_amount, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      req.user.username,
      tier.key,
      tier.name,
      tier.badge_label,
      tier.boost_level,
      tier.original_price,
      tier.promo_price,
      nowIso,
      expiresIso
    );

    invalidateBookCache();
    const updatedUserRow = db.prepare(`SELECT * FROM Users WHERE id = ?`).get(req.user.id);
    const sanitized = sanitizeUserRow(updatedUserRow);

    return res.status(201).json({
      message: `👑 สมัครแพ็กเกจ "${tier.name}" (${tier.badge_label}) สำเร็จ! ชำระเพียง ฿${tier.promo_price}/เดือน (จากปกติ ฿${tier.original_price}) ระบบได้ติดป้ายสัญลักษณ์หน้าชื่อร้านและเปิดระบบดันฟีดระดับ ${tier.boost_level} เรียบร้อยแล้ว!`,
      user: sanitized,
      subscription: {
        id: Number(subInsert.lastInsertRowid),
        tier_key: tier.key,
        tier_name: tier.name,
        badge_label: tier.badge_label,
        boost_level: tier.boost_level,
        original_price: tier.original_price,
        paid_amount: tier.promo_price,
        created_at: nowIso,
        expires_at: expiresIso
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 6.5 REVIEWS & STAR RATING API (ระบบคะแนนรีวิวผู้ขาย 1-5 ดาว & รีวิวการซื้อขาย)
// ============================================================================

app.get('/api/reviews', (req, res) => {
  try {
    const db = getDb();
    const { seller_id, book_id } = req.query;
    let rows = [];
    if (seller_id) {
      rows = db.prepare(`SELECT * FROM Reviews WHERE seller_id = ? ORDER BY id DESC`).all(parseInt(seller_id, 10));
    } else if (book_id) {
      const cleanId = parseInt(String(book_id).replace('bk-', ''), 10);
      rows = db.prepare(`SELECT * FROM Reviews WHERE book_id = ? ORDER BY id DESC`).all(cleanId);
    } else {
      rows = db.prepare(`SELECT * FROM Reviews ORDER BY id DESC LIMIT 30`).all();
    }
    return res.json({ reviews: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/reviews', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { order_id, book_id, seller_id, rating, comment } = req.body;
    const starRating = Math.min(5, Math.max(1, parseInt(rating || 5, 10)));
    const cleanComment = String(comment || '').trim();
    if (!cleanComment) {
      return res.status(400).json({ error: 'กรุณาเขียนคอมเมนต์รีวิวผู้ขายก่อนกดบันทึก' });
    }

    let targetBookId = book_id ? parseInt(String(book_id).replace('bk-', ''), 10) : 1;
    let targetSellerId = seller_id ? parseInt(seller_id, 10) : 2;

    if (order_id) {
      const ord = db.prepare(`SELECT * FROM Orders WHERE id = ?`).get(parseInt(order_id, 10));
      if (ord) {
        targetBookId = ord.book_id;
        targetSellerId = ord.seller_id;
      }
    }

    const nowIso = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO Reviews (order_id, book_id, seller_id, buyer_id, buyer_name, rating, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      order_id ? parseInt(order_id, 10) : null,
      targetBookId,
      targetSellerId,
      req.user.id,
      req.user.username,
      starRating,
      cleanComment,
      nowIso
    );
    invalidateBookCache();

    return res.status(201).json({
      message: `⭐ บันทึกรีวิว ${starRating} ดาวให้ผู้ขายเรียบร้อยแล้ว ขอบคุณสำหรับรีวิวครับ!`,
      review: {
        id: Number(result.lastInsertRowid),
        order_id: order_id || null,
        book_id: targetBookId,
        seller_id: targetSellerId,
        buyer_id: req.user.id,
        buyer_name: req.user.username,
        rating: starRating,
        comment: cleanComment,
        created_at: nowIso
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 6.8 ANALYTICS & STATISTICS DASHBOARD API (แดชบอร์ดสถิติภาพรวม)
// ============================================================================

app.get('/api/stats/dashboard', (req, res) => {
  try {
    const db = getDb();
    const user = extractUserFromRequest(req);
    const books = db.prepare(`SELECT * FROM Books ORDER BY id ASC`).all().map(r => formatBookRow(r, db));
    const orders = db.prepare(`SELECT * FROM Orders ORDER BY id DESC`).all();
    const reservations = db.prepare(`SELECT * FROM Reservations ORDER BY id DESC`).all();
    const reviews = db.prepare(`SELECT * FROM Reviews ORDER BY id DESC`).all();
    let merchantSubscriptions = [];
    try {
      merchantSubscriptions = db.prepare(`SELECT * FROM MerchantSubscriptions ORDER BY id DESC`).all();
    } catch (e) {}
    const merchantBadgeRevenue = merchantSubscriptions.reduce((sum, s) => sum + Number(s.paid_amount || 0), 0);

    return res.json({
      books,
      orders,
      reservations,
      reviews,
      merchantSubscriptions,
      merchantBadgeRevenue,
      currentUserId: user ? user.id : null
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 7. ADMIN DASHBOARD OVERVIEW API
// ============================================================================

app.get('/api/admin/overview', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    syncReservationQueues(db);

    const users = db.prepare(`SELECT * FROM Users ORDER BY id ASC`).all().map(u => sanitizeUserRow(u));

    const books = db.prepare(`SELECT * FROM Books ORDER BY id ASC`).all().map(r => formatBookRow(r, db));

    const reservations = db.prepare(`
      SELECT
        r.id, r.buyer_id, r.seller_id, r.book_id, r.queue_no, r.status, r.expires_at, r.created_at,
        bu.username AS buyer_name, bu.email AS buyer_email,
        se.username AS seller_name,
        b.code AS book_code, b.title AS book_title, b.price AS book_price, b.shipping_fee
      FROM Reservations r
      JOIN Users bu ON bu.id = r.buyer_id
      JOIN Users se ON se.id = r.seller_id
      JOIN Books b ON b.id = r.book_id
      ORDER BY r.book_id ASC, r.queue_no ASC
    `).all();

    const orders = db.prepare(`
      SELECT
        o.*,
        bu.username AS buyer_name, bu.email AS buyer_email,
        se.username AS seller_name, se.bank_name AS seller_bank_name, se.bank_account_no AS seller_bank_no,
        se.strike_count AS seller_strike_count, se.seller_banned_until AS seller_banned_until,
        se.merchant_badge_label AS seller_badge_label
      FROM Orders o
      JOIN Users bu ON bu.id = o.buyer_id
      JOIN Users se ON se.id = o.seller_id
      ORDER BY o.id DESC
    `).all();

    const chatRooms = db.prepare(`
      SELECT cr.*, b.title AS book_title, bu.username AS buyer_name, se.username AS seller_name
      FROM ChatRooms cr
      JOIN Books b ON b.id = cr.book_id
      JOIN Users bu ON bu.id = cr.buyer_id
      JOIN Users se ON se.id = cr.seller_id
      ORDER BY cr.updated_at DESC
    `).all();

    let merchantSubscriptions = [];
    try {
      merchantSubscriptions = db.prepare(`SELECT * FROM MerchantSubscriptions ORDER BY id DESC`).all();
    } catch (e) {}
    const merchantBadgeRevenue = merchantSubscriptions.reduce((sum, s) => sum + Number(s.paid_amount || 0), 0);

    const totalEscrowRevenue = orders
      .filter(o => o.status === 'Completed & Released')
      .reduce((sum, o) => sum + Number(o.platform_fee || 0), 0);

    return res.json({
      serverTime: new Date().toISOString(),
      totalEscrowRevenue,
      merchantBadgeRevenue,
      merchantSubscriptions,
      users,
      books,
      reservations,
      orders,
      chatRooms
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/reset-seed', (req, res) => {
  try {
    seedDatabase(true);
    invalidateBookCache();
    return res.json({ message: 'รีเซ็ตฐานข้อมูลและสร้างข้อมูลจำลอง (Seed Data) ของตลาดกลางเรียบร้อยแล้ว!' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 8. ROUTES & STATIC FILES
// ============================================================================

app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'profile.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'register.html'));
});

app.use(express.static(PUBLIC_DIR));

app.listen(PORT, () => {
  console.log(`========================================================================`);
  console.log(`🤝 007 BOOK MARKETPLACE & ESCROW PLATFORM (ตลาดกลางหนังสือมือสอง + บัญชีกลาง)`);
  console.log(`🌐 URL หน้าบ้าน (Member - ซื้อ/ลงขาย): http://localhost:${PORT}`);
  console.log(`🛡️ URL หลังบ้าน (Admin Escrow):       http://localhost:${PORT}/admin.html`);
  console.log(`========================================================================`);
});
