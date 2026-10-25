// ข้อมูลหมวดหมู่ทั้ง 20 หมวดหมู่ (รวม "✨ ทั้งหมด") และข้อมูลหนังสือตัวอย่างครบทุกหมวดหมู่
// โทนสีพาสเทลสว่างละมุน: ฟ้ามิ้นต์ #26A69A - ครีมพีช #FDF2E2 - พื้นครีม #FAF7F2

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
    comment: 'ชอบระบบบัญชีเดียวเป็นได้ทั้งคนซื้อและคนขายมากค่ะ พอกดจองคิวปุ๊บ ระบบเด้งเข้าห้องแชทรายการจองทันที พร้อมบอท AI สรุปราคาและค่าส่งให้ครบเลย'
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
    comment: 'ลงขายหนังสือตัวเองง่ายมาก กำหนดค่าจัดส่งและวิธีแพ็กของตามจริงได้เลย เวลาคนมาจองก็มีคิวนับถอยหลัง 5 ชั่วโมง ป้องกันคนจองกั๊กแล้วไม่โอนได้ดีมากค่ะ'
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
    stock: 1,
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
    stock_status: 'Available',
    stock: 1,
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

// ปรับแต่งหมวดหมู่ของหนังสือจาก API ให้สอดคล้องกับชื่อหมวดใหม่ และรวมเข้ากับ EXTRA_SHOWCASE_BOOKS ให้ครบทั้ง 20 หมวดหมู่
function normalizeAndEnrichBooks(apiBooks) {
  const categoryNameMap = {};
  CATEGORIES.forEach(c => {
    categoryNameMap[c.id] = c.name;
  });

  const sourceList = (apiBooks && apiBooks.length > 0) ? apiBooks : CORE_SEED_BOOKS;
  const mappedApiBooks = sourceList.map(b => {
    let catId = b.category;
    // กระจายเล่มตัวอย่างบางเล่มให้เข้าหมวดหมู่เฉพาะทางอย่างเหมาะสม
    if (b.code === 'MKT-BK01') catId = 'mystery-thriller';
    if (b.code === 'MKT-BK04') catId = 'youth-classic';

    return {
      ...b,
      category: catId,
      categoryName: categoryNameMap[catId] || b.categoryName || 'นวนิยายแปล'
    };
  });

  const existingIds = new Set(mappedApiBooks.map(b => b.id));
  const combined = [...mappedApiBooks];

  EXTRA_SHOWCASE_BOOKS.forEach(extra => {
    if (!existingIds.has(extra.id)) {
      combined.push(extra);
    }
  });

  return combined;
}

window.CATEGORIES = CATEGORIES;
window.BOOKS = normalizeAndEnrichBooks([]);
window.CUSTOMER_REVIEWS = CUSTOMER_REVIEWS;
window.generateBookCoverSVG = generateBookCoverSVG;

