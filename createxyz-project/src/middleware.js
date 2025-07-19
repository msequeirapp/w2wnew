import { NextResponse } from "next/server";

export const config = {
  matcher: "/integrations/:path*",
};

export function middleware(request) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-createxyz-project-id", "758a5ecc-6160-4f8f-a24c-8a4e187b3e98");
  requestHeaders.set("x-createxyz-project-group-id", "7da25fb2-10ce-4874-bc02-fa41f1229784");


  request.nextUrl.href = `https://www.create.xyz/${request.nextUrl.pathname}`;

  return NextResponse.rewrite(request.nextUrl, {
    request: {
      headers: requestHeaders,
    },
  });
}