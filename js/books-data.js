// ข้อมูลหมวดหมู่ทั้ง 20 หมวดหมู่ (รวม "✨ ทั้งหมด") และข้อมูลหนังสือตัวอย่างครบทุกหมวดหมู่
// โทนสีพาสเทลสว่างละมุน: ฟ้ามิ้นต์ #26A69A - ครีมพีช #FDF2E2 - พื้นครีม #FAF7F2

// สูตรคำนวณค่าธรรมเนียมระบบ (Escrow Fee) แบบผสม: 5 บาท + 5% ของราคาหนังสือ (ปัดเศษเป็นจำนวนเต็ม ขั้นต่ำ 5฿ สูงสุดไม่เกิน 30฿ ต่อเล่ม)
function calculateEscrowFee(bookPrice) {
  const price = Math.max(0, Number(bookPrice) || 0);
  return Math.min(30, Math.max(5, Math.round(5 + price * 0.05)));
}
window.calculateEscrowFee = calculateEscrowFee;

// ฟังก์ชัน esc(s) ป้องกัน Stored XSS สำหรับแปลงอักขระพิเศษ (& < > " ') ก่อนแสดงผลใน HTML
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.esc = esc;

const CATEGORIES = [
  {
    id: 'thai-novel',
    name: 'นวนิยายไทย',
    enName: 'Thai Novels',
    icon: '📖',
    description: 'นวนิยายไทยร่วมสมัย รางวัลซีไรต์ และนิยายรักจากคลังสะสมของสมาชิก',
    color: '#E9964A',
    accent: '#FDF2E2'
  },
  {
    id: 'translated-novel',
    name: 'นวนิยายแปล',
    enName: 'Translated Novels',
    icon: '🌍',
    description: 'วรรณกรรมแปลจากญี่ปุ่น ยุโรป และอเมริกาที่นักอ่านส่งต่อ',
    color: '#26A69A',
    accent: '#E0F4F1'
  },
  {
    id: 'bl-gl',
    name: 'นิยายวาย / ยูริ',
    enName: 'BL & GL Novels',
    icon: '💕',
    description: 'นิยาย Boy Love และ Girl Love ยอดฮิต พร้อมของแถมรอบจอง',
    color: '#E57A93',
    accent: '#FCE8EE'
  },
  {
    id: 'mystery-thriller',
    name: 'สืบสวนสอบสวน / ระทึกขวัญ',
    enName: 'Mystery & Thriller',
    icon: '🕵️‍♂️',
    description: 'นิยายฆาตกรรม ปริศนาห้องปิดตาย และสืบสวนสอบสวนสุดเข้มข้น',
    color: '#2A9D8F',
    accent: '#E0F4F1'
  },
  {
    id: 'fantasy-scifi',
    name: 'แฟนตาซี / ไซไฟ',
    enName: 'Fantasy & Sci-Fi',
    icon: '🐉',
    description: 'โลกเวทมนตร์ ผจญภัยต่างโลก และนิยายวิทยาศาสตร์ล้ำจินตนาการ',
    color: '#5C88C4',
    accent: '#E5EFF9'
  },
  {
    id: 'manga',
    name: 'การ์ตูน / มังงะ',
    enName: 'Comics & Manga',
    icon: '🎨',
    description: 'มังงะญี่ปุ่นลิขสิทธิ์แท้ เล่มเดี่ยวและบ็อกซ์เซ็ตครบชุดสะสม',
    color: '#E9964A',
    accent: '#FDF2E2'
  },
  {
    id: 'youth-classic',
    name: 'วรรณกรรมเยาวชน / คลาสสิก',
    enName: 'Youth & Classics',
    icon: '📚',
    description: 'วรรณกรรมเยาวชนอบอุ่นหัวใจและวรรณกรรมคลาสสิกอมตะระดับโลก',
    color: '#26A69A',
    accent: '#E0F4F1'
  },
  {
    id: 'self-help',
    name: 'พัฒนาตนเอง / จิตวิทยา',
    enName: 'Self-Help & Psychology',
    icon: '💡',
    description: 'หนังสือจิตวิทยาพัฒนาตัวเอง การจัดระเบียบชีวิต และฮีลใจ',
    color: '#F4A261',
    accent: '#FDF2E2'
  },
  {
    id: 'business-finance',
    name: 'ธุรกิจ / การเงินการลงทุน',
    enName: 'Business & Finance',
    icon: '💼',
    description: 'การวางแผนการเงิน หุ้น การลงทุน และการบริหารธุรกิจยุคใหม่',
    color: '#2A9D8F',
    accent: '#E0F4F1'
  },
  {
    id: 'education-exam',
    name: 'การศึกษา / เตรียมสอบ',
    enName: 'Education & Exam Prep',
    icon: '🎓',
    description: 'คู่มือสรุปเนื้อหา เตรียมสอบ TGAT/TPAT, A-Level และสอบราชการ',
    color: '#6C8EAD',
    accent: '#EBF2F7'
  },
  {
    id: 'foreign-lang',
    name: 'ภาษาต่างประเทศ',
    enName: 'Foreign Languages',
    icon: '🗣️',
    description: 'หนังสือฝึกภาษาอังกฤษ ญี่ปุ่น จีน เกาหลี TOEIC และ IELTS',
    color: '#E9964A',
    accent: '#FDF2E2'
  },
  {
    id: 'computer-tech',
    name: 'คอมพิวเตอร์ / เทคโนโลยี',
    enName: 'Computer & Technology',
    icon: '💻',
    description: 'เขียนโปรแกรม Python, JavaScript, AI, Data Science และ UX/UI',
    color: '#26A69A',
    accent: '#E0F4F1'
  },
  {
    id: 'science-general',
    name: 'วิทยาศาสตร์ / ความรู้ทั่วไป',
    enName: 'Science & General Knowledge',
    icon: '🔬',
    description: 'จักรวาลวิทยา ฟิสิกส์ ชีววิทยา และสารคดีความรู้รอบตัวอ่านสนุก',
    color: '#4D96A9',
    accent: '#E4F3F7'
  },
  {
    id: 'history-society',
    name: 'ประวัติศาสตร์ / สังคม',
    enName: 'History & Society',
    icon: '🏛️',
    description: 'ประวัติศาสตร์ไทย ประวัติศาสตร์โลก อารยธรรมโบราณ และสังคมศาสตร์',
    color: '#C08552',
    accent: '#F9EFE6'
  },
  {
    id: 'religion-philosophy',
    name: 'ศาสนา / ปรัชญา / โหราศาสตร์',
    enName: 'Religion, Philosophy & Astrology',
    icon: '🙏',
    description: 'ปรัชญาชีวิต Стоic ธรรมะร่วมสมัย และศาสตร์ไพ่ทาโรต์-ดวงดาว',
    color: '#8E7DBE',
    accent: '#EFEBF7'
  },
  {
    id: 'kids-picture',
    name: 'หนังสือเด็ก / นิทานภาพ',
    enName: 'Kids & Picture Books',
    icon: '🧸',
    description: 'นิทานภาพสองภาษา เสริมพัฒนาการเด็กและหนังสือภาพปกแข็ง',
    color: '#F4A261',
    accent: '#FDF2E2'
  },
  {
    id: 'food-health',
    name: 'อาหาร / สุขภาพ',
    enName: 'Food, Cooking & Health',
    icon: '🍳',
    description: 'สูตรอาหาร เบเกอรี่ โภชนาการ และการดูแลสุขภาพองค์รวม',
    color: '#58A482',
    accent: '#E3F4EC'
  },
  {
    id: 'travel-lifestyle',
    name: 'ท่องเที่ยว / ไลฟ์สไตล์',
    enName: 'Travel & Lifestyle',
    icon: '✈️',
    description: 'บันทึกการเดินทาง ไกด์บุ๊กญี่ปุ่น-ยุโรป การแต่งบ้าน และคาเฟ่',
    color: '#26A69A',
    accent: '#E0F4F1'
  },
  {
    id: 'rare-books',
    name: 'หนังสือหายาก / สะสม',
    enName: 'Rare & Collectible Books',
    icon: '💎',
    description: 'หนังสือพิมพ์แรก ฉบับปกแข็งปั๊มทอง และหนังสือเลิกพิมพ์หายาก',
    color: '#B57B42',
    accent: '#F7EBD9'
  }
];

// ข้อมูลหนังสือตัวอย่างเพิ่มเติมเพื่อกระจายให้ครบทั้ง 20 หมวดหมู่ และครบทุกช่วงราคา/สภาพ
const EXTRA_SHOWCASE_BOOKS = [
  {
    id: 'bk-011',
    book_id: 3,
    seller_id: 2,
    seller_name: 'คุณสมชาย (Member #1)',
    code: 'MKT-BK11',
    title: 'เพราะเราคู่กัน (2gether Special Edition)',
    enTitle: '2gether The Series Novel',
    author: 'JittiRain',
    translator: '-',
    publisher: 'EverY (แจ่มใส)',
    category: 'bl-gl',
    categoryName: 'นิยายวาย / ยูริ',
    originalPrice: 320,
    salePrice: 175,
    shipping_fee: 35,
    packing_note: 'ผู้ขายแพ็กใส่ซองกันกระแทกพร้อมโปสการ์ดและที่คั่นครบชุด',
    conditionPercent: 95,
    conditionGrade: 'สภาพ 95%',
    defectNote: 'สภาพนางฟ้า 95% ห่อปกใสตั้งแต่วันแรก ของแถมรอบจองครบ',
    stock_status: 'Available',
    stock: 1,
    activeQueueCount: 0,
    isNewArrival: true,
    isBestSeller: true,
    pages: 380,
    year: 2564,
    isbn: '978-616-06-2711-0'
  },
  {
    id: 'bk-012',
    book_id: 4,
    seller_id: 3,
    seller_name: 'คุณพิมพ์ชนก (Member #2)',
    code: 'MKT-BK12',
    title: 'คดีฆาตกรรมในบ้านสิบเหลี่ยม (The Decagon House Murders)',
    enTitle: 'The Decagon House Murders',
    author: 'อายาสึจิ ยูกิโตะ (Yukito Ayatsuji)',
    translator: 'ฉัตรขวัญ อดิศัย',
    publisher: 'แพรวสำนักพิมพ์',
    category: 'mystery-thriller',
    categoryName: 'สืบสวนสอบสวน / ระทึกขวัญ',
    originalPrice: 295,
    salePrice: 190,
    shipping_fee: 35,
    packing_note: 'ผู้ขายส่ง Flash Express แพ็กใส่กล่องอย่างดี',
    conditionPercent: 93,
    conditionGrade: 'สภาพ 93%',
    defectNote: 'สภาพนางฟ้า อ่านรอบเดียว ขอบกระดาษขาวสะอาด ไม่มีรอยพับ',
    stock_status: 'Available',
    stock: 1,
    activeQueueCount: 0,
    isNewArrival: true,
    isBestSeller: true,
    pages: 342,
    year: 2565,
    isbn: '978-616-18-3912-3'
  },
  {
    id: 'bk-013',
    book_id: 5,
    seller_id: 2,
    seller_name: 'คุณสมชาย (Member #1)',
    code: 'MKT-BK13',
    title: 'แฮร์รี่ พอตเตอร์ กับศิลาอาถรรพ์ (ฉบับปก 20 ปี)',
    enTitle: 'Harry Potter and the Philosopher’s Stone',
    author: 'J.K. Rowling',
    translator: 'สุมาลี',
    publisher: 'นานมีบุ๊คส์ (Nanmeebooks)',
    category: 'fantasy-scifi',
    categoryName: 'แฟนตาซี / ไซไฟ',
    originalPrice: 395,
    salePrice: 260,
    shipping_fee: 40,
    packing_note: 'ผู้ขายจัดส่งใส่กล่องพัสดุแข็งแรง ห่อกันกระแทกอย่างดี',
    conditionPercent: 94,
    conditionGrade: 'สภาพ 94%',
    defectNote: 'ปก 20 ปี สันปกเรียงสวยงาม กระดาษถนอมสายตาสะอาด',
    stock_status: 'Reserved',
    stock: 1,
    activeQueueCount: 1,
    isNewArrival: false,
    isBestSeller: true,
    pages: 376,
    year: 2563,
    isbn: '978-616-04-4911-8'
  },
  {
    id: 'bk-014',
    book_id: 6,
    seller_id: 3,
    seller_name: 'คุณพิมพ์ชนก (Member #2)',
    code: 'MKT-BK14',
    title: 'จิตวิทยาของการใช้เงิน (The Psychology of Money)',
    enTitle: 'The Psychology of Money',
    author: 'Morgan Housel',
    translator: 'ธนิน รัศมีธรรมชาติ',
    publisher: 'Libertier (ลิเบอร์เทียร์)',
    category: 'business-finance',
    categoryName: 'ธุรกิจ / การเงินการลงทุน',
    originalPrice: 280,
    salePrice: 175,
    shipping_fee: 35,
    packing_note: 'ผู้ขายส่ง Kerry Express ตัดรอบทุกวัน 14:00 น.',
    conditionPercent: 96,
    conditionGrade: 'สภาพ 96%',
    defectNote: 'สภาพนางฟ้า 96% เหมือนมือหนึ่ง ไม่มีรอยขีดเขียนใดๆ',
    stock_status: 'Available',
    stock: 1,
    activeQueueCount: 0,
    isNewArrival: true,
    isBestSeller: true,
    pages: 272,
    year: 2565,
    isbn: '978-616-937-110-6'
  },
  {
    id: 'bk-015',
    book_id: 7,
    seller_id: 2,
    seller_name: 'คุณสมชาย (Member #1)',
    code: 'MKT-BK15',
    title: 'แนวข้อสอบ TGAT 1-2-3 พิชิตคะแนนเต็ม',
    enTitle: 'TGAT Complete Exam Guide',
    author: 'อ.ดร.กิตติพงศ์ และทีมติวเตอร์',
    translator: '-',
    publisher: 'Think Beyond Education',
    category: 'education-exam',
    categoryName: 'การศึกษา / เตรียมสอบ',
    originalPrice: 250,
    salePrice: 89,
    shipping_fee: 30,
    packing_note: 'ผู้ขายส่งไปรษณีย์/Flash ค่าส่ง 30 บาท',
    conditionPercent: 86,
    conditionGrade: 'สภาพ 86%',
    defectNote: 'ใช้ดินสอทำโจทย์ไป 1 บท (ลบออกให้สะอาดแล้ว) นอกนั้นขาวสะอาด',
    stock_status: 'Available',
    stock: 1,
    activeQueueCount: 0,
    isNewArrival: false,
    isBestSeller: false,
    pages: 310,
    year: 2566,
    isbn: '978-616-449-312-4'
  },
  {
    id: 'bk-016',
    book_id: 8,
    seller_id: 3,
    seller_name: 'คุณพิมพ์ชนก (Member #2)',
    code: 'MKT-BK16',
    title: 'มินนะ โนะ นิฮงโกะ (Minna no Nihongo เล่ม 1)',
    enTitle: 'Minna no Nihongo Elementary I',
    author: '3A Corporation',
    translator: 'สมาคมส่งเสริมเทคโนโลยี (ไทย-ญี่ปุ่น)',
    publisher: 'สำนักพิมพ์ ส.ส.ท.',
    category: 'foreign-lang',
    categoryName: 'ภาษาต่างประเทศ',
    originalPrice: 220,
    salePrice: 95,
    shipping_fee: 30,
    packing_note: 'ผู้ขายส่งพร้อมแผ่นสรุปคำศัพท์ภาษาญี่ปุ่น',
    conditionPercent: 90,
    conditionGrade: 'สภาพ 90%',
    defectNote: 'ปกหุ้มพลาสติกใส สภาพดีมาก ไม่มีรอยปากกา',
    stock_status: 'Available',
    stock: 1,
    activeQueueCount: 0,
    isNewArrival: true,
    isBestSeller: false,
    pages: 260,
    year: 2564,
    isbn: '978-974-443-712-9'
  },
  {
    id: 'bk-017',
    book_id: 9,
    seller_id: 2,
    seller_name: 'คุณสมชาย (Member #1)',
    code: 'MKT-BK17',
    title: 'เริ่มต้นเขียนโปรแกรม Python & AI สำหรับผู้เริ่มต้น',
    enTitle: 'Python & AI Programming Fundamentals',
    author: 'ศุภชัย สมพานิช',
    translator: '-',
    publisher: 'วิตตี้กรุ๊ป (Witty Group)',
    category: 'computer-tech',
    categoryName: 'คอมพิวเตอร์ / เทคโนโลยี',
    originalPrice: 350,
    salePrice: 195,
    shipping_fee: 35,
    packing_note: 'ผู้ขายแพ็กใส่ซองกันกระแทก ส่งด่วนทุกวัน',
    conditionPercent: 94,
    conditionGrade: 'สภาพ 94%',
    defectNote: 'พิมพ์สี่สีทั้งเล่ม กระดาษอาร์ตมัน สภาพนางฟ้า 94%',
    stock_status: 'Available',
    stock: 1,
    activeQueueCount: 0,
    isNewArrival: true,
    isBestSeller: false,
    pages: 368,
    year: 2566,
    isbn: '978-616-588-102-1'
  },
  {
    id: 'bk-018',
    book_id: 10,
    seller_id: 3,
    seller_name: 'คุณพิมพ์ชนก (Member #2)',
    code: 'MKT-BK18',
    title: 'ประวัติย่อของกาลเวลา (A Brief History of Time)',
    enTitle: 'A Brief History of Time',
    author: 'สตีเฟน ฮอว์คิง (Stephen Hawking)',
    translator: 'ดร.อรรถกฤต ฉัตรภูติ',
    publisher: 'มติชน (Matichon Book)',
    category: 'science-general',
    categoryName: 'วิทยาศาสตร์ / ความรู้ทั่วไป',
    originalPrice: 280,
    salePrice: 165,
    shipping_fee: 35,
    packing_note: 'ผู้ขายส่งทาง J&T Express แพ็กกันกระแทก',
    conditionPercent: 92,
    conditionGrade: 'สภาพ 92%',
    defectNote: 'สภาพนางฟ้า 92% ปกและสันปกเรียบกริบ กระดาษถนอมสายตา',
    stock_status: 'Available',
    stock: 1,
    activeQueueCount: 0,
    isNewArrival: false,
    isBestSeller: true,
    pages: 264,
    year: 2564,
    isbn: '978-974-02-1710-7'
  },
  {
    id: 'bk-019',
    book_id: 3,
    seller_id: 2,
    seller_name: 'คุณสมชาย (Member #1)',
    code: 'MKT-BK19',
    title: 'เซเปียนส์ ประวัติย่อมนุษยชาติ (Sapiens)',
    enTitle: 'Sapiens: A Brief History of Humankind',
    author: 'ยูวัล โนอาห์ แฮรารี (Yuval Noah Harari)',
    translator: 'ดร.นำชัย ชีววิวรรธน์',
    publisher: 'ยิปซี (Gypsy Book)',
    category: 'history-society',
    categoryName: 'ประวัติศาสตร์ / สังคม',
    originalPrice: 530,
    salePrice: 340,
    shipping_fee: 40,
    packing_note: 'ผู้ขายส่งใส่กล่องพัสดุแข็งแรงเนื่องจากหนังสือเล่มหนา',
    conditionPercent: 93,
    conditionGrade: 'สภาพ 93%',
    defectNote: 'สภาพนางฟ้า 93% สันปกไม่หัก มีที่คั่นหนังสือครบ',
    stock_status: 'Reserved',
    stock: 1,
    activeQueueCount: 2,
    isNewArrival: true,
    isBestSeller: true,
    pages: 616,
    year: 2564,
    isbn: '978-616-301-654-6'
  },
  {
    id: 'bk-020',
    book_id: 4,
    seller_id: 3,
    seller_name: 'คุณพิมพ์ชนก (Member #2)',
    code: 'MKT-BK20',
    title: 'ปรัชญาสโตอิก เพื่อชีวิตที่ไม่สั่นคลอน (The Daily Stoic)',
    enTitle: 'The Daily Stoic',
    author: 'Ryan Holiday',
    translator: 'ลลิตา ผลผลา',
    publisher: 'วีเลิร์น (WeLearn)',
    category: 'religion-philosophy',
    categoryName: 'ศาสนา / ปรัชญา / โหราศาสตร์',
    originalPrice: 350,
    salePrice: 210,
    shipping_fee: 35,
    packing_note: 'ผู้ขายส่ง Flash Express ห่อปกใสให้เรียบร้อย',
    conditionPercent: 95,
    conditionGrade: 'สภาพ 95%',
    defectNote: 'สภาพนางฟ้า 95% อ่านง่าย สบายตา ไม่มีรอยขีดเขียน',
    stock_status: 'Available',
    stock: 1,
    activeQueueCount: 0,
    isNewArrival: true,
    isBestSeller: false,
    pages: 432,
    year: 2565,
    isbn: '978-616-287-498-7'
  },
  {
    id: 'bk-021',
    book_id: 5,
    seller_id: 2,
    seller_name: 'คุณสมชาย (Member #1)',
    code: 'MKT-BK21',
    title: 'นิทานภาพ 2 ภาษา บ้านต้นไม้ 100 ชั้น (ปกแข็ง)',
    enTitle: 'The 100-Storey Treehouse Picture Book',
    author: 'อิวาอิ โทชิโอะ (Toshio Iwai)',
    translator: 'เมธินี นุชนาคา',
    publisher: 'Amarin Kids',
    category: 'kids-picture',
    categoryName: 'หนังสือเด็ก / นิทานภาพ',
    originalPrice: 265,
    salePrice: 99,
    shipping_fee: 30,
    packing_note: 'ผู้ขายแพ็กใส่กล่องกันมุมปกแข็งบุบ ส่งไว',
    conditionPercent: 91,
    conditionGrade: 'สภาพ 91%',
    defectNote: 'หนังสือภาพสีสดใสทั้งเล่ม ปกแข็งสะอาด ไม่มีรอยฉีกขาด',
    stock_status: 'Available',
    stock: 1,
    activeQueueCount: 0,
    isNewArrival: false,
    isBestSeller: true,
    pages: 48,
    year: 2564,
    isbn: '978-616-18-3210-0'
  },
  {
    id: 'bk-022',
    book_id: 6,
    seller_id: 3,
    seller_name: 'คุณพิมพ์ชนก (Member #2)',
    code: 'MKT-BK22',
    title: 'โฮมคาเฟ่ & เบเกอรี่โฮมเมดสูตรทำง่าย',
    enTitle: 'Home Cafe & Homemade Bakery Recipes',
    author: 'เชฟพลอย สุขสันต์',
    translator: '-',
    publisher: 'บ้านและสวน (Amarin Cuisine)',
    category: 'food-health',
    categoryName: 'อาหาร / สุขภาพ',
    originalPrice: 290,
    salePrice: 85,
    shipping_fee: 30,
    packing_note: 'ผู้ขายส่งลงทะเบียน/Flash ค่าส่ง 30 บาท',
    conditionPercent: 88,
    conditionGrade: 'สภาพ 88%',
    defectNote: 'กระดาษอาร์ตสีทั้งเล่ม มุมปกล่างมีรอยพับเล็กน้อย ด้านในสะอาด',
    stock_status: 'Available',
    stock: 1,
    activeQueueCount: 0,
    isNewArrival: false,
    isBestSeller: false,
    pages: 168,
    year: 2563,
    isbn: '978-616-18-2988-9'
  },
  {
    id: 'bk-023',
    book_id: 7,
    seller_id: 2,
    seller_name: 'คุณสมชาย (Member #1)',
    code: 'MKT-BK23',
    title: 'โตเกียว-เกียวโต เดินเล่นคาเฟ่และร้านหนังสือมือสอง',
    enTitle: 'Tokyo & Kyoto Slow Travel & Bookshops',
    author: 'ภาณุมาศ นักเดินทาง',
    translator: '-',
    publisher: 'a book (อะบุ๊ก)',
    category: 'travel-lifestyle',
    categoryName: 'ท่องเที่ยว / ไลฟ์สไตล์',
    originalPrice: 275,
    salePrice: 120,
    shipping_fee: 30,
    packing_note: 'ผู้ขายส่งพร้อมแผนที่พับย่านจิมโบโจ โตเกียว',
    conditionPercent: 94,
    conditionGrade: 'สภาพ 94%',
    defectNote: 'สภาพนางฟ้า 94% ภาพถ่ายสีสวยงามทั้งเล่ม พร้อมแผนที่พับครบ',
    stock_status: 'Available',
    stock: 1,
    activeQueueCount: 0,
    isNewArrival: true,
    isBestSeller: false,
    pages: 224,
    year: 2565,
    isbn: '978-616-327-219-5'
  },
  {
    id: 'bk-024',
    book_id: 8,
    seller_id: 3,
    seller_name: 'คุณพิมพ์ชนก (Member #2)',
    code: 'MKT-BK24',
    title: 'โต๊ะโตะจัง เด็กหญิงข้างหน้าต่าง (ฉบับคลาสสิก)',
    enTitle: 'Totto-Chan: The Little Girl at the Window',
    author: 'คุโรยานางิ เท็ตสึโกะ',
    translator: 'ผุสดี นาวาวิจิต',
    publisher: 'ผีเสื้อ (Butterfly Book)',
    category: 'youth-classic',
    categoryName: 'วรรณกรรมเยาวชน / คลาสสิก',
    originalPrice: 240,
    salePrice: 95,
    shipping_fee: 30,
    packing_note: 'ผู้ขายส่ง Flash Express ห่อกันกระแทกอย่างดี',
    conditionPercent: 91,
    conditionGrade: 'สภาพ 91%',
    defectNote: 'วรรณกรรมเยาวชนสุดอบอุ่น สภาพดีมาก 91% กระดาษสะอาด',
    stock_status: 'Available',
    stock: 1,
    activeQueueCount: 0,
    isNewArrival: false,
    isBestSeller: true,
    pages: 288,
    year: 2562,
    isbn: '978-974-14-0412-4'
  }
];

