import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateImages() {
  console.log("Checking if 'players' bucket exists...");
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === 'players');
  
  if (!bucketExists) {
    console.log("Creating 'players' bucket...");
    const { error: createError } = await supabase.storage.createBucket('players', { public: true });
    if (createError) {
      console.error("Failed to create bucket:", createError);
      return;
    }
  }

  console.log("Fetching players from Supabase DB...");
  const { data: players, error } = await supabase.from('players').select('*');
  
  if (error || !players) {
    console.error("Failed to fetch players:", error);
    return;
  }

  for (const player of players) {
    if (!player.image.includes('cloudinary.com')) {
      console.log(`Skipping ${player.name}, image not on Cloudinary.`);
      continue;
    }

    try {
      console.log(`Downloading image for ${player.name}...`);
      const response = await fetch(player.image);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Extract filename
      const parts = player.image.split('/');
      let filename = parts[parts.length - 1];
      // remove query params if any
      filename = filename.split('?')[0];

      console.log(`Uploading ${filename} to Supabase Storage...`);
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('players')
        .upload(filename, buffer, {
          contentType: response.headers.get('content-type') || 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        console.error(`Failed to upload ${filename}:`, uploadError.message);
        continue;
      }

      // We just store the filename in DB, and frontend will construct the URL
      console.log(`Updating DB for ${player.name}...`);
      await supabase
        .from('players')
        .update({ image: filename })
        .eq('id', player.id);

      console.log(`Successfully migrated image for ${player.name}`);

    } catch (err) {
      console.error(`Error processing ${player.name}:`, err.message);
    }
  }

  console.log("Image migration complete!");
}

migrateImages();
