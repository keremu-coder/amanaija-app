import { NextResponse } from 'next/server';
import { tooMany } from "@/lib/ratelimit";

// A lightweight, zero-cost AI heuristic for local categorization
const CATEGORY_PATTERNS: Record<string, string[]> = {
  'Hospital': ['hospital', 'clinic', 'health', 'medical', 'pharmacy', 'doctor', 'maternity'],
  'Church': ['church', 'ministry', 'parish', 'cathedral', 'mosque', 'assembly', 'worship'],
  'School': ['school', 'academy', 'college', 'university', 'nursery', 'primary', 'secondary'],
  'Food': ['food', 'pott', 'kitchen', 'restaurant', 'chop', 'eatery', 'bakery', 'cafe', 'bar'],
  'Shop': ['shop', 'store', 'mart', 'supermarket', 'boutique', 'electronics', 'boutique', 'enterprise', 'trading'],
  'Office': ['office', 'bank', 'corporate', 'agency', 'consult', 'limited', 'ltd', 'plc', 'council'],
  'Plaza': ['plaza', 'mall', 'complex', 'tower', 'building', 'arcade'],
  'Residential': ['residence', 'estate', 'compound', 'villa', 'apartment', 'quarters']
};

export async function POST(req: Request) {
  const __limited = await tooMany(req, "classify", 30, 60);
  if (__limited) return __limited;
  try {
    const { name } = await req.json();
    if (!name) return NextResponse.json({ category: 'Other' });

    const lowerName = name.toLowerCase();
    
    // Check patterns
    for (const [category, keywords] of Object.entries(CATEGORY_PATTERNS)) {
      if (keywords.some(keyword => lowerName.includes(keyword))) {
        return NextResponse.json({ category });
      }
    }

    return NextResponse.json({ category: 'Shop' }); // Default to Shop if unknown
  } catch (error) {
    return NextResponse.json({ category: 'Other' });
  }
}
