/* socialMeter landing pages: draw the small platform screens (canvas[data-sm-plat])
 * with the firmware's demo numbers, once each is near the viewport. The hero and the
 * "See your count" tool are handled by products/social/screen.js and tool.js. */
(function () {
  "use strict";
  var SM = window.SocialMeter;
  if (!SM) return;
  SM.ready.then(function () {
    var cvs = Array.prototype.slice.call(document.querySelectorAll("canvas[data-sm-plat]"));
    function paint(cv) {
      var k = cv.getAttribute("data-sm-plat");
      if (cv.dataset.done || !SM.SAMPLE[k]) return;
      cv.dataset.done = "1";
      SM.draw(new SM.FB(cv), SM.sampleState(k));
    }
    if (!("IntersectionObserver" in window)) { cvs.forEach(paint); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { paint(e.target); io.unobserve(e.target); } });
    }, { rootMargin: "300px 0px" });
    cvs.forEach(function (cv) { io.observe(cv); });
  }, function () { /* fonts/logos missing: canvases stay dark, text still reads */ });
})();
