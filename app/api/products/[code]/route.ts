import {getProduct} from '../../../../services/topten';
export async function GET(_request:Request,{params}:{params:Promise<{code:string}>}){
  const {code}=await params;
  if(!/^[A-Z0-9]{8,15}$/.test(code)||!/[A-Z]/.test(code)||!/[0-9]/.test(code))return Response.json({error:'영문과 숫자로 된 8~15자리 품번을 입력해 주세요.'},{status:400});
  const url=new URL(_request.url);const product=await getProduct(code,url.origin,url.searchParams.get('refresh')==='1');
  return Response.json(product,{headers:{'Cache-Control':product.status==='found'?'public, max-age=3600, stale-while-revalidate=86400':'no-store'}});
}
