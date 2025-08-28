export function calculateLoggedHours(totalLoggedSeconds: number): number {
  return Math.round((totalLoggedSeconds / 3600) * 100) / 100;
}

export function countWeekdays(startDate: string, endDate: string, isRange: boolean): number {
  const start = new Date(startDate);
  const end = isRange ? new Date(endDate) : new Date(startDate);
  
  let count = 0;
  const current = new Date(start);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

export function getNoteValue(response: any): string {
  if (!response.time_entries || !Array.isArray(response.time_entries)) {
    return '';
  }
  
  const noteEntry = response.time_entries.find((entry: any) => entry.note && entry.note.trim() !== '');
  return noteEntry?.note || '';
}

export function checkOOOStatus(response: any, totalHours: number, isRange: boolean): boolean {
  if (isRange || totalHours > 0) {
    return false;
  }
  
  if (!response.time_entries || !Array.isArray(response.time_entries)) {
    return false;
  }
  
  return response.time_entries.some((entry: any) => {
    if (!entry.note) return false;
    const note = entry.note.toLowerCase();
    return note.includes('ooo') || 
           note.includes('out of the office') || 
           note.includes('out of office');
  });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeCsv(text: string): string {
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}