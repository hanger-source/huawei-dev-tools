/*
 * Copyright (c) 2026 Huawei Device Co., Ltd.
 * SPDX-License-Identifier: MIT
 */
import { randomUUID } from 'node:crypto';
import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const releases = new Set();
process.once('exit', () => {
  for (const release of releases) release();
});
for (const [signal, code] of [
  ['SIGINT', 130],
  ['SIGTERM', 143],
]) {
  process.once(signal, () => {
    for (const release of releases) release();
    process.exit(code);
  });
}
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    if (error.code === 'EPERM') return true;
    throw error;
  }
}
function discardDeadLegacyLock(file, info) {
  if (!info.isFile() || info.size > 4096)
    throw new Error(`Invalid Controller lock: ${file}`);
  const text = readFileSync(file, 'utf8').trim();
  if (
    !/^[1-9][0-9]*$/.test(text) ||
    !Number.isSafeInteger(Number(text)) ||
    alive(Number(text))
  ) {
    throw new Error(`Controller lock is active or cannot be verified: ${file}`);
  }
  const current = lstatSync(file);
  if (
    current.dev !== info.dev ||
    current.ino !== info.ino ||
    readFileSync(file, 'utf8').trim() !== text
  ) {
    throw new Error(`Controller lock changed: ${file}`);
  }
  unlinkSync(file);
}
/** Unique owner claims avoid unlinking another request's replacement lock. */
export function acquireFileLock(directory) {
  if (realpathSync(dirname(directory)) !== resolve(dirname(directory)))
    throw new Error('Lock parent must not contain symlinks.');
  const previous = lstatSync(directory, { throwIfNoEntry: false });
  if (previous && !previous.isDirectory())
    discardDeadLegacyLock(directory, previous);
  mkdirSync(directory, { recursive: true });
  if (realpathSync(directory) !== resolve(directory))
    throw new Error('Lock directory must not contain symlinks.');
  const own = `${process.pid}-${randomUUID()}.lock`;
  const claim = join(directory, own);
  writeFileSync(claim, own, { flag: 'wx', mode: 0o600 });
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    releases.delete(release);
    try {
      unlinkSync(claim);
    } catch (error) {
      // Windows 可能短暂占用句柄；残留由下次 acquire 回收
      if (!['ENOENT', 'EPERM', 'EBUSY'].includes(error.code)) throw error;
    }
    try {
      rmdirSync(directory);
    } catch (error) {
      if (
        !['ENOENT', 'ENOTEMPTY', 'EEXIST', 'EPERM', 'EBUSY'].includes(
          error.code
        )
      )
        throw error;
    }
  };
  releases.add(release);
  try {
    for (const name of readdirSync(directory)) {
      if (name === own) continue;
      const match =
        /^([1-9][0-9]*)-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.lock$/.exec(
          name
        );
      if (!match || !Number.isSafeInteger(Number(match[1])))
        throw new Error(`Unknown lock owner: ${name}`);
      const file = join(directory, name);
      const info = lstatSync(file, { throwIfNoEntry: false });
      if (!info) continue;
      if (!info.isFile())
        throw new Error('Lock claims must be regular files without symlinks.');
      if (alive(Number(match[1])))
        throw new Error(
          `Skill Controller lock is already active: ${directory}`
        );
      try {
        if (info.size > 512 || readFileSync(file, 'utf8') !== name)
          throw new Error(
            'Invalid stale lock claim; inspect it before retrying.'
          );
        unlinkSync(file);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    return release;
  } catch (error) {
    release();
    throw error;
  }
}
