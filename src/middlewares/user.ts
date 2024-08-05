import { Context, Next } from "hono";
import { WorkerBindings } from "@/types";
import { ApiResponse } from "@/types";

export async function userRootPrivilege (c: Context<{ Bindings: WorkerBindings }>, next: Next) {
	try {
		const registerKey = c.req.header("Auth-Register-Key");

		if (registerKey !== c.env.ROOT_KEY) {
			return c.json<ApiResponse>({
				status: "UNAUTHORIZED",
				message: "No estás autorizado para acceder a este recurso"
			}, 401);
		}

		await next();
	} catch (error: any) {
		return c.json<ApiResponse>({
			status: "INTERNAL_SERVER_ERROR",
			message: "Ha ocurrido un error interno"
		}, 500);
	}
}
