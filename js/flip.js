/* ============================================================
   flip.js — FlipUnit · CalendarDayCard · CountdownDisplay
   Global: window.Flip
   Realistic split-flap animation: only the unit whose value
   changed animates; everything else stays perfectly still.
   ============================================================ */
(function () {
  'use strict';

  const TOP_MS = 210, BOTTOM_MS = 250;

  /* ---------- FlipUnit: one mechanical split-flap card ---------- */
  class FlipUnit {
    /**
     * @param {HTMLElement} mount  container to build into
     * @param {Object} opts { label, theme:'dark'|'light', days:boolean, isAnimated:()=>bool }
     */
    constructor(mount, opts) {
      this.o = Object.assign({ label: '', theme: 'dark', days: false, isAnimated: () => true }, opts || {});
      this.value = null;
      this.busy = false;
      this.pending = null;
      this.timers = [];
      this.build(mount);
    }

    build(mount) {
      const unit = document.createElement('div');
      unit.className = 'flip-unit' + (this.o.days ? ' flip-unit--days' : '');

      const top = document.createElement('div');
      top.className = 'unit-top';
      if (this.o.days) {
        // Hanging mini-calendar chip (mirrors the reference design)
        const chip = document.createElement('div');
        chip.className = 'day-chip';
        chip.innerHTML = '<b>–</b><span>DAYS</span>';
        this.chipNum = chip.querySelector('b');
        top.appendChild(chip);
      } else {
        const lab = document.createElement('div');
        lab.className = 'unit-label';
        lab.textContent = this.o.label;
        top.appendChild(lab);
      }

      const flip = document.createElement('div');
      flip.className = 'flip' + (this.o.theme === 'light' ? ' light' : '') + (this.o.days ? ' flip--days' : '');
      flip.setAttribute('role', 'timer');
      flip.setAttribute('aria-label', this.o.days ? 'days' : this.o.label.toLowerCase());

      const mk = (cls, numCls) => {
        const d = document.createElement('div');
        d.className = cls;
        const s = document.createElement('span');
        s.className = 'num ' + (numCls || '');
        s.textContent = this.o.days ? '0' : '00';
        d.appendChild(s);
        flip.appendChild(d);
        return s;
      };

      if (this.o.days) {
        this.sizer = document.createElement('span');
        this.sizer.className = 'sizer';
        this.sizer.textContent = '0';
        flip.appendChild(this.sizer); // gives the card intrinsic width for 1–3+ digits
      }
      this.halfTop = mk('half half-top');
      this.halfBottom = mk('half half-bottom');
      this.flapTop = mk('flap flap-top');
      this.flapBottom = mk('flap flap-bottom');

      const split = document.createElement('div'); split.className = 'split'; flip.appendChild(split);
      const frame = document.createElement('div'); frame.className = 'frame'; flip.appendChild(frame);
      const rl = document.createElement('div'); rl.className = 'rivet l'; flip.appendChild(rl);
      const rr = document.createElement('div'); rr.className = 'rivet r'; flip.appendChild(rr);

      unit.appendChild(top);
      unit.appendChild(flip);
      mount.appendChild(unit);
      this.el = flip;
    }

    clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; }
    later(fn, ms) { this.timers.push(setTimeout(fn, ms)); }

    setHalves(v) { this.halfTop.textContent = v; this.halfBottom.textContent = v; }

    setInstant(v) {
      this.clearTimers();
      this.el.classList.remove('anim-top', 'anim-bottom');
      this.setHalves(v);
      this.flapTop.textContent = v;
      this.flapBottom.textContent = v;
      if (this.sizer) this.sizer.textContent = v;
      if (this.chipNum) this.chipNum.textContent = v;
      this.value = v; this.busy = false; this.pending = null;
      this.el.setAttribute('aria-label', (this.o.days ? 'days: ' : this.o.label.toLowerCase() + ': ') + v);
    }

    setValue(v, animate) {
      v = String(v);
      if (v === this.value) return;
      const wantAnim = animate !== false && this.o.isAnimated() && !document.hidden && this.value !== null;
      if (!wantAnim) { this.setInstant(v); return; }
      if (this.busy) { this.pending = v; return; } // coalesce rapid changes

      this.busy = true;
      const prev = this.value;
      this.flapTop.textContent = prev;      // falling leaf shows OLD value
      this.flapBottom.textContent = v;      // rising leaf shows NEW value
      if (this.sizer) this.sizer.textContent = v; // width follows new digit count
      if (this.chipNum) this.chipNum.textContent = v;
      this.el.setAttribute('aria-label', (this.o.days ? 'days: ' : this.o.label.toLowerCase() + ': ') + v);
      // Force reflow so the animation restarts cleanly
      void this.el.offsetWidth;
      this.el.classList.add('anim-top');

      this.later(() => {
        // Top leaf has fallen: top half now shows the new value
        this.halfTop.textContent = v;
        this.el.classList.remove('anim-top');
        this.el.classList.add('anim-bottom');
        this.later(() => {
          // Bottom leaf has landed: settle everything on the new value
          this.halfBottom.textContent = v;
          this.el.classList.remove('anim-bottom');
          this.value = v;
          this.busy = false;
          if (this.pending !== null && this.pending !== v) {
            const p = this.pending; this.pending = null;
            this.setValue(p, true);
          } else { this.pending = null; }
        }, BOTTOM_MS);
      }, TOP_MS);
    }
  }

  /* ---------- CalendarDayCard: distinctive paper-calendar Days card ---------- */
  class CalendarDayCard extends FlipUnit {
    constructor(mount, opts) {
      super(mount, Object.assign({ theme: 'light', days: true }, opts || {}));
    }
  }

  /* ---------- CountdownDisplay: the 4-unit centerpiece ---------- */
  class CountdownDisplay {
    constructor(rowEl, opts) {
      this.o = Object.assign({ isAnimated: () => true }, opts || {});
      rowEl.innerHTML = '';
      this.days = new CalendarDayCard(rowEl, { isAnimated: this.o.isAnimated });
      this.hours = new FlipUnit(rowEl, { label: 'Hours', isAnimated: this.o.isAnimated });
      this.minutes = new FlipUnit(rowEl, { label: 'Minutes', isAnimated: this.o.isAnimated });
      this.seconds = new FlipUnit(rowEl, { label: 'Seconds', isAnimated: this.o.isAnimated });
    }

    /** Push a decomposed remaining-time object into the four units. */
    update(rem, animate) {
      this.days.setValue(String(Math.max(0, rem.days)), animate);
      this.hours.setValue(String(rem.hours).padStart(2, '0'), animate);
      this.minutes.setValue(String(rem.minutes).padStart(2, '0'), animate);
      this.seconds.setValue(String(rem.seconds).padStart(2, '0'), animate);
    }

    setInstantAll(rem) { this.update(rem, false); }
  }

  window.Flip = { FlipUnit, CalendarDayCard, CountdownDisplay };
})();
