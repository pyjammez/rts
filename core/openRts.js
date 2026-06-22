(function initializeOpenRTS(root) {
  'use strict';

  const app = root.OpenRTS || {};
  app.version = app.version || '0.2.0';
  app.config = app.config || {};
  app.commands = app.commands || {};
  app.diagnostics = app.diagnostics || {};
  app.events = app.events || {};
  app.random = app.random || {};
  app.rendering = app.rendering || {};
  app.runtime = app.runtime || null;
  app.rules = app.rules || {};
  app.systems = app.systems || {};
  app.world = app.world || {};
  app.ui = app.ui || {};
  root.OpenRTS = app;
})(globalThis);
