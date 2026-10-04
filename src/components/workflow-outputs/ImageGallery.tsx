/**
 * ImageGallery - Component for displaying image outputs from workflows
 *
 * Use this component when workflows generate multiple images and you want
 * to display them in a responsive grid gallery.
 */

import React, { useState } from 'react';
import { X, Download, ZoomIn } from 'lucide-react';

interface ImageFile {
  filename: string;
  download_url: string;
  size?: number;
  type?: string;
}

interface ImageGalleryProps {
  images: ImageFile[];
  columns?: 2 | 3 | 4;
  showFilenames?: boolean;
}

export function ImageGallery({
  images,
  columns = 3,
  showFilenames = true
}: ImageGalleryProps) {
  const [lightboxImage, setLightboxImage] = useState<ImageFile | null>(null);

  const gridClass = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
  }[columns];

  return (
    <>
      <div className={`grid ${gridClass} gap-4`}>
        {images.map((img, idx) => (
          <div
            key={idx}
            className="group relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50 hover:border-gray-300 transition-all"
          >
            {/* Image */}
            <div className="relative aspect-square overflow-hidden bg-gray-100">
              <img
                src={img.download_url}
                alt={img.filename}
                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setLightboxImage(img)}
                loading="lazy"
              />

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={() => setLightboxImage(img)}
                  className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                  title="View fullsize"
                >
                  <ZoomIn className="w-5 h-5 text-gray-800" />
                </button>
                <a
                  href={img.download_url}
                  download={img.filename}
                  className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                  title="Download"
                  onClick={(e) => {
                    if (img.download_url.startsWith('http')) {
                      e.preventDefault();
                      window.open(img.download_url, '_blank');
                    }
                  }}
                >
                  <Download className="w-5 h-5 text-gray-800" />
                </a>
              </div>
            </div>

            {/* Filename */}
            {showFilenames && (
              <div className="p-2 text-sm text-center truncate text-gray-700">
                {img.filename}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            onClick={() => setLightboxImage(null)}
          >
            <X className="w-6 h-6 text-white" />
          </button>

          <div className="max-w-7xl max-h-[90vh] flex flex-col items-center gap-4">
            <img
              src={lightboxImage.download_url}
              alt={lightboxImage.filename}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="text-white text-center">
              <p className="font-medium">{lightboxImage.filename}</p>
              <a
                href={lightboxImage.download_url}
                download={lightboxImage.filename}
                className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                onClick={(e) => {
                  if (lightboxImage.download_url.startsWith('http')) {
                    e.preventDefault();
                    window.open(lightboxImage.download_url, '_blank');
                  }
                }}
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ImageGallery;
