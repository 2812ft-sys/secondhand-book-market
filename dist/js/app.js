// ระบบหลักสำหรับตลาดกลางซื้อ-ขายหนังสือมือสองออนไลน์ (ร้านหนังสือมือสอง | Secondhand Bookstore)
// โทนสีพาสเทลสว่างละมุน: พื้นหลัง #FAF7F2, ปุ่มหลักเขียวมิ้นต์ #26A69A, สีรองส้มพีช #E9964A, หัวข้อ #1F4E4B

const AUTH_TOKEN_KEY = '007_marketplace_jwt_token';
const AUTH_USER_KEY = '007_marketplace_user';
const WISHLIST_STORAGE_KEY = '007_book_wishlist';

let activeChatRoomId = null;
let isReservationInFlight = false;
let isChatSendInFlight = false;

// ฟังก์ชัน Debounce (300ms) ป้องกันการยิงคำสั่งค้นหารัวๆ ทุกครั้งที่พิมพ์ตัวอักษร
function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}
window.debounce = debounce;

// ============================================================================
// 1. AUTHENTICATION, WISHLIST & UNIFIED MEMBER HELPERS
// ============================================================================

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setAuthSession(token, user) {
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  if (user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  renderLayout();
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

// ระบบเก็บหนังสือไว้ดูภายหลัง (Wishlist Heart)
function getWishlistIds() {
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function isBookWishlisted(bookId) {
  return getWishlistIds().includes(String(bookId));
}

function toggleBookWishlist(event, bookId) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const idStr = String(bookId);
  let list = getWishlistIds();
  const exists = list.includes(idStr);

  if (exists) {
    list = list.filter(item => item !== idStr);
    showToast('นำออกจากรายการที่เก็บไว้แล้ว', 'info');
  } else {
    list.push(idStr);
    showToast('🧡 เก็บหนังสือไว้ดูภายหลังเรียบร้อยแล้ว!', 'success');
  }

  localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(list));

  // อัปเดตปุ่มหัวใจทันทีพร้อมแอนิเมชันเด้งดึ๋ง (heart-pop)
  const btn = event?.currentTarget;
  if (btn) {
    btn.classList.remove('heart-pop');
    void btn.offsetWidth;
    btn.classList.add('heart-pop');
    const nowWishlisted = !exists;
    btn.innerHTML = nowWishlisted ? '🧡' : '🤍';
    btn.className = `w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-xs transition cursor-pointer heart-pop ${
      nowWishlisted
        ? 'bg-[#FDF2E2] border border-[#F4A261] text-[#E9964A]'
        : 'bg-white/90 hover:bg-[#FDF2E2] border border-[#E6E1D6] text-[#5F7470]'
    }`;
  }

  window.dispatchEvent(new CustomEvent('wishlistUpdated', { detail: { wishlist: list } }));
}

async function syncAuthWithServer() {
  try {
    const token = getAuthToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch('/api/auth/me', { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated && data.user) {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        renderLayout();
        window.dispatchEvent(new CustomEvent('authUpdated', { detail: { user: data.user } }));
        return data.user;
      }
    }
    clearAuthSession();
    renderLayout();
    return null;
  } catch (e) {
    return getCurrentUser();
  }
}

async function logoutUser() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  clearAuthSession();
  showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 500);
}

// ปุ่มสลับบัญชีทดสอบทันที (1 Admin + 2 Members)
async function quickDemoLogin(email, password) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'เข้าสู่ระบบไม่สำเร็จ', 'error');
      return;
    }
    setAuthSession(data.token, data.user);
    showToast(`เข้าสู่ระบบสำเร็จ: ${data.user.username} (สิทธิ์ ${data.user.role})`, 'success');
    setTimeout(() => {
      if (data.user.role === 'Admin') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'index.html';
      }
    }, 450);
  } catch (err) {
    showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
  }
}

function toggleSeedSwitcherPopover() {
  const pop = document.getElementById('seed-switcher-popover');
  if (pop) {
    pop.classList.toggle('hidden');
  }
}

// ============================================================================
// 2. RESERVATION QUEUE + AUTO-OPEN 3-PARTY CHAT ROOM
// ============================================================================

async function reserveBookQueue(bookId) {
  const user = getCurrentUser();
  if (!user) {
    showToast('กรุณาเข้าสู่ระบบก่อนกดจองคิวหนังสือ', 'info');
    setTimeout(() => {
      window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }, 700);
    return;
  }

  if (isReservationInFlight) {
    showToast('กำลังประมวลผลคิวจอง กรุณารอสักครู่...', 'info');
    return;
  }
  isReservationInFlight = true;

  try {
    const token = getAuthToken();
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ book_id: bookId })
    });

    const data = await res.json();
    closeBookDetailModal();

    if (!res.ok) {
      showToast(data.error || 'ไม่สามารถจองคิวหนังสือได้', 'error');
      if (data.chatRoomId) {
        openThreePartyChatModalById(data.chatRoomId);
      }
      return;
    }

    showToast(data.message, 'success');
    await window.fetchBooksFromAPI();

    if (data.chatRoom && data.chatRoom.id) {
      await openThreePartyChatModalById(data.chatRoom.id);
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาดในการเชื่อมต่อระบบจองคิว', 'error');
  } finally {
    setTimeout(() => {
      isReservationInFlight = false;
    }, 600);
  }
}

// ============================================================================
// 3. 3-PARTY CHAT ROOM MODAL & AI ASSISTANT BOT
// ============================================================================

async function openChatForBook(bookId, buyerId = null) {
  const user = getCurrentUser();
  if (!user) {
    showToast('กรุณาเข้าสู่ระบบเพื่อทักแชทสอบถามกับผู้ขายและบอท AI', 'info');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 700);
    return;
  }

  closeBookDetailModal();

  try {
    const token = getAuthToken();
    const res = await fetch('/api/chat/open', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ book_id: bookId, buyer_id: buyerId })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'ไม่สามารถเปิดห้องแชทได้', 'error');
      return;
    }
    if (data.room && data.room.id) {
      await openThreePartyChatModalById(data.room.id);
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาดในการเปิดห้องแชท', 'error');
  }
}

async function openThreePartyChatModalById(roomId) {
  activeChatRoomId = roomId;
  document.getElementById('chat-modal-backdrop')?.classList.remove('hidden');
  document.getElementById('chat-modal-box')?.classList.remove('hidden');
  await loadChatRoomMessages(roomId);
}

function closeThreePartyChatModal() {
  activeChatRoomId = null;
  document.getElementById('chat-modal-backdrop')?.classList.add('hidden');
  document.getElementById('chat-modal-box')?.classList.add('hidden');
}

