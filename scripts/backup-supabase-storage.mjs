import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outputRoot = process.env.STORAGE_BACKUP_DIR || 'backup/storage';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${options.method || 'GET'} ${url} failed: ${response.status} ${body.slice(0, 500)}`);
  }

  return response;
}

function encodeObjectPath(objectPath) {
  return objectPath.split('/').map(encodeURIComponent).join('/');
}

async function listBuckets() {
  const response = await api(`${supabaseUrl}/storage/v1/bucket`);
  return response.json();
}

async function listFolder(bucketName, prefix = '') {
  const all = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const response = await api(
      `${supabaseUrl}/storage/v1/object/list/${encodeURIComponent(bucketName)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix,
          limit,
          offset,
          sortBy: { column: 'name', order: 'asc' },
        }),
      },
    );
    const page = await response.json();
    all.push(...page);
    if (page.length < limit) break;
    offset += limit;
  }

  return all;
}

async function collectObjects(bucketName, prefix = '') {
  const entries = await listFolder(bucketName, prefix);
  const files = [];

  for (const entry of entries) {
    const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;

    // Supabase represents virtual folders without an object id.
    if (!entry.id) {
      files.push(...(await collectObjects(bucketName, objectPath)));
      continue;
    }

    files.push({
      path: objectPath,
      size: Number(entry.metadata?.size || 0),
      mimetype: entry.metadata?.mimetype || null,
      updatedAt: entry.updated_at || null,
    });
  }

  return files;
}

async function downloadObject(bucketName, objectPath) {
  const url = `${supabaseUrl}/storage/v1/object/authenticated/${encodeURIComponent(bucketName)}/${encodeObjectPath(objectPath)}`;
  const response = await api(url);
  const bytes = Buffer.from(await response.arrayBuffer());
  const destination = path.join(outputRoot, bucketName, ...objectPath.split('/'));
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  return bytes.length;
}

const buckets = await listBuckets();
const manifest = {
  generatedAt: new Date().toISOString(),
  projectUrl: supabaseUrl,
  buckets: [],
  objectCount: 0,
  totalBytes: 0,
};

for (const bucket of buckets) {
  const objects = await collectObjects(bucket.name);
  const bucketSummary = {
    id: bucket.id,
    name: bucket.name,
    public: Boolean(bucket.public),
    objects: [],
  };

  for (const object of objects) {
    const downloadedBytes = await downloadObject(bucket.name, object.path);
    bucketSummary.objects.push({ ...object, downloadedBytes });
    manifest.objectCount += 1;
    manifest.totalBytes += downloadedBytes;
    console.log(`Backed up storage://${bucket.name}/${object.path} (${downloadedBytes} bytes)`);
  }

  manifest.buckets.push(bucketSummary);
}

await mkdir(outputRoot, { recursive: true });
await writeFile(
  path.join(outputRoot, '_storage-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log(
  `Supabase Storage backup complete: ${manifest.objectCount} objects, ${manifest.totalBytes} bytes`,
);
