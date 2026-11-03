/* priceMeter SEO pages (seo/price.py): one ticker on the device canvas, plus copy buttons.
   canvas[data-pm] carries the ticker: data-kind (crypto|stock), data-pair, data-name, data-tf,
   data-k (the recorded 24 candles, [t,o,h,l,c,v]) and data-rec (when they were recorded).
   Crypto runs live from Binance.US through screen.js's Feed (REST, then the kline WebSocket, as the
   device does) and falls back to the recorded candles when Binance.US does not answer.
   Stocks always show the recorded Yahoo Finance candles: Yahoo has no CORS, only the device can load it. */
(function () {
  "use strict";
  var $$ = function (s) { return [].slice.call(document.querySelectorAll(s)); };

  var css = ".pm-code{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:#fff;border-radius:16px;padding:14px 14px 14px 22px;max-width:520px}" +
    ".pm-code code{font:600 22px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;flex:1;min-width:0;overflow-wrap:anywhere}" +
    ".pm-kv{display:grid;grid-template-columns:auto 1fr;gap:10px 28px;margin:0;max-width:760px}.pm-kv dt{color:var(--ink-3)}.pm-kv dd{margin:0;font-weight:600}" +
    ".pm-pills{display:flex;flex-wrap:wrap;gap:8px;list-style:none;padding:0;margin:0}.pm-pills li{background:#fff;border-radius:999px;padding:6px 14px;font-weight:600;font-size:15px}" +
    ".pm-pills a{text-decoration:none;color:var(--ink)}.pm-pills a:hover{text-decoration:underline}" +
    ".pm-tab{width:100%;border-collapse:collapse;font-size:16px}.pm-tab th,.pm-tab td{text-align:left;padding:9px 12px 9px 0;border-bottom:1px solid rgba(0,0,0,.08);vertical-align:top}" +
    ".pm-tab th{color:var(--ink-3);font-weight:500}.pm-tab a{color:var(--ink);font-weight:600}.pm-up{color:#3f7a00}.pm-dn{color:#b3261e}" +
    ".pm-syms{display:flex;flex-wrap:wrap;gap:6px 14px;margin:0}.pm-syms a{color:var(--ink);font-weight:600;text-decoration:none}.pm-syms a:hover{text-decoration:underline}" +
    ".pm-scroll{overflow-x:auto}.pm-cap{text-align:center;margin:14px 16px 0}.pm-grp{margin-top:28px}.pm-grp h3{font-size:19px;margin:0 0 12px}" +
    "@media (max-width:600px){.pm-code code{font-size:19px}.pm-kv{grid-template-columns:1fr;gap:2px}.pm-kv dd{margin-bottom:10px}.pm-hide-s{display:none}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  $$("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      var v = b.getAttribute("data-copy"), done = function (t) { b.textContent = t; setTimeout(function () { b.textContent = "Copy"; }, 1600); };
      (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(function () { done("Copied"); }, function () {
        var r = document.createRange(), code = b.parentNode.querySelector("code");
        if (code) { r.selectNodeContents(code); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
        done("Selected");
      });
    });
  });

  var PM = window.PriceMeter;
  if (!PM) return;
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function fmt(d) { try { return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch (e) { return ""; } }

  $$("canvas[data-pm]").forEach(function (cv) {
    var d = cv.dataset, K = [], rec = new Date(d.rec), name = PM.fitName([d.name, (d.pair || "").replace(/USDT$/, "")]), cap = d.cap && document.getElementById(d.cap);
    try { K = PM.rows(JSON.parse(d.k)); } catch (e) {}
    function say(t) { if (cap) cap.textContent = t; }
    function recorded(t) {
      if (K.length) PM.draw(cv, { name: name, stock: d.kind !== "crypto", tf: d.tf, candles: K, date: rec });
      else PM.draw(cv, { name: name, candles: [] }); // the device's frame before its first chart, no page text on the screen
      say(t);
    }
    if (d.kind !== "crypto") {
      recorded("Recorded " + fmt(rec) + " from Yahoo Finance, " + (d.tf === "1w" ? "weekly" : "daily") +
        " candles. Your browser can't load Yahoo, the device can: its price refreshes every 15 seconds.");
      return;
    }
    var pair = d.pair, feed;
    function paint() {
      if (document.hidden) return;
      var L = feed.data[pair];
      if ((feed.mode === "live" || feed.mode === "poll") && L && L.length) {
        PM.draw(cv, { name: name, tf: "1h", candles: L, busy: feed.busy });
        say((reduced ? "From" : "Live from") + " Binance.US, the feed the device uses. One-hour candles; the last one is still forming.");
      } else if (feed.mode === "replay" && L && L.length) {
        PM.draw(cv, { name: name, tf: "1h", candles: L, date: new Date(feed.at * 1000) });
        say("Binance.US did not answer from this network, so this replays recorded data. If it is blocked where you are, the device can't reach it either.");
      } else if (feed.mode === "replay" || feed.mode === "down") {
        recorded("Binance.US did not answer from this network, so this is the chart recorded " + fmt(rec) +
          ". If Binance.US is blocked where you are, the device can't reach it either.");
      }
    }
    PM.draw(cv, { name: name, candles: [] }); say("Loading from Binance.US");
    feed = new PM.Feed([pair], "1h", paint);
    feed.still = reduced;
    if (!reduced) setInterval(function () { if (new Date().getSeconds() === 0) paint(); }, 1000);
    document.addEventListener("visibilitychange", paint);
  });
})();
