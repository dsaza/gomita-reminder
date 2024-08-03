import { Context } from "hono";

export async function parseBody (c: Context) {
	try {
		const body = await c.req.json();
		return body;
	} catch (error) {
		return null;
	}
}
