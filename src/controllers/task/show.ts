import { Context } from "hono";
import { ApiResponse, AuthVariables, WorkerBindings } from "@/types";

export async function showTask (c: Context<{ Bindings: WorkerBindings, Variables: AuthVariables }>) {
	try {
		const user = c.get("user");
		const taskId = c.req.param("id");

		const queryTask = await c.env.DB
			.prepare("SELECT * FROM Tasks WHERE id = ? AND userId = ?")
			.bind(taskId, user.id)
			.first();

		if (queryTask === null) {
			return c.json<ApiResponse>({
				status: "NOT_FOUND",
				message: "La tarea no existe"
			}, 404);
		}

		return c.json<ApiResponse>({
			status: "OK",
			message: "Tarea encontrada",
			data: queryTask
		});
	} catch (error: any) {
		return c.json<ApiResponse>({
			status: "INTERNAL_ERROR",
			message: "Ha ocurrido un error interno"
		}, 500);
	}
}
