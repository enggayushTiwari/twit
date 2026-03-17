import { scrapeUrl } from '../utils/scraper';

async function test() {
    const url = 'https://nextjs.org/blog/next-14';
    console.log(`Testing scraper with URL: ${url}`);
    
    const result = await scrapeUrl(url);
    
    if (result.success) {
        console.log('✅ Success!');
        console.log('Title:', result.title);
        console.log('Content Preview (first 500 chars):');
        console.log(result.content.substring(0, 500) + '...');
    } else {
        console.log('❌ Failed!');
        console.log('Error:', result.error);
    }
}

test();
