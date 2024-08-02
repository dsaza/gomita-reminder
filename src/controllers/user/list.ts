import { Context } from "hono";
import { ApiResponse, WorkerBindings } from "../../types";

export async function listUsers (c: Context<{ Bindings: WorkerBindings }>) {
	try {
		const query = await c.env.DB
			.prepare("SELECT id, name, lastname, nickname, email FROM Users")
			.all();

		return c.json<ApiResponse>({
			status: "OK",
			message: "Showing users",
			data: query.results
		});
	} catch (error: any) {
		return c.json<ApiResponse>({
			status: "INTERNAL_ERROR",
			message: "Internal server error"
		}, 500);
	}
}
