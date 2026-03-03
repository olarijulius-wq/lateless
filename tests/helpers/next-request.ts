import { NextRequest } from 'next/server';

export function createNextRequest(url: string, init?: RequestInit): NextRequest {
  const request = new Request(url, init);
  return new NextRequest(request);
}
