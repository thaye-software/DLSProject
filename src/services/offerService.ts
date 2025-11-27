import { SignJWT, jwtVerify } from "jose";

const SECRET_KEY = process.env.OFFER_SECRET || "default-secret-key-change-me";
const key = new TextEncoder().encode(SECRET_KEY);

export async function createOfferToken(
  productSlug: string,
  priceDkk: number
): Promise<string> {
  const token = await new SignJWT({ productSlug, priceDkk })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d") // Offer valid for 7 days
    .sign(key);
  return token;
}

export async function verifyOfferToken(
  token: string
): Promise<{ productSlug: string; priceDkk: number } | null> {
  try {
    const { payload } = await jwtVerify(token, key);
    return {
      productSlug: payload.productSlug as string,
      priceDkk: payload.priceDkk as number,
    };
  } catch (error) {
    console.error("Invalid offer token:", error);
    return null;
  }
}