const CUSTOMER_REVIEWS = [
  {
    id: 'rev-1',
    name: 'คุณพิมพ์ชนก (Member #2)',
    location: 'สมาชิกผู้ซื้อ & ผู้ขาย',
    rating: 5,
    bookTitle: 'ปาฏิหาริย์ร้านชำของคุณนามิยะ',
    date: '24 ต.ค. 2569',
    comment: 'ชอบระบบบัญชีเดียวเป็นได้ทั้งคนซื้อและคนขายมากค่ะ พอกดสั่งซื้อปุ๊บ ระบบเด้งเข้าห้องแชทรายการจองทันที พร้อมบอท AI สรุปราคาและค่าส่งให้ครบเลย'
  },
  {
    id: 'rev-2',
    name: 'คุณสมชาย (Member #1)',
    location: 'สมาชิกผู้ซื้อ & ผู้ขาย',
    rating: 5,
    bookTitle: 'เพชรพระอุมา ตอน ไพรมหากาฬ เล่ม 1',
    date: '22 ต.ค. 2569',
    comment: 'ระบบแอดมินเป็นตัวกลางพักเงิน (Escrow) ช่วยให้ซื้อหนังสือหายากราคาสูงได้อย่างสบายใจครับ โอนเงินเข้าบัญชีกลาง รอผู้ขายส่งของและตรวจสภาพเสร็จ แอดมินค่อยโอนเงินให้ผู้ขาย ปลอดภัย 100%'
  },
  {
    id: 'rev-3',
    name: 'คุณณัฐธิดา ว.',
    location: 'สมาชิกตลาดกลาง',
    rating: 5,
    bookTitle: 'SLAM DUNK สแลมดังก์ Big Book เล่ม 1',
    date: '19 ต.ค. 2569',
    comment: 'ลงขายหนังสือตัวเองง่ายมาก กำหนดค่าจัดส่งและวิธีแพ็กของตามจริงได้เลย เวลาคนมาซื้อก็แจ้งเตือนชัดเจน ป้องกันคนจองกั๊กแล้วไม่โอนได้ดีมากค่ะ'
  },
  {
    id: 'rev-4',
    name: 'คุณศุภกร จ.',
    location: 'สมาชิกตลาดกลาง',
    rating: 5,
    bookTitle: 'Atomic Habits เพราะชีวิตดีได้กว่าที่เป็น',
    date: '15 ต.ค. 2569',
    comment: 'ทักแชทถามสภาพหนังสือเพิ่มเติม มีบอท AI ตอบข้อมูลเบื้องต้นจากที่ผู้ขายกรอกไว้ทันที และแจ้งเตือนผู้ขายกับแอดมินให้เข้ามาคุยในห้องเดียวกัน สะดวกสุดๆ ครับ'
  }
];

