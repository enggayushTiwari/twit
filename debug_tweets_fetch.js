const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables.');
}

async function checkTweets() {
    console.log('Checking generated tweets via Fetch API...');
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/generated_tweets?select=id,content,status,generation_mode,created_at&order=created_at.desc`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
            },
        });

        if (!response.ok) {
            console.error('Error response:', await response.text());
            return;
        }

        const data = await response.json();
        console.log(`Found ${data.length} tweets:`);
        data.forEach((tweet) => {
            console.log(`[${tweet.generation_mode}] [${tweet.status}] ${tweet.id}: ${tweet.content.substring(0, 50).replace(/\n/g, ' ')}... (${tweet.created_at})`);
        });
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

checkTweets();
