"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";
import { useClerk, useUser, useAuth } from "@clerk/nextjs";
import { authenticatedFetch, fetchMediaBlobUrl } from "@/lib/api";

type ProfileData = {
  display_name: string | null;
  bio: string | null;
  has_avatar: boolean;
  avatar_drive_file_id: string | null;
  avatar_account_index: number | null;
};

export default function Navbar({ onMenuOpen }: { onMenuOpen?: () => void }) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { theme, toggle } = useTheme();
  const [profile, setProfile] = useState<ProfileData>({
    display_name: null,
    bio: null,
    has_avatar: false,
    avatar_drive_file_id: null,
    avatar_account_index: null,
  });
  const [avatarKey, setAvatarKey] = useState(0);
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [saving, setSaving] = useState(false);
  const { getToken } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshProfile = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await authenticatedFetch("/api/profile", token);
      if (res.ok) {
        const d = await res.json();
        setProfile({
          display_name: d.display_name,
          bio: d.bio,
          has_avatar: d.has_avatar,
          avatar_drive_file_id: d.avatar_drive_file_id,
          avatar_account_index: d.avatar_account_index,
        });
      }
    } catch (err) {
      console.error("[Navbar] Fetch profile error:", err);
    }
  }, [getToken]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  async function handleSignOut() {
    await signOut({ redirectUrl: "/" });
  }

  function openModal() {
    setEditName(profile.display_name ?? "");
    setEditBio(profile.bio ?? "");
    setShowModal(true);
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const token = await getToken();
      await authenticatedFetch("/api/profile", token, {
        method: "PUT",
        body: JSON.stringify({ display_name: editName, bio: editBio }),
      });
      setProfile((prev) => ({
        ...prev,
        display_name: editName || null,
        bio: editBio || null,
      }));
      setShowModal(false);
    } catch (err) {
       console.error("[Navbar] Save profile error:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    try {
      const token = await getToken();
      await authenticatedFetch("/api/profile/avatar", token, { method: "POST", body: form });
      setAvatarKey((k) => k + 1);
      setAvatarLoaded(false);
      await refreshProfile();
    } catch (err) {
      console.error("[Navbar] Avatar upload error:", err);
    }
    e.target.value = "";
  }

  useEffect(() => {
    let active = true;
    let blobUrl = "";

    async function loadAvatar() {
      if (!profile.has_avatar || !profile.avatar_drive_file_id || profile.avatar_account_index == null) {
        setAvatarUrl(null);
        return;
      }

      try {
        const token = await getToken();
        blobUrl = await fetchMediaBlobUrl(`/api/profile/avatar?t=${avatarKey}`, token, {
          accountIndex: profile.avatar_account_index,
          driveFileId: profile.avatar_drive_file_id,
        });
        if (active) setAvatarUrl(blobUrl);
      } catch {
        if (active) setAvatarUrl(`/api/profile/avatar?t=${avatarKey}`);
      }
    }

    loadAvatar();
    return () => {
      active = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [
    avatarKey,
    getToken,
    profile.avatar_account_index,
    profile.avatar_drive_file_id,
    profile.has_avatar,
  ]);

  const resolvedAvatarUrl = avatarUrl || (!profile.has_avatar ? user?.imageUrl : null);
  const displayName = profile.display_name || user?.fullName || user?.firstName || "Profile";

  return (
    <>
      <header className="flex h-12 flex-none items-center justify-between border-b border-sd-border bg-sd-sidebar/80 backdrop-blur-md px-4">
        <button
          onClick={onMenuOpen}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sd-text3 hover:bg-sd-s2 hover:text-sd-text transition lg:hidden"
          title="Open menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        <div className="ml-auto flex items-center gap-1">
          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sd-text3 hover:bg-sd-s2 hover:text-sd-text transition"
            title="Toggle theme"
          >
            {theme === "dark" ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
              </svg>
            )}
          </button>

          <div className="h-4 w-px bg-sd-border mx-1" />

          {/* Profile */}
          <button
            onClick={openModal}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-sd-s2 transition"
          >
            <div className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-sd-border bg-sd-s2">
              <svg className="h-4 w-4 text-sd-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              {resolvedAvatarUrl && (
                <img
                  key={avatarKey}
                  src={resolvedAvatarUrl}
                  alt=""
                  className={`absolute inset-0 h-full w-full object-cover ${avatarLoaded ? "" : "hidden"}`}
                  onLoad={() => setAvatarLoaded(true)}
                  onError={() => setAvatarLoaded(false)}
                />
              )}
            </div>
            <span className="hidden text-xs font-medium text-sd-text sm:inline">
              {displayName}
            </span>
            <svg className="h-3 w-3 text-sd-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
            </svg>
          </button>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sd-text3 hover:bg-red-500/10 hover:text-red-400 transition"
            title="Sign out"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
            </svg>
          </button>
        </div>
      </header>

      {/* Profile modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-sd-border bg-sd-s1 p-6 shadow-card animate-fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top accent line */}
            <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-sd-accent/50 to-transparent" />

            <h2 className="mb-5 text-sm font-semibold text-sd-text">Edit Profile</h2>

            <div className="mb-5 flex items-center gap-4">
              <div className="relative">
                <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-sd-border bg-sd-s2">
                  <svg className="h-8 w-8 text-sd-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  {resolvedAvatarUrl && (
                    <img
                      key={avatarKey}
                      src={resolvedAvatarUrl}
                      alt=""
                      className={`absolute inset-0 h-full w-full object-cover ${avatarLoaded ? "" : "hidden"}`}
                      onLoad={() => setAvatarLoaded(true)}
                      onError={() => setAvatarLoaded(false)}
                    />
                  )}
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-sd-border bg-sd-s1 text-sd-text2 hover:text-sd-accent transition"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </div>
              <div className="text-xs text-sd-text2">
                <p className="font-medium text-sd-text">Profile Photo</p>
                <p className="mt-0.5 text-sd-text3">Stored in your Drive</p>
              </div>
            </div>

            <div className="mb-5 text-center">
              <p className="text-xs text-sd-text3 font-medium bg-sd-s2 py-2 px-3 rounded-xl inline-block">
                {user?.primaryEmailAddress?.emailAddress || "Google Account Connected"}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-sd-text2">Display Name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-lg border border-sd-border bg-sd-bg px-3 py-2 text-sm text-sd-text placeholder-sd-text3 outline-none focus:border-sd-accent/50 focus:ring-2 focus:ring-sd-accent/10 transition"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-sd-text2">Bio</label>
                <input
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="A short bio"
                  className="w-full rounded-lg border border-sd-border bg-sd-bg px-3 py-2 text-sm text-sd-text placeholder-sd-text3 outline-none focus:border-sd-accent/50 focus:ring-2 focus:ring-sd-accent/10 transition"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-lg border border-sd-border py-2 text-sm text-sd-text2 hover:bg-sd-s2 transition"
              >
                Cancel
              </button>
              <button
                onClick={saveProfile}
                disabled={saving}
                className="btn-primary flex-1 rounded-lg py-2 text-sm font-medium disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
