const stage = document.querySelector(".stage");
const curtain = document.getElementById("curtain");
const canvas = document.getElementById("tearCanvas");
const ctx = canvas.getContext("2d", { alpha: true });
const resetButton = document.getElementById("resetButton");
const poster = document.getElementById("poster");

const redirectUrl = "https://gigventure.onpay.my/order/form/may0326";
const redirectDelayMs = 3000;

const posterCandidates = [
  "./assets/poster.jpeg",
  "./assets/poster.png",
  "./assets/poster.jpg",
  "./assets/poster.webp",
  "./assets/poster-fallback.svg",
];

let candidateIndex = 0;
poster.addEventListener("error", () => {
  candidateIndex += 1;
  if (candidateIndex < posterCandidates.length) {
    poster.src = posterCandidates[candidateIndex];
  }
});

let width = 0;
let height = 0;
let dpr = 1;
let isDragging = false;
let lastPoint = null;
let tearPoints = [];
let raf = 0;
let openProgress = 0;
let revealed = false;
let redirectTimer = 0;

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawCurtain();
}

function drawCurtain() {
  ctx.clearRect(0, 0, width, height);

  const base = ctx.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, "#24005c");
  base.addColorStop(0.42, "#5412c4");
  base.addColorStop(0.62, "#2a086d");
  base.addColorStop(1, "#100029");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  drawFabricFolds();
  drawGrabCue();
  drawTearMask();
  drawOpeningHalves();
}

