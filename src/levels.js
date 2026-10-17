// Level definitions. Each level is a list of sections laid out one after another along the
// boulevard. Distances (d) are metres from the start line; world z = -d.

export const LANES = [-6, -2, 2, 6]; // 0,1 oncoming | 2,3 our direction

export const LEVELS = [
  {
    id: 1,
    name: 'Primer Arranque',
    desc: 'Aprende a controlar el Roadster: aceleración brutal, propulsores y saltos.',
    theme: 'day',
    sections: [
      ['plain', { len: 90 }],
      ['barrier', { lanes: [2, 3] }],
      ['cells', { pattern: 'line', lane: 1, count: 6 }],
      ['barrier', { lanes: [0, 1, 2, 3] }],
      ['intersection', {}],
      ['pothole', { lanes: [1, 2], len: 7 }],
      ['checkpoint'],
      ['cones', {}],
      ['barrier', { lanes: [0, 1, 2, 3] }],
      ['cells', { pattern: 'arc', lane: 2 }],
      ['sinkhole', { len: 12 }],
      ['checkpoint'],
      ['traffic', { count: 4 }],
      ['intersection', {}],
      ['pothole', { lanes: [0, 3], len: 6 }],
      ['pothole', { lanes: [1, 2], len: 6, gap: 30 }],
      ['barrier', { lanes: [0, 1, 2, 3] }],
      ['plain', { len: 40 }],
    ],
    hints: [
      { d: 5, text: 'Mantén <b>W</b> / <b>↑</b> para acelerar — 0 a 100 km/h en menos de 2 s' },
      { d: 160, text: 'Gira con <b>A</b> / <b>D</b> para esquivar' },
      { d: 300, text: 'Barrera completa: pulsa <b>ESPACIO</b> para saltar con los propulsores' },
      { d: 520, text: 'Los huecos se tragan las ruedas. ¡Salta por encima!' },
      { d: 800, text: 'Mantén <b>ESPACIO</b> en el aire para flotar más tiempo' },
      { d: 1000, text: '<b>SHIFT</b> activa el propulsor trasero para más velocidad' },
    ],
  },
  {
    id: 2,
    name: 'Hora Pico',
    desc: 'El centro está colapsado. Atraviesa trancones y tráfico en contravía.',
    theme: 'day',
    sections: [
      ['plain', { len: 60 }],
      ['traffic', { count: 6 }],
      ['jam', { rows: 1 }],
      ['intersection', { cross: true }],
      ['oncoming', { count: 5 }],
      ['checkpoint'],
      ['jam', { rows: 2 }],
      ['traffic', { count: 7 }],
      ['truck', { lanes: [2, 3] }],
      ['intersection', { cross: true }],
      ['checkpoint'],
      ['jam', { rows: 3, bus: true }],
      ['oncoming', { count: 6, wrongWay: true }],
      ['pothole', { lanes: [0, 1, 2], len: 8 }],
      ['intersection', { cross: true }],
      ['checkpoint'],
      ['traffic', { count: 8 }],
      ['jam', { rows: 2, bus: true }],
      ['sinkhole', { len: 14 }],
      ['plain', { len: 40 }],
    ],
    hints: [
      { d: 5, text: 'Hora pico: salta sobre los carros detenidos' },
      { d: 300, text: 'Intersección: ¡cuidado con el tráfico cruzado!' },
      { d: 1100, text: 'Los camiones son altos: mantén <b>ESPACIO</b> para ganar altura' },
    ],
  },
  {
    id: 3,
    name: 'Cruce Peatonal',
    desc: 'Festival en la ciudad. Hay peatones por todas partes: nunca los toques.',
    theme: 'sunset',
    sections: [
      ['plain', { len: 60 }],
      ['intersection', { crowd: 'walk' }],
      ['traffic', { count: 4 }],
      ['parade', {}],
      ['checkpoint'],
      ['intersection', { crowd: 'walk', cross: true }],
      ['pothole', { lanes: [2, 3], len: 7 }],
      ['jam', { rows: 1 }],
      ['parade', { big: true }],
      ['checkpoint'],
      ['intersection', { crowd: 'walk' }],
      ['oncoming', { count: 5 }],
      ['sinkhole', { len: 14 }],
      ['intersection', { crowd: 'walk', cross: true }],
      ['checkpoint'],
      ['parade', { big: true }],
      ['jam', { rows: 2 }],
      ['plain', { len: 40 }],
    ],
    hints: [
      { d: 5, text: 'Atardecer en el festival: salta sobre los peatones, nunca los atropelles' },
      { d: 400, text: 'Desfile bloqueando la vía: ¡propulsores!' },
    ],
  },
  {
    id: 4,
    name: 'El Arroyo',
    desc: 'La tormenta destruyó los puentes. Vuela sobre arroyos y socavones.',
    theme: 'sunset',
    sections: [
      ['plain', { len: 80 }],
      ['creek', { width: 18 }],
      ['cells', { pattern: 'arc', lane: 2 }],
      ['sinkhole', { len: 12 }],
      ['checkpoint'],
      ['creek', { width: 26 }],
      ['traffic', { count: 5 }],
      ['pothole', { lanes: [0, 1], len: 8 }],
      ['pothole', { lanes: [2, 3], len: 8, gap: 25 }],
      ['checkpoint'],
      ['jam', { rows: 1 }],
      ['creek', { width: 34, gap: 30 }],
      ['intersection', { crowd: 'walk' }],
      ['checkpoint'],
      ['sinkhole', { len: 16, gap: 110 }],
      ['creek', { width: 44 }],
      ['plain', { len: 40 }],
    ],
    hints: [
      { d: 5, text: 'Puentes caídos: acelera y salta antes del borde' },
      { d: 600, text: 'Arroyo ancho: combina <b>ESPACIO</b> + <b>SHIFT</b> para planear' },
    ],
  },
  {
    id: 5,
    name: 'Neón Nocturno',
    desc: 'La ciudad nunca duerme. Tráfico, peatones y huecos bajo luces de neón.',
    theme: 'night',
    sections: [
      ['plain', { len: 60 }],
      ['traffic', { count: 6 }],
      ['intersection', { cross: true }],
      ['jam', { rows: 2, bus: true }],
      ['pothole', { lanes: [1, 2, 3], len: 8 }],
      ['checkpoint'],
      ['oncoming', { count: 7, wrongWay: true }],
      ['intersection', { crowd: 'walk', cross: true }],
      ['truck', { lanes: [0, 1, 2, 3] }],
      ['checkpoint'],
      ['creek', { width: 30 }],
      ['parade', { big: true }],
      ['cones', {}],
      ['jam', { rows: 3 }],
      ['checkpoint'],
      ['intersection', { cross: true }],
      ['sinkhole', { len: 16 }],
      ['traffic', { count: 8 }],
      ['creek', { width: 38 }],
      ['plain', { len: 40 }],
    ],
    hints: [{ d: 5, text: 'Noche de neón: las luces altas se encienden solas' }],
  },
  {
    id: 6,
    name: 'Paquete SpaceX',
    desc: 'La prueba final. Todo a la vez y un río de 60 m. Solo para pilotos Plaid.',
    theme: 'night',
    sections: [
      ['plain', { len: 60 }],
      ['jam', { rows: 2, bus: true, gap: 110 }],
      ['intersection', { crowd: 'walk', cross: true }],
      ['creek', { width: 32 }],
      ['checkpoint'],
      ['oncoming', { count: 8, wrongWay: true }],
      ['truck', { lanes: [0, 1, 2, 3] }],
      ['pothole', { lanes: [0, 1, 2], len: 9 }],
      ['parade', { big: true }],
      ['checkpoint'],
      ['traffic', { count: 9 }],
      ['intersection', { cross: true, crowd: 'walk' }],
      ['sinkhole', { len: 18 }],
      ['jam', { rows: 3, bus: true }],
      ['checkpoint'],
      ['creek', { width: 46 }],
      ['truck', { lanes: [0, 1, 2, 3] }],
      ['intersection', { cross: true }],
      ['checkpoint'],
      ['cells', { pattern: 'high', lane: 2 }],
      ['creek', { width: 62 }],
      ['plain', { len: 50 }],
    ],
    hints: [{ d: 1500, text: 'Río de 60 m: velocidad máxima, salta y planea con <b>ESPACIO</b> + <b>SHIFT</b>' }],
  },
];

