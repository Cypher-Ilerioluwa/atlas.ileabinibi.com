// Accepts links ONLY from active streaming platforms and turns them into safe player embeds.
// Shared by the browser (Media page) and the Netlify function that looks up titles.
export const PLATFORMS = {
  spotify: { label: 'Spotify', color: '#1db954', glyph: '♫' },
  apple_music: { label: 'Apple Music', color: '#fa243c', glyph: '♪' },
  youtube: { label: 'YouTube', color: '#ff0033', glyph: '▶' },
  youtube_music: { label: 'YouTube Music', color: '#ff0033', glyph: '♫' },
  soundcloud: { label: 'SoundCloud', color: '#ff5500', glyph: '☁' },
  audiomack: { label: 'Audiomack', color: '#ffa200', glyph: '♬' },
  deezer: { label: 'Deezer', color: '#a238ff', glyph: '♪' },
  tidal: { label: 'Tidal', color: '#111111', glyph: '◈' },
  boomplay: { label: 'Boomplay', color: '#00b4e6', glyph: '♫' }
};
export const SUPPORTED_TEXT = 'Spotify, Apple Music, YouTube, YouTube Music, SoundCloud, Audiomack, Deezer, Tidal and Boomplay';
const fail = reason => ({ ok: false, reason });
const clean = s => String(s || '').replace(/[^\w.\-~%]/g, '');

