import Phaser from 'phaser';

// Responsive fit-and-scroll for a flat group of scene objects.
//
// Given a group of already-built, absolutely-positioned objects and the visible region
// they must live inside, this:
//   1. measures the group's bounding box,
//   2. if it's taller (or wider) than the region, uniformly shrinks the group toward the
//      region centre so it fits — everything stays visible, no scrolling needed,
//   3. if it STILL overflows at the minimum scale (tiny screen / very long list), clips the
//      group to the region and enables vertical drag-scroll so every item stays reachable.
//
// It is a NO-OP when the group already fits (tall screens are untouched), so it is safe to
// attach to every screen. Call once after a group is built; the transform persists whether
// the objects are visible or not.
//
// Returns a small controller: { overflow, reset(), destroy() }.

const MIN_SCALE = 0.55;  // don't shrink text below this; scroll handles the rest

// Shrink a single-line text object so its rendered width never exceeds maxW.
// Keeps text from clipping its box / running off a narrow screen. No-op if it fits.
export function fitText(txtObj, maxW) {
  if (!txtObj || typeof txtObj.width !== 'number') return txtObj;
  const w = txtObj.width; // unscaled width
  txtObj.setScale(w > 0 && w > maxW ? maxW / w : 1);
  return txtObj;
}

export function attachFitScroll(scene, rawObjs, view) {
  const objs = (rawObjs || []).filter(o => o && o.scene);
  if (!objs.length) return { overflow: 0, reset() {}, destroy() {} };

  const left   = view.left  ?? 0;
  const right  = view.right ?? scene.scale.width;
  const top    = view.top;
  const bottom = view.bottom;
  const viewH  = bottom - top;
  const viewW  = right - left;
  const cx     = (left + right) / 2;

  // Capture each object's original transform so the fit is reproducible/reversible.
  objs.forEach(o => {
    o._fsBase = { x: o.x, y: o.y, sx: o.scaleX, sy: o.scaleY };
  });

  // Measure the group's bounds at base transform (works on invisible objects too).
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  objs.forEach(o => {
    if (typeof o.getBounds !== 'function') return;
    const b = o.getBounds();
    if (!isFinite(b.x) || (b.width === 0 && b.height === 0)) return;
    minX = Math.min(minX, b.left);  maxX = Math.max(maxX, b.right);
    minY = Math.min(minY, b.top);   maxY = Math.max(maxY, b.bottom);
  });
  if (!isFinite(minY)) return { overflow: 0, reset() {}, destroy() {} };

  const contentH = Math.max(1, maxY - minY);
  const contentW = Math.max(1, maxX - minX);

  const rawScale = Math.min(viewH / contentH, viewW / contentW, 1);
  const scale    = Math.max(MIN_SCALE, Math.min(1, rawScale));

  const scaledH  = contentH * scale;
  const overflow = Math.max(0, scaledH - viewH);
  const slack    = Math.max(0, viewH - scaledH);
  // Where the content's top edge should sit after fitting (centre the slack vertically).
  const topY     = overflow > 0 ? top : top + slack / 2;

  // Identity when the group already fits at full size — leave tall-screen layouts untouched.
  const isNoOp = scale >= 0.999 && overflow <= 0;

  let scrollY = 0;
  let mask = null;

  const place = () => {
    objs.forEach(o => {
      const base = o._fsBase;
      if (isNoOp) { o.setPosition(base.x, base.y); o.setScale(base.sx, base.sy); return; }
      const nx = cx   + (base.x - cx)   * scale;
      const ny = topY + (base.y - minY) * scale - scrollY;
      o.setPosition(nx, ny);
      o.setScale(base.sx * scale, base.sy * scale);
    });
    // While scrolling, an item clipped out of the region must not still catch taps.
    if (overflow > 0) {
      objs.forEach(o => {
        if (!o.input) return;
        const y = o.y;
        o.input.enabled = (y >= top - 4 && y <= bottom + 4);
      });
    }
  };

  place();

  if (overflow > 0) {
    // Clip the group to the visible region.
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff);
    g.fillRect(left, top, viewW, viewH);
    mask = g.createGeometryMask();
    objs.forEach(o => { if (o.setMask) o.setMask(mask); });

    // Drag-to-scroll. Active only while this group is the visible one.
    let dragging = false, startPtr = 0, startScroll = 0;
    const isActive = () => objs.some(o => o.visible);
    const within   = p => p.x >= left && p.x <= right && p.y >= top && p.y <= bottom;

    const onDown = p => {
      if (!isActive() || !within(p)) return;
      dragging = true; startPtr = p.y; startScroll = scrollY;
    };
    const onMove = p => {
      if (!dragging) return;
      scrollY = Phaser.Math.Clamp(startScroll - (p.y - startPtr), 0, overflow);
      place();
    };
    const onUp = () => { dragging = false; };

    scene.input.on('pointerdown', onDown);
    scene.input.on('pointermove', onMove);
    scene.input.on('pointerup', onUp);
    scene.input.on('pointerupoutside', onUp);

    const controller = {
      overflow,
      reset() { scrollY = 0; place(); },
      destroy() {
        scene.input.off('pointerdown', onDown);
        scene.input.off('pointermove', onMove);
        scene.input.off('pointerup', onUp);
        scene.input.off('pointerupoutside', onUp);
        objs.forEach(o => o.clearMask && o.clearMask());
        mask?.destroy();
      },
    };
    return controller;
  }

  return { overflow: 0, reset() {}, destroy() {} };
}
