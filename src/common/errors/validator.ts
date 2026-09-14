import * as yup from "yup";
import { BadRequestError } from "./http.error";

export const validator = async <T extends yup.AnySchema>(
  schema: T,
  data: unknown
): Promise<yup.InferType<T>> => {
  try {
    return await schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (err) {
    if (err instanceof yup.ValidationError) {
      const errorDetails = err.inner?.length
        ? err.inner.map((e) => ({ path: e.path, message: e.message }))
        : [{ path: err.path, message: err.message }];
      throw new BadRequestError(err.errors.join(", "), errorDetails);
    }
    throw err;
  }
};
