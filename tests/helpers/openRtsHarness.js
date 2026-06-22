import fs from 'node:fs';
import vm from 'node:vm';

export function loadOpenRTSScript(relativeUrl, additions = {}) {
  const context = {
    console,
    Math,
    Date,
    OpenRTS: { config: {}, diagnostics: {}, rendering: {}, rules: {}, systems: {}, world: {}, ui: {}, runtime: null },
    ...additions
  };
  context.globalThis = context;
  context.window = context;
  const source = fs.readFileSync(new URL(relativeUrl, import.meta.url), 'utf8');
  vm.runInNewContext(source, context, { filename: relativeUrl });
  return context;
}
