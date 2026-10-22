import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute, normalizeArabicText } from '@/lib/db';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET() {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const categories = await query('SELECT * FROM categories WHERE active = true ORDER BY name ASC');
    const colors = await query('SELECT * FROM colors WHERE active = true ORDER BY name ASC');
    const sizes = await query('SELECT * FROM sizes WHERE active = true ORDER BY sort_order ASC, name ASC');

    return NextResponse.json({ categories, colors, sizes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeRoles(['admin']);
  if (auth.response) return auth.response;

  try {
    const { type, name, hex_code, sort_order } = await req.json();

    if (!type || !name || !name.trim()) {
      return NextResponse.json({ error: 'النوع والاسم مطلوبان' }, { status: 400 });
    }

    const cleanName = name.trim();

    if (type === 'category') {
      const res = await query<{ id: number }>(
        'INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET active = true RETURNING id',
        [cleanName]
      );
      return NextResponse.json({ success: true, item: { id: res[0].id, name: cleanName } });
    }

    if (type === 'color') {
      const normalized = normalizeArabicText(cleanName);
      const res = await query<{ id: number }>(
        'INSERT INTO colors (name, normalized_name, hex_code) VALUES ($1, $2, $3) ON CONFLICT (normalized_name) DO UPDATE SET active = true RETURNING id',
        [cleanName, normalized, hex_code || null]
      );
      return NextResponse.json({ success: true, item: { id: res[0].id, name: cleanName, hex_code } });
    }

    if (type === 'size') {
      const order = Number(sort_order || 99);
      const res = await query<{ id: number }>(
        'INSERT INTO sizes (name, sort_order) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET active = true RETURNING id',
        [cleanName, order]
      );
      return NextResponse.json({ success: true, item: { id: res[0].id, name: cleanName, sort_order: order } });
    }

    return NextResponse.json({ error: 'نوع السمة غير مدعوم' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
