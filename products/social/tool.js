/* socialMeter "See your count": pick a platform, type a name, see it on the
 * device screen. Seven no-key platforms whose APIs allow browser requests are
 * read live with the same endpoints and fields the firmware uses
 * (socialmeter/poller.ino + parse_counts.cpp); the rest show the firmware's demo
 * numbers with the name field greyed out. Instagram, TikTok and X are greyed chips.
 * Mounts into #meterTool; needs window.SocialMeter from screen.js.
 */
(function () {
  "use strict";
  var root = document.getElementById("meterTool");
  var SM = window.SocialMeter;
  if (!root || !SM) return;

  // f: the setup page's field hint (wifi_portal.ino P[]), ex: placeholder (sample, never a real person).
  // live: read in the browser. The others show the firmware's demo numbers (SM.SAMPLE) with the
  // field greyed out: key platforms need a key this page never asks for, and the rest do not
  // answer web pages (no CORS).
  var T = [
    { key: "youtube", f: "Your channel handle (the @ is optional)", ex: "MyChannel" },
    { key: "youtube_live", f: "Your channel handle (the @ is optional)", ex: "MyChannel" },
    { key: "twitch", f: "The channel name", ex: "yourstream" },
    { key: "kick", f: "The channel name from its kick.com link", ex: "yourstream" },
    { key: "bluesky", f: "Your Bluesky handle", ex: "bsky.app", live: bluesky },
    { key: "mastodon", f: "Your full handle, user@instance", ex: "Mastodon@mastodon.social", live: mastodon },
    { key: "telegram", f: "Your public channel username", ex: "yourchannel" },
    { key: "spotify", f: "The artist ID (the code in the artist page link)", ex: "artist ID" },
    { key: "lastfm", f: "Your Last.fm username", ex: "yourname" },
    { key: "github", f: "Your GitHub username", ex: "github", live: github, every: 120 },
    { key: "npm", f: "The npm package name", ex: "react", live: npm },
    { key: "dockerhub", f: "The repo as user/repo", ex: "library/nginx" },
    { key: "discord", f: "Your server ID (its widget must be on)", ex: "server ID", live: discord, noex: true },
    { key: "discourse", f: "The forum address", ex: "meta.discourse.org" },
    { key: "steam", f: "The game's Steam app ID (from its store link)", ex: "570" },
    { key: "roblox", f: "The game's universe ID (not the number in the game link)", ex: "1537690962" },
    { key: "minecraft", f: "The server address", ex: "play.cubecraft.net", live: minecraft },
    { key: "wikipedia", f: "The article, or project/article", ex: "en.wikipedia/ESP32", live: wikipedia },
    { key: "etsy", f: "Your Etsy shop name", ex: "YourShop" },
    { key: "shopify", f: "Your store address", ex: "yourstore.myshopify.com" }
  ];

  // Not supported by the firmware (no public count a device can read).
  var UNSUP = ["Instagram", "TikTok", "X"];

  var css = "#meterTool .smt{display:grid;grid-template-columns:1fr 1.05fr;gap:clamp(20px,3vw,40px);align-items:start}" +
    "#meterTool .smt-legend{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:14px;color:var(--ink-2);margin:0 0 14px}" +
    "#meterTool .smt-legend i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;vertical-align:1px}" +
    "#meterTool .k-live{background:#3fb950}#meterTool .k-name{background:var(--ink-3)}#meterTool .k-key{background:transparent;box-shadow:inset 0 0 0 1.5px var(--ink-3)}" +
    "#meterTool .smt-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}" +
    "#meterTool .smt-chip{display:flex;align-items:center;gap:10px;background:#fff;border:1.5px solid transparent;border-radius:999px;padding:6px 14px 6px 6px;font:600 15px var(--font);color:var(--ink);cursor:pointer;text-align:left;min-width:0;transition:border-color .2s}" +
    "#meterTool .smt-chip:hover{border-color:var(--line)}#meterTool .smt-chip[aria-pressed=true]{border-color:var(--ink)}" +
    "#meterTool .smt-chip .lg{flex:none;width:32px;height:32px;border-radius:50%;background:#16161b;display:grid;place-items:center}" +
    "#meterTool .smt-chip .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    "#meterTool .smt-chip i{flex:none;width:8px;height:8px;border-radius:50%}" +
    "#meterTool .smt-legend i.k-off{width:14px;height:8px;border-radius:4px;background:transparent;border:1px dashed var(--ink-3)}" +
    "#meterTool .smt-chip.off{background:transparent;color:var(--ink-3);border:1.5px dashed var(--line)}" +
    "#meterTool .smt-chip.off .lg{background:var(--bg-soft);color:var(--ink-3);font:700 13px var(--font)}" +
    "#meterTool .smt-chip.off[aria-pressed=true]{border-color:var(--ink-3);border-style:dashed}" +
    "#meterTool .smt-no{font-size:15px;color:var(--ink-3);margin:16px 0 0}" +
    "#meterTool .smt-form.idle label{color:var(--ink-3)}" +
    "#meterTool .smt-row input:disabled{background:var(--bg-soft);color:var(--ink-3);box-shadow:inset 0 0 0 1.5px var(--line);cursor:not-allowed;-webkit-text-fill-color:var(--ink-3);opacity:1}" +
    "#meterTool .smt-row .btn:disabled{opacity:.35;cursor:not-allowed}" +
    "#meterTool .smt-scr{position:relative}" +
    "#meterTool .smt-scr canvas{transition:opacity .3s}" +
    "#meterTool .smt-scr.off canvas{opacity:0}" +
    "#meterTool .smt-scr .na{position:absolute;inset:0;display:none;place-items:center;color:#8b857c;font:600 clamp(18px,2.2vw,24px) var(--font);letter-spacing:-.01em;text-align:center;padding:20px}" +
    "#meterTool .smt-scr.off .na{display:grid}" +
    "#meterTool .smt-form label{display:block;font-size:15px;font-weight:600;margin:0 0 10px}" +
    "#meterTool .smt-row{display:flex;gap:8px}" +
    "#meterTool .smt-row input{flex:1;min-width:0;height:50px;border-radius:999px;border:0;background:#fff;box-shadow:inset 0 0 0 1.5px var(--line);padding:0 20px;font:500 16px var(--font);color:var(--ink)}" +
    "#meterTool .smt-row input:focus{outline:none;box-shadow:inset 0 0 0 2px var(--ink)}" +
    "#meterTool .smt-row .btn{padding:0 24px;height:50px}" +
    "#meterTool .smt-scr{margin-top:18px;background:var(--dark);border-radius:var(--r);padding:clamp(14px,2.4vw,26px)}" +
    "#meterTool .smt-scr canvas{display:block;width:100%;height:auto;aspect-ratio:4/3;border-radius:4px;image-rendering:pixelated;background:#0a0a0c}" +
    "#meterTool .smt-tag{display:inline-block;margin:18px 0 -8px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-2);background:var(--bg-soft);border-radius:999px;padding:5px 12px}" +
    "#meterTool .smt-tag[hidden]{display:none}" +
    "#meterTool .smt-msg{font-size:16px;color:var(--ink-2);margin:14px 0 0;min-height:3.1em}" +
    "#meterTool .smt-msg b{color:var(--ink)}" +
    "@media (max-width:860px){#meterTool .smt{grid-template-columns:1fr}#meterTool .smt-show{order:-1}}" +
    "@media (max-width:600px){#meterTool .smt-chips{grid-template-columns:1fr 1fr}#meterTool .smt-chip{font-size:14px;padding-right:10px;gap:8px}#meterTool .smt-chip .lg{width:28px;height:28px}}";

  SM.ready.then(build, function () {
    root.innerHTML = '<p class="smt-no">The preview could not load. The device works with all 20 platforms in the FAQ below.</p>';
  });

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function build() {
    var style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);
    var wrap = el("div", "smt"), pick = el("div", "smt-pick"), show = el("div", "smt-show");
    pick.appendChild(el("p", "smt-legend",
      '<span><i class="k-live"></i>Live on this page</span><span><i class="k-name"></i>Needs only a name</span><span><i class="k-key"></i>Needs a free key</span><span><i class="k-off"></i>Not supported</span>'));
    var chips = el("div", "smt-chips"); chips.setAttribute("role", "group"); chips.setAttribute("aria-label", "Platform");
    T.forEach(function (t) {
      var p = SM.IDX[t.key], pl = SM.PLATS[p];
      var b = el("button", "smt-chip"); b.type = "button"; b.dataset.key = t.key; b.setAttribute("aria-pressed", "false");
      var lg = el("span", "lg"); lg.appendChild(SM.logoCanvas(p, 22)); b.appendChild(lg);
      b.appendChild(el("span", "nm", esc(pl.name)));
      var dot = el("i", t.live ? "k-live" : pl.k ? "k-key" : "k-name");
      dot.title = t.live ? "Live on this page" : pl.k ? "Needs a free key" : "Needs only a name";
      b.appendChild(dot);
      b.setAttribute("aria-label", pl.name + ", " + dot.title.toLowerCase());
      b.addEventListener("click", function () { select(t.key, true); });
      chips.appendChild(b);
    });
    UNSUP.forEach(function (name) {
      var b = el("button", "smt-chip off"); b.type = "button"; b.dataset.key = "x-" + name; b.setAttribute("aria-pressed", "false");
      b.appendChild(el("span", "lg", esc(name.charAt(0)))); b.appendChild(el("span", "nm", esc(name)));
      b.setAttribute("aria-label", name + ", not supported");
      b.addEventListener("click", function () { unsupported(name); });
      chips.appendChild(b);
    });
    pick.appendChild(chips);

    var form = el("form", "smt-form"); form.noValidate = true;
    form.innerHTML = '<label for="smtIn"></label><div class="smt-row"><input id="smtIn" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="96"><button class="btn" type="submit">Show</button></div>';
    var scr = el("div", "smt-scr"), cv = el("canvas"); cv.width = 640; cv.height = 480;
    cv.setAttribute("role", "img"); scr.appendChild(cv);
    var na = el("div", "na"); na.setAttribute("aria-hidden", "true"); scr.appendChild(na);
    var msg = el("p", "smt-msg"); msg.setAttribute("aria-live", "polite");
    var tag = el("p", "smt-tag", "Sample numbers, not a real account"); tag.hidden = true;
    show.appendChild(form); show.appendChild(tag); show.appendChild(scr); show.appendChild(msg);
    wrap.appendChild(pick); wrap.appendChild(show);
    root.innerHTML = ""; root.appendChild(wrap);

    var input = form.querySelector("input"), label = form.querySelector("label"), go = form.querySelector("button");
    var paint = SM.newScreen(cv);
    var cur = null, st = null, first = null, timer = null, next = 0, period = 60, seq = 0, inView = false;

    function render() {
      if (!st) return;
      st.clock = SM.clockText();
      st.refresh = st.status === "ok" && next ? Math.max(0, (next - Date.now()) / (period * 1000)) : 0;
      paint(st);   // exactly ui_show_count(): the handle stays on error screens too
      scr.classList.remove("off"); tag.hidden = !st.sample;
      cv.setAttribute("aria-label", SM.PLATS[st.p].name + " screen: " +
        (st.status === "ok" ? st.primary.toLocaleString("en-US") + " " + SM.PLATS[st.p].metric.toLowerCase() : "no number yet"));
    }
    setInterval(function () { if (inView && !document.hidden) render(); }, 1000);

    function say(h) { msg.innerHTML = h; }

    function press(key) {
      Array.prototype.forEach.call(chips.children, function (b) { b.setAttribute("aria-pressed", b.dataset.key === key ? "true" : "false"); });
    }
    function field(on, text) {
      input.disabled = !on; go.disabled = !on; form.classList.toggle("idle", !on); label.textContent = text;
    }
    function select(key, focus) {
      cur = T.filter(function (t) { return t.key === key; })[0]; if (!cur) return;
      started = true; press(key); offScreen(null);
      var pl = SM.PLATS[SM.IDX[key]];
      if (cur.live) {
        field(true, cur.f); input.placeholder = cur.ex; input.value = cur.noex ? "" : cur.ex;
        if (focus) input.focus({ preventScroll: true });
      } else {
        // Nothing to type: this page cannot look it up, so the field is shown but greyed.
        field(false, pl.k ? "Nothing to type: " + pl.name + " needs a free key, so this is a sample" : "Nothing to type: this page cannot ask " + pl.name + ", so this is a sample");
        input.placeholder = ""; input.value = SM.SAMPLE[key][0];
      }
      run();
    }
    function unsupported(name) {
      clearTimeout(timer); seq++; cur = null; st = null;
      press("x-" + name); offScreen(name + " is not supported");
      field(false, "Nothing to type: " + name + " is not supported"); input.value = ""; input.placeholder = "";
      cv.setAttribute("aria-label", name + " is not supported");
      say("<b>" + esc(name) + " is not supported.</b> " + esc(name) + " does not let a device like this read the count, so no desk counter can show it. Pick another platform to see its screen.");
    }
    // No device screen: the page could not get an answer the device would also get.
    function offScreen(text) {
      tag.hidden = true;
      if (text == null) { scr.classList.remove("off"); return; }
      scr.classList.add("off"); na.textContent = text;
    }
    SM.pick = function (key) { select(key, false); };

    function run() {
      clearTimeout(timer); seq++; first = null; next = 0;
      if (!cur) return;
      var p = SM.IDX[cur.key], pl = SM.PLATS[p], handle = input.value.replace(/[ \t\r\n]/g, "") || cur.ex;
      if (!cur.live) {
        st = SM.sampleState(cur.key); st.sample = true;
        next = Date.now() + 37000; period = 60;
        render();
        say(pl.k
          ? "<b>Sample screen, made-up numbers.</b> " + esc(pl.name) + " needs a free key, so this page does not ask for a name. The device reads it with a key you make once; the setup guide shows how, and the key stays on the device."
          : "<b>Sample screen, made-up numbers.</b> " + esc(pl.name) + " does not answer web pages, so there is nothing to type here. The device asks it directly with just the name or ID.");
        return;
      }
      if (cur.noex && !input.value.trim()) {   // no public sample to read: show the demo screen until they type
        st = SM.sampleState(cur.key); st.sample = true; next = Date.now() + 37000; period = 60; render();
        say("<b>Sample screen, made-up numbers.</b> Type your " + esc(pl.name) + " server ID and press Show to read your real number live.");
        return;
      }
      period = cur.every || 60;
      st = { p: p, handle: handle, primary: 0, secondary: 0, tertiary: 0, delta: 0, status: "unknown", bars: 4 };
      render();
      say("Asking " + esc(pl.name) + "..." + (pl.at && handle.charAt(0) === "@" ? " The device adds the @ itself, so leave it off." : ""));
      poll(handle, seq);
    }

    function poll(handle, my) {
      cur.live(handle).then(function (r) {
        if (my !== seq) return;
        if (first === null) first = r[0];
        st.primary = r[0]; st.secondary = r[1] || 0; st.tertiary = r[2] || 0; st.delta = r[0] - first; st.status = "ok"; st.stale = false;
        next = Date.now() + period * 1000; render();
        var mins = period / 60;
        say("<b>Live from " + esc(SM.PLATS[st.p].name) + ".</b> This is the real number, read the way the device reads it. It checks again in " +
          (mins === 1 ? "a minute" : mins + " minutes") + (SM.PLATS[st.p].gauge ? "." : ", and the green pill shows what it gained while you watch."));
        schedule(handle, my);
      }, function (e) {
        if (my !== seq) return;
        var kind = e && e.kind || "network", name = esc(SM.PLATS[st.p].name);
        var atHint = SM.PLATS[st.p].at && handle.charAt(0) === "@" ? " Leave off the @: the device adds it for you." : "";
        if (e && e.device) {
          // The platform answered, so this is the screen the device shows for the same name
          // (poller.ino classify(): 404 not found, 401/403 key, anything else can't reach).
          if (st.status === "ok" && kind !== "not_found") { st.stale = true; schedule(handle, my); }
          else { st.status = kind; st.stale = false; }
          render();
          say({
            not_found: "<b>Not found.</b> " + esc(e.hint || "Check the spelling and try again.") + atHint + " This is what the device shows too.",
            auth: "<b>" + name + " refused the lookup.</b> " + esc(e.hint || "That account is not public.") + " The device shows this screen too.",
            unreachable: "<b>" + name + " did not accept that name.</b> " + esc(e.hint || "Check the spelling and try again.") + atHint + " The device shows this screen too."
          }[kind] || "");
          return;
        }
        // No answer the device would get too (blocked request, this network's rate limit,
        // a name the page cannot send): keep any number already shown, else no screen.
        if (st.status === "ok") { render(); schedule(handle, my); }
        else { st = null; offScreen("No screen yet"); }
        say({
          not_found: "<b>Not found.</b> " + esc(e.hint || "Check the spelling and try again."),
          rate_limited: "<b>" + name + " says slow down.</b> Too many lookups from this network for now. Try again in a few minutes; the device paces itself so this does not happen.",
          network: "<b>Could not reach " + name + " from this page.</b> Check your connection, or try another platform. The device reads it directly."
        }[kind] || "");
      });
    }
    function schedule(handle, my) {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (my !== seq) return;
        if (!inView || document.hidden) { schedule(handle, my); return; }   // wait; don't spend requests off-screen
        poll(handle, my);
      }, period * 1000);
    }

    form.addEventListener("submit", function (ev) { ev.preventDefault(); if (!input.disabled) run(); });

    var started = false;
    // A landing page can open the tool on its own platform: <div id="meterTool" data-platform="github">.
    var first0 = root.getAttribute("data-platform");
    if (!T.some(function (t) { return t.key === first0; })) first0 = "bluesky";
    function start() { if (!started) { started = true; select(first0); } }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { inView = e.isIntersecting; if (inView) { start(); render(); } });
      }, { rootMargin: "200px 0px" }).observe(root);
    } else { inView = true; start(); }
  }

  /* ---------- live reads: same endpoints and fields as socialmeter/poller.ino ---------- */
  // device: the platform answered, so the firmware would show the same caption for this name.
  function fail(kind, hint, device) { var e = new Error(kind); e.kind = kind; e.hint = hint; e.device = !!device; return e; }
  function get(url, onStatus) {
    var ctl = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, 10000);
    return fetch(url, { signal: ctl ? ctl.signal : undefined, cache: "no-store" }).then(function (r) {
      clearTimeout(to);
      if (r.ok) return r.json().catch(function () { throw fail("not_found", null, true); });
      var custom = onStatus && onStatus(r);
      if (custom) throw custom;
      // A rate limit is on this browser's network, not the visitor's device.
      if (r.status === 429) throw fail("rate_limited");
      // poller.ino classify()
      if (r.status === 401 || r.status === 403) throw fail("auth", null, true);
      if (r.status === 404) throw fail("not_found", null, true);
      throw fail("unreachable", null, true);
    }, function () { clearTimeout(to); throw fail("network"); });
  }
  function num(v) { v = Number(v); return isFinite(v) && v > 0 ? Math.floor(v) : 0; }

  function bluesky(h) {   // app.bsky.actor.getProfile: followersCount, postsCount, followsCount
    return get("https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=" + encodeURIComponent(h), function (r) {
      if (r.status === 400) return fail("unreachable", "Use the full handle, like name.bsky.social.", true);
    }).then(function (j) {
      if (j.followersCount == null) throw fail("not_found", null, true);
      return [num(j.followersCount), num(j.postsCount), num(j.followsCount)];
    });
  }
  function github(h) {    // /users/<u>: followers, public_repos, following
    return get("https://api.github.com/users/" + encodeURIComponent(h), function (r) {
      if (r.status === 403 && r.headers.get("x-ratelimit-remaining") === "0") return fail("rate_limited");
    }).then(function (j) {
      if (j.followers == null) throw fail("not_found", null, true);
      return [num(j.followers), num(j.public_repos), num(j.following)];
    });
  }
  function npm(h) {       // downloads/point/last-week (+ last-month, last-day best-effort)
    var u = "https://api.npmjs.org/downloads/point/";
    return get(u + "last-week/" + encodeURIComponent(h).replace("%40", "@").replace("%2F", "/"), function (r) {
      if (r.status === 404) return fail("not_found", "Use the package name exactly as on npmjs.com.", true);
    }).then(function (j) {
      if (j.downloads == null) throw fail("not_found", null, true);
      var soft = function (p) { return get(u + p + "/" + encodeURIComponent(h).replace("%40", "@").replace("%2F", "/")).then(function (x) { return num(x.downloads); }, function () { return 0; }); };
      return Promise.all([soft("last-month"), soft("last-day")]).then(function (r) { return [num(j.downloads), r[0], r[1]]; });
    });
  }
  function mastodon(h) {  // user@instance -> accounts/lookup -> accounts/<id>
    var at = h.indexOf("@");
    if (at <= 0) return Promise.reject(fail("not_found", "Type the full handle, user@instance, like name@mastodon.social.", true));
    var user = h.slice(0, at), inst = h.slice(at + 1).replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(inst)) return Promise.reject(fail("not_found", "The part after @ should be the server, like mastodon.social."));
    return get("https://" + inst + "/api/v1/accounts/lookup?acct=" + encodeURIComponent(user)).then(function (a) {
      if (!a.id) throw fail("not_found", null, true);
      return get("https://" + inst + "/api/v1/accounts/" + encodeURIComponent(a.id));
    }).then(function (j) {
      if (j.followers_count == null) throw fail("not_found", null, true);
      return [num(j.followers_count), num(j.statuses_count), num(j.following_count)];
    });
  }
  function discord(h) {   // guilds/<id>/widget.json: presence_count
    if (!/^\d{15,22}$/.test(h)) return Promise.reject(fail("not_found", "The server ID is a long number. Turn on Developer Mode in Discord, then right-click the server and Copy Server ID."));
    return get("https://discord.com/api/guilds/" + h + "/widget.json", function (r) {
      if (r.status === 403) return fail("auth", "That server's widget is off. An admin turns it on in Server Settings, Widget.", true);
    }).then(function (j) {
      if (j.presence_count == null) throw fail("not_found", null, true);
      return [num(j.presence_count), 0, 0];
    });
  }
  function minecraft(h) { // mcsrvstat.us v3: players.online, players.max; a down server reads 0
    return get("https://api.mcsrvstat.us/3/" + encodeURIComponent(h)).then(function (j) {
      if (j.online == null) throw fail("not_found", null, true);
      var on = !!j.online && j.players;
      return [on ? num(j.players.online) : 0, on ? num(j.players.max) : 0, 0];
    });
  }
  function wikipedia(h) { // pageviews per-article, last 30 days: sum, latest day, days returned
    var project = "en.wikipedia", article = h, slash = h.indexOf("/");
    if (slash > 0) { project = h.slice(0, slash); article = h.slice(slash + 1); }
    article = article.replace(/ /g, "_");
    var now = new Date(), from = new Date(now.getTime() - 30 * 864e5);
    var d = function (x) { return x.toISOString().slice(0, 10).replace(/-/g, ""); };
    return get("https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/" + encodeURIComponent(project) +
      "/all-access/user/" + encodeURIComponent(article) + "/daily/" + d(from) + "/" + d(now), function (r) {
      var wh = "Use the article title as it appears in its link, like ESP32 or en.wikipedia/Solar_power.";
      if (r.status === 404) return fail("not_found", wh, true);
      if (r.status === 400) return fail("unreachable", wh, true);
    }).then(function (j) {
      var items = j.items || [];
      if (!items.length) throw fail("not_found", null, true);
      var sum = 0, last = 0;
      items.forEach(function (it) { last = num(it.views); sum += last; });
      return [sum, last, items.length];
    });
  }
})();
