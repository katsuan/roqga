// ろくが：撮った動画に（得点板をつける）の、点の入れ方を選ぶ・見ながら記録（1倍で流しながら、同時に書き出す）
// 読み込む順は index.html（page → store → draw → setup → preview → studio → record → editor → editor-live → render → quickjoin → quickbadge → merge → keep → app.js）。
"use strict";

// ---- 点の入れ方を選ぶ：▶ 見ながら記録（1倍で1回流しながら、同時に書き出す）／じっくり記録（いまの形。あとで書き出す） ----
// 新しく選んだ動画を開いたときだけ出す（「さっきの動画にもどる」では出さない）
function showModePick() {
  $("editor").classList.toggle("is-choosing", !modeChosen);
  $("editModePick").hidden = modeChosen;
  showModeLength();
  showModeChip();
}
// 見出しのよこに、いまの記録のしかた。じっくり記録のときは押すと選びなおせる（点はそのまま）
function showModeChip() {
  const chip = $("editModeChip");
  chip.hidden = !modeChosen;
  chip.classList.toggle("is-quick", quick);
  if (quick) chip.textContent = "● 見ながら記録中";
  else setIconText(chip, "edit", "じっくり記録");
  chip.disabled = quick;
  chip.setAttribute("aria-label", quick ? "見ながら記録中" : "じっくり記録（押すと記録のしかたを選びなおす）");
}
$("editModeChip").addEventListener("click", () => {
  if (quick) return;
  editVideo.pause();
  modeChosen = false;
  showModePick();
});
// 長さの目安：見ながら記録は動画の長さで完成。じっくり記録は、点を入れる時間＋書き出しに動画の長さ
function showModeLength() {
  const d = Number.isFinite(editVideo.duration) ? editVideo.duration : 0;
  $("quickLen").textContent = d ? `約 ${clock(Math.ceil(d))} で完成` : "";
  $("slowLen").textContent = d ? `記録時間＋約 ${clock(Math.ceil(d))}` : "";
  // ハイライトは別に書き出す（流した時間だけかかる）：1シーン（得点・⭐ ナイス）あたり、ハイライトに入れる長さ（何秒前＋何秒後）
  document.querySelectorAll("[data-hl-each]").forEach((el) => (el.textContent = d ? `${el.dataset.hlPre}\n1シーンにつき約${state.hlBefore + state.hlAfter}秒` : ""));
}
["loadedmetadata", "durationchange"].forEach((type) => editVideo.addEventListener(type, showModeLength));
$("slowStart").addEventListener("click", () => {
  modeChosen = true;
  showModePick();
});
$("quickStart").addEventListener("click", () => {
  modeChosen = true;
  showModePick();
  startQuick();
});

// 見ながら記録をはじめる：はじめから 1× で流し、得点板つきの絵と動画の音を、そのまま録る（撮った動画にの書き出しと同じ録り方）。
// 点を入れると、その場で得点板・GOAL の演出が入る。一時停止すると録画も止まる。見終わる・「■ ここまでで保存」で保存の画面へ
async function startQuick() {
  if (!window.MediaRecorder || !editScreen.captureStream) return notice("この端末のブラウザでは書き出せません", "「じっくり記録」で点を入れて、ほかのブラウザで書き出してね。");
  ensureAudio();
  await audioCtx?.resume().catch(() => {});
  editVideo.pause();
  await seekTo(0);
  editVideo.playbackRate = 1;
  editLastT = 0;
  goalFx = null;
  exporting = true;
  rendering = true;
  renderOverlay = true;
  exportMode = true; // 保存の画面は「閉じる」だけ（撮った動画にの画面にもどる）
  frameSync = canSyncFrames();
  // 5分ごとには分けない（一時停止で区切りがずれるため）。5分をこえたら、保存の画面の「LINE で送る用」で
  if (!beginRecording(editScreen, audioDest ? audioDest.stream.getAudioTracks() : [], "edit", { manualFrames: frameSync, split: false, clock: () => editVideo.currentTime })) {
    exporting = rendering = false;
    return notice("書き出しを始められませんでした", "この端末のブラウザでは書き出せないようです。ほかのブラウザ（Safari・Chrome）で開いてね。");
  }
  if (frameSync) {
    paintEditFrame();
    pushFrame();
    startFrameSync();
  }
  quick = true;
  showModeChip();
  $("editor").classList.add("is-quick");
  $("quickBar").hidden = false;
  $("editSeek").disabled = true;
  await keepScreenOn();
  requestAnimationFrame(drawEditFrame);
  quickTick = setInterval(showQuickTime, 500);
  showQuickTime();
  await editVideo.play().catch(() => {});
}
let quickTick = 0;
// 記録中の時間（動画の時間）と、一時停止しているか
function showQuickTime() {
  const d = Number.isFinite(editVideo.duration) ? editVideo.duration : 0;
  $("quickTime").textContent = `${editVideo.paused ? "一時停止中 " : "記録中 "}${clock(Math.floor(editVideo.currentTime))} / ${clock(Math.ceil(d))}`;
}
// 一時停止・再開（録画も止める・つづける）
function toggleQuickPause() {
  if (editVideo.paused) {
    if (recorder?.state === "paused") recorder.resume();
    editVideo.play().catch(() => {});
  } else {
    editVideo.pause();
    if (recorder?.state === "recording") recorder.pause();
  }
  showQuickTime();
}
// 見ながら記録を終える：結果の札（全部にも入れるとき、最後に）を録ってから止め、保存の画面へ。
// 入れた点・⭐ は、保存の画面の「得点ハイライトを作る」にも使う（撮りながらと同じ）
async function finishQuick() {
  if (!quick) return;
  quick = false;
  clearInterval(quickTick);
  editVideo.pause();
  if (recorder?.state === "paused") recorder.resume();
  if (resultCardPlace("full")) await recordCard(scoreAt(Infinity)); // 撮りはじめには結果が分からないので、最初を選んでいても最後に
  effectiveMarks().forEach((m) => liveGoals.push({ take, t: m.t, key: m.key, ...(m.mark ? { mark: true } : {}) }));
  $("editor").classList.remove("is-quick");
  showModeChip(); // 終わったあとは、じっくり記録として直したり書き出したりできる
  $("quickBar").hidden = true;
  $("editSeek").disabled = false;
  editVideo.playbackRate = editRate;
  finishExport(); // 録画を止める → 保存の画面
}
$("quickStop").addEventListener("click", finishQuick);
editVideo.addEventListener("ended", () => quick && finishQuick());
// 見ながら記録のあいだに画面を離れたら、一時停止する（ブラウザは画面を離れると動画が止まり、止まった絵のまま録ってしまうため）
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && quick && !editVideo.paused) toggleQuickPause();
});
