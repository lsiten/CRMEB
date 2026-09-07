import { useEffect, useRef, useState } from 'react';
import { chooseAndUploadImage } from '../services/image-upload';
import { commerceError } from '../services/commerce-contracts';

export function useImageAttachments(limit: number) {
  const [images, setImages] = useState<readonly string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const current = useRef<readonly string[]>([]);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const choose = async (): Promise<void> => {
    if (busy.current || current.current.length >= limit) return;
    busy.current = true; setUploading(true); setError('');
    try {
      const url = await chooseAndUploadImage();
      if (!mounted.current || !url) return;
      current.current = [...current.current, url];
      setImages(current.current);
    } catch (cause) { if (mounted.current) setError(commerceError(cause)); }
    finally { busy.current = false; if (mounted.current) setUploading(false); }
  };
  const remove = (index: number): void => {
    if (busy.current) return;
    current.current = current.current.filter((_, position) => position !== index);
    setImages(current.current); setError('');
  };
  return { images, uploading, error, choose, remove, isUploading: () => busy.current, getImages: () => current.current };
}
