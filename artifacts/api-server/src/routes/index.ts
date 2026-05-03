import { Router, type IRouter } from "express";
import healthRouter from "./health";
import searchRouter from "./search";
import indexRouter from "./index-routes";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/search", searchRouter);
router.use("/index", indexRouter);
router.use("/stats", statsRouter);

export default router;
