// Origin Private File System (OPFS) adapter for low-overhead database binary loading/saving

export class OpfsAdapter {
  isSupported(): boolean {
    return typeof navigator !== "undefined" && !!navigator.storage && !!navigator.storage.getDirectory;
  }

  async saveFile(fileName: string, data: Uint8Array): Promise<void> {
    if (!this.isSupported()) {
      throw new Error("OPFS not supported in this browser");
    }
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(fileName, { create: true });
    // @ts-ignore
    const writable = await fileHandle.createWritable();
    await writable.write(data as any);
    await writable.close();
  }

  async readFile(fileName: string): Promise<Uint8Array | null> {
    if (!this.isSupported()) return null;
    try {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const buffer = await file.arrayBuffer();
      return new Uint8Array(buffer);
    } catch (e) {
      // File not found or failed to read
      return null;
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(fileName);
    } catch {}
  }
}
