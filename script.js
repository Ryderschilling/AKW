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
  var setMenu = function (open) {
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) nav.classList.add('is-scrolled');
    else onScroll();
  };
  burger.addEventListener('click', function () {
    setMenu(menu.hidden);
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

  /* ---------- footer year ---------- */
  document.getElementById('year').textContent = String(new Date().getFullYear());
})();
