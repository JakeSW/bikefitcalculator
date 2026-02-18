// Touch-friendly tooltips: tap to toggle on mobile, close when tapping elsewhere
document.addEventListener('DOMContentLoaded', function() {
  document.addEventListener('click', function(e) {
    var tipParent = e.target.closest('.label-tip, .inline-result');
    // Close all other open tooltips
    document.querySelectorAll('.tip-active').forEach(function(el) {
      if (el !== tipParent) el.classList.remove('tip-active');
    });
    // Toggle clicked tooltip
    if (tipParent) {
      tipParent.classList.toggle('tip-active');
    }
  });
});

// ============================================================
// Theme Toggle
// ============================================================

function toggleTheme() {
  const root = document.documentElement;
  const isLight = root.classList.toggle('light');
  document.getElementById('theme-icon').textContent = isLight ? '🌙' : '☀️';
  document.getElementById('theme-label').textContent = isLight ? 'Dark' : 'Light';
  localStorage.setItem('bike-fit-theme', isLight ? 'light' : 'dark');
  if (currentMode === 'compare') renderCompareView();
  else recalculate(); // redraw SVG with new colors
}

// Restore saved theme
(function() {
  const saved = localStorage.getItem('bike-fit-theme');
  if (saved === 'light') {
    document.documentElement.classList.add('light');
    document.getElementById('theme-icon').textContent = '🌙';
    document.getElementById('theme-label').textContent = 'Dark';
  }
})();

// ============================================================
// Frame Presets — Canyon Aeroad CF SLX 2025
// ============================================================

let activePresetLabel = '';

function openPresetModal() {
  compareTarget = null; // ensure normal preset mode
  renderPresetModal();
  document.getElementById('preset-modal').classList.add('open');
  document.getElementById('preset-search').value = '';
  document.getElementById('preset-search').focus();
}

function renderPresetModal() {
  const container = document.getElementById('preset-list');
  const searchTerm = (document.getElementById('preset-search').value || '').toLowerCase();

  let html = '';

  for (const [brand, models] of Object.entries(BIKE_DATABASE).sort(([a], [b]) => a.localeCompare(b))) {
    const brandMatches = brand.toLowerCase().includes(searchTerm);
    let modelHtml = '';
    let anyModelVisible = false;

    for (const [model, data] of Object.entries(models).sort(([a], [b]) => a.localeCompare(b))) {
      const modelMatches = model.toLowerCase().includes(searchTerm) || brandMatches;
      if (!modelMatches && searchTerm) continue;

      anyModelVisible = true;
      let sizeBtns = '';
      const sizeEntries = Object.entries(data.sizes).sort(([a], [b]) => {
        const na = parseFloat(a), nb = parseFloat(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return 0; // preserve original order for non-numeric sizes (XS, S, M, etc.)
      });
      for (const [size, geo] of sizeEntries) {
        const hasData = geo.stack !== null;
        const cls = hasData ? '' : ' no-data';
        const title = hasData
          ? `Stack: ${geo.stack}mm, Reach: ${geo.reach}mm, STA: ${geo.sta}°, HTA: ${geo.hta}°`
          : 'Geometry data not yet entered';
        const escaped = model.replace(/'/g, "\\'");
        sizeBtns += `<button class="preset-size-btn${cls}" title="${title}" onclick="loadBikePreset('${brand}','${escaped}','${size}')">${size}</button>`;
      }

      modelHtml += `
        <div class="preset-model">
          <div class="preset-model-name">${model} <span class="model-year">(${data.year})</span></div>
          <div class="preset-sizes">${sizeBtns}</div>
        </div>
      `;
    }

    if (!anyModelVisible && searchTerm) continue;

    const openClass = searchTerm ? ' open' : '';
    html += `
      <div class="preset-brand${openClass}">
        <div class="preset-brand-header" onclick="this.parentElement.classList.toggle('open')">
          <span>${brand}</span>
          <span class="chevron">&#9654;</span>
        </div>
        <div class="preset-brand-body">${modelHtml}</div>
      </div>
    `;
  }

  if (!html) {
    html = '<p style="color:var(--text-dim);text-align:center;padding:20px;">No bikes match your search.</p>';
  }

  container.innerHTML = html;
}

function loadBikePreset(brand, model, size) {
  const geo = BIKE_DATABASE[brand]?.[model]?.sizes?.[size];
  if (!geo || geo.stack === null) return;

  // If selecting for compare mode, store to compare frame instead
  if (compareTarget) {
    const frameData = {
      brand, model, size,
      stack: geo.stack, reach: geo.reach, sta: geo.sta, hta: geo.hta
    };
    if (compareTarget === 'a') compareFrameA = frameData;
    else compareFrameB = frameData;

    const labelId = compareTarget === 'a' ? 'compare-label-a' : 'compare-label-b';
    document.getElementById(labelId).textContent = `${brand} ${model} \u2014 ${size}`;

    compareTarget = null;
    document.getElementById('preset-modal').classList.remove('open');
    renderCompareView();
    return;
  }

  document.getElementById('stack').value = geo.stack;
  document.getElementById('reach').value = geo.reach;
  document.getElementById('sta').value = geo.sta;
  document.getElementById('hta').value = geo.hta;

  activePresetLabel = `${brand} ${model} — ${size}`;
  const label = document.getElementById('active-preset-label');
  label.textContent = activePresetLabel;
  label.classList.remove('hidden');

  document.getElementById('preset-modal').classList.remove('open');
  recalculate();
}

// Clear preset label when frame inputs are manually changed
['stack', 'reach', 'sta', 'hta'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    document.getElementById('active-preset-label').classList.add('hidden');
    activePresetLabel = '';
  });
});

// ============================================================
// Compare Frames
// ============================================================

