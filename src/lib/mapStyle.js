// Estilo de MapView — FIX_ROUND_4 § 8: sale de tokens, con variante clara y
// oscura (antes fijo en oscuro, el mapa quedaba negro dentro de una pantalla
// crema en tema claro). road.highway y water no tienen token semántico
// equivalente — son paleta propia del mapa, igual que el #DCE6F2 sugerido.
export function buildMapStyle(colors, isDark) {
  const road    = isDark ? colors['bg.raised']   : colors['bg.surface'];
  const highway = isDark ? '#3D3650'             : colors['border.strong'];
  const water   = isDark ? '#0F0C18'             : '#DCE6F2';
  return [
    { elementType: 'geometry',           stylers: [{ color: colors['bg.base'] }] },
    { elementType: 'labels.text.fill',   stylers: [{ color: colors['text.tertiary'] }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: colors['bg.base'] }] },
    { featureType: 'road',               elementType: 'geometry',        stylers: [{ color: road }] },
    { featureType: 'road',               elementType: 'geometry.stroke', stylers: [{ color: colors['bg.base'] }] },
    { featureType: 'road.highway',       elementType: 'geometry',        stylers: [{ color: highway }] },
    { featureType: 'water',              elementType: 'geometry',        stylers: [{ color: water }] },
    { featureType: 'poi',                stylers: [{ visibility: 'off' }] },
    { featureType: 'transit',            stylers: [{ visibility: 'off' }] },
  ];
}
