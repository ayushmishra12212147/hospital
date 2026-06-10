import "dotenv/config";
import { generateToken, verifyToken } from "../src/lib/jwt";

const token = generateToken({
  userId: "123",
  hospitalId: null,
  userType: "SUPER_ADMIN",
  username: "owner",
});

console.log("TOKEN:");
console.log(token);

console.log("\nDECODED:");
console.log(verifyToken(token));