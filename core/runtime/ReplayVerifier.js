(function registerReplayVerifier(root) {
  const app = root.OpenRTS = root.OpenRTS || {};
  app.runtime = app.runtime || {};

  function verifyChecksums({ initialSnapshot, finalSnapshot, expectedChecksum, checksum } = {}) {
    const checksumFn = checksum || app.diagnostics?.simulation?.checksum;
    if (!checksumFn) throw new Error('Replay verification requires a checksum function');
    const initialChecksum = initialSnapshot ? checksumFn(initialSnapshot) : null;
    const finalChecksum = checksumFn(finalSnapshot);
    return Object.freeze({
      schemaVersion: 1,
      initialChecksum,
      finalChecksum,
      expectedChecksum: expectedChecksum || null,
      matched: expectedChecksum ? finalChecksum === expectedChecksum : true
    });
  }

  app.runtime.replayVerifier = Object.freeze({
    verifyChecksums
  });
  app.runtime.registerService?.('replay-verifier', app.runtime.replayVerifier);
})(globalThis);
