import { useState, useCallback, useRef, useEffect } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";

export function useFileManager() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState("Untitled");
  const [isModified, setIsModified] = useState(false);
  const [content, setContentState] = useState("");
  const [fileVersion, setFileVersion] = useState(0);
  const savedContentRef = useRef("");

  const setContent = useCallback((newContent: string) => {
    setContentState(newContent);
    setIsModified(newContent !== savedContentRef.current);
  }, []);

  const extractName = (path: string) => {
    const parts = path.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || "Untitled";
  };

  const loadFileFromPath = useCallback(async (path: string) => {
    const text = await readTextFile(path);
    setFilePath(path);
    setFileName(extractName(path));
    setContentState(text);
    savedContentRef.current = text;
    setIsModified(false);
    setFileVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    invoke<string | null>("get_cli_file_path").then((path) => {
      if (path) loadFileFromPath(path);
    });
  }, [loadFileFromPath]);

  const newFile = useCallback(() => {
    setFilePath(null);
    setFileName("Untitled");
    setContentState("");
    savedContentRef.current = "";
    setIsModified(false);
    setFileVersion((v) => v + 1);
  }, []);

  const openFile = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [
        { name: "Markdown", extensions: ["md", "markdown", "mdx"] },
        { name: "Text", extensions: ["txt"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (selected) await loadFileFromPath(selected);
  }, [loadFileFromPath]);

  const saveFile = useCallback(async () => {
    if (filePath) {
      await writeTextFile(filePath, content);
      savedContentRef.current = content;
      setIsModified(false);
    } else {
      const selected = await save({
        filters: [
          { name: "Markdown", extensions: ["md"] },
          { name: "Text", extensions: ["txt"] },
        ],
      });
      if (selected) {
        await writeTextFile(selected, content);
        setFilePath(selected);
        setFileName(extractName(selected));
        savedContentRef.current = content;
        setIsModified(false);
      }
    }
  }, [filePath, content]);

  const saveFileAs = useCallback(async () => {
    const selected = await save({
      filters: [
        { name: "Markdown", extensions: ["md"] },
        { name: "Text", extensions: ["txt"] },
      ],
    });
    if (selected) {
      await writeTextFile(selected, content);
      setFilePath(selected);
      setFileName(extractName(selected));
      savedContentRef.current = content;
      setIsModified(false);
    }
  }, [content]);

  return {
    filePath,
    fileName,
    isModified,
    content,
    fileVersion,
    setContent,
    newFile,
    openFile,
    saveFile,
    saveFileAs,
    loadFileFromPath,
  };
}
