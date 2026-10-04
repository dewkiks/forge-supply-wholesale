/**
 * FileDownloadCard - Component for displaying file downloads from workflow outputs
 *
 * Use this component when workflows generate files (PowerPoint, Excel, PDF, etc.)
 * and you want to display a download button with file information.
 */

import { Download, FileText, FileSpreadsheet, FileImage, File } from 'lucide-react';
import React from 'react';

interface FileDownloadCardProps {
  filename: string;
  url: string;
  size?: number;
  type?: string;
  icon?: React.ReactNode;
  description?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string = '', filename: string = ''): React.ReactNode {
  const lowerType = type.toLowerCase();
  const lowerFilename = filename.toLowerCase();

  if (lowerType.includes('spreadsheet') || lowerFilename.endsWith('.xlsx') || lowerFilename.endsWith('.xls')) {
    return <FileSpreadsheet className="w-8 h-8 text-green-600" />;
  }
  if (lowerType.includes('presentation') || lowerFilename.endsWith('.pptx') || lowerFilename.endsWith('.ppt')) {
    return <FileText className="w-8 h-8 text-orange-600" />;
  }
  if (lowerType.includes('image') || lowerFilename.match(/\.(png|jpg|jpeg|gif|svg)$/)) {
    return <FileImage className="w-8 h-8 text-blue-600" />;
  }
  if (lowerType.includes('pdf') || lowerFilename.endsWith('.pdf')) {
    return <FileText className="w-8 h-8 text-red-600" />;
  }
  return <File className="w-8 h-8 text-gray-600" />;
}

export function FileDownloadCard({
  filename,
  url,
  size,
  type = '',
  icon,
  description
}: FileDownloadCardProps) {
  const displayIcon = icon || getFileIcon(type, filename);

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all">
      <div className="flex items-center gap-4">
        {/* File Icon */}
        <div className="flex-shrink-0">
          {displayIcon}
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{filename}</h3>
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
            {size && <span>{formatFileSize(size)}</span>}
            {description && (
              <>
                {size && <span>•</span>}
                <span>{description}</span>
              </>
            )}
          </div>
        </div>

        {/* Download Button */}
        <a
          href={url}
          download={filename}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
          onClick={(e) => {
            // Prevent default for external URLs (S3, etc.)
            if (url.startsWith('http')) {
              e.preventDefault();
              window.open(url, '_blank');
            }
          }}
        >
          <Download className="w-4 h-4" />
          <span>Download</span>
        </a>
      </div>
    </div>
  );
}

export default FileDownloadCard;
