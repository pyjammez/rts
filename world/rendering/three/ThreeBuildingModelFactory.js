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
      rampartHeight
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

    function createCastle(building) {
      const group = new THREE.Group();
      const position = worldToScene(building.x, building.y);
      group.position.set(position.x, 0, position.z);

      const outerW = building.width * 0.9;
      const outerD = building.height * 0.86;
      const wallT = 0.92;
      const wallH = rampartHeight;
      const halfW = outerW * 0.5;
      const halfD = outerD * 0.5;
      const gateW = 3.05;
      const frontSegment = (outerW - gateW) * 0.5;
      const frontOffset = gateW * 0.5 + frontSegment * 0.5;

      addBox(group, 0, 0.02, 0, outerW - wallT * 1.25, 0.08, outerD - wallT * 1.25, materials.courtyard);
      addBox(group, 0, 0, -halfD, outerW, wallH, wallT, materials.stone);
      addBox(group, -halfW, 0, 0, wallT, wallH, outerD, materials.stone);
      addBox(group, halfW, 0, 0, wallT, wallH, outerD, materials.stone);
      addBox(group, -frontOffset, 0, halfD, frontSegment, wallH, wallT, materials.stone);
      addBox(group, frontOffset, 0, halfD, frontSegment, wallH, wallT, materials.stone);

      addBox(group, 0, wallH, -halfD, outerW, 0.09, wallT + 0.08, materials.stoneLight);
      addBox(group, -halfW, wallH, 0, wallT + 0.08, 0.09, outerD, materials.stoneLight);
      addBox(group, halfW, wallH, 0, wallT + 0.08, 0.09, outerD, materials.stoneLight);
      addBox(group, -frontOffset, wallH, halfD, frontSegment, 0.09, wallT + 0.08, materials.stoneLight);
      addBox(group, frontOffset, wallH, halfD, frontSegment, 0.09, wallT + 0.08, materials.stoneLight);

      addBattlements(group, 'x', 0, -halfD, outerW, wallT, wallH + 0.09, materials.stone);
      addBattlements(group, 'z', -halfW, 0, outerD, wallT, wallH + 0.09, materials.stone);
      addBattlements(group, 'z', halfW, 0, outerD, wallT, wallH + 0.09, materials.stone);
      addBattlements(group, 'x', 0, halfD, outerW, wallT, wallH + 0.09, materials.stone, true, gateW * 0.56);

      const towerRadius = 0.72;
      const towerHeight = 1.65;
      const towers = [[-halfW, -halfD], [halfW, -halfD], [-halfW, halfD], [halfW, halfD]];
      for (const [towerX, towerZ] of towers) {
        addCylinder(group, towerX, 0, towerZ, towerRadius * 0.94, towerRadius, towerHeight, materials.stoneDark, 20);
        addCylinder(group, towerX, towerHeight, towerZ, towerRadius * 1.04, towerRadius * 1.04, 0.1, materials.stoneLight, 20);
        for (let i = 0; i < 10; i++) {
          const angle = i / 10 * Math.PI * 2;
          addBox(
            group,
            towerX + Math.cos(angle) * towerRadius * 0.82,
            towerHeight + 0.1,
            towerZ + Math.sin(angle) * towerRadius * 0.82,
            0.26,
            0.36,
            0.26,
            materials.stone
          ).rotation.y = -angle;
        }
      }

      const keepW = outerW * 0.34;
      const keepD = 1.28;
      addBox(group, 0, 0.04, -halfD + wallT * 1.25, keepW, 2.15, keepD, materials.stoneDark);
      addBox(group, 0, 2.19, -halfD + wallT * 1.25, keepW + 0.08, 0.1, keepD + 0.08, materials.stoneLight);
      addBattlements(group, 'x', 0, -halfD + wallT * 1.25, keepW, keepD, 2.29, materials.stone);
      addBattlements(group, 'z', -keepW * 0.5, -halfD + wallT * 1.25, keepD, keepW, 2.29, materials.stone);
      addBattlements(group, 'z', keepW * 0.5, -halfD + wallT * 1.25, keepD, keepW, 2.29, materials.stone);

      const gatehouseZ = halfD + wallT * 0.15;
      const gatePillarW = 0.62;
      const gatehouseH = 1.88;
      const openingShoulderY = 0.82;
      addBox(group, -(gateW + gatePillarW) * 0.5, 0, gatehouseZ, gatePillarW, gatehouseH, 0.82, materials.stoneDark);
      addBox(group, (gateW + gatePillarW) * 0.5, 0, gatehouseZ, gatePillarW, gatehouseH, 0.82, materials.stoneDark);
      addBox(group, 0, 1.48, gatehouseZ, gateW + gatePillarW * 2, 0.4, 0.82, materials.stoneDark);
      addBox(group, 0, gatehouseH, gatehouseZ, gateW + gatePillarW * 2 + 0.12, 0.1, 0.9, materials.stoneLight);
      addBattlements(group, 'x', 0, gatehouseZ, gateW + gatePillarW * 2, 0.9, gatehouseH + 0.1, materials.stone);

      const archRadiusX = gateW * 0.5 + 0.02;
      const archRadiusY = 0.7;
      for (let i = 0; i < 11; i++) {
        const angle = i / 10 * Math.PI;
        const stone = addBox(
          group,
          Math.cos(angle) * archRadiusX,
          openingShoulderY + Math.sin(angle) * archRadiusY,
          gatehouseZ + 0.43,
          0.38,
          0.26,
          0.18,
          i === 5 ? materials.stoneLight : materials.stone
        );
        stone.rotation.z = angle - Math.PI * 0.5;
      }

      for (const slitX of [-outerW * 0.28, 0, outerW * 0.28]) addArrowSlit(group, slitX, 0.7, -halfD - wallT * 0.505, 'front');
      for (const side of [-1, 1]) {
        addArrowSlit(group, side * (halfW + wallT * 0.505), 0.7, -outerD * 0.18, side < 0 ? 'left' : 'right');
        addArrowSlit(group, side * (halfW + wallT * 0.505), 0.7, outerD * 0.12, side < 0 ? 'left' : 'right');
      }

      const stairCount = 12;
      const stairBaseX = 1.0;
      const stairTopX = halfW - wallT * 0.18;
      const stairZ = 1.0;
      const stairWidth = (stairTopX - stairBaseX) / (stairCount - 1) + 0.04;
      for (let step = 0; step < stairCount; step++) {
        const progress = step / (stairCount - 1);
        addBox(
          group,
          stairBaseX + (stairTopX - stairBaseX) * progress,
          0.04,
          stairZ,
          stairWidth,
          0.1 + wallH * progress,
          1.08,
          materials.stoneLight
        );
      }
      const railLength = Math.hypot(stairTopX - stairBaseX, wallH) + 0.2;
      const railCenterX = (stairBaseX + stairTopX) * 0.5;
      const railAngle = Math.atan2(wallH, stairTopX - stairBaseX);
      addBox(group, railCenterX, wallH * 0.5, stairZ - 0.52, railLength, 0.13, 0.12, materials.stoneDark).rotation.z = railAngle;
      addBox(group, railCenterX, wallH * 0.5, stairZ + 0.52, railLength, 0.13, 0.12, materials.stoneDark).rotation.z = railAngle;

      const flagMaterial = getTeamMaterial(building.team);
      addCylinder(group, halfW * 0.45, towerHeight + 0.04, -halfD, 0.025, 0.025, 1.1, materials.wood, 8);
      addBox(group, halfW * 0.45 + 0.23, towerHeight + 0.72, -halfD, 0.46, 0.25, 0.035, flagMaterial);
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
      createDefenseTower,
      addBattlements,
      addArrowSlit
    });
  }

  app.rendering.threeBuildingModels = Object.freeze({ createFactory });
})(globalThis);
