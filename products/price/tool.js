/* priceMeter "Is my ticker supported?" — port of the store tool at
   encinitas3d.com/supported-stock-crypto/ (name -> pair map, symbol/name search),
   with the result drawn on the device screen (screen.js renderer).
   Crypto: live Binance.US pair list + live chart. Stocks: trimmed Nasdaq list snapshot
   (data/stocks.json); Yahoo has no CORS, so a stock shows its recorded chart (data/recorded.json,
   the S&P 500 + ETF candles the SEO pages use) or, without one, a listing with no device screen.
   Only firmware states are drawn on the screen; page states (not found, no chart, blocked) sit beside it. */
(function () {
  "use strict";
  var root = document.getElementById("meterTool");
  if (!root || !window.PriceMeter) return;
  var PM = window.PriceMeter, BASE = PM.base;
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // the store tool's name -> pair map, plus the names its stock list lacks
  var CRYPTO_NAMES = { BITCOIN: "BTCUSDT", ETHEREUM: "ETHUSDT", XRP: "XRPUSDT", SOLANA: "SOLUSDT", DOGECOIN: "DOGEUSDT",
    CARDANO: "ADAUSDT", POLYGON: "MATICUSDT", AVALANCHE: "AVAXUSDT", LITECOIN: "LTCUSDT", TRON: "TRXUSDT",
    CHAINLINK: "LINKUSDT", STELLAR: "XLMUSDT", UNISWAP: "UNIUSDT", COSMOS: "ATOMUSDT", BITCOINCASH: "BCHUSDT",
    FILECOIN: "FILUSDT", VECHAIN: "VETUSDT", MAKER: "MKRUSDT", INTERNETCOMPUTER: "ICPUSDT", SHIBA: "SHIBUSDT" };
  var POPULAR = [["AAPL", "Apple"], ["MSFT", "Microsoft"], ["GOOGL", "Alphabet"], ["AMZN", "Amazon"], ["META", "Meta"],
    ["TSLA", "Tesla"], ["NFLX", "Netflix"], ["NVDA", "NVIDIA"], ["INTC", "Intel"], ["AMD", "AMD"], ["DIS", "Disney"],
    ["BA", "Boeing"], ["V", "Visa"], ["MA", "Mastercard"], ["PYPL", "PayPal"], ["PEP", "PepsiCo"], ["KO", "Coca-Cola"],
    ["WMT", "Walmart"], ["T", "AT&T"], ["XOM", "ExxonMobil"]];
  var QUOTES = ["USDT", "USDC", "USD4", "BUSD", "TUSD", "USD", "BTC", "ETH", "BNB", "DAI", "UST"];
  var TRY = [["Bitcoin", "c", "BTCUSDT"], ["Ethereum", "c", "ETHUSDT"], ["Dogecoin", "c", "DOGEUSDT"], ["Tesla", "s", "TSLA"], ["Apple", "s", "AAPL"], ["SPY", "s", "SPY"]];

  var css = "\
#meterTool .pmt{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:20px;align-items:start}\
#meterTool .pmt-card{background:var(--bg-soft);border-radius:var(--r);padding:28px}\
#meterTool .pmt-field{position:relative}\
#meterTool .pmt-in{width:100%;font:500 18px/1 var(--font);color:var(--ink);background:#fff;border:1px solid var(--line);border-radius:999px;padding:16px 22px;outline:none;transition:border-color .2s,box-shadow .2s}\
#meterTool .pmt-in:focus{border-color:var(--ink-3);box-shadow:0 0 0 4px rgba(21,19,15,.06)}\
#meterTool .pmt-list{position:absolute;z-index:5;left:0;right:0;top:calc(100% + 6px);margin:0;padding:6px;list-style:none;background:#fff;border:1px solid var(--line);border-radius:var(--r-in);box-shadow:0 14px 34px rgba(21,19,15,.12);max-height:340px;overflow:auto}\
#meterTool .pmt-list[hidden]{display:none}\
#meterTool .pmt-opt{display:flex;align-items:baseline;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:15px;line-height:1.3}\
#meterTool .pmt-opt[aria-selected=true],#meterTool .pmt-opt:hover{background:var(--bg)}\
#meterTool .pmt-sym{font-weight:700;min-width:84px}\
#meterTool .pmt-nm{color:var(--ink-2);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
#meterTool .pmt-tag{font-size:12px;font-weight:600;color:var(--ink-3);text-transform:uppercase;letter-spacing:.04em}\
#meterTool .pmt-try{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0;align-items:center;font-size:14px;color:var(--ink-3)}\
#meterTool .pmt-try button{font:600 14px var(--font);color:var(--ink);background:#fff;border:1px solid var(--line);border-radius:999px;padding:7px 14px;cursor:pointer}\
#meterTool .pmt-try button:hover{border-color:var(--ink-3)}\
#meterTool .pmt-res{margin-top:24px;padding-top:22px;border-top:1px solid var(--line)}\
#meterTool .pmt-st{display:flex;align-items:center;gap:10px;font-weight:700;font-size:20px;letter-spacing:-.01em}\
#meterTool .pmt-dot{width:10px;height:10px;border-radius:50%;background:var(--accent);flex:none}\
#meterTool .pmt-st.no .pmt-dot{background:#c9302c}\
#meterTool .pmt-sub{color:var(--ink-2);font-size:15px;margin-top:6px}\
#meterTool .pmt-how{margin-top:18px;font-size:13px;font-weight:600;color:var(--ink-3);text-transform:uppercase;letter-spacing:.05em}\
#meterTool .pmt-kv{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px 12px;align-items:center;margin-top:10px}\
#meterTool .pmt-kv label{font-size:14px;color:var(--ink-2)}\
#meterTool .pmt-val{font:600 16px/1 ui-monospace,SFMono-Regular,Menlo,monospace;background:#fff;border:1px solid var(--line);border-radius:999px;padding:11px 16px;min-width:0;width:100%;color:var(--ink)}\
#meterTool .pmt-copy{font:600 13px var(--font);background:var(--ink);color:#fff;border:0;border-radius:999px;padding:10px 14px;cursor:pointer}\
#meterTool .pmt-copy:hover{background:#2c2925}\
#meterTool .pmt-note{font-size:14px;color:var(--ink-3);margin-top:16px;line-height:1.5}\
#meterTool .pmt-note a{color:var(--accent-ink)}\
#meterTool .pmt-scr{background:var(--dark);border-radius:var(--r);padding:18px}\
#meterTool .pmt-scr canvas{display:block;width:100%;height:auto;aspect-ratio:4/3;image-rendering:pixelated;border-radius:6px;background:#000}\
#meterTool .pmt-warn{font-size:14px;color:#9a3412;margin-top:10px;line-height:1.45}\
#meterTool .pmt-warn[hidden]{display:none}\
#meterTool .pmt-scr.off canvas{display:none}\
#meterTool .pmt-scr.off{background:var(--bg-soft);padding:28px}\
#meterTool .pmt-off{display:none;color:var(--ink-2);font-size:16px;line-height:1.55}\
#meterTool .pmt-scr.off .pmt-off{display:block}\
#meterTool .pmt-off b{display:block;font-size:20px;letter-spacing:-.01em;margin-bottom:8px;color:var(--ink)}\
#meterTool .pmt-off code{font:600 15px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ink);background:#fff;border-radius:6px;padding:2px 6px}\
#meterTool .pmt-scr.off .pmt-cap{display:none}\
#meterTool .pmt-cap{color:#b9b3a9;font-size:14px;line-height:1.45;margin:14px 4px 2px;min-height:2.9em}\
#meterTool .pmt-live{display:inline-block;width:8px;height:8px;border-radius:50%;background:#92d900;margin-right:8px;vertical-align:1px}\
#meterTool .pmt-live.off{background:#8b857c}\
@media (prefers-reduced-motion:no-preference){#meterTool .pmt-live:not(.off){animation:pmtPulse 2s infinite}}\
@keyframes pmtPulse{50%{opacity:.35}}\
@media (max-width:860px){#meterTool .pmt{grid-template-columns:1fr}#meterTool .pmt-scr{order:-1}#meterTool .pmt-card{padding:22px}}\
@media (max-width:340px){#meterTool .pmt-kv{grid-template-columns:auto minmax(0,1fr)}#meterTool .pmt-copy{grid-column:2;justify-self:start}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  root.innerHTML =
    '<div class="pmt">' +
      '<div class="pmt-card">' +
        '<div class="pmt-field">' +
          '<input class="pmt-in" id="pmtQ" type="text" autocomplete="off" spellcheck="false" placeholder="Bitcoin, BTCUSDT, Tesla, AAPL" ' +
            'role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="pmtList" aria-label="Search a coin or stock">' +
          '<ul class="pmt-list" id="pmtList" role="listbox" hidden></ul>' +
        '</div>' +
        '<div class="pmt-try"><span>Try</span></div>' +
        '<div class="pmt-res" aria-live="polite"></div>' +
      '</div>' +
      '<div class="pmt-scr"><canvas width="640" height="480" aria-label="priceMeter screen preview"></canvas><div class="pmt-off"></div><p class="pmt-cap"></p></div>' +
    '</div>';
  var $ = function (s) { return root.querySelector(s); };
  var q = $("#pmtQ"), list = $("#pmtList"), res = $(".pmt-res"), cv = $("canvas"), cap = $(".pmt-cap"), scr = $(".pmt-scr"), off = $(".pmt-off");
  TRY.forEach(function (t) {
    var b = document.createElement("button"); b.type = "button"; b.textContent = t[0];
    b.addEventListener("click", function () { pickKey(t[1], t[2]); });
    $(".pmt-try").appendChild(b);
  });

  /* ---------- lists ---------- */
  var pairs = [], pairSet = new Set(), pairsLive = false, stocks = [], stockMap = new Map(), stocksReady = null, cryptoReady;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]; }); }
  function setPairs(a) { pairs = a; pairSet = new Set(a); }
  cryptoReady = fetch("https://api.binance.us/api/v3/ticker/price", { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw r.status; return r.json(); })
    .then(function (d) { setPairs(d.map(function (x) { return String(x.symbol || "").toUpperCase(); }).filter(Boolean)); pairsLive = true; })
    .catch(function () { return fetch(BASE + "data/crypto.json").then(function (r) { return r.json(); }).then(setPairs).catch(function () {}); });
  function loadStocks() {
    return stocksReady || (stocksReady = fetch(BASE + "data/stocks.json").then(function (r) { return r.json(); }).then(function (rows) {
      stocks = rows.map(function (r) { return { s: r[0], n: r[1], etf: !!r[2], nl: r[1].toLowerCase() }; });
      POPULAR.forEach(function (p) { var e = stocks.find(function (x) { return x.s === p[0]; }); if (e) e.alias = p[1].toLowerCase(); });
      stockMap = new Map(stocks.map(function (x) { return [x.s, x]; }));
    }).catch(function () {}));
  }

  function baseOf(p) { for (var i = 0; i < QUOTES.length; i++) if (p.length > QUOTES[i].length && p.slice(-QUOTES[i].length) === QUOTES[i]) return [p.slice(0, -QUOTES[i].length), QUOTES[i]]; return [p, ""]; }
  // the name we suggest: the coin name when it fits the device's name slot, else the symbol
  // (the portal's own defaults are Bitcoin, ETH, TSLA, AAPL, DOGE)
  function coinName(p) {
    var k = Object.keys(CRYPTO_NAMES).find(function (k) { return CRYPTO_NAMES[k] === p; });
    return k ? k[0] + k.slice(1).toLowerCase() : "";
  }
  function nameForPair(p) { return PM.fitName([coinName(p), baseOf(p)[0]]); }

  /* ---------- search ---------- */
  function search(raw) {
    var t = raw.trim(); if (!t) return [];
    var forceStock = /^stock:/i.test(t); if (forceStock) t = t.slice(6).trim();
    var U = t.toUpperCase().replace(/\s+/g, ""), L = t.toLowerCase(), out = [];
    if (!forceStock && U.length) {
      var named = CRYPTO_NAMES[U] || CRYPTO_NAMES[U.replace(/[^A-Z]/g, "")];
      Object.keys(CRYPTO_NAMES).forEach(function (k) {
        var p = CRYPTO_NAMES[k]; if (!pairSet.has(p)) return;
        if (k === U) out.push({ k: "c", id: p, sc: 96 });
        else if (U.length >= 3 && k.indexOf(U) === 0) out.push({ k: "c", id: p, sc: 72 });
      });
      pairs.forEach(function (p) {
        var b = baseOf(p), sc = 0;
        if (p === U) sc = 100;
        else if (b[0] === U) sc = b[1] === "USDT" ? 92 : b[1] === "USD4" ? 66 : 80;
        else if (p.indexOf(U) === 0) sc = 58 + (b[1] === "USDT" ? 4 : 0);
        if (sc && !(named === p && sc < 96)) out.push({ k: "c", id: p, sc: sc });
      });
    }
    if (U.length) {
      var S = U.replace("/", "-").replace(".", "-");
      stocks.forEach(function (x) {
        var sc = 0;
        if (x.s === S) sc = forceStock ? 101 : 94;
        else if (L.length >= 2 && (x.nl.indexOf(L) === 0 || (x.alias && x.alias.indexOf(L) === 0))) sc = x.alias ? 76 : 52;
        else if (x.s.indexOf(S) === 0) sc = 54 - Math.min(10, x.s.length - S.length);
        else if (L.length >= 3 && (" " + x.nl).indexOf(" " + L) >= 0) sc = 40;
        else if (L.length >= 4 && x.nl.indexOf(L) >= 0) sc = 30;
        if (sc) out.push({ k: "s", id: x.s, sc: sc });
      });
    }
    var seen = {};
    return out.sort(function (a, b) { return b.sc - a.sc || a.id.length - b.id.length; })
      .filter(function (o) { var key = o.k + o.id; if (seen[key]) return false; seen[key] = 1; return true; }).slice(0, 8);
  }
  function label(o) {
    if (o.k === "c") { var b = baseOf(o.id); return { sym: o.id, nm: (coinName(o.id) ? coinName(o.id) + " \u00b7 " : "") + b[0] + (b[1] ? " / " + b[1] : ""), tag: "Crypto" }; }
    var x = stockMap.get(o.id); return { sym: o.id, nm: x ? x.n : "", tag: x && x.etf ? "ETF" : "Stock" };
  }

  var opts = [], active = -1;
  function showList() {
    list.innerHTML = opts.map(function (o, i) {
      var l = label(o);
      return '<li class="pmt-opt" role="option" id="pmtO' + i + '" aria-selected="' + (i === active) + '" data-i="' + i + '">' +
        '<span class="pmt-sym">' + esc(l.sym) + '</span><span class="pmt-nm">' + esc(l.nm) + '</span><span class="pmt-tag">' + l.tag + "</span></li>";
    }).join("");
    list.hidden = !opts.length; q.setAttribute("aria-expanded", String(!!opts.length));
    if (active >= 0) q.setAttribute("aria-activedescendant", "pmtO" + active); else q.removeAttribute("aria-activedescendant");
  }
  function closeList() { opts = []; active = -1; showList(); }
  q.addEventListener("focus", loadStocks);
  q.addEventListener("input", function () {
    Promise.all([cryptoReady, loadStocks()]).then(function () { opts = search(q.value); active = opts.length ? 0 : -1; showList(); });
  });
  q.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!opts.length) return; e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length; showList();
    } else if (e.key === "Enter") {
      e.preventDefault();
      Promise.all([cryptoReady, loadStocks()]).then(function () {
        if (!opts.length) opts = search(q.value);
        var o = opts[Math.max(0, active)];
        if (o && (active >= 0 || o.sc >= 90)) choose(o); else notFound(q.value);
      });
    } else if (e.key === "Escape") closeList();
  });
  list.addEventListener("mousedown", function (e) { e.preventDefault(); });
  list.addEventListener("click", function (e) { var li = e.target.closest(".pmt-opt"); if (li) choose(opts[+li.dataset.i]); });
  q.addEventListener("blur", function () { setTimeout(closeList, 120); });

  /* ---------- result + screen ---------- */
  var feed = null, cur = null, visible = false, rec = null, recP = null;
  function loadRec() {
    return recP || (recP = fetch(BASE + "data/recorded.json").then(function (r) { if (!r.ok) throw r.status; return r.json(); })
      .then(function (d) { rec = d; }).catch(function () { recP = null; }));
  }
  // the device view, or (for page states) a note in its place with no screen drawn
  function screenOn() { scr.classList.remove("off"); cv.removeAttribute("aria-hidden"); }
  function screenOff(html) { scr.classList.add("off"); cv.setAttribute("aria-hidden", "true"); off.innerHTML = html; }
  function stopFeed() { if (feed) { feed.stop(); feed = null; } }

  function pickKey(k, id) { Promise.all([cryptoReady, loadStocks()]).then(function () { choose({ k: k, id: id }); }); }
  function fitNote(nm) {
    return !nm || PM.nameFits(nm) ? "" : "On the device, \u201c" + esc(nm) + "\u201d runs into the status light and the date: the screen shows it exactly like this. Try a shorter name.";
  }

  function choose(o) {
    closeList();
    if (o.k === "c" && !pairSet.has(o.id)) return notFound(o.id);
    if (o.k === "s" && !stockMap.has(o.id)) return notFound(o.id);
    var x = o.k === "s" ? stockMap.get(o.id) : null;
    cur = { k: o.k, id: o.id, name: o.k === "c" ? nameForPair(o.id) : PM.fitName([o.id]), pair: o.k === "c" ? o.id : "Stock:" + o.id.toLowerCase() };
    q.value = o.k === "c" ? o.id : o.id;
    var what = o.k === "c" ? "Crypto pair on Binance.US" : (x.etf ? "ETF" : "US stock") + (x.n ? ": " + x.n : "");
    res.innerHTML =
      '<div class="pmt-st"><span class="pmt-dot"></span>' + esc(o.id) + " is supported</div>" +
      '<p class="pmt-sub">' + esc(what) + "</p>" +
      '<p class="pmt-how">Type this on the setup page</p>' +
      '<div class="pmt-kv">' +
        '<label for="pmtPair">Pair</label><input class="pmt-val" id="pmtPair" readonly value="' + esc(cur.pair) + '"><button type="button" class="pmt-copy" data-copy="pmtPair">Copy</button>' +
        '<label for="pmtName">Name</label><input class="pmt-val" id="pmtName" maxlength="8" value="' + esc(cur.name) + '"><button type="button" class="pmt-copy" data-copy="pmtName">Copy</button>' +
      "</div>" +
      '<p class="pmt-warn" hidden></p>' +
      '<p class="pmt-note">' + (o.k === "c"
        ? "Crypto is typed as the pair, exactly as Binance.US lists it. The name is yours to pick, up to 8 characters; narrow ones fit best."
        : "Stocks start with <b>Stock:</b> and then the ticker. Class shares use a dash, like Stock:brk-b. The name is yours to pick, up to 8 characters; narrow ones fit best.") + "</p>";
    res.querySelectorAll(".pmt-copy").forEach(function (b) {
      b.addEventListener("click", function () {
        var v = document.getElementById(b.dataset.copy).value;
        (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(function () { b.textContent = "Copied"; }, function () { b.textContent = "Select"; document.getElementById(b.dataset.copy).select(); });
        setTimeout(function () { b.textContent = "Copy"; }, 1600);
      });
    });
    var nm = document.getElementById("pmtName");
    var warn = res.querySelector(".pmt-warn");
    nm.addEventListener("input", function () {
      cur.name = nm.value.slice(0, 8);
      var w = fitNote(cur.name); warn.innerHTML = w; warn.hidden = !w;
      paint();
    });
    if (o.k === "s") loadRec().then(function () { if (cur && cur.id === o.id) paint(); });
    startScreen();
  }

  function notFound(raw) {
    var t = raw.trim();
    cur = null; stopFeed();
    var sug = search(t).slice(0, 4).map(function (o) { return o.id; });
    res.innerHTML = '<div class="pmt-st no"><span class="pmt-dot"></span>' + esc(t || "Nothing") + " was not found</div>" +
      '<p class="pmt-sub">Crypto must be a pair listed on Binance.US, like BTCUSDT. Stocks must be US-listed, like TSLA.' +
      (sug.length ? " Did you mean " + sug.map(function (s) { return "<b>" + esc(s) + "</b>"; }).join(", ") + "?" : "") + "</p>";
    screenOff("<b>Nothing to show</b>" + esc(t || "That") + " is not in the Binance.US pair list or our US stock list, so the device would have no chart for it.");
    cap.textContent = "";
  }

  function caption(live, text) { cap.innerHTML = '<span class="pmt-live' + (live ? "" : " off") + '"></span>' + text; }
  function fmtRec(iso) { try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch (e) { return iso; } }

  function paint() {
    if (!cur) return;
    if (cur.k === "s") {
      var k = rec && rec.k[cur.id];
      if (k) {
        screenOn();
        PM.draw(cv, { name: cur.name, stock: true, tf: "1d", candles: PM.rows(k), date: new Date(rec.recorded) });
        caption(false, "Recorded " + fmtRec(rec.recorded) + " from Yahoo Finance, daily candles. Your browser can't load Yahoo, the device can: it refreshes every 15 s.");
      } else if (recP && !rec) {
        screenOff("<b>Loading the recorded chart\u2026</b>"); cap.textContent = "";
      } else {
        var x = stockMap.get(cur.id);
        screenOff("<b>" + esc(cur.id) + (x && x.n ? " \u00b7 " + esc(x.n) : "") + "</b>Supported. Type <code>" + esc(cur.pair) +
          "</code> on the setup page. We have no recorded chart for it, so there is no screen to show here: only the device can load Yahoo Finance.");
        cap.textContent = "";
      }
      return;
    }
    var K = feed && feed.data[cur.id];
    if (feed && feed.mode === "replay" && K) {
      screenOn();
      PM.draw(cv, { name: cur.name, tf: "1h", candles: K, date: new Date(feed.at * 1000) });
      caption(false, "Binance.US did not answer from this network, so this replays data recorded " + fmtRec(feed.recorded) + ". If Binance.US is blocked where you are, the device can't reach it either.");
    } else if (feed && (feed.mode === "replay" || feed.mode === "down")) {
      screenOff("<b>Can't reach Binance.US</b>There is no screen to show for " + esc(cur.id) + " from here.");
      caption(false, "Binance.US did not answer from this network. Some countries and networks block it; the device needs it too. Check the test links on our <a href=\"https://encinitas3d.com/supported-stock-crypto/\" target=\"_blank\" rel=\"noopener\">setup page</a>.");
    } else if (K && K.length) {
      screenOn();
      PM.draw(cv, { name: cur.name, tf: "1h", candles: K, busy: feed.busy });
      caption(!reduced, (reduced ? "From" : "Live from") + " Binance.US, the same feed the device uses. One-hour candles; the last one is still forming.");
    } else {
      screenOn();
      PM.draw(cv, { name: cur.name, candles: [] });
      caption(false, "Loading from Binance.US");
    }
  }

  function startScreen() {
    stopFeed();
    if (!cur) return;
    if (cur.k === "c" && visible) { feed = new PM.Feed([cur.id], "1h", paint); feed.still = reduced; }
    paint();
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      var v = es[0].isIntersecting;
      if (v === visible) return; visible = v;
      if (v) { loadStocks(); if (!cur) pickKey("c", "BTCUSDT"); else startScreen(); } else stopFeed();
    }, { rootMargin: "200px" }).observe(root);
  } else { visible = true; pickKey("c", "BTCUSDT"); }
  setInterval(function () { if (visible && cur && !document.hidden && new Date().getSeconds() === 0) paint(); }, 1000);
})();
