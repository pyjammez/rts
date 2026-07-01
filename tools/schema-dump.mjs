import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = {
  OpenRTS: { config: {} }
};
context.globalThis = context;
context.window = context;

const source = fs.readFileSync(path.join(root, 'game/config/ContentSchemaService.js'), 'utf8');
vm.runInNewContext(source, context, { filename: 'ContentSchemaService.js' });

const schemas = context.OpenRTS.config.contentSchemas.listSchemas();

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ schemaVersion: 1, schemas }, null, 2));
} else {
  const lines = ['# Open RTS Content Schemas', ''];
  for (const schema of schemas) {
    lines.push(`## ${schema.label}`);
    lines.push('');
    lines.push('| Field | Type | Required | Rules |');
    lines.push('| --- | --- | --- | --- |');
    for (const [field, rule] of Object.entries(schema.fields)) {
      const rules = [
        Array.isArray(rule.values) ? `values: ${rule.values.join(', ')}` : '',
        rule.min !== undefined ? `min: ${rule.min}` : '',
        rule.max !== undefined ? `max: ${rule.max}` : ''
      ].filter(Boolean).join('; ');
      lines.push(`| ${field} | ${rule.type} | ${rule.required ? 'yes' : 'no'} | ${rules || ''} |`);
    }
    lines.push('');
  }
  console.log(lines.join('\n'));
}