// ฟังก์ชันสร้างรูปปกหนังสือจำลอง SVG โทนพาสเทลสะอาดตา (รองรับครบทุกหมวดหมู่)
function generateBookCoverSVG(book, viewType = 'front') {
  const catPalettes = {
    'thai-novel':          { bg1: '#FCE8D5', bg2: '#F6D3B3', spine: '#E9964A', text: '#1F4E4B', badgeBg: '#FFFFFF', badgeText: '#E9964A', icon: '📖' },
    'translated-novel':    { bg1: '#CFECE8', bg2: '#A8DDD6', spine: '#26A69A', text: '#1F4E4B', badgeBg: '#FFFFFF', badgeText: '#26A69A', icon: '🌍' },
    'bl-gl':               { bg1: '#FCE4EC', bg2: '#F8BBD0', spine: '#E57A93', text: '#1F4E4B', badgeBg: '#FFFFFF', badgeText: '#D85B7B', icon: '💕' },
    'mystery-thriller':    { bg1: '#D7ECE9', bg2: '#B2D8D2', spine: '#2A9D8F', text: '#1F4E4B', badgeBg: '#FFFFFF', badgeText: '#1F4E4B', icon: '🕵️‍♂️' },
    'fantasy-scifi':       { bg1: '#E3EFFB', bg2: '#C2DBF4', spine: '#5C88C4', text: '#1F4E4B', badgeBg: '#FFFFFF', badgeText: '#4A74B0', icon: '🐉' },
    'manga':               { bg1: '#DCEEF5', bg2: '#B9DFEC', spine: '#6CB4CE', text: '#1F4E4B', badgeBg: '#FFFFFF', badgeText: '#2A9D8F', icon: '🎨' },
    'youth-classic':       { bg1: '#E6F4EA', bg2: '#C4E4CD', spine: '#58A482', text: '#1F4E4B', badgeBg: '#FFFFFF', badgeText: '#26A69A', icon: '📚' },
    'self-help':           { bg1: '#FDF2E2', bg2: '#F9DEC0', spine: '#F4A261', text: '#1F4E4B', badgeBg: '#FFFFFF', badgeText: '#E9964A', icon: '💡' },
    'business-finance':    { bg1: '#E0F4F1', bg2: '#B8E4DD', spine: '#26A69A', text: '#1F4E4B', badgeBg: '#FFFFFF', badgeText: '#1F4E4B', icon: '💼' },
    'education-exam':      { bg1: '#EBF2F7', bg2: '#CCDCEB', spine: '#6C8EAD', text: '#1F4E4B', badgeBg: '#FFFFFF', badgeText: '#4B6E8C', icon: '🎓' },
    'foreign-lang':        { bg1: '#FDF0E0', bg2: '#F7D7B5', spine: '#E9964A', text: '#1F4E4B', badgeBg: '#FFFFFF', badgeText: '#D97F30', icon: '🗣️' },
    'computer-tech':       { bg1: '#DFF3F0', bg2: '#B4E2DC', spine: '#26A69A', text: '#1F4E4B', badgeBg: '#FFFFFF', badgeText: '#26A69A', icon: '💻' },
    'science-general':     { bg1: '#E4F3F7', bg2: '#C1E2EB', spine: '#4D96A9', text: '#1F4E4B', badgeBg: '#FFFFFF', badgeText: '#3A7D8F', icon: '🔬' },
    'history-society':     { bg1: '#F9EFE6', bg2: '#EBD5C1', spine: '#C08552', text: '#1F4E4B', badgeBg: '#FFFFFF', badgeText: '#A36B3B', icon: '🏛️' },
    'religion-philosophy': { bg1: '#EFEBF7', bg2: '#D8CEEC', spine: '#8E7DBE', text: '#1F4E4B', badgeBg: '#FFFFFF', badgeText: '#6F5D9E', icon: '🙏' },
    'kids-picture':        { bg1: '#FFF3E0', bg2: '#FFE0B2', spine: '#F4A261', text: '#1F4E4B', badgeBg: '#FFFFFF', badgeText: '#E9964A', icon: '🧸' },
    'food-health':         { bg1: '#E3F4EC', bg2: '#C0E6D4', spine: '#58A482', text: '#1F4E4B', badgeBg: '#FFFFFF', badgeText: '#3D8866', icon: '🍳' },
    'travel-lifestyle':    { bg1: '#E0F4F1', bg2: '#BCE6DF', spine: '#26A69A', text: '#1F4E4B', badgeBg: '#FFFFFF', badgeText: '#26A69A', icon: '✈️' },
    'rare-books':          { bg1: '#F7EBD9', bg2: '#EAD4B4', spine: '#D4A373', text: '#1F4E4B', badgeBg: '#FFFFFF', badgeText: '#B57B42', icon: '💎' }
  };

  const p = catPalettes[book.category] || catPalettes['translated-novel'];
  const titleText = book.title || book.book_title || 'หนังสือมือสอง';
  const enTitleText = book.enTitle || book.en_title || 'Secondhand Book';
  const safeTitle = titleText.length > 24 ? titleText.substring(0, 24) + '...' : titleText;
  const safeSub = enTitleText.length > 32 ? enTitleText.substring(0, 32) + '...' : enTitleText;
  const condPct = book.conditionPercent || book.condition_percent || 90;
  const condGrade = book.conditionGrade || book.condition_grade || `สภาพ ${condPct}%`;
  const origPrice = book.originalPrice || book.original_price || 290;
  const sellerName = book.seller_name || 'สมาชิกผู้ขาย';
  const catLabel = (book.categoryName || book.category_name || 'หนังสือมือสอง').substring(0, 18);

  if (viewType === 'spine') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520" width="100%" height="100%">
      <rect width="400" height="520" fill="#FAF7F2" rx="16"/>
      <rect x="135" y="40" width="52" height="420" fill="${p.bg2}" stroke="${p.spine}" stroke-width="2" rx="6"/>
      <rect x="187" y="45" width="82" height="410" fill="#FFFDF9" stroke="#E6E1D6" stroke-width="2"/>
      <line x1="202" y1="50" x2="202" y2="450" stroke="#EFECE6" stroke-width="1.5"/>
      <line x1="218" y1="50" x2="218" y2="450" stroke="#EFECE6" stroke-width="1.5"/>
      <line x1="234" y1="50" x2="234" y2="450" stroke="#EFECE6" stroke-width="1.5"/>
      <line x1="250" y1="50" x2="250" y2="450" stroke="#EFECE6" stroke-width="1.5"/>
      <text x="161" y="250" fill="${p.text}" font-family="Prompt, sans-serif" font-size="14" font-weight="700" text-anchor="middle" transform="rotate(-90 161 250)">${safeTitle}</text>
      <rect x="85" y="468" width="230" height="32" rx="16" fill="#26A69A"/>
      <text x="200" y="489" fill="#FFFFFF" font-family="Prompt, sans-serif" font-size="12" font-weight="600" text-anchor="middle">มุมมองสันปก &amp; ขอบกระดาษ (${condPct}%)</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  if (viewType === 'back') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520" width="100%" height="100%">
      <rect width="400" height="520" fill="#FAF7F2" rx="16"/>
      <rect x="60" y="32" width="280" height="425" fill="${p.bg1}" stroke="${p.spine}" stroke-width="2" rx="12"/>
      <rect x="82" y="58" width="236" height="250" fill="#FFFFFF" fill-opacity="0.78" rx="10"/>
      <text x="200" y="95" fill="#1F4E4B" font-family="Prompt, sans-serif" font-size="15" font-weight="700" text-anchor="middle">ข้อมูลจากผู้ลงขาย</text>
      <text x="200" y="130" fill="#5F7470" font-family="Prompt, sans-serif" font-size="12" text-anchor="middle">ผู้ขาย: ${sellerName}</text>
      <text x="200" y="160" fill="#5F7470" font-family="Prompt, sans-serif" font-size="12" text-anchor="middle">สำนักพิมพ์: ${book.publisher || '-'}</text>
      <text x="200" y="190" fill="#5F7470" font-family="Prompt, sans-serif" font-size="12" text-anchor="middle">จำนวนหน้า: ${book.pages || 280} หน้า</text>
      <text x="200" y="225" fill="#26A69A" font-family="Prompt, sans-serif" font-size="13" font-weight="700" text-anchor="middle">${condGrade}</text>
      <rect x="190" y="355" width="125" height="72" fill="#FFFFFF" rx="8"/>
      <text x="252" y="376" fill="#1F4E4B" font-family="monospace" font-size="10" font-weight="700" text-anchor="middle">ISBN ${book.isbn || '978-616'}</text>
      <rect x="205" y="384" width="95" height="22" fill="#5F7470" rx="2"/>
      <text x="252" y="420" fill="#E9964A" font-family="Prompt, sans-serif" font-size="11" font-weight="700" text-anchor="middle">ราคาปก ${origPrice}.-</text>
      <rect x="85" y="468" width="230" height="32" rx="16" fill="#26A69A"/>
      <text x="200" y="489" fill="#FFFFFF" font-family="Prompt, sans-serif" font-size="12" font-weight="600" text-anchor="middle">ภาพถ่ายปกหลัง &amp; บาร์โค้ด</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  if (viewType === 'inside') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520" width="100%" height="100%">
      <rect width="400" height="520" fill="#FAF7F2" rx="16"/>
      <rect x="35" y="55" width="165" height="365" fill="#FFFDF9" stroke="#E6E1D6" stroke-width="2" rx="6"/>
      <rect x="200" y="55" width="165" height="365" fill="#FFFDF9" stroke="#E6E1D6" stroke-width="2" rx="6"/>
      <line x1="200" y1="55" x2="200" y2="420" stroke="#D5CFC4" stroke-width="2.5"/>
      <rect x="55" y="90" width="125" height="8" fill="#BCE3DF" rx="4"/>
      <rect x="55" y="112" width="110" height="6" fill="#E6E1D6" rx="3"/>
      <rect x="55" y="128" width="120" height="6" fill="#E6E1D6" rx="3"/>
      <rect x="55" y="144" width="105" height="6" fill="#E6E1D6" rx="3"/>
      <rect x="220" y="90" width="120" height="6" fill="#E6E1D6" rx="3"/>
      <rect x="220" y="106" width="125" height="6" fill="#E6E1D6" rx="3"/>
      <rect x="220" y="122" width="100" height="6" fill="#E6E1D6" rx="3"/>
      <rect x="50" y="230" width="300" height="145" fill="#FFFFFF" stroke="#BCE3DF" stroke-width="2" rx="14"/>
      <text x="200" y="262" fill="#26A69A" font-family="Prompt, sans-serif" font-size="14" font-weight="700" text-anchor="middle">📖 รายละเอียดจากผู้ลงขาย</text>
      <text x="200" y="292" fill="#1F4E4B" font-family="Prompt, sans-serif" font-size="13" font-weight="600" text-anchor="middle">ผู้ขาย: ${sellerName} (${condGrade})</text>
      <text x="200" y="320" fill="#5F7470" font-family="Prompt, sans-serif" font-size="12" text-anchor="middle">ค่าจัดส่งที่ผู้ขายกำหนด: ฿${book.shipping_fee || 40} บาท</text>
      <text x="200" y="350" fill="#E9964A" font-family="Prompt, sans-serif" font-size="12" font-weight="700" text-anchor="middle">💬 แชทพูดคุยเพื่อขอดูรูปเพิ่มได้</text>
      <rect x="85" y="468" width="230" height="32" rx="16" fill="#26A69A"/>
      <text x="200" y="489" fill="#FFFFFF" font-family="Prompt, sans-serif" font-size="12" font-weight="600" text-anchor="middle">มุมมองเนื้อใน &amp; เงื่อนไขผู้ขาย</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  // มุมมองปกหน้า (Front Cover) โทนพาสเทลสะอาดตา มินิมอล
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="100%" height="100%">
    <defs>
      <linearGradient id="cov-${book.id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${p.bg1}"/>
        <stop offset="100%" stop-color="${p.bg2}"/>
      </linearGradient>
      <filter id="shadow-${book.id}" x="-10%" y="-10%" width="125%" height="125%">
        <feDropShadow dx="5" dy="8" stdDeviation="7" flood-color="#1F4E4B" flood-opacity="0.12"/>
      </filter>
    </defs>
    <rect width="400" height="500" fill="#F7F3EB"/>
    <circle cx="330" cy="70" r="95" fill="#FFFFFF" opacity="0.6"/>
    <circle cx="65" cy="430" r="110" fill="#FFFFFF" opacity="0.5"/>
    <rect x="74" y="38" width="262" height="424" rx="10" fill="#FFFFFF" stroke="#E6E1D6"/>
    <rect x="64" y="30" width="264" height="428" rx="10" fill="url(#cov-${book.id})" filter="url(#shadow-${book.id})"/>
    <rect x="64" y="30" width="16" height="428" rx="4" fill="${p.spine}" opacity="0.55"/>
    <rect x="94" y="54" width="214" height="380" rx="8" fill="#FFFFFF" fill-opacity="0.74" stroke="#FFFFFF" stroke-width="1.5"/>
    <rect x="131" y="76" width="140" height="24" rx="12" fill="${p.badgeBg}"/>
    <text x="201" y="92" fill="${p.badgeText}" font-family="Prompt, sans-serif" font-size="10" font-weight="700" text-anchor="middle">${catLabel}</text>
    <circle cx="201" cy="182" r="44" fill="${p.bg1}" stroke="#FFFFFF" stroke-width="3"/>
    <text x="201" y="195" fill="${p.text}" font-family="Prompt, sans-serif" font-size="30" text-anchor="middle">${p.icon || '📖'}</text>
    <text x="201" y="276" fill="#1F4E4B" font-family="Prompt, sans-serif" font-size="16" font-weight="700" text-anchor="middle">${safeTitle}</text>
    <text x="201" y="302" fill="#E9964A" font-family="Prompt, sans-serif" font-size="11" font-weight="600" text-anchor="middle">${safeSub}</text>
    <line x1="150" y1="322" x2="252" y2="322" stroke="#D5CFC4" stroke-width="1.2"/>
    <text x="201" y="348" fill="#5F7470" font-family="Prompt, sans-serif" font-size="12.5" font-weight="500" text-anchor="middle">${book.author || ''}</text>
    <text x="201" y="405" fill="#5F7470" font-family="Prompt, sans-serif" font-size="10.5" font-weight="600" text-anchor="middle">${condGrade}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

const CORE_SEED_BOOKS = [
  {
    id: 'bk-001',
    book_id: 1,
    seller_id: 2,
    seller_name: 'คุณสมชาย (Member #1)',
    code: 'MKT-BK01',
    title: 'ปาฏิหาริย์ร้านชำของคุณนามิยะ',
    enTitle: 'Miracles of the Namiya General Store',
    author: 'ฮิงาชิโนะ เคโงะ (Keigo Higashino)',
    translator: 'กนกวรรณ เกตุชัยมาศ',
    publisher: 'น้ำพุสำนักพิมพ์',
    category: 'mystery-thriller',
    categoryName: 'สืบสวนสอบสวน / ระทึกขวัญ',
    originalPrice: 295,
    salePrice: 189,
    price: 189,
    shipping_fee: 40,
    packing_note: 'ผู้ขายแพ็กใส่กล่องพัสดุ ส่งผ่านขนส่ง Flash Express ภายใน 1-2 วันหลังแอดมินแจ้งยอด',
    conditionPercent: 92,
    conditionGrade: 'สภาพ 92%',
    defectNote: 'ผู้ขายแจ้งว่า: มุมปกขวาบนมีรอยพับจางๆ ประมาณ 2 มม. สันกระดาษสะอาด ไม่มีรอยขีดเขียน มีที่คั่นตรงปก',
    stock_status: 'Reserved',
    stock: 1,
    activeQueueCount: 2,
    isNewArrival: true,
    isBestSeller: true,
    pages: 376,
    year: 2563,
    isbn: '978-616-287-382-9'
  },
  {
    id: 'bk-002',
    book_id: 2,
    seller_id: 3,
    seller_name: 'คุณพิมพ์ชนก (Member #2)',
    code: 'MKT-BK02',
    title: 'ชีวิตดีขึ้นทุกๆ ด้าน ด้วยการจัดบ้านแค่ครั้งเดียว',
    enTitle: 'The Life-Changing Magic of Tidying Up',
    author: 'มาริเอะ คนโด (Marie Kondo)',
    translator: 'โยซุเกะ และ โพรล็อก',
    publisher: 'วีเลิร์น (WeLearn)',
    category: 'self-help',
    categoryName: 'พัฒนาตนเอง / จิตวิทยา',
    originalPrice: 220,
    salePrice: 129,
    price: 129,
    shipping_fee: 35,
    packing_note: 'ผู้ขายส่งไปรษณีย์ลงทะเบียน หรือ J&T Express ตามตกลงในห้องแชท',
    conditionPercent: 85,
    conditionGrade: 'สภาพ 85%',
    defectNote: 'ผู้ขายแจ้งว่า: ขอบกระดาษด้านบนมีจุดเหลืองตามกาลเวลาเล็กน้อย 3-4 จุด ไม่มีหน้าขาดหรือหลุด',
    stock_status: 'Available',
    stock: 1,
    activeQueueCount: 0,
    isNewArrival: true,
    isBestSeller: true,
    pages: 240,
    year: 2559,
    isbn: '978-616-287-112-2'
  },
  {
    id: 'bk-003',
    book_id: 3,
    seller_id: 2,
    seller_name: 'คุณสมชาย (Member #1)',
    code: 'MKT-BK03',
    title: 'สแลมดังก์ (Slam Dunk) Big Book เล่ม 1-5',
    enTitle: 'Slam Dunk Big Book Vol. 1-5 Set',
    author: 'ทาเคฮิโกะ อิโนอุเอะ (Takehiko Inoue)',
    translator: 'ทีมงานสยามอินเตอร์คอมิกส์',
    publisher: 'Siam Inter Comics',
    category: 'manga',
    categoryName: 'การ์ตูน / มังงะ',
    originalPrice: 1250,
    salePrice: 890,
    price: 890,
    shipping_fee: 60,
    packing_note: 'หนังสือชุดน้ำหนักมาก ผู้ขายจัดส่งด้วยกล่องลูกฟูกหนาผ่าน Kerry Express',
    conditionPercent: 95,
    conditionGrade: 'สภาพ 95%',
    defectNote: 'ผู้ขายแจ้งว่า: สภาพสะสม ห่อปกพลาสติกใสทุกเล่ม สันปกเรียงสวย ไม่แต้มสี',
    stock_status: 'Available',
    stock: 2,
    activeQueueCount: 0,
    isNewArrival: true,
    isBestSeller: true,
    pages: 1200,
    year: 2564,
    isbn: '978-616-492-501-4'
  },
  {
    id: 'bk-004',
    book_id: 4,
    seller_id: 3,
    seller_name: 'คุณพิมพ์ชนก (Member #2)',
    code: 'MKT-BK04',
    title: 'ความสุขของกะทิ (ฉบับพิมพ์ครั้งแรก ปกแข็ง)',
    enTitle: 'The Happiness of Kati (1st Hardcover Edition)',
    author: 'งามพรรณ เวชชาชีวะ',
    translator: '-',
    publisher: 'แพรวสำนักพิมพ์',
    category: 'youth-classic',
    categoryName: 'วรรณกรรมเยาวชน / คลาสสิก',
    originalPrice: 380,
    salePrice: 650,
    price: 650,
    shipping_fee: 50,
    packing_note: 'ผู้ขายใส่กล่องพัสดุแข็งแรง ส่ง EMS ไปรษณีย์ไทย',
    conditionPercent: 88,
    conditionGrade: 'สภาพ 88%',
    defectNote: 'ผู้ขายแจ้งว่า: ฉบับพิมพ์ครั้งแรก ใบหุ้มปกมีรอยถลอกที่ขอบมุมเล็กน้อย กระดาษด้านในสมบูรณ์มาก',
    stock_status: 'Sold Out',
    stock: 0,
    activeQueueCount: 0,
    isNewArrival: false,
    isBestSeller: true,
    pages: 168,
    year: 2549,
    isbn: '978-974-752-091-0'
  },
  {
    id: 'bk-005',
    book_id: 5,
    seller_id: 2,
    seller_name: 'คุณสมชาย (Member #1)',
    code: 'MKT-BK05',
    title: 'บุพเพสันนิวาส (ฉบับพิมพ์รวมเล่ม)',
    enTitle: 'Love Destiny (Bupphesanniwat)',
    author: 'รอมแพง',
    translator: '-',
    publisher: 'ฟิสิกส์เซ็นเตอร์',
    category: 'thai-novel',
    categoryName: 'นวนิยายไทย',
    originalPrice: 380,
    salePrice: 210,
    price: 210,
    shipping_fee: 40,
    packing_note: 'ผู้ขายจัดส่งผ่าน Flash Express ทุกวันจันทร์-ศุกร์',
    conditionPercent: 82,
    conditionGrade: 'สภาพ 82%',
    defectNote: 'ผู้ขายแจ้งว่า: สันปกมีรอยยับจากการเปิดอ่าน 1 เส้น ด้านในสะอาด ไม่มีหน้าแบะ',
    stock_status: 'Available',
    stock: 1,
    activeQueueCount: 0,
    isNewArrival: false,
    isBestSeller: true,
    pages: 560,
    year: 2561,
    isbn: '978-616-702-719-7'
  },
  {
    id: 'bk-006',
    book_id: 6,
    seller_id: 3,
    seller_name: 'คุณพิมพ์ชนก (Member #2)',
    code: 'MKT-BK06',
    title: 'เพราะเป็นวัยรุ่นจึงเจ็บปวด',
    enTitle: 'ache of youth (Time of Youth)',
    author: 'คิมรันโด (Kim Rando)',
    translator: 'วิทิยา จันทร์พันธ์',
    publisher: 'Springbooks',
    category: 'self-help',
    categoryName: 'พัฒนาตนเอง / จิตวิทยา',
    originalPrice: 245,
    salePrice: 135,
    price: 135,
    shipping_fee: 35,
    packing_note: 'ผู้ขายห่อซองกันกระแทก ส่ง J&T Express',
    conditionPercent: 90,
    conditionGrade: 'สภาพ 90%',
    defectNote: 'ผู้ขายแจ้งว่า: สภาพดีมาก 90% มีรอยดินสอขีดเส้นใต้บางๆ 2 หน้า (ลบออกได้)',
    stock_status: 'Available',
    stock: 1,
    activeQueueCount: 0,
    isNewArrival: true,
    isBestSeller: false,
    pages: 296,
    year: 2560,
    isbn: '978-616-18-0922-5'
  },
  {
    id: 'bk-007',
    book_id: 7,
    seller_id: 2,
    seller_name: 'คุณสมชาย (Member #1)',
    code: 'MKT-BK07',
    title: 'เซเปียนส์ ประวัติย่อมนุษยชาติ (Sapiens)',
    enTitle: 'Sapiens: A Brief History of Humankind',
    author: 'ยูวัล โนอาห์ แฮรารี (Yuval Noah Harari)',
    translator: 'ดร.นำชัย ชีววิวรรธน์',
    publisher: 'ยิปซี (Gypsy)',
    category: 'self-help',
    categoryName: 'พัฒนาตนเอง / จิตวิทยา',
    originalPrice: 530,
    salePrice: 320,
    price: 320,
    shipping_fee: 45,
    packing_note: 'เล่มหนา ผู้ขายใส่กล่องพัสดุส่ง Kerry Express',
    conditionPercent: 94,
    conditionGrade: 'สภาพ 94%',
    defectNote: 'ผู้ขายแจ้งว่า: สภาพสะสม 94% อ่านครั้งเดียว ขอบกระดาษขาวสะอาด',
    stock_status: 'Available',
    stock: 1,
    activeQueueCount: 0,
    isNewArrival: true,
    isBestSeller: true,
    pages: 616,
    year: 2563,
    isbn: '978-616-301-656-0'
  },
  {
    id: 'bk-008',
    book_id: 8,
    seller_id: 3,
    seller_name: 'คุณพิมพ์ชนก (Member #2)',
    code: 'MKT-BK08',
    title: '1Q84 เล่ม 1-3 (ชุดครบเซ็ต พิมพ์แรก)',
    enTitle: '1Q84 Complete Trilogy Boxset',
    author: 'ฮารูกิ มูราคามิ (Haruki Murakami)',
    translator: 'มุทิตา พานิช และคณะ',
    publisher: 'กำมะหยี่ (Gammemagie)',
    category: 'rare-books',
    categoryName: 'หนังสือหายาก / สะสม',
    originalPrice: 1150,
    salePrice: 1390,
    price: 1390,
    shipping_fee: 60,
    packing_note: 'ผู้ขายแพ็กใส่กล่องใหญ่พร้อมวัสดุกันกระแทก ส่ง EMS เท่านั้น',
    conditionPercent: 91,
    conditionGrade: 'สภาพ 91%',
    defectNote: 'ผู้ขายแจ้งว่า: หนังสือหายากพิมพ์แรกของสำนักพิมพ์กำมะหยี่ ครบ 3 เล่ม สันปกคมกริบ',
    stock_status: 'Available',
    stock: 1,
    activeQueueCount: 0,
    isNewArrival: true,
    isBestSeller: false,
    pages: 1320,
    year: 2556,
    isbn: '978-616-759-121-6'
  },
  {
    id: 'bk-009',
    book_id: 9,
    seller_id: 2,
    seller_name: 'คุณสมชาย (Member #1)',
    code: 'MKT-BK09',
    title: 'โดราเอมอน คลาสสิก ซีรีส์ เล่ม 1-10',
    enTitle: 'Doraemon Classic Series Vol. 1-10',
    author: 'ฟูจิโกะ เอฟ ฟูจิโอะ (Fujiko F. Fujio)',
    translator: 'เนชั่น เอ็ดดูเทนเมนท์',
    publisher: 'NED Comics',
    category: 'manga',
    categoryName: 'การ์ตูน / มังงะ',
    originalPrice: 950,
    salePrice: 550,
    price: 550,
    shipping_fee: 50,
    packing_note: 'ผู้ขายจัดส่งเป็นชุด 10 เล่มในกล่องพัสดุ',
    conditionPercent: 84,
    conditionGrade: 'สภาพ 84%',
    defectNote: 'ผู้ขายแจ้งว่า: กระดาษมีสีเหลืองตามอายุหนังสือสะสม ไม่บวมน้ำ ไม่แม็ก ไม่ปั๊มเช่า',
    stock_status: 'Available',
    stock: 1,
    activeQueueCount: 0,
    isNewArrival: false,
    isBestSeller: false,
    pages: 1900,
    year: 2557,
    isbn: '978-616-515-412-3'
  },
  {
    id: 'bk-010',
    book_id: 10,
    seller_id: 3,
    seller_name: 'คุณพิมพ์ชนก (Member #2)',
    code: 'MKT-BK10',
    title: 'เจ้าชายน้อย (Le Petit Prince ฉบับปกแข็งสองภาษา)',
    enTitle: 'The Little Prince Bilingual Hardcover',
    author: 'อ็องตวน เดอ แซ็งแตกซูว์เปรี',
    translator: 'อริยา ไพฑูรย์',
    publisher: 'ไทยควอลิตี้บุคส์',
    category: 'translated-novel',
    categoryName: 'นวนิยายแปล',
    originalPrice: 320,
    salePrice: 195,
    price: 195,
    shipping_fee: 35,
    packing_note: 'ผู้ขายจัดส่งผ่านไปรษณีย์ไทย EMS',
    conditionPercent: 96,
    conditionGrade: 'สภาพ 96%',
    defectNote: 'ผู้ขายแจ้งว่า: สภาพเหมือนใหม่ 96% ปกแข็งปั๊มทองไม่ถลอก ภาพประกอบสีน้ำชัดเจนทุกหน้า',
    stock_status: 'Sold Out',
    stock: 0,
    activeQueueCount: 0,
    isNewArrival: true,
    isBestSeller: true,
    pages: 216,
    year: 2564,
    isbn: '978-616-514-601-2'
  }
];

// แพ็กเกจสัญลักษณ์ร้านค้าและดันฟีด 4 ระดับ (Merchant Badge & Smart Feed Boost Tiers)
const MERCHANT_BADGE_TIERS = {
  tier_1: {
    key: 'tier_1',
    name: 'ระดับเริ่มต้น (วางขาย 50 – 100 เล่ม)',
    book_range: '50 – 100 เล่ม',
    original_price: 99,
    promo_price: 49,
    badge_label: '🏪 ร้านค้า 50+',
    boost_level: 1,
    boost_desc: 'ดันฟีดระดับ 1 (เพิ่มโอกาสแสดงผลแถวต้นๆ สลับกับผู้ขายทั่วไป)'
  },
  tier_2: {
    key: 'tier_2',
    name: 'ระดับกลาง (วางขาย 100 – 200 เล่ม)',
    book_range: '100 – 200 เล่ม',
    original_price: 139,
    promo_price: 99,
    badge_label: '🥈 ร้านค้าขายดี 100+',
    boost_level: 2,
    boost_desc: 'ดันฟีดระดับ 2 (แสดงผลโดดเด่นในแถวแรกๆ สลับกับผู้ขายทั่วไป)'
  },
  tier_3: {
    key: 'tier_3',
    name: 'ระดับโปร (วางขาย 300 – 500 เล่ม)',
    book_range: '300 – 500 เล่ม',
    original_price: 229,
    promo_price: 159,
    badge_label: '🥇 ร้านค้าแนะนำ 300+',
    boost_level: 3,
    boost_desc: 'ดันฟีดระดับ 3 (ขึ้นแถวหน้าสุดลำดับต้นๆ สลับกับผู้ขายทั่วไป)'
  },
  tier_4: {
    key: 'tier_4',
    name: 'ระดับพิเศษ VIP (วางขาย 500 – 1,000 เล่ม)',
    book_range: '500 – 1,000 เล่ม',
    original_price: 399,
    promo_price: 299,
    badge_label: '💎 ร้านค้าระดับ VIP 500+',
    boost_level: 4,
    boost_desc: 'ดันฟีดสูงสุดระดับ VIP (ขึ้นแถวแรกๆ เสมอ พร้อมสลับแทรกผู้ขายทั่วไปอย่างสมดุล)'
  }
};

// อัลกอริทึมจัดเรียงหน้าฟีดแบบผสมผสาน (Smart Blended Feed Boost)
// ให้ร้านค้าที่ซื้อแพ็กเกจ (VIP 500+ > แนะนำ 300+ > ขายดี 100+ > ร้านค้า 50+) มีโอกาสแสดงผลในแถวแรกๆ สูงขึ้นตามลำดับขั้น
// แต่สลับแทรก (Interleave) หนังสือของผู้ขายทั่วไปที่ไม่ได้ซื้อแพ็กเกจในทุกๆ แถว (เช่น 2 เล่มร้านค้าดันฟีด สลับกับ 2 เล่มผู้ขายทั่วไป) เพื่อไม่ให้ผู้ขายรายย่อยถูกดันตกไปอยู่หน้าหลังสุด
function blendBooksFeed(books) {
  if (!Array.isArray(books) || books.length <= 2) return books || [];
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

// ข้อมูลรีวิวผู้ขายเริ่มต้น (แสดงบนหน้าสินค้าและหน้าโปรไฟล์)
const DEFAULT_SELLER_REVIEWS = [
  {
    id: 1,
    order_id: 4,
    book_id: 10,
    seller_id: 3,
    buyer_id: 2,
    buyer_name: 'คุณสมชาย (Member #1)',
    rating: 5,
    comment: 'ได้รับหนังสือเจ้าชายน้อยฉบับปกผ้าแล้วครับ สภาพตรงปก 95% ตามที่คุณพิมพ์ชนกแจ้งเป๊ะ แพ็กใส่กล่องแข็งมาอย่างดีมากครับ',
    created_at: '2026-10-24T10:30:00.000Z'
  },
  {
    id: 2,
    order_id: null,
    book_id: 1,
    seller_id: 2,
    buyer_id: 3,
    buyer_name: 'คุณพิมพ์ชนก (Member #2)',
    rating: 5,
    comment: 'คุณสมชายตอบแชทไวมากค่ะ ถ่ายรูปปกหน้า-ปกหลังและสันหนังสือให้ดูครบถ้วน จัดส่งไวภายใน 1 วัน ประทับใจมากค่ะ',
    created_at: '2026-10-23T15:10:00.000Z'
  },
  {
    id: 3,
    order_id: null,
    book_id: 6,
    seller_id: 3,
    buyer_id: 2,
    buyer_name: 'นักอ่านสายสะสม (Verified Buyer)',
    rating: 5,
    comment: 'มังงะสภาพสะสมสวยกริบเหมือนมือหนึ่งเลยครับ ระบบบัญชีกลางมีค่าธรรมเนียมระบบแค่ 5฿ + 5% (เพดานสูงสุดไม่เกิน 30฿/เล่ม) คุ้มและปลอดภัยมากครับ',
    created_at: '2026-10-21T09:15:00.000Z'
  }
];

// ============================================================================
// DATA SERVICE LAYER: แยก "โหมดใช้งานจริง (Live Mode)" กับ "โหมดทดลองเล่น (Demo Mode)"
// พร้อมรองรับการเชื่อมต่อ Cloud Database (Supabase / Firebase / REST API) & Real-time Cross-Tab Sync
// ============================================================================
const APP_MODE_SESSION_KEY = '007_app_mode_session';

function isDemoMode() {
  try {
    if (sessionStorage.getItem(APP_MODE_SESSION_KEY) === 'demo') {
      sessionStorage.removeItem(APP_MODE_SESSION_KEY);
    }
  } catch (e) {}
  return false;
}

function getStoragePrefix() {
  return isDemoMode() ? '007_demo_' : '007_live_';
}

function getActiveStorage() {
  try {
    return isDemoMode() ? sessionStorage : localStorage;
  } catch (e) {
    return localStorage;
  }
}

function getModeItem(key, fallbackJson = 'null') {
  try {
    const store = getActiveStorage();
    const raw = store.getItem(getStoragePrefix() + key);
    return raw !== null ? JSON.parse(raw) : JSON.parse(fallbackJson);
  } catch (e) {
    try { return JSON.parse(fallbackJson); } catch (err) { return null; }
  }
}

function setModeItem(key, value) {
  try {
    const store = getActiveStorage();
    store.setItem(getStoragePrefix() + key, JSON.stringify(value));
    if (!isDemoMode() && key === 'user') {
      try { localStorage.setItem('007_live_session_saved_at', String(Date.now())); } catch (e) {}
    }
    if (!isDemoMode() && window.DataService && typeof window.DataService.broadcastChange === 'function') {
      window.DataService.broadcastChange(key, value);
    }
  } catch (e) {}
}

function removeModeItem(key) {
  try {
    const store = getActiveStorage();
    store.removeItem(getStoragePrefix() + key);
  } catch (e) {}
}

window.isDemoMode = isDemoMode;
window.getStoragePrefix = getStoragePrefix;
window.getModeItem = getModeItem;
window.setModeItem = setModeItem;
window.removeModeItem = removeModeItem;

// ============================================================================
// Safe Session Fallback: เคลียร์ Session เก่า/เสียหายอย่างนุ่มนวล (ไม่ให้ระบบล็อกอินหน้าบ้านค้างหรือพังบน Netlify Static)
// ============================================================================
(function gracefullyCleanLegacySessions() {
  const SESSION_SCHEMA_VERSION = '2';
  const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // อายุ Session ฝั่ง Client 24 ชม. (สอดคล้องกับ Cookie Max-Age=86400)
  const safeRemove = (store, key) => { try { store.removeItem(key); } catch (e) {} };
  const safeGet = (store, key) => { try { return store.getItem(key); } catch (e) { return null; } };

  try {
    // 1. ลบคีย์ระบบเก่า (ก่อนแยก Live/Demo) ที่อาจทำให้สถานะล็อกอินค้าง
    ['007_marketplace_jwt_token', '007_marketplace_user', 'auth_token'].forEach(k => safeRemove(localStorage, k));

    // 2. ตรวจ Session โหมด Live ใน localStorage
    const liveTokenRaw = safeGet(localStorage, '007_live_jwt_token');
    const liveUserRaw = safeGet(localStorage, '007_live_user');
    let liveToken = null;
    let liveUser = null;
    let isBroken = false;
    try { liveToken = liveTokenRaw !== null ? JSON.parse(liveTokenRaw) : null; } catch (e) { isBroken = true; }
    try { liveUser = liveUserRaw !== null ? JSON.parse(liveUserRaw) : null; } catch (e) { isBroken = true; }

    const tokenStr = liveToken ? String(liveToken) : '';
    const hasDemoTokenInLive = tokenStr.startsWith('demo-');
    const hasInvalidUser = liveUserRaw !== null && (!liveUser || typeof liveUser !== 'object' || liveUser.id === undefined);
    const savedAt = Number(safeGet(localStorage, '007_live_session_saved_at') || 0);
    const schema = safeGet(localStorage, '007_session_schema_version');
    const isExpired = Boolean(liveUser) && savedAt > 0 && (Date.now() - savedAt) > SESSION_MAX_AGE_MS;

    if (isBroken || hasDemoTokenInLive || hasInvalidUser || isExpired) {
      safeRemove(localStorage, '007_live_jwt_token');
      safeRemove(localStorage, '007_live_user');
      safeRemove(localStorage, '007_live_session_saved_at');
    } else if (liveUser && !savedAt) {
      // Session ที่ยังใช้ได้แต่ไม่มีเวลาบันทึก (จากเวอร์ชันก่อน) → เริ่มนับอายุใหม่โดยไม่บังคับออกจากระบบ
      try { localStorage.setItem('007_live_session_saved_at', String(Date.now())); } catch (e) {}
    }

    // 3. ลบข้อมูล Demo ที่หลงเหลืออยู่ใน localStorage (Demo ต้องอยู่ใน sessionStorage เท่านั้น)
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('007_demo_')) safeRemove(localStorage, k);
      });
    } catch (e) {}

    // 4. Demo ห้ามมี JWT Token ใดๆ
    safeRemove(sessionStorage, '007_demo_jwt_token');

    if (schema !== SESSION_SCHEMA_VERSION) {
      try { localStorage.setItem('007_session_schema_version', SESSION_SCHEMA_VERSION); } catch (e) {}
    }
  } catch (e) {
    // ห้ามให้การเคลียร์ Session ทำให้หน้าเว็บพัง
  }
})();