let compareTarget = null;   // 'a' or 'b' — which slot the preset modal is selecting for
let compareFrameA = null;   // { brand, model, size, stack, reach, sta, hta }
let compareFrameB = null;

function openComparePresetModal(target) {
  compareTarget = target;
  renderPresetModal();
  document.getElementById('preset-modal').classList.add('open');
  document.getElementById('preset-search').value = '';
  document.getElementById('preset-search').focus();
}

function renderCompareView() {
  drawComparisonDiagram(compareFrameA, compareFrameB);
  renderCompareTable(compareFrameA, compareFrameB);
}

function renderCompareTable(frameA, frameB) {
  const container = document.getElementById('compare-table');
  if (!frameA && !frameB) {
    container.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:20px;">Select two frames to compare geometry.</p>';
    return;
  }

  const metrics = [
    { key: 'stack', label: 'Stack', unit: 'mm' },
    { key: 'reach', label: 'Reach', unit: 'mm' },
    { key: 'sta',   label: 'Seat Tube Angle', unit: '\u00B0' },
    { key: 'hta',   label: 'Head Tube Angle', unit: '\u00B0' },
  ];

  const rows = metrics.map(m => {
    const valA = frameA ? frameA[m.key] : null;
    const valB = frameB ? frameB[m.key] : null;
    const dispA = valA !== null ? valA + m.unit : '\u2014';
    const dispB = valB !== null ? valB + m.unit : '\u2014';
    let diff = '';
    if (valA !== null && valB !== null) {
      const d = Math.round((valB - valA) * 10) / 10;
      const sign = d > 0 ? '+' : '';
      diff = `${sign}${d}${m.unit}`;
    }
    return `<tr>
      <td class="compare-metric">${m.label}</td>
      <td class="compare-val-a">${dispA}</td>
      <td class="compare-val-b">${dispB}</td>
      <td class="compare-diff">${diff}</td>
    </tr>`;
  }).join('');

  const labelA = frameA ? `${frameA.brand} ${frameA.model} ${frameA.size}` : 'Frame A';
  const labelB = frameB ? `${frameB.brand} ${frameB.model} ${frameB.size}` : 'Frame B';

  container.innerHTML = `
    <table class="compare-table">
      <thead>
        <tr>
          <th></th>
          <th style="color:var(--accent)">${labelA}</th>
          <th style="color:var(--green)">${labelB}</th>
          <th>Difference</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function drawComparisonDiagram(frameA, frameB) {
  const svg = document.getElementById('compare-svg');
  const W = 800, H = 500;
  const cs = getComputedStyle(document.documentElement);
  const colGrid = cs.getPropertyValue('--svg-grid').trim();
  const colFrame = cs.getPropertyValue('--svg-frame').trim();
  const colDimSubtle = cs.getPropertyValue('--svg-dim-subtle').trim();
  const colTextSubtle = cs.getPropertyValue('--svg-text-subtle').trim();
  const colGround = cs.getPropertyValue('--svg-ground').trim();
  const colBBLabel = cs.getPropertyValue('--svg-bb-label').trim();
  const colAccent = cs.getPropertyValue('--accent').trim();
  const colGreen = cs.getPropertyValue('--green').trim();
  const isLight = document.documentElement.classList.contains('light');
  const colBBStroke = isLight ? '#333' : '#fff';

  const scale = 0.55;
  const originX = 280, originY = 420;
  function tx(x) { return originX + x * scale; }
  function ty(y) { return originY - y * scale; }

  let html = `<rect width="${W}" height="${H}" fill="${isLight ? '#f8f9fa' : '#0f0f1a'}" rx="8"/>`;

  // Grid
  for (let gx = 0; gx < W; gx += 40) html += `<line x1="${gx}" y1="0" x2="${gx}" y2="${H}" stroke="${colGrid}" stroke-width="0.5"/>`;
  for (let gy = 0; gy < H; gy += 40) html += `<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" stroke="${colGrid}" stroke-width="0.5"/>`;

  // BB point
  html += `<circle cx="${tx(0)}" cy="${ty(0)}" r="6" fill="${colAccent}" stroke="${colBBStroke}" stroke-width="1.5"/>`;
  html += `<text x="${tx(0)}" y="${ty(0) + 18}" fill="${colBBLabel}" font-size="10" text-anchor="middle" font-weight="600">BB</text>`;

  // Ground line
  html += `<line x1="40" y1="${ty(0)}" x2="${W - 40}" y2="${ty(0)}" stroke="${colGround}" stroke-width="1" stroke-dasharray="6 4"/>`;

  // Draw each frame
  if (frameA) html += drawFrameOverlay(frameA, colAccent, 'A', tx, ty, colTextSubtle, colDimSubtle, 0);
  if (frameB) html += drawFrameOverlay(frameB, colGreen, 'B', tx, ty, colTextSubtle, colDimSubtle, 1);

  // If no frames selected, show hint
  if (!frameA && !frameB) {
    html += `<text x="${W / 2}" y="${H / 2}" fill="${colTextSubtle}" font-size="14" text-anchor="middle">Select frames above to see the comparison</text>`;
  }

  svg.innerHTML = html;
}

