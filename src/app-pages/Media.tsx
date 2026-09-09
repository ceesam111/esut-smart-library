import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  MEDIA_SUBJECTS,
  PODCASTS,
  VIDEOS,
  PHOTOS,
  GOOGLE_PHOTOS_ALBUM_URL,
  type MediaSubject,
} from '@/data/media';

type Tab = 'podcasts' | 'videos' | 'photos';

export default function Media() {
  usePageTitle('Media Centre');
  const [tab, setTab] = useState<Tab>('podcasts');
  const [subject, setSubject] = useState<MediaSubject>('All');
  const [lightbox, setLightbox] = useState<string | null>(null);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'podcasts', label: 'Podcasts', icon: '🎧' },
    { key: 'videos', label: 'Videos', icon: '🎬' },
    { key: 'photos', label: 'Photos', icon: '📷' },
  ];

  const filteredPodcasts = useMemo(
    () => PODCASTS.filter((p) => subject === 'All' || p.subject === subject),
    [subject],
  );
  const filteredVideos = useMemo(
    () => VIDEOS.filter((v) => subject === 'All' || v.subject === subject),
    [subject],
  );

  return (
    <div>
      <div className="page-header">
        <div className="section">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-white/60 text-sm mb-4 font-medium">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>›</span>
              <span>Media Centre</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">Media Centre</h1>
            <p className="text-white/75 text-lg">
              Academic podcasts, learning videos and gallery — curated open-access media for ESUT.
            </p>
          </div>
        </div>
      </div>

      <div className="section py-8">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-neutral-200 mb-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? 'border-primary-700 text-primary-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <span className="mr-1.5">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Subject filter (podcasts + videos) */}
        {tab !== 'photos' && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-thin">
            {MEDIA_SUBJECTS.map((s) => (
              <button
                key={s}
                onClick={() => setSubject(s)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  subject === s
                    ? 'bg-primary-700 text-white'
                    : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* PODCASTS */}
        {tab === 'podcasts' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredPodcasts.map((p) => (
              <div key={p.id} className="card p-5 flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-bold text-neutral-900">{p.name}</h3>
                  <span className="badge-primary shrink-0">{p.subject}</span>
                </div>
                <p className="text-sm text-neutral-600 leading-relaxed mb-4 flex-1">{p.description}</p>

                {p.spotifyId ? (
                  <iframe
                    title={p.name}
                    className="w-full rounded-lg"
                    style={{ height: p.spotifyType === 'episode' ? 152 : 232 }}
                    src={`https://open.spotify.com/embed/${p.spotifyType ?? 'show'}/${p.spotifyId}`}
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                  />
                ) : p.embedUrl ? (
                  <a
                    href={p.embedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline w-full"
                  >
                    Open player ↗
                  </a>
                ) : p.link ? (
                  <a href={p.link} target="_blank" rel="noopener noreferrer" className="btn-outline w-full">
                    Listen ↗
                  </a>
                ) : null}
              </div>
            ))}
            {filteredPodcasts.length === 0 && (
              <p className="text-neutral-500 col-span-full text-center py-10">No podcasts in this subject yet.</p>
            )}
          </div>
        )}

        {/* VIDEOS */}
        {tab === 'videos' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredVideos.map((v) => {
              const embedSrc = v.playlistId
                ? `https://www.youtube.com/embed/videoseries?list=${v.playlistId}`
                : v.videoId
                ? `https://www.youtube.com/embed/${v.videoId}`
                : null;
              return (
                <div key={v.id} className="card overflow-hidden flex flex-col">
                  <div className="aspect-video bg-neutral-900">
                    {embedSrc ? (
                      <iframe
                        title={v.title}
                        className="w-full h-full"
                        src={embedSrc}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-bold text-neutral-900 text-sm leading-snug">{v.title}</h3>
                      <span className="badge-secondary shrink-0">{v.subject}</span>
                    </div>
                    <p className="text-xs text-neutral-500 mb-2">{v.channel}</p>
                    <p className="text-sm text-neutral-600 leading-relaxed flex-1">{v.description}</p>
                    {v.channelId && (
                      <a
                        href={`https://www.youtube.com/channel/${v.channelId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary-700 hover:underline mt-3"
                      >
                        Visit channel ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredVideos.length === 0 && (
              <p className="text-neutral-500 col-span-full text-center py-10">No videos in this subject yet.</p>
            )}
          </div>
        )}

        {/* PHOTOS */}
        {tab === 'photos' && (
          <div>
            {PHOTOS.length === 0 ? (
              <div className="card p-12 text-center max-w-lg mx-auto">
                <div className="text-5xl mb-4">📷</div>
                <h3 className="font-bold text-neutral-800 text-lg mb-1">Photo gallery coming soon</h3>
                <p className="text-neutral-500 text-sm">
                  Our gallery of library events, workshops and campus life will appear here shortly.
                </p>
                {GOOGLE_PHOTOS_ALBUM_URL && (
                  <a
                    href={GOOGLE_PHOTOS_ALBUM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary mt-5 inline-flex"
                  >
                    View album ↗
                  </a>
                )}
              </div>
            ) : (
              <div className="columns-2 md:columns-3 lg:columns-4 gap-4 [column-fill:_balance]">
                {PHOTOS.map((ph) => (
                  <button
                    key={ph.id}
                    onClick={() => setLightbox(ph.src)}
                    className="mb-4 block w-full overflow-hidden rounded-xl border border-neutral-100 group"
                  >
                    <img
                      src={ph.src}
                      alt={ph.caption ?? 'Gallery photo'}
                      loading="lazy"
                      className="w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {ph.caption && (
                      <span className="block text-xs text-neutral-500 px-2 py-1 text-left">{ph.caption}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="section pb-10 text-xs text-neutral-400">
        Media is curated for academic support. ESUT Smart Library does not endorse third-party platforms.
      </p>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            ×
          </button>
          <img src={lightbox} alt="" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}
