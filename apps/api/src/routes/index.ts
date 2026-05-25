import { Router } from "express";
import { aiRoutes } from "../modules/ai/ai.routes.js";
import { brandStyleRoutes } from "../modules/brandStyle/brandStyle.routes.js";
import { chatRoutes } from "../modules/chat/chat.routes.js";
import { chatsRoutes } from "../modules/chats/chats.routes.js";
import { customerRoutes } from "../modules/customers/customerRoutes.js";
import { orderRoutes } from "../modules/orders/orderRoutes.js";
import { productRoutes } from "../modules/products/productRoutes.js";

export const apiRoutes = Router();

apiRoutes.use("/ai", aiRoutes);
apiRoutes.use("/brand-style", brandStyleRoutes);
apiRoutes.use("/chat", chatRoutes);
apiRoutes.use("/chats", chatsRoutes);
apiRoutes.use("/products", productRoutes);
apiRoutes.use("/customers", customerRoutes);
apiRoutes.use("/orders", orderRoutes);
