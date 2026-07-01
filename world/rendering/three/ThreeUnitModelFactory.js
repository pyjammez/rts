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
      entityElevation
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

    function addRobotWalker(group, unit, teamMaterial, stride) {
      const hull = materials.robotMetal || materials.steel;
      const glow = materials.crystal || materials.projectile || teamMaterial;
      addBox(group, 0, 0.42, 0, 0.54, 0.32, 0.42, hull);
      addBox(group, 0, 0.66, -0.05, 0.42, 0.18, 0.32, teamMaterial);
      addBox(group, 0, 0.78, 0.16, 0.28, 0.07, 0.045, glow);
      const heavy = unit.size >= 30 || unit.armorType === 'heavy';
      const legPairs = heavy ? 3 : 2;
      for (let i = 0; i < legPairs; i++) {
        const z = legPairs === 3 ? -0.24 + i * 0.24 : -0.18 + i * 0.36;
        const phase = i % 2 ? -stride : stride;
        for (const side of [-1, 1]) {
          addBox(group, side * 0.34, 0.28, z + phase, 0.24, 0.065, 0.075, hull).rotation.z = side * -0.42;
          addBox(group, side * 0.48, 0.08, z + phase * 1.25, 0.075, 0.28, 0.07, materials.steel);
        }
      }
      addBox(group, 0.36, 0.62, 0, 0.48, 0.07, 0.08, materials.steel);
      addBox(group, 0.63, 0.62, 0, 0.12, 0.11, 0.11, glow);
      if (heavy) {
        addBox(group, -0.34, 0.62, 0, 0.4, 0.08, 0.09, materials.steel);
        addBox(group, -0.58, 0.62, 0, 0.13, 0.12, 0.12, materials.steel);
      }
    }

    function addHoverTank(group, unit, teamMaterial) {
      const hull = materials.robotMetal || materials.steel;
      const glow = materials.crystal || materials.projectile || teamMaterial;
      const heavy = unit.size >= 34 || unit.armorType === 'heavy_vehicle';
      addBox(group, 0, 0.28, 0, heavy ? 0.96 : 0.8, heavy ? 0.28 : 0.22, heavy ? 0.62 : 0.5, hull);
      addBox(group, 0, 0.48, -0.03, heavy ? 0.56 : 0.44, 0.22, heavy ? 0.4 : 0.32, teamMaterial);
      addBox(group, 0, 0.15, -0.34, heavy ? 0.8 : 0.62, 0.055, 0.08, glow);
      addBox(group, 0, 0.15, 0.34, heavy ? 0.8 : 0.62, 0.055, 0.08, glow);
      addBox(group, 0.48, 0.5, 0, heavy ? 0.82 : 0.58, heavy ? 0.1 : 0.075, heavy ? 0.12 : 0.09, materials.steel);
      addBox(group, heavy ? 0.94 : 0.74, 0.5, 0, 0.16, 0.14, 0.14, glow);
      if (heavy) {
        addBox(group, -0.24, 0.62, 0, 0.34, 0.1, 0.16, materials.steel);
        addBox(group, -0.46, 0.62, 0, 0.18, 0.13, 0.18, materials.steel);
      }
    }

    function swordSwing(unit) {
      if (!unit.attackAnimationTime || !unit.attackAnimationDuration) return 0;
      const progress = 1 - Math.max(0, Math.min(1, unit.attackAnimationTime / unit.attackAnimationDuration));
      return Math.sin(progress * Math.PI);
    }

    function addContactShadow(group, unit, terrainElevation, elevation) {
      if (!materials.unitShadow) return;
      const size = Math.max(14, Number(unit.size) || 18);
      const isAir = unit.movementType === 'air';
      const isVehicle = unit.unitType === 'hover_tank' || unit.model === 'hover_tank' || unit.armorType === 'heavy_vehicle';
      const radiusX = (isVehicle ? 0.68 : isAir ? 0.58 : 0.42) * (size / 18);
      const radiusZ = (isVehicle ? 0.42 : isAir ? 0.34 : 0.28) * (size / 18);
      const shadow = new THREE.Mesh(
        geometry('unit:soft-contact-shadow', () => new THREE.CircleGeometry(1, 32)),
        materials.unitShadow
      );
      shadow.rotation.x = -Math.PI * 0.5;
      shadow.position.y = terrainElevation - elevation + 0.018;
      if (shadow.scale?.set) shadow.scale.set(radiusX, radiusZ, 1);
      shadow.castShadow = false;
      shadow.receiveShadow = false;
      shadow.renderOrder = 2;
      shadow.userData = { ...(shadow.userData || {}), contactShadow: true };
      group.add(shadow);
    }

    function disableHardUnitShadows(node) {
      if (!node || typeof node !== 'object') return;
      if (!node.userData?.contactShadow && node !== null && ('castShadow' in node || node.isMesh || node.kind)) {
        node.castShadow = false;
      }
      if (Array.isArray(node.children)) {
        for (const child of node.children) disableHardUnitShadows(child);
      }
    }

    function finishUnitModel(group) {
      disableHardUnitShadows(group);
      return group;
    }

    function create(unit) {
      const group = new THREE.Group();
      const position = worldToScene(unit.x, unit.y);
      const terrainElevation = typeof getWorldElevation === 'function' ? getWorldElevation(unit.x, unit.y) : 0;
      const elevation = entityElevation.unitElevation({
        unit,
        terrainElevation
      });
      group.position.set(position.x, elevation, position.z);
      group.rotation.y = -(Number.isFinite(unit.heading) ? unit.heading : 0);
      addContactShadow(group, unit, terrainElevation, elevation);
      if (unit.isDead) {
        addBox(group, 0, 0.04, 0, 0.55, 0.06, 0.12, materials.bone);
        addSphere(group, 0.33, 0.1, 0, 0.13, materials.bone);
        return finishUnitModel(group);
      }
      if (unit.selected) addSelectionRing(group, 0.46);

      const teamMaterial = getTeamMaterial(unit.team);
      const type = unit.model || unit.unitType || 'soldier';
      const era = String(unit.era || '').toLowerCase();
      const isSciFi = era === 'sci_fi';
      const isModern = era === 'modern';
      const isRobotic = era === 'robotic';
      const isFantasy = era === 'fantasy';
      const isHistorical = era === 'historical';
      const stride = unit.hasActivePath?.() ? Math.sin((unit.spriteFrame || 0) * Math.PI * 0.5) * 0.07 : 0;
      if (type === 'balloon' || unit.movementType === 'air') {
        if (isSciFi || isRobotic || isModern) {
          const hullMaterial = isRobotic ? materials.robotMetal || materials.steel : isSciFi ? materials.sciFiMetal || teamMaterial : materials.steel;
          addBox(group, 0, 0.58, 0, 0.9, 0.22, 0.34, hullMaterial);
          addBox(group, -0.54, 0.56, 0, 0.46, 0.055, 0.24, teamMaterial);
          addBox(group, 0.54, 0.56, 0, 0.46, 0.055, 0.24, teamMaterial);
          addBox(group, 0, 0.56, -0.3, 0.18, 0.045, 0.34, hullMaterial);
          addBox(group, 0.4, 0.52, 0, 0.08, 0.08, 0.08, materials.projectile || teamMaterial);
        } else {
          addSphere(group, 0, 0.72, 0, 0.42, teamMaterial, { x: 0.88, y: 1.05, z: 0.88 });
          addBox(group, 0, 0.18, 0, 0.36, 0.18, 0.32, materials.wood);
          addBox(group, -0.18, 0.36, -0.14, 0.035, 0.48, 0.035, materials.rope || materials.wood);
          addBox(group, 0.18, 0.36, -0.14, 0.035, 0.48, 0.035, materials.rope || materials.wood);
          addBox(group, -0.18, 0.36, 0.14, 0.035, 0.48, 0.035, materials.rope || materials.wood);
          addBox(group, 0.18, 0.36, 0.14, 0.035, 0.48, 0.035, materials.rope || materials.wood);
        }
        addBox(group, 0.18, 0.25, 0, 0.05, 0.38, 0.04, materials.steel);
        return finishUnitModel(group);
      }

      if (type === 'robot_walker') {
        addRobotWalker(group, unit, teamMaterial, stride);
        attachments.addCarriedObject(group, unit, 0);
        return finishUnitModel(group);
      }

      if (type === 'hover_tank') {
        addHoverTank(group, unit, teamMaterial);
        return finishUnitModel(group);
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
      const bodyMaterial = isRobotic
        ? materials.robotMetal || materials.steel
        : isSciFi
          ? materials.sciFiMetal || teamMaterial
          : isModern
            ? materials.desertCloth || teamMaterial
            : teamMaterial;
      addCylinder(group, 0, 0.28 + riderY, 0, type === 'knight' ? 0.22 : 0.18, type === 'knight' ? 0.24 : 0.2, type === 'knight' ? 0.62 : 0.52, bodyMaterial, 12);
      addSphere(group, 0, 0.93 + riderY, 0, 0.14, materials.skin);
      if (isSciFi) {
        addBox(group, 0, 0.94 + riderY, 0.11, 0.25, 0.08, 0.035, materials.crystal || materials.projectile);
        addBox(group, 0, 0.56 + riderY, -0.16, 0.28, 0.24, 0.08, materials.sciFiMetal || materials.steel);
      } else if (isModern) {
        addCylinder(group, 0, 1.01 + riderY, 0, 0.15, 0.16, 0.08, materials.steel, 12);
        addBox(group, 0, 0.58 + riderY, -0.16, 0.32, 0.18, 0.08, materials.supply || materials.leather);
      } else if (isRobotic) {
        addBox(group, -0.14, 0.62 + riderY, 0, 0.11, 0.22, 0.08, materials.steel);
        addBox(group, 0.14, 0.62 + riderY, 0, 0.11, 0.22, 0.08, materials.steel);
        addBox(group, 0, 0.94 + riderY, 0.1, 0.2, 0.055, 0.035, materials.projectile || materials.crystal);
      } else if (isFantasy) {
        addBox(group, 0, 0.5 + riderY, -0.18, 0.3, 0.42, 0.045, teamMaterial);
      } else if (isHistorical) {
        addBox(group, 0, 0.56 + riderY, -0.16, 0.24, 0.2, 0.05, materials.wood);
      }
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
        const swing = 0.2 - swordSwing(unit) * 1.55;
        const sword = addBox(group, 0.29, 0.48 + riderY, 0, 0.055, 0.68, 0.045, materials.steel);
        sword.rotation.z = swing;
        addBox(group, 0.25, 0.46 + riderY, 0, 0.24, 0.05, 0.08, materials.wood).rotation.z = swing;
      }
      attachments.addCarriedObject(group, unit, riderY);
      return finishUnitModel(group);
    }

    return Object.freeze({
      create,
      getWorkerGatherAnimation
    });
  }

  app.rendering.threeUnitModels = Object.freeze({ createFactory });
})(globalThis);