function drawFabricFolds() {
  const foldCount = Math.max(9, Math.round(width / 110));
  for (let i = 0; i < foldCount; i += 1) {
    const x = (i / (foldCount - 1)) * width;
    const fold = ctx.createLinearGradient(x - 60, 0, x + 60, 0);
    fold.addColorStop(0, "rgba(255,255,255,0)");
    fold.addColorStop(0.48, i % 2 ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.2)");
    fold.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = fold;
    ctx.fillRect(x - 80, 0, 160, height);
  }

  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 1;
  for (let y = 18; y < height; y += 26) {
    ctx.beginPath();
    for (let x = 0; x <= width; x += 34) {
      const wave = Math.sin(x * 0.018 + y * 0.025) * 5;
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
  ctx.restore();

  const vignette = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.72);
  vignette.addColorStop(0, "rgba(255,255,255,0.08)");
  vignette.addColorStop(0.56, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.52)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

function drawGrabCue() {
  if (tearPoints.length > 0 || revealed) return;
  const cx = width / 2;
  const top = Math.max(42, height * 0.12);
  const bottom = Math.min(height - 44, height * 0.82);
  const gapSize = width < 640 ? 230 : 150;
  const gapTop = height / 2 - gapSize;
  const gapBottom = height / 2 + gapSize * 0.78;

  ctx.save();
  ctx.setLineDash([8, 16]);
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";

  [
    [top, Math.max(top, gapTop)],
    [Math.min(bottom, gapBottom), bottom],
  ].forEach(([start, end]) => {
    if (end - start < 24) return;
    ctx.beginPath();
    ctx.moveTo(cx, start);
    ctx.bezierCurveTo(cx - 24, start + (end - start) * 0.32, cx + 30, start + (end - start) * 0.7, cx, end);
    ctx.stroke();
  });
  ctx.restore();
}

function drawTearMask() {
  if (tearPoints.length < 2) return;

  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let i = 1; i < tearPoints.length; i += 1) {
    const previous = tearPoints[i - 1];
    const current = tearPoints[i];
    const wobble = Math.sin(i * 1.9) * 11 + Math.cos(i * 0.61) * 7;
    const widthBoost = Math.min(78, 24 + i * 0.45);
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.lineWidth = widthBoost + Math.abs(wobble);
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.lineTo(current.x + wobble, current.y);
    ctx.stroke();
  }

  const last = tearPoints[tearPoints.length - 1];
  ctx.beginPath();
  ctx.ellipse(last.x, last.y, 44, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(0,0,0,0.46)";
  ctx.shadowBlur = 9;
  ctx.beginPath();
  tearPoints.forEach((point, index) => {
    const offset = index % 2 ? 48 : -48;
    if (index === 0) ctx.moveTo(point.x + offset, point.y);
    else ctx.lineTo(point.x + offset, point.y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawOpeningHalves() {
  if (openProgress <= 0) return;

  const gap = openProgress * width * 0.72;
  const lift = openProgress * height * 0.1;
  const shade = Math.min(0.65, openProgress * 0.65);

  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.moveTo(width / 2 - gap * 0.28, -20);
  ctx.bezierCurveTo(width / 2 - gap * 0.52, height * 0.34, width / 2 - gap * 0.5, height * 0.7, -80, height + 80);
  ctx.lineTo(width + 80, height + 80);
  ctx.bezierCurveTo(width / 2 + gap * 0.5, height * 0.7, width / 2 + gap * 0.52, height * 0.34, width / 2 + gap * 0.28, -20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = shade;
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, 0, width, lift);
  ctx.restore();
}

function getPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function addTearPoint(point) {
  const jitter = Math.sin((point.y + tearPoints.length * 19) * 0.04) * 14;
  const clamped = {
    x: Math.max(20, Math.min(width - 20, point.x + jitter)),
    y: Math.max(0, Math.min(height, point.y)),
  };

  const last = tearPoints[tearPoints.length - 1];
  if (last) {
    const distance = Math.hypot(clamped.x - last.x, clamped.y - last.y);
    if (distance < 8) return;
  }

  tearPoints.push(clamped);
  const verticalTravel = getVerticalTravel();
  if (verticalTravel > height * 0.58 || tearPoints.length > 42) {
    revealPoster();
  } else {
    drawCurtain();
  }
}

function getVerticalTravel() {
  if (tearPoints.length < 2) return 0;
  const ys = tearPoints.map((point) => point.y);
  return Math.max(...ys) - Math.min(...ys);
}

function revealPoster() {
  if (revealed) return;
  revealed = true;
  stage.classList.add("revealed");
  curtain.classList.add("open");
  scheduleRedirect();
  animateOpen();
}

function scheduleRedirect() {
  window.clearTimeout(redirectTimer);
  redirectTimer = window.setTimeout(() => {
    window.location.href = redirectUrl;
  }, redirectDelayMs);
}

function animateOpen() {
  const start = performance.now();
  const duration = 920;

  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    openProgress = easeOutCubic(t);
    drawCurtain();
    if (t < 1) {
      raf = requestAnimationFrame(frame);
    } else {
      curtain.style.visibility = "hidden";
    }
  }

  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function resetCurtain() {
  cancelAnimationFrame(raf);
  window.clearTimeout(redirectTimer);
  isDragging = false;
  lastPoint = null;
  tearPoints = [];
  openProgress = 0;
  revealed = false;
  curtain.style.visibility = "visible";
  stage.classList.remove("revealed");
  curtain.classList.remove("open", "dragging");
  drawCurtain();
}

canvas.addEventListener("pointerdown", (event) => {
  if (revealed) return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  isDragging = true;
  curtain.classList.add("dragging");
  lastPoint = getPoint(event);
  tearPoints = [lastPoint];
  addTearPoint(lastPoint);
});

canvas.addEventListener("pointermove", (event) => {
  if (!isDragging || revealed) return;
  event.preventDefault();
  const point = getPoint(event);
  const steps = lastPoint ? Math.ceil(Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) / 18) : 1;
  for (let i = 1; i <= steps; i += 1) {
    const mixed = {
      x: lastPoint.x + ((point.x - lastPoint.x) * i) / steps,
      y: lastPoint.y + ((point.y - lastPoint.y) * i) / steps,
    };
    addTearPoint(mixed);
  }
  lastPoint = point;
});

function endDrag(event) {
  if (!isDragging) return;
  if (event && canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
  isDragging = false;
  curtain.classList.remove("dragging");
  if (!revealed && getVerticalTravel() > height * 0.36) {
    revealPoster();
  }
}

canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
resetButton.addEventListener("click", resetCurtain);
window.addEventListener("resize", resizeCanvas);
window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "r") {
    resetCurtain();
  }
});

resizeCanvas();

if (new URLSearchParams(window.location.search).has("reveal")) {
  window.setTimeout(() => {
    cancelAnimationFrame(raf);
    window.clearTimeout(redirectTimer);
    revealed = true;
    openProgress = 1;
    stage.classList.add("revealed");
    curtain.classList.add("open");
    drawCurtain();
    curtain.style.visibility = "hidden";
  }, 250);
}
