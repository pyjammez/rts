(function registerAiProfiles(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before aiProfiles.js');
  app.ai = app.ai || {};

  const COMMON = {
    thinkInterval: 1.0,
    maxOrdersPerThink: 12,
    defenseRadius: 430,
    assaultRadius: 900,
    earlyAttackDelay: 4.0,
    waveInterval: 9.5,
    rallyDistance: 180,
    rallyTolerance: 90,
    castleUpgradeMaxLevel: 3
  };

  const PROFILES = Object.freeze({
    balanced: Object.freeze({
      id: 'balanced',
      name: 'Balanced',
      ...COMMON,
      attackReadiness: 3,
      defendWithKing: true
    }),
    rush: Object.freeze({
      id: 'rush',
      name: 'Rush',
      ...COMMON,
      earlyAttackDelay: 1.5,
      waveInterval: 6.5,
      attackReadiness: 2,
      defendWithKing: false,
      rangedRampartBias: 0.5
    }),
    turtle: Object.freeze({
      id: 'turtle',
      name: 'Turtle',
      ...COMMON,
      defenseRadius: 560,
      earlyAttackDelay: 9.0,
      waveInterval: 13.0,
      attackReadiness: 4,
      defendWithKing: true,
      rangedRampartBias: 1.4
    })
  });

  function getProfile(profileId = 'balanced') {
    return PROFILES[profileId] || PROFILES.balanced;
  }

  app.ai.data = app.ai.data || {};
  app.ai.data.profiles = PROFILES;
  app.ai.data.getProfile = getProfile;
})(globalThis);
