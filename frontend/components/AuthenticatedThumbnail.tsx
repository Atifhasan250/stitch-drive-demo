"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { fetchThumbnailBlobUrl } from "@/lib/api";
import { FileTypeIcon } from "./FileRow";

export function AuthenticatedThumbnail({
  fileId,
  mimeType,
  className = "h-8 w-8 rounded-lg object-cover shadow-sm border border-sd-border/50",
}: {
  fileId: string;
  mimeType: string | null;
  className?: string;
}) {
  const { getToken } = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!inView) return;

    let active = true;
    let allocatedUrl = "";

    const loadThumb = async () => {
      try {
        const token = await getToken();
        const nextUrl = await fetchThumbnailBlobUrl(fileId, token);
        if (!active) {
          URL.revokeObjectURL(nextUrl);
          return;
        }
        allocatedUrl = nextUrl;
        setUrl(nextUrl);
        setError(false);
      } catch {
        if (active) setError(true);
      }
    };

    loadThumb();

    return () => {
      active = false;
      if (allocatedUrl) URL.revokeObjectURL(allocatedUrl);
    };
  }, [fileId, getToken, inView]);

  return (
    <div 
      className={className}
      ref={(el) => {
        if (!el || inView) return;
        const observer = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        }, { rootMargin: "100px" });
        observer.observe(el);
      }}
    >
      {(error || !url) ? (
        <FileTypeIcon mimeType={mimeType} />
      ) : (
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover rounded-lg"
          onError={() => setError(true)}
        />
      )}
    </div>
  );
}
