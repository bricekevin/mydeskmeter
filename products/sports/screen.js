/* sportsMeter live screen: a canvas copy of the firmware's 320x240 team screens.
   Layout, sizes and colours follow ~/GIT/sportsMeter/sportsmeter/ui.ino (draw_titlebar,
   draw_idle, draw_game_card, draw_stats_strip, draw_live) and sports_fmt.cpp (colour rules).
   Font sizes were measured against the hardware captures in sportsMeter/docs/screens/hw_*.png:
   FreeSans 9pt = 18px, FreeSansBold 12pt = 24px, FreeSansBold 18pt = 34px (x2 = 67px).
   Logos come from the same image host the device uses; until one loads (or if it cannot),
   the firmware's colour badge is drawn instead.
   Exposes window.SportsMeter for tool.js. */
(function () {
  "use strict";
  var SM = window.SportsMeter = {};
  var FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  var F9 = "18px " + FONT, B9 = "bold 18px " + FONT, B12 = "bold 24px " + FONT,
      B18 = "bold 34px " + FONT, B12x2 = "bold 48px " + FONT, B18x2 = "bold 67px " + FONT;
  var C = { bg: 0x0A0A0C, surface: 0x16161B, surface2: 0x26282F, text: 0xF2F2F4, dim: 0x80808A,
            faint: 0x55555E, ok: 0x3FB950, warn: 0xE0A050, err: 0xE5534B };
  var LOGO_BIG = 76, LOGO_SMALL = 44;
  SM.ROTATE_MS = 12000;

  /* ---------- colour rules (sports_fmt.cpp) ---------- */
  function hex(s, fb) { s = (s || "").replace("#", ""); return /^[0-9a-f]{6}$/i.test(s) ? parseInt(s, 16) : fb; }
  // What the panel shows: colours pass through RGB565.
  function css(c) {
    var r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    r = (r >> 3) * 255 / 31 | 0; g = (g >> 2) * 255 / 63 | 0; b = (b >> 3) * 255 / 31 | 0;
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  function luma(c) { return (((c >> 16) & 255) * 54 + ((c >> 8) & 255) * 183 + (c & 255) * 19) >> 8; }
  function readsOnDark(c) {
    var l = luma(c); if (l >= 80) return true;
    return Math.max((c >> 16) & 255, (c >> 8) & 255, c & 255) >= 200 && l >= 45;
  }
  function lighten(c, pct) {
    var o = 0;
    [16, 8, 0].forEach(function (s) { var v = (c >> s) & 255; v += Math.floor((255 - v) * pct / 100); o |= v << s; });
    return o;
  }
  function accent(t) {
    if (readsOnDark(t.c)) return t.c;
    if (readsOnDark(t.a)) return t.a;
    for (var p = 30; p <= 90; p += 15) { var c = lighten(t.c, p); if (readsOnDark(c)) return c; }
    return 0xF2F2F4;
  }
  function badgeInk(bg, alt) {
    var d = Math.abs(luma(bg) - luma(alt));
    if (d >= 90) return alt;
    return luma(bg) < 140 ? 0xFFFFFF : 0x000000;
  }
  SM.accentCss = function (t) { return css(accent(t)); };

  /* ---------- teams ---------- */
  var LOGO_DIR = { nfl: "nfl", nba: "nba", wnba: "wnba", mlb: "mlb", nhl: "nhl", ncaaf: "ncaa", ncaam: "ncaa", ncaaw: "ncaa" };
  // A row of data/teams.json: [id, name, short, abbr, color, alt, logo]
  SM.team = function (lg, row, lgLabel) {
    var d = LOGO_DIR[lg] || "soccer", l = row[6];
    var logo = l === 1 ? "/i/teamlogos/" + d + "/500/" + row[0] + ".png"
             : l === 2 ? "/i/teamlogos/" + d + "/500/" + row[3].toLowerCase() + ".png"
             : l ? String(l) : "";
    return { lg: lg, id: String(row[0]), full: row[1], name: row[2] || row[1], abbr: row[3],
             c: hex(row[4], 0x55555E), a: hex(row[5], 0xF2F2F4), logo: logo, label: lgLabel || "" };
  };

  /* ---------- logos (logo_cache.ino: the dark variant first, then the plain one) ---------- */
  var LOGOS = {}, waiters = [];
  SM.onLogo = function (fn) { waiters.push(fn); };
  function logoUrl(path, size) { return "https://a.espncdn.com/combiner/i?img=" + path + "&w=" + size * 2 + "&h=" + size * 2; }
  function logo(path, size) {
    if (!path || SM.noLogos) return null;
    var key = path + "@" + size, e = LOGOS[key];
    if (!e) {
      e = LOGOS[key] = { ok: false, img: new Image() };
      var tries = [];
      if (path.indexOf("/500/") >= 0) tries.push(path.replace("/500/", "/500-dark/"));
      tries.push(path);
      e.img.crossOrigin = "anonymous";
      e.img.decoding = "async";
      e.img.onload = function () { e.ok = true; waiters.forEach(function (f) { f(); }); };
      e.img.onerror = function () { if (tries.length) e.img.src = logoUrl(tries.shift(), size); else e.failed = true; };
      e.img.src = logoUrl(tries.shift(), size);
    }
    return e.ok ? e.img : null;
  }
  SM.preload = function (t) { logo(t.logo, LOGO_BIG); logo(t.logo, LOGO_SMALL); };
  SM.logosSettled = function () {
    return Object.keys(LOGOS).every(function (k) { return LOGOS[k].ok || LOGOS[k].failed; });
  };

  /* ---------- drawing primitives (TFT_eSPI datums) ---------- */
  var X; // current 2d context, in 320x240 units
  function rect(x, y, w, h, c) { X.fillStyle = css(c); X.fillRect(x, y, w, h); }
  function rrect(x, y, w, h, r, c, stroke) {
    X.beginPath();
    if (X.roundRect) X.roundRect(x, y, w, h, r);
    else { X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
    if (stroke) { X.strokeStyle = css(c); X.lineWidth = 1; X.stroke(); } else { X.fillStyle = css(c); X.fill(); }
  }
  function circle(x, y, r, c) { X.beginPath(); X.arc(x, y, r, 0, Math.PI * 2); X.fillStyle = css(c); X.fill(); }
  function size(font) { return parseFloat(/(\d+)px/.exec(font)[1]); }
  function tw(s, font) { X.font = font; return X.measureText(s).width; }
  // datum: "ml" | "mr" | "mc"; y is the datum's vertical middle as on the device.
  function text(s, x, y, datum, font, c) {
    X.font = font; X.fillStyle = css(c); X.textBaseline = "alphabetic";
    X.textAlign = datum === "ml" ? "left" : datum === "mr" ? "right" : "center";
    X.fillText(s, x, y + 0.36 * size(font) + 2);
  }
  function fit(s, maxW, font) {
    s = String(s);
    if (tw(s, font) <= maxW) return s;
    while (s.length > 1 && tw(s + "..", font) > maxW) s = s.slice(0, -1);
    return s.trim() + "..";
  }

  function badge(x, y, w, h, abbr, known, color, alt) {
    var fill = known ? color : C.surface2, ink = known ? badgeInk(color, alt) : C.text;
    rrect(x, y, w, h, 8, fill);
    if (known && luma(color) < 45) rrect(x + 0.5, y + 0.5, w - 1, h - 1, 8, accent({ c: color, a: alt }), true);
    var f = B18;
    if (tw(abbr, f) > w - 10) f = B12;
    if (tw(abbr, f) > w - 10) f = B9;
    text(abbr, x + w / 2, y + h / 2 - 2, "mc", f, ink);
  }
  function drawLogo(path, sz, x, y) {
    var img = logo(path, sz); if (!img) return false;
    var k = Math.min(sz / img.naturalWidth, sz / img.naturalHeight);
    var w = img.naturalWidth * k, h = img.naturalHeight * k;
    X.drawImage(img, x + (sz - w) / 2, y + (sz - h) / 2, w, h);
    return true;
  }

  /* ---------- title bar ---------- */
  function clockText(d) { var h = d.getHours() % 12 || 12; return h + ":" + ("0" + d.getMinutes()).slice(-2) + (d.getHours() < 12 ? "am" : "pm"); }
  SM.clockText = clockText;
  function titlebar(m) {
    var t = m.t, dark = luma(t.c) < 28;
    var bg = dark ? C.surface : t.c, ink = dark ? accent(t) : badgeInk(t.c, t.a);
    var dim = dark ? C.dim : luma(t.c) < 140 ? 0xD8D8DC : 0x202024;
    rect(0, 0, 320, 30, bg);
    var f = tw(t.name, B12) > 154 ? B9 : B12;
    text(fit(t.name, 154, f), 8, 15, "ml", f, ink);
    text(m.clock || clockText(new Date()), 238, 15, "mr", F9, dim);
    // battery (full, on USB power)
    X.strokeStyle = css(dim); X.lineWidth = 1; X.strokeRect(247.5, 9.5, 16, 10);
    rect(264, 13, 2, 5, dim); rect(249, 11, 13, 7, dim);
    for (var i = 0; i < 4; i++) { var bh = 4 + i * 3; rect(274 + i * 5, 21 - bh, 3, bh, dim); }
    circle(308, 15, 6, C.bg); circle(308, 15, 4, m.dot || C.ok);
    var n = m.count || 1;
    if (n > 1) {
      var x0 = (320 - (n * 10 - 4)) / 2, rot = m.rotate !== false;
      for (var p = 0; p < n; p++)
        rect(x0 + p * 10 + (rot || p === m.idx ? 0 : 2), 32, rot || p === m.idx ? 6 : 2, 2, p === m.idx ? accent(t) : C.faint);
    }
  }

  /* ---------- idle screen ---------- */
  function shortStanding(s, maxW, font) {
    s = String(s || "").replace("Mexican Liga BBVA MX", "Liga MX").replace("English Premier League", "Premier League")
      .replace("Spanish LALIGA", "LaLiga").replace("German Bundesliga", "Bundesliga").replace("Italian Serie A", "Serie A").replace("French Ligue 1", "Ligue 1");
    if (tw(s, font) > maxW) s = s.replace(" Division", "");
    if (tw(s, font) > maxW) s = s.replace("Conference", "Conf");
    return fit(s, maxW, font);
  }
  function gameCard(m) {
    var t = m.t, g = m.g || { state: "none" }, ac = accent(t);
    var x = 8, y = 138, w = 304, h = 62;
    var gameDay = g.state === "pre" && g.gameDay;
    var fill = gameDay && luma(t.c) >= 28;
    var cardBg = fill ? t.c : C.surface, dayInk = fill ? badgeInk(t.c, t.a) : ac;
    var dimInk = fill ? dayInk : C.dim, mainInk = fill ? dayInk : C.text;
    rrect(x, y, w, h, 10, cardBg);
    if (gameDay && !fill) { rrect(x + 0.5, y + 0.5, w - 1, h - 1, 10, ac, true); rrect(x + 1.5, y + 1.5, w - 3, h - 3, 9, ac, true); }
    var label = (g.state === "final" ? (g.detail || "Final") : gameDay ? "GAME DAY" : g.state === "pre" ? "NEXT GAME"
              : g.state === "live" ? "LIVE" : "SCHEDULE").toUpperCase();
    var lf = gameDay ? B9 : F9;
    text(label, x + 12, y + 16, "ml", lf, gameDay ? dayInk : C.dim);
    var extraW = w - 40 - tw(label, lf), extra = g.note || "";
    if (g.tv && g.state !== "final") {
      var both = extra + (extra ? "  " : "") + g.tv;
      if (tw(both, F9) <= extraW || !extra) extra = both;
    }
    text(fit(extra, extraW, F9), x + w - 12, y + 16, "mr", F9, dimInk);
    var my = y + 42, opp = (g.home ? "vs " : "at ") + (g.opp ? g.opp.abbr : "");
    if (g.state === "none" || !g.opp) {
      text("No game scheduled", x + 12, my, "ml", F9, C.dim);
    } else if (g.state === "final" && g.us >= 0 && g.them >= 0) {
      var res = g.us > g.them ? "W" : g.us < g.them ? "L" : "T";
      text(res + " " + g.us + "-" + g.them, x + 12, my, "ml", B12, g.us > g.them ? C.ok : g.us < g.them ? C.err : C.text);
      text(opp, x + w - 12, my, "mr", B12, C.text);
    } else {
      text(opp, x + 12, my, "ml", B12, mainInk);
      var right = g.state === "pre" ? (g.when || "") : (g.detail || "");
      if (gameDay) { right = right.replace("Today ", ""); if (right === "Today") right = "Time TBD"; }
      var oppW = tw(opp, B12), f = oppW + tw(right, B12) > w - 36 ? B9 : B12;
      oppW = tw(opp, B12);
      text(fit(right, w - 36 - oppW, f), x + w - 12, my, "mr", f, gameDay ? dayInk : C.text);
    }
  }
  function strip(m) {
    var s = m.s || {}, kind = m.t.sport || "football", table = kind === "hockey" || kind === "soccer";
    var forL = kind === "baseball" ? "RS" : table ? "GF" : "PF", agL = kind === "baseball" ? "RA" : table ? "GA" : "PA";
    var cells = [];
    var sk = s.streak > 0 ? "W" + s.streak : s.streak < 0 ? "L" + (-s.streak) : "";
    if (table && s.points >= 0) cells.push(["PTS", String(s.points)]);
    else if (sk) cells.push(["STRK", sk]);
    if (s.pf >= 0) cells.push([forL, String(s.pf)]);
    if (s.pa >= 0) cells.push([agL, String(s.pa)]);
    if (s.home && s.away && ((m.page || 0) === 0 || !cells.length)) cells = [["HOME", s.home], ["AWAY", s.away]];
    var x = 8, n = cells.length;
    cells.forEach(function (c, i) {
      var w = n === 3 ? (i === 0 ? 110 : (304 - 110 - 12) / 2) : (304 - (n - 1) * 6) / n;
      rrect(x, 206, w, 30, 8, C.surface);
      text(c[0], x + 10, 220, "ml", F9, C.dim);
      var lw = tw(c[0], F9);
      text(fit(c[1], w - lw - 22, B9), x + w - 10, 220, "mr", B9, C.text);
      x += w + 6;
    });
  }
  function idle(m) {
    var t = m.t;
    rrect(8, 36, 304, 96, 10, C.surface);
    if (!drawLogo(t.logo, LOGO_BIG, 18, 46)) badge(18, 46, 76, 76, t.abbr, true, t.c, t.a);
    text(t.label, 300, 49, "mr", F9, C.dim);
    if (m.rec) {
      var f = B18x2;
      if (tw(m.rec, f) > 194) f = B12x2;
      if (tw(m.rec, f) > 194) f = B18;
      text(m.rec, 106, 84, "ml", f, C.text);
    } else text(m.loading ? "Loading..." : "Season ahead", 106, 84, "ml", B12, C.text);
    text(shortStanding(m.stand, 194, F9), 106, 121, "ml", F9, accent(t));
    gameCard(m);
    strip(m);
  }

  /* ---------- live screen ---------- */
  function bases(cx, cy, on, color) {
    [[12, 0, 1], [0, -12, 2], [-12, 0, 4]].forEach(function (p) {
      var x = cx + p[0], y = cy + p[1];
      X.beginPath(); X.moveTo(x - 7, y); X.lineTo(x, y - 7); X.lineTo(x + 7, y); X.lineTo(x, y + 7); X.closePath();
      X.fillStyle = css(on & p[2] ? color : C.faint); X.fill();
    });
  }
  function live(m) {
    var t = m.t, g = m.g, ac = accent(t);
    rrect(8, 36, 304, 122, 10, C.surface);
    var usLeft = !g.home, colW = 104;
    for (var side = 0; side < 2; side++) {
      var us = (side === 0) === usLeft, x = side === 0 ? 16 : 200, o = g.opp || { abbr: "OPP" };
      if (!drawLogo(us ? t.logo : o.logo, LOGO_SMALL, x + 30, 43)) {
        if (us) badge(x + 14, 46, colW - 28, 38, t.abbr, true, t.c, t.a);
        else badge(x + 14, 46, colW - 28, 38, o.abbr, o.c != null, o.c, o.a);
      }
      var sc = us ? g.us : g.them, s = sc >= 0 ? String(sc) : "-";
      text(s, x + colW / 2, 122, "mc", tw(s, B18x2) > colW ? B12x2 : B18x2, us ? C.text : C.dim);
      if (g.poss != null && g.poss >= 0 && (g.poss === 1) === us) rrect(x + colW / 2 - 14, 149, 28, 4, 2, ac);
    }
    rrect(138, 48, 44, 18, 9, C.err);
    text("LIVE", 160, 56, "mc", B9, C.text);
    var top = g.detail || "", bottom = "", dash = top.indexOf(" - "), midW = 304 - 2 * (colW + 8) - 4;
    if (dash > 0) { bottom = top.slice(dash + 3); top = top.slice(0, dash); }
    var sp = top.lastIndexOf(" ");
    if (dash <= 0 && sp > 0 && tw(top, B9) > midW) { bottom = top.slice(sp + 1); top = top.slice(0, sp); }
    var f = B12;
    if (tw(top, f) > midW) f = B9;
    if (tw(top, f) > midW) f = F9;
    text(fit(top, midW, f), 160, 36 + (bottom ? 62 : 72), "mc", f, C.text);
    if (bottom) text(fit(bottom, midW, F9), 160, 122, "mc", F9, C.dim);

    rrect(8, 164, 304, 38, 10, C.surface);
    if (g.outs != null && g.outs >= 0) {
      bases(48, 189, g.bases || 0, ac);
      text(g.balls + "-" + g.strikes + "   " + g.outs + " out", 176, 182, "mc", B12, C.text);
    } else if (g.sit) {
      text(fit(g.sit, 280, B12), 160, 182, "mc", B12, C.text);
    } else {
      var line = (g.note || "") + (g.tv ? (g.note ? "  " : "") + g.tv : "");
      text(fit(line || (g.home ? "Home game" : "On the road"), 280, F9), 160, 182, "mc", F9, C.dim);
    }
    text(m.rec || "", 12, 222, "ml", F9, C.text);
    text(shortStanding(m.stand, 304 - tw(m.rec || "", F9) - 24, F9), 308, 222, "mr", F9, C.dim);
  }

  /* ---------- one frame ---------- */
  SM.draw = function (canvas, m) {
    var ctx = canvas.getContext("2d"), k = canvas.width / 320;
    X = ctx;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    rect(0, 0, 320, 240, C.bg);
    titlebar(m);
    if (m.g && m.g.state === "live") live(m); else idle(m);
  };

  /* ---------- game time, as fmt_game_when ---------- */
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function dayDiff(a, b) { return Math.round((new Date(a.getFullYear(), a.getMonth(), a.getDate()) - new Date(b.getFullYear(), b.getMonth(), b.getDate())) / 864e5); }
  SM.when = function (start, now, tbd) {
    var d = dayDiff(start, now);
    var day = d === 0 ? "Today" : d === 1 ? "Tomorrow" : d >= 2 && d <= 6 ? DOW[start.getDay()] : MON[start.getMonth()] + " " + start.getDate();
    if (tbd || d < 0) return { text: day, days: d };
    var h = start.getHours() % 12 || 12;
    return { text: day + " " + h + ":" + ("0" + start.getMinutes()).slice(-2) + (start.getHours() < 12 ? "am" : "pm"), days: d };
  };

  /* ---------- the demo: six real teams, one per sport plus college (sample numbers) ---------- */
  function T(lg, row, label, sport) { var t = SM.team(lg, row, label); t.sport = sport; return t; }
  var KC = T("nfl", ["12", "Kansas City Chiefs", "Chiefs", "KC", "e31837", "ffb612", 2], "NFL", "football");
  var DEN = T("nfl", ["7", "Denver Broncos", "Broncos", "DEN", "0a2343", "fc4c02", 2], "NFL", "football");
  var NYJ = T("nfl", ["20", "New York Jets", "Jets", "NYJ", "115740", "ffffff", 2], "NFL", "football");
  var LAL = T("nba", ["13", "Los Angeles Lakers", "Lakers", "LAL", "552583", "fdb927", 2], "NBA", "basketball");
  var GS = T("nba", ["9", "Golden State Warriors", "Warriors", "GS", "fdb927", "1d428a", 2], "NBA", "basketball");
  var LAD = T("mlb", ["19", "Los Angeles Dodgers", "Dodgers", "LAD", "005a9c", "ffffff", 2], "MLB", "baseball");
  var SD = T("mlb", ["25", "San Diego Padres", "Padres", "SD", "2f241d", "ffc425", 2], "MLB", "baseball");
  var TOR = T("nhl", ["21", "Toronto Maple Leafs", "Maple Leafs", "TOR", "003e7e", "ffffff", 2], "NHL", "hockey");
  var MTL = T("nhl", ["10", "Montreal Canadiens", "Canadiens", "MTL", "c41230", "013a81", 2], "NHL", "hockey");
  var ARS = T("epl", ["359", "Arsenal", "Arsenal", "ARS", "e20520", "003399", 1], "Premier League", "soccer");
  var CHE = T("epl", ["363", "Chelsea", "Chelsea", "CHE", "144992", "ffffff", 1], "Premier League", "soccer");
  var MICH = T("ncaaf", ["130", "Michigan Wolverines", "Michigan", "MICH", "00274c", "ffcb05", 1], "College FB", "football");
  var OSU = T("ncaaf", ["194", "Ohio State Buckeyes", "Ohio State", "OSU", "ba0c2f", "a8adb4", 1], "College FB", "football");
  SM.DEMO_TEAMS = [KC, LAL, LAD, TOR, ARS, MICH];

  // Season numbers are samples (as in the store's renders), not a team's real record.
  function at(days, h, min) { var d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, min || 0, 0, 0); return d; }
  function pre(opp, home, days, h, min, note, tv) { var w = SM.when(at(days, h, min), new Date()); return { state: "pre", opp: opp, home: home, when: w.text, gameDay: w.days === 0, note: note || "", tv: tv || "" }; }
  SM.DEMO = {
    KC: { t: KC, rec: "7-2", stand: "1st in AFC West", s: { streak: 3, pf: 231, pa: 164, home: "4-0", away: "3-2" }, g: pre(NYJ, true, 4, 13, 0, "Week 11", "CBS") },
    LAL: { t: LAL, rec: "6-3", stand: "3rd in Pacific Division", s: { streak: 2, pf: 1041, pa: 1006, home: "4-1", away: "2-2" }, g: pre(GS, true, 0, 19, 30, "", "ESPN") },
    LAD: { t: LAD, rec: "93-69", stand: "1st in NL West", s: { streak: 2, pf: 825, pa: 680, home: "52-29", away: "41-40" }, g: { state: "final", detail: "Final", opp: SD, home: false, us: 5, them: 3, note: "NLDS - Game 4" } },
    TOR: { t: TOR, rec: "8-4-1", stand: "2nd in Atlantic Division", s: { points: 17, pf: 44, pa: 36, home: "5-1-0", away: "3-3-1" }, g: pre(MTL, true, 1, 19, 0, "", "SN") },
    ARS: { t: ARS, rec: "8-1-1", stand: "1st in English Premier League", s: { points: 25, pf: 21, pa: 6, home: "5-0-0", away: "3-1-1" }, g: { state: "final", detail: "FT", opp: CHE, home: true, us: 2, them: 1 } },
    MICH: { t: MICH, rec: "7-2", stand: "3rd in Big Ten", s: { streak: 1, pf: 284, pa: 152, home: "5-0", away: "2-2" }, g: pre(OSU, false, 0, 12, 0, "Week 11", "FOX") }
  };
  // Live games for the static screens and the hero (the sport's own details).
  SM.DEMO_LIVE = {
    KC: { state: "live", opp: DEN, home: true, us: 20, them: 17, detail: "1:52 - 4th", poss: 1, sit: "1st & 10 at DEN 38" },
    LAL: { state: "live", opp: GS, home: true, us: 88, them: 81, detail: "5:18 - 3rd" },
    LAD: { state: "live", opp: SD, home: true, us: 4, them: 2, detail: "Bot 7th", balls: 2, strikes: 1, outs: 1, bases: 5 },
    TOR: { state: "live", opp: MTL, home: true, us: 3, them: 2, detail: "11:40 - 2nd", note: "", tv: "SN" },
    ARS: { state: "live", opp: CHE, home: true, us: 1, them: 0, detail: "67'", tv: "USA" },
    MICH: { state: "live", opp: OSU, home: false, us: 21, them: 17, detail: "6:05 - 3rd", poss: 0, sit: "3rd & 4 at MICH 41" }
  };
  SM.DEMO_ORDER = ["KC", "LAL", "LAD", "TOR", "ARS", "MICH"];
  SM.demoModel = function (key, state, extra) {
    var d = SM.DEMO[key], m = { t: d.t, rec: d.rec, stand: d.stand, s: d.s, g: d.g, idx: 0, count: 1, page: 0 };
    if (state === "live") m.g = SM.DEMO_LIVE[key];
    for (var k in extra || {}) m[k] = extra[k];
    return m;
  };

  /* ---------- the hero: a game night on six teams ---------- */
  // KC's game is live, so it holds the screen (live games keep it to themselves) through a
  // late drive and a field goal; when it ends the six teams take turns every 12 s.
  var DRIVE = [ // [seconds into the scene, clock, situation, us, them, poss]
    [0, "1:52 - 4th", "1st & 10 at DEN 38", 20, 17, 1],
    [4, "1:21 - 4th", "2nd & 3 at DEN 31", 20, 17, 1],
    [8, "0:48 - 4th", "1st & 10 at DEN 19", 20, 17, 1],
    [12, "0:06 - 4th", "4th & 2 at DEN 13", 20, 17, 1],
    [15, "0:00 - 4th", "", 23, 17, -1]
  ];
  var LIVE_S = 18, FINAL_S = 8;
  function heroFrame(sec) {
    var cycle = LIVE_S + FINAL_S + 12 * 5, s = sec % cycle, kc = SM.DEMO.KC;
    var page = Math.floor((sec + 6) / 12) % 2;
    if (s < LIVE_S) {
      var step = DRIVE[0];
      DRIVE.forEach(function (d) { if (s >= d[0]) step = d; });
      // the clock runs between plays
      var next = DRIVE[DRIVE.indexOf(step) + 1], clock = step[1];
      if (next && step[5] >= 0) {
        var c0 = toSec(step[1]), c1 = toSec(next[1]), k = (s - step[0]) / (next[0] - step[0]);
        clock = fromSec(Math.round(c0 - (c0 - c1) * Math.min(1, k * 1.6))) + " - 4th";
      }
      return { t: KC, rec: kc.rec, stand: kc.stand, s: kc.s, idx: 0, count: 6, page: page,
               g: { state: "live", opp: DEN, home: true, us: step[3], them: step[4], detail: clock, poss: step[5], sit: step[2] } };
    }
    if (s < LIVE_S + FINAL_S)
      return { t: KC, rec: "8-2", stand: kc.stand, s: { streak: 4, pf: 254, pa: 181, home: "5-0", away: "3-2" }, idx: 0, count: 6, page: page,
               g: { state: "final", detail: "Final", opp: DEN, home: true, us: 23, them: 17 } };
    var i = 1 + Math.floor((s - LIVE_S - FINAL_S) / 12), key = SM.DEMO_ORDER[i];
    return SM.demoModel(key, "idle", { idx: i, count: 6, page: page });
  }
  function toSec(c) { var p = /(\d+):(\d+)/.exec(c); return p ? +p[1] * 60 + +p[2] : 0; }
  function fromSec(n) { n = Math.max(0, n); return Math.floor(n / 60) + ":" + ("0" + n % 60).slice(-2); }
  // How it works: the idle screen, the six teams taking turns.
  function glanceFrame(sec) {
    var i = Math.floor(sec / 12) % 6;
    return SM.demoModel(SM.DEMO_ORDER[i], "idle", { idx: i, count: 6, page: Math.floor((sec + 6) / 12) % 2 });
  }

  /* ---------- the feed: schedule for the season, one game document when live ----------
     The same public scores feed the device reads. opts.find(lg, id) -> team or null (for
     opponents), opts.onUpdate(team) after each load. Used by tool.js and the team pages. */
  SM.makeFeed = function (opts) {
  var find = opts.find || function () { return null; }, onUpdate = opts.onUpdate || function () {};
  var BASE = "https://site.api.espn.com/apis/site/v2/sports/";
  function get(url) {
    var ctl = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, 9000);
    return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) {
      clearTimeout(to); if (!r.ok) throw new Error(r.status); return r.json();
    });
  }
  function score(s) { if (s == null) return -1; if (typeof s === "object") s = s.displayValue != null ? s.displayValue : s.value; var n = parseInt(s, 10); return isNaN(n) ? -1 : n; }
  function stateOf(s) { return s === "in" ? "live" : s === "post" ? "final" : s === "pre" ? "pre" : "none"; }
  function oppTeam(t, k) {
    var e = find(t.lg, k.id) || find(t.lg, k.team && k.team.id);
    if (e) return e;
    var tm = k.team || {}, logo = "";
    (tm.logos || []).forEach(function (l) { if (!logo && l.href && l.href.indexOf("/scoreboard/") < 0) logo = l.href; });
    if (!logo && tm.logo && tm.logo.indexOf("/scoreboard/") < 0) logo = tm.logo;
    return { abbr: tm.abbreviation || "OPP", full: tm.displayName || "", c: tm.color ? parseInt(tm.color, 16) : null, a: tm.alternateColor ? parseInt(tm.alternateColor, 16) : 0xF2F2F4,
             logo: logo.replace(/^https?:\/\/a\.espncdn\.com/, "") };
  }
  function gameFrom(t, ev, live) {
    var c = (ev.competitions || [])[0] || {}, type = (c.status || ev.status || {}).type || {}, state = stateOf(type.state);
    var g = { state: state, id: ev.id, date: new Date(ev.date), detail: state === "pre" ? "" : type.shortDetail || "", us: -1, them: -1 };
    (c.competitors || []).forEach(function (k) {
      var id = String(k.id || (k.team && k.team.id));
      if (id === t.id) { g.home = k.homeAway === "home"; g.us = state === "pre" ? -1 : score(k.score); }
      else { g.opp = oppTeam(t, k); g.them = state === "pre" ? -1 : score(k.score); }
    });
    var note = c.notes && c.notes[0] && c.notes[0].headline, season = ev.seasonType && ev.seasonType.name;
    if (!note) note = season === "Preseason" || season === "Postseason" ? season : (ev.week && ev.week.text) || "";
    g.note = note;
    g.tv = (c.broadcasts && c.broadcasts[0] && c.broadcasts[0].media && c.broadcasts[0].media.shortName) || c.broadcast || "";
    var tbd = ev.timeValid === false || / TBD/.test(type.shortDetail || "");
    var start = g.date;
    if (tbd) start = new Date(start.getTime() - 5 * 3600e3), start = new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    var w = SM.when(start, new Date(), tbd); g.when = w.text; g.gameDay = w.days === 0;
    var s = c.situation;
    if (live && s) {
      g.sit = s.downDistanceText || "";
      if (s.possession) g.poss = String(s.possession) === t.id ? 1 : 0;
      if (s.outs != null) { g.balls = s.balls || 0; g.strikes = s.strikes || 0; g.outs = s.outs; g.bases = (s.onFirst ? 1 : 0) | (s.onSecond ? 2 : 0) | (s.onThird ? 4 : 0); }
    }
    return g;
  }
  function stats(t, events) {
    var soccer = t.sport === "soccer", hockey = t.sport === "hockey";
    var done = events.filter(function (e) { return e._g.state === "final" && e._g.us >= 0 && e._g.them >= 0; })
      .sort(function (a, b) { return a._g.date - b._g.date; });
    if (!done.length) return {};
    var pf = 0, pa = 0, h = [0, 0, 0], a = [0, 0, 0], streak = 0, pts = 0;
    done.forEach(function (e) {
      var g = e._g, r = g.us > g.them ? 0 : g.us < g.them ? 1 : 2, side = g.home ? h : a;
      pf += g.us; pa += g.them; side[r]++;
      pts += r === 0 ? 3 : r === 2 ? 1 : 0;
      var s = r === 0 ? 1 : r === 1 ? -1 : 0;
      streak = s === 0 ? 0 : (streak * s > 0 ? streak + s : s);
    });
    function rec(x) { return soccer ? x[0] + "-" + x[2] + "-" + x[1] : x[0] + "-" + x[1] + (x[2] ? "-" + x[2] : ""); }
    var out = { pf: pf, pa: pa };
    if (soccer) out.points = pts; else out.streak = streak;
    if (!hockey) { out.home = rec(h); out.away = rec(a); } // hockey's splits need overtime losses, which a score cannot tell
    return out;
  }
  var CACHE = {};
  function load(t) {
    var key = t.lg + ":" + t.id, c = CACHE[key];
    if (c && (c.pending || Date.now() - c.at < (c.m && c.m.g && c.m.g.state === "live" ? 20000 : 300000))) return;
    c = CACHE[key] = c || {};
    c.pending = true;
    var url = BASE + t.espn + "/teams/" + t.id + "/schedule";
    var reqs = [get(url)];
    if (t.sport === "soccer") reqs.push(get(url + "?fixture=true").catch(function () { return { events: [] }; }));
    Promise.all(reqs).then(function (docs) {
      var d = docs[0], tm = d.team || {}, seen = {}, events = [];
      docs.forEach(function (x) { (x.events || []).forEach(function (e) { if (!seen[e.id]) { seen[e.id] = 1; e._g = gameFrom(t, e); events.push(e); } }); });
      var now = Date.now(), pick = null, rank = -1;
      events.forEach(function (e) {
        var g = e._g, r = g.state === "live" ? 3 : g.state === "pre" && g.date > now - 6 * 3600e3 ? 2 : g.state === "final" ? 1 : 0;
        if (r > rank || (r === rank && r === 2 && g.date < pick._g.date) || (r === rank && r === 1 && g.date > pick._g.date)) { pick = e; rank = r; }
      });
      if (rank === 1 && now - pick._g.date > 21 * 864e5) pick = null; // a season long over: nothing scheduled yet
      var m = { t: t, rec: tm.recordSummary || "", stand: tm.standingSummary || "", s: stats(t, events), g: pick ? pick._g : { state: "none" } };
      if (pick && pick._g.state === "live") {
        return get(BASE + t.espn + "/scoreboard/" + pick.id).then(function (ev) { m.g = gameFrom(t, ev, true); return m; }, function () { return m; });
      }
      return m;
    }).then(function (m) {
      c.m = m; c.at = Date.now(); c.pending = false; c.failed = false; onUpdate(t);
    }, function () {
      c.pending = false; c.failed = true; c.at = Date.now();
      var demo = null;
      Object.keys(SM.DEMO).forEach(function (k) { var d = SM.DEMO[k].t; if (d.lg === t.lg && d.id === t.id) demo = k; });
      c.sample = !!demo;
      c.m = demo ? SM.demoModel(demo, "idle") : { t: t, rec: "", stand: "", s: {}, g: { state: "none" } };
      c.m.t = t; onUpdate(t);
    });
  }
  function modelFor(t) {
    var c = CACHE[t.lg + ":" + t.id];
    return c && c.m ? c.m : { t: t, rec: "", stand: "", loading: true, s: {}, g: { state: "none" } };
  }
  return { load: load, cache: CACHE, modelFor: modelFor };
  };

  /* ---------- runner: one loop for every live canvas, paused off-screen ---------- */
  SM.run = function (canvas, frameAt) {
    var visible = true, t0 = Date.now(), last = "";
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    function paint(force) {
      var sec = reduce ? 0 : (Date.now() - t0) / 1000, m = frameAt(sec);
      var key = JSON.stringify([m.t.abbr, m.g, m.page, m.idx, SM.clockText(new Date())]);
      if (!force && key === last) return;
      last = key; SM.draw(canvas, m);
    }
    SM.onLogo(function () { paint(true); });
    if ("IntersectionObserver" in window)
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) paint(); }).observe(canvas);
    paint(true);
    if (!reduce) setInterval(function () { if (visible && !document.hidden) paint(); }, 250);
    return { repaint: function () { paint(true); } };
  };

  var lives = document.querySelectorAll("canvas[data-meter-live]");
  if (lives.length) SM.DEMO_TEAMS.concat([DEN, NYJ, GS, SD, MTL, CHE, OSU]).forEach(SM.preload);
  Array.prototype.forEach.call(lives, function (cv) {
    SM.run(cv, cv.closest("[data-flat]") ? glanceFrame : heroFrame);
  });
})();
