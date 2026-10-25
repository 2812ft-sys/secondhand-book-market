const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const HTML_FILES = [
  'index.html',
  'category.html',
  'product.html',
  'reviews.html',
  'contact.html',
  'login.html',
  'profile.html',
  'admin.html'
];

const ASSET_DIRS = ['css', 'js'];

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else if (exists) {
    fs.copyFileSync(src, dest);
  }
}

function buildProductionDist() {
  console.log('🚀 เริ่มต้นสร้างโฟลเดอร์สำหรับใช้งานจริง (Production Build -> dist/)...');

  // ล้างโฟลเดอร์ dist เดิมและสร้างใหม่
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });

  // 1. คัดลอกไฟล์ HTML ทุกหน้า (Multi-page)
  HTML_FILES.forEach(file => {
    const srcPath = path.join(ROOT_DIR, file);
    const destPath = path.join(DIST_DIR, file);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`  📄 คัดลอกหน้าเว็บ: ${file}`);
    }
  });

  // 2. คัดลอกโฟลเดอร์ css และ js
  ASSET_DIRS.forEach(dir => {
    const srcDir = path.join(ROOT_DIR, dir);
    const destDir = path.join(DIST_DIR, dir);
    if (fs.existsSync(srcDir)) {
      copyRecursiveSync(srcDir, destDir);
      console.log(`  📁 คัดลอกโฟลเดอร์: ${dir}/`);
    }
  });

  // 3. สร้างไฟล์ _redirects ในโฟลเดอร์ dist/ เพื่อรองรับทั้ง Git Deploy และ Drag & Drop บน Netlify
  const redirectsContent = [
    '/home        /index.html      200',
    '/index       /index.html      200',
    '/category    /category.html   200',
    '/category/*  /category.html   200',
    '/product     /product.html    200',
    '/product/*   /product.html    200',
    '/reviews     /reviews.html    200',
    '/contact     /contact.html    200',
    '/login       /login.html      200',
    '/profile     /profile.html    200',
    '/admin       /admin.html      200',
    '/*           /index.html      200'
  ].join('\n') + '\n';

  fs.writeFileSync(path.join(DIST_DIR, '_redirects'), redirectsContent, 'utf8');
  console.log('  🔀 สร้างไฟล์ Redirects สำหรับ Netlify: dist/_redirects');

  console.log('========================================================================');
  console.log('✅ สร้างโฟลเดอร์พร้อมใช้งานจริงสำเร็จที่: dist/');
  console.log('💡 คุณสามารถลากโฟลเดอร์ dist/ ไปวางบน Netlify Drop หรือเชื่อมต่อ Git เพื่อ Deploy ได้ทันที');
  console.log('========================================================================');
}

buildProductionDist();
