// ===== 설정 (운영 전 반드시 확인/수정) =====
// 기준중위소득 60% (개인회생 생계비 산정 참고용). 매년 보건복지부 고시에 맞춰 갱신하세요.
const LIVING_COST = {1: 1538543, 2: 2519575, 3: 3215422, 4: 3896843, 5: 4547000};
const MONTHS = 36; // 변제기간 (통상 36개월, 최대 60개월)
// 상담 신청 접수 주소 (예: Formspree/Google Apps Script 웹앱 URL). 비어 있으면 접수되지 않습니다.
const LEAD_ENDPOINT = "https://script.google.com/macros/s/AKfycbyg8QVyxliJonTEf7ry2AQ0U8-Xc4hLk5pEC7MgbjHKzsrPQPY0c5ia-wbtzlY3SVDV/exec";
// ==========================================

const won = n => Math.round(n).toLocaleString("ko-KR") + "원";
const num = s => Number(String(s).replace(/[^\d]/g, "")) || 0;

document.querySelectorAll("#income,#debt").forEach(el =>
  el.addEventListener("input", () => {
    const v = num(el.value);
    el.value = v ? v.toLocaleString("ko-KR") : "";
  }));

const menu = document.getElementById("menu"), nav = document.getElementById("nav");
menu.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menu.setAttribute("aria-expanded", open);
});
nav.addEventListener("click", () => { nav.classList.remove("open"); menu.setAttribute("aria-expanded", false); });

let lastDiagnosis = "";
document.getElementById("calc").addEventListener("submit", e => {
  e.preventDefault();
  const income = num(document.getElementById("income").value);
  const debt = num(document.getElementById("debt").value);
  const fam = Number(document.getElementById("family").value);
  const avail = income - LIVING_COST[fam];
  const box = document.getElementById("result");
  let html;
  if (avail <= 0) {
    html = `<b>현재 입력 기준으로는 월 가용소득이 거의 없는 것으로 계산됩니다.</b><br>소득 변동, 추가 수입 가능성, 다른 제도(개인파산 등)까지 함께 검토해야 하므로 상담을 권해 드립니다.`;
  } else {
    const total = avail * MONTHS;
    html = `예상 월 변제 가능액: <b>${won(avail)}</b><br>${MONTHS}개월 기준 총 변제 예상액: <b>${won(total)}</b>` +
      (debt ? `<br>입력하신 채무 대비 약 <b>${Math.min(100, Math.round(total / debt * 100))}%</b> 수준` : "") +
      `<br><br>재산(청산가치)에 따라 실제 변제액은 더 늘어날 수 있습니다. 정확한 금액은 상담에서 확인해 드립니다.`;
  }
  box.innerHTML = html + `<br><br><a class="btn" href="#contact">이 결과로 상담 신청하기</a>`;
  box.hidden = false;
  lastDiagnosis = `[간단 자가진단 결과]\n월 소득 ${won(income)} / 가족 ${fam}인` +
    (debt ? ` / 채무 ${won(debt)}` : "") + "\n" +
    html.replace(/<br>\s*<br>/g, "\n").replace(/<br>/g, "\n").replace(/<[^>]+>/g, "");
});

// [이 결과로 상담 신청하기] 클릭 시 진단 결과를 상담 신청 메모에 자동 입력
const DIAG_MARK = "[간단 자가진단 결과]";
document.getElementById("result").addEventListener("click", e => {
  if (!e.target.closest("a.btn") || !lastDiagnosis) return;
  const memo = document.querySelector("#lead [name=memo]");
  const cut = memo.value.indexOf("\n\n");
  const mine = memo.value.indexOf(DIAG_MARK) === 0 ? (cut < 0 ? "" : memo.value.slice(cut + 2)) : memo.value;
  memo.value = lastDiagnosis + (mine.trim() ? "\n\n" + mine.trim() : "");
});

document.getElementById("lead").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, msg = document.getElementById("msg");
  const phone = f.phone.value.replace(/[^\d]/g, "");
  msg.className = "msg";
  if (!f.name.value.trim() || phone.length < 9 || phone.length > 11) {
    msg.classList.add("err"); msg.textContent = "성함과 올바른 연락처를 입력해 주세요."; return;
  }
  if (!f.agree.checked) {
    msg.classList.add("err"); msg.textContent = "개인정보 수집·이용에 동의해 주세요."; return;
  }
  if (!LEAD_ENDPOINT) {
    msg.classList.add("err"); msg.textContent = "현재 온라인 접수가 준비 중입니다. 전화(1600-2061)로 문의해 주세요."; return;
  }
  try {
    const r = await fetch(LEAD_ENDPOINT, {
      method: "POST", headers: {"Content-Type": "text/plain;charset=utf-8"}, // Apps Script는 CORS preflight 미지원 → simple request로 전송
      body: JSON.stringify({name: f.name.value.trim(), phone, time: f.time.value, memo: f.memo.value.trim()})
    });
    if (!r.ok || !(await r.json()).ok) throw new Error();
    msg.classList.add("ok"); msg.textContent = "신청이 접수되었습니다. 곧 연락드리겠습니다."; f.reset();
  } catch {
    msg.classList.add("err"); msg.textContent = "접수 중 오류가 발생했습니다. 전화로 문의해 주세요.";
  }
});

