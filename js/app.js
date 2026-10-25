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

// Helper: สร้างป้ายสัญลักษณ์ร้านค้า (Merchant Badge) และสัญลักษณ์ดาวเตือนผู้ขายส่งของล่าช้า (Strike Star ⚠️⭐)
function renderSellerBadgeHTML(badgeLabel, boostLevel = 0) {
  if (!badgeLabel) {
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full bg-[#FAF7F2] border border-[#E6E1D6] text-[#5F7470] text-[10px] font-semibold">🌱 ผู้ขายทั่วไป</span>`;
  }
  let styleClass = 'bg-[#E0F4F1] border-[#BCE3DF] text-[#1F4E4B]';
  if (boostLevel === 4 || badgeLabel.includes('VIP')) {
    styleClass = 'bg-gradient-to-r from-[#FDF2E2] to-[#E0F4F1] border-[#E9964A] text-[#1F4E4B] shadow-2xs';
  } else if (boostLevel === 3 || badgeLabel.includes('300+')) {
    styleClass = 'bg-[#FDF2E2] border-[#F4A261] text-[#E9964A]';
  } else if (boostLevel === 2 || badgeLabel.includes('100+')) {
    styleClass = 'bg-[#E0F4F1] border-[#26A69A]/50 text-[#26A69A]';
  }
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold ${styleClass}">${badgeLabel}</span>`;
}

function renderSellerStrikeHTML(strikeCount = 0) {
  const cnt = Number(strikeCount || 0);
  if (cnt <= 0) return '';
  const stars = '⚠️⭐'.repeat(Math.min(3, cnt));
  return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-extrabold" title="ผู้ขายมีประวัติส่งของล่าช้าเกิน 48 ชม. (${cnt}/3 ดวงในเดือนนี้)">${stars} (${cnt}/3)</span>`;
}
window.renderSellerBadgeHTML = renderSellerBadgeHTML;
window.renderSellerStrikeHTML = renderSellerStrikeHTML;

let activeChatOrderObj = null;
let activeChatBookTitle = '';

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
    activeChatOrderObj = order || null;
    activeChatBookTitle = room ? room.book_title : '';

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
        <span class="px-2.5 py-0.5 rounded-full bg-[#E0F4F1]/60 text-[#26A69A] text-[11px] font-bold">🤖 AI Chatbot ดูแลครบ 6 ขั้นตอน</span>
      `;
    }

    const escrowFee = 10; // ค่าบริการส่วนกลาง 10 บาท/เล่ม
    const totalAmount = Number(room.book_price) + Number(room.shipping_fee) + escrowFee;
    const currentUser = getCurrentUser();
    const isBuyer = currentUser && currentUser.id === room.buyer_id;

    if (escrowBannerEl) {
      const safeTitle = (room.book_title || '').replace(/'/g, "\\'");
      const disputeBtnHTML = `
        <button
          type="button"
          onclick="openReturnDisputeModal({ orderId: ${order ? order.id : 'null'}, roomId: ${room.id}, bookTitle: '${safeTitle}' })"
          class="px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer transition"
        >
          🔄 แจ้งปัญหา / ขอคืนสินค้า (Request Return / Call Admin)
        </button>
      `;

      let actionHTML = '';
      if (order) {
        const isFrozen = order.escrow_frozen || order.status === 'Disputed - Return Requested' || (order.payout_status && order.payout_status.includes('Frozen'));
        actionHTML = `
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-3 py-1 rounded-full ${isFrozen ? 'bg-rose-600 text-white' : 'bg-[#26A69A] text-white'} text-xs font-bold">
              ${isFrozen ? '❄️ ระงับการโอนเงินชั่วคราว (Dispute Pending Admin)' : `สถานะ Escrow: ${order.status}`} (#${order.order_code})
            </span>
            ${order.status !== 'Completed & Released' && order.status !== 'Returned & Refunded' ? disputeBtnHTML : ''}
            <a href="profile.html?tab=orders" class="px-3 py-1 rounded-full bg-white border border-[#26A69A] text-[#26A69A] text-xs font-bold hover:bg-[#E0F4F1]">ดูรายละเอียดบิล →</a>
          </div>
        `;
      } else if (reservation && reservation.status === 'Active' && isBuyer) {
        actionHTML = `
          <div class="flex flex-wrap items-center gap-2">
            <button onclick="promptEscrowStep1Payment(${reservation.id}, ${room.book_id}, '${safeTitle}', ${room.book_price}, ${room.shipping_fee})" class="px-4 py-1.5 rounded-full bg-[#26A69A] hover:bg-[#219187] text-white text-xs font-bold shadow-xs cursor-pointer">
              💳 แจ้งโอนเงินเข้าบัญชีกลาง (฿${totalAmount})
            </button>
            ${disputeBtnHTML}
          </div>
        `;
      } else {
        actionHTML = `
          <div class="flex flex-wrap items-center gap-2">
            ${reservation ? `<span class="px-3 py-1 rounded-full bg-[#FDF2E2] text-[#E9964A] text-xs font-bold">ลำดับคิวที่ ${reservation.queue_no} (${reservation.status})</span>` : ''}
            ${disputeBtnHTML}
          </div>
        `;
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
          const isUrgent = (m.message || '').includes('🚨') || (m.message || '').includes('❄️');
          return `
            <div class="p-3.5 rounded-2xl ${isUrgent ? 'bg-rose-50 border border-rose-200 text-rose-950' : 'bg-[#E0F4F1]/60 border border-[#BCE3DF] text-[#1F4E4B]'} text-xs space-y-1">
              <div class="flex items-center justify-between">
                <span class="font-bold ${isUrgent ? 'text-rose-700' : 'text-[#26A69A]'}">🤖 ${m.sender_name}</span>
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

        const isImageAttachment = m.attachment_note && String(m.attachment_note).startsWith('data:image/');
        const attachmentHTML = m.attachment_note
          ? (isImageAttachment
              ? `<div class="mt-2 pt-2 border-t ${isMe ? 'border-white/25' : 'border-[#E6E1D6]'}">
                   <div class="text-[11px] font-bold mb-1">📸 รูปหลักฐานที่แนบ:</div>
                   <img src="${m.attachment_note}" alt="หลักฐาน" class="rounded-xl max-h-44 border border-white/40 object-contain bg-white" />
                 </div>`
              : `<div class="mt-1.5 pt-1.5 border-t ${isMe ? 'border-white/25' : 'border-[#E6E1D6]'} text-[11px] font-mono">📎 หลักฐาน/สลิป: ${m.attachment_note}</div>`)
          : '';

        return `
          <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
            <div class="flex items-center gap-1.5 mb-1">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${roleBadge}">${m.sender_role}</span>
              <span class="text-xs font-bold text-[#1F4E4B]">${m.sender_name}</span>
              <span class="text-[10px] text-[#5F7470]">${new Date(m.created_at).toLocaleTimeString('th-TH')}</span>
            </div>
            <div class="max-w-lg rounded-2xl px-4 py-2.5 text-xs sm:text-sm ${isMe ? 'bg-[#26A69A] text-white' : 'bg-white border border-[#E6E1D6] text-[#1F4E4B]'} shadow-2xs">
              <p class="whitespace-pre-line leading-relaxed">${m.message}</p>
              ${attachmentHTML}
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

function isUserSellingBanned(user) {
  if (!user) return false;
  if (user.is_selling_banned) return true;
  if (user.seller_banned_until && new Date(user.seller_banned_until).getTime() > Date.now()) {
    return true;
  }
  return false;
}
window.isUserSellingBanned = isUserSellingBanned;

function openSellerBanAlertModal(user) {
  const banDateStr = user && user.seller_banned_until
    ? new Date(user.seller_banned_until).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'อีก 6 เดือนข้างหน้า';
  const strikeCnt = user ? (user.strike_count || 3) : 3;
  const infoEl = document.getElementById('seller-ban-alert-details');
  if (infoEl) {
    infoEl.innerHTML = `
      <div class="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2 text-xs text-rose-950">
        <div class="font-extrabold text-sm text-rose-700 flex items-center gap-1.5">
          <span>⚠️⭐x${strikeCnt}</span>
          <span>สถานะบัญชี: ระงับสิทธิ์การลงขายชั่วคราวเป็นเวลา 6 เดือน</span>
        </div>
        <p class="leading-relaxed">
          บัญชี <strong>${user ? user.username : ''}</strong> ได้รับสัญลักษณ์ดาวเตือนส่งของล่าช้า (⚠️⭐) ครบ <strong>${strikeCnt} ดวงภายในเดือนเดียวกัน</strong> เนื่องจากไม่จัดส่งหนังสือและไม่แจ้งเลขพัสดุภายในเวลา 48 ชั่วโมงหลังผู้ซื้อชำระเงิน
        </p>
        <div class="p-3 rounded-xl bg-white border border-rose-200 font-bold text-rose-800">
          📅 วันสิ้นสุดการระงับสิทธิ์ลงขาย: <span class="underline">${banDateStr}</span>
        </div>
        <div class="p-3 rounded-xl bg-[#E0F4F1]/70 border border-[#BCE3DF] text-[#1F4E4B]">
          ✅ <strong>สิทธิ์การซื้อยังใช้งานได้ตามปกติ:</strong> คุณยังสามารถล็อกอินเข้าใช้งาน กดจองคิว และสั่งซื้อหนังสือในฐานะ <strong>ผู้ซื้อ (Buyer)</strong> ได้ครบทุกฟังก์ชันครับ!
        </div>
      </div>
    `;
  }
  document.getElementById('seller-ban-alert-backdrop')?.classList.remove('hidden');
  document.getElementById('seller-ban-alert-box')?.classList.remove('hidden');
}

function closeSellerBanAlertModal() {
  document.getElementById('seller-ban-alert-backdrop')?.classList.add('hidden');
  document.getElementById('seller-ban-alert-box')?.classList.add('hidden');
}

async function resetMySellerStrikesFromModal() {
  try {
    const token = getAuthToken();
    const res = await fetch('/api/users/clear-strikes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'ไม่สามารถรีเซ็ตดาวเตือนได้', 'error');
      return;
    }
    if (data.user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
    }
    closeSellerBanAlertModal();
    renderLayout();
    window.dispatchEvent(new CustomEvent('authUpdated', { detail: { user: data.user } }));
    showToast(data.message || 'ปลดล็อกสิทธิ์การลงขายเรียบร้อยแล้ว!', 'success');
  } catch (e) {
    showToast('เกิดข้อผิดพลาดในการปลดล็อก', 'error');
  }
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

  // ตรวจสอบกฎแบนสิทธิ์การขาย 6 เดือน (หากมีดาวเตือน ⚠️⭐ ครบ 3 ดวงในเดือนเดียวกัน)
  if (isUserSellingBanned(user)) {
    const banDateStr = user.seller_banned_until
      ? new Date(user.seller_banned_until).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'อีก 6 เดือน';
    showToast(`🔒 ปุ่มลงขายถูกล็อก: บัญชีของคุณถูกระงับสิทธิ์การลงขายชั่วคราว 6 เดือน (ถึง ${banDateStr}) แต่ยังซื้อหนังสือได้ตามปกติ`, 'error');
    openSellerBanAlertModal(user);
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

// ============================================================================
// 4.2 MODAL แจ้งปัญหา / ขอคืนสินค้า (Request Return / Call Admin + Freeze Escrow)
// ============================================================================

let disputeEvidenceDataUrl = '';
let disputeModalTarget = { orderId: null, roomId: null, bookTitle: '' };

function getDefaultDisputeEvidenceSVG(reasonTitle = 'สภาพหนังสือไม่ตรงปก') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="260" viewBox="0 0 440 260"><rect width="440" height="260" rx="18" fill="#FFF5F5"/><rect x="14" y="14" width="412" height="232" rx="14" fill="#FFFFFF" stroke="#FCA5A5" stroke-width="2" stroke-dasharray="6,4"/><text x="220" y="72" text-anchor="middle" font-family="sans-serif" font-size="17" font-weight="bold" fill="#B91C1C">📸 รูปหลักฐานแจ้งขอคืนสินค้า (Dispute Evidence)</text><text x="220" y="110" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="bold" fill="#7F1D1D">หัวข้อปัญหา: ${reasonTitle}</text><rect x="75" y="132" width="290" height="78" rx="12" fill="#FEF2F2" stroke="#F87171"/><text x="220" y="164" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="bold" fill="#991B1B">❄️ ระงับการโอนเงินให้ผู้ขายชั่วคราว (Escrow Frozen)</text><text x="220" y="188" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#B91C1C">ส่งแจ้งเตือนด่วนไปยัง Admin Dashboard เพื่ออนุมัติคืนเงิน</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function renderDisputeEvidencePreview() {
  const previewBox = document.getElementById('dispute-evidence-preview-box');
  if (!previewBox) return;
  if (!disputeEvidenceDataUrl) {
    previewBox.innerHTML = `
      <div class="py-4 px-3 rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/40 text-center text-xs text-[#5F7470]">
        📷 กรุณาอัปโหลดรูปภาพหลักฐานสภาพหนังสือ หรือคลิกปุ่ม <strong>"✨ แนบรูปหลักฐานตัวอย่าง"</strong> ด้านบน
      </div>
    `;
    return;
  }
  previewBox.innerHTML = `
    <div class="relative rounded-2xl border border-rose-200 bg-white p-2 flex items-center justify-center">
      <img src="${disputeEvidenceDataUrl}" alt="รูปหลักฐาน" class="max-h-44 rounded-xl object-contain" />
      <button type="button" onclick="clearDisputeEvidenceImage()" class="absolute top-2 right-2 w-6 h-6 rounded-full bg-rose-600 text-white text-xs font-bold cursor-pointer">✕</button>
    </div>
  `;
}

function clearDisputeEvidenceImage() {
  disputeEvidenceDataUrl = '';
  renderDisputeEvidencePreview();
}

function handleDisputeEvidenceImageChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    if (e.target && e.target.result) {
      disputeEvidenceDataUrl = e.target.result;
      renderDisputeEvidencePreview();
    }
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function setDemoDisputeEvidenceImage() {
  const cat = document.getElementById('dispute-category-select')?.value || 'สภาพหนังสือไม่ตรงปก';
  disputeEvidenceDataUrl = getDefaultDisputeEvidenceSVG(cat);
  renderDisputeEvidencePreview();
  showToast('📸 แนบรูปหลักฐานสภาพสินค้าเรียบร้อยแล้ว!', 'success');
}

function openReturnDisputeModal({ orderId = null, roomId = null, bookTitle = '' } = {}) {
  const user = getCurrentUser();
  if (!user) {
    showToast('กรุณาเข้าสู่ระบบก่อนแจ้งปัญหา/ขอคืนสินค้า', 'info');
    return;
  }
  disputeModalTarget = {
    orderId: orderId && orderId !== 'null' ? Number(orderId) : (activeChatOrderObj ? activeChatOrderObj.id : null),
    roomId: roomId && roomId !== 'null' ? Number(roomId) : activeChatRoomId,
    bookTitle: bookTitle || activeChatBookTitle || 'รายการสั่งซื้อหนังสือ'
  };

  const subtitleEl = document.getElementById('dispute-modal-book-subtitle');
  if (subtitleEl) {
    subtitleEl.textContent = `รายการ: ${disputeModalTarget.bookTitle} ${disputeModalTarget.orderId ? `(Order #${disputeModalTarget.orderId})` : ''}`;
  }

  disputeEvidenceDataUrl = getDefaultDisputeEvidenceSVG('สภาพหนังสือไม่ตรงปก');
  renderDisputeEvidencePreview();

  document.getElementById('return-dispute-backdrop')?.classList.remove('hidden');
  document.getElementById('return-dispute-box')?.classList.remove('hidden');
}

function closeReturnDisputeModal() {
  document.getElementById('return-dispute-backdrop')?.classList.add('hidden');
  document.getElementById('return-dispute-box')?.classList.add('hidden');
}

async function handleReturnDisputeSubmit(event) {
  event.preventDefault();
  const dispute_category = document.getElementById('dispute-category-select')?.value || 'สภาพหนังสือไม่ตรงปก';
  const dispute_reason = document.getElementById('dispute-reason-input')?.value.trim() || '';

  if (!disputeEvidenceDataUrl) {
    disputeEvidenceDataUrl = getDefaultDisputeEvidenceSVG(dispute_category);
  }

  try {
    const token = getAuthToken();
    const endpoint = disputeModalTarget.orderId
      ? `/api/escrow/dispute-return/${disputeModalTarget.orderId}`
      : `/api/chat/rooms/${disputeModalTarget.roomId || 1}/dispute`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        dispute_category,
        dispute_reason: dispute_reason || `แจ้งขอคืนสินค้าเนื่องจาก${dispute_category}`,
        dispute_evidence_image: disputeEvidenceDataUrl
      })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'ไม่สามารถส่งคำร้องขอคืนสินค้าได้', 'error');
      return;
    }

    showToast(data.message || '🚨 แจ้งขอคืนสินค้าสำเร็จ! ระงับการโอนเงินชั่วคราวและแจ้งแอดมินด่วนแล้ว', 'success');
    closeReturnDisputeModal();

    if (activeChatRoomId) {
      await loadChatRoomMessages(activeChatRoomId);
    } else if (data.roomId) {
      await openThreePartyChatModalById(data.roomId);
    }
    window.dispatchEvent(new CustomEvent('escrowUpdated'));
  } catch (err) {
    showToast('เกิดข้อผิดพลาดในการส่งคำร้องขอคืนสินค้า', 'error');
  }
}

window.openReturnDisputeModal = openReturnDisputeModal;
window.closeReturnDisputeModal = closeReturnDisputeModal;
window.handleReturnDisputeSubmit = handleReturnDisputeSubmit;
window.handleDisputeEvidenceImageChange = handleDisputeEvidenceImageChange;
window.setDemoDisputeEvidenceImage = setDemoDisputeEvidenceImage;
window.clearDisputeEvidenceImage = clearDisputeEvidenceImage;

// ============================================================================
// 4.4 MODAL สมัครสัญลักษณ์ร้านค้าแนะนำ & ดันฟีดหน้าแรก (Merchant Badge & Feed Boost)
// ============================================================================

function openMerchantBadgeModal() {
  document.getElementById('merchant-badge-backdrop')?.classList.remove('hidden');
  document.getElementById('merchant-badge-box')?.classList.remove('hidden');
  renderMerchantBadgeCurrentStatus();
}

function closeMerchantBadgeModal() {
  document.getElementById('merchant-badge-backdrop')?.classList.add('hidden');
  document.getElementById('merchant-badge-box')?.classList.add('hidden');
}

function renderMerchantBadgeCurrentStatus() {
  const statusEl = document.getElementById('merchant-badge-current-status');
  if (!statusEl) return;
  const user = getCurrentUser();
  if (!user) {
    statusEl.innerHTML = `<span class="text-xs text-[#5F7470]">💡 กรุณาเข้าสู่ระบบเพื่อสมัครแพ็กเกจป้ายร้านค้าและเปิดระบบดันฟีดอัตโนมัติ</span>`;
    return;
  }
  if (user.merchant_badge_label) {
    statusEl.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="text-xs text-[#1F4E4B]">
          สถานะร้านค้าปัจจุบันของ <strong>${user.username}</strong>:
          ${renderSellerBadgeHTML(user.merchant_badge_label, user.boost_level)}
          <span class="ml-1 text-[#26A69A] font-bold">(เปิดระบบดันฟีดระดับ ${user.boost_level}/4 อยู่)</span>
        </div>
        <span class="text-[11px] text-[#5F7470]">สามารถเลือกอัปเกรดระดับแพ็กเกจด้านล่างได้ทันที</span>
      </div>
    `;
  } else {
    statusEl.innerHTML = `
      <div class="text-xs text-[#1F4E4B]">
        สถานะปัจจุบันของ <strong>${user.username}</strong>: <span class="px-2.5 py-0.5 rounded-full bg-white border border-[#E6E1D6] font-bold">🌱 ผู้ขายทั่วไป (ยังไม่ได้สมัครป้ายร้านค้า)</span>
        — เลือกสมัครแพ็กเกจด้านล่างเพื่อรับป้ายร้านค้าหน้าชื่อและดันฟีดขึ้นแถวแรกๆ ทันที!
      </div>
    `;
  }
}

