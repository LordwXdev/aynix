import "dotenv/config";
import express from "express";
import { userRoutes } from "./modules/user/user.routes.js";


const app = express();
const PORT = 3000;


app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Aynix backend is alive" });
});

app.use("/api/users", userRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

