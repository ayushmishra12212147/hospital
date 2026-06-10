import bcrypt from "bcryptjs";

export async function comparePassword(
  plainPassword: string,
  hashedPassword: string
) {
  return bcrypt.compare(
    plainPassword,
    hashedPassword
  );
}