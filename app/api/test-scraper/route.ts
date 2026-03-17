import { NextResponse } from 'next/server';
import { scrapeUrl } from '@/utils/scraper';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    const result = await scrapeUrl(url);
    return NextResponse.json(result);
}