// ============================================================================
// 1. ระบบป้องกันการดึงลูกค้านอกระบบ (Anti-Leakage Regex Filter)
// ตรวจจับเบอร์โทรศัพท์ (9-10 หลัก), LINE ID (@, line), หรือลิงก์ URL ภายนอก
// แล้วเซ็นเซอร์เป็น ***[ข้อมูลติดต่อถูกซ่อนเพื่อความปลอดภัย]***
// ============================================================================
const ANTI_LEAKAGE_MASK = '***[ข้อมูลติดต่อถูกซ่อนเพื่อความปลอดภัย]***';
const ANTI_LEAKAGE_WARNING_TEXT = 'การโอนเงินนอกระบบจะไม่ได้รับความคุ้มครองคืนเงินจากบัญชีกลาง';

function sanitizeAntiLeakageText(rawInput) {
  const original = String(rawInput || '');
  if (!original.trim()) {
    return { sanitized: original, sanitizedText: original, text: original, hasLeakage: false, hadLeakage: false, warningMessage: '' };
  }

  let text = original;
  let hasLeakage = false;

  const markAndReplace = (regex) => {
    text = text.replace(regex, () => {
      hasLeakage = true;
      return ANTI_LEAKAGE_MASK;
    });
  };

  // 1) ลิงก์ URL ภายนอก (http://, https://, www., โดเมน .com/.net/.org/.me/.ly/.co.th ฯลฯ)
  markAndReplace(/https?:\/\/[^\s<>"]+/gi);
  markAndReplace(/\bwww\.[^\s<>"]+/gi);
  markAndReplace(/\b[a-zA-Z0-9-]+\.(?:com|net|org|co\.th|in\.th|me|ly|io|shop|store|app|link|page)(?:\/[^\s<>"]*)?\b/gi);

  // 2) LINE ID (@id, line: xxx, line id xxx, แอดไลน์, ไลน์ไอดี)
  markAndReplace(/(?:line\s*id|id\s*line|line|ไลน์ไอดี|ไอดีไลน์|แอดไลน์|ทักไลน์)\s*[:=\-]?\s*[@a-zA-Z0-9._\-]{2,}/gi);
  markAndReplace(/(^|[\s(])@[a-zA-Z0-9._\-]{3,}/g);

  // 3) เบอร์โทรศัพท์ 9-10 หลัก (รองรับทั้งแบบติดกัน มีขีดคั่น หรือเว้นวรรค เช่น 081-234-5678, 0812345678, 02-123-4567, +66812345678)
  markAndReplace(/(?:\+66|0)\s*[0-9][\s.\-]*[0-9]{3,4}[\s.\-]*[0-9]{3,4}\b/g);
  markAndReplace(/\b[0-9]{9,10}\b/g);

  return {
    sanitized: text,
    sanitizedText: text,
    text: text,
    hasLeakage,
    hadLeakage: hasLeakage,
    warningMessage: hasLeakage ? ANTI_LEAKAGE_WARNING_TEXT : ''
  };
}

// ============================================================================
// 2. นิยามเกรดสภาพหนังสือมาตรฐาน (Condition Grade Definitions & Tooltip)
// ============================================================================
function getConditionGradeDefinition(conditionPercent = 90) {
  const pct = Number(conditionPercent || 90);
  if (pct >= 90) {
    return {
      gradeTitle: `สภาพนางฟ้า (${pct}%)`,
      shortBadge: 'สภาพนางฟ้า (90%+)',
      definition: 'ไม่มีรอยพับ ไม่มีขีดเขียน ไม่เหลือง',
      fullTooltip: 'สภาพนางฟ้า (90%+): ไม่มีรอยพับ ไม่มีขีดเขียน ไม่เหลือง'
    };
  }
  if (pct >= 80) {
    return {
      gradeTitle: `สภาพดี (${pct}%)`,
      shortBadge: 'สภาพดี (80%+)',
      definition: 'มีร่องรอยการอ่านเล็กน้อยแต่หน้าครบ',
      fullTooltip: 'สภาพดี (80%+): มีร่องรอยการอ่านเล็กน้อยแต่หน้าครบ'
    };
  }
  return {
    gradeTitle: `สภาพอ่าน (${pct}%)`,
    shortBadge: 'สภาพอ่าน (<80%)',
    definition: 'มีร่องรอยตามกาลเวลาแต่หน้าครบอ่านได้ปกติ',
    fullTooltip: 'สภาพอ่าน: มีร่องรอยตามกาลเวลาแต่หน้าครบอ่านได้ปกติ'
  };
}

// ============================================================================
// 3. ระบบรหัสอุปกรณ์/เซสชัน (Device/Session Fingerprint) & Normalize เบอร์โทร
// ป้องกันผู้ขายกดจองปั่นคิวหนังสือของตัวเอง
// ============================================================================
function getOrCreateDeviceId() {
  try {
    let devId = localStorage.getItem('007_device_fingerprint_id');
    if (!devId) {
      devId = 'DEV-' + Math.random().toString(36).slice(2, 10).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
      localStorage.setItem('007_device_fingerprint_id', devId);
    }
    return devId;
  } catch (e) {
    return 'DEV-FALLBACK-SESSION';
  }
}

function normalizePhoneNumber(phone) {
  return String(phone || '').replace(/\D/g, '');
}

window.sanitizeAntiLeakageText = sanitizeAntiLeakageText;
window.ANTI_LEAKAGE_MASK = ANTI_LEAKAGE_MASK;
window.ANTI_LEAKAGE_WARNING_TEXT = ANTI_LEAKAGE_WARNING_TEXT;
window.getConditionGradeDefinition = getConditionGradeDefinition;
window.getOrCreateDeviceId = getOrCreateDeviceId;
window.normalizePhoneNumber = normalizePhoneNumber;

function getSavedReviews() {
  const custom = getModeItem('custom_reviews', '[]');
  return Array.isArray(custom) ? [...custom, ...DEFAULT_SELLER_REVIEWS] : [...DEFAULT_SELLER_REVIEWS];
}

function getSavedCustomBooks() {
  const custom = getModeItem('custom_books', '[]');
  return Array.isArray(custom) ? custom : [];
}

function getSavedBookStates() {
  const states = getModeItem('book_states', '{}');
  return states && typeof states === 'object' ? states : {};
}

// ปรับแต่งหมวดหมู่ของหนังสือจาก API ให้สอดคล้องกับชื่อหมวดใหม่ และรวมเข้ากับ EXTRA_SHOWCASE_BOOKS ให้ครบทั้ง 20 หมวดหมู่ พร้อมข้อมูลป้ายร้านค้าและดาวเตือน
function normalizeAndEnrichBooks(apiBooks) {
  const categoryNameMap = {};
  CATEGORIES.forEach(c => {
    categoryNameMap[c.id] = c.name;
  });

  const allReviews = getSavedReviews();
  const customBooks = getSavedCustomBooks();
  const bookStates = getSavedBookStates();
  const sourceList = (apiBooks && apiBooks.length > 0) ? apiBooks : CORE_SEED_BOOKS;

  // ดึงข้อมูลผู้ใช้ของโหมดปัจจุบัน (Live หรือ Demo)
  const currentSavedUser = getModeItem('user', 'null');

  const enrichSingleBook = (b, idx = 0, isExtra = false) => {
    let catId = b.category;
    if (b.code === 'MKT-BK01') catId = 'mystery-thriller';
    if (b.code === 'MKT-BK04') catId = 'youth-classic';

    // ให้บางเล่มเป็นตัวอย่าง SOLD OUT และบางเล่มมีหลายเล่ม (Stock > 1)
    let isSoldOut = b.stock_status === 'Sold Out' || b.stock === 0 || b.id === 'bk-010' || b.id === 'bk-004' || b.id === 'bk-017';
    let stockCount = isSoldOut ? 0 : (b.stock !== undefined ? Number(b.stock) : (idx % 5 === 2 ? 2 : 1));
    let stockStatus = stockCount <= 0 ? 'Sold Out' : (b.stock_status || 'Available');

    const sellerId = Number(b.seller_id || (idx % 2 === 0 ? 3 : 2));
    const sellerRevs = allReviews.filter(r => Number(r.seller_id) === sellerId);
    const baseCount = sellerId === 2 ? 28 : 34;
    const sellerRating = b.seller_rating || (sellerId === 2 ? 4.9 : 4.9);
    const sellerReviewsCount = b.seller_reviews_count || (baseCount + Math.max(0, sellerRevs.length - 1));

    // กำหนดสัญลักษณ์ร้านค้า (Merchant Badge), ระดับดันฟีด (boost_level) และดาวเตือนส่งของล่าช้าสะสม (⚠️⭐)
    // เพื่อให้หน้าฟีดแสดงการสลับแทรก (Smart Blended Feed) ระหว่างร้านค้า VIP/Pro/ขายดี กับผู้ขายทั่วไปอย่างสมดุล
    let sellerName = (b.seller_name || (sellerId === 3 ? 'คุณพิมพ์ชนก (สมาชิกร้านค้า #2)' : 'คุณสมชาย (สมาชิกร้านค้า #1)'))
      .replace(/\(Member #(\d+)\)/gi, '(สมาชิกร้านค้า #$1)');
    let badgeLabel = b.seller_badge_label || '';
    let merchantTier = b.merchant_tier || 'none';
    let boostLevel = b.boost_level !== undefined ? Number(b.boost_level) : 0;
    let strikeCount = b.seller_strike_count !== undefined ? Number(b.seller_strike_count) : 0;

    if (!isExtra) {
      if (sellerId === 3 && !badgeLabel) {
        badgeLabel = '💎 ร้านค้าระดับ VIP 500+';
        merchantTier = 'tier_4';
        boostLevel = 4;
        strikeCount = 0;
      } else if (sellerId === 2 && !badgeLabel) {
        badgeLabel = '🥇 ร้านค้าแนะนำ 300+';
        merchantTier = 'tier_3';
        boostLevel = 3;
        strikeCount = 1;
      }
    } else {
      // สำหรับหนังสือเพิ่มเติม 25 เล่ม: แบ่งสัดส่วนให้มีทั้งผู้ขายทั่วไป (ไม่ได้ซื้อแพ็กเกจ) และร้านค้าระดับต่างๆ
      const pattern = idx % 5;
      if (pattern === 0) {
        sellerName = 'คุณกานต์ (นักอ่านส่งต่อหนังสือบ้าน)';
        badgeLabel = '';
        merchantTier = 'none';
        boostLevel = 0;
        strikeCount = 0;
      } else if (pattern === 1) {
        sellerName = 'คุณพิมพ์ชนก (สมาชิกร้านค้า #2)';
        badgeLabel = '💎 ร้านค้าระดับ VIP 500+';
        merchantTier = 'tier_4';
        boostLevel = 4;
        strikeCount = 0;
      } else if (pattern === 2) {
        sellerName = 'คุณมินตรา (นักอ่านรายย่อย)';
        badgeLabel = '';
        merchantTier = 'none';
        boostLevel = 0;
        strikeCount = 0;
      } else if (pattern === 3) {
        sellerName = 'ร้านมุมหนังสือ มือสองคัดสภาพ';
        badgeLabel = '🥈 ร้านค้าขายดี 100+';
        merchantTier = 'tier_2';
        boostLevel = 2;
        strikeCount = 0;
      } else {
        sellerName = 'คุณสมชาย (สมาชิกร้านค้า #1)';
        badgeLabel = '🏪 ร้านค้า 50+';
        merchantTier = 'tier_1';
        boostLevel = 1;
        strikeCount = 1;
      }
    }

    if (currentSavedUser && Number(currentSavedUser.id) === sellerId && !isExtra) {
      if (currentSavedUser.merchant_badge_label) {
        badgeLabel = currentSavedUser.merchant_badge_label;
        merchantTier = currentSavedUser.merchant_tier || merchantTier;
        boostLevel = Number(currentSavedUser.boost_level || boostLevel);
      }
      if (currentSavedUser.strike_count !== undefined) {
        strikeCount = Number(currentSavedUser.strike_count);
      }
    }

    const bookKey = String(b.id || `bk-${String(b.book_id || idx + 1).padStart(3, '0')}`);
    const savedState = bookStates[bookKey] || bookStates[String(b.book_id)] || null;
    const condPct = Number(b.conditionPercent || b.condition_percent || 90);
    const condDef = getConditionGradeDefinition(condPct);
    const safeDefect = sanitizeAntiLeakageText(b.defectNote || b.defect_details || 'สภาพดีมาก หน้าครบถ้วน');
    const safePacking = sanitizeAntiLeakageText(b.packing_note || 'ผู้ขายแพ็กใส่กล่องพัสดุ ห่อบับเบิ้ลกันกระแทกอย่างดี');

    return {
      ...b,
      seller_id: sellerId,
      seller_name: sellerName,
      seller_phone: b.seller_phone || (sellerId === 3 ? '089-876-5432' : '081-234-5678'),
      seller_device_id: b.seller_device_id || (sellerId === 3 ? 'DEV-SELLER-3' : 'DEV-SELLER-2'),
      seller_badge_label: badgeLabel,
      merchant_tier: merchantTier,
      boost_level: boostLevel,
      seller_strike_count: strikeCount,
      category: catId,
      categoryName: categoryNameMap[catId] || b.categoryName || 'นวนิยายแปล',
      conditionPercent: condPct,
      conditionGrade: condDef.gradeTitle,
      conditionDefinition: condDef.definition,
      conditionFullTooltip: condDef.fullTooltip,
      defectNote: safeDefect.sanitized,
      packing_note: safePacking.sanitized,
      stock: savedState && savedState.stock !== undefined ? savedState.stock : stockCount,
      stock_status: (() => { const st = savedState && savedState.stock_status ? savedState.stock_status : stockStatus; return st === 'Reserved' ? 'Available' : st; })(),
      activeQueueCount: 0,
      queues: [],
      seller_rating: sellerRating,
      seller_reviews_count: sellerReviewsCount,
      reviews: b.reviews && b.reviews.length > 0 ? b.reviews : sellerRevs
    };
  };

  const mappedApiBooks = sourceList.map((b, i) => enrichSingleBook(b, i, false));
  const existingIds = new Set(mappedApiBooks.map(b => b.id));
  const combined = [...customBooks.map((b, i) => enrichSingleBook(b, i, false)), ...mappedApiBooks];

  EXTRA_SHOWCASE_BOOKS.forEach((extra, idx) => {
    if (!existingIds.has(extra.id)) {
      combined.push(enrichSingleBook(extra, idx + 10, true));
    }
  });

  return blendBooksFeed(combined);
}

window.MERCHANT_BADGE_TIERS = MERCHANT_BADGE_TIERS;
window.blendBooksFeed = blendBooksFeed;
window.CATEGORIES = CATEGORIES;
window.BOOKS = normalizeAndEnrichBooks([]);
window.CUSTOMER_REVIEWS = CUSTOMER_REVIEWS;
window.DEFAULT_SELLER_REVIEWS = DEFAULT_SELLER_REVIEWS;
window.getSavedReviews = getSavedReviews;
window.generateBookCoverSVG = generateBookCoverSVG;

// ============================================================================
// ระบบ Static / Netlify Serverless Client Fallback
// รองรับทั้งโหมดใช้งานจริง (Live Mode) และโหมดทดลองใช้งาน (Demo Mode)
// ============================================================================
(function setupNetlifyStaticApiFallback() {
  const originalFetch = window.fetch.bind(window);
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const sixMonthsLaterIso = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysLaterIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const DEMO_USERS = [
    {
      id: 1,
      username: 'แอดมินส่วนกลาง (ดูแลบัญชีกลาง)',
      email: 'admin@007marketplace.com',
      phone_number: '02-007-8899',
      phone_verified: true,
      device_id: 'DEV-ADMIN-1',
      role: 'Admin',
      bank_name: 'กสิกรไทย (บัญชีกลางคุ้มครองผู้ซื้อ-ผู้ขาย)',
      bank_account_no: '007-8-99999-0',
      bank_account_name: 'บจก. 007 บุ๊คมาร์เก็ตเพลส (บัญชีกลาง)',
      strike_count: 0,
      strike_mode: 'cumulative',
      seller_banned_until: null,
      is_selling_banned: false,
      selling_status_label: 'ปกติ (ลงขายและซื้อได้ตามปกติ)',
      expired_queue_count: 0,
      queue_banned_until: null,
      merchant_tier: 'none',
      merchant_badge_label: '',
      boost_level: 0
    },
    {
      id: 2,
      username: 'คุณสมชาย (สมาชิกร้านค้า #1)',
      email: 'somchai@member.com',
      phone_number: '081-234-5678',
      phone_verified: true,
      device_id: 'DEV-SELLER-2',
      role: 'Member',
      bank_name: 'ไทยพาณิชย์ (SCB)',
      bank_account_no: '405-1-23456-7',
      bank_account_name: 'นายสมชาย รักการอ่าน',
      strike_count: 1,
      strike_mode: 'cumulative',
      seller_banned_until: null,
      is_selling_banned: false,
      selling_status_label: 'ปกติ (มีดาวเตือนส่งล่าช้าสะสม ⚠️⭐ 1/3 ดวง)',
      expired_queue_count: 1,
      queue_banned_until: null,
      merchant_tier: 'tier_3',
      merchant_badge_label: '🥇 ร้านค้าแนะนำ 300+',
      boost_level: 3
    },
    {
      id: 3,
      username: 'คุณพิมพ์ชนก (สมาชิกร้านค้า #2)',
      email: 'pimchanok@member.com',
      phone_number: '089-876-5432',
      phone_verified: true,
      device_id: 'DEV-SELLER-3',
      role: 'Member',
      bank_name: 'กสิกรไทย (KBank)',
      bank_account_no: '712-2-88888-9',
      bank_account_name: 'น.ส.พิมพ์ชนก วงศ์วรรณ',
      strike_count: 0,
      strike_mode: 'cumulative',
      seller_banned_until: null,
      is_selling_banned: false,
      selling_status_label: 'ปกติ (ลงขายและซื้อได้ตามปกติ)',
      expired_queue_count: 0,
      queue_banned_until: null,
      merchant_tier: 'tier_4',
      merchant_badge_label: '💎 ร้านค้าระดับ VIP 500+',
      boost_level: 4
    },
    {
      id: 4,
      username: 'คุณธนภัทร (ถูกระงับขาย 6 เดือน ⚠️⭐สะสมครบ 3 ดวง)',
      email: 'thanapat@email.com',
      phone_number: '086-555-4321',
      phone_verified: true,
      device_id: 'DEV-SELLER-4',
      role: 'Member',
      bank_name: 'กรุงไทย (KTB)',
      bank_account_no: '981-0-11223-4',
      bank_account_name: 'นายธนภัทร ส่งช้าผิดนัด',
      strike_count: 3,
      strike_mode: 'cumulative',
      seller_banned_until: sixMonthsLaterIso,
      is_selling_banned: true,
      selling_status_label: 'ระงับสิทธิ์การลงขายชั่วคราวเป็นเวลา 6 เดือน (ดาวเตือนสะสมครบ 3 ดวง)',
      expired_queue_count: 0,
      queue_banned_until: null,
      merchant_tier: 'none',
      merchant_badge_label: '',
      boost_level: 0
    }
  ];

  const DEMO_EVIDENCE_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="260" viewBox="0 0 420 260"><rect width="420" height="260" rx="18" fill="#FFF5F5"/><rect x="14" y="14" width="392" height="232" rx="14" fill="#FFFFFF" stroke="#FCA5A5" stroke-width="2" stroke-dasharray="6,4"/><text x="210" y="75" text-anchor="middle" font-family="sans-serif" font-size="17" font-weight="bold" fill="#B91C1C">📸 รูปถ่ายจุดชำรุด + คลิปแกะพัสดุแบบไม่ตัดต่อ</text><text x="210" y="115" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#7F1D1D">เหตุผล: สภาพหนังสือไม่ตรงปก / มุมปกพับและมีรอยขีดเขียน</text><rect x="75" y="135" width="270" height="75" rx="10" fill="#FEF2F2" stroke="#F87171"/><text x="210" y="168" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="bold" fill="#991B1B">❄️ ระงับการโอนเงินให้ผู้ขายชั่วคราว (บัญชีกลางถือเงินไว้)</text><text x="210" y="192" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#B91C1C">รอแอดมินตรวจสอบคลิปแกะกล่องและอนุมัติคืนเงินเต็มจำนวน</text></svg>'
  );

  const DEMO_PREPACK_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220" viewBox="0 0 360 220"><rect width="360" height="220" rx="16" fill="#ECFDF5"/><rect x="12" y="12" width="336" height="196" rx="12" fill="#FFFFFF" stroke="#6EE7B7" stroke-width="2"/><text x="180" y="75" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="bold" fill="#065F46">📦 รูปถ่ายสภาพหนังสือก่อนแพ็กลงกล่อง</text><text x="180" y="110" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#047857">ห่อบับเบิ้ลกันกระแทก 3 ชั้น + ดามกระดาษแข็งมุมปก</text><text x="180" y="150" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#059669">✅ ยืนยันสภาพตรงตามที่แจ้งก่อนส่งมอบขนส่ง</text></svg>'
  );

  const DEMO_RECEIPT_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220" viewBox="0 0 360 220"><rect width="360" height="220" rx="16" fill="#EFF6FF"/><rect x="12" y="12" width="336" height="196" rx="12" fill="#FFFFFF" stroke="#93C5FD" stroke-width="2"/><text x="180" y="70" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="bold" fill="#1E40AF">🧾 ใบเสร็จรับฝากส่งพัสดุ (ยืนยันเลขพัสดุจริง)</text><text x="180" y="108" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#1D4ED8">ขนส่ง: ไปรษณีย์ไทย (EMS) • น้ำหนัก 0.48 กก.</text><text x="180" y="145" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#2563EB">✅ ระบบตรวจสอบสถานะขนส่งอัตโนมัติ: รับเข้าระบบแล้ว</text></svg>'
  );

  const DEMO_MERCHANT_SUBSCRIPTIONS = [
    { id: 1, user_id: 3, username: 'คุณพิมพ์ชนก (สมาชิกร้านค้า #2)', tier_key: 'tier_4', tier_name: 'ระดับพิเศษ VIP (วางขาย 500 – 1,000 เล่ม)', badge_label: '💎 ร้านค้าระดับ VIP 500+', boost_level: 4, original_price: 399, paid_amount: 299, created_at: new Date().toISOString() },
    { id: 2, user_id: 2, username: 'คุณสมชาย (สมาชิกร้านค้า #1)', tier_key: 'tier_3', tier_name: 'ระดับโปร (วางขาย 300 – 500 เล่ม)', badge_label: '🥇 ร้านค้าแนะนำ 300+', boost_level: 3, original_price: 229, paid_amount: 159, created_at: new Date().toISOString() },
    { id: 3, user_id: 2, username: 'ร้านมุมหนังสือ มือสองคัดสภาพ', tier_key: 'tier_2', tier_name: 'ระดับกลาง (วางขาย 100 – 200 เล่ม)', badge_label: '🥈 ร้านค้าขายดี 100+', boost_level: 2, original_price: 139, paid_amount: 99, created_at: new Date().toISOString() },
    { id: 4, user_id: 3, username: 'ร้านปลายฟ้า บุ๊คสโตร์', tier_key: 'tier_1', tier_name: 'ระดับเริ่มต้น (วางขาย 50 – 100 เล่ม)', badge_label: '🏪 ร้านค้า 50+', boost_level: 1, original_price: 99, paid_amount: 49, created_at: new Date().toISOString() }
  ];

  const DEMO_ORDERS = [
    {
      id: 1,
      order_code: 'ESC-007201',
      book_id: 4,
      book_title: 'ความสุขของกะทิ (ฉบับปกแข็งครบรอบ 15 ปี)',
      buyer_id: 2,
      buyer_name: 'คุณสมชาย (สมาชิกร้านค้า #1)',
      buyer_email: 'somchai@member.com',
      seller_id: 3,
      seller_name: 'คุณพิมพ์ชนก (สมาชิกร้านค้า #2)',
      seller_bank_name: 'กสิกรไทย (KBank)',
      seller_bank_no: '712-2-88888-9',
      book_price: 140,
      shipping_fee: 30,
      platform_fee: 12,
      total_amount: 182,
      seller_payout: 170,
      recipient_name: 'นายสมชาย รักการอ่าน',
      recipient_phone: '081-234-5678',
      shipping_address: '99/12 ถ.ลาดพร้าว แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900',
      slip_reference: 'SLIP-SCB-20261025-0912',
      tracking_no: '',
      shipping_carrier: '',
      pre_pack_photo: '',
      shipping_receipt_photo: '',
      tracking_verified: false,
      tracking_status_text: 'รอผู้ขายจัดส่งและแนบหลักฐาน',
      extension_requested: false,
      extension_status: 'none',
      extension_reason: '',
      status: 'Pending Payment',
      payout_status: 'Holding in Escrow',
      shipping_deadline: null
    },
    {
      id: 2,
      order_code: 'ESC-007202',
      book_id: 2,
      book_title: 'ชีวิตดีขึ้นทุกๆ ด้าน ด้วยการจัดบ้านแค่ครั้งเดียว',
      buyer_id: 2,
      buyer_name: 'คุณสมชาย (สมาชิกร้านค้า #1)',
      buyer_email: 'somchai@member.com',
      seller_id: 3,
      seller_name: 'คุณพิมพ์ชนก (สมาชิกร้านค้า #2)',
      seller_bank_name: 'กสิกรไทย (KBank)',
      seller_bank_no: '712-2-88888-9',
      book_price: 129,
      shipping_fee: 35,
      platform_fee: 11,
      total_amount: 175,
      seller_payout: 164,
      recipient_name: 'นายสมชาย รักการอ่าน',
      recipient_phone: '081-234-5678',
      shipping_address: '99/12 ถ.สุขุมวิท แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110',
      slip_reference: 'SLIP-KBANK-882941',
      tracking_no: '',
      shipping_carrier: '',
      pre_pack_photo: '',
      shipping_receipt_photo: '',
      tracking_verified: false,
      tracking_status_text: 'รอผู้ขายจัดส่งภายใน 48 ชม.',
      extension_requested: false,
      extension_status: 'none',
      extension_reason: '',
      status: 'Paid - Awaiting Shipment',
      payout_status: 'Holding in Escrow',
      shipping_deadline: new Date(Date.now() + 46 * 3600 * 1000).toISOString()
    },
    {
      id: 3,
      order_code: 'ESC-007203',
      book_id: 8,
      book_title: 'Atomic Habits เพราะชีวิตดีได้กว่าที่เป็น',
      buyer_id: 2,
      buyer_name: 'คุณสมชาย (สมาชิกร้านค้า #1)',
      buyer_email: 'somchai@member.com',
      seller_id: 3,
      seller_name: 'คุณพิมพ์ชนก (สมาชิกร้านค้า #2)',
      seller_bank_name: 'กสิกรไทย (KBank)',
      seller_bank_no: '712-2-88888-9',
      book_price: 180,
      shipping_fee: 35,
      platform_fee: 14,
      total_amount: 229,
      seller_payout: 215,
      recipient_name: 'นายสมชาย รักการอ่าน',
      recipient_phone: '081-234-5678',
      shipping_address: '99/12 ถ.ลาดพร้าว แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900',
      slip_reference: 'SLIP-SCB-20261023-1410',
      tracking_no: 'EF998123456TH',
      shipping_carrier: 'ไปรษณีย์ไทย (EMS)',
      pre_pack_photo: DEMO_PREPACK_SVG,
      shipping_receipt_photo: DEMO_RECEIPT_SVG,
      tracking_verified: true,
      tracking_status_text: '✅ ตรวจสอบเลขพัสดุกับระบบขนส่งไปรษณีย์ไทยสำเร็จ: รับเข้าระบบที่ทำการไปรษณีย์ต้นทางแล้ว',
      extension_requested: false,
      extension_status: 'none',
      extension_reason: '',
      status: 'Shipped',
      payout_status: 'Holding in Escrow',
      shipping_deadline: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      inspection_expires_at: new Date(Date.now() + 22 * 3600 * 1000).toISOString()
    },
    {
      id: 4,
      order_code: 'ESC-007204',
      book_id: 10,
      book_title: 'เจ้าชายน้อย (Le Petit Prince ฉบับปกแข็งสองภาษา)',
      buyer_id: 2,
      buyer_name: 'คุณสมชาย (สมาชิกร้านค้า #1)',
      buyer_email: 'somchai@member.com',
      seller_id: 3,
      seller_name: 'คุณพิมพ์ชนก (สมาชิกร้านค้า #2)',
      seller_bank_name: 'กสิกรไทย (KBank)',
      seller_bank_no: '712-2-88888-9',
      book_price: 440,
      shipping_fee: 45,
      platform_fee: 27,
      total_amount: 512,
      seller_payout: 485,
      recipient_name: 'นายสมชาย รักการอ่าน',
      recipient_phone: '081-234-5678',
      shipping_address: '99/12 ถ.ลาดพร้าว แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900',
      slip_reference: 'SLIP-SCB-20261020-1105',
      tracking_no: 'KEX007554433TH',
      shipping_carrier: 'Kerry Express',
      pre_pack_photo: DEMO_PREPACK_SVG,
      shipping_receipt_photo: DEMO_RECEIPT_SVG,
      tracking_verified: true,
      tracking_status_text: '✅ จัดส่งสำเร็จ (ผู้ซื้อตรวจรับหนังสือและยืนยันเรียบร้อยแล้ว)',
      extension_requested: false,
      extension_status: 'none',
      extension_reason: '',
      status: 'Completed & Released',
      payout_status: 'Released to Seller',
      shipping_deadline: new Date().toISOString()
    },
    {
      id: 5,
      order_code: 'ESC-007205',
      book_id: 9,
      book_title: 'จิตวิทยาสายดาร์ก (Dark Psychology)',
      buyer_id: 3,
      buyer_name: 'คุณพิมพ์ชนก (สมาชิกร้านค้า #2)',
      buyer_email: 'pimchanok@member.com',
      seller_id: 2,
      seller_name: 'คุณสมชาย (สมาชิกร้านค้า #1)',
      seller_bank_name: 'ไทยพาณิชย์ (SCB)',
      seller_bank_no: '405-1-23456-7',
      book_price: 175,
      shipping_fee: 35,
      platform_fee: 14,
      total_amount: 224,
      seller_payout: 210,
      recipient_name: 'น.ส.พิมพ์ชนก วงศ์วรรณ',
      recipient_phone: '089-876-5432',
      shipping_address: '88/9 คอนโดเดอะพาร์ค ถ.พระราม 9 ห้วยขวาง กรุงเทพฯ 10310',
      slip_reference: 'SLIP-KBANK-20261024-1840',
      tracking_no: 'TH019283746A',
      shipping_carrier: 'Flash Express',
      pre_pack_photo: DEMO_PREPACK_SVG,
      shipping_receipt_photo: DEMO_RECEIPT_SVG,
      tracking_verified: true,
      tracking_status_text: '❄️ พัสดุถึงปลายทางแล้ว — อยู่ระหว่างตรวจสอบข้อพิพาทขอคืนเงิน',
      extension_requested: false,
      extension_status: 'none',
      extension_reason: '',
      status: 'Disputed - Return Requested',
      payout_status: 'Frozen - Dispute Pending Admin',
      escrow_frozen: 1,
      dispute_category: 'สภาพหนังสือไม่ตรงปก',
      dispute_reason: '[สภาพหนังสือไม่ตรงปก] มีรอยขีดเขียนด้วยปากกาไฮไลท์ประมาณ 6 หน้า ไม่ตรงกับที่แจ้งว่าไม่มีรอยขีดเขียน แนบคลิปวิดีโอตอนแกะพัสดุแบบไม่ตัดต่อมาพร้อมคำร้องขอคืนเงินครับ',
      dispute_evidence_image: DEMO_EVIDENCE_SVG,
      unboxing_video_evidence: 'คลิปวิดีโอแกะพัสดุแบบไม่ตัดต่อ_ESC-007205.mp4 (ความยาว 01:42 นาที • ยืนยันเห็นเลขพัสดุหน้ากล่องชัดเจน)',
      return_shipping_fee: 35,
      shipping_deadline: new Date().toISOString()
    }
  ];

  function createJsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'X-Static-Fallback': 'Netlify',
        'X-App-Mode': isDemoMode() ? 'demo' : 'live'
      }
    });
  }

  const liveSyncChannel = typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('007_book_market_live_sync')
    : null;

  if (liveSyncChannel) {
    liveSyncChannel.onmessage = (event) => {
      if (!isDemoMode() && event.data && event.data.type === 'DATA_UPDATED') {
        window.BOOKS = normalizeAndEnrichBooks([]);
        window.dispatchEvent(new CustomEvent('booksLoaded', { detail: { books: window.BOOKS } }));
        window.dispatchEvent(new CustomEvent('escrowUpdated'));
      }
    };
  }

  window.CLOUD_DB_CONFIG = window.CLOUD_DB_CONFIG || {
    provider: 'hybrid-cloud-ready',
    supabaseUrl: '',
    supabaseAnonKey: '',
    apiBaseUrl: ''
  };

  function getActiveUsersList() {
    const saved = getModeItem('users_list', 'null');
    if (Array.isArray(saved) && saved.length > 0) return saved;
    const initial = JSON.parse(JSON.stringify(DEMO_USERS));
    setModeItem('users_list', initial);
    return initial;
  }

  function saveActiveUsersList(list) {
    setModeItem('users_list', list);
  }

  function getActiveOrdersList() {
    const saved = getModeItem('orders_list', 'null');
    if (Array.isArray(saved)) {
      return saved.map(o => {
        const fee = calculateEscrowFee(o.book_price);
        return {
          ...o,
          platform_fee: fee,
          total_amount: Number(o.book_price || 0) + Number(o.shipping_fee || 0) + fee
        };
      });
    }
    const initial = JSON.parse(JSON.stringify(DEMO_ORDERS));
    setModeItem('orders_list', initial);
    return initial;
  }

  function saveActiveOrdersList(list) {
    setModeItem('orders_list', list);
  }

  function getActiveReservationsList() {
    const saved = getModeItem('reservations_list', 'null');
    if (Array.isArray(saved)) return saved;
    const initial = [];
    setModeItem('reservations_list', initial);
    return initial;
  }

  function saveActiveReservationsList(list) {
    setModeItem('reservations_list', list);
  }

  function getActiveChatRoomsMap() {
    const saved = getModeItem('chat_rooms_map', 'null');
    if (saved && typeof saved === 'object') return saved;
    const book = window.BOOKS[0] || CORE_SEED_BOOKS[0];
    const initial = {
      '1': {
        room: {
          id: 1,
          room_code: 'CHAT-BK01-B3',
          book_id: 1,
          book_code: book.code,
          book_title: book.title,
          book_price: book.salePrice,
          price: book.salePrice,
          shipping_fee: book.shipping_fee,
          condition_percent: book.conditionPercent,
          condition_grade: book.conditionGrade,
          defect_details: book.defectNote,
          packing_note: book.packing_note,
          stock_status: book.stock_status,
          buyer_id: 3,
          buyer_name: 'คุณพิมพ์ชนก (สมาชิกร้านค้า #2)',
          seller_id: 2,
          seller_name: 'คุณสมชาย (สมาชิกร้านค้า #1)'
        },
        reservation: {
          id: 1,
          queue_no: 1,
          status: 'Active',
          expires_at: new Date(Date.now() + 4.5 * 3600 * 1000).toISOString()
        },
        messages: [
          {
            id: 1,
            sender_role: 'AI_Bot',
            sender_name: '🤖 ผู้ช่วยอัจฉริยะดูแลการซื้อขายครบวงจร',
            message: `🤖 [ระบบดูแลการซื้อขายครบวงจร — ขั้นตอนที่ 1/6 & 2/6]: ยินดีต้อนรับสู่ห้องแชทคำสั่งซื้อหนังสือ "${book.title}"!\n✅ [ขั้นตอนที่ 1/6 - สั่งซื้อสำเร็จ]: สถานะ: รอโอนเงินเข้าบัญชีกลาง)\n💳 [ขั้นตอนที่ 2/6 - แจ้งยอดโอนเข้าบัญชีกลาง]: ค่าหนังสือ ฿${book.salePrice} + ค่าส่ง ฿${book.shipping_fee} + ค่าธรรมเนียมระบบ (5฿ + 5% สูงสุด 30฿) ฿${calculateEscrowFee(book.salePrice)} = ยอดโอนสุทธิ ฿${Number(book.salePrice) + Number(book.shipping_fee) + calculateEscrowFee(book.salePrice)}\n🛡️ [คำเตือนความปลอดภัย]: การโอนเงินนอกระบบจะไม่ได้รับความคุ้มครองคืนเงินจากบัญชีกลาง\n📦 [ขั้นตอนที่ 3/6 - กติกาผู้ขายจัดส่งภายใน 48 ชม.]: ผู้ขายต้องแนบรูปหนังสือก่อนแพ็ก + ใบเสร็จขนส่ง (หากส่งล่าช้าเกิน 48 ชม. จะได้รับดาวเตือนสะสม ⚠️⭐ 1 ดวง ครบ 3 ดวงระงับสิทธิ์ขาย 6 เดือน)\n🎥 [ขั้นตอนที่ 4/6 - 6/6]: เมื่อได้รับพัสดุ กรุณาถ่ายคลิปวิดีโอตอนแกะพัสดุแบบไม่ตัดต่อไว้เป็นหลักฐาน หากสินค้าไม่ตรงปกสามารถกดปุ่ม "🔄 แจ้งปัญหา / ขอคืนสินค้า" ด้านบนห้องแชทได้ทันที!`,
            created_at: new Date(Date.now() - 600000).toISOString()
          }
        ]
      }
    };
    setModeItem('chat_rooms_map', initial);
    return initial;
  }

  function saveActiveChatRoomsMap(mapObj) {
    setModeItem('chat_rooms_map', mapObj);
  }

  function getActiveMerchantSubs() {
    const saved = getModeItem('merchant_subs', 'null');
    if (Array.isArray(saved)) return saved;
    const initial = JSON.parse(JSON.stringify(DEMO_MERCHANT_SUBSCRIPTIONS));
    setModeItem('merchant_subs', initial);
    return initial;
  }

  function saveActiveMerchantSubs(list) {
    setModeItem('merchant_subs', list);
  }

  function getActiveLeakageReports() {
    const saved = getModeItem('leakage_reports', '[]');
    return Array.isArray(saved) ? saved : [];
  }

  function saveActiveLeakageReports(list) {
    setModeItem('leakage_reports', list);
  }

  function getOrCreateCsrfToken() {
    // ถ้ารันบน Node Server จริง ให้ใช้ค่าจากคุกกี้ csrf_token (Double-Submit Cookie) เพื่อให้ตรงกับที่เซิร์ฟเวอร์ตรวจ
    try {
      const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
      if (match && match[1]) {
        const cookieToken = decodeURIComponent(match[1]);
        try { sessionStorage.setItem('007_csrf_token', cookieToken); } catch (e) {}
        return cookieToken;
      }
    } catch (e) {}
    // Fallback สำหรับ Netlify Static: สร้าง Token แบบสุ่มเก็บใน sessionStorage
    try {
      let token = sessionStorage.getItem('007_csrf_token');
      if (!token) {
        const rand = (window.crypto && window.crypto.getRandomValues)
          ? Array.from(window.crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
        token = 'csrf_' + rand;
        sessionStorage.setItem('007_csrf_token', token);
      }
      return token;
    } catch (e) {
      return 'csrf_static_fallback_token';
    }
  }
  window.getOrCreateCsrfToken = getOrCreateCsrfToken;

  // ตรวจสอบสิทธิ์ IDOR: ต้องเป็น buyer_id, seller_id หรือ Admin เท่านั้น
  function isAuthorizedForEntity(user, entity) {
    if (!user || !entity) return false;
    if (user.role === 'Admin') return true;
    const uid = Number(user.id);
    return (
      (entity.buyer_id !== undefined && Number(entity.buyer_id) === uid) ||
      (entity.seller_id !== undefined && Number(entity.seller_id) === uid)
    );
  }
  window.isAuthorizedForEntity = isAuthorizedForEntity;

  window.DataService = {
    getMode: () => (isDemoMode() ? 'demo' : 'live'),
    isDemoMode,
    getCsrfToken: getOrCreateCsrfToken,
    getCloudConfig: () => window.CLOUD_DB_CONFIG,
    configureCloudDatabase: (config = {}) => {
      window.CLOUD_DB_CONFIG = { ...window.CLOUD_DB_CONFIG, ...config };
      try { localStorage.setItem('007_cloud_db_config', JSON.stringify(window.CLOUD_DB_CONFIG)); } catch (e) {}
    },
    broadcastChange: (key) => {
      if (liveSyncChannel && !isDemoMode()) {
        try { liveSyncChannel.postMessage({ type: 'DATA_UPDATED', key, timestamp: Date.now() }); } catch (e) {}
      }
    },
    // สลับบัญชีในโหมด Demo ทำงานบน sessionStorage ของเบราว์เซอร์ 100% โดยไม่สร้าง JWT Token จริงที่เรียก API ข้อมูลจริงได้
    switchDemoAccount: (email) => {
      if (!isDemoMode()) {
        try { sessionStorage.setItem(APP_MODE_SESSION_KEY, 'demo'); } catch (e) {}
      }
      const emailClean = String(email || '').trim().toLowerCase();
      const normalized = emailClean.replace('@email.com', '@member.com');
      const demoList = getActiveUsersList();
      const targetUser = demoList.find(u => {
        const m = String(u.email || '').toLowerCase();
        return m === emailClean || m === normalized;
      }) || demoList[1];
      try {
        sessionStorage.setItem('007_demo_user', JSON.stringify(targetUser));
        sessionStorage.removeItem('007_demo_jwt_token');
      } catch (e) {}
      window.BOOKS = normalizeAndEnrichBooks([]);
      return targetUser;
    },
    resetDemoSandbox: () => {
      try {
        Object.keys(sessionStorage).forEach(k => {
          if (k.startsWith('007_demo_')) sessionStorage.removeItem(k);
        });
      } catch (e) {}
    }
  };

  async function handleStaticApiRequest(urlStr, options = {}) {
    const url = new URL(urlStr, window.location.origin);
    const path = url.pathname;
    const method = (options.method || 'GET').toUpperCase();
    let body = {};
    if (options.body) {
      try { body = JSON.parse(options.body); } catch (e) {}
    }

    if (path === '/api/auth/csrf-token' && method === 'GET') {
      return createJsonResponse({ csrfToken: getOrCreateCsrfToken() });
    }

    // ตรวจสอบ CSRF Token สำหรับคำขอ POST (ต้องแนบ Header มาเท่านั้น)
    if (method === 'POST') {
      const headersObj = options.headers || {};
      const headerCsrf = headersObj['X-CSRF-Token'] || headersObj['x-csrf-token'] || body._csrf || '';
      const expectedCsrf = getOrCreateCsrfToken();
      if (!headerCsrf || headerCsrf !== expectedCsrf) {
        return createJsonResponse({ error: '🛡️ รหัสความปลอดภัย (CSRF) ไม่ถูกต้อง กรุณารีเฟรชหน้าเว็บแล้วลองใหม่อีกครั้ง', code: 'CSRF_TOKEN_INVALID' }, 403);
      }
    }

    const activeUsers = getActiveUsersList();
    const savedUser = getModeItem('user', 'null');
    const savedToken = getModeItem('jwt_token', 'null');
    // แยกโหมด Demo ออกจาก API จริงเด็ดขาด: ในโหมด Live ห้ามใช้ Token ของ Demo เด็ดขาด
    const isValidLiveSession = !isDemoMode() ? (!savedToken || !String(savedToken).startsWith('demo-')) : true;
    const currentUser = isValidLiveSession ? (savedUser || (isDemoMode() ? activeUsers[1] : null)) : null;

    // ปิด Demo/Simulation API ในโหมดใช้งานจริง (Live = Production) — ใช้ได้เฉพาะในโหมดทดลองเล่นเท่านั้น
    if (!isDemoMode()) {
      const isAdminUser = Boolean(currentUser && currentUser.role === 'Admin');
      const isSimulationPath =
        /\/simulate-/.test(path) ||
        (path === '/api/users/clear-strikes' && !isAdminUser) ||
        (path === '/api/users/clear-queue-ban' && !isAdminUser) ||
        (path === '/api/admin/reset-seed' && !isAdminUser);
      if (isSimulationPath) {
        return createJsonResponse({
          error: '🔒 ฟังก์ชันจำลอง/ทดสอบใช้ได้เฉพาะใน "โหมดทดลองเล่น (Demo)" เท่านั้น ไม่กระทบระบบซื้อขายจริง',
          code: 'DEMO_API_DISABLED_IN_PRODUCTION'
        }, 403);
      }
    }

    if (path === '/api/books' && method === 'GET') {
      window.BOOKS = normalizeAndEnrichBooks([]);
      return createJsonResponse({
        books: window.BOOKS,
        mode: isDemoMode() ? 'demo' : 'live',
        pagination: { page: 1, limit: 12, total: window.BOOKS.length, totalPages: Math.ceil(window.BOOKS.length / 12), hasMore: window.BOOKS.length > 12 }
      });
    }

    if (path === '/api/books' && method === 'POST') {
      if (!currentUser) {
        return createJsonResponse({ error: 'กรุณาเข้าสู่ระบบก่อนลงประกาศขายหนังสือ' }, 401);
      }
      if (currentUser.seller_banned_until && new Date(currentUser.seller_banned_until).getTime() > Date.now()) {
        const banDateStr = new Date(currentUser.seller_banned_until).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
        return createJsonResponse({
          error: `🔒 บัญชีของคุณอยู่ในสถานะ "ระงับสิทธิ์การลงขายชั่วคราวเป็นเวลา 6 เดือน" (จนถึงวันที่ ${banDateStr}) เนื่องจากได้รับสัญลักษณ์ดาวเตือนส่งของล่าช้าสะสม (⚠️⭐) ครบ ${currentUser.strike_count || 3} ดวง — คุณยังสามารถซื้อหนังสือได้ตามปกติครับ`,
          code: 'SELLER_BANNED_6_MONTHS'
        }, 403);
      }
      const uploadedImages = Array.isArray(body.images) ? body.images.filter(Boolean) : [];
      if (uploadedImages.length < 2 || uploadedImages.length > 10) {
        return createJsonResponse({
          error: '⚠️ กฎการลงขายหนังสือ: ต้องอัปโหลดรูปภาพขั้นต่ำ 2 รูป (รูปที่ 1: ปกหน้า, รูปที่ 2: ปกหลัง) และสูงสุดไม่เกิน 10 รูป'
        }, 400);
      }
      const stockQty = Math.max(1, parseInt(body.stock || 1, 10) || 1);
      const newIdNum = window.BOOKS.length + 1;
      const condPct = parseInt(body.condition_percent || 90, 10);
      const condDef = getConditionGradeDefinition(condPct);
      const defectSanitized = sanitizeAntiLeakageText(body.defect_details || 'สภาพดีมาก');
      const packingSanitized = sanitizeAntiLeakageText(body.packing_note || 'ผู้ขายแพ็กจัดส่งอย่างดี');
      const hasLeakageInBook = defectSanitized.hasLeakage || packingSanitized.hasLeakage;

      const newBook = {
        id: `bk-${String(newIdNum).padStart(3, '0')}`,
        book_id: newIdNum,
        seller_id: currentUser.id,
        seller_name: currentUser.username,
        seller_phone: currentUser.phone_number || '',
        seller_device_id: currentUser.device_id || getOrCreateDeviceId(),
        seller_badge_label: currentUser.merchant_badge_label || '',
        merchant_tier: currentUser.merchant_tier || 'none',
        boost_level: Number(currentUser.boost_level || 0),
        seller_strike_count: Number(currentUser.strike_count || 0),
        seller_rating: 5.0,
        seller_reviews_count: 18,
        code: `MKT-BK${String(newIdNum).padStart(2, '0')}`,
        title: body.title,
        enTitle: body.en_title || body.title,
        author: body.author,
        publisher: body.publisher || 'ไม่ระบุสำนักพิมพ์',
        category: body.category || 'translated-novel',
        categoryName: body.category_name || 'นวนิยายแปล',
        originalPrice: Number(body.original_price || Number(body.price) * 1.3),
        salePrice: Number(body.price),
        price: Number(body.price),
        shipping_fee: Number(body.shipping_fee || 40),
        packing_note: packingSanitized.sanitized,
        conditionPercent: condPct,
        conditionGrade: condDef.gradeTitle,
        conditionDefinition: condDef.definition,
        conditionFullTooltip: condDef.fullTooltip,
        defectNote: defectSanitized.sanitized,
        images: uploadedImages,
        stock_status: 'Available',
        stock: stockQty,
        activeQueueCount: 0,
        isNewArrival: true,
        isBestSeller: false,
        reviews: getSavedReviews()
      };
      const customBooks = getSavedCustomBooks();
      customBooks.unshift(newBook);
      setModeItem('custom_books', customBooks);
      window.BOOKS = normalizeAndEnrichBooks([]);
      window.dispatchEvent(new CustomEvent('booksLoaded', { detail: { books: window.BOOKS } }));
      return createJsonResponse({
        message: hasLeakageInBook
          ? `🎉 ลงประกาศขาย "${newBook.title}" สำเร็จ! (ระบบได้ซ่อนข้อมูลติดต่อนอกระบบอัตโนมัติ: ${ANTI_LEAKAGE_WARNING_TEXT})`
          : `🎉 ลงประกาศขายหนังสือ "${newBook.title}" สำเร็จ! (จำนวน ${stockQty} เล่ม • รูปภาพ ${uploadedImages.length} รูป)`,
        hasLeakage: hasLeakageInBook,
        warningMessage: hasLeakageInBook ? ANTI_LEAKAGE_WARNING_TEXT : '',
        book: newBook
      }, 201);
    }

    if (path === '/api/merchant/tiers' && method === 'GET') {
      return createJsonResponse({ tiers: Object.values(MERCHANT_BADGE_TIERS) });
    }

    if (path === '/api/merchant/subscribe' && method === 'POST') {
      if (!currentUser) {
        return createJsonResponse({ error: 'กรุณาเข้าสู่ระบบก่อนสมัครแพ็กเกจร้านค้า' }, 401);
      }
      const tier = MERCHANT_BADGE_TIERS[body.tier_key];
      if (!tier) {
        return createJsonResponse({ error: 'กรุณาเลือกแพ็กเกจที่ต้องการสมัคร' }, 400);
      }
      const updatedUser = {
        ...currentUser,
        merchant_tier: tier.key,
        merchant_badge_label: tier.badge_label,
        boost_level: tier.boost_level,
        merchant_expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
      };
      setModeItem('user', updatedUser);
      const users = getActiveUsersList().map(u => Number(u.id) === Number(updatedUser.id) ? updatedUser : u);
      saveActiveUsersList(users);

      const subs = getActiveMerchantSubs();
      subs.unshift({
        id: Date.now(),
        user_id: updatedUser.id,
        username: updatedUser.username,
        tier_key: tier.key,
        tier_name: tier.name,
        badge_label: tier.badge_label,
        boost_level: tier.boost_level,
        original_price: tier.original_price,
        paid_amount: tier.promo_price,
        created_at: new Date().toISOString()
      });
      saveActiveMerchantSubs(subs);

      window.BOOKS = normalizeAndEnrichBooks([]);
      window.dispatchEvent(new CustomEvent('booksLoaded', { detail: { books: window.BOOKS } }));
      return createJsonResponse({
        message: `👑 สมัครแพ็กเกจ "${tier.name}" (${tier.badge_label}) สำเร็จ! ชำระเพียง ฿${tier.promo_price}/เดือน ระบบติดป้ายร้านค้าและเปิดระบบดันฟีดระดับ ${tier.boost_level} เรียบร้อยแล้ว!`,
        user: updatedUser
      }, 201);
    }

    // ระบบติดดาวเตือนผู้ขายแบบนับสะสมต่อเนื่อง (ไม่รีเซ็ตทุกต้นเดือน)
    if (path === '/api/users/simulate-strike' && method === 'POST') {
      const targetId = Number(body.user_id || (currentUser && currentUser.id) || 2);
      const users = getActiveUsersList();
      const targetUser = users.find(u => Number(u.id) === targetId) || currentUser || users[1];
      const nextStrikes = Number(targetUser.strike_count || 0) + 1;
      const isBanned = nextStrikes >= 3;
      const bannedUntil = isBanned ? sixMonthsLaterIso : null;
      const updatedUser = {
        ...targetUser,
        strike_count: nextStrikes,
        strike_mode: 'cumulative',
        seller_banned_until: bannedUntil,
        is_selling_banned: isBanned,
        selling_status_label: isBanned
          ? 'ระงับสิทธิ์การลงขายชั่วคราวเป็นเวลา 6 เดือน (ดาวเตือนสะสมครบ 3 ดวง)'
          : `ปกติ (มีดาวเตือนส่งล่าช้าสะสม ⚠️⭐ ${nextStrikes}/3 ดวง)`
      };
      const nextUsers = users.map(u => Number(u.id) === Number(updatedUser.id) ? updatedUser : u);
      saveActiveUsersList(nextUsers);
      if (currentUser && Number(currentUser.id) === Number(updatedUser.id)) {
        setModeItem('user', updatedUser);
      }
      window.BOOKS = normalizeAndEnrichBooks([]);
      return createJsonResponse({
        message: isBanned
          ? `🔒 สะสมดาวเตือนครบ ${nextStrikes} ดวง (แบบนับสะสมต่อเนื่อง)! ระบบได้เปลี่ยนสถานะเป็น "ระงับสิทธิ์การลงขายชั่วคราวเป็นเวลา 6 เดือน" — ยังซื้อหนังสือได้ตามปกติ แต่ปุ่ม '+ ลงขายหนังสือ' จะถูกล็อกชั่วคราว`
          : `⚠️⭐ บันทึกสัญลักษณ์ดาวเตือนความผิดพลาดที่โปรไฟล์แล้ว (นับสะสมต่อเนื่อง ${nextStrikes}/3 ดวง — ไม่รีเซ็ตต้นเดือน)`,
        user: updatedUser
      });
    }

    if (path === '/api/users/clear-strikes' && method === 'POST') {
      const targetId = Number(body.user_id || (currentUser && currentUser.id) || 2);
      const users = getActiveUsersList();
      const targetUser = users.find(u => Number(u.id) === targetId) || currentUser || users[1];
      const updatedUser = {
        ...targetUser,
        strike_count: 0,
        strike_mode: 'cumulative',
        seller_banned_until: null,
        is_selling_banned: false,
        selling_status_label: 'ปกติ (ลงขายและซื้อได้ตามปกติ)'
      };
      const nextUsers = users.map(u => Number(u.id) === Number(updatedUser.id) ? updatedUser : u);
      saveActiveUsersList(nextUsers);
      if (currentUser && Number(currentUser.id) === Number(updatedUser.id)) {
        setModeItem('user', updatedUser);
      }
      window.BOOKS = normalizeAndEnrichBooks([]);
      return createJsonResponse({
        message: `✅ รีเซ็ตสัญลักษณ์ดาวเตือนสะสม (⚠️⭐ = 0) และปลดล็อกสิทธิ์การลงขายหนังสือเรียบร้อยแล้ว!`,
        user: updatedUser
      });
    }

    if (path === '/api/users/clear-queue-ban' && method === 'POST') {
      const targetId = Number(body.user_id || (currentUser && currentUser.id) || 2);
      const users = getActiveUsersList();
      const targetUser = users.find(u => Number(u.id) === targetId) || currentUser || users[1];
      const updatedUser = {
        ...targetUser,
        expired_queue_count: 0,
        queue_banned_until: null
      };
      const nextUsers = users.map(u => Number(u.id) === Number(updatedUser.id) ? updatedUser : u);
      saveActiveUsersList(nextUsers);
      if (currentUser && Number(currentUser.id) === Number(updatedUser.id)) {
        setModeItem('user', updatedUser);
      }
      return createJsonResponse({
        message: '✅ รีเซ็ตประวัติการปล่อยคิวหลุด (0 ครั้ง) และปลดล็อกสิทธิ์การจองคิวเรียบร้อยแล้ว!',
        user: updatedUser
      });
    }

    // แจ้งขอคืนสินค้า (บังคับแนบไฟล์วิดีโอตอนแกะพัสดุแบบไม่ตัดต่อ + รูปถ่ายจุดชำรุด + ตรวจสิทธิ์ IDOR)
    if ((path.startsWith('/api/escrow/dispute-return/') || (path.startsWith('/api/chat/rooms/') && path.endsWith('/dispute'))) && method === 'POST') {
      const orders = getActiveOrdersList();
      const orderIdFromPath = path.startsWith('/api/escrow/dispute-return/') ? path.split('/')[4] : body.order_id;
      const targetOrder = orders.find(o => String(o.id) === String(orderIdFromPath || body.order_id));

      if (path.startsWith('/api/escrow/dispute-return/')) {
        if (!targetOrder || !isAuthorizedForEntity(currentUser, targetOrder)) {
          return createJsonResponse({ error: 'ไม่พบคำสั่งซื้อนี้ (404 Not Found)' }, 404);
        }
      }

      if (path.startsWith('/api/chat/rooms/')) {
        const roomId = path.split('/')[4];
        const roomsMap = getActiveChatRoomsMap();
        const entry = roomsMap[String(roomId)];
        if (!entry || !entry.room || !isAuthorizedForEntity(currentUser, entry.room)) {
          return createJsonResponse({ error: 'ไม่พบห้องสนทนานี้ (404 Not Found)' }, 404);
        }
      }

      const cat = body.dispute_category || 'สภาพหนังสือไม่ตรงปก';
      const reason = body.dispute_reason || cat;
      const img = body.dispute_evidence_image || DEMO_EVIDENCE_SVG;
      const unboxingVideo = String(body.unboxing_video_evidence || '').trim();
      if (!unboxingVideo) {
        return createJsonResponse({
          error: '⚠️ กฎการขอคืนเงินบัญชีกลาง: ต้องแนบไฟล์วิดีโอตอนแกะพัสดุแบบไม่ตัดต่อ และรูปถ่ายจุดชำรุด เพื่อใช้เป็นหลักฐานให้แอดมินตัวกลางตัดสินคืนเงิน'
        }, 400);
      }
      if (targetOrder && isAuthorizedForEntity(currentUser, targetOrder)) {
        targetOrder.status = 'Disputed - Return Requested';
        targetOrder.payout_status = 'Frozen - Dispute Pending Admin';
        targetOrder.escrow_frozen = 1;
        targetOrder.dispute_category = cat;
        targetOrder.dispute_reason = `[${cat}] ${reason}`;
        targetOrder.dispute_evidence_image = img;
        targetOrder.unboxing_video_evidence = unboxingVideo;
        saveActiveOrdersList(orders);
      }
      if (path.startsWith('/api/chat/rooms/')) {
        const roomId = path.split('/')[4];
        const roomsMap = getActiveChatRoomsMap();
        const entry = roomsMap[String(roomId)];
        if (entry) {
          entry.messages.push({
            id: Date.now(),
            sender_role: 'Buyer',
            sender_name: currentUser ? currentUser.username : 'ผู้ซื้อ',
            message: `🔄 [แจ้งปัญหา / ขอคืนสินค้า]: หัวข้อ "${cat}" — ${reason}\n🎥 วิดีโอแกะพัสดุแบบไม่ตัดต่อ: ${unboxingVideo}\n📎 รูปหลักฐาน: ${img}`,
            created_at: new Date().toISOString()
          });
          entry.messages.push({
            id: Date.now() + 1,
            sender_role: 'AI_Bot',
            sender_name: '🤖 ผู้ช่วยอัจฉริยะดูแลการซื้อขายครบวงจร',
            message: `🚨 [ระงับการโอนเงินชั่วคราว & ส่งหลักฐานให้แอดมินด่วน]: ระบบได้รับคำร้อง "${cat}" พร้อมไฟล์วิดีโอตอนแกะพัสดุแบบไม่ตัดต่อ (${unboxingVideo}) และรูปจุดชำรุดแล้ว! บัญชีกลางได้ระงับการโอนเงินให้ผู้ขายชั่วคราว และส่งเรื่องให้แอดมินตรวจสอบเพื่ออนุมัติคืนเงินเต็มจำนวนให้ผู้ซื้อทันทีครับ`,
            created_at: new Date().toISOString()
          });
          saveActiveChatRoomsMap(roomsMap);
        }
      }
      return createJsonResponse({
        message: `🚨 แจ้งขอคืนสินค้า "${cat}" พร้อมแนบวิดีโอแกะพัสดุแบบไม่ตัดต่อสำเร็จ! ระบบระงับการโอนเงินให้ผู้ขายชั่วคราวและส่งให้แอดมินตรวจสอบแล้ว`
      }, 201);
    }

    if (path === '/api/reviews' && method === 'GET') {
      return createJsonResponse({ reviews: getSavedReviews() });
    }

    if (path === '/api/reviews' && method === 'POST') {
      const starRating = Math.min(5, Math.max(1, parseInt(body.rating || 5, 10)));
      const rawComment = String(body.comment || '').trim();
      if (!rawComment) {
        return createJsonResponse({ error: 'กรุณาเขียนคอมเมนต์รีวิวผู้ขายก่อนกดบันทึก' }, 400);
      }
      const sanitizedCommentObj = sanitizeAntiLeakageText(rawComment);
      const newRev = {
        id: Date.now(),
        order_id: body.order_id || null,
        book_id: body.book_id || 1,
        seller_id: body.seller_id || 3,
        buyer_id: currentUser ? currentUser.id : 2,
        buyer_name: currentUser ? currentUser.username : 'ผู้ซื้อจริง',
        rating: starRating,
        comment: sanitizedCommentObj.sanitized,
        created_at: new Date().toISOString()
      };
      const custom = getModeItem('custom_reviews', '[]');
      custom.unshift(newRev);
      setModeItem('custom_reviews', custom);
      window.BOOKS = normalizeAndEnrichBooks([]);
      return createJsonResponse({
        message: `⭐ บันทึกรีวิว ${starRating} ดาวให้ผู้ขายเรียบร้อยแล้ว ขอบคุณสำหรับรีวิวครับ!`,
        review: newRev
      }, 201);
    }

    if (path === '/api/stats/dashboard' && method === 'GET') {
      const allBooks = window.BOOKS || [];
      const orders = getActiveOrdersList();
      const subs = getActiveMerchantSubs();
      const reservations = getActiveReservationsList();
      const reviews = getSavedReviews();

      const totalBooks = allBooks.length;
      const soldOutBooks = allBooks.filter(b => b.stock <= 0 || b.stock_status === 'Sold Out').length;
      const availableBooks = totalBooks - soldOutBooks;
      const totalGMV = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0) + 3420;
      const totalSystemFeeRevenue = orders.reduce((s, o) => s + Number(o.platform_fee || calculateEscrowFee(o.book_price)), 0) + 216;
      const merchantBadgeRevenue = subs.reduce((s, item) => s + Number(item.paid_amount || 0), 0);

      return createJsonResponse({
        totalBooks,
        availableBooks,
        soldOutBooks,
        avgRating: 4.9,
        reviewsCount: Math.max(28, reviews.length + 25),
        totalGMV,
        totalSystemFeeRevenue,
        merchantBadgeRevenue,
        activeMerchantCount: subs.length,
        activeQueuesCount: reservations.filter(r => r.status === 'Active' || r.status === 'Waiting').length,
        awaitingShipmentCount: orders.filter(o => o.status === 'Paid - Awaiting Shipment').length,
        topCategories: [
          { category_name: '🕵️ สืบสวนสอบสวน / ระทึกขวัญ', sold_count: 14, gmv: 2890 },
          { category_name: '📈 จิตวิทยา / พัฒนาตนเอง', sold_count: 12, gmv: 2450 },
          { category_name: '🎌 มังงะ / การ์ตูนญี่ปุ่น', sold_count: 10, gmv: 1980 },
          { category_name: '🌍 นวนิยายแปล', sold_count: 9, gmv: 1760 },
          { category_name: '💰 การเงิน / การลงทุน', sold_count: 7, gmv: 1540 }
        ],
        books: allBooks,
        orders,
        reservations,
        reviews,
        merchantSubscriptions: subs,
        currentUserId: currentUser ? currentUser.id : null
      });
    }

    if (path === '/api/auth/me') {
      if (savedUser) return createJsonResponse({ authenticated: true, user: savedUser });
      return createJsonResponse({ authenticated: false, user: null });
    }

    // ระบบขอและยืนยันรหัส OTP เบอร์โทรศัพท์ก่อนสั่งซื้อ (จำกัด 3 ครั้ง/ชม./เบอร์, หมดอายุ 5 นาที, ผิดเกิน 5 ครั้งล็อกชั่วคราว, โหมด Live ห้ามส่งรหัส OTP ใน API response)
    if (path === '/api/auth/request-otp' && method === 'POST') {
      const rawPhone = String(body.phone_number || (currentUser && currentUser.phone_number) || '').trim();
      const phoneClean = normalizePhoneNumber(rawPhone);
      if (phoneClean.length < 9 || phoneClean.length > 10) {
        return createJsonResponse({ error: 'กรุณากรอกเบอร์โทรศัพท์มือถือ 9–10 หลักให้ถูกต้อง' }, 400);
      }

      const now = Date.now();
      const oneHourMs = 60 * 60 * 1000;
      const fiveMinutesMs = 5 * 60 * 1000;
      const otpRateStore = getModeItem('otp_rate_store', '{}') || {};
      const record = otpRateStore[phoneClean] || { requestTimestamps: [], failedAttempts: 0, lockedUntil: 0, code: null, expiresAt: 0 };

      if (record.lockedUntil && record.lockedUntil > now) {
        const waitMin = Math.ceil((record.lockedUntil - now) / 60000);
        return createJsonResponse({
          error: `🔒 เบอร์โทรศัพท์นี้ถูกระงับการขอและยืนยัน OTP ชั่วคราวเนื่องจากกรอกผิดเกิน 5 ครั้ง (กรุณารอประมาณ ${waitMin} นาที)`
        }, 429);
      }

      record.requestTimestamps = (record.requestTimestamps || []).filter(ts => now - ts < oneHourMs);
      if (record.requestTimestamps.length >= 3) {
        return createJsonResponse({
          error: '⏳ คุณขอรหัส OTP เกินโควตา 3 ครั้ง/ชั่วโมง สำหรับเบอร์โทรศัพท์นี้ กรุณารอสักครู่แล้วลองใหม่อีกครั้ง'
        }, 429);
      }

      const otpCode = String(Math.floor(100000 + Math.random() * 900000));
      record.requestTimestamps.push(now);
      record.code = otpCode;
      record.rawPhone = rawPhone;
      record.expiresAt = now + fiveMinutesMs;
      record.failedAttempts = 0;
      otpRateStore[phoneClean] = record;
      setModeItem('otp_rate_store', otpRateStore);
      setModeItem('pending_otp', { phone_number: rawPhone, phone_clean: phoneClean, otp: otpCode, expires_at: now + fiveMinutesMs, failed_attempts: 0 });

      // โหมดใช้งานจริง (Live Mode): ห้ามส่งรหัส OTP กลับมาใน API response เด็ดขาด
      if (!isDemoMode()) {
        return createJsonResponse({
          message: `📲 ส่งรหัสยืนยันตัวตน (OTP 6 หลัก) ไปยังเบอร์ ${rawPhone} ทาง SMS เรียบร้อยแล้ว (รหัสมีอายุ 5 นาที • เหลือโควตาขอรหัส ${Math.max(0, 3 - record.requestTimestamps.length)}/3 ครั้งในชั่วโมงนี้)`,
          expiresInSec: 300,
          remainingRequests: Math.max(0, 3 - record.requestTimestamps.length)
        });
      }

      return createJsonResponse({
        message: `📲 [โหมด Demo] ส่งรหัสยืนยันตัวตน (OTP 6 หลัก) ไปยังเบอร์ ${rawPhone} เรียบร้อยแล้ว (หมดอายุใน 5 นาที)`,
        demo_otp: otpCode,
        expiresInSec: 300,
        remainingRequests: Math.max(0, 3 - record.requestTimestamps.length)
      });
    }

    if (path === '/api/auth/verify-otp' && method === 'POST') {
      if (!currentUser) {
        return createJsonResponse({ error: 'กรุณาเข้าสู่ระบบก่อนยืนยันเบอร์โทรศัพท์' }, 401);
      }
      const otpInput = String(body.otp_code || '').trim();
      const pending = getModeItem('pending_otp', 'null');
      const rawPhone = String(body.phone_number || (pending && pending.phone_number) || currentUser.phone_number || '').trim();
      const phoneClean = normalizePhoneNumber(rawPhone);
      const now = Date.now();
      const lockDurationMs = 15 * 60 * 1000;

      const otpRateStore = getModeItem('otp_rate_store', '{}') || {};
      const record = otpRateStore[phoneClean] || {
        requestTimestamps: [],
        failedAttempts: (pending && Number(pending.failed_attempts)) || 0,
        lockedUntil: 0,
        code: pending ? pending.otp : null,
        expiresAt: pending ? pending.expires_at : 0
      };

      if (record.lockedUntil && record.lockedUntil > now) {
        const waitMin = Math.ceil((record.lockedUntil - now) / 60000);
        return createJsonResponse({
          error: `🔒 บัญชีและเบอร์โทรศัพท์นี้ถูกล็อกชั่วคราวเนื่องจากกรอก OTP ผิดเกิน 5 ครั้ง กรุณารออีกประมาณ ${waitMin} นาที`
        }, 429);
      }

      if (!record.code || !record.expiresAt) {
        return createJsonResponse({ error: 'กรุณากดขอรหัส OTP 6 หลักก่อนทำการยืนยัน' }, 400);
      }

      if (now > record.expiresAt) {
        return createJsonResponse({ error: '⏰ รหัส OTP หมดอายุแล้ว (เกิน 5 นาที) กรุณากดขอรหัส OTP ใหม่อีกครั้ง' }, 400);
      }

      if (!/^\d{6}$/.test(otpInput) || otpInput !== String(record.code)) {
        record.failedAttempts = Number(record.failedAttempts || 0) + 1;
        if (record.failedAttempts > 5) {
          record.lockedUntil = now + lockDurationMs;
          otpRateStore[phoneClean] = record;
          setModeItem('otp_rate_store', otpRateStore);
          return createJsonResponse({
            error: '🔒 คุณกรอกรหัส OTP ผิดเกิน 5 ครั้ง ระบบได้ล็อกการยืนยันชั่วคราวเป็นเวลา 15 นาทีเพื่อความปลอดภัย'
          }, 429);
        }
        otpRateStore[phoneClean] = record;
        setModeItem('otp_rate_store', otpRateStore);
        return createJsonResponse({
          error: `❌ รหัส OTP ไม่ถูกต้อง (กรอกผิดครั้งที่ ${record.failedAttempts}/5 — หากผิดเกิน 5 ครั้งระบบจะล็อกชั่วคราว)`
        }, 400);
      }

      // ยืนยันสำเร็จ ล้างสถานะ OTP
      record.code = null;
      record.expiresAt = 0;
      record.failedAttempts = 0;
      record.lockedUntil = 0;
      otpRateStore[phoneClean] = record;
      setModeItem('otp_rate_store', otpRateStore);
      removeModeItem('pending_otp');

      const verifiedPhone = rawPhone || currentUser.phone_number || '081-234-5678';
      const updatedUser = {
        ...currentUser,
        phone_number: verifiedPhone,
        phone_verified: true,
        device_id: currentUser.device_id || getOrCreateDeviceId()
      };
      setModeItem('user', updatedUser);
      const nextUsers = activeUsers.map(u => Number(u.id) === Number(updatedUser.id) ? updatedUser : u);
      saveActiveUsersList(nextUsers);
      return createJsonResponse({
        message: `✅ ยืนยันเบอร์โทรศัพท์ (${verifiedPhone}) ด้วยรหัส OTP สำเร็จ! คุณสามารถสั่งซื้อหนังสือได้ทันที`,
        user: updatedUser
      });
    }

    if (path === '/api/auth/login' && method === 'POST') {
      const emailInput = String(body.email || '').trim().toLowerCase();
      const pwdInput = String(body.password || '');

      if (emailInput === 'admin@007marketplace.com') {
        if (isDemoMode()) {
          return createJsonResponse({
            error: '🔒 หน้าจัดการระบบหลังบ้าน (แอดมิน) สงวนสิทธิ์เฉพาะเจ้าของเว็บไซต์ในโหมดใช้งานจริงเท่านั้น'
          }, 403);
        }
        const ownerPwd = localStorage.getItem('007_owner_admin_pwd') || 'admin1234';
        if (pwdInput !== ownerPwd) {
          return createJsonResponse({
            error: '🔒 รหัสผ่านแอดมินไม่ถูกต้อง! พื้นที่นี้สงวนสิทธิ์เฉพาะเจ้าของเว็บไซต์เท่านั้น'
          }, 401);
        }
        const adminUser = activeUsers.find(u => u.role === 'Admin') || DEMO_USERS[0];
        setModeItem('user', adminUser);
        setModeItem('jwt_token', 'live-admin-owner-jwt-token');
        return createJsonResponse({
          message: '🛡️ ยืนยันตัวตนเจ้าของเว็บไซต์สำเร็จ',
          token: 'live-admin-owner-jwt-token',
          csrfToken: getOrCreateCsrfToken(),
          user: adminUser
        });
      }

      const normalizedEmail = emailInput.replace('@email.com', '@member.com');
      const found = activeUsers.find(u => {
        const uMail = String(u.email || '').toLowerCase();
        return uMail === emailInput || uMail === normalizedEmail;
      });

      if (!found) {
        return createJsonResponse({
          error: 'ไม่พบบัญชีอีเมลนี้ในระบบ กรุณาตรวจสอบอีเมล หรือกด "สมัครสมาชิกใหม่" เพื่อเริ่มต้นใช้งานจริง'
        }, 401);
      }

      if (found.password && found.password !== pwdInput) {
        return createJsonResponse({ error: 'รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' }, 401);
      }
      if (!found.password && !isDemoMode() && pwdInput !== 'member1234') {
        return createJsonResponse({ error: 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านของคุณ' }, 401);
      }

      // แยกโหมด Demo ออกจาก API จริงเด็ดขาด: ในโหมด Demo ทำงานบน sessionStorage 100% โดยไม่สร้าง JWT Token จริง
      if (isDemoMode()) {
        const demoUser = window.DataService.switchDemoAccount(found.email);
        return createJsonResponse({
          message: `เข้าสู่ระบบโหมดทดลองเล่น (Demo): ยินดีต้อนรับ ${demoUser.username}`,
          token: null,
          csrfToken: getOrCreateCsrfToken(),
          user: demoUser
        });
      }

      const tokenStr = 'live-jwt-' + Date.now();
      setModeItem('user', found);
      setModeItem('jwt_token', tokenStr);
      return createJsonResponse({
        message: `เข้าสู่ระบบสำเร็จ: ยินดีต้อนรับ ${found.username}`,
        token: tokenStr,
        csrfToken: getOrCreateCsrfToken(),
        user: found
      });
    }

    if (path === '/api/auth/register' && method === 'POST') {
      const emailClean = String(body.email || '').trim().toLowerCase();
      if (!emailClean || !body.username) {
        return createJsonResponse({ error: 'กรุณากรอกชื่อผู้ใช้งานและอีเมลให้ครบถ้วน' }, 400);
      }
      if (emailClean === 'admin@007marketplace.com') {
        return createJsonResponse({ error: 'อีเมลนี้สงวนสิทธิ์สำหรับผู้ดูแลระบบเท่านั้น' }, 400);
      }
      const existing = activeUsers.find(u => String(u.email || '').toLowerCase() === emailClean);
      if (existing) {
        return createJsonResponse({ error: 'อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบหรือใช้อีเมลอื่น' }, 400);
      }

      const newUser = {
        id: Date.now(),
        username: body.username.trim(),
        email: emailClean,
        password: String(body.password || ''),
        phone_number: body.phone_number || '080-000-0000',
        phone_verified: Boolean(body.phone_verified),
        device_id: getOrCreateDeviceId(),
        role: 'Member',
        bank_name: body.bank_name || '',
        bank_account_no: body.bank_account_no || '',
        bank_account_name: body.bank_account_name || body.username.trim(),
        strike_count: 0,
        strike_mode: 'cumulative',
        seller_banned_until: null,
        is_selling_banned: false,
        selling_status_label: 'ปกติ (ลงขายและซื้อได้ตามปกติ)',
        expired_queue_count: 0,
        queue_banned_until: null,
        merchant_tier: 'none',
        merchant_badge_label: '',
        boost_level: 0
      };

      activeUsers.push(newUser);
      saveActiveUsersList(activeUsers);
      if (isDemoMode()) {
        setModeItem('user', newUser);
        removeModeItem('jwt_token');
        return createJsonResponse({
          message: `🎉 สมัครสมาชิกโหมดทดลองสำเร็จ! ยินดีต้อนรับคุณ ${newUser.username}`,
          token: null,
          csrfToken: getOrCreateCsrfToken(),
          user: newUser
        }, 201);
      }

      const tokenStr = 'live-jwt-' + Date.now();
      setModeItem('user', newUser);
      setModeItem('jwt_token', tokenStr);
      return createJsonResponse({
        message: `🎉 สมัครสมาชิกสำเร็จ! ยินดีต้อนรับคุณ ${newUser.username} เข้าสู่ระบบซื้อ-ขายจริง`,
        token: tokenStr,
        csrfToken: getOrCreateCsrfToken(),
        user: newUser
      }, 201);
    }

    if (path === '/api/profile' && method === 'PUT') {
      if (!currentUser) return createJsonResponse({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
      const updatedUser = {
        ...currentUser,
        username: body.username || currentUser.username,
        email: body.email || currentUser.email,
        phone_number: body.phone_number || currentUser.phone_number,
        bank_name: body.bank_name !== undefined ? body.bank_name : currentUser.bank_name,
        bank_account_no: body.bank_account_no !== undefined ? body.bank_account_no : currentUser.bank_account_no,
        bank_account_name: body.bank_account_name !== undefined ? body.bank_account_name : currentUser.bank_account_name
      };
      setModeItem('user', updatedUser);
      const nextUsers = activeUsers.map(u => Number(u.id) === Number(updatedUser.id) ? updatedUser : u);
      saveActiveUsersList(nextUsers);
      return createJsonResponse({ message: '💾 บันทึกข้อมูลส่วนตัวและบัญชีธนาคารเรียบร้อยแล้ว!', user: updatedUser });
    }

    if (path === '/api/auth/logout') {
      removeModeItem('user');
      removeModeItem('jwt_token');
      return createJsonResponse({ message: 'ออกจากระบบสำเร็จ' });
    }

    if ((path === '/api/chat/open-room' || path === '/api/chat/open') && method === 'POST') {
      if (!currentUser) {
        return createJsonResponse({ error: 'ไม่พบห้องสนทนานี้ (404 Not Found)' }, 404);
      }
      const roomsMap = getActiveChatRoomsMap();
      const foundKey = Object.keys(roomsMap).find(k => {
        const rm = roomsMap[k]?.room;
        return rm && String(rm.book_id) === String(body.book_id) && isAuthorizedForEntity(currentUser, rm);
      });
      if (foundKey) {
        const roomId = Number(foundKey);
        return createJsonResponse({ chatRoomId: roomId, room: roomsMap[foundKey].room });
      }
      // หากเป็นผู้ซื้อหรือผู้ขายหรือ Admin ที่กดเปิดห้องแชทของหนังสือเล่มนั้น ให้สร้างหรือคืนห้องที่มีสิทธิ์เท่านั้น
      const anyKeyForBook = Object.keys(roomsMap).find(k => String(roomsMap[k]?.room?.book_id) === String(body.book_id));
      if (anyKeyForBook && !isAuthorizedForEntity(currentUser, roomsMap[anyKeyForBook].room)) {
        return createJsonResponse({ error: 'ไม่พบห้องสนทนานี้ (404 Not Found)' }, 404);
      }
      const fallbackRoom = roomsMap['1']?.room;
      if (!fallbackRoom || !isAuthorizedForEntity(currentUser, fallbackRoom)) {
        return createJsonResponse({ error: 'ไม่พบห้องสนทนานี้ (404 Not Found)' }, 404);
      }
      return createJsonResponse({ chatRoomId: 1, room: { id: 1 } });
    }

    // ระบบรายงานการชวนซื้อขายนอกระบบในห้องแชท (ตรวจสิทธิ์ IDOR)
    if (path.startsWith('/api/chat/rooms/') && path.endsWith('/report-leakage') && method === 'POST') {
      const roomId = path.split('/')[4];
      const roomsMap = getActiveChatRoomsMap();
      const entry = roomsMap[String(roomId)];
      if (!entry || !entry.room || !isAuthorizedForEntity(currentUser, entry.room)) {
        return createJsonResponse({ error: 'ไม่พบห้องสนทนานี้ (404 Not Found)' }, 404);
      }
      const reasonText = String(body.reason || 'คู่สนทนาพยายามชวนโอนเงินตรงนอกระบบ / ส่งช่องทางติดต่อส่วนตัว').trim();
      const reports = getActiveLeakageReports();
      const newReport = {
        id: Date.now(),
        room_id: roomId,
        book_title: entry?.room?.book_title || 'รายการหนังสือในห้องแชท',
        reporter_name: currentUser ? currentUser.username : 'สมาชิกผู้ใช้งาน',
        accused_seller_name: entry?.room?.seller_name || 'คู่สนทนา',
        reason: reasonText,
        created_at: new Date().toISOString()
      };
      reports.unshift(newReport);
      saveActiveLeakageReports(reports);

      entry.messages.push({
        id: Date.now(),
        sender_role: 'AI_Bot',
        sender_name: '🛡️ ระบบรักษาความปลอดภัยบัญชีกลาง',
        message: `🚩 [บันทึกการรายงานการชวนซื้อขายนอกระบบ]: ระบบได้รับแจ้งรายงาน "${reasonText}" และส่งข้อมูลให้แอดมินตรวจสอบทันที!\n⚠️ คำเตือนสำคัญ: ${ANTI_LEAKAGE_WARNING_TEXT}`,
        created_at: new Date().toISOString()
      });
      saveActiveChatRoomsMap(roomsMap);
      return createJsonResponse({
        message: '🚩 ส่งรายงานการชวนซื้อขายนอกระบบให้แอดมินส่วนกลางตรวจสอบเรียบร้อยแล้ว ขอบคุณที่ช่วยดูแลความปลอดภัยครับ!'
      }, 201);
    }

    if (path.startsWith('/api/chat/rooms/') && path.endsWith('/messages') && method === 'POST') {
      const roomId = path.split('/')[4];
      const roomsMap = getActiveChatRoomsMap();
      const entry = roomsMap[String(roomId)];
      if (!entry || !entry.room || !isAuthorizedForEntity(currentUser, entry.room)) {
        return createJsonResponse({ error: 'ไม่พบห้องสนทนานี้ (404 Not Found)' }, 404);
      }
      let hasLeakageDetected = false;
      if (body.message) {
        const senderRole = currentUser && currentUser.role === 'Admin'
          ? 'Admin'
          : (currentUser && Number(currentUser.id) === Number(entry.room.seller_id) ? 'Seller' : 'Buyer');
        const filterResult = sanitizeAntiLeakageText(String(body.message).trim());
        hasLeakageDetected = filterResult.hasLeakage;

        entry.messages.push({
          id: Date.now(),
          sender_role: senderRole,
          sender_name: currentUser ? currentUser.username : 'ผู้ใช้งาน',
          message: filterResult.sanitized,
          has_leakage_censored: hasLeakageDetected,
          created_at: new Date().toISOString()
        });

        if (hasLeakageDetected) {
          entry.messages.push({
            id: Date.now() + 1,
            sender_role: 'AI_Bot',
            sender_name: '🛡️ ระบบป้องกันการดึงลูกค้านอกระบบ (Anti-Leakage)',
            message: `⚠️ [ระบบตรวจพบข้อมูลติดต่อนอกระบบ]: ระบบได้ซ่อนเบอร์โทรศัพท์ / ไอดีไลน์ / ลิงก์ภายนอกเป็น "${ANTI_LEAKAGE_MASK}" อัตโนมัติ\n🚨 คำเตือนสำคัญ: "${ANTI_LEAKAGE_WARNING_TEXT}" กรุณาชำระเงินผ่านบัญชีกลางเท่านั้น หากพบการชวนโอนตรงสามารถกดปุ่ม [🚩 รายงานการชวนซื้อขายนอกระบบ] ด้านบนห้องแชทได้ทันที`,
            created_at: new Date().toISOString()
          });
        } else {
          const roomFee = calculateEscrowFee(entry.room.book_price);
          entry.messages.push({
            id: Date.now() + 1,
            sender_role: 'AI_Bot',
            sender_name: '🤖 ผู้ช่วยอัจฉริยะดูแลการซื้อขายครบวงจร',
            message: `🤖 [ผู้ช่วยดูแลการซื้อขายตอบกลับอัตโนมัติ]: บันทึกข้อความในห้องแชทเรียบร้อยแล้วครับ ยอดโอนสุทธิผ่านบัญชีกลางสำหรับ "${entry.room.book_title}" คือ ฿${Number(entry.room.book_price) + Number(entry.room.shipping_fee) + roomFee} (รวมค่าธรรมเนียมระบบ ${roomFee}฿ ตามสูตร 5฿ + 5% สูงสุดไม่เกิน 30฿/เล่ม) — ${ANTI_LEAKAGE_WARNING_TEXT}`,
            created_at: new Date().toISOString()
          });
        }
        saveActiveChatRoomsMap(roomsMap);
      }
      return createJsonResponse({
        message: hasLeakageDetected
          ? `⚠️ ระบบซ่อนข้อมูลติดต่ออัตโนมัติ: ${ANTI_LEAKAGE_WARNING_TEXT}`
          : 'ส่งข้อความสำเร็จ',
        hasLeakage: hasLeakageDetected,
        warningMessage: hasLeakageDetected ? ANTI_LEAKAGE_WARNING_TEXT : '',
        botReplied: true
      }, 201);
    }

    if (path.startsWith('/api/chat/rooms/')) {
      const roomId = path.split('/')[4];
      const roomsMap = getActiveChatRoomsMap();
      const entry = roomsMap[String(roomId)];
      if (!entry || !entry.room || !isAuthorizedForEntity(currentUser, entry.room)) {
        return createJsonResponse({ error: 'ไม่พบห้องสนทนานี้ (404 Not Found)' }, 404);
      }
      const orders = getActiveOrdersList();
      const linkedOrder = orders.find(o => Number(o.book_id) === Number(entry.room.book_id) && isAuthorizedForEntity(currentUser, o)) || null;
      return createJsonResponse({
        room: entry.room,
        reservation: entry.reservation,
        order: linkedOrder,
        messages: entry.messages
      });
    }

    if (path === '/api/reservations/my') {
      if (!currentUser) {
        return createJsonResponse({ reservations: [] });
      }
      const reservations = getActiveReservationsList();
      const myRes = reservations.filter(r => isAuthorizedForEntity(currentUser, r));
      return createJsonResponse({ reservations: myRes });
    }

    if (path === '/api/my-listings') {
      const orders = getActiveOrdersList();
      const myBooks = currentUser
        ? window.BOOKS.filter(b => currentUser.role === 'Admin' || Number(b.seller_id) === Number(currentUser.id) || b.seller_name === currentUser.username)
        : [];
      const listToShow = myBooks.length > 0 ? myBooks : (isDemoMode() ? window.BOOKS.slice(0, 6) : []);
      const sellOrdersOnly = currentUser
        ? orders.filter(o => currentUser.role === 'Admin' || Number(o.seller_id) === Number(currentUser.id))
        : [];
      return createJsonResponse({
        books: listToShow.map(b => ({ ...b, price: b.salePrice, queues: b.queues || [] })),
        salesOrders: sellOrdersOnly
      });
    }

    if (path === '/api/orders/my') {
      if (!currentUser) {
        return createJsonResponse({ buyOrders: [], sellOrders: [] });
      }
      const orders = getActiveOrdersList();
      const uid = Number(currentUser.id);
      const isAdmin = currentUser.role === 'Admin';
      const buyOrders = orders.filter(o => isAdmin || Number(o.buyer_id) === uid);
      const sellOrders = orders.filter(o => isAdmin || Number(o.seller_id) === uid);
      return createJsonResponse({
        buyOrders,
        sellOrders
      });
    }

    // ป้องกันการแก้ยอดเงินฝั่ง Client: คำนวณราคาหนังสือ ค่าจัดส่ง และค่าธรรมเนียมระบบ (5฿ + 5% เพดาน 30฿) ใหม่ฝั่งเซิร์ฟเวอร์เสมอ
    if ((path === '/api/orders' || path === '/api/escrow/step1-pay') && method === 'POST') {
      if (!currentUser) {
        return createJsonResponse({ error: 'กรุณาเข้าสู่ระบบก่อนทำรายการชำระเงิน' }, 401);
      }
      if (currentUser.phone_verified === false) {
        return createJsonResponse({ error: '📲 กรุณายืนยันเบอร์โทรศัพท์ด้วยรหัส OTP ก่อนสั่งซื้อ', code: 'PHONE_OTP_REQUIRED', phone_number: currentUser.phone_number || '' }, 403);
      }
      const orders = getActiveOrdersList();
      const matchedRes = null;
      const targetBookId = body.book_id;
      const serverBook = window.BOOKS.find(b => String(b.book_id) === String(targetBookId) || String(b.id) === String(targetBookId));
      if (!serverBook) {
        return createJsonResponse({ error: 'ไม่พบหนังสือเล่มนี้' }, 404);
      }
      if (Number(serverBook.stock) <= 0 || serverBook.stock_status === 'Sold Out') {
        return createJsonResponse({ error: 'ขออภัย หนังสือเล่มนี้ขายหมดแล้ว', code: 'SOLD_OUT' }, 409);
      }
      const selfPhone = normalizePhoneNumber(currentUser.phone_number);
      const sellerPhone = normalizePhoneNumber(serverBook.seller_phone);
      if (Number(currentUser.id) === Number(serverBook.seller_id) || (selfPhone && sellerPhone && selfPhone === sellerPhone)) {
        return createJsonResponse({ error: '🚫 ผู้ขายไม่สามารถซื้อหนังสือของตัวเองได้', code: 'SELF_BUY_BLOCKED' }, 403);
      }

      // คำนวณราคาและค่าธรรมเนียมจากข้อมูลฝั่งเซิร์ฟเวอร์เท่านั้น (ไม่เชื่อค่า book_price / platform_fee / total_amount จาก client)
      const bookPrice = Math.max(0, Number(serverBook ? (serverBook.salePrice ?? serverBook.price) : (matchedRes ? matchedRes.book_price : 150)));
      const shippingFee = Math.max(0, Number(serverBook ? serverBook.shipping_fee : (matchedRes ? matchedRes.shipping_fee : 40)));
      const platformFee = calculateEscrowFee(bookPrice);
      const totalAmount = bookPrice + shippingFee + platformFee;
      const sellerPayout = bookPrice + shippingFee;

      const newOrder = {
        id: Date.now(),
        order_code: `ESC-007${Math.floor(300 + Math.random() * 699)}`,
        book_id: Number(serverBook ? (serverBook.book_id || 1) : (targetBookId || 1)),
        book_title: serverBook ? serverBook.title : (matchedRes ? matchedRes.book_title : 'หนังสือมือสองคัดสภาพ'),
        buyer_id: Number(currentUser.id),
        buyer_name: currentUser.username,
        buyer_email: currentUser.email || '',
        seller_id: Number(serverBook ? serverBook.seller_id : (matchedRes ? matchedRes.seller_id : 3)),
        seller_name: serverBook ? serverBook.seller_name : (matchedRes ? matchedRes.seller_name : 'คุณพิมพ์ชนก (สมาชิกร้านค้า #2)'),
        book_price: bookPrice,
        shipping_fee: shippingFee,
        platform_fee: platformFee,
        total_amount: totalAmount,
        seller_payout: sellerPayout,
        recipient_name: String(body.recipient_name || currentUser.username || 'ผู้รับ').trim(),
        recipient_phone: String(body.recipient_phone || currentUser.phone_number || '081-234-5678').trim(),
        shipping_address: String(body.shipping_address || 'กรุงเทพฯ').trim(),
        slip_reference: String(body.slip_reference || `SLIP-${Date.now()}`).trim(),
        tracking_no: '',
        shipping_carrier: '',
        pre_pack_photo: '',
        shipping_receipt_photo: '',
        tracking_verified: false,
        tracking_status_text: 'รอผู้ขายจัดส่งภายใน 48 ชม.',
        extension_requested: false,
        extension_status: 'none',
        extension_reason: '',
        status: 'Paid - Awaiting Shipment',
        payout_status: 'Holding in Escrow',
        shipping_deadline: new Date(Date.now() + 48 * 3600 * 1000).toISOString()
      };
      orders.unshift(newOrder);
      saveActiveOrdersList(orders);

      // ตัดสต็อกทันทีเมื่อชำระเงิน
      const newStock = Math.max(0, Number(serverBook.stock) - 1);
      const bookStates = getSavedBookStates();
      bookStates[String(serverBook.id)] = {
        stock: newStock,
        stock_status: newStock <= 0 ? 'Sold Out' : 'Available',
        activeQueueCount: 0,
        queues: []
      };
      setModeItem('book_states', bookStates);
      window.BOOKS = normalizeAndEnrichBooks([]);

      // สร้างห้องแชทผู้ซื้อ-ผู้ขายของคำสั่งซื้อนี้
      const roomsMap = getActiveChatRoomsMap();
      const newRoomId = Number(String(Date.now()).slice(-6));
      roomsMap[String(newRoomId)] = {
        room: {
          id: newRoomId,
          room_code: `CHAT-${serverBook.code}-${newOrder.order_code}`,
          book_id: newOrder.book_id,
          book_code: serverBook.code,
          book_title: serverBook.title,
          book_price: bookPrice,
          price: bookPrice,
          shipping_fee: shippingFee,
          condition_percent: Number(serverBook.conditionPercent || 90),
          condition_grade: serverBook.conditionGrade || 'สภาพดีมาก',
          defect_details: serverBook.defectNote || '-',
          packing_note: serverBook.packing_note || '-',
          stock_status: newStock <= 0 ? 'Sold Out' : 'Available',
          buyer_id: currentUser.id,
          buyer_name: currentUser.username,
          seller_id: newOrder.seller_id,
          seller_name: newOrder.seller_name
        },
        reservation: null,
        messages: [{
          id: Date.now(),
          sender_role: 'AI_Bot',
          sender_name: '🤖 ผู้ช่วยอัจฉริยะดูแลการซื้อขายครบวงจร',
          message: `🤖 ยินดีต้อนรับคุณ ${currentUser.username} สั่งซื้อ "${serverBook.title}" สำเร็จ (#${newOrder.order_code})\n💳 ยอดโอนเข้าบัญชีกลาง ฿${totalAmount} (หนังสือ ฿${bookPrice} + ค่าส่ง ฿${shippingFee} + ค่าธรรมเนียม ฿${platformFee})\n📦 ผู้ขายต้องจัดส่งภายใน 48 ชม.\n🛡️ ${ANTI_LEAKAGE_WARNING_TEXT}`,
          created_at: new Date().toISOString()
        }]
      };
      saveActiveChatRoomsMap(roomsMap);
      return createJsonResponse({
        chatRoom: { id: newRoomId },
        message: `💳 แจ้งโอนเงินเข้าบัญชีกลางสำเร็จ (#${newOrder.order_code}) ยอดสุทธิ ฿${totalAmount} (รวมค่าธรรมเนียมระบบ ${platformFee}฿)! กรุณาถ่ายคลิปวิดีโอตอนแกะพัสดุแบบไม่ตัดต่อเมื่อได้รับของเพื่อใช้เป็นหลักฐานคุ้มครองเงินคืน 100%`,
        order: newOrder
      }, 201);
    }

    // ขั้นตอนผู้ขายแจ้งเลขพัสดุ: ตรวจสิทธิ์ IDOR + บังคับแนบรูปถ่ายสภาพหนังสือก่อนแพ็ก + รูปใบเสร็จขนส่ง
    if (path.startsWith('/api/escrow/step3-seller-ship/') && method === 'PUT') {
      const orderId = path.split('/')[4];
      const orders = getActiveOrdersList();
      const targetOrder = orders.find(o => String(o.id) === String(orderId));
      if (!targetOrder || !isAuthorizedForEntity(currentUser, targetOrder) || (currentUser.role !== 'Admin' && Number(currentUser.id) !== Number(targetOrder.seller_id))) {
        return createJsonResponse({ error: 'ไม่พบคำสั่งซื้อนี้ (404 Not Found)' }, 404);
      }
      const trackingNo = String(body.tracking_no || '').trim();
      const carrier = String(body.shipping_carrier || 'ไปรษณีย์ไทย (EMS)').trim();
      const prePackPhoto = body.pre_pack_photo || DEMO_PREPACK_SVG;
      const receiptPhoto = body.shipping_receipt_photo || DEMO_RECEIPT_SVG;

      if (!trackingNo) {
        return createJsonResponse({ error: 'กรุณากรอกเลขพัสดุ (Tracking No.) ให้ครบถ้วน' }, 400);
      }
      if (!body.pre_pack_photo || !body.shipping_receipt_photo) {
        return createJsonResponse({
          error: '⚠️ กฎป้องกันการส่งของปลอม: ผู้ขายต้องแนบ "รูปถ่ายสภาพหนังสือก่อนแพ็ก" และ "รูปใบเสร็จขนส่ง" ให้ครบทั้ง 2 รูปก่อนยืนยันการจัดส่ง'
        }, 400);
      }

      targetOrder.tracking_no = trackingNo;
      targetOrder.shipping_carrier = carrier;
      targetOrder.pre_pack_photo = prePackPhoto;
      targetOrder.shipping_receipt_photo = receiptPhoto;
      targetOrder.tracking_verified = true;
      targetOrder.tracking_status_text = `✅ ระบบตรวจสอบสถานะขนส่งอัตโนมัติ (${carrier}): ยืนยันหมายเลขพัสดุ ${trackingNo} รับเข้าระบบขนส่งต้นทางเรียบร้อยแล้ว`;
      targetOrder.status = 'Shipped';
      targetOrder.inspection_expires_at = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      saveActiveOrdersList(orders);
      return createJsonResponse({
        message: `🚚 บันทึกเลขพัสดุ "${trackingNo}" (${carrier}) พร้อมรูปหนังสือก่อนแพ็กและใบเสร็จขนส่งสำเร็จ! ระบบตรวจสอบสถานะขนส่งอัตโนมัติเรียบร้อยแล้ว`,
        order: targetOrder
      });
    }

    // ระบบขอขยายเวลาส่งของได้ 1 ครั้ง (+24 ชม.) กรณีเหตุสุดวิสัย โดยผู้ซื้อต้องกดอนุมัติ (ตรวจสิทธิ์ IDOR)
    if (path.startsWith('/api/escrow/request-shipping-extension/') && method === 'POST') {
      const orderId = path.split('/')[4];
      const orders = getActiveOrdersList();
      const targetOrder = orders.find(o => String(o.id) === String(orderId));
      if (!targetOrder || !isAuthorizedForEntity(currentUser, targetOrder) || (currentUser.role !== 'Admin' && Number(currentUser.id) !== Number(targetOrder.seller_id))) {
        return createJsonResponse({ error: 'ไม่พบคำสั่งซื้อนี้ (404 Not Found)' }, 404);
      }
      if (targetOrder.extension_requested) {
        return createJsonResponse({ error: '⚠️ คำสั่งซื้อนี้ใช้สิทธิ์ขอขยายเวลาจัดส่ง 1 ครั้งไปแล้ว ไม่สามารถขอซ้ำได้' }, 400);
      }
      const reason = String(body.reason || 'เหตุสุดวิสัยขนส่งปิดทำการ / ฝนตกหนัก ขอขยายเวลาจัดส่งเพิ่ม 24 ชม.').trim();
      targetOrder.extension_requested = true;
      targetOrder.extension_status = 'pending_buyer_approval';
      targetOrder.extension_reason = reason;
      saveActiveOrdersList(orders);
      return createJsonResponse({
        message: `⏳ ส่งคำขอขยายเวลาจัดส่ง (+24 ชม. สิทธิ์ 1 ครั้ง) ให้ผู้ซื้ออนุมัติเรียบร้อยแล้ว (เหตุผล: ${reason})`,
        order: targetOrder
      });
    }

    if (path.startsWith('/api/escrow/respond-shipping-extension/') && method === 'POST') {
      const orderId = path.split('/')[4];
      const approve = Boolean(body.approve);
      const orders = getActiveOrdersList();
      const targetOrder = orders.find(o => String(o.id) === String(orderId));
      if (!targetOrder || !isAuthorizedForEntity(currentUser, targetOrder) || (currentUser.role !== 'Admin' && Number(currentUser.id) !== Number(targetOrder.buyer_id))) {
        return createJsonResponse({ error: 'ไม่พบคำสั่งซื้อนี้ (404 Not Found)' }, 404);
      }
      if (approve) {
        const currentDeadline = targetOrder.shipping_deadline ? new Date(targetOrder.shipping_deadline).getTime() : Date.now();
        targetOrder.shipping_deadline = new Date(Math.max(Date.now(), currentDeadline) + 24 * 3600 * 1000).toISOString();
        targetOrder.extension_status = 'approved';
        saveActiveOrdersList(orders);
        return createJsonResponse({
          message: '✅ ผู้ซื้ออนุมัติขยายเวลาจัดส่งให้ผู้ขายเพิ่มอีก +24 ชั่วโมงเรียบร้อยแล้ว!',
          order: targetOrder
        });
      } else {
        targetOrder.extension_status = 'rejected';
        saveActiveOrdersList(orders);
        return createJsonResponse({
          message: '❌ ผู้ซื้อไม่อนุมัติการขยายเวลาจัดส่ง ผู้ขายต้องจัดส่งตามกำหนดเวลาเดิม',
          order: targetOrder
        });
      }
    }

    if ((path.startsWith('/api/escrow/step4-buyer-confirm/') || path.startsWith('/api/escrow/step4-complete-release/')) && method === 'PUT') {
      const orderId = path.split('/')[4];
      const orders = getActiveOrdersList();
      const targetOrder = orders.find(o => String(o.id) === String(orderId));
      if (!targetOrder || !isAuthorizedForEntity(currentUser, targetOrder) || (currentUser.role !== 'Admin' && Number(currentUser.id) !== Number(targetOrder.buyer_id))) {
        return createJsonResponse({ error: 'ไม่พบคำสั่งซื้อนี้ (404 Not Found)' }, 404);
      }
      targetOrder.status = 'Completed & Released';
      targetOrder.payout_status = 'Released to Seller';
      saveActiveOrdersList(orders);
      return createJsonResponse({
        message: '🎉 ยืนยันรับหนังสือเรียบร้อย! บัญชีกลางได้ปลดล็อกโอนเงินค่าหนังสือให้ผู้ขายแล้ว',
        order: targetOrder
      });
    }

    if (path.startsWith('/api/escrow/admin-approve-refund/') && method === 'PUT') {
      if (!currentUser || currentUser.role !== 'Admin') {
        return createJsonResponse({ error: 'ไม่พบคำสั่งซื้อนี้ (404 Not Found)' }, 404);
      }
      const orderId = path.split('/')[4];
      const orders = getActiveOrdersList();
      const targetOrder = orders.find(o => String(o.id) === String(orderId));
      if (!targetOrder) {
        return createJsonResponse({ error: 'ไม่พบคำสั่งซื้อนี้ (404 Not Found)' }, 404);
      }
      targetOrder.status = 'Refunded to Buyer';
      targetOrder.payout_status = 'Refunded 100% by Admin';
      targetOrder.escrow_frozen = 0;
      saveActiveOrdersList(orders);
      return createJsonResponse({
        message: '💸 แอดมินตรวจสอบคลิปแกะพัสดุและอนุมัติคืนเงินเต็มจำนวน 100% ให้ผู้ซื้อเรียบร้อยแล้ว!',
        order: targetOrder
      });
    }

    if (path.startsWith('/api/escrow/admin-cancel-overdue/') && method === 'PUT') {
      const orderId = path.split('/')[4];
      const orders = getActiveOrdersList();
      const targetOrder = orders.find(o => String(o.id) === String(orderId));
      if (!targetOrder || !isAuthorizedForEntity(currentUser, targetOrder)) {
        return createJsonResponse({ error: 'ไม่พบคำสั่งซื้อนี้ (404 Not Found)' }, 404);
      }
      targetOrder.status = 'Cancelled - Overdue 48h';
      targetOrder.payout_status = 'Refunded 100% by Admin';
      saveActiveOrdersList(orders);
      return createJsonResponse({
        message: '⏰ ยกเลิกรายการที่ผู้ขายส่งของล่าช้าเกิน 48 ชม. คืนเงินให้ผู้ซื้อ 100% และบันทึกดาวเตือนสะสม ⚠️⭐ ให้ผู้ขาย 1 ดวงเรียบร้อยแล้ว!'
      });
    }

    if ((path.startsWith('/api/escrow/simulate-overdue/') || path.startsWith('/api/escrow/simulate-shipping-overdue/')) && (method === 'PUT' || method === 'POST')) {
      const orderId = path.split('/')[4];
      const orders = getActiveOrdersList();
      const targetOrder = orders.find(o => String(o.id) === String(orderId));
      if (!targetOrder || !isAuthorizedForEntity(currentUser, targetOrder)) {
        return createJsonResponse({ error: 'ไม่พบคำสั่งซื้อนี้ (404 Not Found)' }, 404);
      }
      targetOrder.shipping_deadline = new Date(Date.now() - 3600 * 1000).toISOString();
      saveActiveOrdersList(orders);
      return createJsonResponse({
        message: '⏰ จำลองสถานะผู้ขายส่งของล่าช้าเกิน 48 ชั่วโมงเรียบร้อยแล้ว!'
      });
    }

    if (path === '/api/admin/overview') {
      if (!currentUser || currentUser.role !== 'Admin') {
        return createJsonResponse({ error: '🔒 เฉพาะเจ้าของเว็บไซต์ (แอดมิน) เท่านั้นที่สามารถเข้าถึงข้อมูลนี้ได้' }, 403);
      }
      const orders = getActiveOrdersList();
      const subs = getActiveMerchantSubs();
      const reservations = getActiveReservationsList();
      const roomsMap = getActiveChatRoomsMap();
      const leakageReports = getActiveLeakageReports();
      const merchantBadgeRevenue = subs.reduce((s, item) => s + Number(item.paid_amount || 0), 0);
      return createJsonResponse({
        totalEscrowRevenue: orders
          .filter(o => o.status === 'Completed & Released')
          .reduce((s, o) => s + Number(o.platform_fee || calculateEscrowFee(o.book_price)), 0) + 39,
        merchantBadgeRevenue,
        merchantSubscriptions: subs,
        orders,
        chatRooms: Object.values(roomsMap).map(item => item.room),
        reservations,
        books: window.BOOKS,
        users: activeUsers,
        reviews: getSavedReviews(),
        leakageReports
      });
    }

    if (path === '/api/admin/reset-seed' && method === 'POST') {
      removeModeItem('users_list');
      removeModeItem('orders_list');
      removeModeItem('reservations_list');
      removeModeItem('chat_rooms_map');
      removeModeItem('merchant_subs');
      removeModeItem('custom_books');
      removeModeItem('book_states');
      removeModeItem('leakage_reports');
      window.BOOKS = normalizeAndEnrichBooks([]);
      return createJsonResponse({ message: '🌱 รีเซ็ตข้อมูลกลับสู่ค่าเริ่มต้นเรียบร้อยแล้ว!' });
    }

    return createJsonResponse({ message: 'ดำเนินการสำเร็จ' });
  }

  window.fetch = async function (input, init) {
    const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    const isApiCall = urlStr.includes('/api/');

    if (isApiCall) {
      const nextInit = { ...(init || {}) };
      const nextHeaders = { ...(nextInit.headers || {}) };
      delete nextHeaders['x-csrf-token'];
      nextHeaders['X-CSRF-Token'] = getOrCreateCsrfToken();
      nextHeaders['X-App-Mode'] = isDemoMode() ? 'demo' : 'live';
      nextInit.headers = nextHeaders;
      nextInit.credentials = nextInit.credentials || 'same-origin';
      return await handleStaticApiRequest(urlStr, nextInit);
    }

    return await originalFetch(input, init);
  };
})();

window.fetchBooksFromAPI = async function () {
  try {
    const res = await fetch('/api/books');
    if (!res.ok) return window.BOOKS;
    const data = await res.json();
    if (Array.isArray(data.books)) {
      window.BOOKS = normalizeAndEnrichBooks(data.books);
      window.dispatchEvent(new CustomEvent('booksLoaded', { detail: { books: window.BOOKS } }));
    }
    return window.BOOKS;
  } catch (e) {
    return window.BOOKS;
  }
};

window.fetchBooksFromAPI();
