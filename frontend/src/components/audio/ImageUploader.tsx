"use client"

import { useState, useRef } from 'react';
import { X, ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploaderProps {
    onImageSelected?: (base64Image: string, mimeType: string) => void;
    disabled?: boolean;
}

export function ImageUploader({ onImageSelected, disabled }: ImageUploaderProps) {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const isProcessing = false;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            setSelectedImage(result);

            if (onImageSelected) {
                // Extract base64 part and mime type
                const split = result.split(',');
                const mimeType = split[0].match(/:(.*?);/)?.[1] || file.type;
                const base64 = split[1];
                onImageSelected(base64, mimeType);
            }
        };
        reader.readAsDataURL(file);
    };

    const clearImage = () => {
        setSelectedImage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto mt-6">
            <div className={cn(
                "relative rounded-2xl border transition-all duration-300 overflow-hidden",
                selectedImage ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10 bg-zinc-900/30 hover:bg-zinc-900/50 hover:border-white/20"
            )}>

                {!selectedImage ? (
                    <label className="flex flex-col items-center justify-center w-full h-32 cursor-pointer group">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6 space-y-2">
                            <div className="p-3 rounded-full bg-zinc-800 group-hover:bg-zinc-700 transition-colors">
                                <ImageIcon className="w-6 h-6 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
                            </div>
                            <p className="text-sm text-zinc-400">
                                <span className="font-semibold text-zinc-300">Click to upload</span> or drag and drop a receipt
                            </p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                            disabled={disabled || isProcessing}
                        />
                    </label>
                ) : (
                    <div className="relative h-48 w-full p-4 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={selectedImage}
                            alt="Uploaded receipt preview"
                            className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
                        />

                        <button
                            onClick={clearImage}
                            className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-red-500/80 text-white rounded-full backdrop-blur transition-colors"
                            title="Remove image"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="absolute bottom-3 right-3">
                            <div className="px-3 py-1.5 bg-black/60 backdrop-blur rounded-lg text-xs font-medium text-emerald-400 flex items-center space-x-2">
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        <span>Analyzing...</span>
                                    </>
                                ) : (
                                    <span>Ready for analysis</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
