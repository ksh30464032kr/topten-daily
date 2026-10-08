export type EventProduct={
 id:string;group:string;title:string;subtitle:string;code:string;variant:string;name:string;
 price:number;normalPrice:number;image:string;url:string;points:string[];pitch:string;note?:string;
};
const product=(value:Omit<EventProduct,'image'|'url'|'normalPrice'> & {normalPrice?:number}):EventProduct=>({...value,
 normalPrice:value.normalPrice??value.price,
 image:`https://img.goodwearmall.com/goods/${value.code.slice(0,6)}/${value.variant}_M.jpg`,
 url:`https://topten10.goodwearmall.com/product/${value.variant}/detail`});
export const EVENT_CHECKED='2026-10-08';
export const eventProducts:EventProduct[]=[
 product({id:'airtech-jacket',group:'전지현 PICK · 01',title:'퀼팅에 패턴을 더하다',subtitle:'BRP · 브라운 패턴 숙지',code:'MSG4JP2402',variant:'MSG4JP2402BRP',name:'여성 AIRTECH 오버핏 재킷(퀼팅)',price:89900,
  points:['공기층을 만드는 충전재로 가벼운 착용감과 보온성을 함께 제안해요.','오버핏과 퀼팅 패턴, 코듀로이 포인트를 짚어 주세요.','소매를 접어 연출하거나 아우터 포켓을 활용하는 캐주얼 스타일에 어울려요.'],
  pitch:'가볍고 따뜻한 퀼팅 재킷이에요. 여유 있는 핏으로 편하게 입기 좋아요.'}),
 product({id:'airtech-parka',group:'전지현 PICK · 02',title:'매일 손이 가는 파카',subtitle:'CR · 크림 컬러 숙지',code:'MSG4JP2403',variant:'MSG4JP2403CR',name:'여성 AIRTECH 파카',price:69900,
  points:['크림 컬러는 셔츠·니트와 함께 밝은 가을 코디로 제안해요.','립스톱 소재와 투웨이 지퍼, 밑단 스트링 등 실용적인 디테일을 보여 주세요.','입어 본 뒤 지퍼와 밑단을 조절해 원하는 실루엣을 확인하도록 도와주세요.'],
  pitch:'가볍게 걸치기 좋은 파카예요. 지퍼와 밑단으로 핏을 조절할 수 있어요.'}),
 product({id:'warm-pants',group:'MONTHLY 01 / 05',title:'슈퍼 스트레치 웜 팬츠',subtitle:'움직임은 편하게, 안쪽은 따뜻하게',code:'MSG4PT1482',variant:'MSG4PT1482BK',name:'남성 수퍼스트레치 웜 스트레이트 팬츠',price:49900,
  points:['4WAY 스트레치가 움직임에 맞춰 늘어나 활동하기 편해요.','안쪽 면 플리스 소재로 쌀쌀한 날의 보온성을 챙겨요.','여유 있는 스트레이트 핏으로 출근부터 가벼운 활동까지 연결해요.'],
  pitch:'잘 늘어나 움직이기 편하고, 안쪽 플리스가 따뜻한 바지예요.'}),
 product({id:'lambswool',group:'MONTHLY 02 / 05',title:'램스울 케이블 스웨터',subtitle:'포근한 촉감과 입체적인 짜임',code:'MSG4ER2410',variant:'MSG4ER2410RD',name:'여성 램스울 케이블 크루넥 스웨터',price:49900,
  points:['월간 자료의 램스울 100% 원사 포인트를 소개하고 부드러운 촉감을 직접 느끼게 해 주세요.','케이블 패턴이 단정한 코디에도 입체감을 더해 줘요.','목과 손목의 감싸는 착용감, 지나치게 짧지 않은 길이를 입어 보며 확인해요.'],
  pitch:'포근한 램스울 니트예요. 꽈배기 짜임으로 하나만 입어도 포인트가 돼요.'}),
 product({id:'fuzzy',group:'MONTHLY 03 / 05',title:'퍼지 플리스',subtitle:'목까지 감싸는 가벼운 포근함',code:'MSH1TH2403',variant:'MSH1TH2403RD',name:'여성 퍼지플리스 후드 풀오버',price:19900,normalPrice:25900,
  points:['가벼운 플리스와 보슬거리는 결이 편안한 착용감을 줘요.','하이넥 후드와 밑단 스트링으로 실루엣을 조절하는 점을 소개해요.','자료 관리법: 뒤집어 세탁망에 넣고 30℃ 이하 중성세제 세탁, 비틀어 짜지 않고 그늘에서 자연건조해요.'],
  pitch:'가볍고 포근한 플리스예요. 목까지 감싸줘 쌀쌀할 때 입기 좋아요.',
  note:'자료에 품번이 없어 공식몰의 같은 라인 후드 풀오버를 연결했습니다. 자료 착장과 동일 품번인지는 미확인입니다.'}),
 product({id:'chenille',group:'MONTHLY 04 / 05',title:'셔닐 텍스처드',subtitle:'잔잔한 결로 완성하는 데일리룩',code:'MSG4TS1402',variant:'MSG4TS1402BE',name:'남성 셔닐 텍스처드 T (긴팔)',price:29900,
  points:['부드러운 셔닐 소재의 촉감을 먼저 느껴 보도록 안내해요.','짧고 촘촘한 결이 은은한 질감을 만들어 단독으로도 포인트가 돼요.','여유로운 실루엣은 데일리룩에, 셋업 팬츠와의 조합은 통일감 있는 코디에 제안해요.'],
  pitch:'촉감이 부드러운 티셔츠예요. 은은한 소재감으로 단독으로 입기 좋아요.'}),
 product({id:'fluffy-vest',group:'MONTHLY 05 / 05',title:'플러피 플리스 베스트',subtitle:'겹쳐 입기 좋은 가벼운 포인트',code:'MSG4TC2414',variant:'MSG4TC2414BRP',name:'여성 플러피플리스 베스트',price:29900,
  points:['가벼운 플리스와 포근한 촉감으로 부담 없이 한 겹 더하기 좋아요.','은은한 패턴은 셔츠·티셔츠 위에 코디 포인트가 돼요.','두껍지 않아 아우터 안에도 활용할 수 있는 레이어드 아이템으로 제안해요.'],
  pitch:'가볍고 포근한 조끼예요. 셔츠 위나 외투 안에 겹쳐 입기 좋아요.'}),
];
export const eventPhotos=[
 {id:'airtech',title:'10월 셀링포인트 · 에어테크',caption:'전지현 픽, 라인업과 관리법을 한 장으로',src:'./events/2026-10/airtech.jpg'},
 {id:'monthly',title:'먼슬리 5가지 상품',caption:'소재의 특징을 고객에게 전하는 방법',src:'./events/2026-10/monthly.jpg'},
 {id:'styling',title:'10월 스타일링 가이드',caption:'레이어드 조합과 착장 품번 확인',src:'./events/2026-10/styling.jpg'},
];
