/* myDeskMeter family site. Plain JS, no build step. window.PAGE comes from the page. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var PAGE = window.PAGE || {}, SHOT = window.CM_SHOT;
  var ROOT = PAGE.root != null ? PAGE.root : (PAGE.kind === "product" ? "../" : "");

  /* ---------- reveal on scroll (first, so content always appears) ---------- */
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); placeAll(); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    $$(".reveal").forEach(function (el) { io.observe(el); });
  } else { $$(".reveal").forEach(function (el) { el.classList.add("in"); }); }

  var FINISHES = [
    { k: "black", n: "Black", c: "#1f1e1d" },
    { k: "orange", n: "Orange", c: "#f07a22" },
    { k: "blue", n: "Blue", c: "#2c6fd8" },
    { k: "red", n: "Red", c: "#c3262d" },
    { k: "wood", n: "Wood", c: "linear-gradient(135deg,#b07c4f,#7c5232 60%,#a8744a)" },
    { k: "gold", n: "Gold", c: "linear-gradient(135deg,#f3d68a,#b98b2e 55%,#e8c66e)" },
    { k: "rainbow", n: "Rainbow", c: "conic-gradient(#ff4d4d,#ffb84d,#f6f24d,#4dff88,#4dc3ff,#9b4dff,#ff4d4d)" },
    { k: "glow", n: "Glow in the dark", c: "radial-gradient(circle at 35% 35%,#eaffd6,#a6e88a 60%,#6fc75a)" }
  ];
  var POWERS = [
    { k: "usb", n: "USB-C", s: "Plugs in" },
    { k: "standard", n: "Standard battery", s: "Unplug and move it" },
    { k: "jumbo", n: "All Day battery", s: "Bigger battery" }
  ];
  function finishImg(k) { return ROOT + "assets/finishes/" + k + ".webp"; }
  function preloadFinishes() { FINISHES.forEach(function (f) { new Image().src = finishImg(f.k); }); }

  /* ---------- UTM pass-through ---------- */
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  var incoming = {};
  try {
    var qs = new URLSearchParams(location.search);
    UTM_KEYS.forEach(function (k) { if (qs.get(k)) incoming[k] = qs.get(k); });
    if (Object.keys(incoming).length) sessionStorage.setItem("dm_utm", JSON.stringify(incoming));
    else incoming = JSON.parse(sessionStorage.getItem("dm_utm") || "{}");
  } catch (e) { incoming = {}; }
  // The visitor's own campaign wins; ours fills the gaps. utm_content says what was clicked.
  function withUtm(url, content) {
    var u = new URL(url, location.href);
    var p = {
      utm_source: incoming.utm_source || "deskmeters-site",
      utm_medium: incoming.utm_medium || "landing",
      utm_campaign: incoming.utm_campaign || (PAGE.slug || "family"),
      utm_content: content
    };
    if (incoming.utm_term) p.utm_term = incoming.utm_term;
    Object.keys(p).forEach(function (k) { if (p[k]) u.searchParams.set(k, p[k]); });
    return u.toString();
  }
  $$("a[data-utm]").forEach(function (a) {
    a.href = withUtm(a.href, new URL(a.href).searchParams.get("utm_content") || "link");
  });

  /* ---------- perspective: a screen onto the one device photo ---------- */
  function adj(m) { return [m[4]*m[8]-m[5]*m[7], m[2]*m[7]-m[1]*m[8], m[1]*m[5]-m[2]*m[4],
    m[5]*m[6]-m[3]*m[8], m[0]*m[8]-m[2]*m[6], m[2]*m[3]-m[0]*m[5],
    m[3]*m[7]-m[4]*m[6], m[1]*m[6]-m[0]*m[7], m[0]*m[4]-m[1]*m[3]]; }
  function mul(a, b) { var c = []; for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) {
    var s = 0; for (var k = 0; k < 3; k++) s += a[3*i+k] * b[3*k+j]; c[3*i+j] = s; } return c; }
  function mv(m, v) { return [m[0]*v[0]+m[1]*v[1]+m[2]*v[2], m[3]*v[0]+m[4]*v[1]+m[5]*v[2], m[6]*v[0]+m[7]*v[1]+m[8]*v[2]]; }
  function basis(p) { var m = [p[0][0], p[1][0], p[2][0], p[0][1], p[1][1], p[2][1], 1, 1, 1];
    var v = mv(adj(m), [p[3][0], p[3][1], 1]); return mul(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]); }
  function matrix3d(w, h, q) {
    var t = mul(basis(q), adj(basis([[0, 0], [w, 0], [w, h], [0, h]])));
    for (var i = 0; i < 9; i++) t[i] /= t[8];
    return "matrix3d(" + [t[0], t[3], 0, t[6], t[1], t[4], 0, t[7], 0, 0, 1, 0, t[2], t[5], 0, t[8]].join(",") + ")";
  }
  function place(dev) {
    var img = $(".device-photo", dev), scr = $(".screen", dev);
    if (!SHOT || !img || !scr || !img.clientWidth) return;
    var s = img.clientWidth / SHOT.w;
    scr.style.transform = matrix3d(320, 240, SHOT.quad.map(function (p) { return [p[0] * s, p[1] * s]; }));
  }
  // Flat (unwarped) screens scale to their box.
  function fitFlat() {
    $$("[data-flat]").forEach(function (box) {
      var s = $(".screen", box); if (s) s.style.transform = "scale(" + box.clientWidth / 320 + ")";
    });
  }
  function placeAll() { $$(".device").forEach(place); fitFlat(); }
  $$(".device-photo").forEach(function (img) { img.addEventListener("load", function () { place(img.closest(".device")); }); });
  window.addEventListener("resize", placeAll);
  if (window.ResizeObserver) { var ro = new ResizeObserver(placeAll); $$(".device, [data-flat]").forEach(function (d) { ro.observe(d); }); }

  function setScreenImg(scr, src) {
    var img = $("img", scr);
    if (!img) { img = document.createElement("img"); img.alt = ""; scr.innerHTML = ""; scr.appendChild(img); }
    if (img.getAttribute("src") === src) return;
    img.classList.remove("fade"); void img.offsetWidth; img.classList.add("fade");
    img.src = src;
  }
  function shot(name) { return ROOT + "products/" + PAGE.slug + "/screens/" + name + ".webp"; }

  /* ---------- codeMeter live screen: an HTML copy of the two-account firmware screen ---------- */
  var ROWS = [
    { card: "Personal", lab: "Weekly", at: "Thu 5pm", left: "5d 5h", pct: 18, time: 25 },
    { card: "Work", lab: "5-hour", at: "", left: "2h 0m", pct: 37, time: 60 },
    { card: "Work", lab: "Weekly", at: "Thu 5pm", left: "5d 5h", pct: 22, time: 25 }
  ];
  function fmt(d) { var hh = d.getHours() % 12 || 12, mm = ("0" + d.getMinutes()).slice(-2); return hh + ":" + mm + (d.getHours() < 12 ? "am" : "pm"); }
  function makeLive(el) {
    var h = '<div class="ls-head"><span class="ls-brand">codeMeter</span><span class="ls-clock"></span>' +
      '<span class="ls-bat"></span><span class="ls-sig"><i style="height:4px"></i><i style="height:7px"></i><i style="height:10px"></i><i style="height:12px"></i></span><span class="ls-led"></span></div>';
    var last = "";
    ROWS.forEach(function (r, i) {
      if (r.card !== last) { if (last) h += "</div>"; h += '<div class="ls-card"><div class="ls-name">' + r.card + "</div>"; last = r.card; }
      h += '<div class="ls-row"><span class="ls-lab">' + r.lab + '</span><span class="ls-at" data-at="' + i + '">' + r.at + '</span><span class="ls-left">' + r.left +
        '</span><div class="ls-bar"><div class="ls-fill" data-fill="' + i + '" style="width:0"></div><div class="ls-time" data-time="' + i + '" style="width:0"></div></div><span class="ls-pct" data-pct="' + i + '">0%</span></div>';
    });
    el.innerHTML = h + "</div>";
    return {
      tick: function () {
        var now = new Date(), reset = new Date(now.getTime() + 2 * 3600e3); reset.setMinutes(0);
        $(".ls-clock", el).textContent = fmt(now);
        $('[data-at="1"]', el).textContent = fmt(reset);
      },
      show: function (i, pct, time) {
        $('[data-fill="' + i + '"]', el).style.width = pct + "%";
        $('[data-time="' + i + '"]', el).style.width = time + "%";
        var p = $('[data-pct="' + i + '"]', el), from = parseInt(p.textContent, 10) || 0, t0 = performance.now();
        (function step(t) { var k = Math.min(1, (t - t0) / 1100); p.textContent = Math.round(from + (pct - from) * (1 - Math.pow(1 - k, 3))) + "%"; if (k < 1) requestAnimationFrame(step); })(t0);
        p.style.color = pct > time + 15 ? "var(--s-amber)" : "";
        $('[data-fill="' + i + '"]', el).style.background = pct > time + 15 ? "var(--s-amber)" : "";
        // Like the firmware: a card with any limit ahead of pace gets an amber outline and dot.
        var card = p.closest(".ls-card");
        if (card) card.classList.toggle("alert", $$(".ls-pct", card).some(function (x) { return x.style.color; }));
      }
    };
  }
  var lives = $$("[data-live]").map(makeLive);
  if (lives.length) {
    var tickAll = function () { lives.forEach(function (l) { l.tick(); }); };
    tickAll(); setInterval(tickAll, 10000);
    setTimeout(function () { lives.forEach(function (l) { ROWS.forEach(function (r, i) { l.show(i, r.pct, r.time); }); }); }, 500);
    var live = 37;
    setInterval(function () {
      if (document.hidden) return;
      live = live >= 88 ? 30 : live + 4 + Math.round(Math.random() * 3);
      lives.forEach(function (l) { l.show(1, live, 60); });
    }, 3000);
  }

  /* ---------- how it works: each fact lights up its part of the screen ---------- */
  var facts = $$(".facts li"), holes = $("#holeRects"), fi = 0, held = false;
  function focusFact(i) {
    fi = i;
    facts.forEach(function (li, k) { li.classList.toggle("on", k === i); });
    var f = PAGE.glance && PAGE.glance.facts[i];
    if (!holes || !f) return;
    holes.innerHTML = (f.boxes || []).map(function (b) {
      return '<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '" rx="1.2"/>';
    }).join("");
  }
  facts.forEach(function (li, k) {
    li.addEventListener("mouseenter", function () { held = true; focusFact(k); });
    li.addEventListener("mouseleave", function () { held = false; });
    li.addEventListener("click", function () { held = true; focusFact(k); });
  });
  if (facts.length) {
    focusFact(0);
    setInterval(function () { if (!held && !document.hidden) focusFact((fi + 1) % facts.length); }, 3200);
  }

  /* ---------- setups ---------- */
  function tabKeys(list) {
    if (!list) return;
    list.addEventListener("keydown", function (e) {
      var tabs = $$("button", list), i = tabs.indexOf(document.activeElement);
      if (i < 0 || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
      var n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); n.click();
    });
  }
  var modeCopy = $("#modeCopy");
  function setMode(k) {
    var m = (PAGE.modes || []).filter(function (x) { return x.key === k; })[0]; if (!m) return;
    $$("#modes .tabs button").forEach(function (b) { b.setAttribute("aria-selected", b.dataset.mode === k ? "true" : "false"); });
    setScreenImg($("#modeDevice .screen"), shot(m.screen));
    modeCopy.innerHTML = '<div class="swap"><h3>' + m.h + "</h3><p>" + m.p + "</p>" + (m["for"] ? '<p class="for">' + m["for"] + "</p>" : "") + "</div>";
  }
  if (modeCopy && PAGE.modes) {
    $$("#modes .tabs button").forEach(function (b) { b.addEventListener("click", function () { setMode(b.dataset.mode); }); });
    tabKeys($("#modes .tabs"));
    setMode(PAGE.modes[0].key);
  }

  /* ---------- builder ---------- */
  var B = PAGE.builder;
  var state = { finish: "black", power: "usb", screen: B ? B.screens[0].key : "" };
  if (B) {
    try {
      var q = new URLSearchParams(location.search);
      ["finish", "power", "screen"].forEach(function (k) { if (q.get(k)) state[k] = q.get(k); });
    } catch (e) {}
    var has = function (f, p) { return B.prices.hasOwnProperty(f + "-" + p); };
    var finishes = FINISHES.filter(function (f) { return POWERS.some(function (p) { return has(f.k, p.k); }); });
    var fWrap = $("#finishes"), pWrap = $("#powers"), sWrap = $("#screens");
    finishes.forEach(function (f) {
      var b = document.createElement("button");
      b.type = "button"; b.style.setProperty("--c", f.c); b.dataset.k = f.k;
      b.setAttribute("aria-label", f.n); b.title = f.n;
      b.addEventListener("click", function () { state.finish = f.k; render(); });
      fWrap.appendChild(b);
    });
    POWERS.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button"; b.dataset.k = p.k; b.innerHTML = p.n + "<small>" + p.s + "</small>";
      b.addEventListener("click", function () { state.power = p.k; render(); });
      pWrap.appendChild(b);
    });
    B.screens.forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button"; b.dataset.k = s.key; b.textContent = s.label;
      b.addEventListener("click", function () { state.screen = s.key; render(); });
      sWrap.appendChild(b);
    });

    var fill = function (tpl) {
      var st = B.store;
      return String(tpl)
        .replace("{finish}", (st.finish_values && st.finish_values[state.finish]) || state.finish)
        .replace("{power}", (st.power_values && st.power_values[state.power]) || state.power);
    };
    var buyUrl = function () {
      var key = state.finish + "-" + state.power, st = B.store, url, params, alt = st.alt;
      if (alt && alt.values[key] && (alt.unless_screen || []).indexOf(state.screen) < 0) {
        url = alt.url; params = {}; params[alt.param] = alt.values[key];
      } else {
        var by = st.by_screen && st.by_screen[state.screen];
        url = (by && by.url) || st.url; params = (by && by.params) || st.params || {};
      }
      var u = new URL(url);
      Object.keys(params).forEach(function (k) { u.searchParams.set(k, fill(params[k])); });
      return withUtm(u.toString(), "builder-" + key + "-" + state.screen);
    };
    var lastScreen = "";
    var render = function () {
      if (!finishes.some(function (f) { return f.k === state.finish; })) state.finish = finishes[0].k;
      if (!B.screens.some(function (s) { return s.key === state.screen; })) state.screen = B.screens[0].key;
      if (!has(state.finish, state.power)) state.power = POWERS.filter(function (p) { return has(state.finish, p.k); })[0].k;
      var key = state.finish + "-" + state.power;
      var f = FINISHES.filter(function (x) { return x.k === state.finish; })[0];
      var p = POWERS.filter(function (x) { return x.k === state.power; })[0];
      var s = B.screens.filter(function (x) { return x.key === state.screen; })[0];
      $$("button", fWrap).forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.k === state.finish); });
      $$("button", pWrap).forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.k === state.power); b.disabled = !has(state.finish, b.dataset.k); });
      $$("button", sWrap).forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.k === state.screen); });
      var missing = POWERS.filter(function (x) { return !has(state.finish, x.k); }).map(function (x) { return x.n; });
      $("#powerHint").textContent = (missing.length ? f.n + " comes without: " + missing.join(", ") + ". " : "") +
        (state.power !== "usb" ? "Pictured with the USB-C stand." : "");
      // Same photo for every finish: only the stand colour changes.
      var img = $("#buildDevice .device-photo");
      if (img.getAttribute("src") !== finishImg(state.finish)) img.setAttribute("src", finishImg(state.finish));
      if (lastScreen !== s.screen) { setScreenImg($("#buildDevice .screen"), shot(s.screen)); lastScreen = s.screen; }
      $("#finishName").textContent = f.n;
      $("#price").textContent = "$" + B.prices[key];
      $("#summary").textContent = f.n + " stand, " + p.n + ". Shown with the " + s.label + " screen.";
      $("#buyBtn").href = buyUrl();
      try {
        var u = new URL(location.href);
        u.searchParams.set("finish", state.finish); u.searchParams.set("power", state.power); u.searchParams.set("screen", state.screen);
        if (render.ready) history.replaceState(null, "", u.pathname + u.search + u.hash);
      } catch (e) {}
      render.ready = true;
    };
    render();
    preloadFinishes();
    try { if (new URLSearchParams(location.search).get("finish") && !location.hash) setTimeout(function () { $("#build").scrollIntoView(); }, 300); } catch (e) {}
  }

  /* ---------- co-brand start-up screen preview ---------- */
  var cv = $("#splash");
  if (cv) {
    var cx = cv.getContext("2d"), logo = null;
    var bgIn = $("#bgIn"), coIn = $("#coIn"), qtyIn = $("#qtyIn");
    var lum = function (hex) { var n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; };
    var updateQuote = function () {
      var co = coIn.value.trim() || "our team", qty = parseInt(qtyIn.value, 10) || 50;
      var subj = PAGE.name + " bulk quote: " + co + ", " + qty + " units";
      var body = "Hi Encinitas 3D,\n\nWe would like a quote for custom " + PAGE.name + " units.\n\nCompany: " + co +
        "\nQuantity: " + qty + "\nBrand colour: " + bgIn.value + "\nStand colour: " + state.finish + "\nPower: " + state.power +
        "\nNeeded by: \n\nWe will reply with our logo file.\n\nThanks";
      $("#quoteBtn").href = "mailto:info@encinitas3d.com?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(body);
    };
    var drawSplash = function () {
      var W = cv.width, H = cv.height, bg = bgIn.value, fg = lum(bg) > 0.6 ? "#1a1815" : "#ffffff";
      document.documentElement.style.setProperty("--brand", bg);
      cx.fillStyle = bg; cx.fillRect(0, 0, W, H);
      if (logo) {
        var k = Math.min(W * 0.72 / logo.width, H * 0.46 / logo.height), w = logo.width * k, h = logo.height * k;
        cx.drawImage(logo, (W - w) / 2, H * 0.40 - h / 2, w, h);
      } else {
        var name = coIn.value.trim() || "Your logo", size = 76;
        cx.fillStyle = fg; cx.textAlign = "center"; cx.textBaseline = "middle";
        cx.font = "700 " + size + "px Inter Tight, Helvetica, Arial";
        while (cx.measureText(name).width > W * 0.82 && size > 28) { size -= 4; cx.font = "700 " + size + "px Inter Tight, Helvetica, Arial"; }
        cx.fillText(name, W / 2, H * 0.40);
      }
      cx.fillStyle = fg; cx.globalAlpha = 0.9; cx.textAlign = "center"; cx.textBaseline = "middle";
      cx.font = "700 34px Helvetica, Arial, sans-serif"; cx.fillText(PAGE.name, W / 2, H * 0.80); cx.globalAlpha = 1;
      updateQuote();
    };
    $("#logoIn").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0]; if (!file) return;
      var im = new Image(); im.onload = function () { logo = im; drawSplash(); }; im.src = URL.createObjectURL(file);
    });
    [bgIn, coIn, qtyIn].forEach(function (el) { el.addEventListener("input", drawSplash); });
    $("#brandForm").addEventListener("submit", function (e) { e.preventDefault(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawSplash);
    drawSplash();
  }

  /* ---------- home: one device, every meter ---------- */
  if (PAGE.kind === "home") {
    var P = PAGE.products, cur = 0, heldP = false;
    var dev = $("#homeDevice"), cap = $("#switchCap"), shotLink = $("#homeShot"), cta = $("#homeCta");
    var showP = function (i) {
      cur = i; var p = P[i];
      $$(".switch .tabs button").forEach(function (b, k) { b.setAttribute("aria-selected", k === i ? "true" : "false"); });
      var img = $(".device-photo", dev);
      if (img.getAttribute("src") !== finishImg(p.finish)) img.setAttribute("src", finishImg(p.finish));
      setScreenImg($(".screen", dev), "products/" + p.slug + "/screens/" + p.screen + ".webp");
      cap.innerHTML = '<div class="swap"><b style="color:' + p.accent + '">' + p.name + "</b> " + p.line + ".</div>";
      shotLink.setAttribute("href", p.slug + "/"); shotLink.setAttribute("aria-label", "See " + p.name);
      cta.setAttribute("href", p.slug + "/");
      cta.innerHTML = "See " + p.name + ' <span aria-hidden="true">&rarr;</span>';
    };
    $$(".switch .tabs button").forEach(function (b, k) {
      b.addEventListener("click", function () { heldP = true; showP(k); });
    });
    tabKeys($(".switch .tabs"));
    showP(0);
    setInterval(function () { if (!heldP && !document.hidden) showP((cur + 1) % P.length); }, 4000);
    P.forEach(function (p) { new Image().src = "products/" + p.slug + "/screens/" + p.screen + ".webp"; });
    preloadFinishes();

    // Colours: the same device in any stand colour; the screen steps through the meters.
    var cWrap = $("#homeFinishes"), cDev = $("#colourDevice"), ci = 0;
    FINISHES.forEach(function (f, k) {
      var b = document.createElement("button");
      b.type = "button"; b.style.setProperty("--c", f.c); b.setAttribute("aria-label", f.n); b.title = f.n;
      b.addEventListener("click", function () {
        $$("button", cWrap).forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
        $(".device-photo", cDev).setAttribute("src", finishImg(f.k));
        $("#homeFinishName").textContent = f.n;
        ci = (ci + 1) % P.length;
        setScreenImg($(".screen", cDev), "products/" + P[ci].slug + "/screens/" + P[ci].screen + ".webp");
      });
      if (k === 0) b.setAttribute("aria-pressed", "true");
      cWrap.appendChild(b);
    });
  }

  /* ---------- nav + sticky buy ---------- */
  var nav = $("#nav"), sticky = $("#stickyBuy"), heroEl = $("#top"), buildEl = $("#build");
  function onScroll() {
    var y = window.scrollY;
    nav.classList.toggle("scrolled", y > 20);
    if (sticky && buildEl) {
      var b = buildEl.getBoundingClientRect();
      sticky.classList.toggle("show", y > heroEl.offsetHeight * 0.8 && !(b.top < innerHeight && b.bottom > 0));
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  placeAll();
})();
