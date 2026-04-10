import { useState, useRef, useCallback } from 'react';
import { X, RotateCw, GripVertical } from 'lucide-react';

interface DraggableImage {
  id: string;
  url: string;
  isNew?: boolean;
  file?: File;
}

interface DraggableImageGridProps {
  images: DraggableImage[];
  onReorder: (images: DraggableImage[]) => void;
  onRemove: (id: string) => void;
  onRotate: (id: string) => void;
  rotations: { [key: string]: number };
  language: 'fr' | 'en';
}

export default function DraggableImageGrid({
  images,
  onReorder,
  onRemove,
  onRotate,
  rotations,
  language,
}: DraggableImageGridProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [touchDragIndex, setTouchDragIndex] = useState<number | null>(null);
  const [touchOverIndex, setTouchOverIndex] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    const el = e.currentTarget as HTMLElement;
    requestAnimationFrame(() => {
      el.style.opacity = '0.5';
    });
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '1';
    setDraggedIndex(null);
    setOverIndex(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const fromIndex = draggedIndex;
    if (fromIndex === null || fromIndex === dropIndex) {
      setDraggedIndex(null);
      setOverIndex(null);
      return;
    }

    const newImages = [...images];
    const [moved] = newImages.splice(fromIndex, 1);
    newImages.splice(dropIndex, 0, moved);
    onReorder(newImages);
    setDraggedIndex(null);
    setOverIndex(null);
  }, [draggedIndex, images, onReorder]);

  const getTouchTarget = useCallback((touchX: number, touchY: number): number | null => {
    for (const [index, el] of itemRefs.current.entries()) {
      const rect = el.getBoundingClientRect();
      if (
        touchX >= rect.left &&
        touchX <= rect.right &&
        touchY >= rect.top &&
        touchY <= rect.bottom
      ) {
        return index;
      }
    }
    return null;
  }, []);

  const handleTouchStart = useCallback((index: number) => {
    setTouchDragIndex(index);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchDragIndex === null) return;
    const touch = e.touches[0];
    const target = getTouchTarget(touch.clientX, touch.clientY);
    setTouchOverIndex(target);
  }, [touchDragIndex, getTouchTarget]);

  const handleTouchEnd = useCallback(() => {
    if (touchDragIndex !== null && touchOverIndex !== null && touchDragIndex !== touchOverIndex) {
      const newImages = [...images];
      const [moved] = newImages.splice(touchDragIndex, 1);
      newImages.splice(touchOverIndex, 0, moved);
      onReorder(newImages);
    }
    setTouchDragIndex(null);
    setTouchOverIndex(null);
  }, [touchDragIndex, touchOverIndex, images, onReorder]);

  const setItemRef = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) {
      itemRefs.current.set(index, el);
    } else {
      itemRefs.current.delete(index);
    }
  }, []);

  if (images.length === 0) return null;

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4"
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {images.map((img, index) => {
        const isDragged = draggedIndex === index || touchDragIndex === index;
        const isOver = overIndex === index || touchOverIndex === index;
        const rotation = rotations[img.id] || 0;

        return (
          <div
            key={img.id}
            ref={(el) => setItemRef(index, el)}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onTouchStart={() => handleTouchStart(index)}
            className={`
              relative group cursor-grab active:cursor-grabbing select-none
              transition-all duration-200 ease-out
              ${isDragged ? 'opacity-40 scale-95' : 'opacity-100 scale-100'}
              ${isOver && !isDragged ? 'ring-2 ring-rose-400 ring-offset-2 scale-[1.02]' : ''}
            `}
          >
            <div className="relative overflow-hidden rounded-lg sm:rounded-xl bg-gray-100 aspect-[4/3]">
              <img
                src={img.url}
                alt={`Photo ${index + 1}`}
                style={{ transform: `rotate(${rotation}deg)` }}
                className="w-full h-full object-cover transition-transform pointer-events-none"
                draggable={false}
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg sm:rounded-xl" />

              <div className="absolute top-2 left-2 flex items-center gap-1.5">
                <div className="bg-white/90 backdrop-blur-sm text-gray-900 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md">
                  {index + 1}
                </div>
                {index === 0 && (
                  <div className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md">
                    {language === 'fr' ? 'Couverture' : 'Cover'}
                  </div>
                )}
                {img.isNew && (
                  <div className="bg-emerald-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md">
                    {language === 'fr' ? 'Nouveau' : 'New'}
                  </div>
                )}
              </div>

              <div className="absolute top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-white/90 backdrop-blur-sm rounded-full p-1 shadow-md">
                  <GripVertical className="w-4 h-4 text-gray-500" />
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(img.id); }}
                className="absolute top-2 right-2 p-1.5 bg-red-500/90 backdrop-blur-sm text-white rounded-full opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:scale-110 active:scale-90 shadow-md"
              >
                <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </button>

              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRotate(img.id); }}
                  className="p-1.5 bg-white/90 backdrop-blur-sm text-gray-700 rounded-full hover:bg-white hover:scale-110 active:scale-90 transition-all shadow-md"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