function drawFrameOverlay(frame, color, label, tx, ty, colTextSubtle, colDimSubtle, index) {
  let html = '';
  const staRad = rad(frame.sta);
  const htaRad = rad(frame.hta);

  const bbX = tx(0), bbY = ty(0);

  // Head tube top (stack/reach position)
  const htTopX = tx(frame.reach);
  const htTopY = ty(frame.stack);

  // Head tube bottom (150mm along HTA from top)
  const htLen = 150;
  const htBotX = tx(frame.reach + htLen * Math.cos(htaRad));
  const htBotY = ty(frame.stack - htLen * Math.sin(htaRad));

  // Seat tube — extend upward from BB at STA, find the point at the same height as head tube top
  const seatTopY = frame.stack * 1.05; // extend slightly above head tube top for visual
  const seatTopX = -(seatTopY / Math.tan(staRad));

  // Top tube — from seat tube at head-tube-top height to head tube top
  const ttSeatX = -(frame.stack / Math.tan(staRad));

  // Seat tube line (from BB upward)
  html += `<line x1="${bbX}" y1="${bbY}" x2="${tx(seatTopX)}" y2="${ty(seatTopY)}" stroke="${color}" stroke-width="2.5" opacity="0.85"/>`;

  // Head tube
  html += `<line x1="${htBotX}" y1="${htBotY}" x2="${htTopX}" y2="${htTopY}" stroke="${color}" stroke-width="2.5" opacity="0.85"/>`;

  // Top tube (virtual — seat tube at stack height to head tube top)
  html += `<line x1="${tx(ttSeatX)}" y1="${htTopY}" x2="${htTopX}" y2="${htTopY}" stroke="${color}" stroke-width="2" opacity="0.7"/>`;

  // Down tube (BB to head tube bottom)
  html += `<line x1="${bbX}" y1="${bbY}" x2="${htBotX}" y2="${htBotY}" stroke="${color}" stroke-width="2" opacity="0.7"/>`;

  // Label at head tube top
  const labelOffsetX = index === 0 ? -8 : 8;
  const labelAnchor = index === 0 ? 'end' : 'start';
  html += `<text x="${htTopX + labelOffsetX}" y="${htTopY - 8}" fill="${color}" font-size="11" font-weight="700" text-anchor="${labelAnchor}">${label}</text>`;

  // Stack dimension line (subtle, offset to avoid overlap)
  const dimOffsetX = index === 0 ? -25 : 15;
  const sx = tx(0) + dimOffsetX;
  html += `<line x1="${sx}" y1="${ty(0)}" x2="${sx}" y2="${ty(frame.stack)}" stroke="${color}" stroke-width="1" stroke-dasharray="3 3" opacity="0.5"/>`;
  html += `<text x="${sx - 3}" y="${ty(frame.stack / 2)}" fill="${color}" font-size="9" text-anchor="end" opacity="0.7" transform="rotate(-90,${sx - 3},${ty(frame.stack / 2)})">${frame.stack}mm</text>`;

  // Reach dimension line (subtle, offset to avoid overlap)
  const dimOffsetY = index === 0 ? 15 : 28;
  const ry = ty(frame.stack) - dimOffsetY;
  html += `<line x1="${tx(0)}" y1="${ry}" x2="${tx(frame.reach)}" y2="${ry}" stroke="${color}" stroke-width="1" stroke-dasharray="3 3" opacity="0.5"/>`;
  html += `<text x="${tx(frame.reach / 2)}" y="${ry - 3}" fill="${color}" font-size="9" text-anchor="middle" opacity="0.7">${frame.reach}mm</text>`;

  return html;
}

// ============================================================
// Calculation Engine
// ============================================================

function deg(rad) { return rad * 180 / Math.PI; }
function rad(deg) { return deg * Math.PI / 180; }

function calcSaddlePosition(saddleHeight, sta, saddleSetback) {
  const staRad = rad(sta);
  // Saddle position along seat tube, then setback
  // Seat tube goes up and backward from BB at STA from horizontal
  const saddleX = -(saddleHeight * Math.cos(staRad)) - saddleSetback;
  const saddleY = saddleHeight * Math.sin(staRad);
  return { x: saddleX, y: saddleY };
}

function calcHoodPosition(frameReach, frameStack, hta, spacerStack, stemLength, stemAngle, barReach, stemHeight, barDiameter) {
  stemHeight = stemHeight || 0;
  barDiameter = barDiameter || 0;
  const htaRad = rad(hta);

  // Total steerer travel = spacers + half stem height (measurements from stem centre)
  const totalSteerer = spacerStack + stemHeight / 2;

  // Stem base along steerer from top of head tube
  const stemBaseX = frameReach + totalSteerer * (-Math.cos(htaRad));
  const stemBaseY = frameStack + totalSteerer * Math.sin(htaRad);

  // Stem angle from horizontal
  // stem_angle is relative to steerer perpendicular (0 = perpendicular to steerer)
  // Effective angle from horizontal = (90 - HTA) + stemAngle
  const stemAngleHoriz = rad(90 - hta + stemAngle);

  const stemEndX = stemBaseX + stemLength * Math.cos(stemAngleHoriz);
  const stemEndY = stemBaseY + stemLength * Math.sin(stemAngleHoriz);

  // Handlebar reach is horizontal forward from stem clamp
  // Handlebar radius (half diameter) adds to the hood height (hoods sit on top of the bar)
  const hoodX = stemEndX + barReach;
  const hoodY = stemEndY + barDiameter / 2;

  return {
    stemBase: { x: stemBaseX, y: stemBaseY },
    stemEnd: { x: stemEndX, y: stemEndY },
    hood: { x: hoodX, y: hoodY }
  };
}

