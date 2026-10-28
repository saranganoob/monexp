// Friendly colour names for the accent search box (Profile → Preferences → Accent colour).
// Everyday names, fruit and food, and Indian favourites. Text on any of them stays readable –
// accentTokens() adjusts it.

export interface NamedColor { name: string; hex: string; }

export const COLOR_NAMES: NamedColor[] = [
  // blues
  { name: 'Sky blue', hex: '#38BDF8' }, { name: 'Pale blue', hex: '#93C5FD' }, { name: 'Baby blue', hex: '#89CFF0' },
  { name: 'Light blue', hex: '#60A5FA' }, { name: 'Royal blue', hex: '#2F5BEA' }, { name: 'Navy blue', hex: '#1E3A8A' },
  { name: 'Midnight blue', hex: '#191970' }, { name: 'Cobalt blue', hex: '#0047AB' }, { name: 'Ocean blue', hex: '#0EA5E9' },
  { name: 'Denim blue', hex: '#1560BD' }, { name: 'Steel blue', hex: '#4682B4' }, { name: 'Powder blue', hex: '#B0E0E6' },
  { name: 'Azure', hex: '#007FFF' }, { name: 'Sapphire', hex: '#0F52BA' }, { name: 'Peacock blue', hex: '#005F69' },
  { name: 'Electric blue', hex: '#3D5AFE' }, { name: 'Cornflower blue', hex: '#6495ED' }, { name: 'Indigo', hex: '#6366F1' },
  { name: 'Ink blue', hex: '#26355D' },
  // cyans & teals
  { name: 'Teal', hex: '#0D9488' }, { name: 'Turquoise', hex: '#2EC4B6' }, { name: 'Aqua', hex: '#00BCD4' },
  { name: 'Cyan', hex: '#06B6D4' }, { name: 'Sea green', hex: '#2E8B57' }, { name: 'Peacock green', hex: '#008577' },
  // greens
  { name: 'Green apple', hex: '#7CB518' }, { name: 'Apple green', hex: '#8DB600' }, { name: 'Lime green', hex: '#65A30D' },
  { name: 'Mint green', hex: '#3EB489' }, { name: 'Emerald', hex: '#10B981' }, { name: 'Forest green', hex: '#228B22' },
  { name: 'Olive green', hex: '#708238' }, { name: 'Sage green', hex: '#87A96B' }, { name: 'Parrot green', hex: '#3CB043' },
  { name: 'Leaf green', hex: '#4CAF50' }, { name: 'Bottle green', hex: '#006A4E' }, { name: 'Mehendi green', hex: '#6E7F1F' },
  { name: 'Pista green', hex: '#93C572' }, { name: 'Jade', hex: '#00A86B' }, { name: 'Neem green', hex: '#4F7942' },
  { name: 'Tulsi green', hex: '#3F7D3A' }, { name: 'Moss green', hex: '#8A9A5B' },
  // yellows
  { name: 'Mango yellow', hex: '#F4BB44' }, { name: 'Turmeric yellow', hex: '#E3A600' }, { name: 'Lemon yellow', hex: '#F4E04D' },
  { name: 'Sunflower yellow', hex: '#FFC512' }, { name: 'Mustard yellow', hex: '#D4A017' }, { name: 'Golden yellow', hex: '#FFC000' },
  { name: 'Gold', hex: '#D4AF37' }, { name: 'Banana yellow', hex: '#FFE135' }, { name: 'Butter yellow', hex: '#F8DE7E' },
  { name: 'Amber', hex: '#F59E0B' }, { name: 'Honey', hex: '#EBA937' },
  // oranges
  { name: 'Carrot orange', hex: '#ED9121' }, { name: 'Saffron', hex: '#F4C430' }, { name: 'Kesar orange', hex: '#FF9933' },
  { name: 'Tangerine', hex: '#F28500' }, { name: 'Pumpkin orange', hex: '#FF7518' }, { name: 'Orange', hex: '#F97316' },
  { name: 'Burnt orange', hex: '#CC5500' }, { name: 'Peach', hex: '#FFB07C' }, { name: 'Apricot', hex: '#FBCEB1' },
  { name: 'Papaya orange', hex: '#FF8C42' }, { name: 'Marigold', hex: '#EAA221' }, { name: 'Rust', hex: '#B7410E' },
  { name: 'Terracotta', hex: '#E2725B' }, { name: 'Copper', hex: '#B87333' },
  // reds
  { name: 'Fire red', hex: '#E53935' }, { name: 'Apple red', hex: '#C1121F' }, { name: 'Cherry red', hex: '#D2042D' },
  { name: 'Tomato red', hex: '#FF6347' }, { name: 'Chilli red', hex: '#C21807' }, { name: 'Ruby red', hex: '#9B111E' },
  { name: 'Crimson', hex: '#DC143C' }, { name: 'Scarlet', hex: '#FF2400' }, { name: 'Brick red', hex: '#CB4154' },
  { name: 'Maroon', hex: '#800000' }, { name: 'Wine red', hex: '#722F37' }, { name: 'Sindoor red', hex: '#E0301E' },
  { name: 'Kumkum red', hex: '#C7372F' }, { name: 'Strawberry red', hex: '#E23D4F' }, { name: 'Watermelon red', hex: '#F05C6B' },
  { name: 'Pomegranate red', hex: '#C0392B' }, { name: 'Coral', hex: '#FF7F50' }, { name: 'Salmon', hex: '#FA8072' },
  // pinks
  { name: 'Rose pink', hex: '#F43F5E' }, { name: 'Baby pink', hex: '#F4C2C2' }, { name: 'Hot pink', hex: '#FF69B4' },
  { name: 'Rani pink', hex: '#E0115F' }, { name: 'Bubblegum pink', hex: '#FF6FB5' }, { name: 'Blush pink', hex: '#DE5D83' },
  { name: 'Magenta', hex: '#D946EF' }, { name: 'Fuchsia', hex: '#C026D3' }, { name: 'Lotus pink', hex: '#E68FAC' },
  { name: 'Candy pink', hex: '#E4717A' }, { name: 'Flamingo pink', hex: '#FC8EAC' }, { name: 'Raspberry', hex: '#E30B5C' },
  // purples
  { name: 'Lavender', hex: '#A78BFA' }, { name: 'Violet', hex: '#8B5CF6' }, { name: 'Purple', hex: '#7E22CE' },
  { name: 'Royal purple', hex: '#7851A9' }, { name: 'Plum', hex: '#8E4585' }, { name: 'Grape purple', hex: '#6F2DA8' },
  { name: 'Lilac', hex: '#C8A2C8' }, { name: 'Orchid', hex: '#DA70D6' }, { name: 'Mauve', hex: '#B784A7' },
  { name: 'Jamun purple', hex: '#5B2C6F' }, { name: 'Brinjal purple', hex: '#614051' }, { name: 'Amethyst', hex: '#9966CC' },
  // browns & neutrals
  { name: 'Chocolate brown', hex: '#7B3F00' }, { name: 'Coffee brown', hex: '#6F4E37' }, { name: 'Caramel', hex: '#C68E17' },
  { name: 'Cinnamon', hex: '#D2691E' }, { name: 'Sandal brown', hex: '#C19A6B' }, { name: 'Tan', hex: '#D2B48C' },
  { name: 'Mocha', hex: '#967969' }, { name: 'Walnut brown', hex: '#5C4033' }, { name: 'Chikoo brown', hex: '#9A7B4F' },
  { name: 'Graphite', hex: '#64748B' }, { name: 'Slate grey', hex: '#708090' }, { name: 'Charcoal', hex: '#36454F' },
  { name: 'Ash grey', hex: '#B2BEB5' }, { name: 'Silver', hex: '#A8A9AD' }, { name: 'Black', hex: '#1F2937' },
];

/**
 * Colours matching what was typed: names starting with it first, then names with a word starting
 * with it, then names containing it. A typed hex code (#ff8800 or ff8800) is offered as is.
 */
export function searchColors(query: string, limit = 8): NamedColor[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return [];
  const hex = /^#?([0-9a-f]{6})$/.exec(q);
  if (hex) return [{ name: `#${hex[1].toUpperCase()}`, hex: `#${hex[1].toUpperCase()}` }];
  const rank = (c: NamedColor) => {
    const n = c.name.toLowerCase();
    if (n.startsWith(q)) return 0;
    if (n.split(' ').some((w) => w.startsWith(q))) return 1;
    return n.includes(q) || n.replace(/ /g, '').includes(q.replace(/ /g, '')) ? 2 : 3;
  };
  return COLOR_NAMES.map((c) => ({ c, r: rank(c) }))
    .filter((x) => x.r < 3)
    .sort((a, b) => a.r - b.r || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((x) => x.c);
}