async function loadChatRoomMessages(roomId) {
  if (!roomId) return;
  try {
    const token = getAuthToken();
    const res = await fetch(`/api/chat/rooms/${roomId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) return;
    const data = await res.json();
    const { room, reservation, order, messages } = data;

    const titleEl = document.getElementById('chat-room-title');
    const membersEl = document.getElementById('chat-room-members');
    const escrowBannerEl = document.getElementById('chat-escrow-status-bar');
    const messagesListEl = document.getElementById('chat-messages-list');

    if (titleEl) {
      titleEl.innerHTML = `💬 ห้องแชทรายการจอง: <span class="text-[#26A69A]">${room.book_title}</span> <span class="text-xs font-mono text-[#5F7470]">(${room.room_code})</span>`;
    }

    if (membersEl) {
      membersEl.innerHTML = `
        <span class="px-2.5 py-0.5 rounded-full bg-[#E0F4F1] text-[#1F4E4B] text-[11px] font-bold">🛒 ผู้ซื้อ: ${room.buyer_name}</span>
        <span class="px-2.5 py-0.5 rounded-full bg-[#FDF2E2] text-[#E9964A] text-[11px] font-bold">🏷️ ผู้ขาย: ${room.seller_name}</span>
        <span class="px-2.5 py-0.5 rounded-full bg-white border border-[#E6E1D6] text-[#1F4E4B] text-[11px] font-bold">🛡️ บัญชีกลางดูแลอัตโนมัติ</span>
        <span class="px-2.5 py-0.5 rounded-full bg-[#E0F4F1]/60 text-[#26A69A] text-[11px] font-bold">🤖 บอท AI ตอบอัตโนมัติ</span>
      `;
    }

    const escrowFee = 10; // ค่าบริการส่วนกลาง 10 บาท/เล่ม
    const totalAmount = Number(room.book_price) + Number(room.shipping_fee) + escrowFee;
    const currentUser = getCurrentUser();
    const isBuyer = currentUser && currentUser.id === room.buyer_id;

    if (escrowBannerEl) {
      let actionHTML = '';
      if (order) {
        actionHTML = `
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-3 py-1 rounded-full bg-[#26A69A] text-white text-xs font-bold">สถานะ Escrow: ${order.status} (#${order.order_code})</span>
            <a href="profile.html?tab=orders" class="px-3 py-1 rounded-full bg-white border border-[#26A69A] text-[#26A69A] text-xs font-bold hover:bg-[#E0F4F1]">ดูรายละเอียดบิล →</a>
          </div>
        `;
      } else if (reservation && reservation.status === 'Active' && isBuyer) {
        actionHTML = `
          <button onclick="promptEscrowStep1Payment(${reservation.id}, ${room.book_id}, '${room.book_title.replace(/'/g, "\\'")}', ${room.book_price}, ${room.shipping_fee})" class="px-4 py-1.5 rounded-full bg-[#26A69A] hover:bg-[#219187] text-white text-xs font-bold shadow-xs cursor-pointer">
            💳 แจ้งโอนเงินเข้าบัญชีกลาง (฿${totalAmount})
          </button>
        `;
      } else if (reservation) {
        actionHTML = `<span class="px-3 py-1 rounded-full bg-[#FDF2E2] text-[#E9964A] text-xs font-bold">ลำดับคิวที่ ${reservation.queue_no} (${reservation.status})</span>`;
      }

      escrowBannerEl.innerHTML = `
        <div class="text-xs text-[#1F4E4B]">
          <strong>ค่าหนังสือ</strong> ${room.book_price}฿ + <strong>ค่าส่ง</strong> ${room.shipping_fee}฿ + <strong>ค่าธรรมเนียมระบบ (10 บาท/เล่ม)</strong> = <strong class="text-[#26A69A] text-sm">ยอดโอนสุทธิ ${totalAmount}฿</strong>
          <span class="text-[#5F7470] ml-1">| บัญชีกลาง: ${room.escrow_bank || 'กสิกรไทย'} <strong>${room.escrow_acc_no || '007-1-99999-8'}</strong></span>
        </div>
        ${actionHTML}
      `;
    }

    if (messagesListEl) {
      messagesListEl.innerHTML = (messages || []).map(m => {
        if (m.sender_role === 'AI_Bot') {
          return `
            <div class="p-3.5 rounded-2xl bg-[#E0F4F1]/60 border border-[#BCE3DF] text-xs text-[#1F4E4B] space-y-1">
              <div class="flex items-center justify-between">
                <span class="font-bold text-[#26A69A]">🤖 ${m.sender_name}</span>
                <span class="text-[10px] text-[#5F7470]">${new Date(m.created_at).toLocaleTimeString('th-TH')}</span>
              </div>
              <p class="whitespace-pre-line leading-relaxed">${m.message}</p>
            </div>
          `;
        }

        const isMe = currentUser && m.sender_id === currentUser.id;
        let roleBadge = 'bg-[#E0F4F1] text-[#1F4E4B]';
        if (m.sender_role === 'Seller') roleBadge = 'bg-[#FDF2E2] text-[#E9964A]';
        if (m.sender_role === 'Admin') roleBadge = 'bg-[#26A69A] text-white';

        return `
          <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
            <div class="flex items-center gap-1.5 mb-1">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${roleBadge}">${m.sender_role}</span>
              <span class="text-xs font-bold text-[#1F4E4B]">${m.sender_name}</span>
              <span class="text-[10px] text-[#5F7470]">${new Date(m.created_at).toLocaleTimeString('th-TH')}</span>
            </div>
            <div class="max-w-lg rounded-2xl px-4 py-2.5 text-xs sm:text-sm ${isMe ? 'bg-[#26A69A] text-white' : 'bg-white border border-[#E6E1D6] text-[#1F4E4B]'} shadow-2xs">
              <p class="whitespace-pre-line leading-relaxed">${m.message}</p>
              ${m.attachment_note ? `<div class="mt-1.5 pt-1.5 border-t border-white/25 text-[11px] font-mono">📎 หลักฐาน/สลิป: ${m.attachment_note}</div>` : ''}
            </div>
          </div>
        `;
      }).join('');
      messagesListEl.scrollTop = messagesListEl.scrollHeight;
    }
  } catch (err) {
    console.error(err);
  }
}

async function handleSendChatMessage(e) {
  e.preventDefault();
  if (!activeChatRoomId || isChatSendInFlight) return;
  const input = document.getElementById('chat-message-input');
  const message = input.value.trim();
  if (!message) return;

  isChatSendInFlight = true;
  input.value = '';
  try {
    const token = getAuthToken();
    const res = await fetch(`/api/chat/rooms/${activeChatRoomId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ message })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error || 'ส่งข้อความไม่สำเร็จ', 'error');
      return;
    }
    await loadChatRoomMessages(activeChatRoomId);
  } catch (err) {
    showToast('ส่งข้อความไม่สำเร็จ', 'error');
  } finally {
    setTimeout(() => {
      isChatSendInFlight = false;
    }, 350);
  }
}

function sendQuickChatQuestion(text) {
  const input = document.getElementById('chat-message-input');
  if (input) {
    input.value = text;
    document.getElementById('chat-message-form')?.requestSubmit();
  }
}

// ============================================================================
// 4. MODAL สำหรับ "+ ลงขายหนังสือ" & MODAL กติกาบัญชีกลาง & MODAL ตัวอย่างด่วน (Quick View)
// ============================================================================

let sellUploadedImages = [];

