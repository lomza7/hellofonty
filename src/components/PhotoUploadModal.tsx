import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Plus, Upload, Image as ImageIcon } from 'lucide-react';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (files: File[]) => void;
  language: 'fr' | 'en';
}

export default function PhotoUploadModal({ isOpen, onClose, onImport, language }: PhotoUploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setSelectedFiles([]);
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const images = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (images.length > 0) {
      setSelectedFiles(prev => [...prev, ...images]);
    }
  }, []);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleImport = () => {
    if (selectedFiles.length > 0) {
      onImport(selectedFiles);
      setSelectedFiles([]);
      onClose();
    }
  };

  const handleFinish = () => {
    if (selectedFiles.length > 0) {
      onImport(selectedFiles);
      setSelectedFiles([]);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 -ml-1.5 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>

          <div className="text-center flex-1">
            <h3 className="text-base font-semibold text-gray-900">
              {language === 'fr' ? 'Ajoutez des photos' : 'Add photos'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {selectedFiles.length === 0
                ? (language === 'fr' ? 'Aucun element selectionne' : 'No items selected')
                : `${selectedFiles.length} ${language === 'fr' ? 'photo(s) selectionnee(s)' : 'photo(s) selected'}`
              }
            </p>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 -mr-1.5 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Plus className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {selectedFiles.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-5">
              {selectedFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="absolute top-1.5 right-1.5 p-1 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="absolute bottom-1.5 left-1.5 bg-black/60 text-white px-1.5 py-0.5 rounded text-[10px] font-medium">
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200
              ${isDragging
                ? 'border-rose-400 bg-rose-50 scale-[1.01]'
                : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="flex flex-col items-center gap-3">
              {isDragging ? (
                <Upload className="w-10 h-10 text-rose-400" />
              ) : (
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                  <ImageIcon className="w-7 h-7 text-gray-400" />
                </div>
              )}

              <div>
                <p className="text-base font-semibold text-gray-800">
                  {isDragging
                    ? (language === 'fr' ? 'Deposez ici' : 'Drop here')
                    : (language === 'fr' ? 'Glissez-deposez un fichier' : 'Drag & drop a file')
                  }
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {language === 'fr' ? 'ou recherchez des photos' : 'or browse for photos'}
                </p>
              </div>

              <button
                type="button"
                className="mt-1 px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 active:scale-95 transition-all"
              >
                {language === 'fr' ? 'Parcourir' : 'Browse'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleFinish}
            className="text-sm font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900 transition-colors"
          >
            {language === 'fr' ? 'Termine' : 'Done'}
          </button>

          <button
            type="button"
            onClick={handleImport}
            disabled={selectedFiles.length === 0}
            className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-all ${
              selectedFiles.length > 0
                ? 'bg-rose-500 text-white hover:bg-rose-600 active:scale-95 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {language === 'fr' ? 'Importer' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
