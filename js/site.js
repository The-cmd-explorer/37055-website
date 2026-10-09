// Visual extras shared by every page: the starfield, nav behaviour, scroll
// reveals, the rolling team number and the ticker. None of it is required;
// every page still works if this file fails to load.
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var each = function (selector, fn) { Array.prototype.forEach.call(document.querySelectorAll(selector), fn); };

  // ---------- Scroll reveal ----------
  // Elements with [data-reveal] fade up the first time they scroll into view.
  // Children of [data-stagger] get an index so they come in one after another.
  each("[data-stagger]", function (group) {
    Array.prototype.forEach.call(group.querySelectorAll("[data-reveal]"), function (el, i) {
      el.style.setProperty("--i", i);
    });
  });
  if (reduceMotion || !("IntersectionObserver" in window)) {
    each("[data-reveal]", function (el) { el.classList.add("is-visible"); });
  } else {
    var revealer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealer.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
    each("[data-reveal]", function (el) { revealer.observe(el); });
  }

  // ---------- Rolling team number ----------
  // Turns "37055" into one strip of digits per character that rolls into place.
  each("[data-counter]", function (counter) {
    if (!reduceMotion) {
      var value = counter.textContent.trim();
      counter.textContent = "";
      value.split("").forEach(function (ch, i) {
        var digit = document.createElement("span");
        digit.className = "digit";
        if (/\d/.test(ch)) {
          var strip = document.createElement("span");
          strip.className = "strip";
          strip.style.setProperty("--n", 10 + Number(ch));
          strip.style.setProperty("--i", i);
          for (var k = 0; k < 20; k++) {
            var n = document.createElement("span");
            n.textContent = k % 10;
            strip.appendChild(n);
          }
          digit.appendChild(strip);
        } else {
          digit.textContent = ch;
        }
        counter.appendChild(digit);
      });
    }
    counter.classList.add("is-ready");
  });

  // Content is safe to show now, so cancel the "show everything" fallback in <head>.
  if (window.revealFallback) clearTimeout(window.revealFallback);

  // ---------- Nav ----------
  var nav = document.querySelector(".nav");
  if (nav) {
    var onScroll = function () { nav.classList.toggle("scrolled", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    var toggle = nav.querySelector(".nav-toggle");
    if (toggle) {
      var setOpen = function (open) {
        nav.classList.toggle("open", open);
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      };
      toggle.addEventListener("click", function () { setOpen(!nav.classList.contains("open")); });
      Array.prototype.forEach.call(nav.querySelectorAll(".nav-links a"), function (a) {
        a.addEventListener("click", function () { setOpen(false); });
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && nav.classList.contains("open")) { setOpen(false); toggle.focus(); }
      });
      document.addEventListener("click", function (e) { if (!nav.contains(e.target)) setOpen(false); });
      window.addEventListener("resize", function () { if (window.innerWidth > 720) setOpen(false); });
    }

    // Highlight the link for the section currently in the middle of the screen.
    var links = nav.querySelectorAll('.nav-links a[href^="#"]:not([href="#"])');
    if (links.length && "IntersectionObserver" in window) {
      var linkFor = new Map();
      Array.prototype.forEach.call(links, function (a) {
        var section = document.getElementById(a.getAttribute("href").slice(1));
        if (section) linkFor.set(section, a);
      });
      var hero = document.querySelector(".hero");
      if (hero) linkFor.set(hero, null);
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var current = linkFor.get(entry.target);
          Array.prototype.forEach.call(links, function (a) { a.classList.toggle("active", a === current); });
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      linkFor.forEach(function (_, section) { spy.observe(section); });
    }
  }

  // ---------- Ticker ----------
  // Repeats the group until it overflows the screen, then scrolls by exactly
  // one group width so the loop is seamless.
  each("[data-marquee]", function (ticker) {
    var band = ticker.querySelector(".ticker-band");
    var track = ticker.querySelector(".ticker-track");
    var group = track && track.querySelector(".ticker-group");
    if (!band || !group || reduceMotion) return;
    function fill() {
      var width = parseFloat(getComputedStyle(group).width);
      if (!width) return;
      var needed = Math.ceil(band.offsetWidth / width) + 1;
      while (track.children.length < needed) track.appendChild(group.cloneNode(true));
      track.style.setProperty("--shift", width + "px");
      track.style.setProperty("--marquee-duration", (width / 50).toFixed(2) + "s");
      ticker.classList.add("is-ready");
    }
    fill();
    window.addEventListener("resize", fill);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fill);
  });

  // ---------- Card spotlight ----------
  if (finePointer) {
    each("[data-spotlight]", function (card) {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty("--mx", (e.clientX - r.left) + "px");
        card.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    });
  }

  // ---------- Starfield ----------
  // <canvas data-starfield> draws a twinkling, slowly drifting star field with
  // the odd shooting star. data-starfield="static" draws it once and stops.
  function starfield(canvas) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    var animate = !reduceMotion && canvas.getAttribute("data-starfield") !== "static";
    var host = canvas.closest(".hero");
    var tints = ["255,246,226", "255,246,226", "255,246,226", "255,214,150", "214,212,255"];
    var stars = [], meteors = [];
    var w = 0, h = 0;
    var target = { x: 0, y: 0 }, eased = { x: 0, y: 0 }, lastSet = { x: 0, y: 0 };
    var visible = true, frameId = 0, lastTime = 0, nextMeteor = 0;

    function build(count) {
      stars = [];
      for (var i = 0; i < count; i++) {
        var depth = Math.random();
        stars.push({
          x: Math.random(),
          y: Math.random(),
          r: 0.35 + depth * depth * 1.25,
          a: 0.3 + Math.random() * 0.6,
          speed: 0.5 + Math.random() * 1.8,
          phase: Math.random() * Math.PI * 2,
          depth: depth,
          tint: tints[Math.floor(Math.random() * tints.length)]
        });
      }
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Positions are stored as fractions, so stars only need rebuilding when
      // the density would change noticeably (not on every mobile toolbar resize).
      var count = Math.min(Math.round((w * h) / 3600), 460);
      if (Math.abs(count - stars.length) > stars.length * 0.25) build(count);
      draw(performance.now());
    }

    function spawnMeteor() {
      var angle = (135 + Math.random() * 25) * Math.PI / 180;
      var speed = 650 + Math.random() * 350;
      meteors.push({
        x: w * (0.35 + Math.random() * 0.65),
        y: h * Math.random() * 0.45,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: 0.7 + Math.random() * 0.4
      });
    }

    function draw(now) {
      var dt = Math.min(Math.max((now - lastTime) / 1000, 0), 0.05);
      lastTime = now;
      var t = now / 1000;

      eased.x += (target.x - eased.x) * 0.05;
      eased.y += (target.y - eased.y) * 0.05;
      if (host && (Math.abs(eased.x - lastSet.x) > 0.001 || Math.abs(eased.y - lastSet.y) > 0.001)) {
        host.style.setProperty("--px", eased.x.toFixed(3));
        host.style.setProperty("--py", eased.y.toFixed(3));
        lastSet.x = eased.x;
        lastSet.y = eased.y;
      }

      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var x = s.x * w - eased.x * s.depth * 28 - (animate ? t * (2 + s.depth * 6) : 0);
        var y = s.y * h - eased.y * s.depth * 28;
        x = ((x % w) + w) % w;
        y = ((y % h) + h) % h;
        var alpha = animate ? s.a * (0.6 + 0.4 * Math.sin(t * s.speed + s.phase)) : s.a;
        ctx.fillStyle = "rgba(" + s.tint + "," + alpha.toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.r > 1.5) {
          // The brightest few get a small four-point glint, like the logo.
          var len = s.r * 4.5;
          ctx.strokeStyle = "rgba(" + s.tint + "," + (alpha * 0.45).toFixed(3) + ")";
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(x - len, y); ctx.lineTo(x + len, y);
          ctx.moveTo(x, y - len); ctx.lineTo(x, y + len);
          ctx.stroke();
        }
      }

      if (!animate) return;
      if (now > nextMeteor) {
        if (nextMeteor) spawnMeteor();
        nextMeteor = now + 3500 + Math.random() * 6000;
      }
      for (var j = meteors.length - 1; j >= 0; j--) {
        var m = meteors[j];
        m.age += dt;
        var k = m.age / m.life;
        if (k >= 1) { meteors.splice(j, 1); continue; }
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        var tailX = m.x - m.vx * 0.12, tailY = m.y - m.vy * 0.12;
        var trail = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
        trail.addColorStop(0, "rgba(255,246,226," + (0.85 * Math.sin(k * Math.PI)).toFixed(3) + ")");
        trail.addColorStop(1, "rgba(255,246,226,0)");
        ctx.strokeStyle = trail;
        ctx.lineWidth = 1.3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
      }
    }

    function frame(now) {
      frameId = 0;
      if (!visible) return;
      draw(now);
      frameId = requestAnimationFrame(frame);
    }
    function start() {
      if (animate && visible && !frameId) {
        lastTime = performance.now();
        frameId = requestAnimationFrame(frame);
      }
    }

    var resizeQueued = false;
    function queueResize() {
      if (resizeQueued) return;
      resizeQueued = true;
      requestAnimationFrame(function () { resizeQueued = false; resize(); });
    }
    if ("ResizeObserver" in window) new ResizeObserver(queueResize).observe(canvas);
    else window.addEventListener("resize", queueResize);

    if (animate) {
      // Only animate while the canvas is on screen.
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
          start();
        }).observe(canvas);
      }
      if (finePointer) {
        window.addEventListener("pointermove", function (e) {
          target.x = e.clientX / window.innerWidth - 0.5;
          target.y = e.clientY / window.innerHeight - 0.5;
        }, { passive: true });
      }
    }

    resize();
    start();
  }
  each("canvas[data-starfield]", starfield);

  // ---------- Footer year ----------
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
