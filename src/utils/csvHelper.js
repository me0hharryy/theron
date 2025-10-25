// Simple CSV escaping function
const escapeCsvCell = (cellData) => {
  const dataString = String(cellData ?? ''); // Ensure it's a string, handle null/undefined
  // If the data contains a comma, quote, or newline, enclose it in double quotes
  // Also, double any existing double quotes within the string
  if (dataString.includes(',') || dataString.includes('"') || dataString.includes('\n')) {
    return `"${dataString.replace(/"/g, '""')}"`;
  }
  return dataString;
};

// Function to convert an array of objects to a CSV string
export const convertToCSV = (dataArray, headers) => {
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    // Return header row even if data is empty, or an empty string
    // return headerLabels.map(escapeCsvCell).join(',');
    return '';
  }

  // Use provided headers or derive from the first object's keys
  const headerKeys = headers ? Object.keys(headers) : Object.keys(dataArray[0]);
  const headerLabels = headers ? Object.values(headers) : headerKeys;

  const headerRow = headerLabels.map(escapeCsvCell).join(',');
  const dataRows = dataArray.map(row =>
    headerKeys.map(key => {
      // Safely access nested properties if needed (e.g., 'customer.name')
      // Handle potential undefined values during nested access
      const value = key.split('.').reduce((obj, part) => (obj && obj[part] !== undefined && obj[part] !== null) ? obj[part] : '', row);
      return escapeCsvCell(value);
    }).join(',')
  );

  return [headerRow, ...dataRows].join('\n');
};

// Function to trigger CSV download
export const downloadCSV = (csvString, filename) => {
  if (!csvString) {
      console.warn("No data to download.");
      // Optionally show a user message: alert("No data available for download in the selected range.");
      return;
  }

  const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel UTF-8 compatibility
  const link = document.createElement('a');
  if (link.download !== undefined) { // Feature detection
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Clean up
  } else {
    // Fallback for older browsers (less common now)
    alert("CSV download is not supported in this browser.");
  }
};