function forwardCalc(params) {
  const saddle = calcSaddlePosition(params.saddleHeight, params.sta, params.saddleSetback);
  const hood = calcHoodPosition(
    params.reach, params.stack, params.hta,
    params.spacerStack, params.stemLength, params.stemAngle, params.barReach,
    params.stemHeight, params.barDiameter
  );

  const saddleToHoodReach = hood.hood.x - saddle.x;
  const saddleToHoodDrop = saddle.y - hood.hood.y; // positive = hoods lower than saddle
  const saddleToHoodDist = Math.sqrt(saddleToHoodReach ** 2 + saddleToHoodDrop ** 2);

  // Handlebar position: same Y as hood (bar radius above center) but no barReach
  const handlebar = { x: hood.stemEnd.x, y: hood.stemEnd.y + (params.barDiameter || 0) / 2 };

  // Active measurement point based on toggle
  const mp = measureTarget === 'bars' ? handlebar : hood.hood;
  const saddleToMeasureReach = mp.x - saddle.x;
  const saddleToMeasureDrop = saddle.y - mp.y;
  const saddleToMeasureDist = Math.sqrt(saddleToMeasureReach ** 2 + saddleToMeasureDrop ** 2);
  const measureHeight = mp.y;
  const measureReachFromBB = mp.x;

  // Effective saddle height (vertical from BB)
  const saddleVertical = saddle.y;

  // Hood height above BB
  const hoodHeight = hood.hood.y;

  // Hood reach from BB (horizontal distance from BB to hoods)
  const hoodReachFromBB = hood.hood.x;

  // Saddle to bar reach (horizontal distance from saddle to stem/bar junction)
  const saddleToBarReach = hood.stemEnd.x - saddle.x;

  // Effective seat tube angle (actual angle from BB to saddle, accounting for setback)
  const effectiveSTA = deg(Math.atan2(saddle.y, -saddle.x));

  // Saddle to BB horizontal setback (how far the saddle is behind the BB)
  const saddleBBSetback = -saddle.x;

  return {
    saddle,
    hood: hood.hood,
    handlebar,
    measurePoint: mp,
    stemBase: hood.stemBase,
    stemEnd: hood.stemEnd,
    saddleToHoodReach,
    saddleToHoodDrop,
    saddleToHoodDist,
    saddleToMeasureReach,
    saddleToMeasureDrop,
    saddleToMeasureDist,
    measureHeight,
    measureReachFromBB,
    saddleVertical,
    hoodHeight,
    hoodReachFromBB,
    saddleToBarReach,
    effectiveSTA,
    saddleBBSetback
  };
}

function reverseSolve(params) {
  // Solve for unknown components given fit targets
  const saddle = calcSaddlePosition(params.saddleHeight, params.sta, params.saddleSetback);

  // Target hood position
  const targetHoodX = saddle.x + params.targetReach;
  const targetHoodY = saddle.y - params.targetDrop;

  const htaRad = rad(params.hta);
  const stemHeight = params.stemHeight || 0;
  const barDiameter = params.barDiameter || 0;

  // The hood position includes bar radius (half diameter) vertically above the stem end,
  // and the steerer travel is spacerStack + stemHeight/2 (centre of stem clamp).
  // So we solve for T = spacerStack + stemHeight/2 (total steerer travel),
  // then spacerStack = T - stemHeight/2.
  // The stem end Y needs to be: targetHoodY - barDiameter/2
  // Effective target for stem end:
  const effTargetHoodY = targetHoodY - barDiameter / 2;

  if (params.fixVar === 'stem-angle') {
    // Known: stem angle, solve for total steerer (T) and stem length (L)
    const stemAngleHoriz = rad(90 - params.hta + params.fixStemAngle);
    const cosA = Math.cos(stemAngleHoriz);
    const sinA = Math.sin(stemAngleHoriz);

    // targetHoodX = reach + T*(-cos(HTA)) + L*cos(θ) + barReach
    // effTargetHoodY = stack + T*sin(HTA) + L*sin(θ)
    const rhs1 = targetHoodX - params.reach - params.barReach;
    const rhs2 = effTargetHoodY - params.stack;

    const det = cosA * Math.sin(htaRad) - sinA * (-Math.cos(htaRad));
    if (Math.abs(det) < 0.001) {
      return { error: 'No solution (degenerate angle combination)' };
    }

    const stemLength = (rhs1 * Math.sin(htaRad) - rhs2 * (-Math.cos(htaRad))) / det;
    const T = (cosA * rhs2 - sinA * rhs1) / det;
    const spacerStack = T - stemHeight / 2;

    return {
      stemLength: Math.round(stemLength * 10) / 10,
      spacerStack: Math.round(spacerStack * 10) / 10,
      stemAngle: params.fixStemAngle,
      saddle, targetHoodX, targetHoodY
    };

  } else if (params.fixVar === 'spacers') {
    // Known: spacers, solve for stem length (L) and stem angle (θ)
    const S = params.fixSpacers;
    const T = S + stemHeight / 2;
    const baseX = params.reach + T * (-Math.cos(htaRad));
    const baseY = params.stack + T * Math.sin(htaRad);

    const dx = targetHoodX - baseX - params.barReach;
    const dy = effTargetHoodY - baseY;

    const stemLength = Math.sqrt(dx * dx + dy * dy);
    const stemAngleHoriz = Math.atan2(dy, dx);
    const stemAngle = deg(stemAngleHoriz) - (90 - params.hta);

    return {
      stemLength: Math.round(stemLength * 10) / 10,
      spacerStack: S,
      stemAngle: Math.round(stemAngle * 10) / 10,
      saddle, targetHoodX, targetHoodY
    };

  } else if (params.fixVar === 'stem-length') {
    // Known: stem length, solve for total steerer (T) and stem angle
    const L = params.fixStemLength;
    const A = targetHoodX - params.reach - params.barReach;
    const B = effTargetHoodY - params.stack;
    const cx = -Math.cos(htaRad);
    const cy = Math.sin(htaRad);

    // (A - T*cx)^2 + (B - T*cy)^2 = L^2
    const a = 1;
    const b = -2 * (A * cx + B * cy);
    const c = A * A + B * B - L * L;

    const disc = b * b - 4 * a * c;
    if (disc < 0) {
      return { error: 'No solution (stem too short to reach target)' };
    }

    const t1 = (-b + Math.sqrt(disc)) / (2 * a);
    const t2 = (-b - Math.sqrt(disc)) / (2 * a);

    // Convert T to spacerStack = T - stemHeight/2, pick valid (spacerStack >= 0)
    const sp1 = t1 - stemHeight / 2;
    const sp2 = t2 - stemHeight / 2;

    let T, spacerStack;
    if (sp1 >= 0 && sp2 >= 0) { spacerStack = Math.min(sp1, sp2); T = spacerStack + stemHeight / 2; }
    else if (sp1 >= 0) { spacerStack = sp1; T = t1; }
    else if (sp2 >= 0) { spacerStack = sp2; T = t2; }
    else return { error: 'No valid solution (negative spacers required)' };

    const baseX = params.reach + T * cx;
    const baseY = params.stack + T * cy;
    const dx = targetHoodX - baseX - params.barReach;
    const dy = effTargetHoodY - baseY;
    const stemAngleHoriz = Math.atan2(dy, dx);
    const stemAngle = deg(stemAngleHoriz) - (90 - params.hta);

    return {
      stemLength: L,
      spacerStack: Math.round(spacerStack * 10) / 10,
      stemAngle: Math.round(stemAngle * 10) / 10,
      saddle, targetHoodX, targetHoodY
    };
  }
}


