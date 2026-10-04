// Sample data for display only — not live Shopify inventory. Real product,
// pricing and order data is handled by the Forge Assistant via the connected
// Shopify MCP tools, not by this fixture.
export interface SampleProduct {
  id: string;
  name: string;
  category: string;
  unitPrice: string;
  moq: string;
  blurb: string;
  accent: 'primary' | 'secondary';
}

export const SAMPLE_PRODUCTS: SampleProduct[] = [
  {
    id: 'p1',
    name: 'Ridgeline Canvas Work Jacket',
    category: 'Outerwear',
    unitPrice: '$24.50 / unit',
    moq: 'MOQ 48',
    blurb: 'Our best-selling SKU — reinforced stitching, bulk-dyed in 6 colorways.',
    accent: 'primary',
  },
  {
    id: 'p2',
    name: 'Trailhead Utility Pack 20L',
    category: 'Bags & Packs',
    unitPrice: '$11.20 / unit',
    moq: 'MOQ 96',
    blurb: 'Lightweight, water-resistant — ships flat-packed to cut freight cost.',
    accent: 'secondary',
  },
  {
    id: 'p3',
    name: 'Basecamp Insulated Bottle',
    category: 'Drinkware',
    unitPrice: '$4.75 / unit',
    moq: 'MOQ 144',
    blurb: 'Private-label ready — custom etching available above 500 units.',
    accent: 'primary',
  },
  {
    id: 'p4',
    name: 'Switchback Gaiter Set',
    category: 'Accessories',
    unitPrice: '$3.10 / unit',
    moq: 'MOQ 200',
    blurb: 'High-margin add-on SKU, consistently reorders within 60 days.',
    accent: 'secondary',
  },
];
