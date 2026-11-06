const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_DIR = __dirname;
const DB_PATH = path.join(DB_DIR, 'bookstore.sqlite');
const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000; // กำหนดเวลาให้ผู้ขายจัดส่งหนังสือภายใน 48 ชั่วโมง (1-2 วัน)
const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000; // โทษแบนสิทธิ์การลงขายชั่วคราว 6 เดือน (เมื่อครบ 3 ดาวเตือนในเดือนเดียวกัน)
const ESCROW_FEE_PER_BOOK = 10; // ค่าธรรมเนียมระบบ (10 บาท/เล่ม)
const PLATFORM_FEE_RATE = 10;   // ค่าธรรมเนียมการดูแลระบบ 10฿/เล่ม

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    dbInstance.exec('PRAGMA synchronous = NORMAL;');
    dbInstance.exec('PRAGMA busy_timeout = 5000;');
  }
  return dbInstance;
}

function createSchema(db) {
  db.exec(`
    -- 1. ตาราง Users (Unified Role + ระบบติดดาวเตือน Strike Star ⚠️⭐ + โทษแบนการขาย 6 เดือน)
    CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone_number TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Member' CHECK (role IN ('Member', 'Admin')),
      bank_name TEXT DEFAULT '',
      bank_account_no TEXT DEFAULT '',
      bank_account_name TEXT DEFAULT '',
      strike_count INTEGER NOT NULL DEFAULT 0,
      strike_month TEXT DEFAULT '',
      seller_banned_until TEXT DEFAULT NULL,
      reset_token TEXT,
      reset_expires_at TEXT,
      created_at TEXT NOT NULL
    );

    -- 2. ตาราง Books (หนังสือที่สมาชิกแต่ละรายลงประกาศขายเอง)
    CREATE TABLE IF NOT EXISTS Books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      en_title TEXT NOT NULL,
      author TEXT NOT NULL,
      translator TEXT DEFAULT '-',
      publisher TEXT NOT NULL,
      category TEXT NOT NULL,
      category_name TEXT NOT NULL,
      original_price REAL NOT NULL,
      price REAL NOT NULL,
      shipping_fee REAL NOT NULL DEFAULT 40,
      packing_note TEXT NOT NULL DEFAULT 'ผู้ขายแพ็กจัดส่งตามมาตรฐานของผู้ขาย',
      condition_percent INTEGER NOT NULL,
      condition_grade TEXT NOT NULL,
      defect_details TEXT NOT NULL,
      images_json TEXT NOT NULL,
      stock_status TEXT NOT NULL DEFAULT 'Available' CHECK (stock_status IN ('Available', 'Reserved', 'Sold Out')),
      stock INTEGER NOT NULL DEFAULT 1,
      is_new_arrival INTEGER NOT NULL DEFAULT 0,
      is_best_seller INTEGER NOT NULL DEFAULT 0,
      pages INTEGER DEFAULT 250,
      publish_year INTEGER DEFAULT 2565,
      isbn TEXT DEFAULT '978-616-000-000-0',
      synopsis TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (seller_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    -- 3. ตาราง Reservations (ระบบเข้าคิวจองหนังสือ)
    CREATE TABLE IF NOT EXISTS Reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      buyer_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      queue_no INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Waiting', 'Active', 'Expired', 'Completed')),
      expires_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (book_id, buyer_id),
      UNIQUE (book_id, queue_no),
      FOREIGN KEY (book_id) REFERENCES Books(id) ON DELETE CASCADE,
      FOREIGN KEY (buyer_id) REFERENCES Users(id) ON DELETE CASCADE,
      FOREIGN KEY (seller_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    -- 4. ตาราง ChatRooms (ห้องแชทรายการจอง)
    CREATE TABLE IF NOT EXISTS ChatRooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL UNIQUE,
      book_id INTEGER NOT NULL,
      buyer_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      admin_id INTEGER NOT NULL DEFAULT 1,
      reservation_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (book_id) REFERENCES Books(id) ON DELETE CASCADE,
      FOREIGN KEY (buyer_id) REFERENCES Users(id) ON DELETE CASCADE,
      FOREIGN KEY (seller_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    -- 5. ตาราง ChatMessages (ข้อความในห้องแชทรายการจอง + บอท AI ดูแลครบทุกขั้นตอน)
    CREATE TABLE IF NOT EXISTS ChatMessages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      sender_id INTEGER,
      sender_role TEXT NOT NULL CHECK (sender_role IN ('Buyer', 'Seller', 'Admin', 'AI_Bot')),
      sender_name TEXT NOT NULL,
      message TEXT NOT NULL,
      attachment_note TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (room_id) REFERENCES ChatRooms(id) ON DELETE CASCADE
    );

    -- 6. ตาราง Orders (ระบบแอดมินเป็นตัวกลางพักเงิน Escrow + Freeze Escrow + แจ้งขอคืนสินค้าพร้อมรูปหลักฐาน)
    CREATE TABLE IF NOT EXISTS Orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code TEXT NOT NULL UNIQUE,
      book_id INTEGER NOT NULL,
      reservation_id INTEGER,
      buyer_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      book_title TEXT NOT NULL,
      book_price REAL NOT NULL,
      shipping_fee REAL NOT NULL,
      total_amount REAL NOT NULL,
      platform_fee REAL NOT NULL,
      seller_payout REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending Payment' CHECK (status IN ('Pending Payment', 'Paid - Awaiting Shipment', 'Shipped', 'Completed & Released', 'Disputed - Return Requested', 'Returned & Refunded', 'Cancelled - Refunded')),
      slip_reference TEXT DEFAULT '',
      tracking_no TEXT DEFAULT '',
      shipping_deadline TEXT,
      inspection_expires_at TEXT,
      dispute_category TEXT DEFAULT '',
      dispute_reason TEXT DEFAULT '',
      dispute_evidence_image TEXT DEFAULT '',
      escrow_frozen INTEGER NOT NULL DEFAULT 0,
      strike_recorded INTEGER NOT NULL DEFAULT 0,
      return_shipping_fee REAL DEFAULT 0,
      return_tracking_no TEXT DEFAULT '',
      recipient_name TEXT NOT NULL,
      recipient_phone TEXT NOT NULL,
      shipping_address TEXT NOT NULL,
      payout_status TEXT NOT NULL DEFAULT 'Holding in Escrow' CHECK (payout_status IN ('Waiting Buyer Payment', 'Holding in Escrow', 'Frozen - Dispute Pending Admin', 'Released to Seller', 'Refunded to Buyer (Seller Pays Return Fee)', 'Refunded to Buyer (Seller Overdue 48h)')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (book_id) REFERENCES Books(id) ON DELETE CASCADE,
      FOREIGN KEY (buyer_id) REFERENCES Users(id) ON DELETE CASCADE,
      FOREIGN KEY (seller_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    -- 7. ตาราง Reviews (ระบบคะแนนรีวิวผู้ขายและรีวิวการซื้อขาย 1-5 ดาว)
    CREATE TABLE IF NOT EXISTS Reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      book_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      buyer_id INTEGER NOT NULL,
      buyer_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (book_id) REFERENCES Books(id) ON DELETE CASCADE,
      FOREIGN KEY (seller_id) REFERENCES Users(id) ON DELETE CASCADE,
      FOREIGN KEY (buyer_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    -- 9. Database Indexing (ดัชนีฐานข้อมูลเพื่อรองรับผู้ใช้งานพร้อมกันระดับแสนคน High Concurrency)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_book_buyer_unique ON Reservations(book_id, buyer_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_book_queue_unique ON Reservations(book_id, queue_no);
    CREATE INDEX IF NOT EXISTS idx_books_category ON Books(category);
    CREATE INDEX IF NOT EXISTS idx_books_stock_status ON Books(stock_status);
    CREATE INDEX IF NOT EXISTS idx_books_seller_id ON Books(seller_id);
    CREATE INDEX IF NOT EXISTS idx_books_price ON Books(price);
    CREATE INDEX IF NOT EXISTS idx_reservations_status ON Reservations(status);
    CREATE INDEX IF NOT EXISTS idx_reservations_seller_id ON Reservations(seller_id);
    CREATE INDEX IF NOT EXISTS idx_reservations_buyer_id ON Reservations(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_reservations_book_id ON Reservations(book_id);
    CREATE INDEX IF NOT EXISTS idx_reservations_expires_at ON Reservations(expires_at);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON Orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON Orders(seller_id);
    CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON Orders(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_book_id ON Orders(book_id);
    CREATE INDEX IF NOT EXISTS idx_orders_shipping_deadline ON Orders(shipping_deadline);
    CREATE INDEX IF NOT EXISTS idx_chatrooms_book_id ON ChatRooms(book_id);
    CREATE INDEX IF NOT EXISTS idx_chatrooms_buyer_id ON ChatRooms(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_chatrooms_seller_id ON ChatRooms(seller_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_seller_id ON Reviews(seller_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_book_id ON Reviews(book_id);
  `);
}

