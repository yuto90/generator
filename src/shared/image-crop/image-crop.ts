import type { CSSProperties } from 'react';
import type { PercentCrop, PixelCrop } from 'react-image-crop';

export type { PercentCrop, PixelCrop } from 'react-image-crop';

export type ImageMatteColor = 'black' | 'white';

export interface EditableImage {
  originalSrc: string | null;
  displaySrc: string;
  fit: 'cover' | 'contain';
  crop?: PercentCrop;
  matteColor: ImageMatteColor;
}

const MAX_EDGE = 4096;
const MAX_PIXELS = 16_777_216;

export function createEditableImage(displaySrc: string, originalSrc: string | null = null): EditableImage {
  return {
    originalSrc,
    displaySrc,
    fit: 'cover',
    matteColor: 'black',
  };
}

export function centerAspectCrop(width: number, height: number, aspect: number): PercentCrop {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || !Number.isFinite(aspect) || aspect <= 0) {
    return { unit: '%', x: 0, y: 0, width: 100, height: 100 };
  }

  const imageAspect = width / height;
  if (imageAspect > aspect) {
    const cropWidth = (aspect / imageAspect) * 100;
    return { unit: '%', x: (100 - cropWidth) / 2, y: 0, width: cropWidth, height: 100 };
  }

  const cropHeight = (imageAspect / aspect) * 100;
  return { unit: '%', x: 0, y: (100 - cropHeight) / 2, width: 100, height: cropHeight };
}

export function percentCropToPixelCrop(crop: PercentCrop | PixelCrop, width: number, height: number): PixelCrop {
  if (crop.unit === 'px') {
    return {
      unit: 'px',
      x: Math.round(crop.x),
      y: Math.round(crop.y),
      width: Math.round(crop.width),
      height: Math.round(crop.height),
    };
  }

  return {
    unit: 'px',
    x: Math.round((crop.x / 100) * width),
    y: Math.round((crop.y / 100) * height),
    width: Math.round((crop.width / 100) * width),
    height: Math.round((crop.height / 100) * height),
  };
}

export function getEditableImageStyle(image: EditableImage): CSSProperties {
  return {
    backgroundImage: `url(${JSON.stringify(image.displaySrc)})`,
    backgroundSize: image.fit,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundColor: image.matteColor === 'white' ? '#fff' : '#000',
  };
}

export async function cropImageToDataUrl(image: HTMLImageElement, crop: PixelCrop): Promise<string> {
  if (crop.width <= 0 || crop.height <= 0 || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    throw new Error('Invalid image crop');
  }

  const bounds = image.getBoundingClientRect();
  const renderedWidth = bounds.width || image.width || image.naturalWidth;
  const renderedHeight = bounds.height || image.height || image.naturalHeight;
  if (renderedWidth <= 0 || renderedHeight <= 0) {
    throw new Error('Invalid image bounds');
  }

  const scaleX = image.naturalWidth / renderedWidth;
  const scaleY = image.naturalHeight / renderedHeight;
  const sourceX = Math.max(0, Math.min(image.naturalWidth, crop.x * scaleX));
  const sourceY = Math.max(0, Math.min(image.naturalHeight, crop.y * scaleY));
  const sourceWidth = Math.min(image.naturalWidth - sourceX, crop.width * scaleX);
  const sourceHeight = Math.min(image.naturalHeight - sourceY, crop.height * scaleY);
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('Invalid source crop');
  }

  const outputScale = Math.min(
    1,
    MAX_EDGE / Math.max(sourceWidth, sourceHeight),
    Math.sqrt(MAX_PIXELS / (sourceWidth * sourceHeight)),
  );
  const outputWidth = Math.max(1, Math.round(sourceWidth * outputScale));
  const outputHeight = Math.max(1, Math.round(sourceHeight * outputScale));
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas context is unavailable');
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  );
  return canvas.toDataURL('image/png');
}
