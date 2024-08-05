import { Hono } from "hono";
import { ApiResponse } from "@/types";
import { userRoute } from "@/routes/user";
import { taskRoute } from "@/routes/task";

const app = new Hono();

app.get("/", (c) => {
	return c.json<ApiResponse>({
		status: "OK",
		message: "Bienvenido a la API de Gomita"
	});
});

app.route("/", userRoute);
app.route("/", taskRoute);

app.notFound((c) => {
	return c.json<ApiResponse>({
		status: "NOT_FOUND",
		message: "El recurso solicitado no existe"
	}, 404);
});

export default app;
