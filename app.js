/* ============== Vrindavan Diaries ============== */
(function () {
  "use strict";

  // 29 optimised photos: images/01.jpg ... images/29.jpg
  const TOTAL = 29;
  const IMAGES = Array.from({ length: TOTAL }, (_, i) =>
    "images/" + String(i + 1).padStart(2, "0") + ".jpg"
  );

  const stage      = document.getElementById("stage");
  const card       = document.getElementById("card");
  const photo      = document.getElementById("photo");
  const photoWrap  = document.getElementById("photoWrap");
  const likeBadge  = document.getElementById("likeBadge");
  const prevBtn    = document.getElementById("prevBtn");
  const nextBtn    = document.getElementById("nextBtn");
  const curNum     = document.getElementById("curNum");
  const totalNum   = document.getElementById("totalNum");
  const progress   = document.getElementById("progressFill");
  const likesCount = document.getElementById("likesCount");
  const hint       = document.getElementById("hint");

  totalNum.textContent = TOTAL;

  // ---- liked state (persisted) ----
  const LS_KEY = "vrindavan_likes";
  let liked = {};
  try { liked = JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { liked = {}; }
  const save = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(liked)); } catch (e) {} };

  let index = 0;
  let animating = false;

  // preload neighbours so swipes feel instant
  function preload(i) {
    const im = new Image();
    im.src = IMAGES[(i + TOTAL) % TOTAL];
  }

  function refreshLikesTally() {
    likesCount.textContent = Object.values(liked).filter(Boolean).length;
  }

  function syncBadge() {
    const on = !!liked[IMAGES[index]];
    likeBadge.classList.toggle("liked", on);
    likeBadge.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function render() {
    photo.classList.remove("loaded");
    photo.onload = () => photo.classList.add("loaded");
    photo.src = IMAGES[index];
    curNum.textContent = index + 1;
    progress.style.width = ((index + 1) / TOTAL) * 100 + "%";
    syncBadge();
    preload(index + 1);
    preload(index - 1);
  }

  // ---- navigation with a slide animation ----
  function go(dir) {            // dir: +1 next, -1 prev
    if (animating) return;
    animating = true;
    const out = dir > 0 ? -window.innerWidth : window.innerWidth;
    card.style.transition = "transform .26s ease, opacity .26s ease";
    card.style.transform = "translateX(" + out + "px) rotate(" + (dir > 0 ? -6 : 6) + "deg)";
    card.style.opacity = "0";

    setTimeout(() => {
      index = (index + dir + TOTAL) % TOTAL;
      render();
      // place incoming card on the opposite side, then snap in
      const enter = dir > 0 ? window.innerWidth : -window.innerWidth;
      card.style.transition = "none";
      card.style.transform = "translateX(" + enter + "px)";
      card.style.opacity = "0";
      // force reflow
      void card.offsetWidth;
      card.style.transition = "transform .3s cubic-bezier(.2,.7,.2,1), opacity .3s ease";
      card.style.transform = "translateX(0) rotate(0deg)";
      card.style.opacity = "1";
      setTimeout(() => { animating = false; }, 300);
    }, 260);
  }

  // ---- like helpers ----
  function setLiked(value) {
    liked[IMAGES[index]] = value;
    save();
    syncBadge();
    refreshLikesTally();
  }

  function heartBurst(x, y) {
    const b = document.createElement("div");
    b.className = "burst";
    b.textContent = "❤";
    const r = photoWrap.getBoundingClientRect();
    b.style.left = (x - r.left) + "px";
    b.style.top  = (y - r.top) + "px";
    photoWrap.appendChild(b);
    requestAnimationFrame(() => b.classList.add("go"));
    setTimeout(() => b.remove(), 900);
  }

  function doubleTapLike(x, y) {
    setLiked(true);                 // double-tap always loves it
    likeBadge.classList.remove("pop");
    void likeBadge.offsetWidth;
    likeBadge.classList.add("pop");
    heartBurst(x, y);
  }

  // like badge toggles
  likeBadge.addEventListener("click", (e) => {
    e.stopPropagation();
    setLiked(!liked[IMAGES[index]]);
    likeBadge.classList.remove("pop"); void likeBadge.offsetWidth; likeBadge.classList.add("pop");
  });

  // ---- pointer drag + tap detection ----
  let startX = 0, startY = 0, dx = 0, dragging = false, downTime = 0;
  let lastTapTime = 0, lastTapX = 0, lastTapY = 0;
  const SWIPE_THRESH = 70;
  const TAP_MOVE = 12;
  const DOUBLE_MS = 320;

  function onDown(e) {
    if (animating) return;
    if (e.target.closest(".like-badge")) return;
    dragging = true;
    startX = e.clientX; startY = e.clientY; dx = 0; downTime = Date.now();
    card.style.transition = "none";
    if (card.setPointerCapture && e.pointerId != null) {
      try { card.setPointerCapture(e.pointerId); } catch (_) {}
    }
  }

  function onMove(e) {
    if (!dragging) return;
    dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) < Math.abs(dy) && Math.abs(dy) > 14) return; // let vertical scroll pass
    card.style.transform = "translateX(" + dx + "px) rotate(" + (dx * 0.04) + "deg)";
    card.style.opacity = String(1 - Math.min(Math.abs(dx) / 600, 0.35));
  }

  function onUp(e) {
    if (!dragging) return;
    dragging = false;
    const moved = Math.abs(dx);
    const dy = Math.abs((e.clientY || 0) - startY);

    if (moved > SWIPE_THRESH) {
      go(dx < 0 ? 1 : -1);
      return;
    }

    // snap back
    card.style.transition = "transform .25s ease, opacity .25s ease";
    card.style.transform = "translateX(0) rotate(0)";
    card.style.opacity = "1";

    // tap / double-tap (only if it was basically a tap, not a scroll)
    if (moved < TAP_MOVE && dy < TAP_MOVE && Date.now() - downTime < 400) {
      const now = Date.now();
      if (now - lastTapTime < DOUBLE_MS &&
          Math.abs(e.clientX - lastTapX) < 40 &&
          Math.abs(e.clientY - lastTapY) < 40) {
        doubleTapLike(e.clientX, e.clientY);
        lastTapTime = 0;
        fadeHint();
      } else {
        lastTapTime = now; lastTapX = e.clientX; lastTapY = e.clientY;
      }
    }
  }

  card.addEventListener("pointerdown", onDown);
  card.addEventListener("pointermove", onMove);
  card.addEventListener("pointerup", onUp);
  card.addEventListener("pointercancel", () => { dragging = false; });
  // guard against the browser's native double-click selecting / zooming
  card.addEventListener("dblclick", (e) => e.preventDefault());

  // ---- buttons + keyboard ----
  nextBtn.addEventListener("click", () => { go(1); fadeHint(); });
  prevBtn.addEventListener("click", () => { go(-1); fadeHint(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { go(1); fadeHint(); }
    else if (e.key === "ArrowLeft") { go(-1); fadeHint(); }
    else if (e.key.toLowerCase() === "l") { setLiked(!liked[IMAGES[index]]); }
  });

  // hide the hint after the first interaction
  let hintGone = false;
  function fadeHint() {
    if (hintGone) return;
    hintGone = true;
    hint.classList.add("fade");
    setTimeout(() => hint.remove(), 800);
  }

  // ---- go ----
  refreshLikesTally();
  render();
})();
