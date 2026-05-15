import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import players from '../src/data/players.js';

// Load .env.local if it exists, otherwise fall back to .env
dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env file.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migratePlayers() {
  console.log(`Starting migration of ${players.length} players...`);
  
  for (const player of players) {
    const { data, error } = await supabase
      .from('players')
      .insert([
        {
          name: player.name,
          image: player.image,
          role: player.role,
          batting: player.batting,
          bowling: player.bowling,
          average: player.average,
          stars: player.stars,
          objectposition: player.objectPosition,
          scale: player.scale
        }
      ]);

    if (error) {
      console.error(`Error inserting ${player.name}:`, error.message);
    } else {
      console.log(`Successfully inserted: ${player.name}`);
    }
  }
  
  console.log("Migration complete!");
}

migratePlayers();
