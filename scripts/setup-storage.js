// Run this with: node scripts/setup-storage.js
// Make sure you have the .env.local file with SUPABASE_SERVICE_ROLE_KEY

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function setup() {
  console.log('Setting up Supabase storage bucket...\n');

  // Create bucket
  const { data: bucket, error: bucketError } = await supabase.storage.createBucket('project-files', {
    public: true,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp'
    ]
  });

  if (bucketError) {
    if (bucketError.message.includes('already exists')) {
      console.log('✓ Bucket "project-files" already exists');
    } else {
      console.error('✗ Error creating bucket:', bucketError.message);
    }
  } else {
    console.log('✓ Created bucket "project-files"');
  }

  // Create project_workflows table if needed
  const { error: tableError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS project_workflows (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        project_id UUID NOT NULL UNIQUE,
        workflow_data JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      ALTER TABLE project_workflows ENABLE ROW LEVEL SECURITY;
      
      DROP POLICY IF EXISTS "Authenticated users can view workflows" ON project_workflows;
      CREATE POLICY "Authenticated users can view workflows" ON project_workflows FOR SELECT TO authenticated USING (true);
      
      DROP POLICY IF EXISTS "Authenticated users can insert workflows" ON project_workflows;
      CREATE POLICY "Authenticated users can insert workflows" ON project_workflows FOR INSERT TO authenticated WITH CHECK (true);
      
      DROP POLICY IF EXISTS "Authenticated users can update workflows" ON project_workflows;
      CREATE POLICY "Authenticated users can update workflows" ON project_workflows FOR UPDATE TO authenticated USING (true);
    `
  });

  if (tableError) {
    console.log('Note: Table setup via RPC may require manual SQL execution');
    console.log('Please run the supabase-storage-setup.sql file in the SQL editor');
  } else {
    console.log('✓ Created/updated project_workflows table');
  }

  console.log('\n✓ Storage setup complete!');
  console.log('\nIf you see policy errors, run this SQL in Supabase SQL Editor:');
  console.log('https://supabase.com/dashboard/project/xzrqndztwcpdqaimsmam/sql');
}

setup().catch(console.error);
