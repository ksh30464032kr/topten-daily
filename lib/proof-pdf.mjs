// Single A4 page containing an exact-size JPEG proof, without PDF dependencies.
export function proofPdf(jpeg,width,height){
 const enc=new TextEncoder(),parts=[],offsets=[0];let length=0;
 const add=v=>{const b=typeof v==='string'?enc.encode(v):v;parts.push(b);length+=b.length;};
 const obj=(n,body)=>{offsets[n]=length;add(`${n} 0 obj\n${body}\nendobj\n`);};
 add('%PDF-1.4\n');obj(1,'<< /Type /Catalog /Pages 2 0 R >>');obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
 obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.276 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
 offsets[4]=length;add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);add(jpeg);add('\nendstream\nendobj\n');
 const content='q\n204.094 0 0 232.441 56.693 552.756 cm\n/Im0 Do\nQ\n';
 obj(5,`<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream`);
 const start=length;add('xref\n0 6\n0000000000 65535 f \n');for(let n=1;n<=5;n++)add(String(offsets[n]).padStart(10,'0')+' 00000 n \n');add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`);
 const result=new Uint8Array(length);let cursor=0;for(const p of parts){result.set(p,cursor);cursor+=p.length;}return result;
}
