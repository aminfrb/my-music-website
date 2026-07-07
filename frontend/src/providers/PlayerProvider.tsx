"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { gql } from "@/lib/graphql";
import { RECORD_PLAY } from "@/lib/queries";
import type { Music } from "@/lib/types";

interface PlayerContextValue {
  queue: Music[];
  index: number;
  current: Music | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  /** Play a track; optionally provide the list it belongs to as the queue. */
  playTrack: (track: Music, queue?: Music[]) => void;
  /** Play a list starting at an index. */
  playQueue: (tracks: Music[], startIndex?: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  /** Stop playback entirely and dismiss the player bar. */
  close: () => void;
  isCurrent: (id: string) => boolean;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<Music[]>([]);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);

  const current = queue[index] ?? null;
  // Guards so we record each play once, and only for meaningful listens.
  const recordedRef = useRef<Set<string>>(new Set());

  const recordPlay = useCallback((musicId: string, seconds: number) => {
    if (recordedRef.current.has(musicId)) return;
    recordedRef.current.add(musicId);
    void gql(RECORD_PLAY, { musicId, seconds }).catch(() => {
      recordedRef.current.delete(musicId);
    });
  }, []);

  const playIndex = useCallback((tracks: Music[], i: number) => {
    setQueue(tracks);
    setIndex(i);
    // Load + play happens in the effect below once `current` changes.
    const audio = audioRef.current;
    if (audio && tracks[i]) {
      audio.src = tracks[i].streamUrl;
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, []);

  const playQueue = useCallback(
    (tracks: Music[], startIndex = 0) => {
      if (!tracks.length) return;
      playIndex(tracks, Math.max(0, Math.min(startIndex, tracks.length - 1)));
    },
    [playIndex],
  );

  const playTrack = useCallback(
    (track: Music, list?: Music[]) => {
      const tracks = list && list.length ? list : [track];
      const i = tracks.findIndex((t) => t.id === track.id);
      playIndex(tracks, i >= 0 ? i : 0);
    },
    [playIndex],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [current]);

  const next = useCallback(() => {
    if (index < queue.length - 1) playIndex(queue, index + 1);
  }, [index, queue, playIndex]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    // Restart current track if we're more than 3s in; otherwise go back.
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    if (index > 0) playIndex(queue, index - 1);
  }, [index, queue, playIndex]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = seconds;
  }, []);

  const setVolume = useCallback((v: number) => {
    const audio = audioRef.current;
    if (audio) audio.volume = v;
    setVolumeState(v);
  }, []);

  const close = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setQueue([]);
    setIndex(0);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    recordedRef.current = new Set();
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = null;
      } catch {
        /* ignore */
      }
    }
  }, []);

  const isCurrent = useCallback(
    (id: string) => current?.id === id,
    [current],
  );

  // Wire up audio element events.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      setCurrentTime(audio.currentTime);
      if (current && audio.currentTime >= 15) {
        recordPlay(current.id, Math.floor(audio.currentTime));
      }
    };
    const onMeta = () => setDuration(audio.duration || 0);
    const onEnd = () => {
      if (current) recordPlay(current.id, Math.floor(audio.duration || 0));
      if (index < queue.length - 1) {
        playIndex(queue, index + 1);
      } else {
        setIsPlaying(false);
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [current, index, queue, playIndex, recordPlay]);

  // Media Session (lock-screen / hardware keys) integration.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artistName,
      artwork: current.coverUrl
        ? [{ src: current.coverUrl, sizes: "512x512", type: "image/jpeg" }]
        : undefined,
    });
    navigator.mediaSession.setActionHandler("play", toggle);
    navigator.mediaSession.setActionHandler("pause", toggle);
    navigator.mediaSession.setActionHandler("nexttrack", next);
    navigator.mediaSession.setActionHandler("previoustrack", prev);
  }, [current, toggle, next, prev]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      queue,
      index,
      current,
      isPlaying,
      currentTime,
      duration,
      volume,
      playTrack,
      playQueue,
      toggle,
      next,
      prev,
      seek,
      setVolume,
      close,
      isCurrent,
    }),
    [
      queue,
      index,
      current,
      isPlaying,
      currentTime,
      duration,
      volume,
      playTrack,
      playQueue,
      toggle,
      next,
      prev,
      seek,
      setVolume,
      isCurrent,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {/* The single, app-wide audio element. */}
      <audio ref={audioRef} preload="metadata" />
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
