/* socialMeter live screen.
 *
 * A pixel-for-pixel port of the firmware's count screen (socialmeter/ui.ino
 * ui_show_count, firmware 0.2.5): an RGB565 framebuffer, the TFT_eSPI drawing
 * primitives the M5Stack 0.3.1 library uses (fillRoundRect, fillCircle,
 * fillTriangle, drawCircle), the device's own Adafruit GFX FreeSans fonts and
 * its 4-bit brand-logo masks (data/gfx.js, generated from the firmware assets).
 * Drawn at 320x240 and scaled 2x with no smoothing, so it looks like the panel.
 *
 * Also builds, from PAGE.modes[].plats: the Setups device that cycles through
 * every platform in the selected tab (with lit name chips), and a wall of all
 * 20 platform screens using the firmware's demo numbers (demo.ino DEMO[]).
 *
 * Every canvas[data-meter-live] on the page animates: the count ticks up on
 * each "poll", the today pill grows, the milestone bar fills and the refresh
 * pie empties between polls. The hero cycles platforms; other canvases keep
 * the YouTube layout so the How-it-works highlight boxes stay aligned. A canvas
 * with data-platform="<key>" (SEO landing pages) shows just that platform.
 * window.SocialMeter exposes the renderer for tool.js.
 */
(function () {
  "use strict";
  var W = 320, H = 240;
  var me = document.currentScript;
  var base = me && me.src ? me.src.replace(/screen\.js(\?.*)?$/, "") : "";

  /* ---------- firmware tables (ui.ino, usage_data.h, wifi_portal.ino) ---------- */
  // Index = Platform enum value. key: our id; k: 1 = needs a free key (portal P[] k:1).
  var PLATS = [
    { key: "bluesky", name: "Bluesky", metric: "FOLLOWERS", s2: "posts", s3: "following", at: true, k: 0 },
    { key: "mastodon", name: "Mastodon", metric: "FOLLOWERS", s2: "posts", s3: "following", at: true, k: 0 },
    { key: "github", name: "GitHub", metric: "FOLLOWERS", s2: "repos", s3: "following", at: true, k: 0 },
    { key: "npm", name: "npm", metric: "DOWNLOADS/WK", s2: "monthly", s3: "daily", at: false, k: 0 },
    { key: "dockerhub", name: "Docker Hub", metric: "PULLS", s2: "stars", s3: "tags", at: false, k: 0 },
    { key: "discord", name: "Discord", metric: "ONLINE", s2: "", s3: "", at: false, k: 0, gauge: true },
    { key: "youtube", name: "YouTube", metric: "SUBSCRIBERS", s2: "views", s3: "videos", at: true, k: 1 },
    { key: "steam", name: "Steam", metric: "PLAYERS NOW", s2: "reviews", s3: "positive", at: false, k: 0, gauge: true },
    { key: "etsy", name: "Etsy", metric: "SALES", s2: "admirers", s3: "reviews", at: false, k: 1 },
    { key: "shopify", name: "Shopify", metric: "ORDERS", s2: "products", s3: "customers", at: false, k: 1 },
    { key: "twitch", name: "Twitch", metric: "VIEWERS NOW", s2: "", s3: "", at: false, k: 1, gauge: true },
    { key: "spotify", name: "Spotify", metric: "FOLLOWERS", s2: "popularity", s3: "", at: false, k: 1 },
    { key: "reddit", name: "Reddit", metric: "MEMBERS", s2: "active", s3: "", at: false, k: 0, retired: true },
    { key: "telegram", name: "Telegram", metric: "MEMBERS", s2: "", s3: "", at: true, k: 1 },
    { key: "kick", name: "Kick", metric: "VIEWERS NOW", s2: "subscribers", s3: "", at: true, k: 1, gauge: true },
    { key: "youtube_live", name: "YouTube Live", metric: "VIEWERS NOW", s2: "views", s3: "", at: true, k: 1, gauge: true },
    { key: "roblox", name: "Roblox", metric: "PLAYERS NOW", s2: "visits", s3: "favourites", at: false, k: 0, gauge: true },
    { key: "lastfm", name: "Last.fm", metric: "SCROBBLES", s2: "artists", s3: "tracks", at: true, k: 1 },
    { key: "wikipedia", name: "Wikipedia", metric: "VIEWS / 30D", s2: "latest day", s3: "days", at: false, k: 0 },
    { key: "discourse", name: "Discourse", metric: "MEMBERS", s2: "topics", s3: "posts", at: false, k: 0 },
    { key: "minecraft", name: "Minecraft", metric: "PLAYERS NOW", s2: "slots", s3: "", at: false, k: 0, gauge: true }
  ];
  var IDX = {}; PLATS.forEach(function (p, i) { IDX[p.key] = i; });

  // config.h colours (RGB565)
  var BG = 0x0841, SURFACE = 0x10A3, SURFACE2 = 0x18E4, TEXT = 0xF79E, DIM = 0x8411,
      FAINT = 0x52AB, SUCCESS = 0x3DCA, WARNING = 0xE50A, ERROR = 0xE289;
  var HDR_H = 30, PAD = 8, NAME_MAX_W = 128, LOGO_W = 56;

  /* ---------- data (fonts + logos) ---------- */
  var G = null, FONTS = {};
  function b64(s) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function prepare() {
    G = window.SM_GFX;
    Object.keys(G.fonts).forEach(function (k) {
      var f = G.fonts[k], ab = 0, bb = 0;
      f.g.forEach(function (g) { var a = -g[5]; if (a > ab) ab = a; var d = g[2] - a; if (d > bb) bb = d; });
      FONTS[k] = { bm: b64(f.b), g: f.g, ab: ab, bb: bb };
    });
    G.maskBytes = {};
    Object.keys(G.masks).forEach(function (k) { G.maskBytes[k] = b64(G.masks[k]); });
  }
  var ready = new Promise(function (res, rej) {
    if (window.SM_GFX) { prepare(); return res(); }
    var s = document.createElement("script");
    s.src = base + "data/gfx.js";
    s.onload = function () { if (window.SM_GFX) { prepare(); res(); } else rej(new Error("gfx")); };
    s.onerror = function () { rej(new Error("gfx")); };
    document.head.appendChild(s);
  });

  /* ---------- RGB565 framebuffer with the TFT_eSPI primitives ---------- */
  function rgba(c) {
    var r = (c >> 11) & 31, g = (c >> 5) & 63, b = c & 31;
    r = (r << 3) | (r >> 2); g = (g << 2) | (g >> 4); b = (b << 3) | (b >> 2);
    return (255 << 24) | (b << 16) | (g << 8) | r; // little-endian ImageData word
  }
  function FB(canvas) {
    this.cv = canvas;
    this.off = document.createElement("canvas"); this.off.width = W; this.off.height = H;
    this.octx = this.off.getContext("2d");
    this.img = this.octx.createImageData(W, H);
    this.px32 = new Uint32Array(this.img.data.buffer);
    this.font = FONTS.FSS9; this.size = 1; this.datum = "ML"; this.fg = TEXT; this.bg = TEXT;
  }
  var P = FB.prototype;
  P.hline = function (x, y, w, c) {
    if (y < 0 || y >= H || w <= 0) return;
    if (x < 0) { w += x; x = 0; } if (x + w > W) w = W - x; if (w <= 0) return;
    var v = rgba(c), o = y * W + x; for (var i = 0; i < w; i++) this.px32[o + i] = v;
  };
  P.pixel = function (x, y, c) { if (x >= 0 && y >= 0 && x < W && y < H) this.px32[y * W + x] = rgba(c); };
  P.rect = function (x, y, w, h, c) { for (var j = 0; j < h; j++) this.hline(x, y + j, w, c); };
  P.fill = function (c) { this.rect(0, 0, W, H, c); };
  P.circleHelper = function (x0, y0, r, corner, delta, c) {
    var f = 1 - r, ddx = 1, ddy = -r - r, y = 0; delta++;
    while (y < r) {
      if (f >= 0) { r--; ddy += 2; f += ddy; }
      y++; ddx += 2; f += ddx;
      if (corner & 1) { this.hline(x0 - r, y0 + y, r + r + delta, c); this.hline(x0 - y, y0 + r, y + y + delta, c); }
      if (corner & 2) { this.hline(x0 - r, y0 - y, r + r + delta, c); this.hline(x0 - y, y0 - r, y + y + delta, c); }
    }
  };
  P.roundRect = function (x, y, w, h, r, c) {
    this.rect(x, y + r, w, h - r - r, c);
    this.circleHelper(x + r, y + h - r - 1, r, 1, w - r - r - 1, c);
    this.circleHelper(x + r, y + r, r, 2, w - r - r - 1, c);
  };
  P.fillCircle = function (x0, y0, r, c) {
    var x = 0, dx = 1, dy = r + r, p = -(r >> 1);
    this.hline(x0 - r, y0, dy + 1, c);
    while (x < r) {
      if (p >= 0) { dy -= 2; p -= dy; r--; }
      dx += 2; p += dx; x++;
      this.hline(x0 - r, y0 + x, 2 * r + 1, c); this.hline(x0 - r, y0 - x, 2 * r + 1, c);
      this.hline(x0 - x, y0 + r, 2 * x + 1, c); this.hline(x0 - x, y0 - r, 2 * x + 1, c);
    }
  };
  P.drawCircle = function (x0, y0, r, c) {
    var x = 0, dx = 1, dy = r + r, p = -(r >> 1);
    this.pixel(x0 + r, y0, c); this.pixel(x0 - r, y0, c); this.pixel(x0, y0 - r, c); this.pixel(x0, y0 + r, c);
    while (x < r) {
      if (p >= 0) { dy -= 2; p -= dy; r--; }
      dx += 2; p += dx; x++;
      this.pixel(x0 + x, y0 + r, c); this.pixel(x0 - x, y0 + r, c); this.pixel(x0 - x, y0 - r, c); this.pixel(x0 + x, y0 - r, c);
      this.pixel(x0 + r, y0 + x, c); this.pixel(x0 - r, y0 + x, c); this.pixel(x0 - r, y0 - x, c); this.pixel(x0 + r, y0 - x, c);
    }
  };
  P.triangle = function (x0, y0, x1, y1, x2, y2, c) {
    var t;
    if (y0 > y1) { t = y0; y0 = y1; y1 = t; t = x0; x0 = x1; x1 = t; }
    if (y1 > y2) { t = y2; y2 = y1; y1 = t; t = x2; x2 = x1; x1 = t; }
    if (y0 > y1) { t = y0; y0 = y1; y1 = t; t = x0; x0 = x1; x1 = t; }
    var a, b, y, last;
    if (y0 === y2) {
      a = b = x0; if (x1 < a) a = x1; else if (x1 > b) b = x1; if (x2 < a) a = x2; else if (x2 > b) b = x2;
      this.hline(a, y0, b - a + 1, c); return;
    }
    var dx01 = x1 - x0, dy01 = y1 - y0, dx02 = x2 - x0, dy02 = y2 - y0, dx12 = x2 - x1, dy12 = y2 - y1, sa = 0, sb = 0;
    last = (y1 === y2) ? y1 : y1 - 1;
    for (y = y0; y <= last; y++) {
      a = x0 + Math.trunc(sa / dy01); b = x0 + Math.trunc(sb / dy02); sa += dx01; sb += dx02;
      if (a > b) { t = a; a = b; b = t; } this.hline(a, y, b - a + 1, c);
    }
    sa = dx12 * (y - y1); sb = dx02 * (y - y0);
    for (; y <= y2; y++) {
      a = x1 + Math.trunc(sa / dy12); b = x0 + Math.trunc(sb / dy02); sa += dx12; sb += dx02;
      if (a > b) { t = a; a = b; b = t; } this.hline(a, y, b - a + 1, c);
    }
  };
  /* GFX free-font text, as TFT_eSPI textWidth / drawString / drawChar do it */
  P.setFont = function (k) { this.font = FONTS[k]; };
  P.textWidth = function (s) {
    var f = this.font, w = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i) - 32; if (c < 0 || c > 94) continue;
      var g = f.g[c]; w += (i < s.length - 1) ? g[3] : (g[4] + g[1]);
    }
    return w * this.size;
  };
  P.drawString = function (s, x, y) {
    var f = this.font, ts = this.size, cw = this.textWidth(s), ch = f.ab * ts, bl = ch, d = this.datum;
    y += ch;
    if (d[1] === "C") x -= cw >> 1; else if (d[1] === "R") x -= cw;
    if (d[0] === "M") y -= ch >> 1;
    if (x < 0) x = 0; if (x + cw > W) x = W - cw; if (y < 0) y = 0; if (y + ch - bl > H) y = H - ch;
    if (this.fg !== this.bg && s.length) {
      var c0 = s.charCodeAt(0) - 32;
      if (c0 >= 0 && c0 <= 94) {
        var xo = f.g[c0][4] * ts; if (xo > 0) xo = 0; else cw -= xo;
        this.rect(x + xo, y - f.ab * ts, cw, (f.ab + f.bb) * ts, this.bg);
      }
    }
    var sx = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i) - 32; if (c < 0 || c > 94) continue;
      var g = f.g[c], bo = g[0], gw = g[1], gh = g[2], gx = g[4], gy = g[5], bits = 0, bit = 0, ox = x + sx;
      for (var yy = 0; yy < gh; yy++) for (var xx = 0; xx < gw; xx++) {
        if (!(bit++ & 7)) bits = f.bm[bo++];
        if (bits & 0x80) {
          if (ts === 1) this.pixel(ox + gx + xx, y + gy + yy, this.fg);
          else this.rect(ox + (gx + xx) * ts, y + (gy + yy) * ts, ts, ts, this.fg);
        }
        bits <<= 1;
      }
      sx += g[3] * ts;
    }
  };
  P.text = function (s, x, y, font, datum, fg, bg) {
    this.setFont(font); this.datum = datum; this.fg = fg; this.bg = bg === undefined ? fg : bg; this.drawString(s, x, y);
  };
  P.logo = function (x, y, p) {
    var name = G.logo[p]; if (!name) return;
    var m = G.maskBytes[name], fg = G.accent[p], bgc = SURFACE;
    var fr = (fg >> 11) & 31, fgn = (fg >> 5) & 63, fb = fg & 31, br = (bgc >> 11) & 31, bgn = (bgc >> 5) & 63, bb = bgc & 31, ramp = [];
    for (var a = 0; a < 16; a++)
      ramp[a] = ((br + Math.trunc((fr - br) * a / 15)) << 11) | ((bgn + Math.trunc((fgn - bgn) * a / 15)) << 5) | (bb + Math.trunc((fb - bb) * a / 15));
    for (var j = 0; j < 56; j++) for (var i = 0; i < 56; i += 2) {
      var two = m[j * 28 + (i >> 1)];
      this.pixel(x + i, y + j, ramp[two >> 4]); this.pixel(x + i + 1, y + j, ramp[two & 15]);
    }
  };
  P.flush = function () {
    this.octx.putImageData(this.img, 0, 0);
    var ctx = this.cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.off, 0, 0, this.cv.width, this.cv.height);
  };

  /* ---------- number formatting (ui.ino) ---------- */
  function fmtComma(n) { return String(Math.max(0, Math.floor(n)) % 4294967296).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  // printf "%.Nf": rounds the exact binary value, ties to even (10500 -> "10K", 1250000 -> "1.2M").
  // toFixed rounds ties up, so an exact .5 would read one higher than the device.
  function printfFixed(v, d) {
    var m = Math.pow(10, d), x = v * m, f = Math.floor(x);
    if (x - f === 0.5 && f % 2 === 0) return (f / m).toFixed(d);
    return v.toFixed(d);
  }
  function fmtCompact(n) {
    var s;
    n = Math.max(0, Math.floor(n)) % 4294967296;   // uint32_t on the device
    if (n >= 1e9) s = printfFixed(n / 1e9, 1) + "B"; else if (n >= 1e6) s = printfFixed(n / 1e6, 1) + "M";
    else if (n >= 1e4) s = printfFixed(n / 1e3, 0) + "K"; else return fmtComma(n);
    return s.replace(".0B", "B").replace(".0M", "M").replace(".0K", "K");
  }
  function fmtHero(n) { return n >= 1e6 ? fmtCompact(n) : fmtComma(n); }
  function nextMilestone(n) {
    var pow = 1; while (pow * 10 <= n && pow < 1e9) pow *= 10;
    var m = [1, 2, 5, 10]; for (var i = 0; i < 4; i++) if (m[i] * pow > n) return m[i] * pow;
    return pow * 10;
  }
  function clockText(d) { d = d || new Date(); var h = d.getHours() % 12 || 12; return h + ":" + ("0" + d.getMinutes()).slice(-2) + (d.getHours() < 12 ? "am" : "pm"); }
  var CAPTION = { wifi_down: "wifi down", unreachable: "can't reach the API", auth: "check the API key",
    rate_limited: "rate limited - backing off", not_found: "not found - check the handle", unknown: "fetching..." };

  /* ---------- the count screen: ui_show_count() + draw_titlebar() ---------- */
  // st: {p, handle, primary, secondary, tertiary, delta, status ("ok" | key of CAPTION),
  //      stale, refresh 0..1, clock, bars}
  function drawTitlebarDynamic(fb, st) {
    var cy = HDR_H / 2;
    fb.rect(140, 2, 140, HDR_H - 4, BG);
    // draw_refresh_pie(150, cy, 6, frac, DIM)
    var r = 6, cx = 150, frac = Math.min(1, st.refresh == null ? 0.62 : st.refresh);
    fb.drawCircle(cx, cy, r, DIM);
    if (frac > 0.001) {
      var steps = Math.floor(frac * 36 + 0.5);
      for (var i = 0; i < steps; i++) {
        var a0 = (-90 + i * 10) * Math.PI / 180, a1 = (-90 + (i + 1) * 10) * Math.PI / 180;
        fb.triangle(cx, cy, cx + Math.trunc(r * Math.cos(a0)), cy + Math.trunc(r * Math.sin(a0)),
          cx + Math.trunc(r * Math.cos(a1)), cy + Math.trunc(r * Math.sin(a1)), DIM);
      }
    }
    fb.size = 1;
    fb.text(st.clock == null ? clockText() : st.clock, 234, cy, "FSS9", "MR", DIM, BG);
    // draw_battery(264, cy): full
    var bw = 17, bh = 11, nub = 2, bx = 264 - nub - bw, by = cy - (bh >> 1);
    fb.hline(bx, by, bw, DIM); fb.hline(bx, by + bh - 1, bw, DIM);
    fb.rect(bx, by, 1, bh, DIM); fb.rect(bx + bw - 1, by, 1, bh, DIM);
    fb.rect(bx + bw, cy - 2, nub, 5, DIM);
    fb.rect(bx + 2, by + 2, bw - 4, bh - 4, TEXT);
  }
  function statusColor(st) {
    if (st.status === "ok" && !st.stale) return SUCCESS;
    if (st.stale || st.status === "unknown") return WARNING;
    return ERROR;
  }
  function draw(fb, st) {
    var p = st.p, pl = PLATS[p], accent = G.accent[p];
    var hasData = st.status === "ok" || st.stale || (st.primary > 0 && st.status !== "not_found");
    fb.size = 1;
    fb.fill(BG);
    // title bar
    fb.rect(0, 0, 320, HDR_H, BG);
    fb.setFont("FSSB12"); if (fb.textWidth(pl.name) > NAME_MAX_W) fb.setFont("FSSB9");
    fb.datum = "ML"; fb.fg = accent; fb.bg = BG; fb.drawString(pl.name, PAD, HDR_H / 2);
    var cy = HDR_H / 2;
    drawTitlebarDynamic(fb, st);
    var bars = st.bars == null ? 4 : st.bars, baseY = cy + 6;
    for (var i = 0; i < 4; i++) { var bh = 4 + i * 3, bx = 282 + i * 5; fb.rect(bx, baseY - bh, 3, bh, i < bars ? TEXT : FAINT); }
    fb.fillCircle(312, cy, 4, statusColor(st));
    fb.hline(0, HDR_H, 320, SURFACE2);

    var n = (pl.s2 ? 1 : 0) + (pl.s3 ? 1 : 0);
    var hcX = PAD, hcW = 320 - 2 * PAD, hcY = 34, hcH = n === 0 ? 168 : 106;
    var numY = n === 0 ? hcY + 88 : hcY + 52, hndY = n === 0 ? hcY + 128 : hcY + 94;
    fb.roundRect(hcX, hcY, hcW, hcH, 10, SURFACE);
    fb.text(pl.metric, hcX + 14, hcY + 14, "FSS9", "ML", DIM, SURFACE);
    var logoX = hcX + hcW - LOGO_W - 8;
    fb.logo(logoX, hcY + 8, p);

    var heroMaxW = logoX - (hcX + 14) - 8, hero = hasData ? fmtHero(st.primary) : "--";
    fb.datum = "ML"; fb.fg = TEXT; fb.bg = SURFACE; fb.size = 2;
    fb.setFont("FSSB18"); if (fb.textWidth(hero) > heroMaxW) fb.setFont("FSSB12");
    fb.drawString(hero, hcX + 14, numY);
    fb.size = 1;

    var showDelta = hasData && st.delta && !pl.gauge, dt = "", pillW = 0;
    if (showDelta) { dt = fmtCompact(Math.abs(st.delta)) + " today"; fb.setFont("FSS9"); pillW = fb.textWidth(dt) + 26; }
    if (st.handle) {
      fb.setFont("FSSB12"); fb.datum = "ML"; fb.fg = accent; fb.bg = SURFACE;
      var who = (pl.at ? "@" : "") + st.handle, avail = hcW - 14 - 12 - (showDelta ? pillW + 8 : 0);
      if (fb.textWidth(who) > avail) {
        while (who.length > 1 && fb.textWidth(who + "..") > avail) who = who.slice(0, -1);
        who += "..";
      }
      fb.drawString(who, hcX + 14, hndY);
    }
    if (showDelta) {
      var up = st.delta > 0, pbg = up ? 0x0A41 : 0x3000, dc = up ? SUCCESS : ERROR, ph = 20, ay = hndY;
      var px = hcX + hcW - 12 - pillW;
      fb.roundRect(px, ay - ph / 2, pillW, ph, ph / 2, pbg);
      if (up) fb.triangle(px + 10, ay + 3, px + 16, ay + 3, px + 13, ay - 4, dc);
      else fb.triangle(px + 10, ay - 3, px + 16, ay - 3, px + 13, ay + 4, dc);
      fb.text(dt, px + 22, ay, "FSS9", "ML", dc);
    }

    var sy = 146, sh = 56, gap = 8;
    if (hasData && n === 1) {
      var lab = pl.s2 || pl.s3, val = pl.s2 ? st.secondary : st.tertiary;
      fb.roundRect(PAD, sy, 320 - 2 * PAD, sh, 10, SURFACE);
      fb.text(fmtCompact(val || 0), PAD + 14, sy + sh / 2, "FSSB18", "ML", TEXT, SURFACE);
      fb.text(lab.toUpperCase(), 320 - PAD - 14, sy + sh / 2, "FSS9", "MR", DIM, SURFACE);
    } else if (hasData && n === 2) {
      var cw = Math.floor((320 - 2 * PAD - gap) / 2), stats = [[pl.s2, st.secondary], [pl.s3, st.tertiary]];
      for (var k = 0; k < 2; k++) {
        var x = PAD + k * (cw + gap);
        fb.roundRect(x, sy, cw, sh, 10, SURFACE);
        fb.text(stats[k][0].toUpperCase(), x + 14, sy + 16, "FSS9", "ML", DIM, SURFACE);
        fb.text(fmtCompact(stats[k][1] || 0), x + 14, sy + sh - 16, "FSSB18", "ML", TEXT, SURFACE);
      }
    }
    if (hasData) {
      var target = nextMilestone(st.primary); if (target < 10) target = 10;
      var frac = Math.min(1, Math.fround(Math.fround(st.primary) / Math.fround(target)));
      var mcX = PAD, mcY = 206, mcW = 320 - 2 * PAD, mcH = 32;
      fb.roundRect(mcX, mcY, mcW, mcH, 10, SURFACE);
      fb.text("NEXT MILESTONE", mcX + 14, mcY + 12, "FSS9", "ML", DIM, SURFACE);
      fb.text(fmtCompact(target) + "  (" + Math.floor(frac * 100) + "%)", mcX + mcW - 14, mcY + 12, "FSS9", "MR", accent, SURFACE);
      var barX = mcX + 14, barW = mcW - 28, barY = mcY + 23, barH = 6;
      fb.roundRect(barX, barY, barW, barH, barH / 2, SURFACE2);
      var fw = Math.floor(barW * frac); if (frac > 0 && fw < barH) fw = barH;
      if (fw > 0) fb.roundRect(barX, barY, fw, barH, barH / 2, accent);
    } else {
      fb.text(CAPTION[st.status] || (st.stale ? "last known" : "live"), 160, 120, "FSS9", "MC", FAINT, SURFACE);
    }
    fb.flush();
  }

  function css565(c) { var v = rgba(c); return "rgb(" + (v & 255) + "," + ((v >> 8) & 255) + "," + ((v >> 16) & 255) + ")"; }
  // A platform's logo mask as a small canvas (accent on transparent), for chips.
  function logoCanvas(p, size) {
    var cv = document.createElement("canvas"); cv.width = cv.height = 56;
    var name = G.logo[p]; if (!name) return cv;
    var ctx = cv.getContext("2d"), img = ctx.createImageData(56, 56), m = G.maskBytes[name], v = rgba(G.accent[p]);
    for (var j = 0; j < 56; j++) for (var i = 0; i < 56; i++) {
      var two = m[j * 28 + (i >> 1)], a = (i & 1) ? two & 15 : two >> 4, o = (j * 56 + i) * 4;
      img.data[o] = v & 255; img.data[o + 1] = (v >> 8) & 255; img.data[o + 2] = (v >> 16) & 255; img.data[o + 3] = a * 17;
    }
    ctx.putImageData(img, 0, 0);
    cv.style.width = cv.style.height = (size || 28) + "px";
    return cv;
  }

  /* ---------- the hero and How-it-works screens ---------- */
  // Sample accounts (never real people). Each "poll" adds a believable step.
  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  var SCENES = [
    { p: IDX.youtube, handle: "MyChannel", primary: 48200, secondary: 2914000, tertiary: 312, delta: 200,
      // YouTube rounds subscriber counts to 3 figures, so the count moves in 100s.
      step: function (s, k) { s.secondary += rnd(900, 2600); if (k % 2) { s.primary += 100; s.delta += 100; } } },
    { p: IDX.twitch, handle: "yourstream", primary: 1284, secondary: 0, tertiary: 0, delta: 0,
      step: function (s) { s.primary = Math.max(900, s.primary + rnd(-24, 58)); } },
    { p: IDX.github, handle: "yourname", primary: 3412, secondary: 48, tertiary: 112, delta: 9,
      step: function (s) { var d = rnd(0, 3); s.primary += d; s.delta += d; } },
    { p: IDX.etsy, handle: "YourShop", primary: 8472, secondary: 1204, tertiary: 318, delta: 12,
      step: function (s) { var d = rnd(0, 2); s.primary += d; s.delta += d; s.secondary += rnd(0, 1); } },
    { p: IDX.bluesky, handle: "you.bsky.social", primary: 12480, secondary: 3210, tertiary: 540, delta: 64,
      step: function (s) { var d = rnd(2, 7); s.primary += d; s.delta += d; } },
    { p: IDX.npm, handle: "your-package", primary: 84120, secondary: 361000, tertiary: 12900, delta: 640,
      step: function (s) { var d = rnd(20, 90); s.primary += d; s.delta += d; s.tertiary += d; } }
  ];
  var POLL_MS = 6000, POLLS_PER_SCENE = 4;
  function sceneState(sc) {
    return { p: sc.p, handle: sc.handle, primary: sc.primary, secondary: sc.secondary, tertiary: sc.tertiary,
      delta: sc.delta, status: "ok", refresh: 1, bars: 4, step: sc.step, k: 0 };
  }

  // One platform only (a landing page's data-platform="youtube"): the firmware's
  // demo numbers with a believable step per poll for that kind of count.
  function platformScene(key) {
    var s = SAMPLE[key], p = IDX[key], pl = PLATS[p];
    var step = pl.gauge
      ? function (st) { var b = s[1], d = Math.max(1, Math.round(b * 0.012)); st.primary = Math.max(Math.round(b * 0.9), Math.min(Math.round(b * 1.1), st.primary + rnd(-d, d + 1))); }
      : key === "youtube"
        ? function (st, k) { st.secondary += rnd(900, 2600); if (k % 2) { st.primary += 100; st.delta += 100; } }
        : function (st) { var m = Math.max(1, Math.round(s[4] / 16)), d = rnd(0, m); st.primary += d; st.delta += d; };
    return { p: p, handle: s[0], primary: s[1], secondary: s[2], tertiary: s[3], delta: pl.gauge ? 0 : s[4], step: step };
  }

  function animate(canvas, cycle, only) {
    var scenes = only ? [platformScene(only)] : SCENES;
    var fb = new FB(canvas), states = scenes.map(sceneState), si = 0, polls = 0;
    var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var t0 = performance.now(), visible = true, last = "";
    function frame(now) {
      var st = states[si], el = now - t0;
      if (el >= POLL_MS) {
        t0 = now; el = 0; polls++;
        if (cycle && polls % POLLS_PER_SCENE === 0) si = (si + 1) % states.length;
        if (polls % 48 === 0) states = scenes.map(sceneState); // start the day again, so numbers stay believable
        st = states[si]; st.step(st, st.k++);
      }
      st.refresh = 1 - el / POLL_MS; st.clock = clockText();
      var key = si + "|" + st.primary + "|" + Math.floor(st.refresh * 36 + 0.5) + "|" + st.clock;
      if (key !== last) { last = key; draw(fb, st); }
    }
    if (reduced) { var s0 = states[0]; s0.refresh = 0.62; s0.clock = clockText(); draw(fb, s0); return; }
    frame(performance.now());
    function loop(now) { if (visible && !document.hidden) frame(now); requestAnimationFrame(loop); }
    if ("IntersectionObserver" in window)
      new IntersectionObserver(function (es) { es.forEach(function (e) {
        if (e.isIntersecting && !visible) t0 = performance.now() - (POLL_MS * 0.1);
        visible = e.isIntersecting;
      }); }).observe(canvas);
    requestAnimationFrame(loop);
  }


  /* ---------- every platform: the firmware's demo numbers (demo.ino DEMO[]) ---------- */
  // [sample handle, primary, secondary, tertiary, today]. Handles are samples,
  // never a real account; IDs are made up. Gauges ignore "today", as the device does.
  var SAMPLE = {
    bluesky: ["you.bsky.social", 12400, 3210, 540, 85],
    mastodon: ["you@mastodon.social", 8900, 5600, 410, 30],
    github: ["yourname", 1240, 47, 89, 12],
    npm: ["your-package", 84000, 360000, 13000, 2100],
    dockerhub: ["you/your-app", 2300000, 156, 1231, 500],
    discord: ["123456789012345678", 3400, 0, 0, 0],
    youtube: ["MyChannel", 54300, 2800000, 142, 210],
    steam: ["123450", 12800, 14376, 12187, 0],
    etsy: ["YourShop", 1820, 940, 610, 14],
    shopify: ["yourstore.myshopify.com", 8472, 640, 1180, 23],
    twitch: ["yourstream", 3120, 0, 0, 0],
    spotify: ["YourArtistID", 128000, 72, 0, 260],
    telegram: ["yourchannel", 24800, 0, 0, 190],
    kick: ["yourstream", 1870, 412, 0, 0],
    youtube_live: ["MyChannel", 3450, 128000, 0, 0],
    roblox: ["1234567890", 4182, 91200000, 1240000, 0],
    lastfm: ["yourname", 148230, 3420, 18400, 640],
    wikipedia: ["en.wikipedia/Your_Article", 92400, 3180, 30, 2100],
    discourse: ["forum.example.com", 68279, 66816, 1899201, 130],
    minecraft: ["play.example.net", 817, 5000, 0, 0]
  };
  function sampleState(key) {
    var s = SAMPLE[key];
    return { p: IDX[key], handle: s[0], primary: s[1], secondary: s[2], tertiary: s[3], delta: s[4],
      status: "ok", refresh: 0.62, bars: 4, clock: clockText() };
  }
  function metricWords(p) { var m = PLATS[p].metric.toLowerCase(); return m.charAt(0).toUpperCase() + m.slice(1); }

  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var CSS = "#modes .sm-cycle{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated}" +
    "#modeCopy .for.sm-for{display:flex;flex-wrap:wrap;gap:6px;margin-top:22px}" +
    ".sm-pc{display:inline-flex;align-items:center;gap:7px;border:0;border-radius:999px;background:transparent;box-shadow:inset 0 0 0 1px var(--line);padding:5px 12px 5px 5px;font:600 14px var(--font);color:var(--ink-3);cursor:pointer;transition:background .3s,color .3s,box-shadow .3s}" +
    ".sm-pc .lg{width:22px;height:22px;border-radius:50%;background:#16161b;display:grid;place-items:center;opacity:.45;transition:opacity .3s}" +
    ".sm-pc:hover{color:var(--ink)}.sm-pc[aria-pressed=true]{background:#fff;color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--ink)}.sm-pc[aria-pressed=true] .lg{opacity:1}" +
    ".sm-wall{margin-top:clamp(56px,7vw,88px)}" +
    ".sm-wall-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:8px 32px;margin-bottom:22px}" +
    ".sm-wall-head h3{font-size:clamp(22px,2.2vw,28px);font-weight:700;letter-spacing:-.03em}" +
    ".sm-wall-head p{color:var(--ink-2);font-size:16px;max-width:52ch}" +
    ".sm-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}" +
    ".sm-tile{display:block;width:100%;border:0;background:none;padding:0;text-align:left;cursor:pointer;font:inherit;color:inherit}" +
    ".sm-tile canvas{display:block;width:100%;height:auto;aspect-ratio:4/3;border-radius:10px;background:#0a0a0c;box-shadow:0 0 0 6px var(--dark);margin:6px 6px 14px;width:calc(100% - 12px);transition:transform .3s var(--ease)}" +
    ".sm-tile:hover canvas,.sm-tile:focus-visible canvas{transform:translateY(-3px)}" +
    ".sm-tile .nm{display:block;font-weight:600;font-size:15px;line-height:1.25}" +
    ".sm-tile .mt{display:block;font-size:13px;color:var(--ink-3);margin-top:2px}" +
    "@media (max-width:960px){.sm-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}" +
    "@media (max-width:600px){.sm-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 8px}.sm-tile canvas{box-shadow:0 0 0 4px var(--dark);margin:4px 4px 10px;width:calc(100% - 8px);border-radius:6px}.sm-tile .nm{font-size:13px}.sm-tile .mt{display:none}}";

  /* ---------- Setups: each tab cycles through every platform in its group ---------- */
  var DWELL_MS = 2600;
  function setups() {
    var dev = document.getElementById("modeDevice"), copy = document.getElementById("modeCopy"),
        items = window.PAGE && PAGE.modes;
    if (!dev || !copy || !items || !items[0] || !items[0].plats) return;
    var scr = dev.querySelector(".screen"); if (!scr) return;
    var cv = document.createElement("canvas"); cv.width = 640; cv.height = 480; cv.className = "sm-cycle";
    cv.setAttribute("role", "img"); scr.appendChild(cv);
    var fb = new FB(cv), group = null, gi = 0, timer = null, visible = false, holdUntil = 0, chips = [];
    function show(i) {
      gi = i; var key = group.plats[i], p = IDX[key];
      draw(fb, sampleState(key));
      cv.setAttribute("aria-label", PLATS[p].name + " on socialMeter: " + fmtComma(SAMPLE[key][1]) + " " + PLATS[p].metric.toLowerCase());
      chips.forEach(function (c, k) { c.setAttribute("aria-pressed", k === i ? "true" : "false"); });
    }
    function schedule() {
      clearTimeout(timer); timer = null;
      if (REDUCED || !visible || document.hidden || !group || group.plats.length < 2) return;
      timer = setTimeout(function () {
        if (Date.now() < holdUntil) { schedule(); return; }
        show((gi + 1) % group.plats.length); schedule();
      }, DWELL_MS);
    }
    function onCopy() {
      var sel = document.querySelector('#modes .tabs [aria-selected="true"]');
      var key = sel ? sel.dataset.mode : items[0].key;
      group = items.filter(function (m) { return m.key === key; })[0] || items[0];
      chips = [];
      var forP = copy.querySelector(".for");
      if (forP) {
        forP.classList.add("sm-for"); forP.innerHTML = "";
        forP.setAttribute("role", "group"); forP.setAttribute("aria-label", "Platforms in " + group.label);
        group.plats.forEach(function (k, i) {
          var p = IDX[k], b = document.createElement("button"); b.type = "button"; b.className = "sm-pc";
          var lg = document.createElement("span"); lg.className = "lg"; lg.appendChild(logoCanvas(p, 16)); b.appendChild(lg);
          b.appendChild(document.createTextNode(PLATS[p].name));
          b.addEventListener("click", function () { holdUntil = Date.now() + 9000; show(i); schedule(); });
          forP.appendChild(b); chips.push(b);
        });
      }
      show(0); schedule();
    }
    new MutationObserver(onCopy).observe(copy, { childList: true });
    if ("IntersectionObserver" in window)
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; schedule(); }).observe(dev);
    else visible = true;
    document.addEventListener("visibilitychange", schedule);
    onCopy();
  }

  /* ---------- the wall: all 20 platforms, one small screen each ---------- */
  function wall() {
    var items = window.PAGE && PAGE.modes, mode = document.querySelector("#modes .mode");
    if (!mode || !items || !items[0] || !items[0].plats) return;
    var w = document.createElement("div"); w.className = "sm-wall";
    var n = 0; items.forEach(function (m) { n += m.plats.length; });
    w.innerHTML = '<div class="sm-wall-head"><h3>All ' + n + ' platforms.</h3>' +
      "<p>Each one, as it looks on the screen. Tap one to try it. Instagram, TikTok and X are not supported: they do not let a device like this read the count. <a class=\"link\" href=\"platforms/\">Every platform in detail</a></p></div>";
    var ul = document.createElement("ul"); ul.className = "sm-grid";
    var tiles = [];
    items.forEach(function (m) { m.plats.forEach(function (k) {
      var p = IDX[k], li = document.createElement("li"), b = document.createElement("button");
      b.type = "button"; b.className = "sm-tile";
      b.setAttribute("aria-label", PLATS[p].name + ", " + metricWords(p).toLowerCase() + ". Try it below.");
      var cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.setAttribute("aria-hidden", "true");
      b.appendChild(cv);
      b.insertAdjacentHTML("beforeend", '<span class="nm">' + PLATS[p].name + '</span><span class="mt">' + metricWords(p) + "</span>");
      b.addEventListener("click", function () {
        var t = document.getElementById("tool");
        if (window.SocialMeter.pick) window.SocialMeter.pick(k);
        if (t) t.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" });
      });
      li.appendChild(b); ul.appendChild(li); tiles.push([cv, k]);
    }); });
    w.appendChild(ul);
    mode.parentNode.insertBefore(w, mode.nextSibling);
    var drawn = false;
    function paint() { if (drawn) return; drawn = true; tiles.forEach(function (t) { draw(new FB(t[0]), sampleState(t[1])); }); }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { paint(); io.disconnect(); } }, { rootMargin: "400px 0px" });
      io.observe(w);
    } else paint();
  }

  window.SocialMeter = {
    ready: ready, PLATS: PLATS, IDX: IDX, FB: FB, draw: draw, logoCanvas: logoCanvas, css565: css565,
    accent: function (p) { return css565(G.accent[p]); }, clockText: clockText, SAMPLE: SAMPLE, sampleState: sampleState,
    newScreen: function (canvas) { var fb = new FB(canvas); return function (st) { draw(fb, st); }; }
  };

  ready.then(function () {
    var style = document.createElement("style"); style.textContent = CSS; document.head.appendChild(style);
    setups(); wall();
    Array.prototype.forEach.call(document.querySelectorAll("canvas[data-meter-live]"), function (cv) {
      var only = cv.getAttribute("data-platform");
      if (only && !SAMPLE[only]) only = null;
      animate(cv, !only && !!cv.closest("#heroDevice"), only);
    });
  }, function () { /* data missing: canvases stay black, page still works */ });
})();
