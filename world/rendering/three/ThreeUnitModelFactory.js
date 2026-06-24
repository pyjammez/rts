(function registerThreeUnitModelFactory(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};

  function createFactory(deps) {
    const {
      THREE,
      geometry,
      addBox,
      addCylinder,
      addSphere,
      materials,
      attachments,
      worldToScene,
      getWorldElevation,
      getTeamMaterial,
      addSelectionRing,
      entityElevation,
      rampartHeight,
      clamp,
      smoothStep
    } = deps;

    function getWorkerGatherAnimation(unit) {
      const job = unit.workerJob;
      const animation = unit.workerGatherAnimation;
      if (!job || job.type !== 'gather' || !animation) return null;
      if (job.resourceType !== 'gold' && job.resourceType !== 'stone' && job.resourceType !== 'wood') return null;
      const phase = Math.max(0, Math.min(1, Number(animation.progress) || 0));
      const cycle = Math.sin((phase * Math.PI * 8) % (Math.PI * 2));
      return { resourceType: job.resourceType, cycle, impact: cycle > 0.72 };
    }

    function addWorkerGatherTool(group, unit, riderY = 0) {
      const animation = getWorkerGatherAnimation(unit);
      if (!animation) return;
      const isWood = animation.resourceType === 'wood';
      const swing = isWood ? -0.95 + animation.cycle * 0.85 : -1.18 + animation.cycle * 0.95;
      const pivot = new THREE.Group();
      pivot.position.set(0.24, 0.54 + riderY, 0);
      pivot.rotation.z = swing;
      group.add(pivot);
      addBox(pivot, 0.22, 0, 0, 0.42, 0.045, 0.045, materials.wood);
      if (isWood) {
        const head = addBox(pivot, 0.46, 0, 0, 0.16, 0.22, 0.05, materials.steel);
        head.rotation.z = -0.18;
      } else {
        addBox(pivot, 0.46, 0, 0, 0.24, 0.045, 0.055, materials.steel);
        const pick = addBox(pivot, 0.46, 0.075, 0, 0.055, 0.16, 0.045, materials.steel);
        pick.rotation.z = Math.PI * 0.5;
      }
      if (animation.impact) {
        const chipMaterial = isWood ? materials.wood : materials.gold;
        for (let i = 0; i < 3; i++) {
          const chip = addBox(group, 0.48 + i * 0.045, 0.22 + i * 0.035, (i - 1) * 0.06, 0.045, 0.035, 0.035, chipMaterial);
          chip.rotation.set(i * 0.6, 0.3, -0.4);
        }
      }
    }

    function getCastleElevation(unit) {
      if (!unit.castleTopBuildingId) return 0;
      if (unit.castleRampClimbed || unit.castleTopReached) return rampartHeight + 0.1;
      if (!unit.castleRampBase || !unit.castleRampTop) return 0;
      const rampX = unit.castleRampTop.x - unit.castleRampBase.x;
      const rampY = unit.castleRampTop.y - unit.castleRampBase.y;
      const rampLengthSquared = rampX * rampX + rampY * rampY;
      if (rampLengthSquared <= 0) return 0;
      const progress = clamp(
        ((unit.x - unit.castleRampBase.x) * rampX + (unit.y - unit.castleRampBase.y) * rampY) / rampLengthSquared,
        0,
        1
      );
      return smoothStep(0.04, 0.96, progress) * (rampartHeight + 0.1);
    }

    function create(unit) {
      const group = new THREE.Group();
      const position = worldToScene(unit.x, unit.y);
      const terrainElevation = typeof getWorldElevation === 'function' ? getWorldElevation(unit.x, unit.y) : 0;
      const elevation = entityElevation.unitElevation({
        unit,
        terrainElevation,
        castleElevation: getCastleElevation(unit)
      });
      group.position.set(position.x, elevation, position.z);
      group.rotation.y = -(Number.isFinite(unit.heading) ? unit.heading : 0);
      if (unit.isDead) {
        addBox(group, 0, 0.04, 0, 0.55, 0.06, 0.12, materials.bone);
        addSphere(group, 0.33, 0.1, 0, 0.13, materials.bone);
        return group;
      }
      if (unit.selected) addSelectionRing(group, 0.46);

      const teamMaterial = getTeamMaterial(unit.team);
      const type = unit.unitType || 'soldier';
      const stride = unit.hasActivePath?.() ? Math.sin((unit.spriteFrame || 0) * Math.PI * 0.5) * 0.07 : 0;
      if (type === 'balloon' || unit.movementType === 'air') {
        addSphere(group, 0, 0.72, 0, 0.42, teamMaterial, { x: 0.88, y: 1.05, z: 0.88 });
        addBox(group, 0, 0.18, 0, 0.36, 0.18, 0.32, materials.wood);
        addBox(group, -0.18, 0.36, -0.14, 0.035, 0.48, 0.035, materials.rope || materials.wood);
        addBox(group, 0.18, 0.36, -0.14, 0.035, 0.48, 0.035, materials.rope || materials.wood);
        addBox(group, -0.18, 0.36, 0.14, 0.035, 0.48, 0.035, materials.rope || materials.wood);
        addBox(group, 0.18, 0.36, 0.14, 0.035, 0.48, 0.035, materials.rope || materials.wood);
        addBox(group, 0.18, 0.25, 0, 0.05, 0.38, 0.04, materials.steel);
        return group;
      }

      const mountedSheep = unit.mountType === 'sheep';
      const mountedHorse = type === 'scout' && !mountedSheep;
      let riderY = 0;
      if (mountedSheep) {
        addSphere(group, 0, 0.34, 0, 0.38, materials.sheep, { x: 0.52, y: 0.3, z: 0.3 });
        addSphere(group, 0.42, 0.4, 0, 0.16, materials.sheepFace);
        riderY = 0.42;
      } else if (mountedHorse) {
        addSphere(group, 0, 0.38, 0, 0.42, materials.horse, { x: 0.62, y: 0.32, z: 0.31 });
        addSphere(group, 0.48, 0.55, 0, 0.18, materials.horse, { x: 0.23, y: 0.31, z: 0.2 });
        for (const [legX, legZ, legStep] of [[-0.27, -0.14, stride], [-0.27, 0.14, -stride], [0.27, -0.14, -stride], [0.27, 0.14, stride]]) {
          addBox(group, legX, 0.03, legZ + legStep, 0.065, 0.34, 0.065, materials.leather);
          addBox(group, legX + 0.035, 0.015, legZ + legStep, 0.12, 0.045, 0.08, materials.iron);
        }
        riderY = 0.5;
      }

      addBox(group, -0.09, 0.04 + riderY, -stride, 0.09, 0.28, 0.09, materials.leather);
      addBox(group, 0.09, 0.04 + riderY, stride, 0.09, 0.28, 0.09, materials.leather);
      addCylinder(group, 0, 0.28 + riderY, 0, type === 'knight' ? 0.22 : 0.18, type === 'knight' ? 0.24 : 0.2, type === 'knight' ? 0.62 : 0.52, teamMaterial, 12);
      addSphere(group, 0, 0.93 + riderY, 0, 0.14, materials.skin);
      if (type === 'king') {
        addCylinder(group, 0, 1.02 + riderY, 0, 0.17, 0.17, 0.11, materials.gold, 12);
        for (let i = 0; i < 5; i++) {
          const angle = i / 5 * Math.PI * 2;
          const point = new THREE.Mesh(
            geometry('unit:king-crown-point', () => new THREE.ConeGeometry(0.055, 0.2, 6)),
            materials.gold
          );
          point.position.set(Math.cos(angle) * 0.13, 1.19 + riderY, Math.sin(angle) * 0.13);
          point.castShadow = true;
          group.add(point);
        }
      }
      if (type === 'knight') {
        addCylinder(group, 0, 0.89 + riderY, 0, 0.15, 0.17, 0.17, materials.steel, 12);
        addCylinder(group, -0.25, 0.45 + riderY, 0, 0.18, 0.18, 0.05, materials.steel, 16).rotation.z = Math.PI * 0.5;
      }
      if (type === 'worker' && getWorkerGatherAnimation(unit)) attachments.addWorkerGatherTool?.(group, unit, riderY) || addWorkerGatherTool(group, unit, riderY);
      else if (type === 'archer') attachments.addLongbow(group, riderY);
      else if (type === 'gunman') attachments.addPistol(group, riderY);
      else if (type === 'crossbowman') attachments.addCrossbow(group, riderY);
      else if (type === 'grenademan') attachments.addGrenadeWeapon(group, riderY);
      else {
        const swing = (unit.attackAnimationTime || 0) > 0 ? -0.8 : 0.2;
        const sword = addBox(group, 0.29, 0.48 + riderY, 0, 0.055, 0.68, 0.045, materials.steel);
        sword.rotation.z = swing;
        addBox(group, 0.25, 0.46 + riderY, 0, 0.24, 0.05, 0.08, materials.wood).rotation.z = swing;
      }
      attachments.addCarriedObject(group, unit, riderY);
      return group;
    }

    return Object.freeze({
      create,
      getCastleElevation,
      getWorkerGatherAnimation
    });
  }

  app.rendering.threeUnitModels = Object.freeze({ createFactory });
})(globalThis);
