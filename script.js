// ===== 설정 (운영 전 반드시 확인/수정) =====
// 기준중위소득 60% (개인회생 생계비 산정 참고용). 매년 보건복지부 고시에 맞춰 갱신하세요.
const LIVING_COST = {1: 1538543, 2: 2519575, 3: 3215422, 4: 3896843, 5: 4547000};
const MONTHS = 36; // 변제기간 (통상 36개월, 최대 60개월)
// 상담 신청 접수 주소 (예: Formspree/Google Apps Script 웹앱 URL). 비어 있으면 접수되지 않습니다.
const LEAD_ENDPOINT = "";
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