// ============================================================================
// ระบบ Static / Netlify Serverless Client Fallback
// เมื่อนำเว็บไซต์ไป Deploy บน Netlify (Static Hosting) หากเรียก /api/... แล้วไม่มี Node Server
// ระบบจะจำลองการตอบกลับของ API ทุกเส้นทางให้อัตโนมัติเพื่อให้ใช้งานได้ครบทุกหน้าโดยไม่ขึ้น 404
// ============================================================================
(function setupNetlifyStaticApiFallback() {
  const originalFetch = window.fetch.bind(window);
  const DEMO_USERS = [
    { id: 1, username: 'แอดมินส่วนกลาง (Escrow Admin)', email: 'admin@007marketplace.com', phone_number: '02-007-8899', role: 'Admin', bank_name: 'กสิกรไทย (KBank - บัญชีกลาง)', bank_account_no: '007-8-99999-0', bank_account_name: 'บจก. 007 บุ๊คมาร์เก็ตเพลส (Escrow)' },
    { id: 2, username: 'คุณสมชาย (Member #1)', email: 'somchai@member.com', phone_number: '081-234-5678', role: 'Member', bank_name: 'ไทยพาณิชย์ (SCB)', bank_account_no: '405-1-23456-7', bank_account_name: 'นายสมชาย รักการอ่าน' },
    { id: 3, username: 'คุณพิมพ์ชนก (Member #2)', email: 'pimchanok@member.com', phone_number: '089-876-5432', role: 'Member', bank_name: 'กสิกรไทย (KBank)', bank_account_no: '712-2-88888-9', bank_account_name: 'น.ส.พิมพ์ชนก วงศ์วรรณ' }
  ];

  function createJsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json', 'X-Static-Fallback': 'Netlify' }
    });
  }

  async function handleStaticApiRequest(urlStr, options = {}) {
    const url = new URL(urlStr, window.location.origin);
    const path = url.pathname;
    const method = (options.method || 'GET').toUpperCase();
    let body = {};
    if (options.body) {
      try { body = JSON.parse(options.body); } catch (e) {}
    }

    const currentUser = (() => {
      try { return JSON.parse(localStorage.getItem('007_marketplace_user') || 'null'); } catch (e) { return null; }
    })() || DEMO_USERS[1];

    if (path === '/api/books' && method === 'GET') {
      return createJsonResponse({
        books: window.BOOKS,
        pagination: { page: 1, limit: 12, total: window.BOOKS.length, totalPages: Math.ceil(window.BOOKS.length / 12), hasMore: window.BOOKS.length > 12 }
      });
    }

    if (path === '/api/auth/me') {
      const savedUser = (() => {
        try { return JSON.parse(localStorage.getItem('007_marketplace_user') || 'null'); } catch (e) { return null; }
      })();
      if (savedUser) return createJsonResponse({ authenticated: true, user: savedUser });
      return createJsonResponse({ authenticated: false, user: null });
    }

    if (path === '/api/auth/login' && method === 'POST') {
      const found = DEMO_USERS.find(u => u.email.toLowerCase() === String(body.email || '').toLowerCase()) || DEMO_USERS[1];
      return createJsonResponse({ message: 'เข้าสู่ระบบสำเร็จ', token: 'netlify-demo-jwt-token', user: found });
    }

    if (path === '/api/auth/register' && method === 'POST') {
      const newUser = {
        id: Date.now(),
        username: body.username || 'สมาชิกใหม่',
        email: body.email || 'member@007marketplace.com',
        phone_number: body.phone_number || '080-000-0000',
        role: 'Member',
        bank_name: body.bank_name || 'กสิกรไทย (KBank)',
        bank_account_no: body.bank_account_no || '123-4-56789-0',
        bank_account_name: body.username || 'สมาชิกใหม่'
      };
      return createJsonResponse({ message: 'สมัครสมาชิกสำเร็จ', token: 'netlify-demo-jwt-token', user: newUser }, 201);
    }

    if (path === '/api/auth/logout') {
      return createJsonResponse({ message: 'ออกจากระบบสำเร็จ' });
    }

    if (path === '/api/reservations' && method === 'POST') {
      const book = window.BOOKS.find(b => String(b.book_id) === String(body.book_id) || String(b.id) === String(body.book_id)) || window.BOOKS[0];
      const nextQueue = (book.activeQueueCount || 0) + 1;
      book.activeQueueCount = nextQueue;
      book.stock_status = 'Reserved';
      return createJsonResponse({
        message: nextQueue === 1
          ? '🎉 คุณได้คิวที่ 1 (Active)! มีเวลาโอนเงินเข้าบัญชีกลาง 5 ชั่วโมง ระบบกำลังเปิดห้องแชทให้ทันที'
          : `⏳ คุณได้ต่อคิวลำดับที่ ${nextQueue} (Waiting) ระบบจะเลื่อนคิวให้อัตโนมัติหากคิวก่อนหน้าสละสิทธิ์`,
        reservation: {
          id: 101,
          book_id: book.book_id || 1,
          buyer_id: currentUser.id,
          seller_id: book.seller_id || 2,
          queue_no: nextQueue,
          status: nextQueue === 1 ? 'Active' : 'Waiting',
          expires_at: new Date(Date.now() + 5 * 3600 * 1000).toISOString()
        },
        chatRoomId: 1
      }, 201);
    }

    if (path === '/api/chat/open-room' && method === 'POST') {
      return createJsonResponse({ chatRoomId: 1 });
    }

    if (path.startsWith('/api/chat/rooms/') && path.endsWith('/messages') && method === 'POST') {
      return createJsonResponse({
        message: 'ส่งข้อความสำเร็จ',
        botReplied: true
      }, 201);
    }

    if (path.startsWith('/api/chat/rooms/')) {
      const book = window.BOOKS[0];
      return createJsonResponse({
        room: {
          id: 1,
          room_code: 'CHAT-BK01-B3',
          book_id: 1,
          book_code: book.code,
          book_title: book.title,
          price: book.salePrice,
          shipping_fee: book.shipping_fee,
          condition_percent: book.conditionPercent,
          defect_details: book.defectNote,
          packing_note: book.packing_note,
          stock_status: book.stock_status,
          buyer_id: 3,
          buyer_name: 'คุณพิมพ์ชนก (Member #2)',
          seller_id: 2,
          seller_name: 'คุณสมชาย (Member #1)'
        },
        reservation: {
          id: 1,
          queue_no: 1,
          status: 'Active',
          expires_at: new Date(Date.now() + 4.5 * 3600 * 1000).toISOString()
        },
        order: null,
        messages: [
          {
            id: 1,
            sender_role: 'Bot',
            sender_name: '🤖 ระบบผู้ช่วยอัตโนมัติ (AI Escrow Bot)',
            message_text: `ยินดีต้อนรับสู่ห้องแชทรายการจองหนังสือ "${book.title}" • ค่าหนังสือ ฿${book.salePrice} + ค่าส่ง ฿${book.shipping_fee} + ค่าบริการบัญชีกลาง ฿10 = ยอดโอนสุทธิ ฿${book.salePrice + book.shipping_fee + 10}`,
            created_at: new Date(Date.now() - 600000).toISOString()
          }
        ]
      });
    }

    if (path === '/api/reservations/my') {
      return createJsonResponse({
        reservations: [
          {
            id: 1,
            book_id: 1,
            book_code: 'MKT-BK01',
            book_title: 'ปาฏิหาริย์ร้านชำของคุณนามิยะ',
            price: 189,
            shipping_fee: 40,
            seller_id: 2,
            seller_name: 'คุณสมชาย (Member #1)',
            buyer_id: 3,
            queue_no: 1,
            status: 'Active',
            expires_at: new Date(Date.now() + 4.5 * 3600 * 1000).toISOString(),
            chat_room_id: 1
          }
        ]
      });
    }

    if (path === '/api/my-listings') {
      return createJsonResponse({
        books: window.BOOKS.slice(0, 4).map(b => ({ ...b, price: b.salePrice, queues: [] })),
        salesOrders: [
          {
            id: 2,
            order_code: 'ESC-007202',
            book_id: 2,
            book_title: 'ชีวิตดีขึ้นทุกๆ ด้าน ด้วยการจัดบ้านแค่ครั้งเดียว',
            buyer_id: 2,
            buyer_name: 'คุณสมชาย (Member #1)',
            seller_id: 3,
            seller_name: 'คุณพิมพ์ชนก (Member #2)',
            book_price: 129,
            shipping_fee: 35,
            platform_fee: 10,
            total_amount: 174,
            seller_payout: 164,
            recipient_name: 'นายสมชาย รักการอ่าน',
            recipient_phone: '081-234-5678',
            shipping_address: '99/12 ถ.สุขุมวิท แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110',
            slip_reference: 'SLIP-KBANK-882941',
            tracking_no: '',
            status: 'Paid - Awaiting Shipment',
            payout_status: 'Held in Escrow',
            shipping_deadline: new Date(Date.now() + 46 * 3600 * 1000).toISOString()
          }
        ]
      });
    }

    if (path === '/api/orders/my') {
      const sampleOrder = {
        id: 2,
        order_code: 'ESC-007202',
        book_id: 2,
        book_title: 'ชีวิตดีขึ้นทุกๆ ด้าน ด้วยการจัดบ้านแค่ครั้งเดียว',
        buyer_id: 2,
        buyer_name: 'คุณสมชาย (Member #1)',
        seller_id: 3,
        seller_name: 'คุณพิมพ์ชนก (Member #2)',
        book_price: 129,
        shipping_fee: 35,
        platform_fee: 10,
        total_amount: 174,
        seller_payout: 164,
        recipient_name: 'นายสมชาย รักการอ่าน',
        recipient_phone: '081-234-5678',
        shipping_address: '99/12 ถ.สุขุมวิท แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110',
        slip_reference: 'SLIP-KBANK-882941',
        tracking_no: '',
        status: 'Paid - Awaiting Shipment',
        payout_status: 'Held in Escrow',
        shipping_deadline: new Date(Date.now() + 46 * 3600 * 1000).toISOString()
      };
      return createJsonResponse({ buyOrders: [sampleOrder], sellOrders: [sampleOrder] });
    }

    if (path === '/api/admin/overview') {
      return createJsonResponse({
        totalEscrowRevenue: 20,
        orders: [
          {
            id: 2,
            order_code: 'ESC-007202',
            book_id: 2,
            book_title: 'ชีวิตดีขึ้นทุกๆ ด้าน ด้วยการจัดบ้านแค่ครั้งเดียว',
            buyer_id: 2,
            buyer_name: 'คุณสมชาย (Member #1)',
            buyer_email: 'somchai@member.com',
            seller_id: 3,
            seller_name: 'คุณพิมพ์ชนก (Member #2)',
            seller_bank_name: 'กสิกรไทย (KBank)',
            seller_bank_no: '712-2-88888-9',
            book_price: 129,
            shipping_fee: 35,
            platform_fee: 10,
            total_amount: 174,
            seller_payout: 164,
            slip_reference: 'SLIP-KBANK-882941',
            tracking_no: '',
            status: 'Paid - Awaiting Shipment',
            payout_status: 'Held in Escrow',
            shipping_deadline: new Date(Date.now() + 46 * 3600 * 1000).toISOString()
          }
        ],
        chatRooms: [
          { id: 1, room_code: 'CHAT-BK01-B3', book_title: 'ปาฏิหาริย์ร้านชำของคุณนามิยะ', buyer_name: 'คุณพิมพ์ชนก (Member #2)', seller_name: 'คุณสมชาย (Member #1)' }
        ],
        reservations: [
          { id: 1, book_title: 'ปาฏิหาริย์ร้านชำของคุณนามิยะ', buyer_name: 'คุณพิมพ์ชนก (Member #2)', seller_name: 'คุณสมชาย (Member #1)', queue_no: 1, status: 'Active' }
        ],
        books: window.BOOKS,
        users: DEMO_USERS
      });
    }

    return createJsonResponse({ message: 'ดำเนินการสำเร็จ (Static Fallback Mode)' });
  }

  window.fetch = async function (input, init) {
    const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    const isApiCall = urlStr.includes('/api/');
    try {
      const res = await originalFetch(input, init);
      if (isApiCall) {
        const contentType = res.headers.get('content-type') || '';
        if (res.status === 404 || !contentType.includes('application/json')) {
          return await handleStaticApiRequest(urlStr, init);
        }
      }
      return res;
    } catch (err) {
      if (isApiCall) {
        return await handleStaticApiRequest(urlStr, init);
      }
      throw err;
    }
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
