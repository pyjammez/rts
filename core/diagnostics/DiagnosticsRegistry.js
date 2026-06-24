(function registerDiagnosticsRegistry(root) {
  'use strict';

  const app = root.OpenRTS;
  if (!app) throw new Error('OpenRTS must be initialized before DiagnosticsRegistry.js');

  const reporters = new Map();

  function assertReporter(id, reporter) {
    if (typeof id !== 'string' || !id) throw new TypeError('Diagnostic reporter id must be a non-empty string');
    if (typeof reporter !== 'function') throw new TypeError(`Diagnostic reporter "${id}" must be a function`);
  }

  function cloneSerializable(value) {
    try {
      return JSON.parse(JSON.stringify(value ?? null));
    } catch (error) {
      return {
        status: 'error',
        error: `Reporter returned non-serializable data: ${error.message}`
      };
    }
  }

  function register(id, reporter) {
    assertReporter(id, reporter);
    if (reporters.has(id)) throw new Error(`Diagnostic reporter already registered: ${id}`);
    reporters.set(id, reporter);
    return () => reporters.delete(id);
  }

  function runReporter(id, reporter) {
    try {
      return cloneSerializable(reporter());
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  function report() {
    const sections = {};
    for (const [id, reporter] of reporters) {
      sections[id] = runReporter(id, reporter);
    }
    return Object.freeze({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      appVersion: app.version || null,
      reporterCount: reporters.size,
      sections: Object.freeze(sections)
    });
  }

  function listReporters() {
    return Object.freeze([...reporters.keys()].sort());
  }

  function clear() {
    reporters.clear();
  }

  const registry = Object.freeze({
    register,
    report,
    listReporters,
    clear
  });

  app.diagnostics = app.diagnostics || {};
  app.diagnostics.registry = registry;
  app.diagnostics.register = register;
  app.diagnostics.report = report;
  app.diagnostics.listReporters = listReporters;
  app.runtime?.registerService('diagnostics', registry);
})(globalThis);
