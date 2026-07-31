import Papa from "papaparse";

/**
 * Converts an array of objects to a CSV string and triggers a browser download.
 * @param filename Desired name of the downloaded file (e.g. "programtrack_report.csv")
 * @param data Array of records to export
 */
export function exportToCsv(filename: string, data: Record<string, any>[]) {
  if (!data || data.length === 0) {
    alert("No data available to export.");
    return;
  }

  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
