/**
 * Points of Interest database.
 * All images are bundled locally in /public/poi/.
 * Fonts loaded via @fontsource/jetbrains-mono (no CDN).
 *
 * HQ locations configurable via VITE_HQ_LOCATIONS env variable.
 * Format: name|lat|lon|alt|city;name2|lat2|lon2|alt2|city2
 */
import type { POI } from '../store'

// ── HQ Locations from env (configurable) ──

const DEFAULT_HQ: POI[] = [
  {
    name: 'Kärnten Funkt HQ',
    lat: 46.6103, lon: 13.8558, alt: 5000, city: 'Villach', isHQ: true,
    desc: 'Globo Plaza Hotel, Villach — Operations Center',
    image: '/kaernten-funkt-logo.svg',
  },
]

function parseHQFromEnv(): POI[] {
  const raw = import.meta.env.VITE_HQ_LOCATIONS
  if (!raw || typeof raw !== 'string') return DEFAULT_HQ

  try {
    return raw.split(';').map(entry => {
      const [name, lat, lon, alt, city] = entry.split('|').map(s => s.trim())
      return {
        name,
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        alt: parseFloat(alt) || 5000,
        city: city || name,
        isHQ: true,
      }
    }).filter(p => !isNaN(p.lat) && !isNaN(p.lon) && p.name)
  } catch {
    console.warn('[POI] Failed to parse VITE_HQ_LOCATIONS, using defaults')
    return DEFAULT_HQ
  }
}

export const HQ_LOCATIONS: POI[] = parseHQFromEnv()

// ── Standard POI Database ──

