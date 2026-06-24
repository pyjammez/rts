(function initializeOpenRTS(root) {
  'use strict';

  const app = root.OpenRTS || {};
  app.version = app.version || '0.2.0';
  app.ai = app.ai || {};
  app.config = app.config || {};
  app.commands = app.commands || {};
  app.commandIntents = app.commandIntents || {};
  app.diagnostics = app.diagnostics || {};
  app.events = app.events || {};
  app.random = app.random || {};
  app.rendering = app.rendering || {};
  app.runtime = app.runtime || null;
  app.rules = app.rules || {};
  app.simulation = app.simulation || {};
  app.systems = app.systems || {};
  app.testing = app.testing || {};
  app.world = app.world || {};
  app.ui = app.ui || {};
  root.OpenRTS = app;
})(globalThis);
