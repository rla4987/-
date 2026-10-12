/**
 * 상담 신청 접수용 Google Apps Script
 * - 신청 내용을 스프레드시트에 한 줄씩 저장
 * - (선택) 새 신청이 들어오면 이메일 알림
 *
 * 설치 방법은 apps-script/README.md 참고
 */

const SHEET_NAME = "상담신청";
const NOTIFY_EMAIL = ""; // 알림 받을 이메일. 비워두면 알림 없음 (예: "me@naver.com")
const HEADERS = ["접수일시", "성함", "연락처", "통화 가능 시간", "상담 내용"];

// 새소식&이야기 게시판. 관리자 비밀번호는 코드에 적지 않고
// Apps Script 프로젝트 설정 → 스크립트 속성에 ADMIN_PASSWORD 로 저장합니다.
const POSTS_SHEET = "새소식";
const POST_HEADERS = ["ID", "작성일시", "제목", "내용"];
const MAX_FAILS = 5; // 비밀번호 연속 실패 허용 횟수 (초과 시 10분간 로그인 차단)

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const data = JSON.parse(e.postData.contents);

    if (data.action) return handleAdmin_(data);

    const name = clean_(data.name, 50);
    const phone = String(data.phone || "").replace(/[^\d]/g, "");
    const time = clean_(data.time, 30);
    const memo = clean_(data.memo, 2000);

    if (!name || phone.length < 9 || phone.length > 11) {
      return json_({ ok: false, error: "invalid" });
    }

    const sheet = getSheet_();
    sheet.appendRow([new Date(), name, formatPhone_(phone), time, memo]);

    if (NOTIFY_EMAIL) {
      MailApp.sendEmail(
        NOTIFY_EMAIL,
        "[상담신청] " + name + " " + formatPhone_(phone),
        "성함: " + name + "\n연락처: " + formatPhone_(phone) +
        "\n통화 가능 시간: " + time + "\n\n상담 내용:\n" + (memo || "(없음)")
      );
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// 웹앱 주소를 브라우저로 열었을 때 동작 확인용
function doGet(e) {
  if (e && e.parameter && e.parameter.action === "posts") {
    return json_({ ok: true, posts: listPosts_() });
  }
  return json_({ ok: true, message: "상담 접수 서버 정상 작동 중" });
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange("A:A").setNumberFormat("yyyy-mm-dd hh:mm:ss");
    sheet.getRange("C:C").setNumberFormat("@"); // 전화번호 앞 0 유지
  }
  return sheet;
}

// 수식 주입 방지: = + - @ 로 시작하면 앞에 ' 추가
function clean_(v, max) {
  let s = String(v || "").trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function formatPhone_(p) {
  if (p.length === 11) return p.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  if (p.length === 10) return p.startsWith("02")
    ? p.replace(/(\d{2})(\d{4})(\d{4})/, "$1-$2-$3")
    : p.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  return p.replace(/(\d{2})(\d{3,4})(\d{4})/, "$1-$2-$3");
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== 새소식&이야기 =====
function handleAdmin_(data) {
  if (!checkPassword_(data.password)) {
    return json_({ ok: false, error: isLocked_() ? "locked" : "auth" });
  }
  if (data.action === "login") return json_({ ok: true });

  if (data.action === "createPost") {
    const title = clean_(data.title, 100), body = clean_(data.body, 5000);
    if (!title || !body) return json_({ ok: false, error: "invalid" });
    getPostsSheet_().appendRow([Utilities.getUuid(), new Date(), title, body]);
    return json_({ ok: true });
  }
  if (data.action === "deletePost") {
    const sheet = getPostsSheet_();
    const ids = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
    for (let i = ids.length - 1; i >= 1; i--) {
      if (ids[i][0] === data.id) { sheet.deleteRow(i + 1); return json_({ ok: true }); }
    }
    return json_({ ok: false, error: "notfound" });
  }
  return json_({ ok: false, error: "unknown" });
}

function listPosts_() {
  const sheet = getPostsSheet_();
  const n = sheet.getLastRow() - 1;
  if (n < 1) return [];
  return sheet.getRange(2, 1, n, 4).getValues()
    .map(r => ({ id: r[0], date: new Date(r[1]).toISOString(), title: String(r[2]), body: String(r[3]) }))
    .reverse().slice(0, 50);
}

function getPostsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(POSTS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(POSTS_SHEET);
    sheet.appendRow(POST_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function isLocked_() {
  return Number(CacheService.getScriptCache().get("fails") || 0) >= MAX_FAILS;
}

function checkPassword_(pw) {
  const cache = CacheService.getScriptCache();
  const saved = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD");
  if (!saved || isLocked_()) return false;
  if (String(pw || "") === saved) { cache.remove("fails"); return true; }
  cache.put("fails", String(Number(cache.get("fails") || 0) + 1), 600);
  return false;
}