// ===== 새소식&이야기 (글쓰기는 관리자 비밀번호 인증 후에만 가능, 검증은 Apps Script 서버에서 수행) =====
const postList = document.getElementById("postList");
const adminLogin = document.getElementById("adminLogin");
const postForm = document.getElementById("postForm");
let adminPw = "";
try { adminPw = sessionStorage.getItem("adminPw") || ""; } catch {}

const post = body => fetch(LEAD_ENDPOINT, {
  method: "POST", headers: {"Content-Type": "text/plain;charset=utf-8"}, body: JSON.stringify(body)
}).then(r => r.json());

function setMsg(el, text, cls) { el.className = "msg " + (cls || ""); el.textContent = text; }

function renderPosts(posts) {
  postList.textContent = "";
  if (!posts.length) { postList.innerHTML = '<p class="empty">아직 등록된 글이 없습니다.</p>'; return; }
  posts.forEach(p => {
    const a = document.createElement("article"); a.className = "post";
    const h = document.createElement("h3"); h.textContent = p.title;
    const t = document.createElement("time"); t.textContent = new Date(p.date).toLocaleDateString("ko-KR");
    const b = document.createElement("p"); b.className = "post-body"; b.textContent = p.body;
    a.append(h, t, b);
    if (adminPw) {
      const d = document.createElement("button");
      d.type = "button"; d.className = "link-btn del"; d.textContent = "삭제";
      d.addEventListener("click", async () => {
        if (!confirm("이 글을 삭제할까요?")) return;
        try {
          const r = await post({action: "deletePost", password: adminPw, id: p.id});
          if (!r.ok) throw new Error(r.error);
          loadPosts();
        } catch (err) { alert("삭제하지 못했습니다. 다시 로그인해 주세요."); adminOut(); }
      });
      a.append(d);
    }
    postList.append(a);
  });
}

async function loadPosts() {
  if (!LEAD_ENDPOINT) { postList.innerHTML = '<p class="empty">준비 중입니다.</p>'; return; }
  try {
    const r = await (await fetch(LEAD_ENDPOINT + "?action=posts")).json();
    if (!r.ok || !Array.isArray(r.posts)) throw new Error();
    renderPosts(r.posts);
  } catch { postList.innerHTML = '<p class="empty">글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>'; }
}

function showAdmin() { postForm.hidden = !adminPw; adminLogin.hidden = true; }
function adminOut() {
  adminPw = ""; try { sessionStorage.removeItem("adminPw"); } catch {}
  showAdmin(); loadPosts();
}

document.getElementById("adminBtn").addEventListener("click", () => {
  if (adminPw) { postForm.hidden = !postForm.hidden; return; }
  adminLogin.hidden = !adminLogin.hidden;
  if (!adminLogin.hidden) document.getElementById("adminPw").focus();
});

adminLogin.addEventListener("submit", async e => {
  e.preventDefault();
  const msg = document.getElementById("adminMsg"), pw = document.getElementById("adminPw").value;
  setMsg(msg, "확인 중…");
  try {
    const r = await post({action: "login", password: pw});
    if (!r.ok) throw new Error(r.error);
    adminPw = pw; try { sessionStorage.setItem("adminPw", pw); } catch {}
    adminLogin.reset(); setMsg(msg, ""); showAdmin(); loadPosts();
  } catch (err) {
    setMsg(msg, err.message === "locked" ? "시도 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요." : "비밀번호가 올바르지 않습니다.", "err");
  }
});

postForm.addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, msg = document.getElementById("postMsg");
  setMsg(msg, "등록 중…");
  try {
    const r = await post({action: "createPost", password: adminPw, title: f.title.value.trim(), body: f.body.value.trim()});
    if (!r.ok) throw new Error(r.error);
    f.reset(); setMsg(msg, "등록되었습니다.", "ok"); loadPosts();
  } catch (err) {
    setMsg(msg, "등록하지 못했습니다. 로그아웃 후 다시 로그인해 주세요.", "err");
  }
});

showAdmin();
loadPosts();
