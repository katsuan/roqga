// ろくが：はじめの画面の得点板のプレビュー（芝のピッチの絵に、動画と同じ得点板・エフェクト・撮る画面の見本・保存される動画の見本）
// 読み込む順は index.html（page → store → draw → setup → preview → studio → record → editor → editor-live → render → quickjoin → quickbadge → merge → keep → app.js）。
"use strict";

// ---- 得点板のプレビュー（はじめの画面）：芝のピッチの絵に、動画と同じ得点板・エフェクトを描く ----
const preview = $("preview");
const previewCtx = preview.getContext("2d");
let previewLoop = 0;
// プレビューの種類："shoot"（📹 撮る画面）・"saved"（💾 保存される動画）
let previewMode = "shoot";
let flowStart = 0; // 保存される動画の流れを始めた時刻
// 芝のピッチの絵（カメラの映像・動画の代わり）を描く
function drawPitch(c, w, h) {
  const grass = c.createLinearGradient(0, 0, 0, h);
  grass.addColorStop(0, "#3f9a5a");
  grass.addColorStop(1, "#2e7d47");
  c.fillStyle = grass;
  c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(255, 255, 255, 0.6)";
  c.lineWidth = 6;
  c.strokeRect(60, 60, w - 120, h - 120);
  c.beginPath();
  c.moveTo(w / 2, 60);
  c.lineTo(w / 2, h - 60);
  c.stroke();
  c.beginPath();
  c.arc(w / 2, h / 2, 90, 0, Math.PI * 2);
  c.stroke();
}
// はじめの画面のプレビューを描く。動きがあるあいだ（エフェクト・保存される動画の流れ）は描きつづける
function drawPreview() {
  const c = previewCtx;
  const w = preview.width;
  const h = preview.height;
  cancelAnimationFrame(previewLoop);
  // 撮る画面の見本では「プレビュー」の札を出さない（右下の録画ボタンに重なるため。下の説明で見本と分かる）
  preview.closest(".preview-frame").classList.toggle("is-shoot", previewMode === "shoot");
  if (previewMode === "saved") return drawSavedFlow(c, w, h);
  drawPitch(c, w, h);
  drawScoreboard(w, h, c);
  drawGoalFx(w, h, c);
  drawNiceFx(w, h, c);
  drawStudioMock(c, w, h);
  $("previewCaption").textContent = "撮っているときの画面（録画中）。右上の ●●● を押すと、＋1 と録画ボタンの位置が変わります（撮る画面と同じ）。";
  $("previewHand").setAttribute("aria-label", `＋1 の位置：${HAND_NAMES[state.hand]}（押すと切りかえ）`);
  if ((goalFx || niceFx) && $("studio").hidden) previewLoop = requestAnimationFrame(drawPreview);
}