const DEFAULT_GAP = 75;

function sectionLength(type, o) {
  switch (type) {
    case 'plain': return o.len || 60;
    case 'barrier': return 4;
    case 'cones': return 60;
    case 'pothole': return o.len || 6;
    case 'sinkhole': return o.len || 12;
    case 'creek': return o.width || 20;
    case 'jam': return (o.rows || 1) * 8;
    case 'traffic': return 140;
    case 'oncoming': return 160;
    case 'truck': return 12;
    case 'parade': return o.big ? 14 : 8;
    case 'intersection': return 16;
    case 'cells': return 40;
    default: return 10;
  }
}

// Turn a level definition into concrete placed items.
export function layoutLevel(level) {
  let d = 120;
  const items = [];
  const checkpoints = [0];
  const intersections = [];
  const holes = [];
  for (const [type, opts = {}] of level.sections) {
    if (type === 'checkpoint') {
      d += 20;
      checkpoints.push(d);
      d += 50;
      continue;
    }
    const len = sectionLength(type, opts);
    const gap = opts.gap ?? (type === 'plain' || type === 'cells' ? 10 : DEFAULT_GAP);
    const it = { type, d, len, ...opts };
    items.push(it);
    if (type === 'intersection') intersections.push(d + 8);
    if (type === 'pothole') {
      for (const lane of opts.lanes) {
        const x = (lane - 1.5) * 4; // lane centres -6,-2,2,6
        holes.push({ x0: x - 2, x1: x + 2, d0: d, d1: d + len, kind: 'pit' });
      }
    }
    if (type === 'sinkhole') holes.push({ x0: -8.2, x1: 8.2, d0: d, d1: d + len, kind: 'pit' });
    if (type === 'creek') holes.push({ x0: -5000, x1: 5000, d0: d, d1: d + len, kind: 'creek' });
    d += len + gap;
  }
  const length = d + 30;
  // merge adjacent pothole lanes into single rectangles
  holes.sort((a, b) => a.d0 - b.d0 || a.x0 - b.x0);
  const merged = [];
  for (const h of holes) {
    const last = merged[merged.length - 1];
    if (last && last.kind === h.kind && last.d0 === h.d0 && last.d1 === h.d1 && Math.abs(last.x1 - h.x0) < 0.01) last.x1 = h.x1;
    else merged.push({ ...h });
  }
  const par = Math.round(length / 34);
  const timeLimit = Math.round(length / 20 + 20);
  return { level, items, checkpoints, intersections, holes: merged, length, par, timeLimit };
}