const STANDARD_POIS: POI[] = [
  // New York
  { name: 'Empire State Building', lat: 40.7484, lon: -73.9857, alt: 3000, city: 'New York',
    image: '/poi/empire_state_building.jpg', desc: '102-floor Art Deco skyscraper, 443m' },
  { name: 'Statue of Liberty', lat: 40.6892, lon: -74.0445, alt: 4000, city: 'New York',
    image: '/poi/statue_of_liberty.jpg', desc: 'Neoclassical copper sculpture, Liberty Island' },
  { name: 'One World Trade Center', lat: 40.7127, lon: -74.0134, alt: 3000, city: 'New York',
    image: '/poi/one_world_trade.jpg', desc: 'Tallest building in Western Hemisphere, 541m' },
  { name: 'Central Park', lat: 40.7829, lon: -73.9654, alt: 8000, city: 'New York',
    image: '/poi/central_park.jpg', desc: 'Urban park spanning 843 acres in Manhattan' },
  { name: 'Brooklyn Bridge', lat: 40.7061, lon: -73.9969, alt: 3000, city: 'New York',
    image: '/poi/brooklyn_bridge.jpg', desc: 'Hybrid cable-stayed suspension bridge, 1883' },
  { name: 'Times Square', lat: 40.7580, lon: -73.9855, alt: 2500, city: 'New York',
    image: '/poi/times_square.jpg', desc: 'Major commercial intersection and tourist hub' },
  { name: 'UN Headquarters', lat: 40.7489, lon: -73.9680, alt: 3000, city: 'New York',
    image: '/poi/un_headquarters.jpg', desc: 'United Nations complex on the East River' },

  // London
  { name: 'Big Ben', lat: 51.5007, lon: -0.1246, alt: 2500, city: 'London',
    image: '/poi/big_ben.jpg', desc: 'Elizabeth Tower at Palace of Westminster, 96m' },
  { name: 'Tower of London', lat: 51.5081, lon: -0.0759, alt: 2500, city: 'London',
    image: '/poi/tower_of_london.jpg', desc: 'Historic castle and fortress, founded 1066' },
  { name: 'Buckingham Palace', lat: 51.5014, lon: -0.1419, alt: 3000, city: 'London',
    image: '/poi/buckingham_palace.jpg', desc: 'London residence of the British monarch' },
  { name: 'The Shard', lat: 51.5045, lon: -0.0865, alt: 3000, city: 'London',
    image: '/poi/the_shard.jpg', desc: 'Supertall skyscraper, 310m — tallest in UK' },
  { name: 'London Eye', lat: 51.5033, lon: -0.1195, alt: 2500, city: 'London',
    image: '/poi/london_eye.jpg', desc: 'Giant observation wheel on South Bank, 135m' },
  { name: 'Tower Bridge', lat: 51.5055, lon: -0.0754, alt: 2000, city: 'London',
    image: '/poi/tower_bridge.jpg', desc: 'Combined bascule and suspension bridge, 1894' },

  // Tokyo
  { name: 'Tokyo Tower', lat: 35.6586, lon: 139.7454, alt: 3000, city: 'Tokyo',
    image: '/poi/tokyo_tower.jpg', desc: 'Communications and observation tower, 333m' },
  { name: 'Tokyo Skytree', lat: 35.7101, lon: 139.8107, alt: 4000, city: 'Tokyo',
    image: '/poi/tokyo_skytree.jpg', desc: 'Broadcasting tower, 634m — tallest in Japan' },
  { name: 'Shibuya Crossing', lat: 35.6595, lon: 139.7004, alt: 2000, city: 'Tokyo',
    image: '/poi/shibuya_crossing.jpg', desc: 'World-famous scramble intersection' },
  { name: 'Imperial Palace', lat: 35.6852, lon: 139.7528, alt: 5000, city: 'Tokyo',
    image: '/poi/imperial_palace.jpg', desc: 'Primary residence of the Emperor of Japan' },
  { name: 'Senso-ji Temple', lat: 35.7148, lon: 139.7967, alt: 2000, city: 'Tokyo',
    image: '/poi/sensoji.jpg', desc: 'Ancient Buddhist temple in Asakusa, founded 645' },

  // Dubai
  { name: 'Burj Khalifa', lat: 25.1972, lon: 55.2744, alt: 5000, city: 'Dubai',
    image: '/poi/burj_khalifa.jpg', desc: 'Tallest building in the world, 828m' },
  { name: 'Palm Jumeirah', lat: 25.1124, lon: 55.1390, alt: 15000, city: 'Dubai',
    image: '/poi/palm_jumeirah.jpg', desc: 'Artificial archipelago in the shape of a palm tree' },
  { name: 'Burj Al Arab', lat: 25.1412, lon: 55.1852, alt: 3000, city: 'Dubai',
    image: '/poi/burj_al_arab.jpg', desc: 'Luxury hotel on artificial island, 321m' },
  { name: 'Dubai Frame', lat: 25.2350, lon: 55.3003, alt: 3000, city: 'Dubai',
    image: '/poi/dubai_frame.jpg', desc: 'Architectural landmark and observation deck, 150m' },

  // Paris
  { name: 'Eiffel Tower', lat: 48.8584, lon: 2.2945, alt: 3000, city: 'Paris',
    image: '/poi/eiffel_tower.jpg', desc: 'Wrought-iron lattice tower on Champ de Mars, 330m' },
  { name: 'Arc de Triomphe', lat: 48.8738, lon: 2.2950, alt: 2500, city: 'Paris',
    image: '/poi/arc_de_triomphe.jpg', desc: 'Triumphal arch at western end of Champs-Élysées' },
  { name: 'Notre-Dame', lat: 48.8530, lon: 2.3499, alt: 2000, city: 'Paris',
    image: '/poi/notre_dame.jpg', desc: 'Medieval Catholic cathedral on Île de la Cité' },
  { name: 'Louvre', lat: 48.8606, lon: 2.3376, alt: 3000, city: 'Paris',
    image: '/poi/louvre.jpg', desc: "World's most-visited museum, 72,735 m²" },
  { name: 'Sacré-Cœur', lat: 48.8867, lon: 2.3431, alt: 2500, city: 'Paris',
    image: '/poi/sacre_coeur.jpg', desc: 'Romano-Byzantine basilica atop Montmartre' },

  // San Francisco
  { name: 'Golden Gate Bridge', lat: 37.8199, lon: -122.4783, alt: 4000, city: 'San Francisco',
    image: '/poi/golden_gate.jpg', desc: 'Suspension bridge spanning the Golden Gate strait' },
  { name: 'Alcatraz Island', lat: 37.8267, lon: -122.4230, alt: 3000, city: 'San Francisco',
    image: '/poi/alcatraz.jpg', desc: 'Former federal prison on rocky island in SF Bay' },
  { name: 'Transamerica Pyramid', lat: 37.7952, lon: -122.4028, alt: 3000, city: 'San Francisco',
    image: '/poi/transamerica.jpg', desc: 'Futurist skyscraper, 260m — SF icon since 1972' },
  { name: 'Fishermans Wharf', lat: 37.8080, lon: -122.4177, alt: 2500, city: 'San Francisco',
    image: '/poi/fishermans_wharf.jpg', desc: 'Waterfront neighborhood and tourist attraction' },

  // Washington DC
  { name: 'The Pentagon', lat: 38.8719, lon: -77.0563, alt: 5000, city: 'Washington DC',
    image: '/poi/pentagon.jpg', desc: 'Headquarters of the US Department of Defense' },
  { name: 'White House', lat: 38.8977, lon: -77.0365, alt: 2500, city: 'Washington DC',
    image: '/poi/white_house.jpg', desc: 'Official residence of the President of the US' },
  { name: 'Capitol Building', lat: 38.8899, lon: -77.0091, alt: 3000, city: 'Washington DC',
    image: '/poi/capitol.jpg', desc: 'Seat of the United States Congress' },
  { name: 'Lincoln Memorial', lat: 38.8893, lon: -77.0502, alt: 2500, city: 'Washington DC',
    image: '/poi/lincoln_memorial.jpg', desc: 'Neoclassical memorial honoring Abraham Lincoln' },
  { name: 'Washington Monument', lat: 38.8895, lon: -77.0353, alt: 3000, city: 'Washington DC',
    image: '/poi/washington_monument.jpg', desc: 'Obelisk on the National Mall, 169m' },

  // Moscow
  { name: 'The Kremlin', lat: 55.7520, lon: 37.6175, alt: 4000, city: 'Moscow',
    image: '/poi/kremlin.jpg', desc: 'Fortified complex and seat of Russian government' },
  { name: 'Red Square', lat: 55.7539, lon: 37.6208, alt: 3000, city: 'Moscow',
    image: '/poi/red_square.jpg', desc: 'City square separating the Kremlin from Kitay-gorod' },
  { name: 'St. Basils Cathedral', lat: 55.7525, lon: 37.6231, alt: 2000, city: 'Moscow',
    image: '/poi/st_basils.jpg', desc: 'Colorful onion-domed church, built 1555–1561' },

  // Beijing
  { name: 'Forbidden City', lat: 39.9163, lon: 116.3972, alt: 6000, city: 'Beijing',
    image: '/poi/forbidden_city.jpg', desc: 'Imperial palace complex, 720,000 m²' },
  { name: 'Tiananmen Square', lat: 39.9055, lon: 116.3976, alt: 5000, city: 'Beijing',
    image: '/poi/tiananmen_square.jpg', desc: 'Large city square in the center of Beijing' },
  { name: 'Temple of Heaven', lat: 39.8822, lon: 116.4066, alt: 4000, city: 'Beijing',
    image: '/poi/temple_of_heaven.jpg', desc: 'Imperial complex of religious buildings, 1420' },

  // Sydney
  { name: 'Sydney Opera House', lat: -33.8568, lon: 151.2153, alt: 3000, city: 'Sydney',
    image: '/poi/sydney_opera.jpg', desc: 'Performing arts venue with iconic sail-shaped roof' },
  { name: 'Harbour Bridge', lat: -33.8523, lon: 151.2108, alt: 4000, city: 'Sydney',
    image: '/poi/harbour_bridge.jpg', desc: 'Steel through arch bridge across Sydney Harbour' },
]

// Cache-bust version (increment on redeploy to bypass CDN cache)
const V = '?v=2'

// Merge HQ locations at the front, then standard POIs
export const POI_DATABASE: POI[] = [...HQ_LOCATIONS, ...STANDARD_POIS].map(p =>
  p.image ? { ...p, image: p.image + V } : p
)

export const CITIES = [...new Set(POI_DATABASE.map((p) => p.city))].sort()

export function getPOIsForCity(city: string): POI[] {
  return POI_DATABASE.filter((p) => p.city === city)
}
