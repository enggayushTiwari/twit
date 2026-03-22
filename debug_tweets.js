/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTweets() {
    console.log('Checking generated tweets...');
    const { data, error } = await supabase
        .from('generated_tweets')
        .select('id, content, status, generation_mode, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching tweets:', error);
        return;
    }

    console.log(`Found ${data.length} tweets:`);
    data.forEach((tweet) => {
        console.log(`[${tweet.generation_mode}] [${tweet.status}] ${tweet.id}: ${tweet.content.substring(0, 50)}... (${tweet.created_at})`);
    });
}

checkTweets();
