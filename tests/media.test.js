import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMediaUrl, ALLOWED_EMBED } from '../src/js/media-embed.js';

const ok = (url, platform, kind) => { const r = parseMediaUrl(url); assert.equal(r.ok, true, url + ' -> ' + r.reason); assert.equal(r.platform, platform, url); assert.equal(r.kind, kind, url); if (r.embedUrl) assert.match(r.embedUrl, ALLOWED_EMBED, url); return r; };
test('Spotify', () => {
  const r = ok('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123', 'spotify', 'playlist'); assert.equal(r.embedUrl, 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=generator'); assert.equal(r.url, 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
  ok('https://open.spotify.com/intl-fr/track/4uLU6hMCjMI75M1A2tKUQC', 'spotify', 'track'); ok('spotify:album:1DFixLWuPkv3KT3TnV35m3', 'spotify', 'album'); ok('open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk', 'spotify', 'show');
});
test('Apple Music', () => {
  const r = ok('https://music.apple.com/ng/album/some-album/1440857781?i=1440857785', 'apple_music', 'track'); assert.equal(r.embedUrl, 'https://embed.music.apple.com/ng/album/some-album/1440857781?i=1440857785');
  ok('https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb', 'apple_music', 'playlist'); ok('https://music.apple.com/us/album/x/123456', 'apple_music', 'album');
});
test('YouTube and YouTube Music', () => {
  ok('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s', 'youtube', 'video'); ok('https://youtu.be/dQw4w9WgXcQ?si=zz', 'youtube', 'video'); ok('https://www.youtube.com/shorts/dQw4w9WgXcQ', 'youtube', 'video');
  const l = ok('https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI', 'youtube', 'playlist'); assert.match(l.embedUrl, /videoseries\?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI/);
  ok('https://music.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube_music', 'video'); ok('https://music.youtube.com/playlist?list=OLAK5uy_abcdefghijk', 'youtube_music', 'playlist');
});
test('SoundCloud, Audiomack, Deezer, Tidal, Boomplay', () => {
  const s = ok('https://soundcloud.com/some-artist/some-track?utm_source=x', 'soundcloud', 'track'); assert.match(s.embedUrl, /^https:\/\/w\.soundcloud\.com\/player\/\?url=https%3A%2F%2Fsoundcloud\.com%2Fsome-artist%2Fsome-track/);
  ok('https://soundcloud.com/some-artist/sets/my-set', 'soundcloud', 'playlist');
  assert.equal(ok('https://audiomack.com/burnaboy/song/last-last', 'audiomack', 'track').embedUrl, 'https://audiomack.com/embed/song/burnaboy/last-last?background=1');
  ok('https://audiomack.com/someone/playlist/summer', 'audiomack', 'playlist');
  assert.equal(ok('https://www.deezer.com/en/playlist/1313621735', 'deezer', 'playlist').embedUrl, 'https://widget.deezer.com/widget/auto/playlist/1313621735'); ok('https://www.deezer.com/track/3135556', 'deezer', 'track');
  assert.equal(ok('https://tidal.com/browse/album/79914998', 'tidal', 'album').embedUrl, 'https://embed.tidal.com/albums/79914998'); ok('https://tidal.com/browse/playlist/36ea71a8-445e-41a4-82ab-6628c581535d', 'tidal', 'playlist');
  const b = ok('https://www.boomplay.com/songs/12345678', 'boomplay', 'track'); assert.equal(b.embedUrl, null);
});
test('everything else is refused, with a clear reason', () => {
  for (const bad of ['', 'hello', 'https://example.com/song', 'https://evil.com/open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', 'https://open.spotify.com.evil.com/track/4uLU6hMCjMI75M1A2tKUQC', 'javascript:alert(1)', 'https://open.spotify.com/track/short', 'https://soundcloud.com/discover', 'https://vimeo.com/123', 'https://on.soundcloud.com/abc', 'ftp://youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/']) {
    const r = parseMediaUrl(bad); assert.equal(r.ok, false, bad); assert.ok(r.reason.length > 5);
  }
  assert.match(parseMediaUrl('https://example.com/x').reason, /Spotify, Apple Music, YouTube/);
});
