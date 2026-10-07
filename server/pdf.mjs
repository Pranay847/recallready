function documentError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function decodeBase64(dataBase64) {
  if (typeof dataBase64 !== 'string' || dataBase64.length === 0) throw documentError('PDF dataBase64 is required');
  const compact = dataBase64.replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact) || compact.length % 4 !== 0) throw documentError('PDF data is not valid base64');
  const buffer = Buffer.from(compact, 'base64');
  if (buffer.length > 8 * 1024 * 1024) throw documentError('PDF exceeds the 8 MB limit', 413);
  if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw documentError('Uploaded file is not a valid PDF');
  return new Uint8Array(buffer);
}

export async function extractPdfText({ filename, dataBase64 }) {
  if (typeof filename !== 'string' || !filename.toLocaleLowerCase('en-US').endsWith('.pdf')) throw documentError('Only PDF documents are supported');
  const data = decodeBase64(dataBase64);
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = getDocument({ data, isEvalSupported: false, useSystemFonts: true });
  try {
    let pdf;
    try { pdf = await loadingTask.promise; }
    catch { throw documentError('PDF could not be read'); }
    if (pdf.numPages > 40) throw documentError('PDF exceeds the 40 page limit', 413);
    const pages = [];
    let totalCharacters = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => typeof item.str === 'string' ? item.str : '').join(' ').replace(/\s+/g, ' ').trim();
      totalCharacters += pageText.length;
      if (totalCharacters > 100_000) throw documentError('PDF text exceeds the 100,000 character limit', 413);
      pages.push(pageText);
    }
    const text = pages.join('\n\n').trim();
    if (!text) throw documentError('No readable text was found. This PDF may be image-only; use a text-based PDF or paste the notice text.');
    return { text, pages: pdf.numPages };
  } finally {
    await loadingTask.destroy();
  }
}
