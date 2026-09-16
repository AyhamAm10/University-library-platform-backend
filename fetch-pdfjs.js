async function check() {
  try {
    const res = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    console.log('CDN STATUS:', res.status);
    const workerRes = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js');
    console.log('WORKER STATUS:', workerRes.status);
    if (res.ok && workerRes.ok) {
      const fs = require('fs');
      const path = require('path');
      const dir = path.join(__dirname, 'public', 'pdfjs');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'pdf.min.js'), Buffer.from(await res.arrayBuffer()));
      fs.writeFileSync(path.join(dir, 'pdf.worker.min.js'), Buffer.from(await workerRes.arrayBuffer()));
      console.log('SAVED PDFJS FILES LOCALLY IN backend/public/pdfjs!');
    }
  } catch (err) {
    console.error('FETCH ERROR:', err);
  }
}
check();