// ============================================================
// SVG Diagram Renderer
// ============================================================

function drawBikeDiagram(params, results) {
  const svg = document.getElementById('bike-svg');
  const W = 800, H = 500;

  // Read current theme colors from CSS variables
  const cs = getComputedStyle(document.documentElement);
  const colGrid = cs.getPropertyValue('--svg-grid').trim();
  const colFrame = cs.getPropertyValue('--svg-frame').trim();
  const colDimSubtle = cs.getPropertyValue('--svg-dim-subtle').trim();
  const colTextSubtle = cs.getPropertyValue('--svg-text-subtle').trim();
  const colGround = cs.getPropertyValue('--svg-ground').trim();
  const colBBLabel = cs.getPropertyValue('--svg-bb-label').trim();
  const colAccent = cs.getPropertyValue('--accent').trim();
  const colGreen = cs.getPropertyValue('--green').trim();
  const colYellow = '#f0c040';
  const isLight = document.documentElement.classList.contains('light');
  const colBBStroke = isLight ? '#333' : '#fff';
  const colSaddleStroke = isLight ? '#333' : '#fff';
  const colHoodStroke = isLight ? '#333' : '#fff';

  // Transform: bike coords (origin BB, Y up) → SVG (origin top-left, Y down)
  const scale = 0.55;
  const originX = 280;
  const originY = 420;

  function tx(x) { return originX + x * scale; }
  function ty(y) { return originY - y * scale; }

  let html = '';

  // Background grid (subtle)
  for (let gx = 0; gx < W; gx += 40) {
    html += `<line x1="${gx}" y1="0" x2="${gx}" y2="${H}" stroke="${colGrid}" stroke-width="0.5"/>`;
  }
  for (let gy = 0; gy < H; gy += 40) {
    html += `<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" stroke="${colGrid}" stroke-width="0.5"/>`;
  }

  // BB point
  const bbX = tx(0), bbY = ty(0);
  html += `<circle cx="${bbX}" cy="${bbY}" r="6" fill="${colAccent}" stroke="${colBBStroke}" stroke-width="1.5"/>`;
  html += `<text x="${bbX}" y="${bbY + 18}" fill="${colBBLabel}" font-size="10" text-anchor="middle">BB</text>`;

  // Ground line
  html += `<line x1="20" y1="${ty(0)}" x2="${W - 20}" y2="${ty(0)}" stroke="${colGround}" stroke-width="1" stroke-dasharray="4,4"/>`;

  // Seat tube line (from BB upward at STA)
  const staRad = rad(params.sta);
  const seatTubeLen = params.saddleHeight || 740;
  const stTopX = tx(-(seatTubeLen * Math.cos(staRad)));
  const stTopY = ty(seatTubeLen * Math.sin(staRad));
  html += `<line x1="${bbX}" y1="${bbY}" x2="${stTopX}" y2="${stTopY}" stroke="${colFrame}" stroke-width="2.5"/>`;

  // Saddle
  const saddle = results.saddle;
  const saddleX = tx(saddle.x), saddleY = ty(saddle.y);
  html += `<rect x="${saddleX - 20}" y="${saddleY - 3}" width="40" height="6" rx="3" fill="${colAccent}" stroke="${colSaddleStroke}" stroke-width="1"/>`;
  html += `<text x="${saddleX}" y="${saddleY - 10}" fill="${colAccent}" font-size="10" text-anchor="middle" font-weight="600">Saddle</text>`;

  // Head tube
  const htaRad = rad(params.hta);
  const htTopX = tx(params.reach);
  const htTopY = ty(params.stack);
  const htLen = 150;
  const htBotX = tx(params.reach + htLen * Math.cos(htaRad));
  const htBotY = ty(params.stack - htLen * Math.sin(htaRad));
  html += `<line x1="${htBotX}" y1="${htBotY}" x2="${htTopX}" y2="${htTopY}" stroke="${colFrame}" stroke-width="2.5"/>`;

  // Top tube
  const virtualSeatTopX = tx(-(params.stack / Math.tan(staRad)));
  const virtualSeatTopY = ty(params.stack * 0.95);
  html += `<line x1="${virtualSeatTopX}" y1="${virtualSeatTopY}" x2="${htTopX}" y2="${htTopY}" stroke="${colFrame}" stroke-width="2"/>`;

  // Down tube (BB to near head tube bottom)
  html += `<line x1="${bbX}" y1="${bbY}" x2="${htBotX}" y2="${htBotY}" stroke="${colFrame}" stroke-width="2"/>`;

  // Spacers on steerer (from head tube top upward)
  if (results.stemBase) {
    const stemBaseX = tx(results.stemBase.x);
    const stemBaseY = ty(results.stemBase.y);
    html += `<line x1="${htTopX}" y1="${htTopY}" x2="${stemBaseX}" y2="${stemBaseY}" stroke="${colGreen}" stroke-width="4" stroke-linecap="round"/>`;
  }

  // Stem
  if (results.stemBase && results.stemEnd) {
    const sbx = tx(results.stemBase.x), sby = ty(results.stemBase.y);
    const sex = tx(results.stemEnd.x), sey = ty(results.stemEnd.y);
    html += `<line x1="${sbx}" y1="${sby}" x2="${sex}" y2="${sey}" stroke="${colYellow}" stroke-width="3" stroke-linecap="round"/>`;
    html += `<text x="${(sbx + sex) / 2}" y="${(sby + sey) / 2 - 8}" fill="${colYellow}" font-size="10" text-anchor="middle" font-weight="600">Stem</text>`;
  }

  // Handlebar (stem end to hood) — drawn flat at stem end height for clarity
  if (results.stemEnd && results.hood) {
    const sex = tx(results.stemEnd.x), sey = ty(results.stemEnd.y);
    const hx = tx(results.hood.x);
    html += `<line x1="${sex}" y1="${sey}" x2="${hx}" y2="${sey}" stroke="${colGreen}" stroke-width="2.5" stroke-linecap="round"/>`;

    // Green dot: hoods position when measuring to hoods, stem/bar junction when measuring to handlebars
    // Dot is drawn flat at stem end height to match the bar line
    const isHoods = measureTarget === 'hoods';
    const dotX = isHoods ? hx : sex;
    const dotY = sey;
    const mpLabel = isHoods ? 'Hoods' : 'Bars';
    html += `<circle cx="${dotX}" cy="${dotY}" r="5" fill="${colGreen}" stroke="${colHoodStroke}" stroke-width="1"/>`;
    html += `<text x="${dotX + 8}" y="${dotY - 8}" fill="${colGreen}" font-size="10" font-weight="600">${mpLabel}</text>`;
  }

  // Dimension: Saddle to measurement point Reach (horizontal)
  if (results.measurePoint && saddle) {
    const mpx = tx(results.measurePoint.x), mpy = ty(results.measurePoint.y);
    const dimY = Math.max(saddleY, mpy) + 40;
    html += `<line x1="${saddleX}" y1="${dimY - 5}" x2="${saddleX}" y2="${dimY + 5}" stroke="${colAccent}" stroke-width="1"/>`;
    html += `<line x1="${mpx}" y1="${dimY - 5}" x2="${mpx}" y2="${dimY + 5}" stroke="${colAccent}" stroke-width="1"/>`;
    html += `<line x1="${saddleX}" y1="${dimY}" x2="${mpx}" y2="${dimY}" stroke="${colAccent}" stroke-width="1" stroke-dasharray="3,3"/>`;
    const reachLabel = Math.round(results.saddleToMeasureReach) + 'mm reach';
    html += `<text x="${(saddleX + mpx) / 2}" y="${dimY + 14}" fill="${colAccent}" font-size="10" text-anchor="middle" font-weight="600">${reachLabel}</text>`;
  }

  // Dimension: Saddle to measurement point Drop (vertical)
  if (results.measurePoint && saddle) {
    const mpx = tx(results.measurePoint.x), mpy = ty(results.measurePoint.y);
    const dimX = Math.min(saddleX, mpx) - 30;
    html += `<line x1="${dimX - 5}" y1="${saddleY}" x2="${dimX + 5}" y2="${saddleY}" stroke="${colGreen}" stroke-width="1"/>`;
    html += `<line x1="${dimX - 5}" y1="${mpy}" x2="${dimX + 5}" y2="${mpy}" stroke="${colGreen}" stroke-width="1"/>`;
    html += `<line x1="${dimX}" y1="${saddleY}" x2="${dimX}" y2="${mpy}" stroke="${colGreen}" stroke-width="1" stroke-dasharray="3,3"/>`;
    const dropLabel = Math.round(results.saddleToMeasureDrop) + 'mm drop';
    html += `<text x="${dimX - 5}" y="${(saddleY + mpy) / 2}" fill="${colGreen}" font-size="10" text-anchor="end" font-weight="600">${dropLabel}</text>`;
  }

  // Stack and Reach dimension lines (subtle)
  const stackTopX = tx(0), stackTopY = ty(params.stack);
  const reachEndX = tx(params.reach), reachEndY = ty(0);
  html += `<line x1="${bbX}" y1="${bbY - 2}" x2="${reachEndX}" y2="${bbY - 2}" stroke="${colDimSubtle}" stroke-width="0.8" stroke-dasharray="2,3"/>`;
  html += `<text x="${(bbX + reachEndX) / 2}" y="${bbY + 30}" fill="${colTextSubtle}" font-size="9" text-anchor="middle">Reach ${params.reach}mm</text>`;
  html += `<line x1="${reachEndX + 2}" y1="${bbY}" x2="${reachEndX + 2}" y2="${htTopY}" stroke="${colDimSubtle}" stroke-width="0.8" stroke-dasharray="2,3"/>`;
  html += `<text x="${reachEndX + 12}" y="${(bbY + htTopY) / 2}" fill="${colTextSubtle}" font-size="9" font-weight="400">Stack ${params.stack}mm</text>`;

  svg.innerHTML = html;
}


