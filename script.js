const stage = document.querySelector(".stage");
const curtain = document.getElementById("curtain");
const canvas = document.getElementById("tearCanvas");
const ctx = canvas.getContext("2d", { alpha: true });
const resetButton = document.getElementById("resetButton");
const poster = document.getElementById("poster");

const copyText = {
  kicker: document.querySelector(".curtain-kicker").textContent.trim(),
  title: document.querySelector(".curtain-copy h1").textContent.trim().replace(/\s+/g, " "),
  hint: document.querySelector(".curtain-hint").textContent.trim(),
};

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
let raf = 0;
let openT = 0;
let revealed = false;
let redirectTimer = 0;

// Tear spine: jagged centre line of the rip. Each point carries its own
// random edge offsets so the torn edge stays stable between frames.
let spine = [];
let dragMinY = Infinity;
let dragMaxY = -Infinity;

const layer = document.createElement("canvas");
const layerCtx = layer.getContext("2d");

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layer.width = canvas.width;
  layer.height = canvas.height;
  layerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paintLayer();
  render();
}

// ---------- static curtain layer (painted once, torn at render time) ----------

function paintLayer() {
  const c = layerCtx;
  c.clearRect(0, 0, width, height);

  const base = c.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, "#24005c");
  base.addColorStop(0.42, "#5412c4");
  base.addColorStop(0.62, "#2a086d");
  base.addColorStop(1, "#100029");
  c.fillStyle = base;
  c.fillRect(0, 0, width, height);

  const foldCount = Math.max(9, Math.round(width / 110));
  for (let i = 0; i < foldCount; i += 1) {
    const x = (i / (foldCount - 1)) * width;
    const fold = c.createLinearGradient(x - 60, 0, x + 60, 0);
    fold.addColorStop(0, "rgba(255,255,255,0)");
    fold.addColorStop(0.48, i % 2 ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.18)");
    fold.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = fold;
    c.fillRect(x - 80, 0, 160, height);
  }

  // paper grain
  c.save();
  for (let i = 0; i < 420; i += 1) {
    c.fillStyle = i % 2 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.05)";
    c.fillRect(Math.random() * width, Math.random() * height, rnd(0.6, 2), rnd(0.6, 2));
  }
  c.restore();

  const vignette = c.createRadialGradient(
    width / 2, height / 2, 0,
    width / 2, height / 2, Math.max(width, height) * 0.72
  );
  vignette.addColorStop(0, "rgba(255,255,255,0.08)");
  vignette.addColorStop(0.56, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.52)");
  c.fillStyle = vignette;
  c.fillRect(0, 0, width, height);

  drawCopy(c);
}

function wrapText(c, text, maxW) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (line && c.measureText(test).width > maxW) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCopy(c) {
  const mobile = width < 640;
  const kSize = clamp(width * 0.018, 11.5, 16.8);
  const hSize = clamp(width * 0.021, 14.7, 19.2);
  const h1Size = mobile ? clamp(width * 0.18, 48, 78) : clamp(width * 0.13, 48, 176);
  const gap = clamp(height * 0.02, 10, 24);
  const titleLines = mobile ? copyText.title.split(" ") : [copyText.title];

  c.save();
  c.textAlign = "center";
  c.textBaseline = "top";
  c.shadowColor = "rgba(0,0,0,0.42)";
  c.shadowBlur = 22;
  c.shadowOffsetY = 8;

  c.font = `700 ${hSize}px Inter, sans-serif`;
  const hintLines = wrapText(c, copyText.hint, mobile ? 18 * 16 : Math.min(34 * 16, width - 48));

  const titleLine = h1Size * (mobile ? 0.98 : 0.95);
  const hintLine = hSize * 1.35;
  const total = kSize + gap + titleLines.length * titleLine + gap + hintLines.length * hintLine;
  let y = height / 2 - total / 2;
  const cx = width / 2;

  if ("letterSpacing" in c) c.letterSpacing = `${kSize * 0.18}px`;
  c.font = `800 ${kSize}px Inter, sans-serif`;
  c.fillStyle = "rgba(255,255,255,0.72)";
  c.fillText(copyText.kicker.toUpperCase(), cx, y);
  if ("letterSpacing" in c) c.letterSpacing = "0px";
  y += kSize + gap;

  c.font = `400 ${h1Size}px Anton, Impact, "Arial Narrow Bold", sans-serif`;
  c.fillStyle = "#ffffff";
  for (const line of titleLines) {
    c.fillText(line.toUpperCase(), cx, y);
    y += titleLine;
  }
  y += gap;

  c.font = `700 ${hSize}px Inter, sans-serif`;
  c.fillStyle = "rgba(255,255,255,0.76)";
  for (const line of hintLines) {
    c.fillText(line, cx, y);
    y += hintLine;
  }
  c.restore();
}