// ฟังก์ชันตรวจสอบและอัปเดตคิวจองหนังสือที่หมดเวลา 5 ชั่วโมง (Auto-expire & Auto-promote next queue)
function syncReservationQueues(db = getDb()) {
  const nowIso = new Date().toISOString();

  const expiredActives = db.prepare(`
    SELECT id, book_id, buyer_id, seller_id, queue_no, expires_at
    FROM Reservations
    WHERE status = 'Active' AND expires_at IS NOT NULL AND expires_at <= ?
  `).all(nowIso);

  for (const exp of expiredActives) {
    // 1. เปลี่ยนสถานะคิวที่หมดเวลาเป็น 'Expired'
    db.prepare(`UPDATE Reservations SET status = 'Expired' WHERE id = ?`).run(exp.id);

    // 2. ค้นหาคิวถัดไปของหนังสือเล่มเดียวกันที่สถานะเป็น 'Waiting'
    const nextWaiting = db.prepare(`
      SELECT id, buyer_id, queue_no
      FROM Reservations
      WHERE book_id = ? AND status = 'Waiting'
      ORDER BY queue_no ASC, id ASC
      LIMIT 1
    `).get(exp.book_id);

    if (nextWaiting) {
      const newExpiresIso = new Date(Date.now() + FIVE_HOURS_MS).toISOString();
      db.prepare(`
        UPDATE Reservations
        SET status = 'Active', expires_at = ?
        WHERE id = ?
      `).run(newExpiresIso, nextWaiting.id);

      db.prepare(`
        UPDATE Books SET stock_status = 'Reserved' WHERE id = ? AND stock_status != 'Sold Out'
      `).run(exp.book_id);
    } else {
      db.prepare(`
        UPDATE Books SET stock_status = 'Available', stock = 1
        WHERE id = ? AND stock_status = 'Reserved'
      `).run(exp.book_id);
    }
  }

  // ตรวจสอบออเดอร์ที่เลยกำหนดส่งของ 48 ชั่วโมง (Paid - Awaiting Shipment) และยังไม่ได้ติดดาวเตือนความผิดพลาด (Strike Star ⚠️⭐)
  const overdueOrders = db.prepare(`
    SELECT id, seller_id, order_code, book_title
    FROM Orders
    WHERE status = 'Paid - Awaiting Shipment'
      AND shipping_deadline IS NOT NULL
      AND shipping_deadline <= ?
      AND strike_recorded = 0
  `).all(nowIso);

  for (const ord of overdueOrders) {
    db.prepare(`UPDATE Orders SET strike_recorded = 1 WHERE id = ?`).run(ord.id);
    recordSellerStrike(db, ord.seller_id);
  }
}

// ฟังก์ชันบันทึกดาวเตือนความผิดพลาดของผู้ขาย (Strike Star ⚠️⭐) และแบนสิทธิ์การขายอัตโนมัติ 6 เดือนเมื่อครบ 3 ดวงในเดือนเดียวกัน
function recordSellerStrike(db = getDb(), sellerId) {
  const user = db.prepare(`
    SELECT id, username, strike_count, strike_month, seller_banned_until
    FROM Users
    WHERE id = ?
  `).get(sellerId);
  if (!user) return null;

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  let newCount = (user.strike_month === currentMonth) ? (Number(user.strike_count || 0) + 1) : 1;
  let bannedUntil = user.seller_banned_until || null;

  if (newCount >= 3) {
    bannedUntil = new Date(Date.now() + SIX_MONTHS_MS).toISOString();
  }

  db.prepare(`
    UPDATE Users
    SET strike_count = ?, strike_month = ?, seller_banned_until = ?
    WHERE id = ?
  `).run(newCount, currentMonth, bannedUntil, sellerId);

  return {
    seller_id: sellerId,
    strike_count: newCount,
    strike_month: currentMonth,
    seller_banned_until: bannedUntil,
    is_banned: Boolean(bannedUntil && new Date(bannedUntil).getTime() > Date.now())
  };
}