function renderSellImagePreviews() {
  const grid = document.getElementById('sell-images-preview-grid');
  const countBadge = document.getElementById('sell-images-count-badge');
  if (!grid) return;

  if (countBadge) {
    const cnt = sellUploadedImages.length;
    const isValid = cnt >= 2 && cnt <= 10;
    countBadge.textContent = `อัปโหลดแล้ว ${cnt} / 10 รูป (ขั้นต่ำ 2 รูป)`;
    countBadge.className = `px-3 py-1 rounded-full text-xs font-extrabold ${
      isValid ? 'bg-[#E0F4F1] text-[#26A69A]' : 'bg-[#FDF2E2] text-[#E9964A]'
    }`;
  }

  if (sellUploadedImages.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-5 px-4 rounded-2xl border-2 border-dashed border-[#BCE3DF] bg-[#FAF7F2] text-center text-xs text-[#5F7470]">
        📷 ยังไม่มีรูปภาพ กรุณาอัปโหลดอย่างน้อย 2 รูป (<strong>รูปที่ 1: ปกหน้า, รูปที่ 2: ปกหลัง</strong> และรูปเพิ่มเติมอื่นๆ เช่น สันหนังสือหรือจุดตำหนิ สูงสุดไม่เกิน 10 รูป)
      </div>
    `;
    return;
  }

  grid.innerHTML = sellUploadedImages.map((src, idx) => {
    const label = idx === 0 ? '1: ปกหน้า' : (idx === 1 ? '2: ปกหลัง' : `รูปที่ ${idx + 1}`);
    return `
      <div class="relative rounded-2xl border border-[#E6E1D6] bg-[#FAF7F2] p-1.5 group">
        <img src="${src}" alt="${label}" class="w-full aspect-[4/5] object-cover rounded-xl" />
        <span class="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-[#1F4E4B]/85 text-white text-[10px] font-bold">
          ${label}
        </span>
        <button
          type="button"
          onclick="removeSellImageAt(${idx})"
          class="absolute top-2 right-2 w-6 h-6 rounded-full bg-rose-600 text-white text-xs font-bold flex items-center justify-center shadow cursor-pointer"
          title="ลบรูปนี้"
        >✕</button>
      </div>
    `;
  }).join('');
}

function removeSellImageAt(index) {
  sellUploadedImages.splice(index, 1);
  renderSellImagePreviews();
}

function handleSellImagesChange(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  if (sellUploadedImages.length + files.length > 10) {
    showToast('⚠️ อัปโหลดได้สูงสุดไม่เกิน 10 รูปต่อรายการขายเท่านั้น!', 'error');
    event.target.value = '';
    return;
  }

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      if (sellUploadedImages.length < 10 && e.target?.result) {
        sellUploadedImages.push(e.target.result);
        renderSellImagePreviews();
      }
    };
    reader.readAsDataURL(file);
  });
  event.target.value = '';
}

function addDemoFrontBackImages() {
  const titleVal = document.getElementById('sell-title')?.value.trim() || 'ตัวอย่างหนังสือลงขาย';
  const authorVal = document.getElementById('sell-author')?.value.trim() || 'สมาชิกผู้ขาย';
  const catVal = (document.getElementById('sell-category')?.value || 'translated-novel|นวนิยายแปล').split('|');
  const tempBook = {
    id: 'preview-' + Date.now(),
    title: titleVal,
    enTitle: 'Secondhand Book Preview',
    author: authorVal,
    category: catVal[0],
    categoryName: catVal[1],
    conditionPercent: Number(document.getElementById('sell-condition')?.value || 92),
    originalPrice: Number(document.getElementById('sell-orig-price')?.value || 350),
    shipping_fee: Number(document.getElementById('sell-shipping-fee')?.value || 35)
  };
  const frontSvg = window.generateBookCoverSVG(tempBook, 'front');
  const backSvg = window.generateBookCoverSVG(tempBook, 'back');
  if (sellUploadedImages.length + 2 > 10) {
    showToast('⚠️ จำนวนรูปเกิน 10 รูปแล้ว ไม่สามารถเพิ่มรูปได้อีก', 'error');
    return;
  }
  sellUploadedImages.push(frontSvg, backSvg);
  renderSellImagePreviews();
  showToast('✨ เพิ่มรูปที่ 1 (ปกหน้า) และรูปที่ 2 (ปกหลัง) เรียบร้อยแล้ว!', 'success');
}

function openSellBookModal() {
  const user = getCurrentUser();
  if (!user) {
    showToast('กรุณาเข้าสู่ระบบก่อนลงประกาศขายหนังสือของคุณ', 'info');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 700);
    return;
  }
  document.getElementById('sell-modal-backdrop')?.classList.remove('hidden');
  document.getElementById('sell-modal-box')?.classList.remove('hidden');
  renderSellImagePreviews();
}

function closeSellBookModal() {
  document.getElementById('sell-modal-backdrop')?.classList.add('hidden');
  document.getElementById('sell-modal-box')?.classList.add('hidden');
}

function openEscrowRulesModal() {
  document.getElementById('escrow-rules-backdrop')?.classList.remove('hidden');
  document.getElementById('escrow-rules-box')?.classList.remove('hidden');
}

function closeEscrowRulesModal() {
  document.getElementById('escrow-rules-backdrop')?.classList.add('hidden');
  document.getElementById('escrow-rules-box')?.classList.add('hidden');
}

function openBookDetailModal(bookIdOrCode) {
  const book = (window.BOOKS || []).find(
    b => String(b.id) === String(bookIdOrCode) || String(b.book_id) === String(bookIdOrCode)
  );
  if (!book) {
    window.location.href = `product.html?id=${bookIdOrCode}`;
    return;
  }

  const coverSrc = (book.images && book.images[0]) ? book.images[0] : window.generateBookCoverSVG(book, 'front');
  const isSoldOut = book.stock <= 0 || book.stock_status === 'Sold Out';
  const stockCount = isSoldOut ? 0 : (book.stock || 1);
  const queueCount = book.activeQueueCount || 0;
  const isReserved = !isSoldOut && (book.stock_status === 'Reserved' || queueCount > 0);
  const currentUser = getCurrentUser();
  const isOwnBook = currentUser && Number(currentUser.id) === Number(book.seller_id);
  const wishlisted = isBookWishlisted(book.id);
  const sellerRating = book.seller_rating || '4.9';
  const sellerRevCount = book.seller_reviews_count || 28;

  let queueBadgeHTML = `<span class="px-3 py-1 rounded-full bg-[#E0F4F1] text-[#1F4E4B] text-xs font-bold">🟢 คิวว่าง พร้อมจอง</span>`;
  if (isSoldOut) {
    queueBadgeHTML = `<span class="px-3 py-1 rounded-full bg-gray-200 text-gray-600 text-xs font-bold">SOLD OUT (ขายแล้ว)</span>`;
  } else if (isReserved) {
    queueBadgeHTML = `<span class="px-3 py-1 rounded-full bg-[#FDF2E2] text-[#E9964A] text-xs font-bold">⏳ รอคิว ${queueCount} คน (กดต่อคิวได้)</span>`;
  }

  const contentEl = document.getElementById('book-detail-modal-content');
  if (contentEl) {
    contentEl.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-12 gap-6 items-start">
        <div class="sm:col-span-5 bg-[#FAF7F2] rounded-2xl p-3 border border-[#E6E1D6] relative overflow-hidden">
          <img src="${coverSrc}" alt="${book.title}" class="w-full aspect-[4/5] object-cover rounded-xl transition ${isSoldOut ? 'opacity-50 grayscale-[40%]' : ''}" />
          ${isSoldOut ? `
            <div class="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <span class="px-4 py-2 rounded-full bg-[#1F4E4B]/90 border-2 border-white text-white text-xs sm:text-sm font-extrabold tracking-wide shadow-lg">
                SOLD OUT (ขายแล้ว)
              </span>
            </div>
          ` : ''}
          <button
            type="button"
            onclick="toggleBookWishlist(event, '${book.id}')"
            class="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center text-base shadow-xs transition cursor-pointer z-20 ${
              wishlisted
                ? 'bg-[#FDF2E2] border border-[#F4A261] text-[#E9964A]'
                : 'bg-white/90 hover:bg-[#FDF2E2] border border-[#E6E1D6] text-[#5F7470]'
            }"
            title="เก็บไว้ดูภายหลัง (Wishlist)"
          >
            ${wishlisted ? '🧡' : '🤍'}
          </button>
        </div>

        <div class="sm:col-span-7 space-y-3.5 text-left">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-3 py-1 rounded-full bg-[#FAF7F2] border border-[#E6E1D6] text-[#E9964A] text-xs font-bold">
              ${book.categoryName}
            </span>
            ${queueBadgeHTML}
            <span class="px-3 py-1 rounded-full ${isSoldOut ? 'bg-gray-100 text-gray-500 border border-gray-300' : 'bg-[#E0F4F1]/70 text-[#26A69A] border border-[#BCE3DF]'} text-xs font-extrabold">
              📦 จำนวนคงเหลือ ${stockCount} เล่ม
            </span>
          </div>

          <div>
            <h3 class="text-xl font-extrabold text-[#1F4E4B] leading-snug">${book.title}</h3>
            <p class="text-xs text-[#5F7470] mt-1">ผู้แต่ง: <strong>${book.author}</strong> • สำนักพิมพ์: ${book.publisher || '-'}</p>
          </div>

          <div class="space-y-1 pt-1">
            <div class="flex items-baseline gap-3">
              <span class="text-2xl font-extrabold text-[#26A69A]">฿${book.salePrice}</span>
              <span class="text-xs text-[#5F7470] line-through">ราคาปก ฿${book.originalPrice}</span>
              <span class="text-xs font-semibold text-[#E9964A]">+ ค่าส่ง ฿${book.shipping_fee}</span>
            </div>
            <div class="text-[11px] font-semibold text-[#5F7470] bg-[#E0F4F1]/50 px-3 py-1.5 rounded-xl border border-[#BCE3DF]">
              💡 ค่าหนังสือ ${book.salePrice}฿ + ค่าส่ง ${book.shipping_fee}฿ + ค่าธรรมเนียมระบบ (10 บาท/เล่ม) = <strong class="text-[#1F4E4B]">ยอดโอนสุทธิ ${Number(book.salePrice) + Number(book.shipping_fee) + 10}฿</strong>
            </div>
          </div>

          <div class="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E6E1D6] space-y-1.5 text-xs text-[#1F4E4B]">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span><strong>👤 ผู้ลงขาย:</strong> ${book.seller_name}</span>
              <span class="px-2.5 py-0.5 rounded-full bg-[#FDF2E2] border border-[#F4A261]/50 text-[#E9964A] font-extrabold">
                ⭐ ${sellerRating} (${sellerRevCount} รีวิว)
              </span>
            </div>
            <div><strong>✨ ระดับสภาพหนังสือ:</strong> <span class="text-[#26A69A] font-bold">${book.conditionGrade}</span></div>
            <div><strong>🔎 จุดตำหนิที่ผู้ขายแจ้ง:</strong> ${book.defectNote}</div>
            <div><strong>📦 เงื่อนไขการแพ็ก/จัดส่ง:</strong> ${book.packing_note || 'ผู้ขายจัดส่งตามมาตรฐานขนส่งเอกชน'}</div>
          </div>

          <div class="pt-2 flex flex-col sm:flex-row gap-2.5">
            ${isSoldOut ? `
              <button type="button" disabled class="w-full py-3 rounded-full bg-gray-200 text-gray-500 border border-gray-300 text-xs sm:text-sm font-bold text-center cursor-not-allowed">
                สินค้าหมดแล้ว
              </button>
            ` : (isOwnBook ? `
              <a href="profile.html?tab=listings" class="flex-1 py-3 px-4 rounded-full bg-[#26A69A] text-white text-xs font-bold text-center">
                จัดการประกาศขายของฉัน
              </a>
            ` : `
              <button onclick="reserveBookQueue('${book.book_id || book.id}')" class="flex-1 py-3 px-5 rounded-full bg-[#26A69A] hover:bg-[#219187] text-white text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer">
                📖 ${isReserved ? `กดต่อคิว (คิวที่ ${queueCount + 1})` : 'กดจองคิวหนังสือทันที'}
              </button>
              <button onclick="openChatForBook('${book.book_id || book.id}')" class="py-3 px-4 rounded-full bg-[#FDF2E2] hover:bg-[#fbe6c9] text-[#E9964A] text-xs font-bold transition cursor-pointer">
                💬 แชทพูดคุย
              </button>
            `)}
          </div>

          <div class="pt-1 text-right">
            <a href="product.html?id=${book.id}" class="text-xs font-semibold text-[#5F7470] hover:text-[#26A69A] underline">
              เปิดดูหน้ารายละเอียดหนังสือแบบเต็ม (รูปหลายมุม, รีวิวผู้ขาย &amp; ตารางคิว) →
            </a>
          </div>
        </div>
      </div>
    `;
  }

  document.getElementById('book-detail-backdrop')?.classList.remove('hidden');
  document.getElementById('book-detail-box')?.classList.remove('hidden');
}

function closeBookDetailModal() {
  document.getElementById('book-detail-backdrop')?.classList.add('hidden');
  document.getElementById('book-detail-box')?.classList.add('hidden');
}

async function handleCreateListingSubmit(e) {
  e.preventDefault();

  // บังคับอัปโหลดรูปภาพขั้นต่ำ 2 รูป (ปกหน้า-ปกหลัง) และสูงสุดไม่เกิน 10 รูป
  if (sellUploadedImages.length < 2) {
    showToast('⚠️ กฎการลงขาย: กรุณาอัปโหลดรูปภาพอย่างน้อย 2 รูป (รูปที่ 1: ปกหน้า, รูปที่ 2: ปกหลัง และรูปเพิ่มเติมอื่นๆ)', 'error');
    return;
  }
  if (sellUploadedImages.length > 10) {
    showToast('⚠️ กฎการลงขาย: อัปโหลดรูปภาพได้สูงสุดไม่เกิน 10 รูป กรุณาลบรูปส่วนเกินออก', 'error');
    return;
  }

  const title = document.getElementById('sell-title').value.trim();
  const author = document.getElementById('sell-author').value.trim();
  const publisher = document.getElementById('sell-publisher').value.trim();
  const [category, category_name] = document.getElementById('sell-category').value.split('|');
  const original_price = Number(document.getElementById('sell-orig-price').value);
  const price = Number(document.getElementById('sell-price').value);
  const shipping_fee = Number(document.getElementById('sell-shipping-fee').value);
  const condition_percent = Number(document.getElementById('sell-condition').value);
  const stock = Math.max(1, Number(document.getElementById('sell-stock-qty')?.value || 1));
  const packing_note = document.getElementById('sell-packing-note').value.trim();
  const defect_details = document.getElementById('sell-defect').value.trim();

  try {
    const token = getAuthToken();
    const res = await fetch('/api/books', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        title,
        author,
        publisher,
        category,
        category_name,
        original_price,
        price,
        shipping_fee,
        condition_percent,
        stock,
        images: sellUploadedImages,
        packing_note,
        defect_details
      })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'ลงขายหนังสือไม่สำเร็จ', 'error');
      return;
    }

    showToast(data.message, 'success');
    e.target.reset();
    sellUploadedImages = [];
    renderSellImagePreviews();
    closeSellBookModal();
    await window.fetchBooksFromAPI();

    if (window.location.pathname.includes('profile.html')) {
      window.location.href = 'profile.html?tab=listings';
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาดในการลงประกาศขายหนังสือ', 'error');
  }
}