// 📹 撮る画面の見本：録画中の赤い枠・時間、右上の ●●●、＋1／−1・⭐ ナイス・録画ボタン（＋1 の位置の設定どおり。撮る画面の style.css と同じ並び）
function drawStudioMock(c, w, h) {
  const k = h / 390; // スマホを横にしたときの高さ（390）で 1
  const font = (size) => `800 ${size * k}px "M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", sans-serif`;
  // 丸いボタン（ふちつき）
  const circle = (x, y, r, fill, stroke, lw) => {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.lineWidth = lw;
      c.strokeStyle = stroke;
      c.stroke();
    }
  };
  // 角の丸い四角（ピル）
  const pill = (x, y, pw, ph, fill, stroke, lw) => {
    c.beginPath();
    if (c.roundRect) c.roundRect(x - pw / 2, y - ph / 2, pw, ph, ph / 2);
    else c.rect(x - pw / 2, y - ph / 2, pw, ph);
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.lineWidth = lw;
      c.strokeStyle = stroke;
      c.stroke();
    }
  };
  const text = (t, x, y, size, color) => {
    c.font = font(size);
    c.fillStyle = color;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(t, x, y);
  };
  c.save();
  // 録画中：赤い枠と、上のまん中に時間
  c.lineWidth = 5 * k;
  c.strokeStyle = "#e5484d";
  c.strokeRect(2.5 * k, 2.5 * k, w - 5 * k, h - 5 * k);
  pill(w / 2, 30 * k, 74 * k, 24 * k, "rgba(0, 0, 0, 0.45)");
  text("● 0:42", w / 2, 30 * k, 13, "#ffffff");
  // 右上：＋1 の位置（●●●）
  circle(w - 36 * k, 36 * k, 20 * k, "rgba(0, 0, 0, 0.5)");
  [-9, 0, 9].forEach((dx, i) => {
    const on = ["left", "center", "right"][i] === state.hand;
    circle(w - 36 * k + dx * k, 36 * k, 3 * k, on ? "#ffffff" : "rgba(255, 255, 255, 0.35)");
  });
  // チーム（左右の並び）。得点板を出さないときは1つの「GOAL」（芝の緑）
  const teams = inOrder({ key: "us", color: state.colorUs, name: state.teamUs }, { key: "them", color: state.colorThem, name: state.teamThem });
  const list = state.board ? teams : [{ key: "us", color: NEUTRAL_FX_COLOR, name: "" }];
  const plusLabel = state.board ? "＋1" : "GOAL";
  // ＋1（チームの色）
  const plus = (x, y, d, color) => {
    circle(x, y, d / 2, color, "rgba(255, 255, 255, 0.9)", 3 * k);
    text(plusLabel, x, y, state.board ? d * 0.29 / k : d * 0.25 / k, inkFor(color));
  };
  // −1（小さなピル）
  const minus = (x, y, color) => {
    pill(x, y, 52 * k, 32 * k, "rgba(0, 0, 0, 0.45)", color, 2 * k);
    text("−1", x, y, 14, "#ffffff");
  };
  // ⭐ ナイス
  const nice = (x, y) => {
    pill(x, y, 96 * k, 40 * k, "rgba(0, 0, 0, 0.55)", "#ffd64a", 2 * k);
    text("⭐ ナイス", x, y, 14, "#ffe082");
  };
  // 録画ボタン（録画中は角の丸い四角）
  const rec = (x, y) => {
    circle(x, y, 36 * k, "rgba(0, 0, 0, 0)", "#ffffff", 4 * k);
    c.fillStyle = "#e5484d";
    c.beginPath();
    if (c.roundRect) c.roundRect(x - 14 * k, y - 14 * k, 28 * k, 28 * k, 6 * k);
    else c.rect(x - 14 * k, y - 14 * k, 28 * k, 28 * k);
    c.fill();
  };
  const bottom = h - 16 * k;
  if (state.hand === "center") {
    // まんなか：⭐ の下に [＋1] ● [＋1]（−1 は ＋1 の下）
    const recY = bottom - 56 * k;
    rec(w / 2, recY);
    const plusY = bottom - 32 * k - 8 * k - 38 * k;
    const offset = 36 * k + 28 * k + 38 * k;
    list.forEach((t, i) => {
      const x = list.length === 1 ? w / 2 - offset : w / 2 + (i === 0 ? -offset : offset);
      plus(x, plusY, 76 * k, t.color);
      minus(x, bottom - 16 * k, t.color);
    });
    nice(w / 2, plusY - 38 * k - 10 * k - 20 * k);
  } else {
    // 左よせ・右よせ：持つ側に ⭐ と ＋1・−1 を縦に、録画ボタンは反対側
    const left = state.hand === "left";
    const edge = 20 * k;
    let y = bottom - 32 * k;
    [...list].reverse().forEach((t) => {
      const px = left ? edge + 32 * k : w - edge - 32 * k;
      const mx = left ? px + 32 * k + 10 * k + 26 * k : px - 32 * k - 10 * k - 26 * k;
      plus(px, y, 64 * k, t.color);
      minus(mx, y, t.color);
      y -= 64 * k + 14 * k;
    });
    nice(left ? edge + 48 * k : w - edge - 48 * k, y + 32 * k - 4 * k);
    rec(left ? w - edge - 44 * k : edge + 44 * k, bottom - 36 * k);
  }
  c.restore();
}