// ============================================================
// UI Controller
// ============================================================

let currentMode = 'forward';
let measureTarget = 'hoods'; // 'hoods' or 'bars'

function setMeasureTarget(target) {
  measureTarget = target;
  document.querySelectorAll('.measure-toggle button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.target === target);
  });
  updateTargetLabels();
  if (currentMode === 'compare') renderCompareView();
  else recalculate();
}

function updateTargetLabels() {
  const reachLabel = document.getElementById('label-target-reach');
  const dropLabel = document.getElementById('label-target-drop');
  if (measureTarget === 'bars') {
    reachLabel.textContent = 'Target Saddle-to-Handlebar Reach';
    dropLabel.textContent = 'Target Saddle-to-Handlebar Drop';
  } else {
    reachLabel.textContent = 'Target Saddle-to-Hood Reach';
    dropLabel.textContent = 'Target Saddle-to-Hood Drop';
  }
}

function setMode(mode) {
  currentMode = mode;
  const isCompare = mode === 'compare';

  document.getElementById('mode-forward').classList.toggle('active', mode === 'forward');
  document.getElementById('mode-reverse').classList.toggle('active', mode === 'reverse');

  // Hide/show calculator vs compare views
  document.querySelectorAll('.calculator-view').forEach(el => el.classList.toggle('hidden', isCompare));
  document.getElementById('compare-view').classList.toggle('hidden', !isCompare);

  if (isCompare) {
    renderCompareView();
  } else {
    document.getElementById('card-components').classList.toggle('hidden', mode === 'reverse');
    document.getElementById('card-targets').classList.toggle('hidden', mode === 'forward');
    document.getElementById('card-results').classList.toggle('hidden', mode === 'reverse');
    updateConstraintVisibility();
    recalculate();
  }
}

