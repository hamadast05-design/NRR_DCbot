let stopped = false;
let stoppedAt = null;

function stop() {
  const changed = !stopped;
  stopped = true;
  if (changed) stoppedAt = Date.now();
  return { stopped, changed, stoppedAt };
}

function open() {
  const changed = stopped;
  stopped = false;
  stoppedAt = null;
  return { stopped, changed };
}

function isStopped() {
  return stopped;
}

module.exports = { stop, open, isStopped };