// 💾 保存される動画の見本：結果の札（最初）→ 試合 → GOAL → つなぎ目 → 試合 → 結果の札（最後）を、いまの設定どおりにくりかえす（⚡ ハイライトの見本）
function savedFlowSteps() {
  const card = resultCardPlace("highlight");
  const steps = [];
  if (card === "start") steps.push({ key: "cardStart", ms: 1800, label: "結果の札（最初の 2 秒。LINE などのサムネになる）" });
  steps.push({ key: "match0", ms: 1200, label: state.board ? "試合（左上に得点板）" : "試合（得点板なし）" });
  steps.push({ key: "goal", ms: state.goalFx ? GOAL_FX_MS : 900, label: state.goalFx ? "＋1 のところで GOAL の演出" : "＋1（演出なし）" });
  if (state.niceFx) steps.push({ key: "nice", ms: NICE_FX_MS, label: "⭐ ナイスのところで、得点板の下に小さく「⭐ ナイス！」" });
  if (transitionOf(state.transition).draw) steps.push({ key: "wipe", ms: TRANSITION_SEC * 1000, label: "つなぎ目の柄（ハイライトの場面と場面のあいだ）" });
  steps.push({ key: "match1", ms: 1200, label: "次の場面" });
  if (card === "end") steps.push({ key: "cardEnd", ms: 1800, label: "結果の札（最後の 2 秒）" });
  return steps;
}
function drawSavedFlow(c, w, h) {
  const steps = savedFlowSteps();
  const total = steps.reduce((sum, s) => sum + s.ms, 0);
  if (!flowStart) flowStart = performance.now();
  let t = (performance.now() - flowStart) % total;
  const i = steps.findIndex((s) => (t -= s.ms) < 0);
  const step = steps[i];
  const p = 1 + t / step.ms; // その場面の中の進みぐあい（0〜1）
  const after = { us: state.us + 1, them: state.them }; // 見本の得点（左のチームに 1 点）
  const result = { us: state.us + 1, them: state.them };
  drawPitch(c, w, h);
  if (step.key === "cardStart" || step.key === "cardEnd") {
    drawResultCard(w, h, c, result);
  } else {
    const score = step.key === "match0" ? { us: state.us, them: state.them } : after;
    drawScoreboard(w, h, c, { score });
    if (step.key === "goal" && state.goalFx) {
      // GOAL の演出：この場面のはじめから出す（drawGoalFx は時刻で動くので、はじめた時刻を合わせる）
      if (!goalFx || goalFx.flowStep !== flowStart + i) goalFx = { side: "us", at: performance.now() - p * GOAL_FX_MS, flowStep: flowStart + i, score: after };
      drawGoalFx(w, h, c);
    }
    if (step.key === "nice") drawNiceFxAt(w, h, c, p);
    if (step.key === "wipe") drawTransition(w, h, c, p);
  }
  $("previewCaption").textContent = `ハイライトの見本：${step.label}`;
  if ($("previewFold").open && $("studio").hidden && previewMode === "saved") previewLoop = requestAnimationFrame(drawPreview);
}
// 見本の ●●● を押したら、＋1・録画ボタンの位置を まんなか → 左よせ → 右よせ と変える（撮る画面の ●●● と同じ。端末に残す）
$("previewHand").addEventListener("click", () => {
  state.hand = { center: "left", left: "right", right: "center" }[state.hand];
  save();
  showHand();
  drawPreview();
});
// プレビューの切りかえ（📹 撮る画面／💾 保存される動画）
document.querySelectorAll("[data-preview]").forEach((b) =>
  b.addEventListener("click", () => {
    previewMode = b.dataset.preview;
    flowStart = 0;
    goalFx = null;
    document.querySelectorAll("[data-preview]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    drawPreview();
  })
);
document.querySelectorAll(".team-col input").forEach((input) => input.addEventListener("input", drawPreview));