function updateConstraintVisibility() {
  const fixVar = document.getElementById('constraint-var').value;
  document.getElementById('fix-stem-angle-group').classList.toggle('hidden', fixVar !== 'stem-angle');
  document.getElementById('fix-spacers-group').classList.toggle('hidden', fixVar !== 'spacers');
  document.getElementById('fix-stem-length-group').classList.toggle('hidden', fixVar !== 'stem-length');
}

function getVal(id) {
  return parseFloat(document.getElementById(id).value) || 0;
}

function recalculate() {
  const frameParams = {
    stack: getVal('stack'),
    reach: getVal('reach'),
    sta: getVal('sta'),
    hta: getVal('hta')
  };

  if (currentMode === 'forward') {
    const params = {
      ...frameParams,
      stemLength: getVal('stem-length'),
      stemAngle: getVal('stem-angle'),
      spacerStack: getVal('spacer-stack'),
      stemHeight: getVal('stem-height'),
      barReach: getVal('bar-reach'),
      barDiameter: getVal('bar-diameter'),
      saddleHeight: getVal('saddle-height'),
      saddleSetback: getVal('saddle-setback')
    };

    const results = forwardCalc(params);
    renderForwardResults(results);
    const bbDisplay = document.getElementById('bb-setback-display');
    if (bbDisplay) {
      const tip = bbDisplay.querySelector('.tip-text');
      const tipHtml = tip ? tip.outerHTML : '';
      bbDisplay.innerHTML = '↳ ' + (Math.round(results.saddleBBSetback * 10) / 10) + 'mm behind BB ⓘ' + tipHtml;
    }
    drawBikeDiagram(params, results);

  } else {
    const fixVar = document.getElementById('constraint-var').value;
    const params = {
      ...frameParams,
      saddleHeight: getVal('target-saddle-height'),
      saddleSetback: getVal('target-saddle-setback'),
      barReach: measureTarget === 'bars' ? 0 : getVal('target-bar-reach'),
      stemHeight: getVal('target-stem-height'),
      barDiameter: getVal('target-bar-diameter'),
      targetReach: getVal('target-reach'),
      targetDrop: getVal('target-drop'),
      fixVar
    };

    if (fixVar === 'stem-angle') params.fixStemAngle = getVal('fix-stem-angle');
    else if (fixVar === 'spacers') params.fixSpacers = getVal('fix-spacers');
    else if (fixVar === 'stem-length') params.fixStemLength = getVal('fix-stem-length');

    const result = reverseSolve(params);
    renderReverseResults(result);

    // Also draw the diagram with the solved values
    if (!result.error) {
      const fwdParams = {
        ...frameParams,
        stemLength: result.stemLength,
        stemAngle: result.stemAngle,
        spacerStack: result.spacerStack,
        stemHeight: params.stemHeight,
        barReach: getVal('target-bar-reach'), // always real barReach for forward calc
        barDiameter: params.barDiameter,
        saddleHeight: params.saddleHeight,
        saddleSetback: params.saddleSetback
      };
      const fwdResults = forwardCalc(fwdParams);
      drawBikeDiagram(fwdParams, fwdResults);
      const bbDisplayRev = document.getElementById('bb-setback-display-reverse');
      if (bbDisplayRev) {
        const tip = bbDisplayRev.querySelector('.tip-text');
        const tipHtml = tip ? tip.outerHTML : '';
        bbDisplayRev.innerHTML = '↳ ' + (Math.round(fwdResults.saddleBBSetback * 10) / 10) + 'mm behind BB ⓘ' + tipHtml;
      }
    }
  }
}