export function parseMediaUrl(input) {
  let raw = String(input || '').trim();
  if (!raw) return fail('Paste a link first.');
  if (raw.length > 500) return fail('That link is too long.');
  const uri = /^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]{22})$/.exec(raw);   // spotify:track:ID
  if (uri) raw = `https://open.spotify.com/${uri[1]}/${uri[2]}`;
  let u; try { u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw); } catch { return fail('That does not look like a link.'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return fail('Use a normal web link.');
  const host = u.hostname.toLowerCase().replace(/^www\./, ''), segs = u.pathname.split('/').filter(Boolean);
  const out = (platform, kind, url, embedUrl, height) => ({ ok: true, platform, kind, url, embedUrl, height, label: PLATFORMS[platform].label });

  if (host === 'open.spotify.com') {
    const i = /^intl-/.test(segs[0] || '') ? 1 : 0, type = segs[i], id = segs[i + 1];
    if (!['track', 'album', 'playlist', 'artist', 'episode', 'show'].includes(type) || !/^[A-Za-z0-9]{22}$/.test(id || '')) return fail('Use a Spotify track, album, playlist, artist or podcast link.');
    return out('spotify', type, `https://open.spotify.com/${type}/${id}`, `https://open.spotify.com/embed/${type}/${id}?utm_source=generator`, type === 'track' || type === 'episode' ? 152 : 352);
  }
  if (host === 'music.apple.com' || host === 'embed.music.apple.com') {
    const type = segs[1]; if (segs.length < 3 || !['album', 'playlist', 'song', 'music-video'].includes(type)) return fail('Use an Apple Music song, album or playlist link.');
    const path = '/' + segs.map(clean).join('/'), i = /^\d+$/.test(u.searchParams.get('i') || '') ? `?i=${u.searchParams.get('i')}` : '';
    return out('apple_music', type === 'song' || i ? 'track' : type === 'music-video' ? 'video' : type, `https://music.apple.com${path}${i}`, `https://embed.music.apple.com${path}${i}`, type === 'song' || i ? 175 : 450);
  }
  if (['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) {
    const music = host === 'music.youtube.com'; let vid = null;
    if (host === 'youtu.be') vid = segs[0]; else if (segs[0] === 'watch') vid = u.searchParams.get('v'); else if (['shorts', 'embed', 'live'].includes(segs[0])) vid = segs[1];
    const list = u.searchParams.get('list');
    if (vid && /^[A-Za-z0-9_-]{11}$/.test(vid)) return out(music ? 'youtube_music' : 'youtube', 'video', `https://${music ? 'music.youtube.com' : 'www.youtube.com'}/watch?v=${vid}`, `https://www.youtube-nocookie.com/embed/${vid}?enablejsapi=1&rel=0`, 220);
    if (list && /^[A-Za-z0-9_-]{10,60}$/.test(list)) return out(music ? 'youtube_music' : 'youtube', 'playlist', `https://${music ? 'music.youtube.com' : 'www.youtube.com'}/playlist?list=${list}`, `https://www.youtube-nocookie.com/embed/videoseries?list=${list}&rel=0`, 300);
    return fail('Use a YouTube video or playlist link.');
  }
  if (host === 'soundcloud.com') {
    const RESERVED = ['discover', 'search', 'stream', 'you', 'upload', 'pages', 'popular', 'charts', 'terms-of-use', 'imprint', 'jobs', 'mobile', 'people', 'tags', 'feed'];
    if (segs.length < 2 || RESERVED.includes(segs[0])) return fail('Use a link to a SoundCloud track or playlist.');
    const path = '/' + segs.map(clean).join('/'), url = `https://soundcloud.com${path}`, set = segs[1] === 'sets';
    return out('soundcloud', set ? 'playlist' : 'track', url, `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23dca43c&auto_play=false&hide_related=true&show_comments=false&visual=false`, set ? 300 : 166);
  }
  if (host === 'on.soundcloud.com' || host === 'deezer.page.link' || host === 'spotify.link' || host === 'link.tidal.com') return fail('That is a short link. Open it, then copy the full link from the address bar.');
  if (host === 'audiomack.com') {
    const [artist, type, slug] = segs; if (!artist || !['song', 'album', 'playlist'].includes(type) || !slug) return fail('Use an Audiomack song, album or playlist link.');
    return out('audiomack', type === 'song' ? 'track' : type, `https://audiomack.com/${clean(artist)}/${type}/${clean(slug)}`, `https://audiomack.com/embed/${type}/${clean(artist)}/${clean(slug)}?background=1`, type === 'song' ? 252 : 400);
  }
  if (host === 'deezer.com') {
    const i = /^[a-z]{2}(-[a-z]{2})?$/i.test(segs[0] || '') ? 1 : 0, type = segs[i], id = segs[i + 1];
    if (!['track', 'album', 'playlist', 'artist', 'episode', 'show'].includes(type) || !/^\d+$/.test(id || '')) return fail('Use a Deezer track, album or playlist link.');
    return out('deezer', type, `https://www.deezer.com/${type}/${id}`, `https://widget.deezer.com/widget/auto/${type}/${id}`, type === 'track' ? 150 : 300);
  }
  if (host === 'tidal.com' || host === 'listen.tidal.com') {
    const i = segs[0] === 'browse' ? 1 : 0, type = segs[i], id = segs[i + 1], map = { track: 'tracks', album: 'albums', playlist: 'playlists', video: 'videos' };
    if (!map[type] || !/^[A-Za-z0-9-]{4,40}$/.test(id || '')) return fail('Use a Tidal track, album or playlist link.');
    return out('tidal', type, `https://tidal.com/browse/${type}/${id}`, `https://embed.tidal.com/${map[type]}/${id}`, type === 'track' ? 120 : 400);
  }
  if (host === 'boomplay.com' || host === 'm.boomplay.com') {
    const k = segs.find(s => ['songs', 'albums', 'playlists', 'artists', 'episodes', 'podcasts'].includes(s)), id = segs[segs.indexOf(k) + 1];
    if (!k || !/^\d+$/.test(id || '')) return fail('Use a Boomplay song, album or playlist link.');
    return out('boomplay', { songs: 'track', albums: 'album', playlists: 'playlist', artists: 'artist', episodes: 'episode', podcasts: 'show' }[k], `https://www.boomplay.com/${k}/${id}`, null, 0);   // Boomplay has no embed: it opens in Boomplay
  }
  return fail(`Only links from ${SUPPORTED_TEXT} are accepted.`);
}
/** The one place an iframe address is allowed to come from. */
export const ALLOWED_EMBED = /^https:\/\/(open\.spotify\.com\/embed\/|embed\.music\.apple\.com\/|www\.youtube-nocookie\.com\/embed\/|w\.soundcloud\.com\/player\/|audiomack\.com\/embed\/|widget\.deezer\.com\/widget\/|embed\.tidal\.com\/)/;
export const kindLabel = k => ({ track: 'Track', album: 'Album', playlist: 'Playlist', video: 'Video', artist: 'Artist', episode: 'Episode', show: 'Podcast' }[k] || 'Music');
