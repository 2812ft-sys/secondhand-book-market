const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_DIR = __dirname;
const DB_PATH = path.join(DB_DIR, 'bookstore.sqlite');
const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000; // กำหนดเวลาให้ผู้ขายจัดส่งหนังสือภายใน 48 ชั่วโมง (1-2 วัน)
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
    -- 1. ตาราง Users (Unified Role: 'Member' หรือ 'Admin')
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
      reset_token TEXT,
      reset_expires_at TEXT,
      created_at TEXT NOT NULL
    );

    -- 2. ตาราง Books (หนังสือที่สมาชิกแต่ละรายลงประกาศขายเอง กำหนดราคา ค่าส่ง และวิธีแพ็กของเอง)
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

    -- 3. ตาราง Reservations (ระบบเข้าคิวจองหนังสือ ป้องกันการจองชนกันด้วย Unique Index คู่ book_id, buyer_id และ book_id, queue_no)
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

    -- 5. ตาราง ChatMessages (ข้อความในห้องแชทรายการจอง + บอท AI ตอบกลับเบื้องต้น)
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

    -- 6. ตาราง Orders (ระบบแอดมินเป็นตัวกลางพักเงิน Escrow 4 ขั้นตอน + shipping_deadline 48 ชม. + ตรวจสอบภายใน 24 ชม.)
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
      dispute_reason TEXT DEFAULT '',
      return_shipping_fee REAL DEFAULT 0,
      return_tracking_no TEXT DEFAULT '',
      recipient_name TEXT NOT NULL,
      recipient_phone TEXT NOT NULL,
      shipping_address TEXT NOT NULL,
      payout_status TEXT NOT NULL DEFAULT 'Holding in Escrow' CHECK (payout_status IN ('Waiting Buyer Payment', 'Holding in Escrow', 'Released to Seller', 'Refunded to Buyer (Seller Pays Return Fee)', 'Refunded to Buyer (Seller Overdue 48h)')),
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

    -- 8. Database Indexing (ดัชนีฐานข้อมูลเพื่อรองรับผู้ใช้งานพร้อมกันระดับแสนคน High Concurrency)
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

  // 1. Seed Users: 1 Admin (คนกลางพักเงิน) + 2 Members (ที่เป็นทั้งผู้ซื้อและผู้ขายในบัญชีเดียว)
  const adminHash = bcrypt.hashSync('admin1234', 10);
  const member1Hash = bcrypt.hashSync('member1234', 10);
  const member2Hash = bcrypt.hashSync('member1234', 10);

  const insertUser = db.prepare(`
    INSERT INTO Users (
      username, email, phone_number, password_hash, role,
      bank_name, bank_account_no, bank_account_name, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    nowIso
  );

  // id = 2: Member #1 (คุณสมชาย - ทั้งลงขายหนังสือของตัวเอง และกดจองซื้อของคนอื่น)
  insertUser.run(
    'คุณสมชาย (Member #1)',
    'somchai@email.com',
    '089-111-2233',
    member1Hash,
    'Member',
    'ธนาคารไทยพาณิชย์ (SCB)',
    '405-2-88112-9',
    'นายสมชาย รักการอ่าน',
    nowIso
  );

  // id = 3: Member #2 (คุณพิมพ์ชนก - ทั้งลงขายหนังสือสะสมของตัวเอง และกดจองซื้อของคุณสมชาย)
  insertUser.run(
    'คุณพิมพ์ชนก (Member #2)',
    'pimchanok@email.com',
    '086-444-5566',
    member2Hash,
    'Member',
    'ธนาคารกสิกรไทย (KBANK)',
    '712-2-34567-0',
    'น.ส.พิมพ์ชนก สะสมวรรณกรรม',
    nowIso
  );

  // 2. Seed Books: 10 เล่ม ลงประกาศขายโดยคุณสมชาย (seller_id=2) และคุณพิมพ์ชนก (seller_id=3)
  // ผู้ขายแต่ละรายกำหนดราคา ค่าจัดส่ง (shipping_fee) และเงื่อนไขการแพ็กของ (packing_note) ของตนเอง
  const booksSeed = [
    {
      seller_id: 2, // ผู้ขาย: คุณสมชาย
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
      stock_status: 'Reserved', // คุณพิมพ์ชนกจองคิว Active อยู่
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
      stock_status: 'Reserved', // คุณสมชายจองคิว Active อยู่
      stock: 1,
      is_new_arrival: 1,
      is_best_seller: 1,
      pages: 480,
      publish_year: 2548,
      isbn: '978-974-921-001-7',
      synopsis: 'ปฐมบทแห่งนวนิยายผจญภัยของ รพินทร์ ไพรวัลย์ พรานใหญ่ผู้นำคณะของ ม.ร.ว.ดาริน วราฤทธิ์ บุกป่าดงดิบ'
    },
    {
      seller_id: 2, // ผู้ขาย: คุณสมชาย
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
      seller_id: 3, // ผู้ขาย: คุณพิมพ์ชนก
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
      seller_id: 2, // ผู้ขาย: คุณสมชาย
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
      seller_id: 3, // ผู้ขาย: คุณพิมพ์ชนก
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
      seller_id: 2, // ผู้ขาย: คุณสมชาย
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
      seller_id: 3, // ผู้ขาย: คุณพิมพ์ชนก
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
      seller_id: 2, // ผู้ขาย: คุณสมชาย
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
      seller_id: 3, // ผู้ขาย: คุณพิมพ์ชนก
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

  // 3. Seed Reservations (ทั้งคุณสมชายและคุณพิมพ์ชนกต่างเป็นทั้งผู้ซื้อและผู้ขายของกันและกัน)
  const insertReservation = db.prepare(`
    INSERT INTO Reservations (book_id, buyer_id, seller_id, queue_no, status, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const fiveHoursLaterIso = new Date(Date.now() + FIVE_HOURS_MS).toISOString();
  const fourHoursHalfLaterIso = new Date(Date.now() + (4.5 * 60 * 60 * 1000)).toISOString();
  const pastExpiredIso = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  // คิวจอง #1: คุณพิมพ์ชนก (buyer_id=3) กดจองหนังสือเล่มที่ 1 (ร้านชำนามิยะ) ของคุณสมชาย (seller_id=2) -> คิวที่ 1 สถานะ 'Active' (นับถอยหลัง 5 ชม.)
  insertReservation.run(1, 3, 2, 1, 'Active', fiveHoursLaterIso, nowIso);

  // คิวจอง #2: คุณสมชาย (buyer_id=2) กดจองหนังสือเล่มที่ 2 (เพชรพระอุมา ปกแข็ง) ของคุณพิมพ์ชนก (seller_id=3) -> คิวที่ 1 สถานะ 'Active' (นับถอยหลัง 5 ชม.)
  insertReservation.run(2, 2, 3, 1, 'Active', fourHoursHalfLaterIso, nowIso);

  // คิวจอง #3: ตัวอย่างคิวที่หมดอายุแล้ว (Expired) ของคุณสมชายที่เคยจองเล่มที่ 6 (SLAM DUNK ของคุณพิมพ์ชนก)
  insertReservation.run(6, 2, 3, 1, 'Expired', pastExpiredIso, pastExpiredIso);

  // 4. Seed Chat Rooms & AI Auto-Reply Messages (ห้องแชทรายการจอง: ผู้ซื้อ + ผู้ขาย + แอดมิน + บอท AI)
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
    '🤖 AI Assistant (บอทดูแลรายการ)',
    'ยินดีต้อนรับสู่ห้องแชทรายการจองหนังสือ "ปาฏิหาริย์ร้านชำของคุณนามิยะ"!\n• ลำดับคิวของคุณ: คิวที่ 1 (สถานะ Active - มีเวลาชำระเงินภายใน 5 ชั่วโมง)\n• ข้อมูลจากผู้ขาย: สภาพ 95% (อ่านเองรอบเดียว สันกระดาษสะอาด) | ค่าหนังสือ ฿185 + ค่าส่ง ฿35 + ค่าธรรมเนียมระบบ (10 บาท/เล่ม) ฿10 = ยอดโอนสุทธิ ฿230\n• ขั้นตอนปลอดภัย (Escrow): กรุณาโอนเงินเข้าบัญชีกลางของแอดมิน (กสิกรไทย 007-1-99999-8) แล้วแจ้งสลิปในห้องแชทหรือกดปุ่มชำระเงินได้เลย ระบบได้แจ้งเตือนผู้ขายและแอดมินให้เรียบร้อยแล้วครับ!',
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
    '🤖 AI Assistant (บอทดูแลรายการ)',
    '📌 ระบบ AI รับทราบคำขอรูปภาพเพิ่มเติมของคุณพิมพ์ชนกแล้ว! เบื้องต้นผู้ขายระบุสภาพไว้ที่ 95% ("อ่านเองรอบเดียว สันกระดาษสะอาด ไม่มีรอยพับมุม") และเงื่อนไขการแพ็กคือ "ส่งทาง Flash Express แพ็กใส่ซองกันกระแทกและดามกระดาษแข็งให้" ระบบได้ส่งการแจ้งเตือนไปยังผู้ขาย (คุณสมชาย) และแอดมินเพื่อเข้ามาตอบกลับแล้วครับ',
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
    '🤖 AI Assistant (บอทดูแลรายการ)',
    'ยินดีต้อนรับสู่ห้องแชทรายการจองหนังสือ "เพชรพระอุมา ตอน ไพรมหากาฬ เล่ม 1 (ปกแข็ง)"!\n• ลำดับคิวของคุณ: คิวที่ 1 (สถานะ Active - มีเวลาชำระเงินภายใน 5 ชั่วโมง)\n• ข้อมูลจากผู้ขาย: สภาพ 88% (ฉบับปกแข็งปั๊มทอง มุมปกมีรอยถลอกตามอายุ) | ค่าหนังสือ ฿620 + ค่าส่ง ฿50 + ค่าธรรมเนียมระบบ (10 บาท/เล่ม) ฿10 = ยอดโอนสุทธิ ฿680\n• หากต้องการสอบถามเพิ่มเติม พิมพ์ข้อความในแชทนี้ได้ตลอดเวลา ระบบได้แจ้งเตือนผู้ขายและแอดมินให้แล้วครับ!',
    '',
    nowIso
  );

  // 5. Seed Orders: จำลองครบทุกสถานะของระบบแอดมินพักเงิน (บวกค่าบริการส่วนกลาง 10 บาท/เล่ม + กำหนดส่งของภายใน 48 ชม.)
  const insertOrder = db.prepare(`
    INSERT INTO Orders (
      order_code, book_id, reservation_id, buyer_id, seller_id,
      book_title, book_price, shipping_fee, total_amount, platform_fee, seller_payout,
      status, slip_reference, tracking_no, shipping_deadline, inspection_expires_at, dispute_reason, return_shipping_fee,
      recipient_name, recipient_phone, shipping_address, payout_status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const twentyFourHoursLaterIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const fortyEightHoursLaterIso = new Date(Date.now() + FORTY_EIGHT_HOURS_MS).toISOString();

  // Order #1: ขั้นที่ 1 (Pending Payment) - ผู้ซื้อโอนเงินเข้าบัญชีกลางแอดมินและแนบสลิปแล้ว รอแอดมินกดยืนยันรับเงิน
  insertOrder.run(
    'ESC-007201',
    4, // ความสุขของกะทิ (ผู้ขาย: คุณพิมพ์ชนก #3, ผู้ซื้อ: คุณสมชาย #2)
    null,
    2,
    3,
    'ความสุขของกะทิ (ฉบับปกแข็งครบรอบ 15 ปี)',
    140,
    30,
    180, // ค่าหนังสือ 140 + ค่าส่ง 30 + ค่าดูแลบัญชีกลาง 10 = ยอดโอนสุทธิ 180
    10,  // ค่าบริการบัญชีกลาง 10 บาท/เล่ม
    170, // โอนให้ผู้ขาย: ราคาหนังสือ 140 + ค่าส่ง 30 = 170 บาท
    'Pending Payment',
    'SLIP-SCB-20261025-0912 (โอนเข้าบัญชีกลางแอดมิน ฿180.00)',
    '',
    null, // ยังไม่เริ่มนับ 48 ชม. จนกว่าแอดมินจะกดยืนยันรับเงิน (ขั้นที่ 2)
    null,
    '',
    0,
    'คุณสมชาย (Member #1)',
    '089-111-2233',
    '99/12 ถ.ลาดพร้าว แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900',
    'Holding in Escrow',
    nowIso,
    nowIso
  );

  // Order #2: ขั้นที่ 2 (Paid - Awaiting Shipment) - แอดมินตรวจสอบยอดเงินและยืนยันรับเงินเข้าบัญชีกลางแล้ว ตั้งเวลา shipping_deadline 48 ชม. ให้ผู้ขายจัดส่งและกรอกเลขพัสดุ
  insertOrder.run(
    'ESC-007202',
    5, // บุพเพสันนิวาส (ผู้ขาย: คุณสมชาย #2, ผู้ซื้อ: คุณพิมพ์ชนก #3)
    null,
    3,
    2,
    'บุพเพสันนิวาส (ฉบับพิมพ์ครั้งที่ 18)',
    199,
    35,
    244, // ค่าหนังสือ 199 + ค่าส่ง 35 + ค่าดูแลบัญชีกลาง 10 = ยอดโอนสุทธิ 244
    10,  // ค่าบริการบัญชีกลาง 10 บาท/เล่ม
    234, // โอนให้ผู้ขาย: ราคาหนังสือ 199 + ค่าส่ง 35 = 234 บาท
    'Paid - Awaiting Shipment',
    'SLIP-KBANK-20261024-1840 (แอดมินยืนยันรับเงินเข้าบัญชีกลางแล้ว)',
    '',
    fortyEightHoursLaterIso, // กำหนดให้ผู้ขายจัดส่งหนังสือภายใน 48 ชั่วโมง (2 วัน)
    null,
    '',
    0,
    'คุณพิมพ์ชนก (Member #2)',
    '086-444-5566',
    '55/8 หมู่ 4 ต.ในเมือง อ.เมืองขอนแก่น จ.ขอนแก่น 40000',
    'Holding in Escrow',
    nowIso,
    nowIso
  );

  // Order #3: ขั้นที่ 3 (Shipped) - ผู้ขายส่งของและใส่เลขพัสดุแล้ว ลูกค้ามีเวลาตรวจสอบสภาพสินค้าภายใน 24 ชม.
  insertOrder.run(
    'ESC-007203',
    8, // Atomic Habits (ผู้ขาย: คุณพิมพ์ชนก #3, ผู้ซื้อ: คุณสมชาย #2)
    null,
    2,
    3,
    'Atomic Habits เพราะชีวิตดีได้กว่าที่เป็น',
    180,
    35,
    225, // ค่าหนังสือ 180 + ค่าส่ง 35 + ค่าดูแลบัญชีกลาง 10 = ยอดโอนสุทธิ 225
    10,  // ค่าบริการบัญชีกลาง 10 บาท/เล่ม
    215, // โอนให้ผู้ขาย: ราคาหนังสือ 180 + ค่าส่ง 35 = 215 บาท
    'Shipped',
    'SLIP-SCB-20261023-1410 (แอดมินถือเงินพักไว้ใน Escrow)',
    'EMS-EF998123456TH',
    fortyEightHoursLaterIso,
    twentyFourHoursLaterIso, // เวลาตรวจสอบสภาพภายใน 24 ชั่วโมงหลังได้รับหนังสือ
    '',
    0,
    'คุณสมชาย (Member #1)',
    '089-111-2233',
    '99/12 ถ.ลาดพร้าว แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900',
    'Holding in Escrow',
    nowIso,
    nowIso
  );

  // Order #4: ขั้นที่ 4 (Completed & Released) - ลูกค้าตรวจสอบภายใน 24 ชม. แล้วตรงปก แอดมินโอนเงินให้ผู้ขายเรียบร้อย
  insertOrder.run(
    'ESC-007204',
    10, // เจ้าชายน้อย ปกผ้า (ผู้ขาย: คุณพิมพ์ชนก #3, ผู้ซื้อ: คุณสมชาย #2)
    null,
    2,
    3,
    'เจ้าชายน้อย (Le Petit Prince - ฉบับปกผ้า)',
    440,
    45,
    495, // ค่าหนังสือ 440 + ค่าส่ง 45 + ค่าดูแลบัญชีกลาง 10 = ยอดโอนสุทธิ 495
    10,  // ค่าบริการบัญชีกลาง 10 บาท/เล่ม
    485, // โอนให้ผู้ขาย: ราคาหนังสือ 440 + ค่าส่ง 45 = 485 บาท
    'Completed & Released',
    'SLIP-SCB-20261020-1105',
    'KERRY-007554433TH',
    nowIso,
    nowIso,
    '',
    0,
    'คุณสมชาย (Member #1)',
    '089-111-2233',
    '99/12 ถ.ลาดพร้าว แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900',
    'Released to Seller',
    nowIso,
    nowIso
  );

  // Order #5: ตัวอย่างกรณีสภาพไม่ตรงปก (Disputed - Return Requested)
  insertOrder.run(
    'ESC-007205',
    9, // เพราะเป็นวัยรุ่นจึงเจ็บปวด (ผู้ขาย: คุณสมชาย #2, ผู้ซื้อ: คุณพิมพ์ชนก #3)
    null,
    3,
    2,
    'เพราะเป็นวัยรุ่นจึงเจ็บปวด',
    130,
    30,
    170, // ค่าหนังสือ 130 + ค่าส่ง 30 + ค่าดูแลบัญชีกลาง 10 = ยอดโอนสุทธิ 170
    10,  // ค่าบริการบัญชีกลาง 10 บาท/เล่ม
    160, // ราคาหนังสือ 130 + ค่าส่ง 30 = 160 บาท
    'Disputed - Return Requested',
    'SLIP-KBANK-20261024-2100',
    'FLASH-TH019928374',
    nowIso,
    twentyFourHoursLaterIso,
    'ตรวจสอบภายใน 24 ชม. พบว่ามีรอยขีดเขียนด้วยปากกาเมจิกกว่า 15 หน้า ไม่ตรงกับที่ผู้ขายแจ้งไว้ว่ามีไฮไลท์แค่ 3 หน้าแรก',
    35, // ค่าจัดส่งในการส่งคืนที่ผู้ขายต้องชำระเพิ่ม
    'คุณพิมพ์ชนก (Member #2)',
    '086-444-5566',
    '55/8 หมู่ 4 ต.ในเมือง อ.เมืองขอนแก่น จ.ขอนแก่น 40000',
    'Holding in Escrow',
    nowIso,
    nowIso
  );

  // 6. Seed Reviews (คะแนนรีวิวผู้ขายและรีวิวการซื้อขายจริง)
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
  FIVE_HOURS_MS,
  FORTY_EIGHT_HOURS_MS,
  ESCROW_FEE_PER_BOOK,
  PLATFORM_FEE_RATE
};