function renderForwardResults(r) {
  const container = document.getElementById('forward-results');
  const isHoods = measureTarget === 'hoods';
  const ptName = isHoods ? 'Hood' : 'Handlebar';
  const ptDesc = isHoods ? 'brake hoods' : 'handlebar (top of bar at stem clamp)';

  const items = [
    { label: `Saddle \u2192 ${ptName} Reach`, value: r.saddleToMeasureReach, unit: 'mm', highlight: true, tooltip: `Horizontal distance from the saddle BRP to the ${ptDesc}. The primary measurement for how stretched out your position is.` },
    { label: `Saddle \u2192 ${ptName} Drop`, value: r.saddleToMeasureDrop, unit: 'mm', highlight: true, tooltip: `Vertical drop from the saddle BRP to the ${ptDesc}. Positive means ${isHoods ? 'hoods are' : 'bars are'} lower than saddle. More drop = more aggressive.` },
  ];

  items.push(
    { label: 'Effective Seat Tube Angle', value: r.effectiveSTA, unit: '\u00B0', tooltip: 'Actual angle from the BB centre to the saddle BRP, accounting for any saddle setback. May differ from the frame seat tube angle.' },
    { label: 'Saddle Height (vertical)', value: r.saddleVertical, unit: 'mm', tooltip: 'True vertical height of the saddle BRP above the bottom bracket centre. Slightly less than the along-tube saddle height measurement.' },
    { label: `${ptName} Height above BB`, value: r.measureHeight, unit: 'mm', tooltip: `Vertical height of the ${ptDesc} above the bottom bracket centre. Determined by frame stack, spacers, stem, and bar.` },
    { label: `${ptName} Reach from BB`, value: r.measureReachFromBB, unit: 'mm', tooltip: `Horizontal distance from the BB centre to the ${ptDesc}. Shows how far forward the ${isHoods ? 'hoods are' : 'bars are'} from the BB.` }
  );

  container.innerHTML = items.map(item => {
    const val = Math.round(item.value * 10) / 10;
    const cls = item.highlight ? ' highlight' : '';
    const tip = item.tooltip ? ` <span class="label-tip">&#9432;<span class="tip-text">${item.tooltip}</span></span>` : '';
    return `
      <div class="result-item${cls}">
        <div class="result-label">${item.label}${tip}</div>
        <div class="result-value">${val}</div>
        <div class="result-unit">${item.unit}</div>
      </div>
    `;
  }).join('');

  // Spacer stack warning in forward mode
  const spacerStack = getVal('spacer-stack');
  const fwdNote = document.getElementById('forward-note');
  if (spacerStack > 40) {
    fwdNote.textContent = 'Spacer stack is very high (' + spacerStack + 'mm). Consider a larger frame with more stack to reduce the need for spacers.';
  } else {
    fwdNote.textContent = '';
  }
}

function renderReverseResults(result) {
  const container = document.getElementById('reverse-results');
  const note = document.getElementById('reverse-note');

  if (result.error) {
    container.innerHTML = `<div class="reverse-result rr-bad" style="grid-column:1/-1;"><div class="rr-label">Error</div><div class="rr-value" style="font-size:1rem;">${result.error}</div></div>`;
    note.textContent = '';
    return;
  }

  const items = [];

  const fixVar = document.getElementById('constraint-var').value;

  if (fixVar === 'stem-angle') {
    items.push({ label: 'Required Stem Length', value: result.stemLength, unit: 'mm', warn: result.stemLength < 60 || result.stemLength > 140 });
    items.push({ label: 'Required Spacer Stack', value: result.spacerStack, unit: 'mm', warn: result.spacerStack < 0 || result.spacerStack > 40 });
    items.push({ label: 'Stem Angle (fixed)', value: result.stemAngle, unit: '°' });
  } else if (fixVar === 'spacers') {
    items.push({ label: 'Required Stem Length', value: result.stemLength, unit: 'mm', warn: result.stemLength < 60 || result.stemLength > 140 });
    items.push({ label: 'Required Stem Angle', value: result.stemAngle, unit: '°', warn: result.stemAngle < -17 || result.stemAngle > 10 });
    items.push({ label: 'Spacer Stack (fixed)', value: result.spacerStack, unit: 'mm' });
  } else {
    items.push({ label: 'Required Spacer Stack', value: result.spacerStack, unit: 'mm', warn: result.spacerStack < 0 || result.spacerStack > 40 });
    items.push({ label: 'Required Stem Angle', value: result.stemAngle, unit: '°', warn: result.stemAngle < -17 || result.stemAngle > 10 });
    items.push({ label: 'Stem Length (fixed)', value: result.stemLength, unit: 'mm' });
  }

  container.innerHTML = items.map(item => {
    const val = Math.round(item.value * 10) / 10;
    const cls = item.warn ? ' rr-warn' : '';
    return `
      <div class="reverse-result${cls}">
        <div class="rr-label">${item.label}</div>
        <div class="rr-value">${val}<span class="rr-unit">${item.unit}</span></div>
      </div>
    `;
  }).join('');

  // Warnings
  const warnings = [];
  if (result.stemLength < 60) warnings.push('Stem length is very short — may not be available.');
  if (result.stemLength > 140) warnings.push('Stem length is very long — may not be available or may handle poorly.');
  if (result.spacerStack < 0) warnings.push('Negative spacers required — this frame may not achieve your target position. Consider a frame with different stack/reach.');
  if (result.spacerStack > 40) warnings.push('Spacer stack is very high — consider a larger frame with more stack to reduce the need for spacers.');
  if (result.stemAngle < -17) warnings.push('Stem angle is extreme — may not be commercially available.');
  if (result.stemAngle > 10) warnings.push('Positive stem angle is unusual for road bikes — double check targets.');

  note.textContent = warnings.join(' ');
}

// Wire up all inputs to recalculate on change
document.querySelectorAll('input[type="number"]').forEach(input => {
  input.addEventListener('input', recalculate);
});

document.getElementById('constraint-var').addEventListener('change', () => {
  updateConstraintVisibility();
  recalculate();
});

// Initial calculation
recalculate();