// ============================================================================
// 5. ESCROW STEP 1 PAYMENT HELPER (โอนเงินเข้าบัญชีกลางแอดมิน)
// ============================================================================

async function promptEscrowStep1Payment(reservationId, bookId, bookTitle, bookPrice, shippingFee) {
  const escrowFee = 10; // ค่าบริการส่วนกลาง 10 บาท/เล่ม
  const total = Number(bookPrice) + Number(shippingFee) + escrowFee;
  const user = getCurrentUser();
  const slipRef = `SLIP-ESCROW-${Math.floor(100000 + Math.random() * 900000)} (โอนเข้าบัญชีกลางแอดมิน ฿${total})`;

  try {
    const token = getAuthToken();
    const res = await fetch('/api/escrow/step1-pay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        reservation_id: reservationId,
        book_id: bookId,
        slip_reference: slipRef,
        recipient_name: user ? user.username : 'สมาชิกผู้ซื้อ',
        recipient_phone: user ? user.phone_number : '089-000-0000',
        shipping_address: 'ที่อยู่จัดส่งตามข้อมูลสมาชิกในระบบ'
      })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'ไม่สามารถแจ้งโอนเงินได้', 'error');
      return;
    }
    showToast(data.message, 'success');
    if (activeChatRoomId) {
      await loadChatRoomMessages(activeChatRoomId);
    }
    window.dispatchEvent(new CustomEvent('escrowUpdated'));
  } catch (err) {
    showToast('เกิดข้อผิดพลาดในการแจ้งโอนเงิน', 'error');
  }
}

// ============================================================================
// 6. TOAST & INTERACTIVE BOOK CARD (Hover Zoom, Quick View Overlay, Wishlist Heart)
// ============================================================================

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icon = type === 'success' ? '✨' : (type === 'error' ? '⚠️' : 'ℹ️');
  const toast = document.createElement('div');
  toast.className = 'toast-item';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3400);
}

