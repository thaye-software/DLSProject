export async function GET(request: Request) {
  const { customerId } = await request.json();
}