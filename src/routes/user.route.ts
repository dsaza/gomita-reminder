import { Hono } from "hono";
import { listUsers, loginUser, preLoginUser, refreshToken, storeUser } from "../controllers/user.controller";
import { userRootPrivilege } from "../middlewares/user.middleware";

const user = new Hono();

user.post("/user/register", userRootPrivilege, storeUser);
user.get("/users", userRootPrivilege, listUsers);
user.post("/user/pre-login", preLoginUser);
user.post("/user/login", loginUser);
user.post("/user/refresh-token", refreshToken);

export {
	user as userRoute
}
