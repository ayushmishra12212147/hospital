export interface JwtPayload {
  userId: string;
  hospitalId: string | null;
  username: string;
  userType: string;
}