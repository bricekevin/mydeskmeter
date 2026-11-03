/* codeMeter SEO pages: the pace check.
   Draws the firmware's single-limit screen (ui_show_usage_single / _enterprise, as
   marketing/previews/render.html does) for numbers the visitor types in, and uses the
   firmware's own rules: usg_pace_level() for 5-hour and weekly limits (amber when the
   budget left falls behind the time left, red when more than 10 points behind) and
   enterprise_projection_pct() for monthly limits (straight-line forecast once 10% of the
   period has passed). Mount: <div data-cm-pace data-win="wk|5h|mon" data-theme="claude|codex">. */
(function () {
  var mounts = document.querySelectorAll("[data-cm-pace]");
  if (!mounts.length) return;

  var C = { bg: "#000", text: "#F5F0E8", dim: "#8A8780", ok: "#6EA47A", warn: "#E0A050", err: "#C25450", time: "#8A8780" };
  var TH = {
    claude: { accent: "#DA7756", surf: "#26221E", dim: "#8A8780" },
    codex: { accent: "#58A6FF", surf: "#161B24", dim: "#7D8796", off: "#1F2A3A" }
  };
  var WIN = { "5h": 18000, wk: 604800, mon: 2629800 };
  var WDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function clock(d) { var h = d.getHours() % 12 || 12; return h + ":" + ("0" + d.getMinutes()).slice(-2) + (d.getHours() < 12 ? "am" : "pm"); }
  function abs(s) { var t = new Date(Date.now() + s * 1000); if (s < 86400) return clock(t); var h = t.getHours() % 12 || 12; return WDAY[t.getDay()] + " " + h + (t.getHours() < 12 ? "am" : "pm"); }
  function date(s) { var t = new Date(Date.now() + s * 1000); return MON[t.getMonth()] + " " + t.getDate(); }
  function countdown(s) { if (s < 60) return "<1m"; if (s < 86400) return Math.floor(s / 3600) + "h " + Math.floor((s % 3600) / 60) + "m"; return Math.floor(s / 86400) + "d " + Math.floor((s % 86400) / 3600) + "h"; }
  function pace(pct, reset, win) { if (!reset || !win) return 0; var budget = 100 - pct, tl = Math.min(100, Math.floor(reset * 100 / win)); if (budget < tl - 10) return 2; if (budget < tl) return 1; return 0; }
  function elapsed(reset, win) { var left = Math.min(reset, win); return Math.floor((win - left) * 100 / win); }
  function project(pct, reset, win) { var left = Math.min(reset, win), f = (win - left) / win; if (f < 0.10) return 0; return Math.min(255, Math.round(pct / f)); }
  function col(p, base) { return p >= 2 ? C.err : p === 1 ? C.warn : base; }

  function box(el, x, y, w, h, bg, r) { var d = document.createElement("div"); d.style.cssText = "left:" + x + "px;top:" + y + "px;width:" + w + "px;height:" + h + "px;background:" + bg + ";border-radius:" + (r || 0) + "px"; el.appendChild(d); return d; }
  function txt(el, x, y, size, color, text, bold, right) {
    var d = document.createElement("div"); d.textContent = text;
    d.style.cssText = "left:" + x + "px;top:" + (y - size * 0.17) + "px;font-size:" + size + "px;color:" + color + ";font-weight:" + (bold ? 700 : 400) + (right ? ";transform:translateX(-100%)" : "");
    el.appendChild(d); return d;
  }
  function pill(el, x, y, w, h, pct, fill) { box(el, x, y, w, h, C.bg, h / 2); if (pct > 0) { var fw = Math.max(h, Math.floor(w * Math.min(pct, 100) / 100)); box(el, x, y, fw, h, fill, h / 2); } }
  function segs(el, x, y, h, pct, fill, off) { var n = 18, on = Math.floor((pct * n + 50) / 100); if (pct > 0 && !on) on = 1; for (var i = 0; i < n; i++) box(el, x + i * 10, y, 8, h, i < on ? fill : off); }
  function header(el, codex, T) {
    if (codex) {
      box(el, 8, 7, 28, 18, T.accent, 3);
      var a = box(el, 13, 13, 8, 2, C.bg); a.style.transform = "rotate(45deg)";
      var b = box(el, 13, 17, 8, 2, C.bg); b.style.transform = "rotate(-45deg)";
      box(el, 23, 19, 8, 3, C.bg);
      txt(el, 43, 6, 23, T.accent, "codex", true);
    } else txt(el, 8, 5, 23, T.accent, "codeMeter", true);
    txt(el, 236, 8, 17, T.dim, clock(new Date()), false, true);
    var bat = box(el, 245, 11, 17, 11, "transparent"); bat.style.boxShadow = "inset 0 0 0 1px " + T.dim;
    box(el, 262, 14, 2, 5, T.dim); box(el, 247, 13, 13, 7, C.text);
    for (var i = 0; i < 4; i++) box(el, 270 + i * 5, 22 - (4 + i * 3), 3, 4 + i * 3, C.text);
    box(el, 303, 11, 10, 10, C.ok, 5);
  }

  /* Draw one limit. used = percent used (0-100); reset = seconds to reset. */
  function draw(el, theme, win, used, reset) {
    var codex = theme === "codex", T = TH[theme], W = WIN[win];
    el.innerHTML = ""; el.style.background = C.bg;
    header(el, codex, T);
    box(el, 8, 36, 304, 86, T.surf, 10); box(el, 8, 130, 304, 102, T.surf, 10);
    if (codex) { box(el, 8, 46, 3, 66, T.accent); box(el, 8, 140, 3, 82, T.accent); }
    var el_ = elapsed(reset, W), p, label, rows;
    if (win === "mon") {
      var proj = project(used, reset, W); p = proj > 100 ? 2 : 0;
      txt(el, 24, 45, 17, T.dim, "USAGE"); txt(el, 296, 45, 17, T.dim, "MONTHLY", false, true);
      txt(el, 24, 68, 35, p ? C.warn : C.text, used + "%", true);
      pill(el, 116, 71, 180, 18, used, T.accent);
      box(el, 116, 91, 180, 3, C.bg); box(el, 116, 91, Math.floor(180 * el_ / 100), 3, p ? C.warn : C.time);
      txt(el, 116, 98, 17, T.dim, el_ + "% into period");
      rows = [["RESETS", date(reset) + " in " + countdown(reset), C.text],
              ["PACE", proj === 0 ? "On track" : p ? "Over pace " + proj + "%" : "On track to use " + proj + "%", p ? C.warn : C.ok],
              ["PLAN", "Monthly usage", C.text]];
      label = { pace: p, proj: proj };
    } else {
      p = pace(used, reset, W);
      var title = codex ? (win === "5h" ? "5h limit" : "Weekly limit") : (win === "5h" ? "SESSION  (5h)" : "WEEKLY  (7d)");
      txt(el, 24, 45, 17, T.dim, title);
      if (codex) {
        var left = 100 - used, n = txt(el, 24, 68, 35, col(p, C.text), left + "%", true);
        txt(el, 24, 103, 15, T.dim, "left");
        segs(el, 116, 71, 18, left, T.accent, T.off);
        box(el, 116, 91, 178, 3, C.bg); box(el, 116, 91, Math.floor(178 * (100 - el_) / 100), 3, col(p, T.dim));
      } else {
        txt(el, 24, 68, 35, col(p, C.text), used + "%", true);
        pill(el, 116, 71, 180, 18, used, T.accent);
        box(el, 116, 91, 180, 3, C.bg); box(el, 116, 91, Math.floor(180 * el_ / 100), 3, col(p, C.time));
      }
      txt(el, 116, 98, 17, T.dim, el_ + "% into window");
      rows = [["RESETS", abs(reset) + "  in " + countdown(reset), C.text],
              ["PACE", p >= 2 ? "Over pace" : p === 1 ? "Ahead of pace" : "On track", p >= 2 ? C.err : p === 1 ? C.warn : C.ok],
              ["WINDOW", win === "5h" ? "5 hours" : "7 days", C.text]];
      if (p) { var o = box(el, 8, 36, 304, 86, "transparent", 10); o.style.boxShadow = "inset 0 0 0 2px " + col(p); box(el, 288, 45, 12, 12, col(p), 6); }
      label = { pace: p, proj: project(used, reset, W) };
    }
    rows.forEach(function (r, i) { txt(el, 24, 146 + i * 30, 17, T.dim, r[0]); txt(el, 116, 146 + i * 30, 17, r[2], r[1]); });
    return label;
  }

  function say(theme, win, used, reset, r) {
    var W = WIN[win], gone = elapsed(reset, W), name = win === "5h" ? "5-hour" : win === "wk" ? "weekly" : "monthly";
    var has = theme === "codex" ? (100 - used) + "% left" : used + "% used";
    var s = "<b>" + has + "</b> with " + gone + "% of the " + name + " window gone. ";
    if (win === "mon") {
      s += r.proj === 0 ? "Too early in the month to forecast; the screen says On track." :
        r.pace ? "At this rate you would reach <b>" + r.proj + "%</b> by the reset: the screen turns amber." :
        "At this rate you would use about <b>" + r.proj + "%</b> by the reset.";
    } else {
      s += r.pace === 0 ? "You are on track: the number stays white." :
        r.pace === 1 ? "You are a little ahead of the clock: the number turns <b>amber</b>." :
        "You are more than 10 points ahead of the clock: the number turns <b>red</b>.";
      if (r.proj > 100) s += " At this rate you hit the limit before it resets.";
    }
    return s;
  }

  Array.prototype.forEach.call(mounts, function (m) {
    var theme = m.getAttribute("data-theme") || "claude", win = m.getAttribute("data-win") || "wk";
    var wins = theme === "codex" ? [["5h", "5-hour"], ["wk", "Weekly"]] : [["wk", "Weekly"], ["5h", "5-hour"], ["mon", "Monthly"]];
    var id = "cmp" + Math.random().toString(36).slice(2, 7);
    m.innerHTML =
      '<div class="panel-dark"><div class="flat" data-flat><div class="screen cm-scr" role="img" aria-label="codeMeter screen for the numbers you entered"></div></div></div>' +
      '<form novalidate><div class="seg" role="group" aria-label="Which limit">' +
      wins.map(function (w) { return '<button type="button" data-w="' + w[0] + '">' + w[1] + "</button>"; }).join("") + "</div>" +
      '<label for="' + id + 'p"><span data-plab></span><input id="' + id + 'p" type="range" min="0" max="100" value="40"></label>' +
      '<div class="row"><label for="' + id + 'a"><span data-alab></span><input id="' + id + 'a" type="number" min="0"></label>' +
      '<label for="' + id + 'b"><span data-blab></span><input id="' + id + 'b" type="number" min="0"></label></div>' +
      '<output aria-live="polite"></output></form>';
    var scr = m.querySelector(".cm-scr"), out = m.querySelector("output"), rng = m.querySelector("input[type=range]");
    var a = m.querySelector("#" + id + "a"), b = m.querySelector("#" + id + "b");
    var DEF = { "5h": [1, 30], wk: [3, 12], mon: [12, 0] };
    function units() {
      var big = win === "5h" ? "Hours" : "Days", small = win === "5h" ? "Minutes" : "Hours";
      m.querySelector("[data-alab]").textContent = big + " until reset";
      m.querySelector("[data-blab]").textContent = small;
      a.max = win === "5h" ? 5 : win === "wk" ? 7 : 31; b.max = win === "5h" ? 59 : 23;
    }
    function setWin(w) {
      win = w; units(); a.value = DEF[w][0]; b.value = DEF[w][1];
      Array.prototype.forEach.call(m.querySelectorAll(".seg button"), function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-w") === w ? "true" : "false"); });
      run();
    }
    function run() {
      var v = +rng.value, used = theme === "codex" ? 100 - v : v;
      m.querySelector("[data-plab]").innerHTML = (theme === "codex" ? "Left, as the Codex CLI shows it" : "Used so far") + " <small>" + v + "%</small>";
      var A = Math.max(0, +a.value || 0), B = Math.max(0, +b.value || 0);
      var reset = win === "5h" ? A * 3600 + B * 60 : A * 86400 + B * 3600;
      reset = Math.max(60, Math.min(reset, WIN[win]));
      var r = draw(scr, theme, win, used, reset);
      out.innerHTML = say(theme, win, used, reset, r);
    }
    Array.prototype.forEach.call(m.querySelectorAll(".seg button"), function (x) { x.addEventListener("click", function () { setWin(x.getAttribute("data-w")); }); });
    [rng, a, b].forEach(function (x) { x.addEventListener("input", run); });
    m.querySelector("form").addEventListener("submit", function (e) { e.preventDefault(); });
    if (theme === "codex") rng.value = 60;
    setWin(wins.some(function (w) { return w[0] === win; }) ? win : wins[0][0]);
    window.dispatchEvent(new Event("resize"));  // app.js scales [data-flat] to its box
  });
})();
