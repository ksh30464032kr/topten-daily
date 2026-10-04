import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'TOPTEN DAILY · 오늘의 판매 TOP5',description:'판매 리포트에서 우리 매장 TOP5를 확인하는 개인용 상품 도구',icons:{icon:'./favicon.svg',apple:'./icon-192.png'},manifest:'./manifest.webmanifest'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ko"><body>{children}</body></html>;}