async function subscribeMerchantBadgeTier(tierKey) {
  const user = getCurrentUser();
  if (!user) {
    showToast('กรุณาเข้าสู่ระบบก่อนสมัครแพ็กเกจสัญลักษณ์ร้านค้า', 'info');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 700);
    return;
  }

  try {
    const token = getAuthToken();
    const res = await fetch('/api/merchant/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ tier_key: tierKey })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'สมัครแพ็กเกจไม่สำเร็จ', 'error');
      return;
    }

    if (data.user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
    }
    showToast(data.message, 'success');
    renderMerchantBadgeCurrentStatus();
    renderLayout();
    await window.fetchBooksFromAPI();
    window.dispatchEvent(new CustomEvent('authUpdated', { detail: { user: data.user } }));
    window.dispatchEvent(new CustomEvent('merchantSubscribed', { detail: data }));
  } catch (err) {
    showToast('เกิดข้อผิดพลาดในการสมัครแพ็กเกจร้านค้า', 'error');
  }
}

window.openMerchantBadgeModal = openMerchantBadgeModal;
window.closeMerchantBadgeModal = closeMerchantBadgeModal;
window.subscribeMerchantBadgeTier = subscribeMerchantBadgeTier;

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
              <div class="flex flex-wrap items-center gap-1.5">
                <span><strong>👤 ผู้ลงขาย:</strong> ${book.seller_name}</span>
                ${renderSellerBadgeHTML(book.seller_badge_label, book.boost_level)}
                ${renderSellerStrikeHTML(book.seller_strike_count)}
              </div>
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

          <!-- ชื่อร้านผู้ขาย + สัญลักษณ์ร้านค้า (Merchant Badge) + ดาวเตือนส่งล่าช้า (⚠️⭐) -->
          <div class="mt-2 pt-2 border-t border-[#E6E1D6]/70 flex flex-wrap items-center justify-between gap-1 text-[10px] text-[#5F7470]">
            <span class="truncate max-w-[130px] font-medium text-[#1F4E4B]" title="${book.seller_name}">👤 ${(book.seller_name || 'ผู้ขาย').split(' ')[0]}</span>
            <div class="flex flex-wrap items-center gap-1">
              ${renderSellerBadgeHTML(book.seller_badge_label, book.boost_level)}
              ${renderSellerStrikeHTML(book.seller_strike_count)}
            </div>
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
  const isBannedSeller = isUserSellingBanned(user);

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
            <div class="flex items-center gap-2 sm:gap-4">
              <nav class="hidden md:flex items-center gap-3.5 text-sm font-medium text-[#5F7470]">
                <a href="index.html" class="transition hover:text-[#26A69A] ${currentPath === 'index.html' ? 'text-[#26A69A] font-bold' : ''}">
                  หน้าแรก
                </a>
                <button
                  type="button"
                  onclick="openSellBookModal()"
                  class="transition cursor-pointer ${isBannedSeller ? 'px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs' : 'hover:text-[#26A69A]'}"
                  title="${isBannedSeller ? 'บัญชีถูกระงับสิทธิ์การลงขายชั่วคราว 6 เดือน (⚠️⭐x3) คลิกเพื่อดูวันสิ้นสุด' : 'ลงประกาศขายหนังสือของคุณ'}"
                >
                  ${isBannedSeller ? '🔒 ระงับการขายชั่วคราว (⚠️⭐x3)' : '+ ลงขายหนังสือ'}
                </button>
                <button
                  type="button"
                  onclick="openMerchantBadgeModal()"
                  class="px-3 py-1 rounded-full bg-[#FDF2E2] hover:bg-[#fbe6c9] border border-[#F4A261]/50 text-[#E9964A] text-xs font-extrabold transition cursor-pointer"
                >
                  👑 ป้ายร้านค้า &amp; ดันฟีด
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
                  <a href="${user.role === 'Admin' ? 'admin.html' : 'profile.html'}" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#26A69A] hover:bg-[#219187] text-white text-xs sm:text-sm font-bold shadow-2xs transition">
                    <span>👤 ${user.username.split(' ')[0]}</span>
                    ${user.strike_count > 0 ? `<span class="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px]">⚠️⭐x${user.strike_count}</span>` : ''}
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
          <button onclick="openSellBookModal()" class="w-full text-left px-3 py-2 rounded-xl font-semibold ${isBannedSeller ? 'text-rose-700 bg-rose-50' : 'text-[#1F4E4B] hover:bg-[#E0F4F1]/60'}">
            ${isBannedSeller ? '🔒 ระงับการขายชั่วคราว 6 เดือน (⚠️⭐x3)' : '+ ลงขายหนังสือ'}
          </button>
          <button onclick="openMerchantBadgeModal()" class="w-full text-left px-3 py-2 rounded-xl font-bold text-[#E9964A] bg-[#FDF2E2]/70">👑 สมัครป้ายร้านค้า &amp; ดันฟีด</button>
          <a href="profile.html?tab=reservations" class="block px-3 py-2 rounded-xl font-semibold text-[#1F4E4B] hover:bg-[#E0F4F1]/60">คิวจองของฉัน</a>
          <a href="profile.html?tab=dashboard" class="block px-3 py-2 rounded-xl font-semibold text-[#1F4E4B] hover:bg-[#E0F4F1]/60">📊 แดชบอร์ดสถิติ</a>
          ${user && user.role === 'Admin' ? `<a href="admin.html" class="block px-3 py-2 rounded-xl font-semibold text-[#26A69A]">หลังบ้านแอดมิน</a>` : ''}
        </div>
      </header>

      <!-- ปุ่มกลมเล็กๆ มุมขวาล่างของจอ (⚙️ สลับบัญชีทดสอบ) -->
      <div class="fixed bottom-5 right-5 z-50 flex flex-col items-end">
        <div id="seed-switcher-popover" class="hidden mb-2.5 w-80 rounded-3xl bg-white border border-[#E6E1D6] shadow-xl p-4 space-y-2 text-xs">
          <div class="flex items-center justify-between border-b border-[#E6E1D6] pb-2">
            <span class="font-bold text-[#1F4E4B]">⚙️ สลับบัญชีทดสอบ (Seed Data)</span>
            <button onclick="toggleSeedSwitcherPopover()" class="text-[#5F7470] hover:text-[#1F4E4B] cursor-pointer">✕</button>
          </div>
          <p class="text-[11px] text-[#5F7470]">คลิกเพื่อสลับบัญชีทดสอบระบบป้ายร้านค้า, ดาวเตือน ⚠️⭐ และแอดมิน:</p>
          <button onclick="quickDemoLogin('pimchanok@email.com', 'member1234')" class="w-full text-left px-3.5 py-2 rounded-2xl bg-[#FDF2E2]/80 hover:bg-[#FDF2E2] text-[#1F4E4B] font-bold transition cursor-pointer">
            💎 คุณพิมพ์ชนก (ร้านค้าระดับ VIP 500+)
          </button>
          <button onclick="quickDemoLogin('somchai@email.com', 'member1234')" class="w-full text-left px-3.5 py-2 rounded-2xl bg-[#E0F4F1]/70 hover:bg-[#E0F4F1] text-[#1F4E4B] font-bold transition cursor-pointer">
            🥇 คุณสมชาย (ร้านค้าแนะนำ 300+ • มี ⚠️⭐x1)
          </button>
          <button onclick="quickDemoLogin('thanapat@email.com', 'member1234')" class="w-full text-left px-3.5 py-2 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 font-bold transition cursor-pointer">
            🔒 คุณธนภัทร (ถูกแบนขาย 6 เดือน ⚠️⭐x3 • ซื้อได้ปกติ)
          </button>
          <button onclick="quickDemoLogin('admin@007marketplace.com', 'admin1234')" class="w-full text-left px-3.5 py-2 rounded-2xl bg-[#26A69A] hover:bg-[#219187] text-white font-bold transition cursor-pointer">
            🛡️ แอดมินบัญชีกลาง (Admin Escrow &amp; Dispute)
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

      <!-- MODAL 5: แจ้งปัญหา / ขอคืนสินค้า (Request Return / Call Admin + Freeze Escrow) -->
      <div id="return-dispute-backdrop" onclick="closeReturnDisputeModal()" class="hidden fixed inset-0 bg-[#1F4E4B]/45 backdrop-blur-xs z-50"></div>
      <div id="return-dispute-box" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div class="bg-white rounded-3xl border border-[#E6E1D6] shadow-2xl max-w-lg w-full p-6 sm:p-7 pointer-events-auto max-h-[92vh] overflow-y-auto space-y-4">
          <div class="flex items-start justify-between border-b border-[#E6E1D6] pb-3.5">
            <div>
              <span class="px-3 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-extrabold">ESCROW DISPUTE &amp; RETURN</span>
              <h2 class="text-lg sm:text-xl font-extrabold text-[#1F4E4B] mt-1">🔄 แจ้งปัญหา / ขอคืนสินค้า (เรียกแอดมิน)</h2>
              <p id="dispute-modal-book-subtitle" class="text-xs text-[#5F7470] mt-0.5"></p>
            </div>
            <button onclick="closeReturnDisputeModal()" class="w-8 h-8 rounded-full bg-[#FAF7F2] hover:bg-rose-50 text-[#1F4E4B] cursor-pointer">✕</button>
          </div>

          <div class="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200 text-xs text-rose-900 space-y-1">
            <div class="font-extrabold">❄️ ทันทีที่กดส่งคำร้อง:</div>
            <p class="leading-relaxed">1) ระบบจะ <strong>ระงับการโอนเงินให้ผู้ขายชั่วคราว (Freeze Escrow)</strong> ทันที • 2) <strong>AI Chatbot</strong> จะรับเรื่องในห้องแชท • 3) ส่ง <strong>แจ้งเตือนด่วน (Urgent Alert)</strong> ไปยังหน้า Admin Dashboard เพื่อให้แอดมินกดอนุมัติคืนเงินให้คุณได้ทันที</p>
          </div>

          <form onsubmit="handleReturnDisputeSubmit(event)" class="space-y-3.5 text-xs sm:text-sm">
            <div>
              <label class="block font-bold text-[#1F4E4B] mb-1">เลือกเหตุผลที่ต้องการขอคืนสินค้า *</label>
              <select id="dispute-category-select" onchange="setDemoDisputeEvidenceImage()" class="w-full rounded-2xl border border-[#E6E1D6] bg-[#FAF7F2] px-3.5 py-2.5 font-bold text-[#1F4E4B]">
                <option value="สภาพหนังสือไม่ตรงปก">1. สภาพหนังสือไม่ตรงปก (ไม่ตรงตามที่ผู้ขายแจ้ง)</option>
                <option value="หน้าขาด/เสียหาย">2. หน้าขาด / เสียหาย / เปียกน้ำ</option>
                <option value="ได้รับหนังสือผิดเล่ม">3. ได้รับหนังสือผิดเล่ม / ผิดปก</option>
              </select>
            </div>

            <div>
              <label class="block font-bold text-[#1F4E4B] mb-1">รายละเอียดปัญหาเพิ่มเติม *</label>
              <textarea required id="dispute-reason-input" rows="2" placeholder="ระบุจุดที่พบปัญหา เช่น มีรอยขีดเขียนปากกาเมจิกหลายหน้า หรือหน้ากระดาษหลุด..." class="w-full rounded-2xl border border-[#E6E1D6] bg-[#FAF7F2] px-3.5 py-2.5">สภาพหนังสือไม่ตรงตามที่แจ้งไว้ มีรอยพับและรอยขีดเขียนด้านใน ขอคืนสินค้าและรับเงินคืนจากบัญชีกลางครับ</textarea>
            </div>

            <div class="space-y-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <label class="font-bold text-[#1F4E4B]">📸 แนบรูปภาพหลักฐานสภาพสินค้า *</label>
                <div class="flex items-center gap-1.5">
                  <input type="file" id="dispute-evidence-file-input" accept="image/*" onchange="handleDisputeEvidenceImageChange(event)" class="hidden" />
                  <button type="button" onclick="document.getElementById('dispute-evidence-file-input').click()" class="px-3 py-1.5 rounded-full bg-[#26A69A] text-white text-xs font-bold cursor-pointer">
                    📷 เลือกรูปจากเครื่อง
                  </button>
                  <button type="button" onclick="setDemoDisputeEvidenceImage()" class="px-3 py-1.5 rounded-full bg-[#FDF2E2] text-[#E9964A] border border-[#F4A261]/50 text-xs font-bold cursor-pointer">
                    ✨ แนบรูปหลักฐานตัวอย่าง
                  </button>
                </div>
              </div>
              <div id="dispute-evidence-preview-box"></div>
            </div>

            <div class="pt-2 flex justify-end gap-2">
              <button type="button" onclick="closeReturnDisputeModal()" class="px-4 py-2.5 rounded-full border border-[#E6E1D6] font-bold text-[#5F7470] cursor-pointer">ยกเลิก</button>
              <button type="submit" class="px-5 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs cursor-pointer">
                🚨 ส่งคำร้อง &amp; ระงับการโอนเงินทันที
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- MODAL 6: สมัครสัญลักษณ์ร้านค้าแนะนำ & ดันฟีดหน้าแรก (4 แพ็กเกจรายเดือน + Smart Blended Feed) -->
      <div id="merchant-badge-backdrop" onclick="closeMerchantBadgeModal()" class="hidden fixed inset-0 bg-[#1F4E4B]/45 backdrop-blur-xs z-50"></div>
      <div id="merchant-badge-box" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div class="bg-[#FAF7F2] rounded-3xl border border-[#E6E1D6] shadow-2xl max-w-4xl w-full p-6 sm:p-8 pointer-events-auto max-h-[92vh] overflow-y-auto space-y-5">
          <div class="flex items-start justify-between border-b border-[#E6E1D6] pb-4">
            <div>
              <span class="px-3 py-1 rounded-full bg-[#FDF2E2] border border-[#F4A261]/50 text-[#E9964A] text-xs font-extrabold">MERCHANT BADGE &amp; SMART FEED BOOST</span>
              <h2 class="text-xl sm:text-2xl font-extrabold text-[#1F4E4B] mt-1">👑 สมัครสัญลักษณ์ร้านค้าแนะนำ &amp; ดันฟีดหน้าแรก</h2>
              <p class="text-xs text-[#5F7470] mt-0.5">รับป้ายสัญลักษณ์ความน่าเชื่อถือติดหน้าชื่อร้าน พร้อมระบบดันหนังสือขึ้นแถวแรกๆ ตามระดับแพ็กเกจ</p>
            </div>
            <button onclick="closeMerchantBadgeModal()" class="w-8 h-8 rounded-full bg-white hover:bg-[#E0F4F1] text-[#1F4E4B] border border-[#E6E1D6] cursor-pointer">✕</button>
          </div>

          <div id="merchant-badge-current-status" class="p-3.5 rounded-2xl bg-white border border-[#E6E1D6]"></div>

          <!-- ตารางแพ็กเกจรายเดือน 4 ระดับ (ราคาขีดฆ่า + ราคาโปรโมชันลดพิเศษ) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Tier 1 -->
            <div class="bg-white rounded-3xl border border-[#E6E1D6] p-5 flex flex-col justify-between space-y-4 shadow-2xs hover:border-[#26A69A] transition">
              <div class="space-y-2">
                <span class="inline-block px-3 py-1 rounded-full bg-[#E0F4F1] text-[#1F4E4B] text-xs font-extrabold">🏪 ร้านค้า 50+</span>
                <h3 class="font-extrabold text-[#1F4E4B] text-base">ระดับเริ่มต้น</h3>
                <p class="text-xs text-[#5F7470] font-semibold">วางขาย 50 – 100 เล่ม</p>
                <div class="pt-1">
                  <span class="text-xs text-[#5F7470] line-through">ราคาปกติ 99฿</span>
                  <div class="text-2xl font-extrabold text-[#26A69A]">49 บาท<span class="text-xs font-normal text-[#5F7470]">/เดือน</span></div>
                </div>
                <ul class="text-[11px] text-[#5F7470] space-y-1 pt-2 border-t border-[#E6E1D6]">
                  <li>✅ รับป้าย <strong>"🏪 ร้านค้า 50+"</strong></li>
                  <li>✅ <strong>ดันฟีดระดับ 1</strong> (เพิ่มโอกาสแสดงผลแถวต้นๆ)</li>
                </ul>
              </div>
              <button type="button" onclick="subscribeMerchantBadgeTier('tier_1')" class="w-full py-2.5 rounded-full bg-[#E0F4F1] hover:bg-[#26A69A] text-[#1F4E4B] hover:text-white text-xs font-extrabold transition cursor-pointer">
                สมัครแพ็กเกจ 49฿/เดือน
              </button>
            </div>

            <!-- Tier 2 -->
            <div class="bg-white rounded-3xl border border-[#E6E1D6] p-5 flex flex-col justify-between space-y-4 shadow-2xs hover:border-[#26A69A] transition">
              <div class="space-y-2">
                <span class="inline-block px-3 py-1 rounded-full bg-[#E0F4F1] border border-[#26A69A]/40 text-[#26A69A] text-xs font-extrabold">🥈 ร้านค้าขายดี 100+</span>
                <h3 class="font-extrabold text-[#1F4E4B] text-base">ระดับกลาง</h3>
                <p class="text-xs text-[#5F7470] font-semibold">วางขาย 100 – 200 เล่ม</p>
                <div class="pt-1">
                  <span class="text-xs text-[#5F7470] line-through">ราคาปกติ 139฿</span>
                  <div class="text-2xl font-extrabold text-[#26A69A]">99 บาท<span class="text-xs font-normal text-[#5F7470]">/เดือน</span></div>
                </div>
                <ul class="text-[11px] text-[#5F7470] space-y-1 pt-2 border-t border-[#E6E1D6]">
                  <li>✅ รับป้าย <strong>"🥈 ร้านค้าขายดี 100+"</strong></li>
                  <li>✅ <strong>ดันฟีดระดับ 2</strong> (แสดงผลโดดเด่นในแถวแรกๆ)</li>
                </ul>
              </div>
              <button type="button" onclick="subscribeMerchantBadgeTier('tier_2')" class="w-full py-2.5 rounded-full bg-[#26A69A] hover:bg-[#219187] text-white text-xs font-extrabold transition cursor-pointer">
                สมัครแพ็กเกจ 99฿/เดือน
              </button>
            </div>

            <!-- Tier 3 -->
            <div class="bg-white rounded-3xl border-2 border-[#E9964A] p-5 flex flex-col justify-between space-y-4 shadow-sm relative">
              <span class="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-[#E9964A] text-white text-[10px] font-extrabold">ยอดนิยม</span>
              <div class="space-y-2">
                <span class="inline-block px-3 py-1 rounded-full bg-[#FDF2E2] border border-[#F4A261] text-[#E9964A] text-xs font-extrabold">🥇 ร้านค้าแนะนำ 300+</span>
                <h3 class="font-extrabold text-[#1F4E4B] text-base">ระดับโปร</h3>
                <p class="text-xs text-[#5F7470] font-semibold">วางขาย 300 – 500 เล่ม</p>
                <div class="pt-1">
                  <span class="text-xs text-[#5F7470] line-through">ราคาปกติ 229฿</span>
                  <div class="text-2xl font-extrabold text-[#E9964A]">159 บาท<span class="text-xs font-normal text-[#5F7470]">/เดือน</span></div>
                </div>
                <ul class="text-[11px] text-[#5F7470] space-y-1 pt-2 border-t border-[#E6E1D6]">
                  <li>✅ รับป้าย <strong>"🥇 ร้านค้าแนะนำ 300+"</strong></li>
                  <li>✅ <strong>ดันฟีดระดับ 3</strong> (ขึ้นแถวหน้าสุดลำดับต้นๆ)</li>
                </ul>
              </div>
              <button type="button" onclick="subscribeMerchantBadgeTier('tier_3')" class="w-full py-2.5 rounded-full bg-[#E9964A] hover:bg-[#d98236] text-white text-xs font-extrabold transition cursor-pointer">
                สมัครแพ็กเกจ 159฿/เดือน
              </button>
            </div>

            <!-- Tier 4 VIP -->
            <div class="bg-gradient-to-b from-white to-[#FDF2E2]/60 rounded-3xl border-2 border-[#26A69A] p-5 flex flex-col justify-between space-y-4 shadow-md relative">
              <span class="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-[#1F4E4B] text-white text-[10px] font-extrabold">สูงสุด VIP</span>
              <div class="space-y-2">
                <span class="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-[#FDF2E2] to-[#E0F4F1] border border-[#E9964A] text-[#1F4E4B] text-xs font-extrabold">💎 ร้านค้าระดับ VIP 500+</span>
                <h3 class="font-extrabold text-[#1F4E4B] text-base">ระดับพิเศษ VIP</h3>
                <p class="text-xs text-[#5F7470] font-semibold">วางขาย 500 – 1,000 เล่ม</p>
                <div class="pt-1">
                  <span class="text-xs text-[#5F7470] line-through">ราคาปกติ 399฿</span>
                  <div class="text-2xl font-extrabold text-[#1F4E4B]">299 บาท<span class="text-xs font-normal text-[#5F7470]">/เดือน</span></div>
                </div>
                <ul class="text-[11px] text-[#5F7470] space-y-1 pt-2 border-t border-[#E6E1D6]">
                  <li>✅ รับป้าย <strong>"💎 ร้านค้าระดับ VIP 500+"</strong></li>
                  <li>✅ <strong>ดันฟีดสูงสุด</strong> (ขึ้นแถวแรกๆ เสมอ)</li>
                </ul>
              </div>
              <button type="button" onclick="subscribeMerchantBadgeTier('tier_4')" class="w-full py-2.5 rounded-full bg-[#1F4E4B] hover:bg-[#26A69A] text-white text-xs font-extrabold transition cursor-pointer">
                สมัครแพ็กเกจ VIP 299฿/เดือน
              </button>
            </div>
          </div>

          <!-- คำอธิบายอัลกอริทึมจัดเรียงหน้าฟีดแบบผสมผสาน (Smart Blended Feed) -->
          <div class="p-4 rounded-2xl bg-[#E0F4F1]/65 border border-[#BCE3DF] text-xs text-[#1F4E4B] space-y-1">
            <div class="font-extrabold text-[#26A69A]">⚖️ อัลกอริทึมจัดเรียงหน้าฟีดแบบผสมผสาน (Smart Blended Feed — เป็นธรรมต่อผู้ขายทุกราย):</div>
            <p class="leading-relaxed text-[#5F7470]">
              หนังสือจากร้านค้าที่มีป้ายสัญลักษณ์จะได้รับการจัดลำดับความสำคัญให้แสดงผลในแถวแรกๆ ตามระดับแพ็กเกจ (<strong>VIP 500+ &gt; แนะนำ 300+ &gt; ขายดี 100+ &gt; ร้านค้า 50+</strong>) <strong>โดยระบบจะสลับแทรก (Interleave) หนังสือของผู้ขายทั่วไปที่ไม่ได้ซื้อแพ็กเกจขึ้นมาแสดงผลร่วมด้วยในทุกๆ แถว (เช่น ร้านค้าดันฟีด 2 เล่ม สลับกับผู้ขายทั่วไป 2 เล่ม)</strong> เพื่อให้ผู้ขายรายย่อยทั่วไปยังมีโอกาสขายออกได้ตามปกติและไม่ถูกดันตกไปอยู่หน้าหลังสุดครับ
            </p>
          </div>
        </div>
      </div>

      <!-- MODAL 7: แจ้งเตือนบัญชีถูกระงับสิทธิ์การลงขายชั่วคราวเป็นเวลา 6 เดือน (⚠️⭐ ครบ 3 ดวงในเดือนเดียวกัน) -->
      <div id="seller-ban-alert-backdrop" onclick="closeSellerBanAlertModal()" class="hidden fixed inset-0 bg-[#1F4E4B]/45 backdrop-blur-xs z-50"></div>
      <div id="seller-ban-alert-box" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div class="bg-white rounded-3xl border-2 border-rose-300 shadow-2xl max-w-lg w-full p-6 sm:p-7 pointer-events-auto space-y-4">
          <div class="flex items-start justify-between border-b border-[#E6E1D6] pb-3">
            <div>
              <span class="px-3 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-extrabold">6-MONTH SELLING SUSPENSION</span>
              <h2 class="text-lg font-extrabold text-rose-700 mt-1">🔒 ปุ่มลงขายหนังสือถูกล็อกชั่วคราว 6 เดือน</h2>
            </div>
            <button onclick="closeSellerBanAlertModal()" class="w-8 h-8 rounded-full bg-[#FAF7F2] text-[#1F4E4B] cursor-pointer">✕</button>
          </div>
          <div id="seller-ban-alert-details"></div>
          <div class="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button type="button" onclick="resetMySellerStrikesFromModal()" class="px-4 py-2 rounded-full bg-[#FDF2E2] hover:bg-[#fbe6c9] text-[#E9964A] border border-[#F4A261]/50 text-xs font-extrabold cursor-pointer">
              🔄 รีเซ็ตดาวเตือน (ปลดล็อกเพื่อทดสอบ)
            </button>
            <button type="button" onclick="closeSellerBanAlertModal()" class="px-5 py-2 rounded-full bg-[#26A69A] text-white text-xs font-bold cursor-pointer">
              รับทราบ (เลือกซื้อหนังสือต่อในฐานะผู้ซื้อ)
            </button>
          </div>
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
