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

  /* ---------- booking ----------
     Days are counted in Chicago time so the page and /api/book agree on what
     "tomorrow" is for a visitor anywhere. /api/slots greys out anything already
     on AKW's calendar; if the calendar is not connected every slot stays open
     and the request still emails straight to AKW. */
  var dayGrid = document.getElementById('dayGrid');
  var bookingForm = document.getElementById('bookingForm');
  if (dayGrid && bookingForm) {
    var pickedLine = document.getElementById('pickedLine');
    var slotGrid = document.getElementById('slotGrid');
    var bookErr = document.getElementById('bookErr');
    var bookDone = document.getElementById('bookDone');
    var bookDoneLine = document.getElementById('bookDoneLine');
    var bookBtn = bookingForm.querySelector('.booking__submit');
    var picked = { day: null, dayLabel: null, time: null, timeLabel: null };
    var taken = {};
    var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var DOWL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    var chicagoToday = function () {
      try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      } catch (e) {
        var n = new Date();
        return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
      }
    };
    var localDays = function () {
      var out = [];
      var t = new Date(chicagoToday() + 'T12:00:00Z').getTime();
      while (out.length < 12) {
        t += 86400000;
        var d = new Date(t);
        if (d.getUTCDay() === 0) continue; /* no Sundays */
        out.push(d.toISOString().slice(0, 10));
      }
      return out;
    };

    var drawDays = function (list) {
      dayGrid.innerHTML = '';
      list.slice(0, 12).forEach(function (ymd) {
        var d = new Date(ymd + 'T12:00:00Z');
        var full = (taken[ymd] || []).length >= slotGrid.querySelectorAll('.slot').length;
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'day';
        b.setAttribute('role', 'option');
        b.setAttribute('aria-selected', String(picked.day === ymd));
        b.dataset.date = ymd;
        b.dataset.label = DOWL[d.getUTCDay()] + ', ' + MON[d.getUTCMonth()] + ' ' + d.getUTCDate();
        b.setAttribute('aria-label', b.dataset.label + (full ? ', fully booked' : ''));
        if (full) { b.disabled = true; b.classList.add('is-full'); }
        b.innerHTML =
          '<span class="day__dow">' + DOW[d.getUTCDay()] + '</span>' +
          '<span class="day__num">' + d.getUTCDate() + '</span>' +
          '<span class="day__mon">' + (full ? 'Full' : MON[d.getUTCMonth()]) + '</span>';
        dayGrid.appendChild(b);
      });
    };

    var paintSlots = function () {
      var t = picked.day ? (taken[picked.day] || []) : [];
      slotGrid.querySelectorAll('.slot').forEach(function (el) {
        var off = t.indexOf(el.dataset.time) >= 0;
        el.disabled = off;
        el.classList.toggle('is-taken', off);
        el.setAttribute('aria-label', el.dataset.label + (off ? ', taken' : ''));
        if (off && picked.time === el.dataset.time) {
          picked.time = null; picked.timeLabel = null;
          el.setAttribute('aria-selected', 'false');
        }
      });
    };

    var updatePicked = function () {
      if (picked.day && picked.time) pickedLine.textContent = 'Requested: ' + picked.dayLabel + ' at ' + picked.timeLabel;
      else if (picked.day) pickedLine.textContent = picked.dayLabel + ' · now pick a time';
      else pickedLine.textContent = '';
    };

    var dayList = localDays();
    drawDays(dayList);

    var loadSlots = function () {
      if (!window.fetch) return Promise.resolve();
      return fetch('/api/slots', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || !j.ok) return;
          taken = j.taken || {};
          if (j.days && j.days.length) dayList = j.days;
          if (picked.day && dayList.indexOf(picked.day) < 0) { picked.day = null; picked.dayLabel = null; }
          drawDays(dayList);
          paintSlots();
          updatePicked();
        })
        .catch(function () { /* offline or not deployed: every slot stays open */ });
    };
    loadSlots();

    dayGrid.addEventListener('click', function (e) {
      var btn = e.target.closest('.day');
      if (!btn || btn.disabled) return;
      dayGrid.querySelectorAll('.day').forEach(function (el) { el.setAttribute('aria-selected', 'false'); });
      btn.setAttribute('aria-selected', 'true');
      picked.day = btn.dataset.date;
      picked.dayLabel = btn.dataset.label;
      paintSlots();
      updatePicked();
    });

    slotGrid.addEventListener('click', function (e) {
      var btn = e.target.closest('.slot');
      if (!btn || btn.disabled) return;
      slotGrid.querySelectorAll('.slot').forEach(function (el) { el.setAttribute('aria-selected', 'false'); });
      btn.setAttribute('aria-selected', 'true');
      picked.time = btn.dataset.time;
      picked.timeLabel = btn.dataset.label;
      updatePicked();
    });

    /* /#book-ponds style links from the service pages pre-pick the kind of work */
    var HASH_TYPE = {
      'book-drainage': 'Farm drainage or field tile',
      'book-waterway': 'Waterway',
      'book-ponds': 'Pond, new or cleanout',
      'book-siteprep': 'Site prep, basement or grading',
      'book-clearing': 'Clearing or tree mulching'
    };
    var applyHash = function () {
      var key = (location.hash || '').slice(1);
      if (!HASH_TYPE[key]) return;
      document.getElementById('btype').value = HASH_TYPE[key];
      var book = document.getElementById('book');
      if (book) book.scrollIntoView();
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);

    var val = function (id) { return document.getElementById(id).value.trim(); };

    bookingForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {
        day: picked.day, time: picked.time,
        name: val('bname'), phone: val('bphone'), email: val('bemail'),
        place: val('btown'), type: document.getElementById('btype').value,
        notes: val('bnotes'), company: val('bcompany')
      };
      var ok = data.day && data.time && data.name && data.phone && data.place && data.type;
      bookErr.textContent = 'Pick a day and a time, and fill in your name, phone, property location and the kind of work.';
      bookErr.hidden = !!ok;
      if (!ok) return;

      bookBtn.disabled = true;
      bookBtn.textContent = 'Sending…';
      fetch('/api/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j }; }); })
        .then(function (res) {
          if (res.status === 200 && res.j.ok) {
            bookDoneLine.textContent = data.name + ', you asked for ' + picked.dayLabel + ' at ' + picked.timeLabel +
              ' for ' + data.type.toLowerCase() + ' near ' + data.place + '.' +
              (data.email ? ' A confirmation is on its way to ' + data.email + '.' : '');
            bookDone.hidden = false;
            bookDone.focus({ preventScroll: true });
            bookDone.scrollIntoView({ behavior: 'smooth', block: 'center' });
            bookBtn.textContent = 'Request sent';
            loadSlots();
            return;
          }
          bookBtn.disabled = false;
          bookBtn.textContent = 'Request this time';
          if (res.status === 409) {
            bookErr.textContent = 'Someone just took that time. Pick another one.';
            loadSlots();
          } else if (res.j && res.j.error === 'bad_email') {
            bookErr.textContent = 'That email does not look right. Fix it or leave it blank.';
          } else {
            bookErr.textContent = 'That did not go through. Call Kevin at (309) 303-1854 and he will get you on the schedule.';
          }
          bookErr.hidden = false;
        })
        .catch(function () {
          bookBtn.disabled = false;
          bookBtn.textContent = 'Request this time';
          bookErr.textContent = 'No connection. Call Kevin at (309) 303-1854 and he will get you on the schedule.';
          bookErr.hidden = false;
        });
    });
  }

  /* ---------- quick note form ---------- */
  var quickForm = document.getElementById('quickForm');
  if (quickForm) {
    var quickErr = document.getElementById('quickErr');
    var quickDone = document.getElementById('quickDone');
    var quickBtn = quickForm.querySelector('.btn');
    quickForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = function (id) { return document.getElementById(id).value.trim(); };
      var data = { name: q('qname'), phone: q('qphone'), message: q('qmsg'), company: q('qcompany'), page: location.pathname };
      var ok = data.name && data.phone && data.message;
      quickErr.textContent = 'Fill in all three fields so we can call you back.';
      quickErr.hidden = !!ok;
      if (!ok) return;
      quickBtn.disabled = true;
      quickBtn.textContent = 'Sending…';
      fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return r.ok && j.ok; }); })
        .then(function (sent) {
          if (sent) {
            quickDone.hidden = false;
            quickBtn.textContent = 'Sent';
            return;
          }
          throw new Error('fail');
        })
        .catch(function () {
          quickBtn.disabled = false;
          quickBtn.textContent = 'Send it';
          quickErr.textContent = 'That did not go through. Call Kevin at (309) 303-1854.';
          quickErr.hidden = false;
        });
    });
  }

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


  /* ---------- footer entrance (once, when it scrolls into view) ---------- */
  var fa = document.querySelectorAll('[data-fa]');
  if (fa.length) {
    if ('IntersectionObserver' in window) {
      var fio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('fa-in'); fio.unobserve(en.target); }
        });
      }, { threshold: 0.1 });
      fa.forEach(function (el) { fio.observe(el); });
    } else {
      fa.forEach(function (el) { el.classList.add('fa-in'); });
    }
  }

  /* ---------- footer year ---------- */
  var yr = document.getElementById('year');
  if (yr) yr.textContent = String(new Date().getFullYear());
})();
