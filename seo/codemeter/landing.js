/* codeMeter SEO pages: the pace check.
   Draws the screen the plan really shows for numbers the visitor types in: the two-card screen
   (ui_show_usage) for plans with a 5-hour and a weekly limit, the single-limit screen
   (ui_show_usage_single) for ChatGPT Pro's weekly-only limit, the monthly screen
   (ui_show_usage_enterprise) for Team/Enterprise; drawn as marketing/previews/render.html does. Uses the
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
  function segs(el, x, y, h, pct, fill, off, n) { n = n || 18; var on = Math.floor((pct * n + 50) / 100); if (pct > 0 && !on) on = 1; for (var i = 0; i < n; i++) box(el, x + i * 10, y, 8, h, i < on ? fill : off); }
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

  // FSSB18 advances (FreeSansBold18pt7b): textWidth() of "NN%", for the inline "left" suffix
  function numW(t) { var w = 0; for (var i = 0; i < t.length; i++) w += t[i] === "%" ? 31 : 19; return w; }
  // the big number: Arial stands in for FreeSansBold18pt, so squeeze it to the firmware's own
  // width; then "100%" ends at x 112 as on the device, clear of the bar at x 116
  function bigNum(el, x, y, color, t) {
    var d = txt(el, x, y, 35, color, t, true), w = d.getBoundingClientRect().width / (el.getBoundingClientRect().width / 320 || 1);
    if (w > numW(t)) { d.style.transformOrigin = "0 0"; d.style.transform = "scaleX(" + (numW(t) / w).toFixed(3) + ")"; }
    return d;
  }
  function railOrEdge(el, y, h, p, T, codex) { // usg_card_edge(): 2 px pace outline, else the Codex rail
    if (p) { var o = box(el, 8, y, 304, h, "transparent", 10); o.style.boxShadow = "inset 0 0 0 2px " + col(p); }
    else if (codex) box(el, 8, y + 10, 3, h - 20, T.accent);
  }

  /* Two-card screen (ui_show_usage / usg_draw_value / usg_draw_reset): what every plan that
     reports both a 5-hour and a weekly limit shows (Claude Pro/Max, ChatGPT Plus). */
  function card(el, cardY, theme, win, used, reset) {
    var codex = theme === "codex", T = TH[theme], W = WIN[win], p = pace(used, reset, W);
    box(el, 8, cardY, 304, 96, T.surf, 10);
    railOrEdge(el, cardY, 96, p, T, codex);
    if (p) box(el, 288, cardY + 9, 12, 12, col(p), 6);              // corner dot (cx 302, cy +15, r 6)
    txt(el, 24, cardY + 9, 17, T.dim, codex ? (win === "5h" ? "5h limit" : "Weekly limit") : (win === "5h" ? "SESSION  (5h)" : "WEEKLY  (7d)"));
    var rowY = cardY + 34, shown = codex ? (used >= 100 ? 0 : 100 - used) : used, num = shown + "%";
    bigNum(el, 24, rowY, col(p, C.text), num);
    var barX = 116, barY = rowY + 3;
    if (codex) {
      txt(el, 24 + numW(num) + 4, rowY + 10, 17, T.dim, "left");
      barX += 30; segs(el, barX, barY, 14, shown, T.accent, T.off, 15);
    } else pill(el, barX, barY, 180, 14, shown, T.accent);
    var barW = codex ? 148 : 180, el_ = elapsed(reset, W), mk = codex ? 100 - el_ : el_;
    box(el, barX, barY + 16, barW, 3, C.bg);
    box(el, barX, barY + 16, Math.floor(barW * mk / 100), 3, p ? col(p) : codex ? T.dim : C.time);
    txt(el, 24, cardY + 68, 17, T.dim, "resets " + abs(reset) + "   in " + countdown(reset));
    return p;
  }

  /* Draw the screen. L = { "5h": {used, reset}, wk: {...}, mon: {...} }; win = the limit being edited. */
  function draw(el, theme, win, L, single) {
    var codex = theme === "codex", T = TH[theme], used = L[win].used, reset = L[win].reset, W = WIN[win];
    el.innerHTML = ""; el.style.background = C.bg;
    header(el, codex, T);
    if (win !== "mon" && !single) {
      var ps = card(el, 36, theme, "5h", L["5h"].used, L["5h"].reset);
      var pw = card(el, 138, theme, "wk", L.wk.used, L.wk.reset);
      return { pace: win === "5h" ? ps : pw, proj: project(used, reset, W) };
    }
    box(el, 8, 36, 304, 86, T.surf, 10); box(el, 8, 130, 304, 102, T.surf, 10);
    if (codex) { box(el, 8, 46, 3, 66, T.accent); box(el, 8, 140, 3, 82, T.accent); }
    var el_ = elapsed(reset, W), p, label, rows;
    if (win === "mon") { // ui_show_usage_enterprise: Claude Team / Enterprise
      var proj = project(used, reset, W); p = proj > 100 ? 2 : 0;
      txt(el, 24, 45, 17, T.dim, "USAGE"); txt(el, 296, 45, 17, T.dim, "MONTHLY", false, true);
      bigNum(el, 24, 68, p ? C.warn : C.text, used + "%");
      pill(el, 116, 71, 180, 18, used, T.accent);
      box(el, 116, 91, 180, 3, C.bg); box(el, 116, 91, Math.floor(180 * el_ / 100), 3, p ? C.warn : C.time);
      txt(el, 116, 98, 17, T.dim, el_ + "% into period");
      rows = [["RESETS", date(reset) + " in " + countdown(reset), C.text],
              ["PACE", proj === 0 ? "On track" : p ? "Over pace " + proj + "%" : "On track to use " + proj + "%", p ? C.warn : C.ok],
              ["PLAN", "Monthly usage", C.text]];
      label = { pace: p, proj: proj };
    } else { // ui_show_usage_single: a plan that reports only the weekly limit (ChatGPT Pro)
      p = pace(used, reset, W);
      txt(el, 24, 45, 17, T.dim, codex ? "Weekly limit" : "WEEKLY  (7d)");
      if (codex) {
        var left = used >= 100 ? 0 : 100 - used;
        bigNum(el, 24, 68, col(p, C.text), left + "%");
        txt(el, 24, 98, 17, T.dim, "left");
        segs(el, 116, 71, 18, left, T.accent, T.off);
        box(el, 116, 91, 178, 3, C.bg); box(el, 116, 91, Math.floor(178 * (100 - el_) / 100), 3, col(p, C.time));
        txt(el, 116, 98, 17, T.dim, (100 - el_) + "% of window");
      } else {
        bigNum(el, 24, 68, col(p, C.text), used + "%");
        pill(el, 116, 71, 180, 18, used, T.accent);
        box(el, 116, 91, 180, 3, C.bg); box(el, 116, 91, Math.floor(180 * el_ / 100), 3, col(p, C.time));
        txt(el, 116, 98, 17, T.dim, el_ + "% into window");
      }
      rows = [["RESETS", abs(reset) + "  in " + countdown(reset), C.text],
              ["PACE", p >= 2 ? "Over pace" : p === 1 ? "Ahead of pace" : "On track", p >= 2 ? C.err : p === 1 ? C.warn : C.ok],
              ["WINDOW", "7 days", C.text]];
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
    // A Codex mount that opens on Weekly is the ChatGPT Pro page: Pro reports only the weekly
    // limit, so the device shows its single-limit screen and there is no 5-hour tab.
    var single = theme === "codex" && win === "wk";
    var wins = single ? [["wk", "Weekly"]] : theme === "codex" ? [["5h", "5-hour"], ["wk", "Weekly"]] : [["wk", "Weekly"], ["5h", "5-hour"], ["mon", "Monthly"]];
    var id = "cmp" + Math.random().toString(36).slice(2, 7);
    m.innerHTML =
      '<div class="panel-dark"><div class="flat" data-flat><div class="screen cm-scr" role="img" aria-label="codeMeter screen for the numbers you entered"></div></div></div>' +
      '<form novalidate><div class="seg" role="group" aria-label="Which limit"' + (wins.length < 2 ? " style=\"display:none\"" : "") + '>' +
      wins.map(function (w) { return '<button type="button" data-w="' + w[0] + '">' + w[1] + "</button>"; }).join("") + "</div>" +
      '<label for="' + id + 'p"><span data-plab></span><input id="' + id + 'p" type="range" min="0" max="100" value="40"></label>' +
      '<div class="row"><label for="' + id + 'a"><span data-alab></span><input id="' + id + 'a" type="number" min="0"></label>' +
      '<label for="' + id + 'b"><span data-blab></span><input id="' + id + 'b" type="number" min="0"></label></div>' +
      '<output aria-live="polite"></output></form>';
    var scr = m.querySelector(".cm-scr"), out = m.querySelector("output"), rng = m.querySelector("input[type=range]");
    var a = m.querySelector("#" + id + "a"), b = m.querySelector("#" + id + "b");
    var DEF = { "5h": [1, 30], wk: [3, 12], mon: [12, 0] };
    // each limit keeps its own numbers; the tabs pick which one the inputs edit, and the
    // two-card screen always shows both, as the device does
    var V = {}; ["5h", "wk", "mon"].forEach(function (w) { V[w] = { v: theme === "codex" ? (w === "5h" ? 60 : 70) : (w === "5h" ? 40 : w === "wk" ? 55 : 40), a: DEF[w][0], b: DEF[w][1] }; });
    function units() {
      var big = win === "5h" ? "Hours" : "Days", small = win === "5h" ? "Minutes" : "Hours";
      m.querySelector("[data-alab]").textContent = big + " until reset";
      m.querySelector("[data-blab]").textContent = small;
      a.max = win === "5h" ? 5 : win === "wk" ? 7 : 31; b.max = win === "5h" ? 59 : 23;
    }
    function setWin(w) {
      win = w; units(); rng.value = V[w].v; a.value = V[w].a; b.value = V[w].b;
      Array.prototype.forEach.call(m.querySelectorAll(".seg button"), function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-w") === w ? "true" : "false"); });
      run();
    }
    function run() {
      V[win] = { v: +rng.value, a: a.value, b: b.value };
      var L = {};
      Object.keys(V).forEach(function (w) {
        var x = V[w], A = Math.max(0, +x.a || 0), B = Math.max(0, +x.b || 0);
        var rs = w === "5h" ? A * 3600 + B * 60 : A * 86400 + B * 3600;
        L[w] = { used: theme === "codex" ? 100 - x.v : x.v, reset: Math.max(60, Math.min(rs, WIN[w])) };
      });
      var v = V[win].v, used = L[win].used, reset = L[win].reset;
      m.querySelector("[data-plab]").innerHTML = (theme === "codex" ? "Left, as the Codex CLI shows it" : "Used so far") + " <small>" + v + "%</small>";
      var r = draw(scr, theme, win, L, single);
      out.innerHTML = say(theme, win, used, reset, r);
    }
    Array.prototype.forEach.call(m.querySelectorAll(".seg button"), function (x) { x.addEventListener("click", function () { setWin(x.getAttribute("data-w")); }); });
    [rng, a, b].forEach(function (x) { x.addEventListener("input", run); });
    m.querySelector("form").addEventListener("submit", function (e) { e.preventDefault(); });
    setWin(wins.some(function (w) { return w[0] === win; }) ? win : wins[0][0]);
    window.dispatchEvent(new Event("resize"));  // app.js scales [data-flat] to its box
  });
})();
