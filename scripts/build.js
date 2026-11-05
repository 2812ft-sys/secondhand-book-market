const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const HTML_FILES = [
  'index.html',
  'category.html',
  'product.html',
  'reviews.html',
  'contact.html',
  'login.html',
  'register.html',
  'forgot-password.html',
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

/**
 * Minify CSS: ลบคอมเมนต์และช่องว่างที่ไม่จำเป็นทั้งหมดใน dist/css/*.css
 */
function minifyCSS(cssCode) {
  return cssCode
    .replace(/\/\*[\s\S]*?\*\//g, '') // ลบ /* comments */
    .replace(/\s+/g, ' ')             // ยุบช่องว่างหลายตัวเป็นตัวเดียว
    .replace(/\s*([{};:,>~+])\s*/g, '$1') // ลบช่องว่างรอบสัญลักษณ์ CSS
    .replace(/;}/g, '}')              // ลบ ; หน้า }
    .trim();
}

/**
 * ลบคอมเมนต์บรรทัดว่างและแปลง let/const ระดับบนสุดเป็น var อย่างปลอดภัย 100% (รองรับ Nested Template Literals)
 */
function stripJsCommentsAndPromoteTopLevel(code) {
  // 1. ลบ Block comments /* ... */ ที่อยู่ต้นบรรทัด และ Line comments // ... ที่อยู่ต้นบรรทัด
  const cleanedLines = code
    .replace(/^\s*\/\*[\s\S]*?\*\/\s*$/gm, '')
    .split('\n')
    .filter(line => !/^\s*\/\//.test(line))
    .filter(line => line.trim().length > 0);

  // 2. แปลง let / const ระดับบนสุด (ย่อหน้า 0 หรือ 4 ช่องว่างใน <script>) เป็น var เพื่อให้ผูกกับ window เมื่อรันผ่าน Indirect Eval
  const promotedCode = cleanedLines
    .map(line => line.replace(/^( {0,4})(let|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/, '$1var $3 ='))
    .join('\n');

  try {
    new vm.Script(promotedCode);
    return promotedCode;
  } catch (e) {
    // Fallback หากมีตัวแปรซ้ำชื่อกับพารามิเตอร์ ให้ใช้โค้ดที่ลบคอมเมนต์แล้วโดยตรง
    return cleanedLines.join('\n');
  }
}

/**
 * สร้างชื่อตัวแปรแบบ Hex Obfuscated เช่น _0x4a8f
 */
function createHexIdGenerator(seedStr) {
  let counter = 0;
  return function nextHexId() {
    counter++;
    const hash = crypto
      .createHash('md5')
      .update(`${seedStr}_${counter}`)
      .digest('hex')
      .slice(0, 6);
    return `_0x${hash}`;
  };
}

/**
 * Minify & Obfuscate ไฟล์ JavaScript:
 * 1. ลบคอมเมนต์และย่อโค้ด (Minify)
 * 2. แปลงชื่อตัวแปรภายในบางส่วนและเข้ารหัส Payload เป็น Chunks แบบ XOR + Base64 String Array
 * 3. หมุนลำดับ Array (Array Rotation) และใช้ชื่อตัวแปร _0x... ทั้งหมด เพื่อไม่ให้คนกด Inspect อ่านโค้ดหรือข้อความออก
 */
function minifyAndObfuscateJS(sourceCode, label = 'script') {
  // ตรวจสอบไวยากรณ์โค้ดต้นฉบับก่อนแปลง
  new vm.Script(sourceCode, { filename: `${label}-source.js` });

  const minified = stripJsCommentsAndPromoteTopLevel(sourceCode);
  new vm.Script(minified, { filename: `${label}-minified.js` });
  const genId = createHexIdGenerator(label + '_' + minified.length);

  // เข้ารหัส UTF-8 bytes ด้วย XOR key เฉพาะไฟล์
  const hashBytes = crypto.createHash('sha256').update(label + minified.length).digest();
  const xorKey = [];
  for (let k = 0; k < 16; k++) {
    xorKey.push((hashBytes[k] % 220) + 17);
  }

  const utf8Buf = Buffer.from(minified, 'utf8');
  const encryptedBuf = Buffer.allocUnsafe(utf8Buf.length);
  for (let i = 0; i < utf8Buf.length; i++) {
    encryptedBuf[i] = utf8Buf[i] ^ xorKey[i % xorKey.length];
  }

  const b64Payload = encryptedBuf.toString('base64');

  // แบ่ง Base64 ออกเป็น Chunks ย่อยใส่ใน String Table
  const chunkSize = 180;
  const chunks = [];
  for (let i = 0; i < b64Payload.length; i += chunkSize) {
    chunks.push(b64Payload.slice(i, i + chunkSize));
  }

  // หมุน Array (Rotate) เพื่อซ่อนลำดับจริง
  const rotateShift = (hashBytes[0] % Math.max(1, chunks.length));
  const rotatedChunks = chunks.slice(rotateShift).concat(chunks.slice(0, rotateShift));

  // สร้างชื่อตัวแปรแบบ _0x... ทั้งหมด
  const vArr = genId();
  const vShift = genId();
  const vRotFn = genId();
  const vKey = genId();
  const vJoined = genId();
  const vBinStr = genId();
  const vLen = genId();
  const vBytes = genId();
  const vIdx = genId();
  const vDec = genId();
  const vCode = genId();

  const keyHexArray = xorKey.map(n => '0x' + n.toString(16)).join(',');
  const chunksLiteral = rotatedChunks.map(c => `'${c}'`).join(',');

  const obfuscatedCode =
    `/* Protected Build - Do Not Copy */\n` +
    `(function(){` +
    `var ${vArr}=[${chunksLiteral}],${vShift}=0x${rotateShift.toString(16)};` +
    `(function(${vRotFn},${vIdx}){while(${vIdx}-->0x0){${vRotFn}['push'](${vRotFn}['shift']());}})(${vArr},${vArr}['length']-${vShift});` +
    `var ${vKey}=[${keyHexArray}],${vJoined}=${vArr}['join'](''),${vBinStr}=window['atob'](${vJoined}),${vLen}=${vBinStr}['length'],${vBytes}=new Uint8Array(${vLen});` +
    `for(var ${vIdx}=0x0;${vIdx}<${vLen};${vIdx}++){${vBytes}[${vIdx}]=${vBinStr}['charCodeAt'](${vIdx})^${vKey}[${vIdx}%${vKey}['length']];}` +
    `var ${vDec}=new TextDecoder('utf-8')['decode'](${vBytes}),${vCode}=window['eval'];` +
    `${vCode}(${vDec});` +
    `})();`;

  // ตรวจสอบว่าโค้ดที่ Obfuscate แล้วถูกต้องตามไวยากรณ์ JS 100%
  new vm.Script(obfuscatedCode, { filename: `${label}-obfuscated.js` });
  return obfuscatedCode;
}

/**
 * Minify HTML และ Obfuscate inline <script> ที่อยู่ในไฟล์ HTML ในโฟลเดอร์ dist/
 */
function processDistHtmlFile(htmlContent, fileName) {
  let scriptIndex = 0;

  // Obfuscate เฉพาะ inline <script> (ที่ไม่มีแอตทริบิวต์ src="...")
  const withObfuscatedScripts = htmlContent.replace(
    /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi,
    (fullMatch, attrs, inlineJs) => {
      const trimmed = inlineJs.trim();
      if (!trimmed) return fullMatch;
      scriptIndex++;
      const obfuscatedInline = minifyAndObfuscateJS(trimmed, `${fileName}_inline_${scriptIndex}`);
      return `<script${attrs}>${obfuscatedInline}</script>`;
    }
  );

  // ลบ HTML comments (<!-- ... -->) และจัดบรรทัดระหว่างแท็กให้สะอาดโดยไม่ทำให้ข้อความติดกัน
  return withObfuscatedScripts
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '>\n<')
    .trim();
}

function buildProductionDist() {
  console.log('🚀 เริ่มต้นสร้างโฟลเดอร์สำหรับใช้งานจริง (Production Build + Minify & Obfuscate -> dist/)...');

  // ล้างโฟลเดอร์ dist เดิมและสร้างใหม่
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });

  // 1. คัดลอกโฟลเดอร์ css และ js
  ASSET_DIRS.forEach(dir => {
    const srcDir = path.join(ROOT_DIR, dir);
    const destDir = path.join(DIST_DIR, dir);
    if (fs.existsSync(srcDir)) {
      copyRecursiveSync(srcDir, destDir);
      console.log(`  📁 คัดลอกโฟลเดอร์: ${dir}/`);
    }
  });

  // 2. Minify ไฟล์ CSS ใน dist/css/*.css
  const distCssDir = path.join(DIST_DIR, 'css');
  if (fs.existsSync(distCssDir)) {
    fs.readdirSync(distCssDir).forEach(file => {
      if (file.endsWith('.css')) {
        const cssPath = path.join(distCssDir, file);
        const rawCss = fs.readFileSync(cssPath, 'utf8');
        const minifiedCss = minifyCSS(rawCss);
        fs.writeFileSync(cssPath, minifiedCss, 'utf8');
        console.log(`  🎨 Minify CSS สำเร็จ: dist/css/${file} (${rawCss.length} -> ${minifiedCss.length} bytes)`);
      }
    });
  }

  // 3. Minify & Obfuscate ไฟล์ JavaScript ใน dist/js/*.js
  const distJsDir = path.join(DIST_DIR, 'js');
  if (fs.existsSync(distJsDir)) {
    fs.readdirSync(distJsDir).forEach(file => {
      if (file.endsWith('.js')) {
        const jsPath = path.join(distJsDir, file);
        const rawJs = fs.readFileSync(jsPath, 'utf8');
        const obfuscatedJs = minifyAndObfuscateJS(rawJs, file);
        fs.writeFileSync(jsPath, obfuscatedJs, 'utf8');
        console.log(`  🔒 Minify & Obfuscate JS สำเร็จ: dist/js/${file}`);
      }
    });
  }

  // 4. คัดลอกและ Obfuscate inline scripts ในไฟล์ HTML ทุกหน้าใน dist/
  HTML_FILES.forEach(file => {
    const srcPath = path.join(ROOT_DIR, file);
    const destPath = path.join(DIST_DIR, file);
    if (fs.existsSync(srcPath)) {
      const rawHtml = fs.readFileSync(srcPath, 'utf8');
      const processedHtml = processDistHtmlFile(rawHtml, file);
      fs.writeFileSync(destPath, processedHtml, 'utf8');
      console.log(`  📄 สร้างและเข้ารหัสหน้าเว็บ: dist/${file}`);
    }
  });

  // 5. สร้างไฟล์ _redirects ในโฟลเดอร์ dist/ เพื่อรองรับทั้ง Git Deploy และ Drag & Drop บน Netlify
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
    '/register    /register.html   200',
    '/forgot-password /forgot-password.html 200',
    '/profile     /profile.html    200',
    '/admin       /admin.html      200',
    '/*           /index.html      200'
  ].join('\n') + '\n';

  fs.writeFileSync(path.join(DIST_DIR, '_redirects'), redirectsContent, 'utf8');
  console.log('  🔀 สร้างไฟล์ Redirects สำหรับ Netlify: dist/_redirects');

  // 6. สร้างไฟล์ _headers ในโฟลเดอร์ dist/ เพื่อบังคับใช้ Security Headers บน Netlify
  const headersContent = [
    '/*',
    '  X-Frame-Options: DENY',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
    "  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https: http:; media-src 'self' data: blob:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
  ].join('\n') + '\n';

  fs.writeFileSync(path.join(DIST_DIR, '_headers'), headersContent, 'utf8');
  fs.writeFileSync(path.join(ROOT_DIR, '_headers'), headersContent, 'utf8');
  console.log('  🛡️ สร้างไฟล์ Security Headers สำหรับ Netlify: dist/_headers');

  // ลบ dist/netlify.toml หากเผลอมีอยู่ใน dist/
  const distNetlifyToml = path.join(DIST_DIR, 'netlify.toml');
  if (fs.existsSync(distNetlifyToml)) {
    fs.unlinkSync(distNetlifyToml);
  }

  console.log('========================================================================');
  console.log('✅ สร้างโฟลเดอร์ dist/ (พร้อม Minify & Obfuscate ป้องกันการก๊อปปี้โค้ด) สำเร็จ!');
  console.log('💡 ไฟล์ต้นฉบับด้านนอกยังอ่านง่ายและแก้ไขได้ตามปกติ 100%');
  console.log('========================================================================');
}

buildProductionDist();
