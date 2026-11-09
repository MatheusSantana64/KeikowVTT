/** "hexForestBroadleaf00" vira "Forest Broadleaf". */
export function nomeAmigavel(id: string): string {
  return id
    .replace(/^hex/, '')
    .replace(/[_\d-]+$/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
}
