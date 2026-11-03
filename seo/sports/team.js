/* sportsMeter landing pages (team, league, city, hub): draw the device screen for the teams in
   canvas[data-teams] with screen.js, filled from the same public scores feed the device reads
   (SportsMeter.makeFeed). One team holds the screen; several take turns every 12 s, live games
   first, as on the device. The caption under the device says what is on it in words.
   data-teams: [[league, device label, sport, "sport/league" feed path, teams.json row], ...] */
(function () {
  "use strict";
  var SM = window.SportsMeter, cv = document.querySelector("canvas[data-teams]");
  if (!SM || !cv || !SM.makeFeed) return;
  var cap = document.querySelector("[data-team-now]"), mine;
  try {
    mine = JSON.parse(cv.getAttribute("data-teams")).map(function (x) {
      var t = SM.team(x[0], x[4], x[1]); t.sport = x[2]; t.espn = x[3]; return t;
    });
  } catch (e) { return; }
  if (!mine.length) return;
  var BY = {}; mine.forEach(function (t) { BY[t.lg + ":" + t.id] = t; });
  var feed = SM.makeFeed({ find: function (lg, id) { return BY[lg + ":" + id] || null; },
                           onUpdate: function () { paint(true); } });
  var cur = 0, turnAt = Date.now() + SM.ROTATE_MS, visible = true, lastKey = "";
  function isLive(t) { var m = feed.modelFor(t); return m.g && m.g.state === "live"; }
  function nextTeam() {
    var anyLive = mine.some(isLive);
    for (var step = 1; step <= mine.length; step++) {
      var i = (cur + step) % mine.length;
      if (anyLive && !isLive(mine[i])) continue;
      return i;
    }
    return cur;
  }
  function oppName(g) { return g.opp ? (g.opp.full || g.opp.abbr) : "TBD"; }
  function words(t, m, c) {
    var g = m.g || { state: "none" }, s = t.full;
    if (c.failed) return s + (c.sample ? ": the scores feed could not load here, so this is a sample season."
      : ": the scores feed could not load here, so the season is left empty. The device fetches it itself.");
    if (!c.m) return "Loading " + s + "...";
    var rec = m.rec ? " " + m.rec + (m.stand ? ", " + m.stand : "") + "." : "";
    var at = g.home ? "vs " : "at ";
    if (g.state === "live") return s + ": live now, " + g.us + "-" + g.them + " " + at + oppName(g) + (g.detail ? " (" + g.detail + ")" : "") + "." + rec;
    if (g.state === "pre") return s + ":" + rec + " Next: " + at + oppName(g) + ", " + g.when + (g.tv ? " on " + g.tv : "") + " (your time).";
    if (g.state === "final") return s + ":" + rec + " Latest: " + (g.us > g.them ? "won " : g.us < g.them ? "lost " : "drew ") + g.us + "-" + g.them + " " + at + oppName(g) + ".";
    return s + ":" + rec + " No game scheduled right now.";
  }
  function paint(force) {
    var t = mine[cur], m = feed.modelFor(t), c = feed.cache[t.lg + ":" + t.id] || {};
    var frame = {}; for (var k in m) frame[k] = m[k];
    frame.idx = cur; frame.count = mine.length; frame.page = Math.floor(Date.now() / SM.ROTATE_MS) % 2;
    var key = JSON.stringify([t.lg, t.id, frame.page, cur, SM.clockText(new Date()), c.at]);
    if (!force && key === lastKey) return;
    lastKey = key;
    SM.draw(cv, frame);
    if (cap) cap.textContent = words(t, m, c);
  }
  mine.forEach(SM.preload);
  SM.onLogo(function () { paint(true); });
  if ("IntersectionObserver" in window)
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) paint(true); }).observe(cv);
  mine.forEach(feed.load);
  paint(true);
  setInterval(function () {
    if (!visible || document.hidden) return;
    mine.forEach(function (t) { if (isLive(t)) feed.load(t); });
    if (mine.length > 1 && Date.now() >= turnAt) { cur = nextTeam(); turnAt = Date.now() + SM.ROTATE_MS; feed.load(mine[cur]); }
    paint();
  }, 1000);
})();