function seedDatabase(forceReset = false) {
  const db = getDb();

  if (forceReset) {
    db.exec(`
      DROP TABLE IF EXISTS Reviews;
      DROP TABLE IF EXISTS Orders;
      DROP TABLE IF EXISTS ChatMessages;
      DROP TABLE IF EXISTS ChatRooms;
      DROP TABLE IF EXISTS Reservations;
      DROP TABLE IF EXISTS Books;
      DROP TABLE IF EXISTS Users;
    `);
  }

  createSchema(db);

  const userCount = db.prepare(`SELECT COUNT(*) AS count FROM Users`).get().count;
  if (userCount > 0 && !forceReset) {
    syncReservationQueues(db);
    return;
  }

  console.log('🌱 กำลังสร้างข้อมูลจำลอง (Seed Data) ตลาดกลางซื้อ-ขายหนังสือมือสอง (Escrow Marketplace)...');
  const nowIso = new Date().toISOString();
  const currentMonth = nowIso.slice(0, 7);
  const sixMonthsLaterIso = new Date(Date.now() + SIX_MONTHS_MS).toISOString();

  // 1. Seed Users: 1 Admin + 3 Members (ผู้ขายปกติ, ผู้ขายที่มีดาวเตือน ⚠️⭐ 1 ดวง, และผู้ขายที่ครบ 3 ดาวเตือนจนถูกระงับสิทธิ์ลงขาย 6 เดือน)
  const adminHash = bcrypt.hashSync('admin1234', 10);
  const member1Hash = bcrypt.hashSync('member1234', 10);
  const member2Hash = bcrypt.hashSync('member1234', 10);

  const insertUser = db.prepare(`
    INSERT INTO Users (
      username, email, phone_number, password_hash, role,
      bank_name, bank_account_no, bank_account_name,
      strike_count, strike_month, seller_banned_until,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // id = 1: Admin (คนกลาง Escrow)
  insertUser.run(
    'แอดมิน 007 (บัญชีกลาง Escrow)',
    'admin@007marketplace.com',
    '081-007-8899',
    adminHash,
    'Admin',
    'ธนาคารกสิกรไทย (บัญชีพักเงินกลางแพลตฟอร์ม)',
    '007-1-99999-8',
    'บจก. 007 บุ๊คมาร์เก็ตเพลส (Escrow)',
    0,
    currentMonth,
    null,
    nowIso
  );

  // id = 2: Member #1 (คุณสมชาย - มีดาวเตือน ⚠️⭐ 1 ดวงจากกรณีส่งของล่าช้าในอดีต)
  insertUser.run(
    'คุณสมชาย (Member #1)',
    'somchai@email.com',
    '089-111-2233',
    member1Hash,
    'Member',
    'ธนาคารไทยพาณิชย์ (SCB)',
    '405-2-88112-9',
    'นายสมชาย รักการอ่าน',
    1,
    currentMonth,
    null,
    nowIso
  );

  // id = 3: Member #2 (คุณพิมพ์ชนก - ประวัติส่งตรงเวลา 100% ดาวเตือน 0 ดวง)
  insertUser.run(
    'คุณพิมพ์ชนก (Member #2)',
    'pimchanok@email.com',
    '086-444-5566',
    member2Hash,
    'Member',
    'ธนาคารกสิกรไทย (KBANK)',
    '712-2-34567-0',
    'น.ส.พิมพ์ชนก สะสมวรรณกรรม',
    0,
    currentMonth,
    null,
    nowIso
  );

  // id = 4: Member #3 (คุณธนภัทร - ตัวอย่างผู้ขายที่ได้รับดาวเตือนครบ 3 ครั้งในเดือนเดียวกัน ⚠️⭐x3 ถูกระงับสิทธิ์การขายชั่วคราว 6 เดือน แต่ยังซื้อหนังสือได้ตามปกติ)
  insertUser.run(
    'คุณธนภัทร (ตัวอย่างถูกแบนขาย 6 เดือน)',
    'thanapat@email.com',
    '082-999-7788',
    member1Hash,
    'Member',
    'ธนาคารกรุงไทย (KTB)',
    '981-4-11223-0',
    'นายธนภัทร นักอ่าน',
    3,
    currentMonth,
    sixMonthsLaterIso,
    nowIso
  );

  // 2. Seed Books: 10 เล่ม ลงประกาศขายโดยคุณสมชาย (seller_id=2) และคุณพิมพ์ชนก (seller_id=3)
  const booksSeed = [
    {
      seller_id: 2, // ผู้ขาย: คุณสมชาย (⚠️⭐ 1 ดวง)
      code: 'MKT-BK01',
      title: 'ปาฏิหาริย์ร้านชำของคุณนามิยะ',
      en_title: 'The Miracles of the Namiya General Store',
      author: 'ฮิงาชิโนะ เคโงะ (Keigo Higashino)',
      translator: 'กนกวรรณ เกตุชัยมาศ',
      publisher: 'น้ำพุสำนักพิมพ์',
      category: 'translated-novel',
      category_name: 'นิยายแปล',
      original_price: 295,
      price: 185,
      shipping_fee: 35,
      packing_note: 'ผู้ขาย (คุณสมชาย) ส่งทาง Flash Express แพ็กใส่ซองกันกระแทกและดามกระดาษแข็งให้',
      condition_percent: 95,
      condition_grade: 'สภาพ 95%',
      defect_details: 'อ่านเองรอบเดียว สันกระดาษสะอาด ไม่มีรอยพับมุม มีที่คั่นหนังสือครบ',
      images_json: JSON.stringify({ bg1: '#0f172a', bg2: '#1e3a8a', accent: '#fbbf24', badge: 'นิยายแปล' }),
      stock_status: 'Reserved',
      stock: 1,
      is_new_arrival: 1,
      is_best_seller: 1,
      pages: 408,
      publish_year: 2564,
      isbn: '978-616-287-285-3',
      synopsis: 'โจรกระจอกสามคนหลบหนีเข้าไปซ่อนตัวในร้านชำนามิยะที่ร้างผู้คน ทว่าจู่ๆ ก็มีจดหมายปรึกษาปัญหาชีวิตสอดเข้ามาทางช่องรับจดหมายจากอดีต'
    },
    {
      seller_id: 3, // ผู้ขาย: คุณพิมพ์ชนก
      code: 'MKT-BK02',
      title: 'เพชรพระอุมา ตอน ไพรมหากาฬ เล่ม 1 (ปกแข็ง)',
      en_title: 'Phet Phra Uma Vol. 1 Hardcover',
      author: 'พนมเทียน',
      translator: '-',
      publisher: 'สำนักพิมพ์ ณ บ้านวรรณกรรม',
      category: 'rare-books',
      category_name: 'หนังสือหายาก',
      original_price: 850,
      price: 620,
      shipping_fee: 50,
      packing_note: 'ผู้ขาย (คุณพิมพ์ชนก) ส่ง Kerry Express ใส่กล่องพัสดุลูกฟูก ตัดรอบส่งทุกวันตอนเที่ยง',
      condition_percent: 88,
      condition_grade: 'สภาพ 88%',
      defect_details: 'ฉบับปกแข็งปั๊มทอง มุมปกมีรอยถลอกตามอายุการเก็บรักษา กระดาษด้านในสะอาด ไม่มีคราบน้ำ',
      images_json: JSON.stringify({ bg1: '#14532d', bg2: '#166534', accent: '#fbbf24', badge: 'หนังสือหายาก' }),
      stock_status: 'Reserved',
      stock: 1,
      is_new_arrival: 1,
      is_best_seller: 1,
      pages: 480,
      publish_year: 2548,
      isbn: '978-974-921-001-7',
      synopsis: 'ปฐมบทแห่งนวนิยายผจญภัยของ รพินทร์ ไพรวัลย์ พรานใหญ่ผู้นำคณะของ ม.ร.ว.ดาริน วราฤทธิ์ บุกป่าดงดิบ'
    },
    {
      seller_id: 2,
      code: 'MKT-BK03',
      title: 'ความลับของความลับ (Kafka on the Shore)',
      en_title: 'Kafka on the Shore',
      author: 'ฮารูกิ มูราคามิ (Haruki Murakami)',
      translator: 'นพดล เวชสวัสดิ์',
      publisher: 'สำนักพิมพ์กำมะหยี่',
      category: 'translated-novel',
      category_name: 'นิยายแปล',
      original_price: 550,
      price: 330,
      shipping_fee: 40,
      packing_note: 'ผู้ขายจัดส่งทางไปรษณีย์ไทย EMS ภายใน 1-2 วันหลังแอดมินยืนยันยอดเงิน',
      condition_percent: 90,
      condition_grade: 'สภาพ 90%',
      defect_details: 'มุมปกล่างขวามีรอยย่นประมาณ 2 มม. ขอบกระดาษด้านบนมีจุดเหลืองจางๆ 2 จุด',
      images_json: JSON.stringify({ bg1: '#7f1d1d', bg2: '#b91c1c', accent: '#fde047', badge: 'นิยายแปล' }),
      stock_status: 'Available',
      stock: 1,
      is_new_arrival: 1,
      is_best_seller: 0,
      pages: 616,
      publish_year: 2562,
      isbn: '978-616-7691-52-7',
      synopsis: 'เรื่องราวคู่ขนานของ คาฟคา ทามูระ เด็กหนุ่มวัย 15 ปีที่หนีออกจากบ้าน และ นาคาตะ ชายชราผู้พูดคุยกับแมวได้'
    },
    {
      seller_id: 3,
      code: 'MKT-BK04',
      title: 'ความสุขของกะทิ (ฉบับปกแข็งครบรอบ 15 ปี)',
      en_title: 'The Happiness of Kati',
      author: 'งามพรรณ เวชชาชีวะ',
      translator: '-',
      publisher: 'แพรวสำนักพิมพ์',
      category: 'thai-novel',
      category_name: 'นิยายไทย',
      original_price: 245,
      price: 140,
      shipping_fee: 30,
      packing_note: 'ผู้ขายส่ง J&T Express ค่าส่งเหมา 30 บาท แพ็กใส่กล่องอย่างดี',
      condition_percent: 94,
      condition_grade: 'สภาพ 94%',
      defect_details: 'ปกแข็งสมบูรณ์ มีรอยกดทับที่มุมสันปกด้านบนเล็กน้อย หน้ากระดาษด้านในสะอาด',
      images_json: JSON.stringify({ bg1: '#422006', bg2: '#854d0e', accent: '#fef08a', badge: 'นิยายไทย' }),
      stock_status: 'Available',
      stock: 1,
      is_new_arrival: 0,
      is_best_seller: 1,
      pages: 152,
      publish_year: 2562,
      isbn: '978-616-18-2410-5',
      synopsis: 'วรรณกรรมรางวัลซีไรต์ เรื่องราวของเด็กหญิงกะทิวัย 9 ขวบที่เติบโตมากับตายายริมคลองด้วยความสุขเรียบง่าย'
    },
    {
      seller_id: 2,
      code: 'MKT-BK05',
      title: 'บุพเพสันนิวาส (ฉบับพิมพ์ครั้งที่ 18)',
      en_title: 'Love Destiny',
      author: 'รอมแพง',
      translator: '-',
      publisher: 'ฟิสิกส์เซ็นเตอร์',
      category: 'thai-novel',
      category_name: 'นิยายไทย',
      original_price: 380,
      price: 199,
      shipping_fee: 35,
      packing_note: 'ผู้ขายส่ง Flash Express รอบเย็นทุกวันจันทร์-เสาร์',
      condition_percent: 85,
      condition_grade: 'สภาพ 85%',
      defect_details: 'สันกระดาษมีจุดเหลืองประปรายตามอายุหนังสือ มุมปกหน้ามีรอยพับจางๆ ไม่มีหน้าหลุด',
      images_json: JSON.stringify({ bg1: '#7c2d12', bg2: '#c2410c', accent: '#fed7aa', badge: 'นิยายไทย' }),
      stock_status: 'Available',
      stock: 1,
      is_new_arrival: 1,
      is_best_seller: 0,
      pages: 560,
      publish_year: 2561,
      isbn: '978-616-7023-45-8',
      synopsis: 'เรื่องราวของเกศสุรางค์ นักโบราณคดีสาวที่วิญญาณย้อนเวลากลับไปอยู่ในร่างของแม่หญิงการะเกดในสมัยกรุงศรีอยุธยา'
    },
    {
      seller_id: 3,
      code: 'MKT-BK06',
      title: 'SLAM DUNK สแลมดังก์ Big Book เล่ม 1',
      en_title: 'Slam Dunk Kanzeban Vol. 1',
      author: 'ทาเคฮิโกะ อิโนอุเอะ (Takehiko Inoue)',
      translator: 'ทีมงานเนชั่นเอ็ดดูเทนเมนท์',
      publisher: 'NED Comics',
      category: 'manga',
      category_name: 'การ์ตูน/มังงะ',
      original_price: 250,
      price: 170,
      shipping_fee: 35,
      packing_note: 'ผู้ขายใส่กล่องพัสดุพร้อมกระดาษกันกระแทก ส่งผ่าน Kerry Express',
      condition_percent: 96,
      condition_grade: 'สภาพ 96%',
      defect_details: 'กระดาษปอนด์ หน้าสีครบทุกหน้า สันปกคมกริบ ไม่มีรอยแม็กหรือเทปกาว',
      images_json: JSON.stringify({ bg1: '#7f1d1d', bg2: '#dc2626', accent: '#ffffff', badge: 'มังงะ Big Book' }),
      stock_status: 'Available',
      stock: 2,
      is_new_arrival: 1,
      is_best_seller: 1,
      pages: 240,
      publish_year: 2565,
      isbn: '978-616-515-890-9',
      synopsis: 'ซากุรางิ ฮานามิจิ นักเรียนหนุ่มเลือดร้อนก้าวเข้าสู่ชมรมบาสเกตบอลโรงเรียนโชโฮคุ'
    },
    {
      seller_id: 2,
      code: 'MKT-BK07',
      title: 'วันพีซ (ONE PIECE) เล่ม 100 ฉบับพิเศษ',
      en_title: 'One Piece Vol. 100 Special Edition',
      author: 'เออิจิโระ โอดะ (Eiichiro Oda)',
      translator: 'ซึบาสะ',
      publisher: 'Siam Inter Comics',
      category: 'manga',
      category_name: 'การ์ตูน/มังงะ',
      original_price: 150,
      price: 95,
      shipping_fee: 30,
      packing_note: 'ผู้ขายส่งไปรษณีย์ลงทะเบียน/Flash ค่าส่ง 30 บาท แถมโปสการ์ดเล่ม 100 ให้ครบ',
      condition_percent: 92,
      condition_grade: 'สภาพ 92%',
      defect_details: 'มุมปกหลังด้านล่างมีรอยงอเล็กน้อย แถมโปสการ์ดที่ระลึกเล่ม 100 ครบในเล่ม',
      images_json: JSON.stringify({ bg1: '#1e1b4b', bg2: '#4338ca', accent: '#f59e0b', badge: 'VOL. 100' }),
      stock_status: 'Available',
      stock: 1,
      is_new_arrival: 1,
      is_best_seller: 0,
      pages: 216,
      publish_year: 2565,
      isbn: '978-616-492-910-4',
      synopsis: 'ศึกตัดสินบนเกาะโอนิกาชิมะ ลูฟี่และพรรคพวกหมวกฟางปะทะสองจักรพรรดิในเล่มฉลองครบรอบเล่มที่ 100'
    },
    {
      seller_id: 3,
      code: 'MKT-BK08',
      title: 'Atomic Habits เพราะชีวิตดีได้กว่าที่เป็น',
      en_title: 'Atomic Habits',
      author: 'เจมส์ เคลียร์ (James Clear)',
      translator: 'ประเวศ หงส์จินดา',
      publisher: 'Change+ (เชนจ์พลัส)',
      category: 'self-help',
      category_name: 'พัฒนาตัวเอง',
      original_price: 285,
      price: 180,
      shipping_fee: 35,
      packing_note: 'ผู้ขายส่งด่วน EMS แพ็กหุ้มพลาสติกกันชื้นอย่างดี',
      condition_percent: 95,
      condition_grade: 'สภาพ 95%',
      defect_details: 'สภาพดีมาก ไม่มีรอยขีดเขียนหรือพับมุมเลยแม้แต่หน้าเดียว',
      images_json: JSON.stringify({ bg1: '#111827', bg2: '#374151', accent: '#fbbf24', badge: 'พัฒนาตัวเอง' }),
      stock_status: 'Available',
      stock: 1,
      is_new_arrival: 1,
      is_best_seller: 1,
      pages: 320,
      publish_year: 2565,
      isbn: '978-616-08-3858-5',
      synopsis: 'คู่มือการสร้างนิสัยที่ดีและเลิกนิสัยเสียด้วยการปรับเปลี่ยนพฤติกรรมเพียงวันละ 1%'
    },
    {
      seller_id: 2,
      code: 'MKT-BK09',
      title: 'เพราะเป็นวัยรุ่นจึงเจ็บปวด',
      en_title: 'Youth, It’s Painful',
      author: 'คิมรันโด (Kim Rando)',
      translator: 'วิทิยา จันทร์พันธ์',
      publisher: 'Springbooks',
      category: 'self-help',
      category_name: 'พัฒนาตัวเอง',
      original_price: 245,
      price: 130,
      shipping_fee: 30,
      packing_note: 'ผู้ขายจัดส่งผ่าน Flash Express ค่าส่ง 30 บาท',
      condition_percent: 90,
      condition_grade: 'สภาพ 90%',
      defect_details: 'มีรอยไฮไลท์สีเหลืองอ่อนๆ ประมาณ 3 หน้าแรก นอกนั้นสะอาด ปกหน้า-หลังสมบูรณ์',
      images_json: JSON.stringify({ bg1: '#064e3b', bg2: '#047857', accent: '#a7f3d0', badge: 'จิตวิทยา' }),
      stock_status: 'Available',
      stock: 1,
      is_new_arrival: 0,
      is_best_seller: 1,
      pages: 296,
      publish_year: 2561,
      isbn: '978-616-18-0922-5',
      synopsis: 'หนังสือจิตวิทยาพัฒนาตัวเองจากเกาหลีที่ปลอบประโลมหัวใจคนหนุ่มสาวซึ่งกำลังหลงทางและกังวลกับอนาคต'
    },
    {
      seller_id: 3,
      code: 'MKT-BK10',
      title: 'เจ้าชายน้อย (Le Petit Prince - ฉบับปกผ้า)',
      en_title: 'The Little Prince Clothbound Edition',
      author: 'อ็องตวน เดอ แซ็งแตกซูว์เปรี',
      translator: 'อำพรรณ โอตระกูล',
      publisher: 'สำนักพิมพ์จินดาสาส์น',
      category: 'rare-books',
      category_name: 'หนังสือหายาก',
      original_price: 590,
      price: 440,
      shipping_fee: 45,
      packing_note: 'ผู้ขายส่งใส่กล่องแข็งป้องกันมุมปกผ้า ค่าจัดส่ง 45 บาท',
      condition_percent: 95,
      condition_grade: 'สภาพ 95%',
      defect_details: 'ฉบับปกผ้าแคนวาสพิมพ์สีน้ำเงินเข้ม ปั๊มฟอยล์ทองดวงดาว สภาพสมบูรณ์ 95% พร้อมริบบิ้นคั่นหนังสือ',
      images_json: JSON.stringify({ bg1: '#0c4a6e', bg2: '#0369a1', accent: '#fcd34d', badge: 'ปกผ้าสะสม' }),
      stock_status: 'Sold Out',
      stock: 0,
      is_new_arrival: 1,
      is_best_seller: 1,
      pages: 144,
      publish_year: 2560,
      isbn: '978-616-921-880-7',
      synopsis: 'วรรณกรรมเยาวชนระดับโลกในรูปแบบปกผ้าควรค่าแก่การสะสม เรื่องราวของนักบินและเจ้าชายน้อยจากดาว B-612'
    }
  ];

  const insertBook = db.prepare(`
    INSERT INTO Books (
      seller_id, code, title, en_title, author, translator, publisher,
      category, category_name, original_price, price, shipping_fee, packing_note,
      condition_percent, condition_grade, defect_details, images_json,
      stock_status, stock, is_new_arrival, is_best_seller,
      pages, publish_year, isbn, synopsis, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const b of booksSeed) {
    insertBook.run(
      b.seller_id, b.code, b.title, b.en_title, b.author, b.translator, b.publisher,
      b.category, b.category_name, b.original_price, b.price, b.shipping_fee, b.packing_note,
      b.condition_percent, b.condition_grade, b.defect_details, b.images_json,
      b.stock_status, b.stock, b.is_new_arrival, b.is_best_seller,
      b.pages, b.publish_year, b.isbn, b.synopsis, nowIso
    );
  }

  // 3. Seed Reservations
  const insertReservation = db.prepare(`
    INSERT INTO Reservations (book_id, buyer_id, seller_id, queue_no, status, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const fiveHoursLaterIso = new Date(Date.now() + FIVE_HOURS_MS).toISOString();
  const fourHoursHalfLaterIso = new Date(Date.now() + (4.5 * 60 * 60 * 1000)).toISOString();
  const pastExpiredIso = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  insertReservation.run(1, 3, 2, 1, 'Active', fiveHoursLaterIso, nowIso);
  insertReservation.run(2, 2, 3, 1, 'Active', fourHoursHalfLaterIso, nowIso);
  insertReservation.run(6, 2, 3, 1, 'Expired', pastExpiredIso, pastExpiredIso);

  // 4. Seed Chat Rooms & End-to-End AI Chatbot Messages
  const insertRoom = db.prepare(`
    INSERT INTO ChatRooms (room_code, book_id, buyer_id, seller_id, admin_id, reservation_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?)
  `);

  const insertMsg = db.prepare(`
    INSERT INTO ChatMessages (room_id, sender_id, sender_role, sender_name, message, attachment_note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // ห้องแชทที่ 1: สำหรับการจองหนังสือเล่มที่ 1 (ผู้ซื้อ: คุณพิมพ์ชนก #3, ผู้ขาย: คุณสมชาย #2, แอดมิน #1)
  insertRoom.run('ROOM-BK01-B3', 1, 3, 2, 1, nowIso, nowIso);
  insertMsg.run(
    1,
    null,
    'AI_Bot',
    '🤖 AI Assistant (บอทดูแลการซื้อขายครบวงจร)',
    '📌 [ขั้นตอนที่ 1/6: กดจองคิวสำเร็จ & แจ้งยอดโอนเข้าบัญชีกลาง]\nยินดีต้อนรับสู่ห้องแชทรายการจองหนังสือ "ปาฏิหาริย์ร้านชำของคุณนามิยะ"!\n• ลำดับคิวของคุณ: คิวที่ 1 (สถานะ Active - มีเวลาชำระเงินภายใน 5 ชั่วโมง)\n• ข้อมูลจากผู้ขาย: สภาพ 95% | ค่าหนังสือ ฿185 + ค่าส่ง ฿35 + ค่าธรรมเนียมระบบ (10 บาท/เล่ม) ฿10 = ยอดโอนสุทธิ ฿230\n• ขั้นตอนปลอดภัย (Escrow): กรุณาโอนเงินเข้าบัญชีกลางของแอดมิน (กสิกรไทย 007-1-99999-8) แล้วแจ้งสลิปในห้องแชทหรือกดปุ่มชำระเงินได้เลย ระบบ AI จะคอยแจ้งเตือนทุกขั้นตอนจนจบการขายครับ!',
    '',
    nowIso
  );
  insertMsg.run(
    1,
    3,
    'Buyer',
    'คุณพิมพ์ชนก (Member #2)',
    'สวัสดีค่ะคุณสมชาย สนใจรับเล่มนี้ค่ะ ขอดูรูปสันกระดาษชัดๆ เพิ่มเติมอีกนิดได้ไหมคะ เดี๋ยวโอนเข้าบัญชีกลางแอดมินให้เลยค่ะ',
    '',
    nowIso
  );
  insertMsg.run(
    1,
    null,
    'AI_Bot',
    '🤖 AI Assistant (บอทดูแลการซื้อขายครบวงจร)',
    '🤖 ระบบ AI รับทราบคำขอรูปภาพเพิ่มเติมของคุณพิมพ์ชนกแล้ว! เบื้องต้นผู้ขายระบุสภาพไว้ที่ 95% ("อ่านเองรอบเดียว สันกระดาษสะอาด ไม่มีรอยพับมุม") ทั้งนี้เมื่อโอนเงินเข้าบัญชีกลางแล้ว ผู้ขายจะต้องจัดส่งหนังสือและกรอกเลขพัสดุภายใน 1-2 วัน (48 ชม.) มิฉะนั้นระบบจะติดดาวเตือน ⚠️⭐ ที่โปรไฟล์ผู้ขายทันทีครับ',
    '',
    nowIso
  );
  insertMsg.run(
    1,
    2,
    'Seller',
    'คุณสมชาย (Member #1)',
    'สวัสดีครับคุณพิมพ์ชนก เล่มนี้สภาพดีมากครับ ถ้าโอนเข้าบัญชีกลางแอดมินแล้ว แจ้งได้เลยนะครับ พรุ่งนี้เช้าผมแพ็กดามกระดาษแข็งส่ง Flash Express ให้ทันทีครับ',
    '',
    nowIso
  );

  // ห้องแชทที่ 2: สำหรับการจองหนังสือเล่มที่ 2 (เพชรพระอุมา - ผู้ซื้อ: คุณสมชาย #2, ผู้ขาย: คุณพิมพ์ชนก #3, แอดมิน #1)
  insertRoom.run('ROOM-BK02-B2', 2, 2, 3, 2, nowIso, nowIso);
  insertMsg.run(
    2,
    null,
    'AI_Bot',
    '🤖 AI Assistant (บอทดูแลการซื้อขายครบวงจร)',
    '📌 [ขั้นตอนที่ 1/6: กดจองคิวสำเร็จ & แจ้งยอดโอนเข้าบัญชีกลาง]\nยินดีต้อนรับสู่ห้องแชทรายการจองหนังสือ "เพชรพระอุมา ตอน ไพรมหากาฬ เล่ม 1 (ปกแข็ง)"!\n• ลำดับคิวของคุณ: คิวที่ 1 (สถานะ Active - มีเวลาชำระเงินภายใน 5 ชั่วโมง)\n• ข้อมูลจากผู้ขาย: สภาพ 88% | ค่าหนังสือ ฿620 + ค่าส่ง ฿50 + ค่าธรรมเนียมระบบ (10 บาท/เล่ม) ฿10 = ยอดโอนสุทธิ ฿680\n• หากได้รับหนังสือแล้วพบปัญหา สามารถกดปุ่ม "🔄 แจ้งปัญหา / ขอคืนสินค้า" ด้านบนห้องแชทเพื่อระงับการโอนเงินชั่วคราวและเรียกแอดมินได้ทันทีครับ!',
    '',
    nowIso
  );

  // ห้องแชทที่ 3: ตัวอย่างห้องแชทที่มีการกดปุ่ม "🔄 แจ้งปัญหา / ขอคืนสินค้า" พร้อมแนบรูปหลักฐาน และ AI บอทระงับการโอนเงินชั่วคราว (Freeze Escrow)
  insertRoom.run('ROOM-BK09-B3', 9, 3, 2, null, nowIso, nowIso);
  insertMsg.run(
    3,
    null,
    'AI_Bot',
    '🤖 AI Assistant (บอทดูแลการซื้อขายครบวงจร)',
    '📦 [ขั้นตอนที่ 4/6: ผู้ขายจัดส่งหนังสือแล้ว]\nผู้ขาย (คุณสมชาย) ได้จัดส่งหนังสือ "เพราะเป็นวัยรุ่นจึงเจ็บปวด" เรียบร้อยแล้ว เลขพัสดุ: FLASH-TH019928374\n👉 เมื่อคุณพิมพ์ชนกได้รับหนังสือแล้ว กรุณาตรวจสอบสภาพภายใน 24 ชม. และกดปุ่ม "✅ ยืนยันรับสินค้า" หรือหากพบปัญหาสามารถกดปุ่ม "🔄 แจ้งปัญหา / ขอคืนสินค้า" ในห้องแชทนี้ได้ทันทีครับ',
    '',
    nowIso
  );
  insertMsg.run(
    3,
    3,
    'Buyer',
    'คุณพิมพ์ชนก (Member #2)',
    '🔄 [แจ้งปัญหา / ขอคืนสินค้า] เหตุผล: สภาพหนังสือไม่ตรงปก — ตรวจสอบภายใน 24 ชม. พบว่ามีรอยขีดเขียนด้วยปากกาเมจิกกว่า 15 หน้า ไม่ตรงกับที่ผู้ขายแจ้งไว้ว่ามีไฮไลท์แค่ 3 หน้าแรกค่ะ ขอแนบรูปหลักฐานเพื่อให้แอดมินตรวจสอบค่ะ',
    'แนบรูปหลักฐานสภาพหนังสือไม่ตรงปก (1 รูป)',
    nowIso
  );
  insertMsg.run(
    3,
    null,
    'AI_Bot',
    '🤖 AI Assistant (บอทดูแลการซื้อขายครบวงจร)',
    '🚨 [ขั้นตอนฉุกเฉิน: ระงับการโอนเงินชั่วคราว (Freeze Escrow) & ส่งแจ้งเตือนด่วนถึงแอดมิน]\nระบบ AI Chatbot ได้รับเรื่องแจ้งขอคืนสินค้าของคุณพิมพ์ชนกเรียบร้อยแล้ว!\n• สถานะเงินในบัญชีกลาง: ❄️ ระงับการโอนเงินให้ผู้ขายชั่วคราว (Frozen - Dispute Pending Admin)\n• แจ้งเตือนด่วน (Urgent Dispute Alert): ส่งไปยังหน้า Admin Dashboard เรียบร้อยแล้ว แอดมินกำลังเข้ามาตรวจสอบหลักฐานในห้องแชทนี้และสามารถกดอนุมัติคืนเงินเต็มจำนวนให้ผู้ซื้อได้ทันทีครับ',
    '',
    nowIso
  );

  // 5. Seed Orders
  const insertOrder = db.prepare(`
    INSERT INTO Orders (
      order_code, book_id, reservation_id, buyer_id, seller_id,
      book_title, book_price, shipping_fee, total_amount, platform_fee, seller_payout,
      status, slip_reference, tracking_no, shipping_deadline, inspection_expires_at,
      dispute_category, dispute_reason, dispute_evidence_image, escrow_frozen, strike_recorded, return_shipping_fee,
      recipient_name, recipient_phone, shipping_address, payout_status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const twentyFourHoursLaterIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const fortyEightHoursLaterIso = new Date(Date.now() + FORTY_EIGHT_HOURS_MS).toISOString();

  // Order #1: ขั้นที่ 1 (Pending Payment)
  insertOrder.run(
    'ESC-007201',
    4,
    null,
    2,
    3,
    'ความสุขของกะทิ (ฉบับปกแข็งครบรอบ 15 ปี)',
    140,
    30,
    180,
    10,
    170,
    'Pending Payment',
    'SLIP-SCB-20261025-0912 (โอนเข้าบัญชีกลางแอดมิน ฿180.00)',
    '',
    null,
    null,
    '',
    '',
    '',
    0,
    0,
    0,
    'คุณสมชาย (Member #1)',
    '089-111-2233',
    '99/12 ถ.ลาดพร้าว แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900',
    'Holding in Escrow',
    nowIso,
    nowIso
  );

  // Order #2: ขั้นที่ 2 (Paid - Awaiting Shipment)
  insertOrder.run(
    'ESC-007202',
    5,
    null,
    3,
    2,
    'บุพเพสันนิวาส (ฉบับพิมพ์ครั้งที่ 18)',
    199,
    35,
    244,
    10,
    234,
    'Paid - Awaiting Shipment',
    'SLIP-KBANK-20261024-1840 (แอดมินยืนยันรับเงินเข้าบัญชีกลางแล้ว)',
    '',
    fortyEightHoursLaterIso,
    null,
    '',
    '',
    '',
    0,
    0,
    0,
    'คุณพิมพ์ชนก (Member #2)',
    '086-444-5566',
    '55/8 หมู่ 4 ต.ในเมือง อ.เมืองขอนแก่น จ.ขอนแก่น 40000',
    'Holding in Escrow',
    nowIso,
    nowIso
  );

  // Order #3: ขั้นที่ 3 (Shipped)
  insertOrder.run(
    'ESC-007203',
    8,
    null,
    2,
    3,
    'Atomic Habits เพราะชีวิตดีได้กว่าที่เป็น',
    180,
    35,
    225,
    10,
    215,
    'Shipped',
    'SLIP-SCB-20261023-1410 (แอดมินถือเงินพักไว้ใน Escrow)',
    'EMS-EF998123456TH',
    fortyEightHoursLaterIso,
    twentyFourHoursLaterIso,
    '',
    '',
    '',
    0,
    0,
    0,
    'คุณสมชาย (Member #1)',
    '089-111-2233',
    '99/12 ถ.ลาดพร้าว แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900',
    'Holding in Escrow',
    nowIso,
    nowIso
  );

  // Order #4: ขั้นที่ 4 (Completed & Released)
  insertOrder.run(
    'ESC-007204',
    10,
    null,
    2,
    3,
    'เจ้าชายน้อย (Le Petit Prince - ฉบับปกผ้า)',
    440,
    45,
    495,
    10,
    485,
    'Completed & Released',
    'SLIP-SCB-20261020-1105',
    'KERRY-007554433TH',
    nowIso,
    nowIso,
    '',
    '',
    '',
    0,
    0,
    0,
    'คุณสมชาย (Member #1)',
    '089-111-2233',
    '99/12 ถ.ลาดพร้าว แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900',
    'Released to Seller',
    nowIso,
    nowIso
  );

  // Order #5: ตัวอย่างกรณีผู้ซื้อกดปุ่ม "🔄 แจ้งปัญหา / ขอคืนสินค้า" พร้อมรูปหลักฐาน และระบบระงับการโอนเงินชั่วคราว (Freeze Escrow)
  const sampleEvidenceSvg = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280">
      <rect width="400" height="280" rx="18" fill="#FFF5F5" stroke="#F87171" stroke-width="4"/>
      <rect x="28" y="24" width="344" height="190" rx="12" fill="#FFFFFF" stroke="#FCA5A5" stroke-width="2"/>
      <line x1="60" y1="65" x2="320" y2="65" stroke="#EF4444" stroke-width="6" stroke-linecap="round"/>
      <line x1="60" y1="95" x2="290" y2="95" stroke="#EF4444" stroke-width="6" stroke-linecap="round"/>
      <line x1="60" y1="125" x2="340" y2="125" stroke="#94A3B8" stroke-width="3"/>
      <line x1="60" y1="150" x2="260" y2="150" stroke="#EF4444" stroke-width="6" stroke-linecap="round"/>
      <text x="200" y="195" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="bold" fill="#B91C1C">📸 รูปหลักฐาน: รอยปากกาเมจิกขีดเขียนในเล่ม</text>
      <text x="200" y="250" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="bold" fill="#7F1D1D">แนบโดยผู้ซื้อ: คุณพิมพ์ชนก (Order #ESC-007205)</text>
    </svg>
  `);

  insertOrder.run(
    'ESC-007205',
    9,
    null,
    3,
    2,
    'เพราะเป็นวัยรุ่นจึงเจ็บปวด',
    130,
    30,
    170,
    10,
    160,
    'Disputed - Return Requested',
    'SLIP-KBANK-20261024-2100',
    'FLASH-TH019928374',
    nowIso,
    twentyFourHoursLaterIso,
    'สภาพหนังสือไม่ตรงปก',
    'ตรวจสอบภายใน 24 ชม. พบว่ามีรอยขีดเขียนด้วยปากกาเมจิกกว่า 15 หน้า ไม่ตรงกับที่ผู้ขายแจ้งไว้ว่ามีไฮไลท์แค่ 3 หน้าแรก',
    sampleEvidenceSvg,
    1, // escrow_frozen = 1 (ระงับการโอนเงินชั่วคราว)
    0,
    35,
    'คุณพิมพ์ชนก (Member #2)',
    '086-444-5566',
    '55/8 หมู่ 4 ต.ในเมือง อ.เมืองขอนแก่น จ.ขอนแก่น 40000',
    'Frozen - Dispute Pending Admin',
    nowIso,
    nowIso
  );

  // 6. Seed Reviews
  const insertReview = db.prepare(`
    INSERT INTO Reviews (order_id, book_id, seller_id, buyer_id, buyer_name, rating, comment, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertReview.run(
    4,
    10,
    3,
    2,
    'คุณสมชาย (Member #1)',
    5,
    'ได้รับหนังสือเจ้าชายน้อยฉบับปกผ้าแล้วครับ สภาพตรงปก 95% ตามที่คุณพิมพ์ชนกแจ้งเป๊ะ แพ็กใส่กล่องแข็งมาอย่างดีมากครับ',
    nowIso
  );
  insertReview.run(
    null,
    1,
    2,
    3,
    'คุณพิมพ์ชนก (Member #2)',
    5,
    'คุณสมชายตอบแชทไวมากค่ะ ถ่ายรูปปกหน้า-ปกหลังและสันหนังสือให้ดูครบถ้วน จัดส่งไวภายใน 1 วัน ประทับใจมากค่ะ',
    nowIso
  );
  insertReview.run(
    null,
    6,
    3,
    2,
    'นักอ่านสายสะสม (Verified Buyer)',
    5,
    'มังงะสภาพสะสมสวยกริบเหมือนมือหนึ่งเลยครับ ระบบคิวจองและบัญชีกลางมีค่าธรรมเนียมระบบแค่ 10 บาท/เล่ม คุ้มและปลอดภัยมากครับ',
    nowIso
  );

  console.log('✅ สร้างฐานข้อมูล Marketplace & Escrow (Users, Books, Reservations, ChatRooms, ChatMessages, Orders, Reviews + Indexes) สำเร็จ!');
}

if (require.main === module) {
  const forceReset = process.argv.includes('--reset');
  seedDatabase(forceReset);
}

module.exports = {
  getDb,
  seedDatabase,
  syncReservationQueues,
  recordSellerStrike,
  FIVE_HOURS_MS,
  FORTY_EIGHT_HOURS_MS,
  SIX_MONTHS_MS,
  ESCROW_FEE_PER_BOOK,
  PLATFORM_FEE_RATE
};