function createBookCardHTML(book) {
  const coverSrc = (Array.isArray(book.images) && book.images.length > 0)
    ? book.images[0]
    : window.generateBookCoverSVG(book, 'front');
  const stockCount = typeof book.stock === 'number' ? book.stock : 1;
  const isSoldOut = stockCount <= 0 || book.stock_status === 'Sold Out';
  const queueCount = book.activeQueueCount || 0;
  const isReserved = !isSoldOut && (book.stock_status === 'Reserved' || queueCount > 0);
  const wishlisted = isBookWishlisted(book.id);
  const sellerRating = Number(book.seller_rating || 4.9).toFixed(1);
  const sellerReviewsCount = book.seller_reviews_count !== undefined ? book.seller_reviews_count : 28;

  // ป้ายสถานะคิวสั้นๆ มุมซ้ายบน
  let queueBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#E0F4F1]/95 text-[#1F4E4B] shadow-2xs backdrop-blur-xs">🟢 คิวว่าง</span>`;
  if (isSoldOut) {
    queueBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-200/95 text-gray-600 shadow-2xs">SOLD OUT</span>`;
  } else if (isReserved) {
    queueBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FDF2E2]/95 text-[#E9964A] shadow-2xs backdrop-blur-xs">⏳ รอคิว ${queueCount} คน</span>`;
  }

  return `
    <article class="book-card rounded-3xl overflow-hidden flex flex-col justify-between group p-3.5">
      <!-- รูปปกหนังสือ + ปุ่มหัวใจ Wishlist มุมขวาบน + ปุ่ม Quick View โผล่เมื่อ Hover -->
      <div class="relative rounded-2xl bg-[#FAF7F2] aspect-[4/5] overflow-hidden cursor-pointer" onclick="openBookDetailModal('${book.id}')">
        <img src="${coverSrc}" alt="${book.title}" class="book-cover-img w-full h-full object-cover transition ${isSoldOut ? 'opacity-50 grayscale-[40%]' : ''}" loading="lazy" />

        <!-- มุมซ้ายบน: ป้ายสถานะคิวสั้นๆ -->
        <div class="absolute top-3 left-3 z-10 pointer-events-none">
          ${queueBadge}
        </div>

        <!-- มุมขวาบน: ปุ่มหัวใจ [🤍 เก็บไว้ดูภายหลัง (Wishlist)] -->
        <div class="absolute top-3 right-3 z-20">
          <button
            type="button"
            onclick="toggleBookWishlist(event, '${book.id}')"
            class="w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-xs transition cursor-pointer ${
              wishlisted
                ? 'bg-[#FDF2E2] border border-[#F4A261] text-[#E9964A]'
                : 'bg-white/90 hover:bg-[#FDF2E2] border border-[#E6E1D6] text-[#5F7470]'
            }"
            title="เก็บไว้ดูภายหลัง (Wishlist)"
          >
            ${wishlisted ? '🧡' : '🤍'}
          </button>
        </div>

        ${!isSoldOut ? `
          <!-- ปุ่ม [👁️ ดูตัวอย่างด่วน (Quick View)] โผล่ขึ้นมาบนปกเมื่อ Hover -->
          <div class="quick-view-overlay absolute inset-x-3 bottom-3 z-10 flex justify-center pointer-events-none">
            <span class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/95 backdrop-blur-xs border border-[#BCE3DF] text-[#1F4E4B] text-[11px] font-bold shadow-md">
              <span>👁️</span>
              <span>ดูตัวอย่างด่วน (Quick View)</span>
            </span>
          </div>
        ` : ''}

        ${isSoldOut ? `
          <div class="sold-out-ribbon absolute inset-0 bg-[#1F4E4B]/20 backdrop-blur-[1px] flex items-center justify-center z-10 pointer-events-none">
            <span class="px-4 py-2 rounded-full bg-white/95 border-2 border-[#E6E1D6] text-xs font-extrabold text-[#1F4E4B] shadow-md tracking-wide">
              SOLD OUT (ขายแล้ว)
            </span>
          </div>
        ` : ''}
      </div>

      <!-- ข้อมูลการ์ดแบบมินิมอล: ชื่อหนังสือ, ราคา, สภาพ, จำนวนคงเหลือ, ดาวผู้ขาย และปุ่มจองคิว -->
      <div class="pt-3.5 px-1 flex-1 flex flex-col justify-between">
        <div>
          <h3 class="font-bold text-[#1F4E4B] text-base leading-snug line-clamp-1 group-hover:text-[#26A69A] transition-colors cursor-pointer" onclick="openBookDetailModal('${book.id}')">
            ${book.title}
          </h3>
          <div class="mt-1 flex items-center justify-between">
            <div class="flex items-baseline gap-1.5">
              <span class="text-lg font-extrabold ${isSoldOut ? 'text-[#5F7470]' : 'text-[#26A69A]'}">฿${book.salePrice}</span>
              <span class="text-[11px] text-[#5F7470] line-through">฿${book.originalPrice}</span>
            </div>
            <span class="px-2 py-0.5 rounded-full bg-[#FAF7F2] border border-[#E6E1D6] text-[10px] font-semibold text-[#5F7470]">
              ${book.conditionGrade || `สภาพ ${book.conditionPercent}%`}
            </span>
          </div>

          <!-- จำนวนคงเหลือ & คะแนนรีวิวผู้ขาย -->
          <div class="mt-2 flex items-center justify-between gap-1 text-[11px]">
            <span class="px-2 py-0.5 rounded-full font-semibold ${isSoldOut ? 'bg-gray-100 text-gray-500 border border-gray-200' : 'bg-[#E0F4F1]/60 text-[#1F4E4B] border border-[#BCE3DF]'}">
              📦 จำนวนคงเหลือ ${isSoldOut ? 0 : stockCount} เล่ม
            </span>
            <a href="product.html?id=${book.id}#seller-reviews" onclick="event.stopPropagation()" class="text-[#E9964A] font-bold hover:underline" title="ดูรีวิวผู้ขาย">
              ⭐ ${sellerRating} (${sellerReviewsCount} รีวิว)
            </a>
          </div>
        </div>

        <div class="mt-3.5">
          ${isSoldOut ? `
            <button
              type="button"
              disabled
              class="w-full py-2.5 px-4 rounded-2xl text-xs font-bold bg-gray-200 text-gray-500 border border-gray-300 cursor-not-allowed"
            >
              สินค้าหมดแล้ว
            </button>
          ` : `
            <button
              type="button"
              onclick="openBookDetailModal('${book.id}')"
              class="w-full py-2.5 px-4 rounded-2xl text-xs font-bold transition cursor-pointer bg-[#26A69A] hover:bg-[#219187] text-white shadow-2xs"
            >
              ดูรายละเอียด / จองคิว
            </button>
          `}
        </div>
      </div>
    </article>
  `;
}

// ============================================================================
// 7. GLOBAL LAYOUT: CLEAN MINIMAL NAVBAR, FLOATING SEED SWITCHER, MODALS & FOOTER
// ============================================================================

function renderLayout() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const user = getCurrentUser();

  const headerContainer = document.getElementById('site-header');
  if (headerContainer) {
    const categoryOptionsHTML = (window.CATEGORIES || []).map(c =>
      `<option value="${c.id}|${c.name}">${c.icon} ${c.name}</option>`
    ).join('');

    headerContainer.innerHTML = `
      <!-- Clean Minimal Sticky Navbar -->
      <header class="sticky top-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E6E1D6]">
        <div class="max-w-6xl mx-auto px-4 sm:px-6">
          <div class="flex items-center justify-between h-18 py-3.5 gap-4">
            <!-- ฝั่งซ้าย: ไอคอนหนังสือสีส้ม + ชื่อเว็บ 'ร้านหนังสือมือสอง' -->
            <a href="index.html" class="flex items-center gap-2.5 group shrink-0">
              <div class="w-10 h-10 rounded-2xl bg-[#FDF2E2] border border-[#F4A261]/40 flex items-center justify-center text-xl shadow-2xs group-hover:scale-105 transition">
                <span style="color: #E9964A;">📖</span>
              </div>
              <span class="text-lg sm:text-xl font-extrabold tracking-tight text-[#1F4E4B]">ร้านหนังสือมือสอง</span>
            </a>

            <!-- ฝั่งขวา: เมนูสำคัญ + ปุ่มเข้าสู่ระบบทรงแคปซูลสีเขียวมิ้นต์ (#26A69A) -->
            <div class="flex items-center gap-2 sm:gap-5">
              <nav class="hidden md:flex items-center gap-4 text-sm font-medium text-[#5F7470]">
                <a href="index.html" class="transition hover:text-[#26A69A] ${currentPath === 'index.html' ? 'text-[#26A69A] font-bold' : ''}">
                  หน้าแรก
                </a>
                <button type="button" onclick="openSellBookModal()" class="transition hover:text-[#26A69A] cursor-pointer">
                  + ลงขายหนังสือ
                </button>
                <a href="profile.html?tab=reservations" class="transition hover:text-[#26A69A] ${currentPath === 'profile.html' ? 'text-[#26A69A] font-bold' : ''}">
                  คิวจองของฉัน
                </a>
                <a href="profile.html?tab=dashboard" class="transition hover:text-[#26A69A]">
                  📊 แดชบอร์ดสถิติ
                </a>
                ${user && user.role === 'Admin' ? `
                  <a href="admin.html" class="transition hover:text-[#26A69A] ${currentPath === 'admin.html' ? 'text-[#26A69A] font-bold' : ''}">
                    หลังบ้านแอดมิน
                  </a>
                ` : ''}
              </nav>

              ${user ? `
                <div class="flex items-center gap-2">
                  <a href="${user.role === 'Admin' ? 'admin.html' : 'profile.html'}" class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#26A69A] hover:bg-[#219187] text-white text-xs sm:text-sm font-bold shadow-2xs transition">
                    <span>👤 ${user.username.split(' ')[0]}</span>
                  </a>
                  <button onclick="logoutUser()" class="px-3 py-2 rounded-full bg-white border border-[#E6E1D6] hover:border-[#E9964A] text-[#5F7470] hover:text-[#E9964A] text-xs font-semibold transition cursor-pointer" title="ออกจากระบบ">
                    ออก
                  </button>
                </div>
              ` : `
                <a href="login.html" class="inline-flex items-center px-5 py-2.5 rounded-full bg-[#26A69A] hover:bg-[#219187] text-white text-xs sm:text-sm font-bold shadow-2xs transition">
                  เข้าสู่ระบบ
                </a>
              `}

              <button onclick="toggleMobileMenu()" class="md:hidden p-2 rounded-xl bg-white border border-[#E6E1D6] text-[#1F4E4B]" aria-label="เมนูมือถือ">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Mobile Menu -->
        <div id="mobile-nav-menu" class="hidden md:hidden bg-[#FAF7F2] border-t border-[#E6E1D6] px-4 pt-3 pb-4 space-y-2">
          <a href="index.html" class="block px-3 py-2 rounded-xl font-semibold text-[#1F4E4B] hover:bg-[#E0F4F1]/60">หน้าแรก</a>
          <button onclick="openSellBookModal()" class="w-full text-left px-3 py-2 rounded-xl font-semibold text-[#1F4E4B] hover:bg-[#E0F4F1]/60">+ ลงขายหนังสือ</button>
          <a href="profile.html?tab=reservations" class="block px-3 py-2 rounded-xl font-semibold text-[#1F4E4B] hover:bg-[#E0F4F1]/60">คิวจองของฉัน</a>
          <a href="profile.html?tab=dashboard" class="block px-3 py-2 rounded-xl font-semibold text-[#1F4E4B] hover:bg-[#E0F4F1]/60">📊 แดชบอร์ดสถิติ</a>
          ${user && user.role === 'Admin' ? `<a href="admin.html" class="block px-3 py-2 rounded-xl font-semibold text-[#26A69A]">หลังบ้านแอดมิน</a>` : ''}
        </div>
      </header>

      <!-- ปุ่มกลมเล็กๆ มุมขวาล่างของจอ (⚙️ สลับบัญชีทดสอบ) -->
      <div class="fixed bottom-5 right-5 z-50 flex flex-col items-end">
        <div id="seed-switcher-popover" class="hidden mb-2.5 w-72 rounded-3xl bg-white border border-[#E6E1D6] shadow-xl p-4 space-y-2.5 text-xs">
          <div class="flex items-center justify-between border-b border-[#E6E1D6] pb-2">
            <span class="font-bold text-[#1F4E4B]">⚙️ สลับบัญชีทดสอบ (Seed Data)</span>
            <button onclick="toggleSeedSwitcherPopover()" class="text-[#5F7470] hover:text-[#1F4E4B] cursor-pointer">✕</button>
          </div>
          <p class="text-[11px] text-[#5F7470]">คลิกเพื่อเข้าสู่ระบบด้วยบัญชีตัวอย่างได้ทันที:</p>
          <button onclick="quickDemoLogin('somchai@email.com', 'member1234')" class="w-full text-left px-3.5 py-2.5 rounded-2xl bg-[#E0F4F1]/70 hover:bg-[#E0F4F1] text-[#1F4E4B] font-bold transition cursor-pointer">
            👤 คุณสมชาย (Member ซื้อ+ขาย)
          </button>
          <button onclick="quickDemoLogin('pimchanok@email.com', 'member1234')" class="w-full text-left px-3.5 py-2.5 rounded-2xl bg-[#FDF2E2]/80 hover:bg-[#FDF2E2] text-[#1F4E4B] font-bold transition cursor-pointer">
            👤 คุณพิมพ์ชนก (Member ซื้อ+ขาย)
          </button>
          <button onclick="quickDemoLogin('admin@007marketplace.com', 'admin1234')" class="w-full text-left px-3.5 py-2.5 rounded-2xl bg-[#26A69A] hover:bg-[#219187] text-white font-bold transition cursor-pointer">
            🛡️ แอดมินบัญชีกลาง (Admin Escrow)
          </button>
        </div>

        <button
          type="button"
          onclick="toggleSeedSwitcherPopover()"
          class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white hover:bg-[#E0F4F1] text-[#1F4E4B] border border-[#E6E1D6] shadow-md text-xs font-bold transition cursor-pointer"
          title="สลับบัญชีทดสอบ"
        >
          <span>⚙️</span>
          <span>สลับบัญชีทดสอบ</span>
        </button>
      </div>

      <!-- MODAL 1: กติกาและข้อดีของระบบบัญชีกลาง (Escrow Rules Modal) -->
      <div id="escrow-rules-backdrop" onclick="closeEscrowRulesModal()" class="hidden fixed inset-0 bg-[#1F4E4B]/40 backdrop-blur-xs z-50"></div>
      <div id="escrow-rules-box" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div class="bg-white rounded-3xl border border-[#E6E1D6] shadow-2xl max-w-xl w-full p-6 sm:p-8 pointer-events-auto max-h-[90vh] overflow-y-auto space-y-5">
          <div class="flex items-center justify-between border-b border-[#E6E1D6] pb-4">
            <div>
              <span class="px-3 py-1 rounded-full bg-[#E0F4F1] text-[#26A69A] text-xs font-bold">ESCROW PROTECTION</span>
              <h2 class="text-xl font-extrabold text-[#1F4E4B] mt-1">🛡️ ซื้อขายปลอดภัย (กติกาบัญชีกลาง)</h2>
            </div>
            <button onclick="closeEscrowRulesModal()" class="w-8 h-8 rounded-full bg-[#FAF7F2] hover:bg-[#E0F4F1] text-[#1F4E4B] cursor-pointer">✕</button>
          </div>

          <!-- อัตราค่าธรรมเนียมระบบ 10 บาท/เล่ม -->
          <div class="p-4 rounded-2xl bg-[#E0F4F1]/65 border border-[#BCE3DF] flex items-center justify-between gap-3">
            <div class="space-y-0.5">
              <div class="text-xs font-bold text-[#26A69A]">ค่าธรรมเนียมระบบ (10 บาท/เล่ม)</div>
              <div class="text-sm font-extrabold text-[#1F4E4B]">ค่าธรรมเนียมการดูแลระบบ 10฿/เล่ม <span class="text-xs font-medium text-[#5F7470]">(ระบบคำนวณรวมในยอดโอนให้อัตโนมัติ)</span></div>
            </div>
            <span class="px-3 py-1.5 rounded-full bg-white text-[#26A69A] font-extrabold text-xs border border-[#BCE3DF] shrink-0">+10฿ / เล่ม</span>
          </div>

          <!-- ทำไมต้องผ่านบัญชีกลาง? (ข้อดี 3 ข้อสั้นๆ) -->
          <div class="space-y-2.5">
            <h3 class="text-sm font-extrabold text-[#1F4E4B]">✨ ทำไมต้องผ่านบัญชีกลาง?</h3>
            <div class="space-y-2.5 text-xs">
              <div class="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E6E1D6] flex items-start gap-3">
                <span class="w-6 h-6 rounded-full bg-[#26A69A] text-white font-bold flex items-center justify-center shrink-0">1</span>
                <div>
                  <div class="font-bold text-[#1F4E4B]">ผู้ซื้อปลอดภัย 100%</div>
                  <p class="text-[#5F7470] mt-0.5 leading-relaxed">เงินของคุณจะถูกพักไว้ที่แอดมินส่วนกลาง จนกว่าคุณจะได้รับหนังสือและตรวจสอบสภาพว่าตรงปก (ภายใน 24 ชม.)</p>
                </div>
              </div>
              <div class="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E6E1D6] flex items-start gap-3">
                <span class="w-6 h-6 rounded-full bg-[#E9964A] text-white font-bold flex items-center justify-center shrink-0">2</span>
                <div>
                  <div class="font-bold text-[#1F4E4B]">ผู้ขายมั่นใจได้เงินชัวร์</div>
                  <p class="text-[#5F7470] mt-0.5 leading-relaxed">เมื่อคิวจองโอนเงินเข้าบัญชีกลางแล้ว แอดมินจะแจ้งให้จัดส่งของทันที ไม่ต้องกลัวส่งของฟรีหรือโดนโกง (รับเต็มจำนวน ค่าหนังสือ + ค่าส่ง)</p>
                </div>
              </div>
              <div class="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E6E1D6] flex items-start gap-3">
                <span class="w-6 h-6 rounded-full bg-[#26A69A] text-white font-bold flex items-center justify-center shrink-0">3</span>
                <div>
                  <div class="font-bold text-[#1F4E4B]">มีแอดมินช่วยดูแลตลอดรายการ</div>
                  <p class="text-[#5F7470] mt-0.5 leading-relaxed">หากหนังสือมีปัญหาหรือส่งไม่ตรงตามที่ตกลง แอดมินส่วนกลางพร้อมช่วยไกล่เกลี่ยและคืนเงินให้ทันที</p>
                </div>
              </div>
            </div>
          </div>

          <!-- กติกาเวลาจัดส่ง 1-2 วัน (48 ชั่วโมง) -->
          <div class="p-4 rounded-2xl bg-[#FDF2E2]/80 border border-[#F4A261]/60 text-xs text-[#1F4E4B] flex items-start gap-2.5">
            <span class="text-base leading-none">⏰</span>
            <p class="font-semibold leading-relaxed">
              หลังชำระเงินผ่านบัญชีกลาง ผู้ขายต้องจัดส่งหนังสือและแจ้งเลขพัสดุภายใน 1-2 วัน มิฉะนั้นผู้ซื้อสามารถขอรับเงินคืนจากบัญชีกลางได้เต็มจำนวน
            </p>
          </div>

          <div class="flex justify-end pt-1">
            <button onclick="closeEscrowRulesModal()" class="px-6 py-2.5 rounded-full bg-[#26A69A] hover:bg-[#219187] text-white text-xs font-bold cursor-pointer">
              เข้าใจกติกาแล้ว
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL 2: ดูตัวอย่างด่วน (Quick View) & จองคิว -->
      <div id="book-detail-backdrop" onclick="closeBookDetailModal()" class="hidden fixed inset-0 bg-[#1F4E4B]/40 backdrop-blur-xs z-50"></div>
      <div id="book-detail-box" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div class="bg-white rounded-3xl border border-[#E6E1D6] shadow-2xl max-w-2xl w-full p-6 sm:p-7 pointer-events-auto max-h-[90vh] overflow-y-auto space-y-4">
          <div class="flex items-center justify-between border-b border-[#E6E1D6] pb-3">
            <span class="text-sm font-bold text-[#1F4E4B]">👁️ ดูตัวอย่างด่วน (Quick View) &amp; จองคิวหนังสือ</span>
            <button onclick="closeBookDetailModal()" class="w-8 h-8 rounded-full bg-[#FAF7F2] hover:bg-[#E0F4F1] text-[#1F4E4B] cursor-pointer">✕</button>
          </div>
          <div id="book-detail-modal-content"></div>
        </div>
      </div>

      <!-- MODAL 3: ลงขายหนังสือของตัวเอง (บังคับอัปโหลด 2-10 รูป + จำนวนเล่ม Stock Quantity) -->
      <div id="sell-modal-backdrop" onclick="closeSellBookModal()" class="hidden fixed inset-0 bg-[#1F4E4B]/40 backdrop-blur-xs z-50"></div>
      <div id="sell-modal-box" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div class="bg-white rounded-3xl border border-[#E6E1D6] shadow-2xl max-w-2xl w-full p-6 sm:p-8 pointer-events-auto max-h-[92vh] overflow-y-auto space-y-5">
          <div class="flex items-center justify-between border-b border-[#E6E1D6] pb-4">
            <div>
              <span class="px-3 py-0.5 rounded-full bg-[#FDF2E2] text-[#E9964A] text-xs font-bold">SELL YOUR BOOK</span>
              <h2 class="text-xl font-extrabold text-[#1F4E4B] mt-1">🏷️ ลงขายหนังสือมือสองของคุณ</h2>
              <p class="text-xs text-[#5F7470]">กำหนดราคาขาย จำนวนสต็อก ค่าจัดส่ง และอัปโหลดรูปสภาพหนังสือจริง (ขั้นต่ำ 2 รูป สูงสุด 10 รูป)</p>
            </div>
            <button onclick="closeSellBookModal()" class="w-8 h-8 rounded-full bg-[#FAF7F2] text-[#5F7470] cursor-pointer">✕</button>
          </div>

          <form onsubmit="handleCreateListingSubmit(event)" class="space-y-4 text-xs sm:text-sm">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block font-bold text-[#1F4E4B] mb-1">ชื่อหนังสือ *</label>
                <input required type="text" id="sell-title" placeholder="เช่น เซเปียนส์ ประวัติย่อมนุษยชาติ" class="w-full rounded-2xl border border-[#E6E1D6] bg-[#FAF7F2] px-3.5 py-2.5 focus:outline-none focus:border-[#26A69A]" />
              </div>
              <div>
                <label class="block font-bold text-[#1F4E4B] mb-1">ชื่อผู้แต่ง *</label>
                <input required type="text" id="sell-author" placeholder="เช่น ยูวัล โนอาห์ แฮรารี" class="w-full rounded-2xl border border-[#E6E1D6] bg-[#FAF7F2] px-3.5 py-2.5 focus:outline-none focus:border-[#26A69A]" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-bold text-[#1F4E4B] mb-1">หมวดหมู่หนังสือ *</label>
                <select id="sell-category" class="w-full rounded-2xl border border-[#E6E1D6] bg-[#FAF7F2] px-3.5 py-2.5 font-semibold">
                  ${categoryOptionsHTML}
                </select>
              </div>
              <div>
                <label class="block font-bold text-[#1F4E4B] mb-1">สำนักพิมพ์</label>
                <input type="text" id="sell-publisher" placeholder="เช่น ยิปซี / แพรวสำนักพิมพ์" class="w-full rounded-2xl border border-[#E6E1D6] bg-[#FAF7F2] px-3.5 py-2.5" />
              </div>
              <div>
                <label class="block font-bold text-[#26A69A] mb-1">จำนวนเล่มที่มี (Stock Quantity) *</label>
                <input required type="number" id="sell-stock-qty" value="1" min="1" max="99" class="w-full rounded-2xl border-2 border-[#26A69A] bg-[#E0F4F1]/40 px-3.5 py-2.5 font-extrabold text-[#1F4E4B]" />
              </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label class="block font-bold text-[#1F4E4B] mb-1">ราคาปก (฿)</label>
                <input required type="number" id="sell-orig-price" value="350" class="w-full rounded-2xl border border-[#E6E1D6] bg-[#FAF7F2] px-3 py-2.5" />
              </div>
              <div>
                <label class="block font-bold text-[#26A69A] mb-1">ราคาที่ขาย (฿) *</label>
                <input required type="number" id="sell-price" placeholder="เช่น 220" class="w-full rounded-2xl border-2 border-[#26A69A] bg-white px-3 py-2.5 font-extrabold" />
              </div>
              <div>
                <label class="block font-bold text-[#E9964A] mb-1">ค่าส่ง (฿) *</label>
                <input required type="number" id="sell-shipping-fee" value="35" class="w-full rounded-2xl border border-[#E9964A] bg-white px-3 py-2.5 font-extrabold" />
              </div>
              <div>
                <label class="block font-bold text-[#1F4E4B] mb-1">สภาพ (%) *</label>
                <input required type="number" id="sell-condition" value="92" min="50" max="100" class="w-full rounded-2xl border border-[#E6E1D6] bg-[#FAF7F2] px-3 py-2.5" />
              </div>
            </div>

            <!-- ระบบอัปโหลดรูปภาพหลายรูป (ขั้นต่ำ 2 รูป: ปกหน้า-ปกหลัง, สูงสุด 10 รูป) พร้อม Preview -->
            <div class="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E6E1D6] space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <label class="block font-extrabold text-[#1F4E4B]">📸 รูปถ่ายสภาพหนังสือจริง (บังคับขั้นต่ำ 2 รูป - สูงสุด 10 รูป) *</label>
                  <p class="text-[11px] text-[#5F7470] mt-0.5">
                    คำแนะนำ: <strong class="text-[#1F4E4B]">รูปที่ 1: ปกหน้า, รูปที่ 2: ปกหลัง และรูปเพิ่มเติมอื่นๆ เช่น สันหนังสือหรือจุดตำหนิ</strong>
                  </p>
                </div>
                <span id="sell-images-count-badge" class="px-2.5 py-1 rounded-full bg-[#FDF2E2] text-[#E9964A] text-[11px] font-bold">
                  อัปโหลดแล้ว 0/10 รูป (ต้องมีอย่างน้อย 2 รูป)
                </span>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  id="sell-images-input"
                  accept="image/*"
                  multiple
                  onchange="handleSellImagesChange(event)"
                  class="hidden"
                />
                <button
                  type="button"
                  onclick="document.getElementById('sell-images-input').click()"
                  class="px-4 py-2 rounded-full bg-[#26A69A] hover:bg-[#219187] text-white text-xs font-bold shadow-2xs cursor-pointer"
                >
                  📷 เลือกรูปภาพจากเครื่อง (เลือกได้หลายรูป)
                </button>
                <button
                  type="button"
                  onclick="addDemoFrontBackImages()"
                  class="px-3.5 py-2 rounded-full bg-white hover:bg-[#E0F4F1] text-[#1F4E4B] border border-[#BCE3DF] text-xs font-bold cursor-pointer"
                >
                  ✨ ใส่รูปตัวอย่าง (ปกหน้า + ปกหลัง) อัตโนมัติ
                </button>
              </div>

              <div id="sell-images-preview-grid" class="grid grid-cols-2 sm:grid-cols-5 gap-2.5"></div>
            </div>

            <div>
              <label class="block font-bold text-[#1F4E4B] mb-1">เงื่อนไขการจัดส่งและการแพ็กของคุณ *</label>
              <input required type="text" id="sell-packing-note" placeholder="เช่น ส่ง Flash Express ทุกวัน จ.-ศ. แพ็กใส่ซองกันกระแทก" class="w-full rounded-2xl border border-[#E6E1D6] bg-[#FAF7F2] px-3.5 py-2.5" />
            </div>

            <div>
              <label class="block font-bold text-[#1F4E4B] mb-1">รายละเอียดตำหนิหนังสือตามจริง *</label>
              <textarea required id="sell-defect" rows="2" placeholder="ระบุจุดตำหนิให้ผู้ซื้อทราบ เช่น มุมปกล่างมีรอยพับเล็กน้อย..." class="w-full rounded-2xl border border-[#E6E1D6] bg-[#FAF7F2] px-3.5 py-2.5"></textarea>
            </div>

            <div class="pt-2 flex justify-end gap-2">
              <button type="button" onclick="closeSellBookModal()" class="px-5 py-2.5 rounded-full border border-[#E6E1D6] font-bold text-[#5F7470] cursor-pointer">ยกเลิก</button>
              <button type="submit" class="px-6 py-2.5 rounded-full bg-[#26A69A] hover:bg-[#219187] text-white font-bold shadow-xs cursor-pointer">
                ลงประกาศขายทันที
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- MODAL 4: ห้องแชทรายการจอง + บอท AI ดูแลอัตโนมัติ -->
      <div id="chat-modal-backdrop" onclick="closeThreePartyChatModal()" class="hidden fixed inset-0 bg-[#1F4E4B]/40 backdrop-blur-xs z-50"></div>
      <div id="chat-modal-box" class="hidden fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pointer-events-none">
        <div class="bg-[#FAF7F2] rounded-3xl border border-[#E6E1D6] shadow-2xl max-w-3xl w-full h-[84vh] flex flex-col overflow-hidden pointer-events-auto">
          <div class="bg-white border-b border-[#E6E1D6] p-4 sm:p-5 flex items-start justify-between gap-4">
            <div class="space-y-1.5">
              <h3 id="chat-room-title" class="text-base sm:text-lg font-extrabold text-[#1F4E4B]">💬 ห้องแชทรายการจอง</h3>
              <div id="chat-room-members" class="flex flex-wrap gap-1.5"></div>
            </div>
            <button onclick="closeThreePartyChatModal()" class="w-8 h-8 rounded-full bg-[#FAF7F2] hover:bg-[#E0F4F1] text-[#1F4E4B] cursor-pointer">✕</button>
          </div>

          <div id="chat-escrow-status-bar" class="bg-[#FDF2E2]/70 border-b border-[#E6E1D6] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2"></div>
          <div id="chat-messages-list" class="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF7F2]"></div>

          <div class="px-4 py-2 bg-white border-t border-[#E6E1D6] flex flex-wrap items-center gap-1.5 text-[11px]">
            <span class="font-bold text-[#26A69A]">🤖 ถามด่วน:</span>
            <button type="button" onclick="sendQuickChatQuestion('ขอดูรูปสภาพหนังสือและจุดตำหนิเพิ่มเติมหน่อยครับ')" class="px-3 py-1 rounded-full bg-[#E0F4F1]/70 hover:bg-[#E0F4F1] text-[#1F4E4B] font-semibold cursor-pointer">
              ขอดูรูปตำหนิเพิ่ม
            </button>
            <button type="button" onclick="sendQuickChatQuestion('ค่าส่งเท่าไหร่ และผู้ขายจัดส่งขนส่งอะไรครับ?')" class="px-3 py-1 rounded-full bg-[#E0F4F1]/70 hover:bg-[#E0F4F1] text-[#1F4E4B] font-semibold cursor-pointer">
              เช็กค่าส่งของผู้ขาย
            </button>
            <button type="button" onclick="sendQuickChatQuestion('ขอเลขบัญชีกลางของแอดมินสำหรับโอนเงินหน่อยครับ')" class="px-3 py-1 rounded-full bg-[#FDF2E2] hover:bg-[#fbe6c9] text-[#E9964A] font-semibold cursor-pointer">
              ขั้นตอนโอนเข้าบัญชีกลาง
            </button>
          </div>

          <form id="chat-message-form" onsubmit="handleSendChatMessage(event)" class="p-3 sm:p-4 bg-white border-t border-[#E6E1D6] flex gap-2">
            <input
              type="text"
              id="chat-message-input"
              placeholder="พิมพ์ข้อความคุยกับผู้ขาย / ผู้ซื้อ / แอดมินตัวกลาง..."
              class="flex-1 rounded-full border border-[#E6E1D6] bg-[#FAF7F2] px-4 py-2.5 text-xs sm:text-sm focus:border-[#26A69A] focus:outline-none"
            />
            <button type="submit" class="px-5 py-2.5 rounded-full bg-[#26A69A] hover:bg-[#219187] text-white font-bold text-xs sm:text-sm shadow-2xs cursor-pointer">
              ส่งข้อความ
            </button>
          </form>
        </div>
      </div>
    `;
  }

  const footerContainer = document.getElementById('site-footer');
  if (footerContainer) {
    footerContainer.innerHTML = `
      <footer class="bg-white border-t border-[#E6E1D6] text-[#5F7470] mt-16">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-2xl bg-[#FDF2E2] flex items-center justify-center text-lg">📖</div>
              <div>
                <div class="text-sm font-extrabold text-[#1F4E4B]">ร้านหนังสือมือสอง (Secondhand Bookstore)</div>
                <p class="text-xs text-[#5F7470]">ตลาดกลางซื้อ-ขายหนังสือมือสองคุณภาพ จองคิวเป็นธรรม ปลอดภัยผ่านบัญชีกลาง (ค่าธรรมเนียมการดูแลระบบ 10฿/เล่ม)</p>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-4 text-xs font-semibold text-[#5F7470]">
              <a href="index.html" class="hover:text-[#26A69A]">หน้าแรก</a>
              <button onclick="openSellBookModal()" class="hover:text-[#26A69A] cursor-pointer">+ ลงขายหนังสือ</button>
              <a href="profile.html?tab=reservations" class="hover:text-[#26A69A]">คิวจองของฉัน</a>
              <a href="profile.html?tab=dashboard" class="hover:text-[#26A69A]">📊 แดชบอร์ดสถิติ</a>
              <button onclick="openEscrowRulesModal()" class="hover:text-[#26A69A] cursor-pointer">กติกาบัญชีกลาง</button>
            </div>
          </div>
        </div>
      </footer>
    `;
  }
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobile-nav-menu');
  if (menu) menu.classList.toggle('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  renderLayout();
  syncAuthWithServer();
});

window.addEventListener('booksLoaded', () => {
  renderLayout();
});
