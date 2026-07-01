(function registerThreeBuildingModelFactory(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};

  function createFactory(deps) {
    const {
      THREE,
      geometry,
      addBox,
      addCylinder,
      materials,
      worldToScene,
      getTeamMaterial,
      wallHeight
    } = deps;

    function addBattlements(parent, axis, centerX, centerZ, length, wallThickness, height, material, skipCenter = false, skipHalfWidth = 0.8) {
      const count = Math.max(4, Math.round(length / 0.58));
      const merlonW = Math.min(0.38, length / count * 0.62);
      for (let i = 0; i < count; i++) {
        const offset = -length * 0.5 + (i + 0.5) * (length / count);
        if (skipCenter && Math.abs(offset) < skipHalfWidth) continue;
        if (axis === 'x') {
          addBox(parent, centerX + offset, height, centerZ - wallThickness * 0.42, merlonW, 0.34, 0.22, material);
          addBox(parent, centerX + offset, height, centerZ + wallThickness * 0.42, merlonW, 0.34, 0.22, material);
        } else {
          addBox(parent, centerX - wallThickness * 0.42, height, centerZ + offset, 0.22, 0.34, merlonW, material);
          addBox(parent, centerX + wallThickness * 0.42, height, centerZ + offset, 0.22, 0.34, merlonW, material);
        }
      }
    }

    function addArrowSlit(parent, x, y, z, face) {
      const slit = new THREE.Mesh(
        geometry('slit', () => new THREE.PlaneGeometry(0.07, 0.33)),
        materials.slit
      );
      slit.position.set(x, y, z);
      if (face === 'front') slit.rotation.y = 0;
      if (face === 'back') slit.rotation.y = Math.PI;
      if (face === 'left') slit.rotation.y = Math.PI * 0.5;
      if (face === 'right') slit.rotation.y = -Math.PI * 0.5;
      parent.add(slit);
    }

    function material(name, fallback = 'stone') {
      return materials[name] || materials[fallback] || materials.stone;
    }

    function addPitchedRoof(parent, x, y, z, width, depth, height, roofMaterial, ridgeAxis = 'x') {
      if (ridgeAxis === 'x') {
        const panelW = width;
        const panelD = Math.hypot(depth * 0.55, height);
        const left = addBox(parent, x, y + height * 0.45, z - depth * 0.23, panelW, 0.14, panelD, roofMaterial);
        const right = addBox(parent, x, y + height * 0.45, z + depth * 0.23, panelW, 0.14, panelD, roofMaterial);
        left.rotation.x = -Math.atan2(height, depth * 0.55);
        right.rotation.x = Math.atan2(height, depth * 0.55);
      } else {
        const panelW = Math.hypot(width * 0.55, height);
        const panelD = depth;
        const left = addBox(parent, x - width * 0.23, y + height * 0.45, z, panelW, 0.14, panelD, roofMaterial);
        const right = addBox(parent, x + width * 0.23, y + height * 0.45, z, panelW, 0.14, panelD, roofMaterial);
        left.rotation.z = Math.atan2(height, width * 0.55);
        right.rotation.z = -Math.atan2(height, width * 0.55);
      }
      addBox(parent, x, y + height + 0.06, z, ridgeAxis === 'x' ? width * 1.04 : 0.12, 0.11, ridgeAxis === 'x' ? 0.12 : depth * 1.04, material('wood'));
    }

    function createEraKingdomsTownCenter(building) {
      const group = new THREE.Group();
      const position = worldToScene(building.x, building.y);
      group.position.set(position.x, 0, position.z);

      const faction = String(building.factionId || '').toLowerCase();
      const isHighland = faction.includes('highland');
      const isSteppe = faction.includes('steppe');
      const baseW = Math.max(4.8, building.width * 0.74);
      const baseD = Math.max(4.6, building.height * 0.7);
      const halfW = baseW * 0.5;
      const halfD = baseD * 0.5;
      const stone = isSteppe ? material('plaster', 'stoneLight') : material('stone');
      const trim = isHighland ? material('stoneDark') : material('wood');
      const roof = isHighland
        ? material('roofSlate', 'stoneDark')
        : isSteppe
        ? material('roofThatch', 'wood')
        : material('roofTerracotta', 'stoneDark');

      addBox(group, 0, 0, 0, baseW + 0.48, 0.22, baseD + 0.42, material('stoneDark'));
      addBox(group, 0, 0.18, 0, baseW, 0.72, baseD, stone);

      const hallHeight = isHighland ? 1.28 : 1.12;
      addBox(group, 0, 0.76, 0.18, baseW * 0.62, hallHeight, baseD * 0.5, stone);
      addPitchedRoof(group, 0, 0.76 + hallHeight, 0.18, baseW * 0.72, baseD * 0.58, 0.72, roof, 'x');

      addBox(group, -baseW * 0.28, 0.62, -baseD * 0.28, baseW * 0.34, 1.0, baseD * 0.28, material('plaster', 'stoneLight'));
      addPitchedRoof(group, -baseW * 0.28, 1.62, -baseD * 0.28, baseW * 0.4, baseD * 0.34, 0.48, roof, 'z');
      addBox(group, baseW * 0.28, 0.62, -baseD * 0.27, baseW * 0.3, 0.96, baseD * 0.25, material('plaster', 'stoneLight'));
      addPitchedRoof(group, baseW * 0.28, 1.58, -baseD * 0.27, baseW * 0.36, baseD * 0.32, 0.42, roof, 'z');

      const keepW = isHighland ? baseW * 0.36 : baseW * 0.3;
      const keepD = isHighland ? baseD * 0.34 : baseD * 0.3;
      const keepH = isSteppe ? 1.55 : isHighland ? 2.15 : 1.9;
      addBox(group, 0, 0.78, -baseD * 0.25, keepW, keepH, keepD, isSteppe ? material('wood') : material('stoneDark'));
      if (isSteppe) {
        addPitchedRoof(group, 0, 0.78 + keepH, -baseD * 0.25, keepW * 1.24, keepD * 1.22, 0.76, roof, 'x');
      } else {
        addBox(group, 0, 0.78 + keepH, -baseD * 0.25, keepW + 0.2, 0.12, keepD + 0.2, material('stoneLight'));
        addBattlements(group, 'x', 0, -baseD * 0.25, keepW + 0.16, keepD, 0.9 + keepH, materials.stone);
        addBattlements(group, 'z', -keepW * 0.5, -baseD * 0.25, keepD + 0.16, keepW, 0.9 + keepH, materials.stone);
        addBattlements(group, 'z', keepW * 0.5, -baseD * 0.25, keepD + 0.16, keepW, 0.9 + keepH, materials.stone);
      }

      const towerHeight = isHighland ? 1.95 : 1.55;
      const towerRadius = isSteppe ? 0.42 : 0.52;
      const towerPositions = isSteppe
        ? [[-halfW * 0.82, halfD * 0.72], [halfW * 0.82, halfD * 0.72]]
        : [[-halfW * 0.78, -halfD * 0.72], [halfW * 0.78, -halfD * 0.72], [-halfW * 0.78, halfD * 0.72], [halfW * 0.78, halfD * 0.72]];
      for (const [towerX, towerZ] of towerPositions) {
        addCylinder(group, towerX, 0.2, towerZ, towerRadius * 0.92, towerRadius, towerHeight, isSteppe ? material('wood') : material('stoneDark'), 16);
        if (isSteppe) {
          addPitchedRoof(group, towerX, towerHeight + 0.22, towerZ, towerRadius * 2.3, towerRadius * 2.0, 0.55, roof, 'x');
        } else {
          addCylinder(group, towerX, towerHeight + 0.2, towerZ, towerRadius * 1.08, towerRadius * 1.08, 0.12, material('stoneLight'), 16);
          for (let i = 0; i < 8; i++) {
            const angle = i / 8 * Math.PI * 2;
            addBox(group, towerX + Math.cos(angle) * towerRadius * 0.78, towerHeight + 0.34, towerZ + Math.sin(angle) * towerRadius * 0.78, 0.22, 0.32, 0.22, material('stone')).rotation.y = -angle;
          }
        }
      }

      const doorZ = halfD + 0.04;
      addBox(group, 0, 0.24, doorZ, 0.86, 0.86, 0.08, material('wood'));
      addBox(group, -0.48, 0.24, doorZ + 0.03, 0.08, 0.96, 0.12, trim);
      addBox(group, 0.48, 0.24, doorZ + 0.03, 0.08, 0.96, 0.12, trim);
      addBox(group, 0, 0.98, doorZ + 0.03, 1.05, 0.12, 0.12, trim);

      for (const x of [-baseW * 0.32, 0, baseW * 0.32]) addArrowSlit(group, x, 1.18, -halfD - 0.03, 'back');
      for (const x of [-baseW * 0.26, baseW * 0.26]) addArrowSlit(group, x, 1.0, halfD + 0.05, 'front');

      for (const x of [-baseW * 0.42, baseW * 0.42]) {
        addBox(group, x, 0.22, halfD * 0.32, 0.36, 0.28, 0.32, material('wood'));
        addBox(group, x + 0.03, 0.5, halfD * 0.32, 0.32, 0.04, 0.28, material('stoneLight'));
      }

      const flagMaterial = getTeamMaterial(building.team);
      addCylinder(group, halfW * 0.58, keepH + 1.0, -baseD * 0.25, 0.025, 0.025, 1.0, material('wood'), 8);
      addBox(group, halfW * 0.58 + 0.23, keepH + 1.66, -baseD * 0.25, 0.46, 0.24, 0.035, flagMaterial);

      if (typeof group.traverse === 'function') {
        group.traverse(child => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
      }
      return group;
    }

    function createCastle(building) {
      const group = new THREE.Group();
      const position = worldToScene(building.x, building.y);
      group.position.set(position.x, 0, position.z);

      const baseW = Math.max(2.35, building.width * 0.72);
      const baseD = Math.max(2.15, building.height * 0.68);
      const halfW = baseW * 0.5;
      const halfD = baseD * 0.5;
      const keepW = baseW * 0.58;
      const keepD = baseD * 0.52;
      const keepH = Math.max(1.45, wallHeight * 1.22);
      const towerRadius = 0.34;
      const towerHeight = keepH * 0.78;

      addBox(group, 0, 0, 0, baseW + 0.24, 0.16, baseD + 0.2, materials.stoneDark);
      addBox(group, 0, 0.12, 0.02, baseW, 0.56, baseD, materials.stone);
      addBox(group, 0, 0.64, -baseD * 0.06, keepW, keepH, keepD, materials.stoneDark);
      addBox(group, 0, 0.64 + keepH, -baseD * 0.06, keepW + 0.12, 0.12, keepD + 0.12, materials.stoneLight);
      addBattlements(group, 'x', 0, -baseD * 0.06, keepW + 0.16, keepD, 0.78 + keepH, materials.stone);
      addBattlements(group, 'z', -keepW * 0.5, -baseD * 0.06, keepD + 0.16, keepW, 0.78 + keepH, materials.stone);
      addBattlements(group, 'z', keepW * 0.5, -baseD * 0.06, keepD + 0.16, keepW, 0.78 + keepH, materials.stone);

      const towers = [
        [-halfW * 0.82, -halfD * 0.78],
        [halfW * 0.82, -halfD * 0.78],
        [-halfW * 0.82, halfD * 0.78],
        [halfW * 0.82, halfD * 0.78]
      ];
      for (const [towerX, towerZ] of towers) {
        addCylinder(group, towerX, 0.12, towerZ, towerRadius * 0.92, towerRadius, towerHeight, materials.stoneDark, 16);
        addCylinder(group, towerX, 0.12 + towerHeight, towerZ, towerRadius * 1.08, towerRadius * 1.08, 0.1, materials.stoneLight, 16);
        addBox(group, towerX, 0.24 + towerHeight, towerZ, towerRadius * 1.35, 0.22, towerRadius * 1.35, materials.stone);
      }

      addBox(group, 0, 0.2, halfD + 0.035, 0.58, 0.64, 0.08, materials.wood);
      addBox(group, -0.34, 0.2, halfD + 0.06, 0.08, 0.72, 0.12, materials.stoneDark);
      addBox(group, 0.34, 0.2, halfD + 0.06, 0.08, 0.72, 0.12, materials.stoneDark);
      addBox(group, 0, 0.78, halfD + 0.06, 0.78, 0.1, 0.12, materials.stoneDark);
      for (const slitX of [-baseW * 0.24, baseW * 0.24]) addArrowSlit(group, slitX, 0.86, -halfD - 0.03, 'back');

      const flagMaterial = getTeamMaterial(building.team);
      addCylinder(group, halfW * 0.36, keepH + 0.82, -baseD * 0.08, 0.025, 0.025, 0.85, materials.wood, 8);
      addBox(group, halfW * 0.36 + 0.2, keepH + 1.34, -baseD * 0.08, 0.4, 0.22, 0.035, flagMaterial);
      if (typeof group.traverse === 'function') {
        group.traverse(child => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
      }
      return group;
    }

    function createDefenseTower(building) {
      const group = new THREE.Group();
      const position = worldToScene(building.x, building.y);
      group.position.set(position.x, 0, position.z);
      addCylinder(group, 0, 0, 0, 0.62, 0.76, 2.3, materials.stone, 20);
      addCylinder(group, 0, 2.3, 0, 0.82, 0.82, 0.12, materials.stoneLight, 20);
      for (let i = 0; i < 10; i++) {
        const angle = i / 10 * Math.PI * 2;
        addBox(group, Math.cos(angle) * 0.68, 2.42, Math.sin(angle) * 0.68, 0.27, 0.38, 0.27, materials.stone).rotation.y = -angle;
      }
      for (const y of [0.72, 1.35]) addArrowSlit(group, 0, y, 0.765, 'front');
      const flagMaterial = getTeamMaterial(building.team);
      addCylinder(group, 0.15, 2.42, 0, 0.025, 0.025, 0.9, materials.wood, 8);
      addBox(group, 0.38, 3.0, 0, 0.44, 0.23, 0.035, flagMaterial);
      return group;
    }

    return Object.freeze({
      createCastle,
      createEraKingdomsTownCenter,
      createDefenseTower,
      addBattlements,
      addArrowSlit
    });
  }

  app.rendering.threeBuildingModels = Object.freeze({ createFactory });
})(globalThis);
