import { Context, Next } from "hono";
import { WorkerBindings } from "../types";
import { ApiResponse } from "../types";

export async function userRootPrivilege (c: Context<{ Bindings: WorkerBindings }>, next: Next) {
	try {
		const registerKey = c.req.header("Auth-Register-Key");

		if (registerKey !== c.env.ROOT_KEY) {
			return c.json<ApiResponse>({
				status: "NOT_FOUND",
				message: "Not found"
			}, 404);
		}

		await next();
	} catch (error: any) {
		return c.json<ApiResponse>({
			status: "INTERNAL_SERVER_ERROR",
			message: "Internal server error"
		}, 500);
	}
}
