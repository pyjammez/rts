(function registerTreeWindAnimator(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};

  function updateCrowns(crowns = [], timeSeconds = 0) {
    for (const crown of crowns) {
      if (!crown || !crown.rotation || !crown.userData) continue;
      const phase = crown.userData.windPhase || 0;
      const strength = crown.userData.windStrength || 0;
      const baseZ = crown.userData.baseRotationZ || 0;
      const baseX = crown.userData.baseRotationX || 0;
      crown.rotation.z = baseZ + Math.sin(timeSeconds * 0.72 + phase) * strength;
      crown.rotation.x = baseX + Math.cos(timeSeconds * 0.53 + phase * 1.3) * strength * 0.55;
    }
  }

  app.rendering.treeWind = Object.freeze({
    updateCrowns
  });
})(globalThis);
