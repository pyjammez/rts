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
    const spriteMaterials = new Map();

    function clamp01(value) {
      return Math.max(0, Math.min(1, Number(value) || 0));
    }

    function teamColor(team) {
      if (team === 'red') return '#c74335';
      if (team === 'blue') return '#2f66c4';
      if (team === 'green') return '#3b8d4d';
      if (team === 'yellow') return '#d8ad39';
      if (team === 'purple') return '#7b55b7';
      if (team === 'orange') return '#d6782d';
      if (team === 'white') return '#d8ddd8';
      if (team === 'black') return '#2b3037';
      return '#5a7abf';
    }

    function createSpriteCanvas(width = 192, height = 224) {
      const documentRef = root.document;
      if (documentRef?.createElement) {
        const canvas = documentRef.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
      }
      if (typeof root.OffscreenCanvas === 'function') return new root.OffscreenCanvas(width, height);
      return null;
    }

    function configureCanvas(ctx) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.imageSmoothingEnabled = true;
    }

    function ellipse(ctx, x, y, rx, ry, fill, stroke = null, lineWidth = 2) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = stroke;
        ctx.stroke();
      }
    }

    function roundedRect(ctx, x, y, width, height, radius, fill, stroke = null) {
      const r = Math.min(radius, width * 0.5, height * 0.5);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    function strokeLimb(ctx, x1, y1, x2, y2, color, width = 8) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    function drawSword(ctx, progress, color = '#c9d3d6') {
      const swing = progress ? -0.8 + Math.sin(progress * Math.PI) * 1.45 : -0.2;
      ctx.save();
      ctx.translate(123, 112);
      ctx.rotate(swing);
      strokeLimb(ctx, 0, 0, 0, -58, color, 6);
      strokeLimb(ctx, -13, -8, 13, -8, '#6d4a2d', 5);
      ctx.restore();
    }

    function drawLongbow(ctx) {
      ctx.strokeStyle = '#7b4a29';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(125, 64);
      ctx.quadraticCurveTo(155, 106, 125, 150);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(235,225,190,0.72)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(125, 64);
      ctx.lineTo(125, 150);
      ctx.stroke();
    }

    function drawCrossbow(ctx) {
      strokeLimb(ctx, 112, 112, 158, 112, '#8a5b31', 7);
      strokeLimb(ctx, 135, 98, 135, 126, '#5b3822', 5);
      strokeLimb(ctx, 122, 101, 148, 123, '#c7c2ad', 2);
      strokeLimb(ctx, 148, 101, 122, 123, '#c7c2ad', 2);
    }

    function drawPistol(ctx) {
      roundedRect(ctx, 118, 103, 44, 12, 4, '#2f3338', '#16191d');
      roundedRect(ctx, 122, 114, 13, 25, 4, '#4b392c');
    }

    function drawGrenade(ctx) {
      ellipse(ctx, 144, 104, 11, 13, '#4c6a3a', '#1f2c1c', 3);
      roundedRect(ctx, 139, 87, 10, 13, 2, '#2d3329');
    }

    function drawWorkerTool(ctx, unit) {
      const job = unit.workerJob;
      if (!job || job.type !== 'gather') return;
      const phase = clamp01(unit.workerGatherAnimation?.progress);
      const swing = -0.9 + Math.sin(phase * Math.PI * 8) * 0.75;
      ctx.save();
      ctx.translate(123, 110);
      ctx.rotate(swing);
      strokeLimb(ctx, 0, 0, 0, -55, '#7b5130', 6);
      if (job.resourceType === 'wood') {
        strokeLimb(ctx, -16, -55, 16, -55, '#bfc6c2', 10);
      } else {
        strokeLimb(ctx, -22, -52, 22, -52, '#bec8c9', 6);
      }
      ctx.restore();
    }

    function drawHumanoid(ctx, unit, options = {}) {
      const color = options.bodyColor || teamColor(unit.team);
      const type = unit.model || unit.unitType || 'soldier';
      const progress = unit.attackAnimationTime && unit.attackAnimationDuration
        ? 1 - clamp01(unit.attackAnimationTime / unit.attackAnimationDuration)
        : 0;
      const stride = unit.hasActivePath?.() ? Math.sin((unit.spriteFrame || 0) * Math.PI * 0.5) * 8 : 0;
      if (unit.mountType === 'sheep') drawAnimalShape(ctx, 'sheep', 98, 148, 1.08);
      if (type === 'scout' && unit.mountType !== 'sheep') drawAnimalShape(ctx, 'horse', 98, 146, 1.18);
      const riderOffset = unit.mountType === 'sheep' || type === 'scout' ? -46 : 0;
      strokeLimb(ctx, 82, 155 + riderOffset, 76, 196 - stride + riderOffset, '#3a2b22', 8);
      strokeLimb(ctx, 108, 155 + riderOffset, 114, 196 + stride + riderOffset, '#3a2b22', 8);
      roundedRect(ctx, 74, 82 + riderOffset, 44, 78, 18, color, '#273044');
      ellipse(ctx, 96, 66 + riderOffset, 18, 21, '#c89568', '#6b4630', 3);
      strokeLimb(ctx, 76, 101 + riderOffset, 47, 131 + riderOffset, '#c89568', 8);
      strokeLimb(ctx, 116, 101 + riderOffset, 139, 123 + riderOffset, '#c89568', 8);

      if (type === 'king') {
        roundedRect(ctx, 77, 37 + riderOffset, 38, 18, 3, '#d6a82f', '#876015');
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(80 + i * 10, 39 + riderOffset);
          ctx.lineTo(85 + i * 10, 25 + riderOffset);
          ctx.lineTo(90 + i * 10, 39 + riderOffset);
          ctx.closePath();
          ctx.fillStyle = '#e6c35a';
          ctx.fill();
        }
      } else if (type === 'knight') {
        roundedRect(ctx, 69, 49 + riderOffset, 54, 24, 9, '#9da8ac', '#4d5960');
        ellipse(ctx, 52, 122 + riderOffset, 17, 24, color, '#7b7d68', 4);
      }

      if (type === 'archer') drawLongbow(ctx);
      else if (type === 'gunman') drawPistol(ctx);
      else if (type === 'crossbowman') drawCrossbow(ctx);
      else if (type === 'grenademan') drawGrenade(ctx);
      else if (type === 'worker') drawWorkerTool(ctx, unit);
      else drawSword(ctx, progress);

      if (unit.inventoryItem) roundedRect(ctx, 31, 144, 30, 32, 6, '#8c6840', '#4a3422');
    }

    function drawRobot(ctx, unit) {
      const color = teamColor(unit.team);
      const heavy = unit.size >= 30 || unit.armorType === 'heavy';
      roundedRect(ctx, heavy ? 50 : 58, 74, heavy ? 92 : 76, 88, 16, '#646d72', '#252b2f');
      roundedRect(ctx, 70, 88, 52, 42, 10, color, '#283044');
      ellipse(ctx, 96, 83, 31, 13, '#9aa6a9', '#343a3d', 3);
      strokeLimb(ctx, 70, 158, 56, 202, '#464d50', 12);
      strokeLimb(ctx, 122, 158, 137, 202, '#464d50', 12);
      strokeLimb(ctx, 126, 112, 166, 94, '#333b42', 10);
      ellipse(ctx, 172, 91, 13, 13, '#65d5ff', '#1a4859', 3);
    }

    function drawHoverTank(ctx, unit) {
      const color = teamColor(unit.team);
      roundedRect(ctx, 36, 98, 122, 54, 18, '#68757a', '#242a2d');
      roundedRect(ctx, 69, 73, 56, 42, 14, color, '#262d36');
      strokeLimb(ctx, 118, 91, 169, 77, '#3b4247', 11);
      ellipse(ctx, 174, 76, 10, 10, '#e6f8ff', '#537b86', 3);
      ellipse(ctx, 64, 157, 37, 10, 'rgba(101,213,255,0.55)');
      ellipse(ctx, 128, 157, 37, 10, 'rgba(101,213,255,0.55)');
    }

    function drawAnimalShape(ctx, kind, x = 96, y = 145, scale = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      if (kind === 'duck') {
        ellipse(ctx, -7, 13, 28, 18, '#d8b64b', '#6b5a1f', 3);
        ellipse(ctx, 20, -2, 14, 13, '#d1a536', '#6b5a1f', 3);
        roundedRect(ctx, 31, -3, 19, 8, 4, '#d9822d');
      } else if (kind === 'horse') {
        ellipse(ctx, -5, 17, 44, 22, '#7a5336', '#422b1d', 3);
        ellipse(ctx, 35, -4, 18, 24, '#7a5336', '#422b1d', 3);
        for (const lx of [-32, -12, 12, 31]) strokeLimb(ctx, lx, 30, lx + 2, 63, '#4b3123', 7);
      } else {
        ellipse(ctx, -6, 18, 42, 25, '#e7e0ce', '#6f6656', 3);
        ellipse(ctx, 37, 7, 16, 17, '#4f4038', '#261e1a', 3);
        for (const lx of [-30, -9, 10, 30]) strokeLimb(ctx, lx, 35, lx, 62, '#4f4038', 6);
      }
      ctx.restore();
    }

    function drawSkeleton(ctx, kind) {
      strokeLimb(ctx, 52, 154, 137, 154, '#d9d0b5', 8);
      for (let i = 0; i < 6; i++) strokeLimb(ctx, 63 + i * 12, 146, 58 + i * 12, 170, '#d9d0b5', 4);
      ellipse(ctx, kind === 'duck' ? 118 : 139, 145, kind === 'duck' ? 10 : 15, kind === 'duck' ? 8 : 12, '#d9d0b5', '#8f856d', 2);
    }

    function drawUnitSprite(ctx, unit) {
      configureCanvas(ctx);
      const type = unit.model || unit.unitType || 'soldier';
      const era = String(unit.era || '').toLowerCase();
      if (unit.isDead) {
        drawSkeleton(ctx, 'unit');
        return;
      }
      if (type === 'robot_walker' || era === 'robotic') drawRobot(ctx, unit);
      else if (type === 'hover_tank' || unit.armorType === 'heavy_vehicle') drawHoverTank(ctx, unit);
      else if (type === 'balloon' || unit.movementType === 'air') {
        ellipse(ctx, 96, 72, 46, 54, teamColor(unit.team), '#283044', 4);
        roundedRect(ctx, 73, 137, 46, 30, 7, '#7a5436', '#3f2b1b');
        strokeLimb(ctx, 69, 111, 76, 137, '#806044', 3);
        strokeLimb(ctx, 123, 111, 116, 137, '#806044', 3);
      } else {
        const bodyColor = era === 'modern' ? '#c0aa7c' : era === 'sci_fi' ? '#8796a8' : teamColor(unit.team);
        drawHumanoid(ctx, unit, { bodyColor });
      }
    }

    function spriteKeyFor(unit) {
      const type = unit.model || unit.unitType || 'soldier';
      const attack = unit.attackAnimationTime && unit.attackAnimationDuration
        ? Math.ceil((1 - clamp01(unit.attackAnimationTime / unit.attackAnimationDuration)) * 5)
        : 0;
      const gather = unit.workerGatherAnimation ? Math.ceil(clamp01(unit.workerGatherAnimation.progress) * 7) : 0;
      return [
        'unit',
        type,
        unit.team || 'neutral',
        unit.era || '',
        unit.movementType || '',
        unit.armorType || '',
        unit.mountType || '',
        unit.isDead ? 'dead' : '',
        unit.inventoryItem ? 'carrying' : '',
        unit.workerJob?.resourceType || '',
        attack,
        gather
      ].join('|');
    }

    function getSpriteMaterial(unit) {
      const key = spriteKeyFor(unit);
      if (spriteMaterials.has(key)) return spriteMaterials.get(key);
      const canvas = createSpriteCanvas();
      let material;
      if (canvas?.getContext && THREE.CanvasTexture && THREE.SpriteMaterial) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawUnitSprite(ctx, unit || {});
        const texture = new THREE.CanvasTexture(canvas);
        if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
        material = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          alphaTest: 0.08,
          depthWrite: false
        });
      } else {
        material = { kind: 'unit-sprite-material', key, color: teamColor(unit?.team), userData: { billboardSprite: true } };
      }
      material.userData = { ...(material.userData || {}), billboardSprite: true, key };
      spriteMaterials.set(key, material);
      return material;
    }

    function createUnitBillboard(unit) {
      const group = new THREE.Group();
      const position = worldToScene(unit.x, unit.y);
      const terrainElevation = typeof getWorldElevation === 'function' ? getWorldElevation(unit.x, unit.y) : 0;
      const elevation = entityElevation.unitElevation({ unit, terrainElevation });
      group.position.set(position.x, elevation, position.z);
      addContactShadow(group, unit, terrainElevation, elevation);
      if (unit.selected) addSelectionRing(group, 0.46);

      const size = Math.max(14, Number(unit.size) || 18);
      const isVehicle = unit.unitType === 'hover_tank' || unit.model === 'hover_tank' || unit.armorType === 'heavy_vehicle';
      const isAir = unit.movementType === 'air';
      const width = (isVehicle ? 1.18 : isAir ? 1.02 : 0.78) * (size / 18);
      const height = (isVehicle ? 1.05 : isAir ? 1.42 : 1.36) * (size / 18);
      const material = getSpriteMaterial(unit);
      const sprite = THREE.Sprite ? new THREE.Sprite(material) : { kind: 'unit-sprite', material, position: {}, scale: {}, userData: {} };
      if (sprite.center?.set) sprite.center.set(0.5, 0);
      if (sprite.position?.set) sprite.position.set(0, 0.02, 0);
      const heading = Number.isFinite(unit.heading) ? unit.heading : 0;
      const facingLeft = Math.cos(heading) < 0;
      if (sprite.scale?.set) sprite.scale.set(facingLeft ? -width : width, height, 1);
      else sprite.scaleValue = { x: facingLeft ? -width : width, y: height, z: 1 };
      sprite.renderOrder = 6;
      sprite.userData = { ...(sprite.userData || {}), billboardSprite: true, entityType: 'unit' };
      group.add(sprite);
      return finishUnitModel(group);
    }

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
      if (THREE.Sprite && THREE.SpriteMaterial && THREE.CanvasTexture) return createUnitBillboard(unit);
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
