import { useEffect, useRef } from 'react';
import OpenSeadragon from 'openseadragon';

interface Props {
  imageUrl: string;
  onClose: () => void;
}

const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|tiff?|webp|bmp)(\?.*)?$/i;

export function isImageFile(url: string | null | undefined): boolean {
  if (!url) return false;
  return IMAGE_EXTS.test(url);
}

export default function ImageViewer({ imageUrl, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef    = useRef<OpenSeadragon.Viewer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    viewerRef.current = OpenSeadragon({
      element: containerRef.current,
      tileSources: {
        type: 'image',
        url: imageUrl,
      },
      showNavigator: false,
      showNavigationControl: true,
      showZoomControl: true,
      showHomeControl: true,
      showFullPageControl: true,
      zoomInButton:    'osd-zoom-in',
      zoomOutButton:   'osd-zoom-out',
      homeButton:      'osd-home',
      fullPageButton:  'osd-fullscreen',
      rotateLeftButton:  'osd-rotate-left',
      rotateRightButton: 'osd-rotate-right',
      showRotationControl: true,
      navigationControlAnchor: OpenSeadragon.ControlAnchor.TOP_LEFT,
      gestureSettingsMouse: { scrollToZoom: true },
      gestureSettingsTouch: { pinchToZoom: true },
      crossOriginPolicy: 'Anonymous',
      animationTime: 0.3,
    });

    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [imageUrl]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-neutral-50">
        <span className="text-sm font-semibold text-neutral-700">Image Viewer</span>
        <div className="flex items-center gap-2">
          <button id="osd-rotate-left"  title="Rotate left"  className="text-neutral-500 hover:text-neutral-800 px-2 py-1 text-xs border rounded">↺ Rotate</button>
          <button id="osd-rotate-right" title="Rotate right" className="text-neutral-500 hover:text-neutral-800 px-2 py-1 text-xs border rounded">↻</button>
          <button id="osd-zoom-in"      title="Zoom in"      className="text-neutral-500 hover:text-neutral-800 px-2 py-1 text-xs border rounded">+ Zoom</button>
          <button id="osd-zoom-out"     title="Zoom out"     className="text-neutral-500 hover:text-neutral-800 px-2 py-1 text-xs border rounded">−</button>
          <button id="osd-home"         title="Reset"        className="text-neutral-500 hover:text-neutral-800 px-2 py-1 text-xs border rounded">⌂</button>
          <button id="osd-fullscreen"   title="Fullscreen"   className="text-neutral-500 hover:text-neutral-800 px-2 py-1 text-xs border rounded">⛶</button>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-xl leading-none ml-2">×</button>
        </div>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: '600px', background: '#111' }} />
    </div>
  );
}
