import * as cheerio from 'cheerio';

/**
 * Scrapes the core readable text from a given URL.
 * Strips out boilerplate like nav, footer, scripts, and styles.
 */
export async function scrapeUrl(url: string): Promise<{ success: boolean; content: string; title?: string; error?: string }> {
    try {
        // 1. Validate URL
        let validUrl: URL;
        try {
            validUrl = new URL(url);
        } catch (e) {
            return { success: false, content: '', error: 'Invalid URL provided.' };
        }

        // 2. Fetch the HTML
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            next: { revalidate: 3600 } // Cache for 1 hour if using Next.js fetch
        });

        if (!response.ok) {
            if (response.status === 403 || response.status === 401) {
                return { success: false, content: '', error: 'Access denied: This site may be blocking scrapers or requires a login.' };
            }
            if (response.status === 404) {
                return { success: false, content: '', error: 'Site not found.' };
            }
            return { success: false, content: '', error: `Failed to fetch site: ${response.statusText}` };
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // 3. Remove known boilerplate tags
        $('script, style, nav, footer, header, noscript, iframe, ad, .ad, .ads, .advertisement, aside, .sidebar').remove();

        // 4. Extract Title
        const title = $('title').text() || $('h1').first().text() || '';

        // 5. Extract Core Content
        // We look for common content containers or just collect all P tags
        let mainContent = '';
        
        // Try to find a "main" or "article" tag first
        const article = $('article, main, #content, .content, .main-content, .post-content').first();
        
        if (article.length > 0) {
            mainContent = article.find('p, h1, h2, h3, h4, h5, li').map((_, el) => $(el).text().trim()).get().join('\n\n');
        } else {
            // Fallback: Just get all paragraphs
            mainContent = $('p, h1, h2, h3, h4, h5, li').map((_, el) => $(el).text().trim()).get().join('\n\n');
        }

        // 6. Clean up text (remove excessive whitespace)
        const cleanedContent = mainContent
            .replace(/\n\s*\n/g, '\n\n') // Collapse multiple newlines
            .replace(/[ \t]+/g, ' ')      // Collapse multiple spaces
            .trim();

        if (!cleanedContent || cleanedContent.length < 50) {
            return { 
                success: false, 
                content: '', 
                error: 'Could not extract significant readable text. This site might be a Single Page App (SPA) or depends heavily on JavaScript.' 
            };
        }

        return {
            success: true,
            title: title.trim(),
            content: cleanedContent
        };

    } catch (error: any) {
        console.error('Scraper Error:', error);
        return {
            success: false,
            content: '',
            error: error.message || 'An unexpected error occurred while scraping.'
        };
    }
}
