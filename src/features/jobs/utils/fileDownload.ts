/**
 * Point a link at a file so the browser saves it.
 * `target="_blank"` overrides the download attribute and opens a new tab.
 */

export interface FileDownloadLink {
  href: string;
  download: string;
  rel: string;
  target: string;
}

export function applyFileDownload(link: FileDownloadLink, url: string, fileName: string): void {
  link.href = url;
  link.download = fileName;
  link.rel = "noopener noreferrer";
  link.target = "";
}