// ---------- tear geometry ----------

function makeSpinePoint(x, y) {
  return {
    x,
    y,
    jagL: rnd(2, 15),
    jagR: rnd(2, 15),
  };
}

function seedSpineFromTop(point) {
  spine = [];
  let y = -40;
  while (y < point.y - 8) {
    spine.push(makeSpinePoint(clamp(point.x + rnd(-7, 7), 14, width - 14), y));
    y += rnd(10, 18);
  }
  spine.push(makeSpinePoint(clamp(point.x, 14, width - 14), point.y));
}

function addSpinePoint(point) {
  dragMinY = Math.min(dragMinY, point.y);
  dragMaxY = Math.max(dragMaxY, point.y);

  const last = spine[spine.length - 1];
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < 9) return;

  // Paper resists: the rip lags the finger and wanders a little.
  const drift = last ? last.x + (point.x - last.x) * 0.6 + rnd(-6, 6) : point.x;
  spine.push(makeSpinePoint(clamp(drift, 14, width - 14), clamp(point.y, -40, height + 40)));

  if (getVerticalTravel() > height * 0.58) {
    revealPoster();
  } else {
    render();
  }
}

function getVerticalTravel() {
  return dragMaxY > dragMinY ? dragMaxY - dragMinY : 0;
}

function buildEdges() {
  const n = spine.length;
  const dist = new Array(n);
  dist[n - 1] = 0;
  for (let i = n - 2; i >= 0; i -= 1) {
    dist[i] = dist[i + 1] + Math.hypot(spine[i + 1].x - spine[i].x, spine[i + 1].y - spine[i].y);
  }

  const travel = getVerticalTravel();
  const dragGap = Math.min(width * 0.2, 4 + travel * 0.32);
  const maxGap = dragGap + (width * 1.5 - dragGap) * openT;

  const left = [];
  const right = [];
  for (let i = 0; i < n; i += 1) {
    // Gap tapers to zero at the tear tip, widest where the rip is oldest.
    const t = Math.min(1, dist[i] / 240);
    const taper = Math.max(t * t * (3 - 2 * t), openT);
    const half = maxGap * 0.5 * taper;
    left.push({ x: spine[i].x - half - spine[i].jagL * taper, y: spine[i].y });
    right.push({ x: spine[i].x + half + spine[i].jagR * taper, y: spine[i].y });
  }
  return { left, right };
}

function tracePath(points) {
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
}

function traceGap(edges) {
  ctx.beginPath();
  edges.left.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  for (let i = edges.right.length - 1; i >= 0; i -= 1) {
    ctx.lineTo(edges.right[i].x, edges.right[i].y);
  }
  ctx.closePath();
}

