export function moveDevice(order: string[], ip: string, target: string): string[] {
  const from = order.indexOf(ip), to = order.indexOf(target);
  if (from < 0 || to < 0 || from === to) return order;
  const next = [...order];
  next.splice(from, 1); next.splice(to, 0, ip);
  return next;
}
