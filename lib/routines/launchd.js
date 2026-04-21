import { writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';

const LABEL_PREFIX = 'com.polyforge.routine.';
const AGENT_DIR = resolve(homedir(), 'Library', 'LaunchAgents');

function parseCronField(field, min, max) {
  if (field === '*') return null;
  if (/^\d+$/.test(field)) {
    const n = Number(field);
    if (n < min || n > max) throw new Error(`cron field out of range: ${field}`);
    return [n];
  }
  if (field.includes(',')) return field.split(',').map(Number);
  throw new Error(`unsupported cron field syntax: ${field} (only * and fixed numbers supported)`);
}

export function cronToCalendarInterval(cron) {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`invalid cron: ${cron}`);
  const [minute, hour, dom, month, dow] = parts;
  const interval = {};
  const m = parseCronField(minute, 0, 59);
  const h = parseCronField(hour, 0, 23);
  const w = parseCronField(dow, 0, 6);
  if (m && m.length === 1) interval.Minute = m[0];
  if (h && h.length === 1) interval.Hour = h[0];
  if (w && w.length === 1) interval.Weekday = w[0];
  if (Object.keys(interval).length === 0) throw new Error(`cron "${cron}" has no fixed fields — need at least Minute or Hour`);
  return interval;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function plistXml(label, program, args, calendarInterval, exitTimeout, logDir) {
  const stdout = resolve(logDir, `${label}.out.log`);
  const stderr = resolve(logDir, `${label}.err.log`);
  const ciXml = Object.entries(calendarInterval)
    .map(([k, v]) => `    <key>${escapeXml(k)}</key><integer>${v}</integer>`)
    .join('\n');
  const argsXml = args.map(a => `    <string>${escapeXml(a)}</string>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${escapeXml(label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(program)}</string>
${argsXml}
  </array>
  <key>StartCalendarInterval</key>
  <dict>
${ciXml}
  </dict>
  <key>ExitTimeOut</key><integer>${exitTimeout}</integer>
  <key>StandardOutPath</key><string>${escapeXml(stdout)}</string>
  <key>StandardErrorPath</key><string>${escapeXml(stderr)}</string>
  <key>RunAtLoad</key><false/>
</dict>
</plist>
`;
}

export function installRoutinePlist({ routineName, runnerPath, projectRoot, schedule, exitTimeoutSeconds = 5400 }) {
  const label = `${LABEL_PREFIX}${routineName}`;
  const interval = cronToCalendarInterval(schedule);
  const logDir = resolve(homedir(), '.polyforge', 'launchd-logs');
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  const xml = plistXml(label, '/bin/bash', [runnerPath, routineName, projectRoot], interval, exitTimeoutSeconds, logDir);
  if (!existsSync(AGENT_DIR)) mkdirSync(AGENT_DIR, { recursive: true });
  const path = resolve(AGENT_DIR, `${label}.plist`);
  writeFileSync(path, xml);
  return { label, path };
}

export function uninstallRoutinePlist(routineName) {
  const label = `${LABEL_PREFIX}${routineName}`;
  const path = resolve(AGENT_DIR, `${label}.plist`);
  let unloadError = null;
  try {
    execFileSync('launchctl', ['unload', path], { stdio: 'pipe' });
  } catch (e) {
    unloadError = e.message;
  }
  if (existsSync(path)) unlinkSync(path);
  return { label, path, unloadError };
}

export function listInstalledPlists() {
  if (!existsSync(AGENT_DIR)) return [];
  return readdirSync(AGENT_DIR)
    .filter(f => f.startsWith(LABEL_PREFIX) && f.endsWith('.plist'))
    .map(f => ({
      label: f.replace(/\.plist$/, ''),
      routineName: f.replace(LABEL_PREFIX, '').replace(/\.plist$/, ''),
      path: resolve(AGENT_DIR, f),
    }));
}

export { LABEL_PREFIX, AGENT_DIR };
