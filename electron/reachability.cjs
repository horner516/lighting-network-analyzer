const { execFile } = require('node:child_process');
const { validTarget } = require('./node-poller.cjs');

function createReachabilityProbe({ platform = process.platform, run = execFile } = {}) {
  return function pingAddress(ip) {
    if (!validTarget(ip)) return Promise.reject(new RangeError('Unsupported ping address.'));
    const args = platform === 'win32' ? ['-n', '4', '-w', '1000', ip] : ['-c', '4', '-i', '1', '-W', '1000', ip];
    return new Promise(resolve => {
      run('ping', args, { timeout: 6500, windowsHide: true }, error => resolve(!error));
    });
  };
}

module.exports = { createReachabilityProbe };
