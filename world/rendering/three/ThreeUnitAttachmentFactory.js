(function registerThreeUnitAttachmentFactory(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.rendering = app.rendering || {};

  function createFactory({ THREE, geometry, addBox, addCylinder, addSphere, addMesh, materials, obstacleTypes }) {
    function addLongbow(parent, riderY = 0) {
      const bowGroup = new THREE.Group();
      bowGroup.position.y = riderY;
      const bow = new THREE.Mesh(
        geometry('weapon:longbow', () => {
          const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.2, 1.08, 0.18),
            new THREE.Vector3(0.35, 0.84, 0.18),
            new THREE.Vector3(0.42, 0.55, 0.18),
            new THREE.Vector3(0.35, 0.27, 0.18),
            new THREE.Vector3(0.2, 0.03, 0.18)
          ], false, 'centripetal');
          return new THREE.TubeGeometry(curve, 20, 0.026, 7, false);
        }),
        materials.wood
      );
      bow.castShadow = true;
      bow.receiveShadow = true;
      bowGroup.add(bow);
      addCylinder(bowGroup, 0.2, 0.03, 0.18, 0.006, 0.006, 1.05, materials.bone, 5);
      addCylinder(bowGroup, 0.4, 0.47, 0.18, 0.043, 0.043, 0.16, materials.leather, 8);
      parent.add(bowGroup);
      return bowGroup;
    }

    function addPistol(parent, riderY = 0) {
      addBox(parent, 0.29, 0.53 + riderY, 0.13, 0.42, 0.09, 0.1, materials.iron);
      const grip = addBox(parent, 0.13, 0.38 + riderY, 0.13, 0.1, 0.2, 0.09, materials.leather);
      grip.rotation.z = -0.2;
      addCylinder(parent, 0.51, 0.555 + riderY, 0.13, 0.035, 0.035, 0.08, materials.iron, 10).rotation.z = Math.PI * 0.5;
    }

    function addCrossbow(parent, riderY = 0) {
      const crossbowGroup = new THREE.Group();
      crossbowGroup.position.y = riderY;
      addBox(crossbowGroup, 0.28, 0.47, 0, 0.58, 0.08, 0.1, materials.wood);
      const limbs = new THREE.Mesh(
        geometry('weapon:crossbow-limbs', () => {
          const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.5, 0.55, -0.4),
            new THREE.Vector3(0.59, 0.55, -0.2),
            new THREE.Vector3(0.62, 0.55, 0),
            new THREE.Vector3(0.59, 0.55, 0.2),
            new THREE.Vector3(0.5, 0.55, 0.4)
          ], false, 'centripetal');
          return new THREE.TubeGeometry(curve, 18, 0.024, 7, false);
        }),
        materials.wood
      );
      limbs.castShadow = true;
      crossbowGroup.add(limbs);
      addBox(crossbowGroup, 0.5, 0.54, 0, 0.025, 0.025, 0.8, materials.bone);
      addBox(crossbowGroup, 0.45, 0.56, 0, 0.46, 0.025, 0.025, materials.steel);
      parent.add(crossbowGroup);
    }

    function addGrenadeWeapon(parent, riderY = 0) {
      addSphere(parent, 0.32, 0.58 + riderY, 0.15, 0.13, materials.grenade);
      const fuse = addCylinder(parent, 0.32, 0.69 + riderY, 0.15, 0.018, 0.018, 0.11, materials.wood, 6);
      fuse.rotation.z = -0.35;
    }

    function addCarriedObject(parent, unit, riderY = 0) {
      const item = unit.inventoryItem;
      if (!item) return;
      if (item.carryType === 'obstacle' && item.obstacleType === obstacleTypes.TREE) {
        const trunk = addCylinder(parent, 0, 1.02 + riderY, -0.08, 0.07, 0.1, 0.92, materials.trunk, 8);
        trunk.rotation.z = Math.PI * 0.5;
        addSphere(parent, -0.43, 1.08 + riderY, -0.08, 0.27, materials.foliage, { x: 0.34, y: 0.3, z: 0.3 });
        addSphere(parent, -0.58, 1.1 + riderY, -0.05, 0.2, materials.foliageLight);
        return;
      }
      if (item.carryType === 'obstacle' && item.obstacleType === obstacleTypes.ROCK) {
        const rock = new THREE.Mesh(
          geometry('carried:rock', () => new THREE.DodecahedronGeometry(1, 0)),
          materials.rock
        );
        rock.scale.set(0.28, 0.22, 0.25);
        rock.rotation.set(0.2, 0.45, -0.15);
        addMesh(parent, rock, 0.05, 1.12 + riderY, 0);
        return;
      }
      addBox(parent, 0, 0.92 + riderY, -0.12, 0.32, 0.2, 0.24, materials.supply);
    }

    return Object.freeze({
      addLongbow,
      addPistol,
      addCrossbow,
      addGrenadeWeapon,
      addCarriedObject
    });
  }

  app.rendering.threeUnitAttachments = Object.freeze({ createFactory });
})(globalThis);
