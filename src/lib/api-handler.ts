import { ZodError } from "zod";

import {
  success,
  failure,
} from "@/lib/api-response";

export async function apiHandler(
  callback: () => Promise<unknown>
) {
  try {

    const result =
      await callback();

    return success(result);

  } catch (error) {

    console.error(error);

    if (error instanceof ZodError) {
      return failure(
        error.issues[0]?.message ??
        "Validation failed",
        400
      );
    }

    return failure(
      "Internal server error",
      500
    );
  }
}
