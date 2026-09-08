const net = require('node:net');
const { validTarget } = require('./node-poller.cjs');

// ETC documents TCP 3032 as the Eos OSC service and TCP 3037 as the
// optional Third Party OSC service. Detection only opens the socket; it does
// not send OSC commands or change console state.
function probeTcp(ip, port, { connect = net.createConnection, timeoutMs = 1500 } = {}) {
  return new Promise(resolve => {
    let settled = false;
    const socket = connect({ host: ip, port });
    const finish = open => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

async function pollEtcConsole(ip, { probe = probeTcp, now = Date.now } = {}) {
  if (!validTarget(ip)) throw new RangeError('Unsupported console address.');
  const oscPort = await probe(ip, 3032) ? 3032 : await probe(ip, 3037) ? 3037 : null;
  if (!oscPort) throw new Error('ETC Eos OSC service was not detected.');
  return {
    ip, checkedAt: now(), responding: true, online: true, reachabilitySource: 'tcp',
    source: 'ETC Eos OSC', consoleBrand: 'ETC', consoleFamily: 'Eos Family', consoleServicePort: oscPort,
    name: `ETC Eos station ${ip}`, description: 'ETC Eos Family console', proplex: false,
    ports: [], subnetMask: null, firmwareCode: null, mac: '', sessionName: null, showFile: null, sessionStatus: null,
    metadataStatus: 'ETC console detected. MA Web Remote is not used for this device.',
    report: `ETC Eos OSC service responding on TCP ${oscPort}`,
    note: 'Active output universes are derived from received sACN and Art-Net. No OSC commands were sent.', error: '',
  };
}

module.exports = { probeTcp, pollEtcConsole };
