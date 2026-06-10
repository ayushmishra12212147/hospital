import { NextResponse } from "next/server";

export function success(data: unknown) {
  return NextResponse.json({
    success: true,
    data,
  });
}

export function failure(
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
    }
  );
}