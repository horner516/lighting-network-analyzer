type PortAppearanceInput = { direction: string; active: boolean | null; error: string | null; inputProtocol: string | null; outputProtocol: string | null };

export function portAppearance(port: PortAppearanceInput) {
  const protocol = port.outputProtocol || port.inputProtocol;
  const configured = port.direction === 'IN' || port.direction === 'OUT';
  const fault = Boolean(port.error);
  const line = fault ? '#ff7068' : !configured ? '#84948b' : protocol === 'sACN' ? '#27df2d' : protocol === 'Art-Net' ? '#73b9fa' : protocol === 'Art-Net / sACN' ? '#64dfd1' : '#84948b';
  const text = fault ? '#ff7068' : !configured ? '#84948b' : protocol === 'sACN' ? '#41ec3c' : protocol === 'Art-Net' ? '#8bc6ff' : protocol === 'Art-Net / sACN' ? '#64dfd1' : '#84948b';
  // A configured OUT port (or traffic seen elsewhere on the LAN) is not proof of output.
  const liveOutput = port.direction === 'OUT' && port.active === true && !fault;
  return { line, text, liveOutput, shadow: liveOutput ? `0 0 9px ${line}55` : 'none' };
}
