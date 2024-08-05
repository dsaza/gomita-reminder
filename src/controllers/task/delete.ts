import { Context } from "hono";
import { ApiResponse, WorkerBindings, AuthVariables } from "@/types";

export async function deleteTask (c: Context<{ Bindings: WorkerBindings, Variables: AuthVariables }>) {
	try {
		const user = c.get("user");
		const taskId = c.req.param("id");

		const queryDelete = await c.env.DB
			.prepare("DELETE FROM Tasks WHERE id = ? AND userId = ?")
			.bind(taskId, user.id)
			.run();

		if (queryDelete.meta.changes === 0) {
			return c.json<ApiResponse>({
				status: "NOT_FOUND",
				message: "La tarea no existe"
			}, 404);
		}

		return c.json<ApiResponse>({
			status: "OK",
			message: "Tarea eliminada correctamente"
		});
	} catch (error: any) {
		return c.json<ApiResponse>({
			status: "INTERNAL_ERROR",
			message: "Ha ocurrido un error interno"
		}, 500);
	}
}
