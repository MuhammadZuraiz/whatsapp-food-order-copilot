import { Router } from "express";
import { chatRoutes } from "../modules/chat/chat.routes.js";
import { customerRoutes } from "../modules/customers/customerRoutes.js";
import { orderRoutes } from "../modules/orders/orderRoutes.js";
import { productRoutes } from "../modules/products/productRoutes.js";

export const apiRoutes = Router();

apiRoutes.use("/chat", chatRoutes);
apiRoutes.use("/products", productRoutes);
apiRoutes.use("/customers", customerRoutes);
apiRoutes.use("/orders", orderRoutes);
