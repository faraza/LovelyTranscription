class UploadStore {
  private file: File | null = null;

  set(file: File) {
    this.file = file;
  }

  get(): File | null {
    return this.file;
  }

  clear() {
    this.file = null;
  }
}

export const uploadStore = new UploadStore(); 