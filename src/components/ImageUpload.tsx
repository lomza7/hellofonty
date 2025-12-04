import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ImageUploadProps {
  onImageUploaded: (url: string) => void;
  currentImageUrl?: string;
  language?: 'fr' | 'en';
}

export default function ImageUpload({ onImageUploaded, currentImageUrl, language = 'fr' }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      await uploadImage(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && files[0].type.startsWith('image/')) {
      await uploadImage(files[0]);
    }
  };

  const uploadImage = async (file: File) => {
    try {
      setUploading(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `blog/${fileName}`;

      const { data, error } = await supabase.storage
        .from('images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      setPreview(publicUrl);
      onImageUploaded(publicUrl);
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(language === 'fr'
        ? 'Erreur lors de l\'upload: ' + error.message
        : 'Upload error: ' + error.message
      );
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onImageUploaded('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-64 object-cover rounded-lg border border-gray-300"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
            transition-all duration-200
            ${isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50'
            }
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          <div className="flex flex-col items-center gap-4">
            {uploading ? (
              <>
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-600 font-medium">
                  {language === 'fr' ? 'Upload en cours...' : 'Uploading...'}
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  {isDragging ? (
                    <Upload className="w-8 h-8 text-blue-600" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-blue-600" />
                  )}
                </div>
                <div>
                  <p className="text-gray-700 font-medium mb-1">
                    {language === 'fr'
                      ? 'Glissez une image ici ou cliquez pour sélectionner'
                      : 'Drag an image here or click to select'
                    }
                  </p>
                  <p className="text-sm text-gray-500">
                    {language === 'fr'
                      ? 'PNG, JPG, GIF jusqu\'à 10MB'
                      : 'PNG, JPG, GIF up to 10MB'
                    }
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
