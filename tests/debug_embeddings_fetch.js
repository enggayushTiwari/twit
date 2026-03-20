const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugFetch() {
    console.log('Fetching ideas from Supabase...');
    const { data: allIdeas, error: fetchIdeasError } = await supabase
        .from('raw_ideas')
        .select('id, content, embedding, type');

    if (fetchIdeasError) {
        console.error('Fetch error:', fetchIdeasError);
        return;
    }

    console.log(`Total ideas fetched: ${allIdeas?.length}`);
    
    if (allIdeas && allIdeas.length > 0) {
        allIdeas.forEach((idea, i) => {
            const e = idea.embedding;
            console.log(`\n--- Idea ${i + 1} ---`);
            console.log(`ID: ${idea.id}`);
            console.log(`Content: ${idea.content.substring(0, 50)}...`);
            console.log(`Embedding Type: ${typeof e}`);
            console.log(`Is Array: ${Array.isArray(e)}`);
            if (e) {
                if (Array.isArray(e)) {
                    console.log(`Length: ${e.length}`);
                } else {
                    console.log(`Value snippet: ${String(e).substring(0, 100)}...`);
                }
            } else {
                console.log('Value is null/undefined');
            }
        });

        const validIdeas = allIdeas.filter(
            (idea) => Array.isArray(idea.embedding) && idea.embedding.length > 0
        );
        console.log(`\nValid ideas count (native filter): ${validIdeas.length}`);

        // Try parsing if it's a string
        const validWithParsing = allIdeas.filter((idea) => {
            let e = idea.embedding;
            if (typeof e === 'string') {
                try {
                    e = JSON.parse(e);
                } catch (p) {
                    try {
                        // pgvector string format "[v1,v2,...]" might need cleanup
                        const cleaned = e.replace('[', '').replace(']', '').split(',').map(Number);
                        if (cleaned.length > 0 && !isNaN(cleaned[0])) e = cleaned;
                    } catch (p2) {}
                }
            }
            return Array.isArray(e) && e.length > 0;
        });
        console.log(`Valid ideas count (with string-to-array parsing): ${validWithParsing.length}`);
    }
}

debugFetch();
