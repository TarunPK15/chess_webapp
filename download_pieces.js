const https = require('https');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'frontend', 'public', 'pieces', 'merida');
fs.mkdirSync(dir, { recursive: true });

const pieces = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK'];

pieces.forEach(p => {
  const file = fs.createWriteStream(path.join(dir, `${p}.svg`));
  https.get(`https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/merida/${p}.svg`, function(response) {
    response.pipe(file);
  });
});

console.log('Downloading pieces...');