function render() {
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(layer, 0, 0, width, height);

  if (spine.length < 2) {
    drawGrabCue();
    return;
  }

  const edges = buildEdges();

  // 1. punch the jagged gap out of the curtain
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  traceGap(edges);
  ctx.fill();
  ctx.restore();

  // 2. curl shading on the paper side of each edge (paper lifting off the poster)
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  [
    { pts: edges.left, dir: -1 },
    { pts: edges.right, dir: 1 },
  ].forEach(({ pts, dir }) => {
    tracePath(pts.map((p) => ({ x: p.x + dir * 10, y: p.y })));
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 18;
    ctx.stroke();
    tracePath(pts.map((p) => ({ x: p.x + dir * 6, y: p.y })));
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 9;
    ctx.stroke();
    tracePath(pts.map((p) => ({ x: p.x + dir * 2, y: p.y })));
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 3;
    ctx.stroke();
  });
  ctx.restore();

  // 3. white fibrous torn edge
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  [edges.left, edges.right].forEach((pts) => {
    tracePath(pts);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 6.5;
    ctx.stroke();
    tracePath(pts);
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 4;
    ctx.strokeStyle = "rgba(251,247,239,0.95)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.shadowBlur = 0;
  });
  ctx.restore();

  // 4. edges cast a soft shadow onto the poster inside the gap
  ctx.save();
  traceGap(edges);
  ctx.clip();
  ctx.lineJoin = "round";
  [
    { pts: edges.left, off: 7 },
    { pts: edges.right, off: -7 },
  ].forEach(({ pts, off }) => {
    tracePath(pts);
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = off;
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  ctx.restore();

  // 5. hairline crack just ahead of the tear tip
  if (!revealed && openT === 0) {
    const tip = spine[spine.length - 1];
    const prev = spine[spine.length - 2];
    const len = Math.hypot(tip.x - prev.x, tip.y - prev.y) || 1;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(tip.x + ((tip.x - prev.x) / len) * 12, tip.y + ((tip.y - prev.y) / len) * 12);
    ctx.stroke();
    ctx.restore();
  }
}

function drawGrabCue() {
  if (revealed) return;
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

// ---------- reveal / reset ----------

function revealPoster() {
  if (revealed) return;
  revealed = true;

  // run the rip all the way to the bottom edge
  let last = spine[spine.length - 1];
  let { x, y } = last;
  while (y < height + 40) {
    y += rnd(12, 20);
    x = clamp(x + rnd(-8, 8), 14, width - 14);
    spine.push(makeSpinePoint(x, y));
  }
  dragMaxY = Math.max(dragMaxY, height);

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
  const duration = 950;

  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    openT = easeOutCubic(t);
    render();
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
  spine = [];
  dragMinY = Infinity;
  dragMaxY = -Infinity;
  openT = 0;
  revealed = false;
  curtain.style.visibility = "visible";
  stage.classList.remove("revealed");
  curtain.classList.remove("open", "dragging");
  render();
}

// ---------- input ----------

function getPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

canvas.addEventListener("pointerdown", (event) => {
  if (revealed) return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  isDragging = true;
  curtain.classList.add("dragging");
  lastPoint = getPoint(event);
  dragMinY = lastPoint.y;
  dragMaxY = lastPoint.y;
  seedSpineFromTop(lastPoint);
  render();
});

canvas.addEventListener("pointermove", (event) => {
  if (!isDragging || revealed) return;
  event.preventDefault();
  const point = getPoint(event);
  const steps = lastPoint ? Math.ceil(Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) / 18) : 1;
  for (let i = 1; i <= steps; i += 1) {
    addSpinePoint({
      x: lastPoint.x + ((point.x - lastPoint.x) * i) / steps,
      y: lastPoint.y + ((point.y - lastPoint.y) * i) / steps,
    });
    if (revealed) return;
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

if (document.fonts && document.fonts.ready) {
  Promise.all([
    document.fonts.load("400 100px Anton"),
    document.fonts.load("800 16px Inter"),
    document.fonts.load("700 16px Inter"),
  ]).then(() => {
    paintLayer();
    render();
  });
}

if (new URLSearchParams(window.location.search).has("reveal")) {
  window.setTimeout(() => {
    cancelAnimationFrame(raf);
    window.clearTimeout(redirectTimer);
    revealed = true;
    openT = 1;
    stage.classList.add("revealed");
    curtain.classList.add("open");
    render();
    curtain.style.visibility = "hidden";
  }, 250);
}
