/* ============================================================
   CHARACTERS — procedural low-poly Gojo & Sukuna + animation
   ============================================================ */
(function () {
  const CharFactory = {};

  function mat(color, opts) {
    opts = opts || {};
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: opts.roughness !== undefined ? opts.roughness : 0.85,
      metalness: opts.metalness !== undefined ? opts.metalness : 0.0,
      emissive: opts.emissive !== undefined ? opts.emissive : 0x000000,
      emissiveIntensity: opts.emissiveIntensity !== undefined ? opts.emissiveIntensity : 1.0,
      transparent: !!opts.transparent,
      opacity: opts.opacity !== undefined ? opts.opacity : 1.0,
    });
  }

  function box(w, h, d, material) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.castShadow = true;
    return m;
  }

  function cyl(rt, rb, h, material, seg) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 8), material);
    m.castShadow = true;
    return m;
  }

  function sph(r, material, w, hseg) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, w || 10, hseg || 8), material);
    m.castShadow = true;
    return m;
  }

  function cone(r, h, material, seg) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg || 6), material);
    m.castShadow = true;
    return m;
  }

  function cap(r, len, material) {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), material);
    m.castShadow = true;
    return m;
  }

  /* ---------- shared humanoid rig ----------
     root
       body (y offset so feet on ground; used for lean/crouch/knockdown)
         hips (y=0.92)
           legL / legR (pivot at hip)   -> shinL/shinR (pivot at knee)
           torsoG (pivot at waist)
             torso meshes
             headG (pivot at neck)
             armL / armR (pivot at shoulder) -> foreL/foreR (pivot at elbow)
     Character faces +Z when root.rotation.y == 0.
  ------------------------------------------- */
  function buildRig() {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const hips = new THREE.Group();
    hips.position.y = 0.92;
    body.add(hips);

    const torsoG = new THREE.Group();
    torsoG.position.y = 0.06;
    hips.add(torsoG);

    const headG = new THREE.Group();
    headG.position.y = 0.62;
    torsoG.add(headG);

    const armL = new THREE.Group();
    armL.position.set(-0.27, 0.52, 0);
    torsoG.add(armL);
    const foreL = new THREE.Group();
    foreL.position.y = -0.30;
    armL.add(foreL);

    const armR = new THREE.Group();
    armR.position.set(0.27, 0.52, 0);
    torsoG.add(armR);
    const foreR = new THREE.Group();
    foreR.position.y = -0.30;
    armR.add(foreR);

    const legL = new THREE.Group();
    legL.position.set(-0.12, 0, 0);
    hips.add(legL);
    const shinL = new THREE.Group();
    shinL.position.y = -0.44;
    legL.add(shinL);

    const legR = new THREE.Group();
    legR.position.set(0.12, 0, 0);
    hips.add(legR);
    const shinR = new THREE.Group();
    shinR.position.y = -0.44;
    legR.add(shinR);

    return { root, body, hips, torsoG, headG, armL, foreL, armR, foreR, legL, shinL, legR, shinR, userData: { baseRotX: 0 } };
  }

  function limbMeshes(rig, skinM, upperM, lowerM, shoeM, pantsUM, pantsLM) {
    // arms: capsules with sphere joints so nothing reads as a box
    for (const side of ['L', 'R']) {
      const arm = rig['arm' + side];
      const fore = rig['fore' + side];
      const shoulder = sph(0.078, upperM, 10, 8);
      arm.add(shoulder);
      const upper = cap(0.056, 0.19, upperM);
      upper.position.y = -0.15;
      arm.add(upper);
      const elbow = sph(0.06, lowerM, 10, 8);
      fore.add(elbow);
      const forearm = cap(0.048, 0.17, lowerM);
      forearm.position.y = -0.14;
      fore.add(forearm);
      const hand = sph(0.062, skinM, 10, 8);
      hand.position.y = -0.31;
      fore.add(hand);
      fore.userData.hand = hand;
    }
    // legs
    for (const side of ['L', 'R']) {
      const leg = rig['leg' + side];
      const shin = rig['shin' + side];
      const hip = sph(0.088, pantsUM, 10, 8);
      leg.add(hip);
      const thigh = cap(0.075, 0.27, pantsUM);
      thigh.position.y = -0.22;
      leg.add(thigh);
      const knee = sph(0.068, pantsLM, 10, 8);
      shin.add(knee);
      const shinMesh = cap(0.058, 0.25, pantsLM);
      shinMesh.position.y = -0.21;
      shin.add(shinMesh);
      const foot = sph(0.085, shoeM, 10, 8);
      foot.scale.set(1, 0.55, 1.7);
      foot.position.set(0, -0.43, 0.06);
      shin.add(foot);
    }
  }

  /* ============ GOJO ============ */
  CharFactory.buildGojo = function () {
    const rig = buildRig();
    const skin = mat(0xe8c4a0);
    const jacket = mat(0x161d30, { roughness: 0.7 });
    const jacketDark = mat(0x0e1322);
    const shoe = mat(0x0a0a0f);
    const hairM = mat(0xf4f6fa, { roughness: 0.6 });
    const eyeM = mat(0x37c8ff, { emissive: 0x37c8ff, emissiveIntensity: 2.2 });

    limbMeshes(rig, skin, jacket, jacket, shoe, jacket, jacketDark);

    // torso: dark high-collar jacket (rounded)
    const chest = cap(0.205, 0.24, jacket);
    chest.scale.set(1.35, 1, 0.82);
    chest.position.y = 0.32;
    rig.torsoG.add(chest);
    const waist = sph(0.19, jacketDark, 12, 10);
    waist.scale.set(1.25, 0.8, 0.85);
    waist.position.y = 0.02;
    rig.torsoG.add(waist);
    // zipper line
    const zip = box(0.02, 0.4, 0.012, mat(0x3a4a6b, { metalness: 0.6, roughness: 0.3 }));
    zip.position.set(0, 0.32, 0.175);
    rig.torsoG.add(zip);
    // high collar
    const collar = cyl(0.155, 0.175, 0.14, jacket, 12);
    collar.position.set(0, 0.58, -0.01);
    rig.torsoG.add(collar);

    // head
    const head = sph(0.155, skin, 14, 12);
    head.scale.set(1, 1.08, 0.95);
    head.position.y = 0.15;
    rig.headG.add(head);
    // white spiky hair
    const hairCore = sph(0.165, hairM, 12, 10);
    hairCore.scale.set(1.02, 0.78, 1.02);
    hairCore.position.set(0, 0.29, -0.01);
    rig.headG.add(hairCore);
    const spikes = [
      [0, 0.42, 0, 0.09, 0.22, 0],
      [0.1, 0.4, 0.06, 0.07, 0.2, 0.3],
      [-0.1, 0.4, 0.06, 0.07, 0.2, -0.3],
      [0.09, 0.4, -0.08, 0.07, 0.18, 0.5],
      [-0.09, 0.4, -0.08, 0.07, 0.18, -0.5],
      [0, 0.4, 0.1, 0.07, 0.18, 0.15],
      [0, 0.38, -0.12, 0.08, 0.2, -0.2],
    ];
    for (const s of spikes) {
      const sp = cone(s[3], s[4], hairM);
      sp.position.set(s[0], s[1], s[2]);
      sp.rotation.z = s[5];
      sp.rotation.x = (s[2] > 0 ? 0.25 : -0.2);
      rig.headG.add(sp);
    }
    // Six Eyes — bright cyan
    const eyeL = sph(0.035, eyeM, 8, 6);
    eyeL.position.set(-0.065, 0.16, 0.135);
    rig.headG.add(eyeL);
    const eyeR = sph(0.035, eyeM, 8, 6);
    eyeR.position.set(0.065, 0.16, 0.135);
    rig.headG.add(eyeR);

    rig.root.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    return { rig: rig, group: rig.root, eyes: [eyeL, eyeR] };
  };

  /* ============ SUKUNA ============ */
  CharFactory.buildSukuna = function () {
    const rig = buildRig();
    const skin = mat(0xc98e5c);
    const tattoo = mat(0x1c1c1c, { roughness: 0.9 });
    const pantsM = mat(0xe6ddc4, { roughness: 0.9 });
    const hemM = mat(0x22201c);
    const shoe = mat(0x2a2118);
    const hairM = mat(0xe0707f, { roughness: 0.65 });
    const eyeM = mat(0xff4422, { emissive: 0xff3311, emissiveIntensity: 2.2 });

    limbMeshes(rig, skin, skin, skin, shoe, pantsM, pantsM);

    // tattoo rings on arms
    for (const side of ['L', 'R']) {
      const armRing = cyl(0.062, 0.062, 0.05, tattoo);
      armRing.position.y = -0.1;
      rig['arm' + side].add(armRing);
      const foreRing = cyl(0.052, 0.052, 0.045, tattoo);
      foreRing.position.y = -0.12;
      rig['fore' + side].add(foreRing);
    }

    // bare muscular torso (rounded)
    const chest = cap(0.215, 0.2, skin);
    chest.scale.set(1.42, 1, 0.88);
    chest.position.y = 0.38;
    rig.torsoG.add(chest);
    const abs = sph(0.185, skin, 12, 10);
    abs.scale.set(1.2, 0.95, 0.8);
    abs.position.y = 0.1;
    rig.torsoG.add(abs);
    // chest tattoo bands wrap the torso
    const tBand1 = cyl(0.232, 0.232, 0.032, tattoo, 16);
    tBand1.scale.set(1.4, 1, 0.87);
    tBand1.position.y = 0.46;
    rig.torsoG.add(tBand1);
    const tBand2 = cyl(0.183, 0.183, 0.028, tattoo, 16);
    tBand2.scale.set(1.2, 1, 0.79);
    tBand2.position.y = 0.16;
    rig.torsoG.add(tBand2);
    // belly band + rope belt
    const belt = cyl(0.195, 0.195, 0.13, mat(0xcbb9a2), 14);
    belt.scale.set(1.25, 1, 0.87);
    belt.position.y = -0.02;
    rig.torsoG.add(belt);
    const rope = cyl(0.202, 0.202, 0.05, mat(0x6b5a3e), 14);
    rope.scale.set(1.25, 1, 0.87);
    rope.position.y = -0.02;
    rig.torsoG.add(rope);
    // hakama hem marks
    for (const side of ['L', 'R']) {
      const hem = cyl(0.072, 0.072, 0.06, hemM);
      hem.position.y = -0.38;
      rig['shin' + side].add(hem);
    }

    // head
    const head = sph(0.155, skin, 14, 12);
    head.scale.set(1, 1.08, 0.95);
    head.position.y = 0.15;
    rig.headG.add(head);
    // short pink hair
    const hairCore = sph(0.16, hairM, 12, 10);
    hairCore.scale.set(1.02, 0.72, 1.02);
    hairCore.position.set(0, 0.29, -0.01);
    rig.headG.add(hairCore);
    const spikes = [
      [0.08, 0.38, 0.05, 0.06, 0.13, 0.35],
      [-0.08, 0.38, 0.05, 0.06, 0.13, -0.35],
      [0, 0.39, -0.04, 0.07, 0.14, 0],
      [0.1, 0.36, -0.09, 0.06, 0.12, 0.55],
      [-0.1, 0.36, -0.09, 0.06, 0.12, -0.55],
    ];
    for (const s of spikes) {
      const sp = cone(s[3], s[4], hairM);
      sp.position.set(s[0], s[1], s[2]);
      sp.rotation.z = s[5];
      rig.headG.add(sp);
    }
    // eyes (red)
    const eyeL = sph(0.035, eyeM, 8, 6);
    eyeL.position.set(-0.065, 0.16, 0.135);
    rig.headG.add(eyeL);
    const eyeR = sph(0.035, eyeM, 8, 6);
    eyeR.position.set(0.065, 0.16, 0.135);
    rig.headG.add(eyeR);
    // face markings: lines under eyes + cheeks, hugging the curved head
    const mkL = box(0.06, 0.016, 0.014, tattoo);
    mkL.position.set(-0.068, 0.1, 0.125);
    mkL.rotation.y = -0.35;
    rig.headG.add(mkL);
    const mkR = box(0.06, 0.016, 0.014, tattoo);
    mkR.position.set(0.068, 0.1, 0.125);
    mkR.rotation.y = 0.35;
    rig.headG.add(mkR);
    const mkCheekL = box(0.016, 0.085, 0.014, tattoo);
    mkCheekL.position.set(-0.108, 0.15, 0.095);
    mkCheekL.rotation.y = -0.7;
    rig.headG.add(mkCheekL);
    const mkCheekR = box(0.016, 0.085, 0.014, tattoo);
    mkCheekR.position.set(0.108, 0.15, 0.095);
    mkCheekR.rotation.y = 0.7;
    rig.headG.add(mkCheekR);
    // second pair of eye markings on forehead (true form nod)
    const fmkL = box(0.05, 0.014, 0.014, tattoo);
    fmkL.position.set(-0.055, 0.225, 0.115);
    fmkL.rotation.x = -0.25;
    rig.headG.add(fmkL);
    const fmkR = box(0.05, 0.014, 0.014, tattoo);
    fmkR.position.set(0.055, 0.225, 0.115);
    fmkR.rotation.x = -0.25;
    rig.headG.add(fmkR);

    rig.root.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    return { rig: rig, group: rig.root, eyes: [eyeL, eyeR] };
  };

  /* ============ ANIMATION ============ */
  // Poses map joint name -> [x, y, z] euler targets (radians).
  // Joints: body(pos y via _bodyY, rot), hips, torsoG, headG, armL, foreL, armR, foreR, legL, shinL, legR, shinR
  const ZERO = [0, 0, 0];

  function lerpAngle(a, b, k) { return a + (b - a) * k; }

  function applyPose(rig, pose, k, bodyY, bodyRotX) {
    const names = ['torsoG', 'headG', 'armL', 'foreL', 'armR', 'foreR', 'legL', 'shinL', 'legR', 'shinR'];
    for (const n of names) {
      const target = pose[n] || ZERO;
      const j = rig[n];
      j.rotation.x = lerpAngle(j.rotation.x, target[0], k);
      j.rotation.y = lerpAngle(j.rotation.y, target[1], k);
      j.rotation.z = lerpAngle(j.rotation.z, target[2], k);
    }
    rig.body.position.y = lerpAngle(rig.body.position.y, bodyY || 0, k);
    // body pitch base is tracked separately so overlay leans can be applied
    // absolutely on top (never additively into the lerp feedback loop)
    rig.userData.baseRotX = lerpAngle(rig.userData.baseRotX || 0, bodyRotX || 0, k);
    rig.body.rotation.x = rig.userData.baseRotX;
  }

  // idle poses differ per character
  function idlePose(charKey, t) {
    const sway = Math.sin(t * 1.8) * 0.03;
    if (charKey === 'gojo') {
      return {
        pose: {
          armL: [0.08 + sway, 0, 0.12],
          foreL: [-0.25, 0, 0],
          armR: [0.08 - sway, 0, -0.12],
          foreR: [-0.25, 0, 0],
          headG: [0, Math.sin(t * 0.7) * 0.08, 0],
          torsoG: [0.02, 0, 0],
        },
        bodyY: Math.sin(t * 2.2) * 0.015,
      };
    }
    return {
      pose: {
        armL: [0.25 + sway, 0, 0.35],
        foreL: [-0.6, 0, 0],
        armR: [0.25 - sway, 0, -0.35],
        foreR: [-0.6, 0, 0],
        headG: [0.05, Math.sin(t * 0.6) * 0.1, 0],
        torsoG: [0.06, 0, 0],
      },
      bodyY: Math.sin(t * 2.2) * 0.015,
    };
  }

  function runPose(t, speed, strafe, back) {
    const f = t * (back ? 7.5 : 9.5);
    const sn = Math.sin(f);
    const amp = back ? 0.55 : 1;
    const s = sn * 0.75 * speed * amp;
    return {
      pose: {
        legL: [s, 0, 0],
        shinL: [Math.max(0, -sn) * 1.0 * speed * amp, 0, 0],
        legR: [-s, 0, 0],
        shinR: [Math.max(0, sn) * 1.0 * speed * amp, 0, 0],
        armL: [-s * 0.8, 0, 0.08],
        foreL: [-0.5 - Math.max(0, sn) * 0.55 * speed * amp, 0, 0],
        armR: [s * 0.8, 0, -0.08],
        foreR: [-0.5 - Math.max(0, -sn) * 0.55 * speed * amp, 0, 0],
        torsoG: [back ? -0.06 : 0.2 * speed, strafe * 0.18, -strafe * 0.12],
        headG: [(back ? 0.02 : -0.1) + Math.abs(sn) * 0.05, 0, strafe * 0.06],
      },
      bodyY: Math.abs(sn) * 0.04 * speed * amp,
    };
  }

  const POSES = {
    jump: { pose: { legL: [-0.5, 0, 0], shinL: [1.1, 0, 0], legR: [-0.3, 0, 0], shinR: [0.8, 0, 0], armL: [-0.6, 0, 0.4], armR: [-0.6, 0, -0.4], torsoG: [0.1, 0, 0] }, bodyY: 0 },
    dash: { pose: { torsoG: [0.5, 0, 0], headG: [-0.3, 0, 0], armL: [0.9, 0, 0.2], armR: [0.9, 0, -0.2], legL: [-0.4, 0, 0], legR: [0.5, 0, 0], shinR: [0.6, 0, 0] }, bodyY: -0.08 },
    light1: { pose: { armR: [-1.55, 0, -0.05], foreR: [-0.1, 0, 0], armL: [0.3, 0, 0.3], foreL: [-1.2, 0, 0], torsoG: [0.15, -0.5, 0], headG: [0, 0.3, 0] }, bodyY: 0 },
    light2: { pose: { armL: [-1.55, 0, 0.05], foreL: [-0.1, 0, 0], armR: [0.3, 0, -0.3], foreR: [-1.2, 0, 0], torsoG: [0.15, 0.5, 0], headG: [0, -0.3, 0] }, bodyY: 0 },
    light3: { pose: { legR: [-1.5, 0, -0.15], shinR: [0.25, 0, 0], legL: [0.15, 0, 0], torsoG: [-0.25, 0.35, 0], armL: [-0.5, 0, 0.5], armR: [0.4, 0, -0.6] }, bodyY: 0.03 },
    heavy: { pose: { armR: [-2.6, 0, -0.3], foreR: [-0.35, 0, 0], armL: [0.5, 0, 0.4], foreL: [-0.9, 0, 0], torsoG: [-0.25, -0.35, 0], legL: [0.2, 0, 0], legR: [-0.2, 0, 0] }, bodyY: 0.02 },
    heavyHit: { pose: { armR: [-0.9, 0, -0.1], foreR: [-0.05, 0, 0], armL: [0.4, 0, 0.3], foreL: [-0.8, 0, 0], torsoG: [0.45, -0.2, 0], legL: [-0.3, 0, 0], legR: [0.35, 0, 0], shinR: [0.4, 0, 0] }, bodyY: -0.05 },
    guard: { pose: { armL: [-0.9, 0, 0.9], foreL: [-1.5, 0, 0], armR: [-0.9, 0, -0.9], foreR: [-1.5, 0, 0], torsoG: [0.18, 0, 0], headG: [0.15, 0, 0], legL: [0.15, 0, 0], legR: [-0.15, 0, 0] }, bodyY: -0.06 },
    infinity: { pose: { armR: [-1.2, 0, -0.35], foreR: [-0.45, 0, 0], armL: [0.1, 0, 0.15], foreL: [-0.3, 0, 0], torsoG: [0.04, -0.15, 0], headG: [0.02, 0.1, 0] }, bodyY: 0 },
    castForward: { pose: { armR: [-1.5, 0, -0.12], foreR: [-0.15, 0, 0], armL: [-0.7, 0, 0.35], foreL: [-1.15, 0, 0], torsoG: [0.1, -0.35, 0] }, bodyY: 0 },
    castCharge: { pose: { armR: [-1.15, 0, -0.55], foreR: [-0.7, 0, 0], armL: [-1.15, 0, 0.55], foreL: [-0.7, 0, 0], torsoG: [0.12, 0, 0], headG: [0.08, 0, 0] }, bodyY: -0.03 },
    slashR: { pose: { armR: [-1.3, 0, -1.2], foreR: [-0.15, 0, 0], armL: [0.35, 0, 0.4], torsoG: [0.1, -0.7, 0], headG: [0, 0.4, 0] }, bodyY: 0 },
    slashL: { pose: { armL: [-1.3, 0, 1.2], foreL: [-0.15, 0, 0], armR: [0.35, 0, -0.4], torsoG: [0.1, 0.7, 0], headG: [0, -0.4, 0] }, bodyY: 0 },
    bowDraw: { pose: { armL: [-1.5, 0, 0.05], foreL: [-0.1, 0, 0], armR: [-1.25, 0, -0.9], foreR: [-1.3, 0, 0], torsoG: [0.05, 0.5, 0], headG: [0, -0.5, 0] }, bodyY: 0 },
    domainSign: { pose: { armL: [-1.05, 0, 0.75], foreL: [-1.35, 0, 0.25], armR: [-1.05, 0, -0.75], foreR: [-1.35, 0, -0.25], torsoG: [0.1, 0, 0], headG: [0.28, 0, 0] }, bodyY: -0.04 },
    hitstun: { pose: { torsoG: [-0.35, 0.15, 0], headG: [-0.3, 0, 0], armL: [-0.7, 0, 0.7], foreL: [-0.6, 0, 0], armR: [-0.7, 0, -0.7], foreR: [-0.6, 0, 0], legL: [0.25, 0, 0], legR: [-0.35, 0, 0] }, bodyY: 0 },
    stunned: { pose: { torsoG: [0.3, 0, 0.08], headG: [0.45, 0.25, 0.15], armL: [0.35, 0, 0.25], foreL: [-0.15, 0, 0], armR: [0.35, 0, -0.25], foreR: [-0.15, 0, 0], legL: [0.1, 0, 0], legR: [-0.1, 0, 0] }, bodyY: -0.1 },
    knockdown: { pose: { armL: [-2.6, 0, 0.4], armR: [-2.6, 0, -0.4], legL: [-0.25, 0, 0], legR: [-0.4, 0, 0], shinL: [0.3, 0, 0], shinR: [0.5, 0, 0], headG: [-0.4, 0, 0] }, bodyY: 0, bodyRotX: -1.45 },
    victory: { pose: { armR: [-2.9, 0, -0.25], foreR: [-0.2, 0, 0], armL: [0.1, 0, 0.15], torsoG: [-0.08, 0, 0], headG: [-0.2, 0, 0] }, bodyY: 0 },
    // attack windups (anticipation frames)
    wind1: { pose: { armR: [0.45, 0, -0.5], foreR: [-1.7, 0, 0], armL: [-0.4, 0, 0.35], foreL: [-0.9, 0, 0], torsoG: [0.12, 0.5, 0], headG: [0, -0.28, 0], legL: [0.12, 0, 0], legR: [-0.12, 0, 0] }, bodyY: -0.04 },
    wind2: { pose: { armL: [0.45, 0, 0.5], foreL: [-1.7, 0, 0], armR: [-0.4, 0, -0.35], foreR: [-0.9, 0, 0], torsoG: [0.12, -0.5, 0], headG: [0, 0.28, 0], legL: [-0.12, 0, 0], legR: [0.12, 0, 0] }, bodyY: -0.04 },
    wind3: { pose: { legR: [0.45, 0, 0], shinR: [1.35, 0, 0], torsoG: [-0.18, 0.35, 0], armL: [-0.35, 0, 0.45], armR: [0.35, 0, -0.45], headG: [0.05, -0.15, 0] }, bodyY: -0.07 },
    // reverse cursed technique channel
    rct: { pose: { armL: [-0.85, 0, 0.62], foreL: [-1.5, 0, 0.28], armR: [-0.85, 0, -0.62], foreR: [-1.5, 0, -0.28], headG: [0.4, 0, 0], torsoG: [0.14, 0, 0], legL: [0.1, 0, 0], legR: [-0.1, 0, 0] }, bodyY: -0.05 },
  };

  // keyframed attack timelines: [tStart, poseName|null(=idle)|'@heavyFollow', blendSpeed]
  const CLIPS = {
    light1: [[0, 'wind1', 26], [0.06, 'light1', 36], [0.22, null, 12]],
    light2: [[0, 'wind2', 26], [0.06, 'light2', 36], [0.22, null, 12]],
    light3: [[0, 'wind3', 24], [0.1, 'light3', 32], [0.34, null, 10]],
    heavy: [[0, 'heavy', 15], [0.26, '@heavyFollow', 32], [0.5, null, 10]],
    dash: [[0, 'dash', 22]],
  };

  // secondary motion layered on top of the posed skeleton.
  // Leans/tumble are SMOOTHED STATE applied absolutely each frame — additive
  // writes here would integrate frame-over-frame and flip the model over.
  function overlays(f, rig, time, dt) {
    const kk = Math.min(1, dt * 7);
    // breathing
    rig.torsoG.scale.y = 1 + Math.sin(time * 2.2 + f.animSeed * 3) * 0.013;
    // lean into velocity (converted to fighter-local axes)
    const fx = Math.sin(f.facing), fz = Math.cos(f.facing);
    const vf = f.vel.x * fx + f.vel.z * fz;
    const vs = f.vel.x * fz - f.vel.z * fx;
    const targetLX = Math.max(-0.13, Math.min(0.13, vf * 0.016)) + (f.animBack ? -0.04 : 0);
    const targetLZ = Math.max(-0.1, Math.min(0.1, -vs * 0.012));
    f.leanX = (f.leanX || 0) + (targetLX - (f.leanX || 0)) * kk;
    f.leanZ = (f.leanZ || 0) + (targetLZ - (f.leanZ || 0)) * kk;
    rig.body.rotation.x = (rig.userData.baseRotX || 0) + f.leanX;
    rig.body.rotation.z = f.leanZ;
    // landing squash & stretch
    if (f.landT > 0) {
      f.landT -= dt;
      const sq = Math.sin(Math.max(0, f.landT) / 0.22 * Math.PI);
      rig.body.scale.set(1 + sq * 0.12, 1 - sq * 0.17, 1 + sq * 0.12);
    } else {
      rig.body.scale.set(1, 1, 1);
    }
    // tumble when launched airborne
    if (!f.onGround && (f.state === 'hitstun' || f.state === 'knockdown')) {
      f.tumble = (f.tumble || 0) + dt * 10;
    } else {
      f.tumble = (f.tumble || 0) * Math.max(0, 1 - dt * 8);
    }
    rig.body.rotation.y = f.tumble;
    // impact shiver while in hitstun
    if (f.state === 'hitstun') rig.torsoG.rotation.z += Math.sin(time * 45) * 0.035;
    // victory arm pump
    if (f.animName === 'victory') rig.armR.rotation.x += Math.sin(time * 7) * 0.07;
    // six eyes / king-of-curses glow flare
    const glow = 2.2 + (f.eyeGlow || 0) * 5;
    for (const e of f.model.eyes) e.material.emissiveIntensity = glow;
  }

  // f: fighter object from game.js
  CharFactory.animateFighter = function (f, time, dt) {
    const rig = f.model.rig;
    let k = Math.min(1, dt * 14);
    let entry = null;
    let bodyRotX = 0;

    const clip = f.action && CLIPS[f.action.name];
    if (clip) {
      let stage = clip[0];
      for (const st of clip) if (f.action.t >= st[0]) stage = st;
      let poseName = stage[1];
      if (poseName === '@heavyFollow') poseName = f.charKey === 'sukuna' ? 'slashR' : 'heavyHit';
      k = Math.min(1, dt * stage[2]);
      if (poseName === null) {
        entry = idlePose(f.charKey, time + f.animSeed);
      } else {
        const p = POSES[poseName];
        entry = p;
        if (p.bodyRotX) bodyRotX = p.bodyRotX;
      }
    } else {
      switch (f.animName) {
        case 'run': {
          entry = runPose(time + f.animSeed, Math.min(1, f.animSpeed), f.animStrafe || 0, f.animBack);
          break;
        }
        case 'idle':
          entry = idlePose(f.charKey, time + f.animSeed);
          break;
        default: {
          const p = POSES[f.animName] || idlePose(f.charKey, time + f.animSeed);
          entry = p.pose ? p : idlePose(f.charKey, time + f.animSeed);
          if (p.bodyRotX) bodyRotX = p.bodyRotX;
          break;
        }
      }
      if (f.animName === 'hitstun') k = Math.min(1, dt * 24);
    }
    applyPose(rig, entry.pose, k, entry.bodyY || 0, bodyRotX);
    overlays(f, rig, time, dt);
  };

  window.CharFactory = CharFactory;
})();
