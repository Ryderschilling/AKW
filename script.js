/* AKW Excavating · homepage behavior. No frameworks, no libraries. */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  /* ---------- nav scroll state ---------- */
  var nav = document.getElementById('nav');
  var onScroll = function () {
    nav.classList.toggle('is-scrolled', window.scrollY > 60);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- mobile menu ---------- */
  var burger = document.getElementById('burger');
  var menu = document.getElementById('mobilemenu');
  var menuOpen = false;
  var menuTimer = null;

  var setMenu = function (open) {
    if (open === menuOpen) return;
    menuOpen = open;
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    clearTimeout(menuTimer);

    if (open) {
      menu.hidden = false;
      /* one frame with the panel laid out but still off screen, so the
         browser has something to transition from */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { menu.classList.add('is-open'); });
      });
      nav.classList.add('is-scrolled');
    } else {
      menu.classList.remove('is-open');
      menuTimer = setTimeout(function () {
        if (!menuOpen) menu.hidden = true;
      }, 520);
      onScroll();
    }
  };
  burger.addEventListener('click', function () {
    setMenu(!menuOpen);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menuOpen) setMenu(false);
  });
  menu.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { setMenu(false); });
  });

  /* ---------- scroll reveals via IntersectionObserver ---------- */
  var revealed = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealed.forEach(function (el) { io.observe(el); });
  } else {
    revealed.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- recent work: swipe rail progress on phones ---------- */
  var workGrid = document.getElementById('workGrid');
  var workDots = document.getElementById('workDots');
  if (workGrid && workDots) {
    var cards = workGrid.querySelectorAll('.job');
    var i;
    for (i = 0; i < cards.length; i += 1) {
      workDots.appendChild(document.createElement('i'));
    }
    var bars = workDots.querySelectorAll('i');
    var markWork = function () {
      /* the rail only exists under 700px; above that the dots are hidden
         and this is a no-op the browser never paints */
      var card = cards[0];
      if (!card) return;
      var step = card.getBoundingClientRect().width + 13.6; /* card + gap */
      var idx = Math.round(workGrid.scrollLeft / step);
      if (idx < 0) idx = 0;
      if (idx > bars.length - 1) idx = bars.length - 1;
      for (var k = 0; k < bars.length; k += 1) {
        bars[k].classList.toggle('is-on', k <= idx);
      }
    };
    markWork();
    workGrid.addEventListener('scroll', function () {
      window.requestAnimationFrame(markWork);
    }, { passive: true });
    window.addEventListener('resize', markWork);
  }

  /* ---------- booking: day grid ---------- */
  var dayGrid = document.getElementById('dayGrid');
  var pickedLine = document.getElementById('pickedLine');
  var picked = { day: null, time: null };
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var today = new Date();
  var added = 0;
  var offset = 1;
  while (added < 12) {
    var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    offset += 1;
    if (d.getDay() === 0) continue; /* no Sundays */
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'day';
    b.setAttribute('role', 'option');
    b.setAttribute('aria-selected', 'false');
    b.dataset.label = DOW[d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate();
    b.innerHTML =
      '<span class="day__dow">' + DOW[d.getDay()] + '</span>' +
      '<span class="day__num">' + d.getDate() + '</span>' +
      '<span class="day__mon">' + MON[d.getMonth()] + '</span>';
    dayGrid.appendChild(b);
    added += 1;
  }

  var updatePicked = function () {
    if (picked.day && picked.time) {
      pickedLine.textContent = 'Requested: ' + picked.day + ' at ' + picked.time;
    } else if (picked.day) {
      pickedLine.textContent = picked.day + ' · now pick a time';
    } else {
      pickedLine.textContent = '';
    }
  };

  dayGrid.addEventListener('click', function (e) {
    var btn = e.target.closest('.day');
    if (!btn) return;
    dayGrid.querySelectorAll('.day').forEach(function (el) {
      el.setAttribute('aria-selected', 'false');
    });
    btn.setAttribute('aria-selected', 'true');
    picked.day = btn.dataset.label;
    updatePicked();
  });

  var slotGrid = document.getElementById('slotGrid');
  slotGrid.addEventListener('click', function (e) {
    var btn = e.target.closest('.slot');
    if (!btn) return;
    slotGrid.querySelectorAll('.slot').forEach(function (el) {
      el.setAttribute('aria-selected', 'false');
    });
    btn.setAttribute('aria-selected', 'true');
    picked.time = btn.dataset.time;
    updatePicked();
  });

  /* ---------- booking submit ---------- */
  var bookingForm = document.getElementById('bookingForm');
  var bookErr = document.getElementById('bookErr');
  var bookDone = document.getElementById('bookDone');
  var bookDoneLine = document.getElementById('bookDoneLine');

  bookingForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = document.getElementById('bname').value.trim();
    var phone = document.getElementById('bphone').value.trim();
    var town = document.getElementById('btown').value.trim();
    var type = document.getElementById('btype').value;
    var ok = picked.day && picked.time && name && phone && town && type;
    bookErr.hidden = !!ok;
    if (!ok) return;
    bookDoneLine.textContent = name + ', you asked for ' + picked.day + ' at ' + picked.time + ' for ' + type.toLowerCase() + ' near ' + town + '.';
    bookDone.hidden = false;
    bookDone.scrollIntoView({ behavior: 'smooth', block: 'center' });
    bookingForm.querySelector('.booking__submit').textContent = 'Request sent';
    bookingForm.querySelector('.booking__submit').disabled = true;
  });

  /* ---------- quick note form ---------- */
  var quickForm = document.getElementById('quickForm');
  var quickErr = document.getElementById('quickErr');
  var quickDone = document.getElementById('quickDone');

  quickForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var ok = ['qname', 'qphone', 'qmsg'].every(function (id) {
      return document.getElementById(id).value.trim().length > 0;
    });
    quickErr.hidden = !!ok;
    if (!ok) return;
    quickDone.hidden = false;
    quickForm.querySelector('.btn').textContent = 'Sent';
    quickForm.querySelector('.btn').disabled = true;
  });

  /* ---------- hero video, deferred so it never costs the first paint ---------- */
  var heroVideo = document.getElementById('heroVideo');
  if (heroVideo) {
    var conn = navigator.connection || {};
    var slow = conn.saveData === true || /^([23]g|slow-2g)$/.test(conn.effectiveType || '');
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* runs on phones too. the clip is ~0.7 MB, preload none, and it only
       starts after load + 400ms, so the hero photo still owns LCP. */
    if (!slow && !still) {
      /* phones get a portrait cut of the same clip, so the frame is not
         cropped down to a narrow strip by object-fit: cover */
      var phone = window.matchMedia && window.matchMedia('(max-width: 700px)').matches;

      var startHero = function () {
        heroVideo.addEventListener('playing', function () {
          heroVideo.classList.add('is-on');
        }, { once: true });
        if (phone) heroVideo.poster = 'assets/img/hero-mobile-still.webp';
        heroVideo.src = phone ? 'assets/video/hero-mobile.mp4' : 'assets/video/hero-1200.mp4';
        var tryPlay = function () {
          var hp = heroVideo.play();
          if (hp && hp.catch) hp.catch(function () {
            /* a background tab refuses autoplay: try again when it comes forward */
            document.addEventListener('visibilitychange', function onVis() {
              if (document.visibilityState === 'visible') {
                document.removeEventListener('visibilitychange', onVis);
                tryPlay();
              }
            });
          });
        };
        tryPlay();
      };
      /* wait for the page to finish loading so the hero photo owns LCP */
      if (document.readyState === 'complete') setTimeout(startHero, 400);
      else window.addEventListener('load', function () { setTimeout(startHero, 400); });
    }
  }

  /* ---------- aerial reel ---------- */
  var reelVideo = document.getElementById('reelVideo');
  if (reelVideo) {
    var reelStage = reelVideo.parentNode;
    var reelToggle = document.getElementById('reelToggle');
    var reelCap = document.getElementById('reelCap');
    var thumbs = Array.prototype.slice.call(document.querySelectorAll('.rthumb'));
    var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var loaded = false;

    var paint = function () {
      var playing = !reelVideo.paused && !reelVideo.ended;
      reelStage.classList.toggle('is-playing', playing);
      reelToggle.classList.toggle('is-hidden', playing);
      reelToggle.setAttribute('aria-label', playing ? 'Pause the clip' : 'Play the clip');
    };

    var load = function (btn, autoplay) {
      reelVideo.src = btn.dataset.src;
      reelVideo.poster = btn.dataset.poster;
      reelCap.textContent = btn.dataset.cap;
      loaded = true;
      thumbs.forEach(function (t) {
        var on = t === btn;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-pressed', String(on));
      });
      if (autoplay) {
        var p = reelVideo.play();
        if (p && p.catch) p.catch(function () { paint(); });
      }
      paint();
    };

    thumbs.forEach(function (btn) {
      btn.addEventListener('click', function () { load(btn, true); });
    });

    reelToggle.addEventListener('click', function () {
      if (!loaded) { load(thumbs[0], true); return; }
      if (reelVideo.paused) {
        var p = reelVideo.play();
        if (p && p.catch) p.catch(function () { paint(); });
      } else {
        reelVideo.pause();
      }
    });

    reelVideo.addEventListener('play', paint);
    reelVideo.addEventListener('pause', paint);

    /* only fetch the clip once the section is actually on screen */
    if ('IntersectionObserver' in window) {
      var rio = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !loaded) {
            load(thumbs[0], !calm);
            rio.unobserve(entry.target);
          }
        });
      }, { threshold: 0.3 });
      rio.observe(reelStage);
    }
    paint();
  }

  /* ---------- footer year ---------- */
  document.getElementById('year').textContent = String(new Date().getFullYear());
})();
