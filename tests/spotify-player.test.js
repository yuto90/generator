import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const utilsUrl = new URL('../spotify_player/player-utils.js', import.meta.url);

async function loadUtils() {
  try {
    return await import(utilsUrl);
  } catch (error) {
    assert.fail(`Spotify player utilities could not be loaded: ${error.message}`);
  }
}

test('parseTime accepts m:ss values and rejects invalid input', async () => {
  const { parseTime } = await loadUtils();

  assert.equal(parseTime('0:00'), 0);
  assert.equal(parseTime('1:23'), 83);
  assert.equal(parseTime('123:59'), 7439);
  assert.equal(parseTime(''), null);
  assert.equal(parseTime('1:2'), null);
  assert.equal(parseTime('1:60'), null);
  assert.equal(parseTime('-1:00'), null);
});

test('formatTime renders non-negative seconds as m:ss', async () => {
  const { formatTime } = await loadUtils();

  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(83), '1:23');
  assert.equal(formatTime(7439), '123:59');
  assert.equal(formatTime(-10), '0:00');
});

test('calculateProgress handles invalid durations and clamps the result', async () => {
  const { calculateProgress } = await loadUtils();

  assert.equal(calculateProgress(30, 120), 25);
  assert.equal(calculateProgress(-1, 120), 0);
  assert.equal(calculateProgress(130, 120), 100);
  assert.equal(calculateProgress(30, 0), 0);
});

test('extractYouTubeId supports player URL variants and direct IDs', async () => {
  const { extractYouTubeId } = await loadUtils();
  const id = 'dQw4w9WgXcQ';

  assert.equal(extractYouTubeId(id), id);
  assert.equal(extractYouTubeId(`https://www.youtube.com/watch?v=${id}&t=10`), id);
  assert.equal(extractYouTubeId(`https://youtu.be/${id}`), id);
  assert.equal(extractYouTubeId(`https://www.youtube.com/embed/${id}`), id);
  assert.equal(extractYouTubeId(`https://youtube.com/shorts/${id}`), id);
  assert.equal(extractYouTubeId(`https://youtube.com/live/${id}`), id);
  assert.equal(extractYouTubeId('https://notyoutube.com/watch?v=dQw4w9WgXcQ'), '');
  assert.equal(extractYouTubeId('invalid'), '');
});

test('Spotify page wires required inputs, shared theme, playback, and capture', async () => {
  const [html, js] = await Promise.all([
    readFile(new URL('../spotify_player/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../spotify_player/app.js', import.meta.url), 'utf8'),
  ]);

  for (const id of [
    'in-title',
    'in-artist',
    'in-image',
    'in-current-time',
    'in-duration',
    'in-youtube',
    'btn-update',
    'btn-capture',
    'player-card',
    'youtube-player-panel',
    'youtube-audio',
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }

  assert.match(html, /data-theme-toggle/);
  assert.match(html, /:root\[data-theme="light"\]/);
  assert.match(html, /html-to-image@1\.11\.11/);
  assert.match(js, /from '\.\.\/theme\.js'/);
  assert.match(js, /from '\.\/player-utils\.js'/);
  assert.match(js, /onYouTubeIframeAPIReady/);
  assert.match(js, /height:\s*'200'/);
  assert.match(js, /width:\s*'272'/);
  assert.doesNotMatch(html, /#youtube-audio\s*\{[^}]*left:\s*-\d+/s);
  assert.match(js, /htmlToImage\.toPng/);
  assert.match(js, /pixelRatio:\s*4/);
  assert.match(js, /spotify_player\.png/);
  assert.match(js, /if \(values\.youtubeId\) \{[\s\S]*loadYouTubeApi\(\);[\s\S]*preparePlayer\(\);/);
  assert.doesNotMatch(js, /setTheme\(currentTheme, false, false\);\s*loadYouTubeApi\(\);\s*$/);
});

test('portal and README expose the Spotify generator', async () => {
  const [portal, readme] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../README.md', import.meta.url), 'utf8'),
  ]);

  assert.match(portal, /id:\s*'spotify_player'/);
  assert.match(portal, /path:\s*'spotify_player\/'/);
  assert.match(portal, /#1DB954/i);
  assert.match(readme, /spotify_player: http:\/\/127\.0\.0\.1:8000\/spotify_player\//);
});
