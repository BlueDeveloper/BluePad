import { useState, useCallback, useRef } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateStatus = "idle" | "checking" | "available" | "downloading" | "done" | "error" | "latest";

export function useUpdater() {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [newVersion, setNewVersion] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [error, setError] = useState("");
  const pendingUpdate = useRef<Update | null>(null);

  const checkForUpdate = useCallback(async () => {
    setStatus("checking");
    setError("");
    try {
      const update = await check();
      if (update) {
        pendingUpdate.current = update;
        setNewVersion(update.version);
        setReleaseNotes(update.body ?? "");
        setStatus("available");
      } else {
        pendingUpdate.current = null;
        setStatus("latest");
      }
    } catch (e) {
      const msg = String(e);
      // No update available (empty response or fetch error)
      if (msg.includes("Could not fetch") || msg.includes("204") || msg.includes("No update")) {
        setStatus("latest");
      } else {
        setError(msg);
        setStatus("error");
      }
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    const update = pendingUpdate.current;
    if (!update) return;
    setStatus("downloading");
    setProgress(0);
    try {
      let totalLength = 0;
      let downloaded = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          totalLength = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (totalLength > 0) {
            setProgress(Math.round((downloaded / totalLength) * 100));
          }
        } else if (event.event === "Finished") {
          setProgress(100);
        }
      });
      setStatus("done");
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  }, []);

  const restartApp = useCallback(async () => {
    await relaunch();
  }, []);

  return {
    status,
    progress,
    newVersion,
    releaseNotes,
    error,
    checkForUpdate,
    downloadAndInstall,
    restartApp,
  };
}
