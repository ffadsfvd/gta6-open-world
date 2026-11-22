// Every in-world sign and billboard of Ondaluz: hotels, shops, landmarks and the brands of the
// city. All names are invented for this game. `rows` 2 marks a billboard (twice as tall).

export const SIGNS = [
  { id: 'billCola', rows: 2, style: 'billboard', text: 'ONDALUZ COLA', sub: 'Sip the sun', bg: ['#ff5f6d', '#ffc371'], fg: '#ffffff', art: 'sun' },
  { id: 'billRadio', rows: 2, style: 'billboard', text: 'BRISA FM 101.7', sub: 'Hits that never set', bg: ['#2b5876', '#4e4376'], fg: '#ffe29a', art: 'wave' },
  { id: 'billPier', rows: 2, style: 'billboard', text: 'SUNWHEEL PIER', sub: 'Ride above the bay', bg: ['#00b4db', '#0083b0'], fg: '#ffffff', art: 'wheel' },
  { id: 'billBurger', rows: 2, style: 'billboard', text: 'PELICAN BURGER', sub: 'Big bird bites', bg: ['#f7971e', '#ffd200'], fg: '#7a1f00', art: 'burger' },
  { id: 'billBank', rows: 2, style: 'billboard', text: 'CONCH BANK', sub: 'Your money, sun-kissed', bg: ['#134e5e', '#71b280'], fg: '#ffffff', art: 'coin' },
  { id: 'billMotors', rows: 2, style: 'billboard', text: 'MARLIN MOTORS', sub: 'Drive the coast', bg: ['#cb356b', '#bd3f32'], fg: '#ffffff', art: 'wave' },
  { id: 'billSurf', rows: 2, style: 'billboard', text: 'SWELL RUNNER', sub: 'Surf wax since 1979', bg: ['#43cea2', '#185a9d'], fg: '#ffffff', art: 'sun' },
  { id: 'billNews', rows: 2, style: 'billboard', text: 'ONDALUZ GAZETTE', sub: 'All the scoops, every day', bg: ['#e6dada', '#274046'], fg: '#1d1d1d', art: 'coin' },
  { id: 'suncrest', style: 'neon', text: 'SUNCREST HOTEL', fg: '#ff6fb1' },
  { id: 'seashell', style: 'neon', text: 'SEASHELL APTS', fg: '#7ff3ff' },
  { id: 'azul', style: 'neon', text: 'HOTEL AZUL', fg: '#5ab8ff' },
  { id: 'perla', style: 'neon', text: 'LA PERLA', fg: '#fff3a3' },
  { id: 'flamingoInn', style: 'neon', text: 'FLAMINGO INN', fg: '#ff7ac8' },
  { id: 'mangoMoon', style: 'neon', text: 'MANGO MOON', fg: '#7dff9b' },
  { id: 'tropique', style: 'neon', text: 'CLUB TROPIQUE', fg: '#c38bff' },
  { id: 'cocoLoco', style: 'neon', text: 'COCO LOCO', fg: '#ffb35c' },
  { id: 'taco', style: 'panel', text: "LOU'S TACO OLA", bg: '#ffcf3f', fg: '#c2185b' },
  { id: 'cafe', style: 'panel', text: 'CAFE MAREA', bg: '#2e7d74', fg: '#fff6e0' },
  { id: 'surfShack', style: 'panel', text: 'SURF SHACK', bg: '#ff8a5c', fg: '#ffffff' },
  { id: 'pizza', style: 'panel', text: 'PIZZA PLAYA', bg: '#d62828', fg: '#fff3d1' },
  { id: 'burger', style: 'panel', text: 'PELICAN BURGER', bg: '#ffb703', fg: '#5a2a00' },
  { id: 'suds', style: 'panel', text: 'SUDS & SUN', bg: '#8ecae6', fg: '#023047' },
  { id: 'pharmacy', style: 'panel', text: 'JACARANDA PHARMACY', bg: '#2a9d8f', fg: '#ffffff' },
  { id: 'gym', style: 'panel', text: 'BAY GYM', bg: '#264653', fg: '#e9c46a' },
  { id: 'bank', style: 'panel', text: 'CONCH BANK', bg: '#1b4332', fg: '#d8f3dc' },
  { id: 'motors', style: 'panel', text: 'MARLIN MOTORS', bg: '#003049', fg: '#fcbf49' },
  { id: 'arms', style: 'panel', text: 'BAYSIDE ARMS', bg: '#3a3a3a', fg: '#ff9f1c' },
  { id: 'express', style: 'panel', text: 'PELICAN EXPRESS', bg: '#ffffff', fg: '#e76f51' },
  { id: 'garage', style: 'panel', text: "JUNO'S GARAGE", bg: '#14213d', fg: '#fca311' },
  { id: 'fuel', style: 'panel', text: 'FLAMINGO FUEL', bg: '#ff70a6', fg: '#ffffff' },
  { id: 'medical', style: 'panel', text: 'ST. AMARO MEDICAL', bg: '#ffffff', fg: '#d00000' },
  { id: 'police', style: 'panel', text: 'ONDALUZ BAY POLICE', bg: '#1d3557', fg: '#f1faee' },
  { id: 'fish', style: 'panel', text: 'IRONWHARF FISH CO.', bg: '#457b9d', fg: '#f1faee' },
  { id: 'crane', style: 'panel', text: 'CRANE SHIPPING', bg: '#9d0208', fg: '#ffba08' },
  { id: 'gazette', style: 'panel', text: 'ONDALUZ GAZETTE', bg: '#f8f9fa', fg: '#212529' },
  { id: 'mercado', style: 'panel', text: 'MERCADO PLAZA', bg: '#e76f51', fg: '#fff8e7' },
  { id: 'glasswater', style: 'neon', text: 'GLASSWATER ONE', fg: '#b8f1ff' },
  { id: 'wheel', style: 'neon', text: 'SUNWHEEL', fg: '#ffd166' },
  { id: 'bodega', style: 'panel', text: 'BODEGA DEL SOL', bg: '#f4a261', fg: '#3d1f00' },
  { id: 'books', style: 'panel', text: 'PAGE & PELICAN BOOKS', bg: '#6d597a', fg: '#ffeedd' },
  { id: 'icecream', style: 'panel', text: 'GELATO GULL', bg: '#ffc8dd', fg: '#7b2cbf' },
  { id: 'records', style: 'panel', text: 'WAVELENGTH RECORDS', bg: '#22223b', fg: '#f2e9e4' },
];

export const DECO_SIGNS = ['azul', 'perla', 'flamingoInn', 'mangoMoon', 'tropique', 'cocoLoco'];
export const SHOP_SIGNS = ['cafe', 'surfShack', 'pizza', 'burger', 'suds', 'pharmacy', 'gym', 'bank', 'bodega', 'books', 'icecream', 'records', 'motors', 'gazette'];
export const DOCK_SIGNS = ['fish', 'crane', 'express'];
export const BILLBOARDS = ['billCola', 'billRadio', 'billPier', 'billBurger', 'billBank', 'billMotors', 'billSurf', 'billNews'];
