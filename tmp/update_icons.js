import fs from 'fs';

const file16 = fs.readFileSync('/tmp/final16.png').toString('base64');
const file32 = fs.readFileSync('/tmp/final32.png').toString('base64');
const file48 = fs.readFileSync('/tmp/final48.png').toString('base64');
const file128 = fs.readFileSync('/tmp/final128_round.png').toString('base64');

let serverContent = fs.readFileSync('server.ts', 'utf8');

// Target string to replace
const target = `    // 8. Placeholders for icon generator
    const iconBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="; // 1x1 black pixel base64 fallback
    zip.file("icons/icon16.png", iconBase64, { base64: true });
    zip.file("icons/icon48.png", iconBase64, { base64: true });
    zip.file("icons/icon128.png", iconBase64, { base64: true });`;

const replacement = `    // 8. Dynamic high-quality extension icons
    const icon16Base64 = "${file16}";
    const icon32Base64 = "${file32}";
    const icon48Base64 = "${file48}";
    const icon128Base64 = "${file128}";
    zip.file("icons/icon16.png", icon16Base64, { base64: true });
    zip.file("icons/icon32.png", icon32Base64, { base64: true });
    zip.file("icons/icon48.png", icon48Base64, { base64: true });
    zip.file("icons/icon128.png", icon128Base64, { base64: true });`;

if (!serverContent.includes(target)) {
  console.error("Error: Target placeholder block not found in server.ts!");
  process.exit(1);
}

serverContent = serverContent.replace(target, replacement);

fs.writeFileSync('server.ts', serverContent, 'utf8');
console.log("Successfully replaced icon placeholders in server.ts!");
