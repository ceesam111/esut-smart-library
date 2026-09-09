// ── Media Centre data ─────────────────────────────────────────────────────────
// Config-driven so additional Spotify shows, YouTube channels/playlists, and
// photo album links can be supplied later without touching component code.

export const MEDIA_SUBJECTS = [
  'All',
  'Education',
  'Science',
  'Humanities',
  'Technology',
  'Health',
  'Arts & Culture',
  'General Learning',
] as const;

export type MediaSubject = (typeof MEDIA_SUBJECTS)[number];

// ── Podcasts ──────────────────────────────────────────────────────────────────
// `spotifyId` (show or episode id) renders a Spotify iframe embed.
// `embedUrl` renders a generic iframe. Otherwise a link card is shown.
export interface Podcast {
  id: string;
  name: string;
  description: string;
  subject: MediaSubject;
  /** Spotify show/episode id, e.g. "4rOoJ6Egrf8K2IrywzwOMk" */
  spotifyId?: string;
  /** Spotify embed type — defaults to "show" */
  spotifyType?: 'show' | 'episode';
  /** Generic iframe embed URL (e.g. TED audio) */
  embedUrl?: string;
  /** Fallback external link when no embed available */
  link?: string;
}

export const PODCASTS: Podcast[] = [
  {
    id: 'ted-ed',
    name: 'TED-Ed',
    description:
      'Short, animated lessons from educators around the world — curiosity-driven learning across every discipline.',
    subject: 'General Learning',
    embedUrl: 'https://embed.ted.com',
    link: 'https://www.ted.com/talks',
  },
  {
    id: 'bbc-learning-english',
    name: 'BBC Learning English',
    description:
      'Daily English-language learning episodes — vocabulary, grammar, pronunciation and real-world conversation practice.',
    subject: 'Humanities',
    link: 'https://www.bbc.co.uk/learningenglish',
  },
  {
    id: 'nature-podcast',
    name: 'Nature Podcast',
    description:
      'The world’s leading science journal brings you the latest research, discoveries and the people behind the science.',
    subject: 'Science',
    link: 'https://www.nature.com/nature/articles?type=nature-podcast',
  },
  {
    id: 'jstor-daily',
    name: 'JSTOR Daily',
    description:
      'Scholarship for everyday life — stories that connect current events to peer-reviewed research from the JSTOR library.',
    subject: 'Arts & Culture',
    link: 'https://daily.jstor.org/tag/podcast/',
  },
];

// ── Videos ──────────────────────────────────────────────────────────────────
// `videoId` embeds a single YouTube video. `playlistId` embeds a playlist.
// `channelId` links to a channel (YouTube does not allow channel iframes,
// so we embed the channel's uploads via the "videoseries" list when supplied).
export interface VideoItem {
  id: string;
  title: string;
  channel: string;
  description: string;
  subject: MediaSubject;
  /** Single YouTube video id */
  videoId?: string;
  /** YouTube playlist id */
  playlistId?: string;
  /** Channel id (used for thumbnail + link) */
  channelId?: string;
}

export const VIDEOS: VideoItem[] = [
  {
    id: 'ted',
    title: 'TED Talks',
    channel: 'TED',
    description: 'Ideas worth spreading — talks from the world’s most inspiring thinkers and doers.',
    subject: 'General Learning',
    channelId: 'UCAuUUnT6oDeKwE6v1NGQxug',
    videoId: 'arj7oStGLkU',
  },
  {
    id: 'khan-academy',
    title: 'Khan Academy',
    channel: 'Khan Academy',
    description: 'Free, world-class lessons in maths, science, economics and more for every learner.',
    subject: 'Education',
    channelId: 'UC4a-Gbdw7vOaccHmFo40b9g',
    videoId: 'sFEjQYM9q3o',
  },
  {
    id: 'crash-course',
    title: 'Crash Course',
    channel: 'Crash Course',
    description: 'Fast, fun and thorough courses across science, history, literature and the humanities.',
    subject: 'Science',
    channelId: 'UCX6b17PVsYBQ0ip5gyeme-Q',
    videoId: 'YvtCLceNf30',
  },
  {
    id: 'national-geographic',
    title: 'National Geographic',
    channel: 'National Geographic',
    description: 'Exploring our planet — wildlife, science, culture and the people protecting it.',
    subject: 'Science',
    channelId: 'UCpVm7bg6pXKo1Pr6k5kxG9A',
    videoId: '6v2L2UGZJAM',
  },
];

// ── Photos ────────────────────────────────────────────────────────────────────
// Supply Google Photos shared album links or direct image URLs to populate.
// While empty, the page shows a friendly "coming soon" placeholder.
export interface PhotoItem {
  id: string;
  src: string;
  caption?: string;
  subject?: MediaSubject;
}

export const PHOTOS: PhotoItem[] = [
  // Example shape (add real URLs later):
  // { id: 'p1', src: 'https://...image.jpg', caption: 'Library Week 2026', subject: 'Arts & Culture' },
];

/** Optional Google Photos shared album link — set to embed/link the full album. */
export const GOOGLE_PHOTOS_ALBUM_URL: string | null = null;
