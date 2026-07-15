import { randomInt } from "node:crypto";

const candidates = process.argv.slice(2);
if (candidates.length < 3 || candidates.length > 7) {
  process.stderr.write("Expected 3 to 7 candidate URLs.\n");
  process.exit(1);
}

for (const candidate of candidates) {
  let url;
  try {
    url = new URL(candidate);
  } catch {
    process.stderr.write(`Invalid URL: ${candidate}\n`);
    process.exit(1);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    process.stderr.write(`Unsupported URL protocol: ${candidate}\n`);
    process.exit(1);
  }
}

const index = randomInt(candidates.length);
process.stdout.write(`${JSON.stringify({ index: index + 1, url: candidates[index] })}\n`);
