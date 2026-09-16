const fs = require('fs');
const path = require('path');

async function test() {
  const pdfjs = require('./public/pdfjs/pdf.min.js');
  const filePath = path.join(__dirname, 'storage/انكليزي_2_6a28ddf3-393/8431c29b-82fc-4948-9943-50afe9351f28.pdf');
  const data = new Uint8Array(fs.readFileSync(filePath));

  console.log('Testing PDF loading with pdf.min.js...');
  const loadingTask = pdfjs.getDocument({
    data: data,
  });

  loadingTask.onPassword = () => console.log('Password requested');
  
  try {
    const doc = await loadingTask.promise;
    console.log('Document loaded successfully! Num pages:', doc.numPages);
    const page = await doc.getPage(1);
    const textContent = await page.getTextContent();
    console.log('Extracted text items count:', textContent.items.length);
    console.log('First 5 items:', textContent.items.slice(0, 5).map(i => i.str));
  } catch (err) {
    console.error('PDF.js Error:', err);
  }
}

test();
