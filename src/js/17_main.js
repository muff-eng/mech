// =====================================================================
// 17 | MAIN | boot and frame loop
// =====================================================================
function boot() {
  S = loadSave() || newState();
  save(true);
  sharedMats();
  const ok = initRenderer();
  UI.init();
  if (!ok) {
    document.body.insertAdjacentHTML('beforeend', '<div style="position:fixed;inset:auto 0 0 0;padding:10px;background:#3a1512;color:#fff;z-index:99;text-align:center;font-size:13px">WebGL is not available in this browser | Menus work, but 3D views and battles need WebGL</div>');
  } else VIEW.initHangar();
  UI.show('title');
  const unlock = () => { AUDIO.init(); AUDIO.resume(); };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('beforeunload', () => save(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });
  let last = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    try {
      VIEW.render(dt);
      battleFlowTick(dt);
    } catch (err) {
      console.error(err);
      if (!frame.reported) { frame.reported = true; UI.toast('Render error | ' + esc(err.message), 'red', 6000); }
    }
  };
  requestAnimationFrame(frame);
  window.MF = { get S() { return S; }, UI, VIEW, PARTS, ENEMY_DESIGNS, computeStats, simulateBattle, startBattle, Arena, get CURRENT() { return CURRENT; } };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
