/* sportsMeter "Find your team": search all 1,785 teams (data/teams.json, trimmed from the
   device's own team list), add up to six, and watch them take turns on a device screen drawn
   by screen.js. Each team's record, standing and next game (or live score) come from the same
   public scores feed the device reads; when it cannot be reached the screen shows the team's
   colours and logo with an empty season, and says so. */
(function () {
  "use strict";
  var root = document.getElementById("meterTool"), SM = window.SportsMeter;
  if (!root || !SM) return;
  var ROOT = window.PAGE && window.PAGE.root != null ? window.PAGE.root : "../", MAX = 6;
  var SPORT_NAMES = { football: "Football", basketball: "Basketball", baseball: "Baseball", hockey: "Hockey", soccer: "Soccer" };

  var css = "#meterTool{--st-r:24px}" +
    "#meterTool .st-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:40px;align-items:start}" +
    "#meterTool .st-stage{padding:28px 24px 20px;position:sticky;top:84px}" +
    "#meterTool .st-stage .device{max-width:520px;margin:0 auto}" +
    "#meterTool .st-cap{font-size:14px;color:var(--ink-3);text-align:center;margin-top:10px;min-height:1.5em}" +
    "#meterTool .st-row{display:flex;gap:8px;flex-wrap:wrap}" +
    "#meterTool .st-row{flex-wrap:nowrap}#meterTool .st-q{flex:1 1 auto;min-width:0;position:relative}" +
    "#meterTool input,#meterTool select{width:100%;height:52px;border-radius:999px;border:0;background:#fff;box-shadow:inset 0 0 0 1.5px var(--line);padding:0 20px;font:500 16px var(--font);color:var(--ink);-webkit-appearance:none;appearance:none}" +
    "#meterTool select{flex:0 0 170px;width:170px;padding-right:40px;background:#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%2315130f' stroke-width='1.6'/%3E%3C/svg%3E\") no-repeat right 18px center}" +
    "#meterTool input:focus,#meterTool select:focus{outline:none;box-shadow:inset 0 0 0 2px var(--ink)}" +
    "#meterTool .st-list{list-style:none;margin:12px 0 0;padding:6px;background:#fff;border-radius:16px;max-height:336px;overflow:auto}" +
    "#meterTool .st-list:empty{display:none}" +
    "#meterTool .st-list li{display:flex;align-items:center;gap:12px;padding:8px 10px;border-radius:12px;cursor:pointer;font-size:16px;line-height:1.25}" +
    "#meterTool .st-list li[aria-selected=true],#meterTool .st-list li:hover{background:var(--bg)}" +
    "#meterTool .st-list li small{display:block;color:var(--ink-3);font-size:13px}" +
    "#meterTool .st-list li .st-add{margin-left:auto;font-size:13px;font-weight:600;color:var(--ink-2);white-space:nowrap}" +
    "#meterTool .st-dot{flex:0 0 32px;width:32px;height:32px;border-radius:9px;display:grid;place-items:center;font:700 10px var(--font);color:#fff;overflow:hidden}" +
    "#meterTool .st-dot img{width:26px;height:26px;object-fit:contain}" +
    "#meterTool .st-count{font-size:14px;color:var(--ink-3);margin:12px 4px 0}" +
    "#meterTool .st-mine{margin-top:28px}" +
    "#meterTool .st-mine h3{font-size:15px;font-weight:600;margin:0 0 12px;display:flex;justify-content:space-between}" +
    "#meterTool .st-mine h3 span{font-weight:400;color:var(--ink-3)}" +
    "#meterTool .st-chips{display:flex;flex-wrap:wrap;gap:8px}" +
    "#meterTool .st-chip{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1.5px solid transparent;border-radius:999px;padding:6px 6px 6px 8px;font:600 15px var(--font);color:var(--ink);cursor:pointer}" +
    "#meterTool .st-chip[aria-pressed=true]{border-color:var(--ink)}" +
    "#meterTool .st-chip .st-dot{flex-basis:24px;width:24px;height:24px;border-radius:7px}" +
    "#meterTool .st-chip .st-dot img{width:20px;height:20px}" +
    "#meterTool .st-x{display:inline-grid;place-items:center;border:0;background:var(--bg);width:26px;height:26px;border-radius:50%;cursor:pointer;font:500 16px/1 var(--font);color:var(--ink-2)}" +
    "#meterTool .st-x:hover{background:var(--line)}" +
    "#meterTool .st-note{font-size:14px;color:var(--ink-3);margin-top:14px}" +
    "#meterTool .st-sports{display:flex;flex-wrap:wrap;gap:6px;margin-top:22px}" +
    "#meterTool .st-sports button{border:0;background:transparent;box-shadow:inset 0 0 0 1.5px var(--line);border-radius:999px;padding:7px 14px;font:600 14px var(--font);color:var(--ink-2);cursor:pointer}" +
    "#meterTool .st-sports button:hover{box-shadow:inset 0 0 0 1.5px var(--ink)}" +
    "@media (max-width:900px){#meterTool .st-grid{grid-template-columns:1fr;gap:24px}#meterTool .st-stage{position:static;padding:18px 14px 14px}}" +
    "@media (max-width:520px){#meterTool .st-row{flex-wrap:wrap}#meterTool select{flex:1 1 100%;width:100%}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  root.innerHTML =
    '<div class="st-grid">' +
      '<div class="st-stage tile"><div class="device" id="stDevice">' +
        '<img class="device-photo" src="' + ROOT + 'assets/finishes/black.webp" alt="" width="1000" height="750" loading="lazy">' +
        '<div class="screen"><canvas class="meter-canvas" width="640" height="480" aria-label="sportsMeter screen for the chosen team"></canvas></div>' +
      '</div><p class="st-cap" id="stCap" aria-live="polite"></p></div>' +
      '<div class="st-panel">' +
        '<div class="st-row"><div class="st-q"><input id="stQ" type="search" autocomplete="off" spellcheck="false" placeholder="Search a team, city or school" aria-label="Search teams" role="combobox" aria-expanded="false" aria-controls="stList" aria-autocomplete="list"></div>' +
        '<select id="stLg" aria-label="League"><option value="">All leagues</option></select></div>' +
        '<ul class="st-list" id="stList" role="listbox" aria-label="Teams"></ul>' +
        '<p class="st-count" id="stCount">Loading the team list...</p>' +
        '<div class="st-sports" id="stSports"></div>' +
        '<div class="st-mine"><h3>On your screen <span id="stN">0 of 6</span></h3><div class="st-chips" id="stChips"></div>' +
        '<p class="st-note">They take turns every 12 seconds, as on the device. A team playing right now takes over until its game ends.</p></div>' +
      '</div>' +
    '</div>';
  var $ = function (id) { return document.getElementById(id); };
  var canvas = root.querySelector("canvas"), q = $("stQ"), lgSel = $("stLg"), list = $("stList"),
      countEl = $("stCount"), chips = $("stChips"), cap = $("stCap");

  /* ---------- warp the canvas onto the device photo (same maths as app.js) ---------- */
  function adj(m) { return [m[4]*m[8]-m[5]*m[7], m[2]*m[7]-m[1]*m[8], m[1]*m[5]-m[2]*m[4], m[5]*m[6]-m[3]*m[8], m[0]*m[8]-m[2]*m[6], m[2]*m[3]-m[0]*m[5], m[3]*m[7]-m[4]*m[6], m[1]*m[6]-m[0]*m[7], m[0]*m[4]-m[1]*m[3]]; }
  function mul(a, b) { var c = []; for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) { var s = 0; for (var k = 0; k < 3; k++) s += a[3*i+k] * b[3*k+j]; c[3*i+j] = s; } return c; }
  function mv(m, v) { return [m[0]*v[0]+m[1]*v[1]+m[2]*v[2], m[3]*v[0]+m[4]*v[1]+m[5]*v[2], m[6]*v[0]+m[7]*v[1]+m[8]*v[2]]; }
  function basis(p) { var m = [p[0][0], p[1][0], p[2][0], p[0][1], p[1][1], p[2][1], 1, 1, 1]; var v = mv(adj(m), [p[3][0], p[3][1], 1]); return mul(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]); }
  function place() {
    var S = window.CM_SHOT, dev = $("stDevice"), img = dev.querySelector("img"), scr = dev.querySelector(".screen");
    if (!S || !img.clientWidth) return;
    var s = img.clientWidth / S.w, q4 = S.quad.map(function (p) { return [p[0] * s, p[1] * s]; });
    var t = mul(basis(q4), adj(basis([[0, 0], [320, 0], [320, 240], [0, 240]])));
    for (var i = 0; i < 9; i++) t[i] /= t[8];
    scr.style.transform = "matrix3d(" + [t[0], t[3], 0, t[6], t[1], t[4], 0, t[7], 0, 0, 1, 0, t[2], t[5], 0, t[8]].join(",") + ")";
  }
  $("stDevice").querySelector("img").addEventListener("load", place);
  window.addEventListener("resize", place);
  if (window.ResizeObserver) new ResizeObserver(place).observe($("stDevice"));
  place();

  /* ---------- data ---------- */
  var LEAGUES = {}, ALL = [], BYID = {};
  function norm(s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9& ]/g, " ").replace(/\s+/g, " ").trim(); }
  function teamOf(e) {
    var L = LEAGUES[e.lg], t = SM.team(e.lg, e.row, L.dev);
    t.sport = L.sport; t.espn = L.espn; t.store = L.label; return t;
  }

  var feed = SM.makeFeed({ find: function (lg, id) { var e = BYID[lg + ":" + id]; return e ? teamOf(e) : null; },
                           onUpdate: function () { paint(true); } });
  var CACHE = feed.cache, load = feed.load;

  /* ---------- picked teams, rotation ---------- */
  var mine = [], cur = 0, turnAt = Date.now() + SM.ROTATE_MS, visible = true;
  var modelFor = feed.modelFor;
  function isLive(t) { var m = modelFor(t); return m.g && m.g.state === "live"; }
  function nextTeam() {
    var anyLive = mine.some(isLive);
    for (var step = 1; step <= mine.length; step++) {
      var i = (cur + step) % mine.length;
      if (anyLive && !isLive(mine[i])) continue;
      return i;
    }
    return cur;
  }
  var lastKey = "";
  function paint(force) {
    if (!mine.length) return;
    var t = mine[cur], m = modelFor(t), c = CACHE[t.lg + ":" + t.id] || {};
    var frame = {}; for (var k in m) frame[k] = m[k];
    frame.idx = cur; frame.count = mine.length; frame.page = Math.floor(Date.now() / SM.ROTATE_MS) % 2;
    var key = JSON.stringify([t.lg, t.id, frame.page, cur, mine.length, SM.clockText(new Date()), c.at]);
    if (!force && key === lastKey) return;
    lastKey = key;
    SM.draw(canvas, frame);
    cap.textContent = c.failed ? t.full + ": the scores feed did not answer in this browser, so the screen shows what the device shows until its first update arrives. The device reads the feed itself."
      : !c.m ? "Loading " + t.full + "..."
      : t.full + ", " + t.store + (m.g.state === "live" ? ": live now." : m.g.state === "pre" ? ": the real next game." : m.g.state === "final" ? ": the latest result." : ".");
    [].forEach.call(chips.children, function (ch, i) { ch.setAttribute("aria-pressed", i === cur ? "true" : "false"); });
  }
  function show(i) { cur = i; turnAt = Date.now() + SM.ROTATE_MS; load(mine[i]); paint(true); }
  function dot(t, big) {
    var bg = SM.accentCss({ c: t.c, a: t.a }), el = document.createElement("span");
    el.className = "st-dot"; el.style.background = "#16161b";
    if (t.logo) {
      var img = new Image(); img.alt = ""; img.loading = "lazy";
      img.src = "https://a.espncdn.com/combiner/i?img=" + t.logo.replace("/500/", "/500-dark/") + "&w=64&h=64";
      img.onerror = function () { el.textContent = t.abbr; el.style.background = bg; el.style.color = "#000"; };
      el.appendChild(img);
    } else { el.textContent = t.abbr; el.style.background = bg; el.style.color = "#000"; }
    return el;
  }
  function renderChips() {
    chips.innerHTML = "";
    mine.forEach(function (t, i) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "st-chip"; b.title = "Show " + t.full;
      b.appendChild(dot(t)); b.appendChild(document.createTextNode(t.name));
      var x = document.createElement("span"); x.className = "st-x"; x.setAttribute("role", "button"); x.setAttribute("aria-label", "Remove " + t.full); x.textContent = "×";
      x.addEventListener("click", function (e) { e.stopPropagation(); remove(i); });
      b.appendChild(x);
      b.addEventListener("click", function () { show(i); });
      chips.appendChild(b);
    });
    $("stN").textContent = mine.length + " of " + MAX;
  }
  function add(t) {
    var at = -1;
    mine.forEach(function (m, i) { if (m.lg === t.lg && m.id === t.id) at = i; });
    if (at < 0) {
      if (mine.length >= MAX) mine.shift();
      mine.push(t); at = mine.length - 1;
    }
    renderChips(); show(at);
    mine.forEach(load);
    if (q.value) { q.value = ""; search(); }
  }
  function remove(i) {
    mine.splice(i, 1);
    if (!mine.length) { var kc = find("nfl", "12"); if (kc) mine.push(kc); }
    renderChips(); show(Math.min(cur, mine.length - 1));
  }
  function find(lg, id) { var e = BYID[lg + ":" + id]; return e ? teamOf(e) : null; }

  /* ---------- search ---------- */
  var results = [], sel = -1;
  function search() {
    var s = norm(q.value), lg = lgSel.value, out = [];
    if (!s && !lg) { list.innerHTML = ""; results = []; q.setAttribute("aria-expanded", "false"); countEl.textContent = ALL.length.toLocaleString() + " teams in " + Object.keys(LEAGUES).length + " leagues. Pick up to six, any mix."; return; }
    ALL.forEach(function (e) {
      if (lg && e.lg !== lg) return;
      var r = !s ? 3 : e.abbr === s ? 0 : e.key.indexOf(s) === 0 || e.short.indexOf(s) === 0 ? 1 : (" " + e.key).indexOf(" " + s) >= 0 ? 2 : e.key.indexOf(s) >= 0 || e.lgName.indexOf(s) >= 0 ? 3 : -1;
      if (r >= 0) out.push([r, e]);
    });
    out.sort(function (a, b) { return a[0] - b[0] || a[1].pri - b[1].pri || (a[1].row[1] < b[1].row[1] ? -1 : 1); });
    results = out.map(function (x) { return x[1]; });
    sel = results.length ? 0 : -1;
    list.innerHTML = "";
    results.slice(0, 60).forEach(function (e, i) {
      var t = teamOf(e), li = document.createElement("li");
      li.setAttribute("role", "option"); li.id = "stOpt" + i; li.setAttribute("aria-selected", i === sel ? "true" : "false");
      li.appendChild(dot(t));
      var tx = document.createElement("span"); tx.innerHTML = "<b></b><small></small>";
      tx.firstChild.textContent = e.row[1]; tx.lastChild.textContent = LEAGUES[e.lg].label;
      li.appendChild(tx);
      var ad = document.createElement("span"); ad.className = "st-add"; ad.textContent = "Add";
      li.appendChild(ad);
      li.addEventListener("mousedown", function (ev) { ev.preventDefault(); add(t); });
      list.appendChild(li);
    });
    q.setAttribute("aria-expanded", results.length ? "true" : "false");
    countEl.textContent = results.length ? results.length.toLocaleString() + " team" + (results.length === 1 ? "" : "s") + (results.length > 60 ? ", showing the first 60" : "")
      : "No team by that name. Try the city or school, or email info@encinitas3d.com and we will check.";
  }
  function highlight(i) {
    var items = list.children; if (!items.length) return;
    sel = (i + items.length) % items.length;
    [].forEach.call(items, function (li, k) { li.setAttribute("aria-selected", k === sel ? "true" : "false"); });
    items[sel].scrollIntoView({ block: "nearest" });
    q.setAttribute("aria-activedescendant", items[sel].id);
  }
  q.addEventListener("input", search);
  lgSel.addEventListener("change", search);
  q.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); highlight(sel + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); highlight(sel - 1); }
    else if (e.key === "Enter" && sel >= 0 && results[sel]) { e.preventDefault(); add(teamOf(results[sel])); }
    else if (e.key === "Escape") { q.value = ""; search(); }
  });

  /* ---------- start ---------- */
  var PICKS = [["nfl", "12"], ["nba", "13"], ["mlb", "19"], ["nhl", "21"], ["epl", "359"], ["ncaaf", "130"]];
  var PRI = { nfl: 1, nba: 1, mlb: 1, nhl: 1, mls: 2, wnba: 2, nwsl: 2, epl: 2, laliga: 3, bund: 3, seriea: 3, ligue1: 3, ligamx: 3, ncaaf: 4, ncaam: 5, ncaaw: 6 };
  fetch(ROOT + "products/sports/data/teams.json").then(function (r) { return r.json(); }).then(function (d) {
    var bySport = {};
    d.leagues.forEach(function (l) {
      LEAGUES[l[0]] = { label: l[1], dev: l[2], sport: l[3], espn: l[3] + "/" + l[4] };
      (bySport[l[3]] = bySport[l[3]] || []).push(l);
    });
    Object.keys(bySport).forEach(function (sp) {
      var g = document.createElement("optgroup"); g.label = SPORT_NAMES[sp] || sp;
      bySport[sp].forEach(function (l) { var o = document.createElement("option"); o.value = l[0]; o.textContent = l[1] + " (" + d.teams[l[0]].length + ")"; g.appendChild(o); });
      lgSel.appendChild(g);
    });
    Object.keys(d.teams).forEach(function (lg) {
      d.teams[lg].forEach(function (row) {
        var e = { lg: lg, row: row, key: norm(row[1]), short: norm(row[2]), abbr: norm(row[3]), lgName: norm(LEAGUES[lg].label), pri: PRI[lg] || 9 };
        ALL.push(e); BYID[lg + ":" + row[0]] = e;
      });
    });
    // One-tap examples: a well-known team per sport.
    var sp = $("stSports");
    PICKS.forEach(function (p) {
      var t = find(p[0], p[1]); if (!t) return;
      var b = document.createElement("button"); b.type = "button";
      b.textContent = "+ " + t.name; b.title = "Add " + t.full + " (" + SPORT_NAMES[t.sport] + ")";
      b.addEventListener("click", function () { add(t); });
      sp.appendChild(b);
    });
    search();
    var kc = find("nfl", "12"); mine = [kc]; renderChips(); show(0);
  }).catch(function () {
    countEl.textContent = "The team list could not load. See every team at encinitas3d.com/sports-meter-teams.";
    var kc = SM.DEMO_TEAMS[0]; kc.store = "NFL"; kc.espn = "football/nfl";
    mine = [kc]; renderChips(); show(0);
  });

  SM.onLogo(function () { paint(true); });
  if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) paint(true); }).observe(canvas);
  setInterval(function () {
    if (!visible || document.hidden || !mine.length) return;
    mine.forEach(function (t) { if (isLive(t)) load(t); });
    if (mine.length > 1 && Date.now() >= turnAt) { cur = nextTeam(); turnAt = Date.now() + SM.ROTATE_MS; load(mine[cur]); }
    paint();
  }, 1000);
})();
