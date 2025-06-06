export interface FileInfo {
  path: string;
  name: string;
  is_directory: boolean;
  children?: FileInfo[];
}

export interface BacklinkInfo {
  file_path: string;
  file_name: string;
  context: string;
}

export interface AudioDevice {
  name: string;
  is_input: boolean;
}
