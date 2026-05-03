import { Router, type IRouter } from "express";
import healthRouter from "./health";
import searchRouter from "./search";
import indexRouter from "./index-routes";
import statsRouter from "./stats";
import crawlerRouter from "./crawler";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/search", searchRouter);
router.use("/index", indexRouter);
router.use("/stats", statsRouter);
router.use("/crawler", crawlerRouter);

export default router;
